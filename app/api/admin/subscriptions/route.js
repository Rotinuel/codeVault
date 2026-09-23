import { z } from "zod";
import { ok, pageMeta, parseQuery, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import Subscription from "@/models/Subscription";
import User from "@/models/User";
import { escapeRegex, listQuerySchema, objectId } from "@/lib/validation";
import { SUBSCRIPTION_STATUS, SUBSCRIPTION_STATUS_VALUES, SUBSCRIPTION_TYPE_VALUES } from "@/lib/constants";
import { serializeSubscription } from "@/lib/services/subscriptions";

const schema = listQuerySchema(["createdAt", "endDate", "startDate", "price", "accessLevel"], {
  status: z.enum([...SUBSCRIPTION_STATUS_VALUES, "LIVE", "EXPIRING"]).optional(),
  plan: objectId.optional(),
  type: z.enum(SUBSCRIPTION_TYPE_VALUES).optional(),
});

export const GET = withApi(async (request) => {
  await requirePermission(PERMISSIONS.SUBSCRIPTIONS_VIEW);
  const { page, limit, q, sort, order, status, plan, type } = parseQuery(request, schema);
  const now = new Date();
  const filter = {};
  if (status === "LIVE") Object.assign(filter, { status: SUBSCRIPTION_STATUS.ACTIVE, startDate: { $lte: now }, endDate: { $gt: now } });
  else if (status === "EXPIRING") Object.assign(filter, { status: SUBSCRIPTION_STATUS.ACTIVE, endDate: { $gt: now, $lte: new Date(now.getTime() + 7 * 86_400_000) } });
  else if (status) filter.status = status;
  if (plan) filter.plan = plan;
  if (type) filter.type = type;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const users = await User.find({ $or: [{ name: rx }, { email: rx }] }).select("_id").limit(500).lean();
    filter.user = { $in: users.map((u) => u._id) };
  }

  const [items, total, liveCount, expiredCount] = await Promise.all([
    Subscription.find(filter)
      .populate("user", "name email phone")
      .sort({ [sort]: order === "asc" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Subscription.countDocuments(filter),
    Subscription.countDocuments({ status: SUBSCRIPTION_STATUS.ACTIVE, startDate: { $lte: now }, endDate: { $gt: now } }),
    Subscription.countDocuments({ status: SUBSCRIPTION_STATUS.EXPIRED }),
  ]);

  return ok({
    subscriptions: items.map((s) => ({
      ...serializeSubscription(s),
      user: s.user ? { id: String(s.user._id), name: s.user.name, email: s.user.email, phone: s.user.phone } : null,
      createdAt: s.createdAt,
      cancelReason: s.cancelReason,
    })),
    summary: { live: liveCount, expired: expiredCount },
    meta: pageMeta(page, limit, total),
  });
});
