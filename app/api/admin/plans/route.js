import { ok, parseBody, withApi, Errors } from "@/lib/api";
import { requirePermission, requireStaff } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import SubscriptionPlan from "@/models/SubscriptionPlan";
import Subscription from "@/models/Subscription";
import { planSchema } from "@/lib/validation";
import { serializePlan } from "@/lib/serializers";
import { slugify } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { activeSubscriptionFilter } from "@/lib/services/subscriptions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

// Any staff member can read plans (needed to pick access levels for bet codes).
export const GET = withApi(async () => {
  await requireStaff();
  const [plans, counts] = await Promise.all([
    SubscriptionPlan.find({}).sort({ sortOrder: 1, accessLevel: 1, price: 1 }).lean(),
    Subscription.aggregate([{ $match: activeSubscriptionFilter() }, { $group: { _id: "$plan", count: { $sum: 1 } } }]),
  ]);
  const byPlan = new Map(counts.map((c) => [String(c._id), c.count]));
  return ok({ plans: plans.map((p) => ({ ...serializePlan(p), activeSubscribers: byPlan.get(String(p._id)) || 0 })) });
});

export const POST = withApi(async (request) => {
  const { user: actor } = await requirePermission(PERMISSIONS.PLANS_MANAGE);
  const body = await parseBody(request, planSchema);
  const slug = body.slug || slugify(body.name);
  if (!slug) throw Errors.badRequest("Plan name must contain letters or numbers");
  if (await SubscriptionPlan.exists({ slug })) throw Errors.conflict("A plan with this slug already exists");
  const settings = await getSettings();
  const plan = await SubscriptionPlan.create({ ...body, slug, currency: settings.currency, createdBy: actor._id });
  await logAudit({
    actor,
    action: AUDIT_ACTIONS.PLAN_CREATED,
    targetType: "SubscriptionPlan",
    targetId: plan._id,
    metadata: { name: plan.name, price: plan.price, durationDays: plan.durationDays, accessLevel: plan.accessLevel },
    request,
  });
  return ok({ plan: serializePlan(plan) }, { status: 201, message: "Plan created" });
});
