import { z } from "zod";
import { ok, pageMeta, parseQuery, withApi } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import Payment from "@/models/Payment";
import { serializePayment } from "@/lib/services/payments";
import { PAYMENT_STATUS_VALUES } from "@/lib/constants";

const schema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(15),
  status: z.enum(PAYMENT_STATUS_VALUES).optional(),
});

// The caller's own payment history only — the query is always scoped to user._id.
export const GET = withApi(async (request) => {
  const user = await requireAuth();
  const { page, limit, status } = parseQuery(request, schema);
  const filter = { user: user._id, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Payment.countDocuments(filter),
  ]);
  return ok({ payments: items.map(serializePayment), meta: pageMeta(page, limit, total) });
});
