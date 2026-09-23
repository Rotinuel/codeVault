import { z } from "zod";
import mongoose from "mongoose";
import { ok, pageMeta, parseQuery, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { escapeRegex, listQuerySchema, objectId } from "@/lib/validation";
import { PAYMENT_STATUS, PAYMENT_STATUS_VALUES } from "@/lib/constants";
import { serializePayment } from "@/lib/services/payments";

const schema = listQuerySchema(["createdAt", "paidAt", "amount"], {
  status: z.enum(PAYMENT_STATUS_VALUES).optional(),
  plan: objectId.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const GET = withApi(async (request) => {
  await requirePermission(PERMISSIONS.PAYMENTS_VIEW);
  const { page, limit, q, sort, order, status, plan, from, to } = parseQuery(request, schema);
  const filter = {};
  if (status) filter.status = status;
  // Cast explicitly: aggregation pipelines do not auto-cast strings to ObjectIds.
  if (plan) filter.plan = new mongoose.Types.ObjectId(plan);
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
  }
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const users = await User.find({ $or: [{ name: rx }, { email: rx }] }).select("_id").limit(500).lean();
    filter.$or = [{ reference: rx }, { user: { $in: users.map((u) => u._id) } }];
  }

  const [items, total, totals] = await Promise.all([
    Payment.find(filter)
      .populate("user", "name email")
      .sort({ [sort]: order === "asc" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([
      { $match: { ...filter, status: PAYMENT_STATUS.SUCCESS } },
      { $group: { _id: "$currency", revenue: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);

  return ok({
    payments: items.map((p) => ({
      ...serializePayment(p),
      user: p.user ? { id: String(p.user._id), name: p.user.name, email: p.user.email } : null,
      gateway: p.gateway,
      verifiedVia: p.verifiedVia,
    })),
    totals: totals.map((t) => ({ currency: t._id, revenue: t.revenue, count: t.count })),
    meta: pageMeta(page, limit, total),
  });
});
