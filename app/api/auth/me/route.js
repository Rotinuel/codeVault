import { ok, withApi } from "@/lib/api";
import { requireAuth, getUserPermissions } from "@/lib/auth";
import { getAccessContext, serializeSubscription } from "@/lib/services/subscriptions";
import { publicUser } from "@/lib/serializers";

export const GET = withApi(async () => {
  const user = await requireAuth();
  const [ctx, permissions] = await Promise.all([getAccessContext(user), getUserPermissions(user)]);
  return ok({
    user: publicUser(user),
    subscription: serializeSubscription(ctx.subscription),
    accessLevel: ctx.level,
    permissions,
  });
});
