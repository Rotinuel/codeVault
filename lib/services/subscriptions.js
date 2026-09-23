import "server-only";
import { cache } from "react";
import { connectDB } from "../mongodb.js";
import Subscription from "../../models/Subscription.js";
import SubscriptionPlan from "../../models/SubscriptionPlan.js";
import User from "../../models/User.js";
import {
  FREE_ACCESS_LEVEL,
  MAX_ACCESS_LEVEL,
  STAFF_ROLES,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TYPE,
} from "../constants.js";
import { accessLevelOf, daysRemaining, upgradeCreditDays } from "../access.js";
import { getSettings } from "../settings.js";
import { notifyUser } from "../notifications.js";
import { messages } from "../messages.js";
import { ApiError } from "../api.js";

const DAY_MS = 86_400_000;
export const FREE_HISTORY_DAYS = 7;

/** Filter for subscriptions that grant access at `now`. */
export function activeSubscriptionFilter(now = new Date()) {
  return {
    status: SUBSCRIPTION_STATUS.ACTIVE,
    startDate: { $lte: now },
    endDate: { $gt: now },
  };
}

/**
 * The user's currently effective subscription (highest access level if several
 * overlap), or null. Expired subscriptions are never returned even if the
 * background job has not yet flipped their status.
 */
export async function getActiveSubscription(userId, { now = new Date(), populatePlan = false, lean = true } = {}) {
  await connectDB();
  let q = Subscription.findOne({ user: userId, ...activeSubscriptionFilter(now) }).sort({ accessLevel: -1, endDate: -1 });
  if (populatePlan) q = q.populate("plan", "name slug historyDays priorityNotifications accessLevel price durationDays isActive");
  if (lean) q = q.lean();
  return q;
}

const loadAccessContext = cache(async (userId, role) => {
  const subscription = await getActiveSubscription(userId, { populatePlan: true });
  const isStaff = STAFF_ROLES.includes(role);
  const subLevel = accessLevelOf(subscription);
  const level = isStaff ? MAX_ACCESS_LEVEL : subLevel;
  let historyDays = FREE_HISTORY_DAYS;
  if (isStaff) historyDays = null;
  else if (subscription) historyDays = subscription.plan?.historyDays ?? null;
  return {
    isStaff,
    subscription,
    level,
    subscriptionLevel: subLevel,
    historyDays,
    daysRemaining: subscription ? daysRemaining(subscription.endDate) : 0,
  };
});

/** Everything the server needs to authorise content for a user in one object. */
export async function getAccessContext(user) {
  return loadAccessContext(String(user._id), user.role);
}

/** Map access level → display name (e.g. 3 → "Premium"), from active plans. */
export async function getLevelNames() {
  await connectDB();
  const plans = await SubscriptionPlan.find({})
    .sort({ isActive: -1, sortOrder: 1, price: 1 })
    .select("name accessLevel isActive")
    .lean();
  const names = { [FREE_ACCESS_LEVEL]: "Free" };
  for (const p of plans) if (!names[p.accessLevel]) names[p.accessLevel] = p.name;
  return names;
}

export function levelName(levelNames, level) {
  return levelNames?.[level] ?? `Level ${level}`;
}

/**
 * Decide what a purchase of `plan` means given the current subscription.
 * DOWNGRADE is rejected at checkout (the user keeps their higher plan until it ends).
 */
export function determinePurchaseType(current, plan, now = new Date()) {
  if (!current || accessLevelOf(current, now) === FREE_ACCESS_LEVEL) return SUBSCRIPTION_TYPE.NEW;
  if (String(current.plan?._id ?? current.plan) === String(plan._id)) return SUBSCRIPTION_TYPE.RENEWAL;
  if (plan.accessLevel > current.accessLevel) return SUBSCRIPTION_TYPE.UPGRADE;
  if (plan.accessLevel === current.accessLevel) return SUBSCRIPTION_TYPE.SWITCH;
  return SUBSCRIPTION_TYPE.DOWNGRADE;
}

/**
 * Apply a verified, successful payment to the user's subscriptions.
 * Idempotent: a payment already attached to a subscription is never applied twice.
 */
export async function activateFromPayment(payment, now = new Date()) {
  await connectDB();
  const already = await Subscription.findOne({ payments: payment._id });
  if (already) return { subscription: already, type: payment.appliedType || already.type, alreadyApplied: true };

  const snap = payment.planSnapshot;
  const durationMs = snap.durationDays * DAY_MS;
  const current = await getActiveSubscription(payment.user, { now, lean: false });
  const base = {
    user: payment.user,
    plan: payment.plan,
    planName: snap.name,
    planSlug: snap.slug,
    accessLevel: snap.accessLevel,
    price: payment.amount,
    currency: payment.currency,
    durationDays: snap.durationDays,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    payments: [payment._id],
  };

  let type;
  let subscription;

  if (!current) {
    const last = await Subscription.findOne({ user: payment.user }).sort({ endDate: -1 }).select("_id plan").lean();
    type = last && String(last.plan) === String(payment.plan) ? SUBSCRIPTION_TYPE.RENEWAL : SUBSCRIPTION_TYPE.NEW;
    subscription = await Subscription.create({
      ...base,
      type,
      startDate: now,
      endDate: new Date(now.getTime() + durationMs),
      previousSubscription: last?._id ?? null,
    });
  } else if (String(current.plan) === String(payment.plan)) {
    type = SUBSCRIPTION_TYPE.RENEWAL;
    subscription = await Subscription.findOneAndUpdate(
      { _id: current._id, payments: { $ne: payment._id } },
      {
        $push: { payments: payment._id },
        $set: { endDate: new Date(current.endDate.getTime() + durationMs), reminderSentAt: null },
        $inc: { renewalCount: 1 },
      },
      { returnDocument: "after" }
    );
    subscription ??= current;
  } else if (snap.accessLevel >= current.accessLevel) {
    type = snap.accessLevel > current.accessLevel ? SUBSCRIPTION_TYPE.UPGRADE : SUBSCRIPTION_TYPE.SWITCH;
    const credit = upgradeCreditDays({
      currentEndDate: current.endDate,
      currentPrice: current.price,
      currentDurationDays: current.durationDays,
      newPrice: payment.amount,
      newDurationDays: snap.durationDays,
      now,
    });
    subscription = await Subscription.create({
      ...base,
      type,
      creditDays: credit,
      startDate: now,
      endDate: new Date(now.getTime() + durationMs + credit * DAY_MS),
      previousSubscription: current._id,
    });
    await Subscription.updateOne(
      { _id: current._id },
      {
        $set: {
          status: SUBSCRIPTION_STATUS.CANCELLED,
          cancelledAt: now,
          cancelReason: `Replaced by ${type.toLowerCase()} to ${snap.name}`,
          replacedBy: subscription._id,
        },
      }
    );
  } else {
    // A lower plan was paid for while a higher one is active (e.g. two tabs).
    // Queue it to start when the current subscription ends so no paid time is lost.
    type = SUBSCRIPTION_TYPE.DOWNGRADE;
    subscription = await Subscription.create({
      ...base,
      type,
      startDate: current.endDate,
      endDate: new Date(current.endDate.getTime() + durationMs),
      previousSubscription: current._id,
    });
  }

  if (type !== SUBSCRIPTION_TYPE.DOWNGRADE) {
    await User.updateOne({ _id: payment.user }, { $set: { subscription: subscription._id } });
  }
  return { subscription, type, alreadyApplied: false };
}

// ── Admin: manual modifications ──────────────────────────────

export async function grantSubscription({ userId, planId, days, actorId, notes }) {
  await connectDB();
  const plan = await SubscriptionPlan.findById(planId).lean();
  if (!plan) throw new ApiError(404, "Plan not found");
  const now = new Date();
  const duration = (days || plan.durationDays) * DAY_MS;
  const current = await getActiveSubscription(userId, { now, lean: false });
  if (current) {
    await Subscription.updateOne(
      { _id: current._id },
      { $set: { status: SUBSCRIPTION_STATUS.CANCELLED, cancelledAt: now, cancelReason: "Replaced by manual grant", modifiedBy: actorId } }
    );
  }
  const subscription = await Subscription.create({
    user: userId,
    plan: plan._id,
    planName: plan.name,
    planSlug: plan.slug,
    accessLevel: plan.accessLevel,
    price: 0,
    currency: plan.currency,
    durationDays: days || plan.durationDays,
    startDate: now,
    endDate: new Date(now.getTime() + duration),
    status: SUBSCRIPTION_STATUS.ACTIVE,
    type: SUBSCRIPTION_TYPE.MANUAL,
    previousSubscription: current?._id ?? null,
    modifiedBy: actorId,
    notes: notes || "",
  });
  if (current) await Subscription.updateOne({ _id: current._id }, { $set: { replacedBy: subscription._id } });
  await User.updateOne({ _id: userId }, { $set: { subscription: subscription._id } });
  const user = await User.findById(userId).select("name phone status notificationPrefs").lean();
  const settings = await getSettings();
  await notifyUser(
    user,
    messages.subscriptionActivated({
      platformName: settings.platformName,
      name: user?.name,
      planName: plan.name,
      endDate: subscription.endDate,
      type: "NEW",
    })
  );
  return subscription;
}

export async function extendSubscription({ userId, days, actorId, notes }) {
  await connectDB();
  const current = await getActiveSubscription(userId, { lean: false });
  if (!current) throw new ApiError(400, "User has no active subscription to extend");
  current.endDate = new Date(current.endDate.getTime() + days * DAY_MS);
  current.modifiedBy = actorId;
  current.reminderSentAt = null;
  if (notes) current.notes = notes;
  await current.save();
  return current;
}

export async function cancelSubscription({ userId, actorId, notes }) {
  await connectDB();
  const now = new Date();
  const res = await Subscription.updateMany(
    { user: userId, status: SUBSCRIPTION_STATUS.ACTIVE, endDate: { $gt: now } },
    { $set: { status: SUBSCRIPTION_STATUS.CANCELLED, cancelledAt: now, cancelReason: notes || "Cancelled by administrator", modifiedBy: actorId } }
  );
  if (!res.modifiedCount) throw new ApiError(400, "User has no active subscription to cancel");
  return res.modifiedCount;
}

// ── Background jobs ─────────────────────────────────────────

/** Flip ACTIVE → EXPIRED for subscriptions past their end date and notify users. */
export async function expireDueSubscriptions(now = new Date(), batch = 500) {
  await connectDB();
  const due = await Subscription.find({ status: SUBSCRIPTION_STATUS.ACTIVE, endDate: { $lte: now } })
    .select("_id user planName")
    .limit(batch)
    .lean();
  let expired = 0;
  const settings = await getSettings();
  for (const sub of due) {
    const flipped = await Subscription.findOneAndUpdate(
      { _id: sub._id, status: SUBSCRIPTION_STATUS.ACTIVE },
      { $set: { status: SUBSCRIPTION_STATUS.EXPIRED, expiredNotifiedAt: now } },
      { returnDocument: "after" }
    );
    if (!flipped) continue;
    expired++;
    // A queued/overlapping subscription may take over; only notify if access actually ended.
    const next = await getActiveSubscription(sub.user, { now });
    if (next) {
      await User.updateOne({ _id: sub.user }, { $set: { subscription: next._id } });
      continue;
    }
    if (settings.notifications.subscriptionExpired !== false) {
      const user = await User.findById(sub.user).select("name phone status notificationPrefs").lean();
      if (user) await notifyUser(user, messages.subscriptionExpired({ name: user.name, planName: sub.planName }));
    }
  }
  return { expired };
}

/** Remind users N days before expiry (once per subscription period). */
export async function sendExpiryReminders(now = new Date(), batch = 500) {
  await connectDB();
  const settings = await getSettings();
  if (settings.notifications.expiryReminder === false) return { reminded: 0 };
  const days = settings.notifications.expiryReminderDays || 3;
  const horizon = new Date(now.getTime() + days * DAY_MS);
  const due = await Subscription.find({
    status: SUBSCRIPTION_STATUS.ACTIVE,
    startDate: { $lte: now },
    endDate: { $gt: now, $lte: horizon },
    reminderSentAt: null,
  })
    .select("_id user planName endDate")
    .limit(batch)
    .lean();
  let reminded = 0;
  for (const sub of due) {
    const claimed = await Subscription.findOneAndUpdate(
      { _id: sub._id, reminderSentAt: null },
      { $set: { reminderSentAt: now } }
    );
    if (!claimed) continue;
    // Skip if another subscription continues access after this one ends.
    const continues = await Subscription.exists({
      user: sub.user,
      _id: { $ne: sub._id },
      status: SUBSCRIPTION_STATUS.ACTIVE,
      endDate: { $gt: sub.endDate },
    });
    if (continues) continue;
    const user = await User.findById(sub.user).select("name phone status notificationPrefs").lean();
    if (!user) continue;
    await notifyUser(
      user,
      messages.expiryReminder({ name: user.name, planName: sub.planName, endDate: sub.endDate, days: daysRemaining(sub.endDate, now) })
    );
    reminded++;
  }
  return { reminded };
}

/** Plain, client-safe subscription summary. */
export function serializeSubscription(sub) {
  if (!sub) return null;
  return {
    id: String(sub._id),
    planId: String(sub.plan?._id ?? sub.plan),
    planName: sub.planName,
    planSlug: sub.planSlug,
    accessLevel: sub.accessLevel,
    price: sub.price,
    currency: sub.currency,
    durationDays: sub.durationDays,
    startDate: sub.startDate,
    endDate: sub.endDate,
    status: sub.status,
    type: sub.type,
    creditDays: sub.creditDays || 0,
    daysRemaining: daysRemaining(sub.endDate),
    historyDays: sub.plan?.historyDays ?? null,
  };
}
