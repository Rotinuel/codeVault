import { Errors, getRouteId, ok, parseBody, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import User from "@/models/User";
import { manualSubscriptionSchema } from "@/lib/validation";
import { ROLES } from "@/lib/constants";
import {
  cancelSubscription,
  extendSubscription,
  grantSubscription,
  serializeSubscription,
} from "@/lib/services/subscriptions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

// Manual subscription changes are Super-Admin-only (subscriptions.manage is not delegable).
export const POST = withApi(async (request, context) => {
  const { user: actor } = await requirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE);
  const id = await getRouteId(context);
  const target = await User.findById(id).select("email role").lean();
  if (!target) throw Errors.notFound("User not found");
  if (target.role !== ROLES.USER) throw Errors.badRequest("Subscriptions can only be managed for client accounts");

  const body = await parseBody(request, manualSubscriptionSchema);
  let result;
  let action;
  if (body.action === "GRANT") {
    result = serializeSubscription(await grantSubscription({ userId: id, planId: body.planId, days: body.days, actorId: actor._id, notes: body.notes }));
    action = AUDIT_ACTIONS.SUBSCRIPTION_GRANTED;
  } else if (body.action === "EXTEND") {
    result = serializeSubscription(await extendSubscription({ userId: id, days: body.days, actorId: actor._id, notes: body.notes }));
    action = AUDIT_ACTIONS.SUBSCRIPTION_EXTENDED;
  } else {
    result = { cancelled: await cancelSubscription({ userId: id, actorId: actor._id, notes: body.notes }) };
    action = AUDIT_ACTIONS.SUBSCRIPTION_CANCELLED;
  }
  await logAudit({ actor, action, targetType: "User", targetId: id, metadata: { email: target.email, ...body }, request });
  return ok({ result }, { message: "Subscription updated" });
});
