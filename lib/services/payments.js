import "server-only";
import { connectDB } from "../mongodb.js";
import Payment from "../../models/Payment.js";
import SubscriptionPlan from "../../models/SubscriptionPlan.js";
import Subscription from "../../models/Subscription.js";
import User from "../../models/User.js";
import { PAYMENT_STATUS, SUBSCRIPTION_TYPE } from "../constants.js";
import { ApiError } from "../api.js";
import { appUrl, getRequestMeta } from "../request.js";
import { generateReference, initializeTransaction, PaystackError, pickPaystackData, verifyTransaction } from "../paystack.js";
import { toSubunit, validateGatewayTransaction } from "../payment-validation.js";
import { activateFromPayment, determinePurchaseType, getActiveSubscription } from "./subscriptions.js";
import { getSettings } from "../settings.js";
import { notifyUser } from "../notifications.js";
import { messages } from "../messages.js";
import { AUDIT_ACTIONS, logAudit } from "../audit.js";
import { formatDate } from "../utils.js";

const REUSE_WINDOW_MS = 30 * 60 * 1000;
const STALE_PROCESSING_MS = 2 * 60 * 1000;

const INTENT_RULES = {
  subscribe: null, // any valid purchase type
  renew: [SUBSCRIPTION_TYPE.RENEWAL],
  upgrade: [SUBSCRIPTION_TYPE.UPGRADE, SUBSCRIPTION_TYPE.SWITCH],
};

/**
 * Start a Paystack checkout for `planId`. The amount is always read from the
 * database; nothing price-related is accepted from the client.
 */
export async function initializePayment({ user, planId, intent = "subscribe", request }) {
  await connectDB();
  const plan = await SubscriptionPlan.findOne({ _id: planId, isActive: true }).lean();
  if (!plan) throw new ApiError(404, "This plan is not available");

  const current = await getActiveSubscription(user._id);
  const type = determinePurchaseType(current, plan);

  if (type === SUBSCRIPTION_TYPE.DOWNGRADE) {
    throw new ApiError(
      400,
      `You're on ${current.planName}, which includes everything in ${plan.name}. You can switch after it ends on ${formatDate(current.endDate)}.`,
      { code: "DOWNGRADE_NOT_ALLOWED" }
    );
  }
  const allowed = INTENT_RULES[intent];
  if (allowed && !allowed.includes(type)) {
    const msg =
      intent === "renew"
        ? current
          ? `Renewal applies to your current plan (${current.planName}). Use upgrade to change plans.`
          : "You don't have an active subscription to renew. Subscribe to a plan instead."
        : current
          ? "Choose a plan with a higher access level to upgrade."
          : "You don't have an active subscription to upgrade. Subscribe to a plan instead.";
    throw new ApiError(400, msg, { code: "INVALID_INTENT" });
  }

  const settings = await getSettings();
  const currency = plan.currency || settings.currency;
  const planSnapshot = {
    name: plan.name,
    slug: plan.slug,
    accessLevel: plan.accessLevel,
    durationDays: plan.durationDays,
    price: plan.price,
    currency,
  };
  const { ipAddress } = await getRequestMeta(request);

  // Free plans (e.g. trials) activate immediately, once per user per plan.
  if (plan.price === 0) {
    const used = await Subscription.exists({ user: user._id, plan: plan._id });
    if (used) throw new ApiError(400, "You have already used this free plan", { code: "FREE_PLAN_USED" });
    const payment = await Payment.create({
      user: user._id,
      plan: plan._id,
      planSnapshot,
      reference: generateReference("FREE"),
      amount: 0,
      currency,
      status: PAYMENT_STATUS.PROCESSING,
      processingAt: new Date(),
      intent: type,
      gateway: "free",
      ipAddress,
    });
    const { subscription, type: applied } = await activateFromPayment(payment);
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { status: PAYMENT_STATUS.SUCCESS, paidAt: new Date(), processedAt: new Date(), subscription: subscription._id, appliedType: applied, verifiedVia: "manual" } }
    );
    await notifyUser(
      user,
      messages.subscriptionActivated({ platformName: settings.platformName, name: user.name, planName: plan.name, endDate: subscription.endDate, type: applied })
    );
    return { free: true, reference: payment.reference, redirectUrl: `/payments/callback?reference=${payment.reference}` };
  }

  // Reuse a recent, still-pending checkout for the same plan & price to avoid duplicate charges.
  const pending = await Payment.findOne({
    user: user._id,
    plan: plan._id,
    amount: plan.price,
    status: PAYMENT_STATUS.PENDING,
    authorizationUrl: { $ne: null },
    createdAt: { $gte: new Date(Date.now() - REUSE_WINDOW_MS) },
  })
    .sort({ createdAt: -1 })
    .lean();
  if (pending && pending.intent === type) {
    return { authorizationUrl: pending.authorizationUrl, reference: pending.reference, reused: true };
  }

  const reference = generateReference("SUB");
  const payment = await Payment.create({
    user: user._id,
    plan: plan._id,
    planSnapshot,
    reference,
    amount: plan.price,
    currency,
    status: PAYMENT_STATUS.PENDING,
    intent: type,
    ipAddress,
  });

  try {
    const tx = await initializeTransaction({
      email: user.email,
      amount: plan.price,
      currency,
      reference,
      callbackUrl: appUrl("/payments/callback"),
      metadata: {
        paymentId: String(payment._id),
        userId: String(user._id),
        planId: String(plan._id),
        type,
        cancel_action: appUrl(`/payments/callback?reference=${encodeURIComponent(reference)}&cancelled=1`),
        custom_fields: [
          { display_name: "Plan", variable_name: "plan", value: plan.name },
          { display_name: "Customer", variable_name: "customer", value: user.name },
        ],
      },
    });
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { accessCode: tx.access_code, authorizationUrl: tx.authorization_url } }
    );
    return { authorizationUrl: tx.authorization_url, reference };
  } catch (error) {
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { status: PAYMENT_STATUS.FAILED, failureReason: String(error?.message || "Initialisation failed").slice(0, 300) } }
    );
    console.error("[payments] initialize failed:", error?.message);
    throw new ApiError(502, "We couldn't start the payment. Please try again in a moment.", { code: "GATEWAY_ERROR" });
  }
}

function mapGatewayStatus(status, cancelled) {
  switch (status) {
    case "success":
      return PAYMENT_STATUS.SUCCESS;
    case "failed":
    case "reversed":
      return PAYMENT_STATUS.FAILED;
    case "abandoned":
      return cancelled ? PAYMENT_STATUS.CANCELLED : PAYMENT_STATUS.ABANDONED;
    default:
      return cancelled ? PAYMENT_STATUS.CANCELLED : PAYMENT_STATUS.PENDING; // ongoing / pending / processing / queued
  }
}

async function notifyFailureOnce(payment, reason) {
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, failureNotifiedAt: null },
    { $set: { failureNotifiedAt: new Date() } }
  );
  if (!claimed) return;
  const user = await User.findById(payment.user).select("name phone status notificationPrefs").lean();
  if (!user) return;
  await notifyUser(
    user,
    messages.paymentFailed({
      name: user.name,
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.reference,
      planName: payment.planSnapshot?.name,
      reason,
    })
  );
}

/**
 * Verify a transaction with Paystack and, if paid, activate the subscription.
 * Safe to call any number of times (callback page, webhook, reconciliation job):
 * an atomic status claim guarantees a payment is fulfilled exactly once.
 */
export async function fulfillPayment(reference, { source = "callback", cancelled = false, expectedUserId = null } = {}) {
  await connectDB();
  const payment = await Payment.findOne({ reference });
  if (!payment) throw new ApiError(404, "Payment not found");
  // IDOR guard: users may only verify their own payments.
  if (expectedUserId && String(payment.user) !== String(expectedUserId)) throw new ApiError(404, "Payment not found");

  if (payment.status === PAYMENT_STATUS.SUCCESS) {
    return { status: PAYMENT_STATUS.SUCCESS, payment, alreadyProcessed: true };
  }
  if (payment.gateway === "free") {
    return { status: payment.status, payment };
  }

  let tx;
  try {
    tx = await verifyTransaction(reference);
  } catch (error) {
    if (error instanceof PaystackError && (error.status === 404 || error.status === 400) && cancelled) {
      await Payment.updateOne(
        { _id: payment._id, status: PAYMENT_STATUS.PENDING },
        { $set: { status: PAYMENT_STATUS.CANCELLED, failureReason: "Cancelled by customer" } }
      );
      return { status: PAYMENT_STATUS.CANCELLED, payment };
    }
    console.error("[payments] verify failed:", error?.message);
    throw new ApiError(502, "We couldn't confirm your payment with Paystack yet. Please refresh in a moment.", { code: "GATEWAY_ERROR" });
  }

  const gatewayStatus = mapGatewayStatus(tx.status, cancelled);

  if (gatewayStatus !== PAYMENT_STATUS.SUCCESS) {
    const updated = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $nin: [PAYMENT_STATUS.SUCCESS, PAYMENT_STATUS.PROCESSING] } },
      {
        $set: {
          status: gatewayStatus,
          gatewayResponse: tx.gateway_response ?? null,
          paystackData: pickPaystackData(tx),
          failureReason: gatewayStatus === PAYMENT_STATUS.PENDING ? null : tx.gateway_response || tx.status,
          verifiedVia: source,
        },
      },
      { returnDocument: "after" }
    );
    if (gatewayStatus === PAYMENT_STATUS.FAILED) await notifyFailureOnce(payment, tx.gateway_response);
    return { status: gatewayStatus, payment: updated ?? payment };
  }

  // Paystack says "success" — make sure it's for exactly this payment.
  const problems = validateGatewayTransaction(payment, tx);
  if (problems.length) {
    await Payment.updateOne(
      { _id: payment._id, status: { $ne: PAYMENT_STATUS.SUCCESS } },
      {
        $set: {
          status: PAYMENT_STATUS.FAILED,
          failureReason: `Verification mismatch: ${problems.join(", ")}`,
          paystackData: pickPaystackData(tx),
          verifiedVia: source,
        },
      }
    );
    await logAudit({
      actor: null,
      action: AUDIT_ACTIONS.PAYMENT_MISMATCH,
      targetType: "Payment",
      targetId: payment._id,
      metadata: { reference, problems, gatewayAmount: tx.amount, expectedAmount: toSubunit(payment.amount) },
    });
    return { status: PAYMENT_STATUS.FAILED, payment, mismatch: problems };
  }

  // Atomically claim the payment so concurrent callback + webhook can't double-activate.
  const now = new Date();
  let claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELLED, PAYMENT_STATUS.ABANDONED] } },
    { $set: { status: PAYMENT_STATUS.PROCESSING, processingAt: now } },
    { returnDocument: "after" }
  );
  if (!claimed) {
    claimed = await Payment.findOneAndUpdate(
      { _id: payment._id, status: PAYMENT_STATUS.PROCESSING, processingAt: { $lt: new Date(now.getTime() - STALE_PROCESSING_MS) } },
      { $set: { processingAt: now } },
      { returnDocument: "after" }
    );
  }
  if (!claimed) {
    const fresh = await Payment.findById(payment._id);
    return { status: fresh?.status ?? PAYMENT_STATUS.PROCESSING, payment: fresh ?? payment, alreadyProcessed: fresh?.status === PAYMENT_STATUS.SUCCESS };
  }

  let result;
  try {
    result = await activateFromPayment(claimed, now);
  } catch (error) {
    await Payment.updateOne({ _id: claimed._id, status: PAYMENT_STATUS.PROCESSING }, { $set: { status: PAYMENT_STATUS.PENDING } });
    throw error;
  }

  const paidAt = tx.paid_at || tx.paidAt ? new Date(tx.paid_at || tx.paidAt) : now;
  const done = await Payment.findOneAndUpdate(
    { _id: claimed._id },
    {
      $set: {
        status: PAYMENT_STATUS.SUCCESS,
        paidAt,
        processedAt: new Date(),
        paymentMethod: tx.channel ?? null,
        gatewayResponse: tx.gateway_response ?? null,
        paystackData: pickPaystackData(tx),
        subscription: result.subscription._id,
        appliedType: result.type,
        failureReason: null,
        verifiedVia: source,
      },
    },
    { returnDocument: "after" }
  );

  if (!result.alreadyApplied) {
    const settings = await getSettings();
    const user = await User.findById(claimed.user).select("name phone status notificationPrefs").lean();
    if (user) {
      await notifyUser(
        user,
        messages.paymentSuccess({
          name: user.name,
          amount: claimed.amount,
          currency: claimed.currency,
          reference,
          planName: claimed.planSnapshot.name,
        })
      );
      await notifyUser(
        user,
        messages.subscriptionActivated({
          platformName: settings.platformName,
          name: user.name,
          planName: claimed.planSnapshot.name,
          endDate: result.subscription.endDate,
          type: result.type,
        }),
        { priority: 5 }
      );
    }
  }

  return { status: PAYMENT_STATUS.SUCCESS, payment: done, subscription: result.subscription, type: result.type };
}

/** Re-verify stale pending payments (catches missed webhooks/closed tabs). */
export async function reconcilePendingPayments({ limit = 20 } = {}) {
  await connectDB();
  const now = Date.now();
  const stale = await Payment.find({
    status: PAYMENT_STATUS.PENDING,
    gateway: "paystack",
    authorizationUrl: { $ne: null },
    createdAt: { $lte: new Date(now - 10 * 60_000), $gte: new Date(now - 48 * 3600_000) },
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .select("reference")
    .lean();
  const results = { checked: 0, succeeded: 0 };
  for (const p of stale) {
    try {
      const r = await fulfillPayment(p.reference, { source: "job" });
      results.checked++;
      if (r.status === PAYMENT_STATUS.SUCCESS) results.succeeded++;
    } catch (error) {
      console.error("[payments] reconcile failed for", p.reference, error?.message);
    }
  }
  // Pending checkouts older than 48h are abandoned for good.
  await Payment.updateMany(
    { status: PAYMENT_STATUS.PENDING, createdAt: { $lt: new Date(now - 48 * 3600_000) } },
    { $set: { status: PAYMENT_STATUS.ABANDONED, failureReason: "Checkout not completed" } }
  );
  return results;
}

export function serializePayment(p) {
  return {
    id: String(p._id),
    reference: p.reference,
    planName: p.planSnapshot?.name ?? p.plan?.name ?? "—",
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    type: p.appliedType || p.intent,
    paymentMethod: p.paymentMethod,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
    failureReason: p.failureReason ?? null,
  };
}
