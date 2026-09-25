import { z } from "zod";
import { ok, pageMeta, parseQuery, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { TICKET_STATUS_VALUES } from "@/lib/constants";
import { adminListTickets } from "@/lib/services/winning-tickets";

const schema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
  q: z.string().trim().max(100).optional().default(""),
  status: z.enum(TICKET_STATUS_VALUES).optional(),
  showcase: z.enum(["1"]).optional(),
});

export const GET = withApi(async (request) => {
  await requirePermission(PERMISSIONS.WINNING_TICKETS_REVIEW);
  const { page, limit, q, status, showcase } = parseQuery(request, schema);
  const { tickets, counts, total } = await adminListTickets({ page, limit, q, status, showcase: Boolean(showcase) });
  return ok({ tickets, counts, meta: pageMeta(page, limit, total) });
});
