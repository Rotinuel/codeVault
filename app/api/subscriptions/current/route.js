import { ok, withApi } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import Subscription from "@/models/Subscription";
import { getAccessContext, serializeSubscription } from "@/lib/services/subscriptions";

// Returns ONLY the caller's own subscription data (no user id parameter → no IDOR).
export const GET = withApi(async () => {
  const user = await requireAuth();
  const ctx = await getAccessContext(user);
  const history = await Subscription.find({ user: user._id }).sort({ createdAt: -1 }).limit(20).lean();
  return ok({
    current: serializeSubscription(ctx.subscription),
    accessLevel: ctx.level,
    isStaff: ctx.isStaff,
    history: history.map(serializeSubscription),
  });
});
