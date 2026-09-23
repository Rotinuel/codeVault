import { checkoutHandler } from "@/lib/checkout-route";
import { Errors } from "@/lib/api";
import { getActiveSubscription } from "@/lib/services/subscriptions";
import { planSelectSchema } from "@/lib/validation";

// Renew the current plan. The body may omit planId; it defaults to the active plan.
export const POST = checkoutHandler("renew", {
  async resolvePlanId(request, user) {
    const body = await request.json().catch(() => ({}));
    if (body?.planId) return planSelectSchema.parse(body).planId;
    const current = await getActiveSubscription(user._id);
    if (!current) throw Errors.badRequest("You don't have an active subscription to renew. Choose a plan instead.");
    return String(current.plan);
  },
});
