import { Errors, getRouteId, ok, parseBody, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import SubscriptionPlan from "@/models/SubscriptionPlan";
import Subscription from "@/models/Subscription";
import Payment from "@/models/Payment";
import { planUpdateSchema } from "@/lib/validation";
import { serializePlan } from "@/lib/serializers";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

export const PATCH = withApi(async (request, context) => {
  const { user: actor } = await requirePermission(PERMISSIONS.PLANS_MANAGE);
  const id = await getRouteId(context);
  const body = await parseBody(request, planUpdateSchema);
  const before = await SubscriptionPlan.findById(id).lean();
  if (!before) throw Errors.notFound("Plan not found");
  if (body.slug && body.slug !== before.slug && (await SubscriptionPlan.exists({ slug: body.slug, _id: { $ne: id } }))) {
    throw Errors.conflict("A plan with this slug already exists");
  }
  // Existing subscriptions keep the terms they paid for (snapshotted); changes apply to new purchases.
  const plan = await SubscriptionPlan.findByIdAndUpdate(id, { $set: body }, { returnDocument: "after", runValidators: true }).lean();

  const changes = {};
  for (const [k, v] of Object.entries(body)) {
    if (JSON.stringify(before[k]) !== JSON.stringify(v)) changes[k] = { from: before[k], to: v };
  }
  if (changes.price) {
    await logAudit({
      actor,
      action: AUDIT_ACTIONS.PLAN_PRICE_CHANGED,
      targetType: "SubscriptionPlan",
      targetId: id,
      metadata: { name: plan.name, from: before.price, to: plan.price },
      request,
    });
  }
  if (Object.keys(changes).length) {
    await logAudit({ actor, action: AUDIT_ACTIONS.PLAN_UPDATED, targetType: "SubscriptionPlan", targetId: id, metadata: { name: plan.name, changes }, request });
  }
  return ok({ plan: serializePlan(plan) }, { message: "Plan updated" });
});

export const DELETE = withApi(async (request, context) => {
  const { user: actor } = await requirePermission(PERMISSIONS.PLANS_MANAGE);
  const id = await getRouteId(context);
  const [subs, payments] = await Promise.all([Subscription.countDocuments({ plan: id }), Payment.countDocuments({ plan: id })]);
  if (subs || payments) {
    throw Errors.conflict("This plan has subscription or payment history. Deactivate it instead of deleting it.");
  }
  const plan = await SubscriptionPlan.findByIdAndDelete(id).lean();
  if (!plan) throw Errors.notFound("Plan not found");
  await logAudit({ actor, action: AUDIT_ACTIONS.PLAN_DELETED, targetType: "SubscriptionPlan", targetId: id, metadata: { name: plan.name }, request });
  return ok({ id }, { message: "Plan deleted" });
});
