import { z } from "zod";
import { ok, parseQuery, withApi } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { fulfillPayment, serializePayment } from "@/lib/services/payments";
import { serializeSubscription } from "@/lib/services/subscriptions";
import Subscription from "@/models/Subscription";

const schema = z.object({
  reference: z.string().trim().regex(/^[A-Za-z0-9_\-.=]{6,100}$/, "Invalid reference"),
  cancelled: z.string().optional(),
});

// Called by the /payments/callback page after Paystack redirects back.
// The browser's claim of success is ignored: we verify directly with Paystack.
export const GET = withApi(async (request) => {
  const user = await requireAuth();
  await enforceRateLimit(request, "payment-verify", { ...LIMITS.paymentVerify, key: String(user._id) });
  const { reference, cancelled } = parseQuery(request, schema);
  const result = await fulfillPayment(reference, {
    source: "callback",
    cancelled: cancelled === "1",
    expectedUserId: user._id,
  });
  let subscription = result.subscription ?? null;
  if (!subscription && result.status === "SUCCESS" && result.payment?.subscription) {
    // Scoped to the caller: never return someone else's subscription.
    subscription = await Subscription.findOne({ _id: result.payment.subscription, user: user._id }).lean();
  }
  return ok({
    status: result.status,
    payment: serializePayment(result.payment),
    subscription: subscription ? serializeSubscription(subscription) : null,
    type: result.type ?? null,
    alreadyProcessed: Boolean(result.alreadyProcessed),
  });
});
