import { z } from "zod";
import { ok, pageMeta, parseQuery, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import User from "@/models/User";
import Subscription from "@/models/Subscription";
import { adminUser } from "@/lib/serializers";
import { escapeRegex, listQuerySchema } from "@/lib/validation";
import { ROLES, ROLE_VALUES, USER_STATUS_VALUES } from "@/lib/constants";
import { activeSubscriptionFilter, serializeSubscription } from "@/lib/services/subscriptions";

const schema = listQuerySchema(["createdAt", "name", "email", "lastLoginAt", "status"], {
  role: z.enum(ROLE_VALUES).optional(),
  status: z.enum(USER_STATUS_VALUES).optional(),
  subscription: z.enum(["active", "none"]).optional(),
});

export const GET = withApi(async (request) => {
  const { user: actor } = await requirePermission(PERMISSIONS.USERS_VIEW);
  const { page, limit, q, sort, order, role, status, subscription } = parseQuery(request, schema);

  const filter = {};
  // Admins only see client accounts; Super Admins see everyone.
  if (actor.role !== ROLES.SUPER_ADMIN) filter.role = ROLES.USER;
  else if (role) filter.role = role;
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  if (subscription) {
    const activeUserIds = await Subscription.distinct("user", activeSubscriptionFilter());
    filter._id = subscription === "active" ? { $in: activeUserIds } : { $nin: activeUserIds };
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ [sort]: order === "asc" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const subs = await Subscription.find({ user: { $in: items.map((u) => u._id) }, ...activeSubscriptionFilter() })
    .sort({ accessLevel: -1 })
    .lean();
  const subByUser = new Map();
  for (const s of subs) if (!subByUser.has(String(s.user))) subByUser.set(String(s.user), s);

  return ok({
    users: items.map((u) => ({ ...adminUser(u), subscription: serializeSubscription(subByUser.get(String(u._id))) })),
    meta: pageMeta(page, limit, total),
  });
});
