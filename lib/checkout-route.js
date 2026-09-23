import "server-only";
import { ok, parseBody, withApi } from "./api.js";
import { requireRole } from "./auth.js";
import { enforceRateLimit, LIMITS } from "./rate-limit.js";
import { initializePayment } from "./services/payments.js";
import { planSelectSchema } from "./validation.js";
import { ROLES } from "./constants.js";

/**
 * Factory for checkout endpoints (/subscriptions/subscribe|renew|upgrade and
 * /payments/initialize). Only the plan id is accepted from the client; amount,
 * currency and duration always come from the database.
 */
export function checkoutHandler(intent, { resolvePlanId } = {}) {
  return withApi(async (request) => {
    const user = await requireRole(ROLES.USER);
    await enforceRateLimit(request, "payment-init", { ...LIMITS.paymentInit, key: String(user._id) });
    let planId;
    if (resolvePlanId) planId = await resolvePlanId(request, user);
    else planId = (await parseBody(request, planSelectSchema)).planId;
    const result = await initializePayment({ user, planId, intent, request });
    return ok(result, { message: result.free ? "Plan activated" : "Redirecting to Paystack…" });
  });
}
