import { z } from "zod";
import { ok, pageMeta, parseQuery, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import AuditLog from "@/models/AuditLog";
import { escapeRegex, listQuerySchema } from "@/lib/validation";

const schema = listQuerySchema(["createdAt", "action"], {
  action: z.string().regex(/^[A-Z_]{3,60}$/).optional(),
  targetType: z.enum(["User", "BetCode", "Category", "SubscriptionPlan", "Payment", "Settings", "Broadcast", "WinningTicket"]).optional(),
});

export const GET = withApi(async (request) => {
  await requirePermission(PERMISSIONS.AUDIT_VIEW);
  const { page, limit, q, sort, order, action, targetType } = parseQuery(request, schema);
  const filter = {};
  if (action) filter.action = action;
  if (targetType) filter.targetType = targetType;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ userEmail: rx }, { action: rx }, { targetId: rx }, { ipAddress: rx }];
  }
  const [items, total, actions] = await Promise.all([
    AuditLog.find(filter)
      .sort({ [sort]: order === "asc" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
    AuditLog.distinct("action"),
  ]);
  return ok({
    logs: items.map((l) => ({
      id: String(l._id),
      user: l.userEmail,
      role: l.userRole,
      action: l.action,
      targetType: l.targetType,
      targetId: l.targetId,
      metadata: l.metadata,
      ipAddress: l.ipAddress,
      userAgent: l.userAgent,
      createdAt: l.createdAt,
    })),
    actions: actions.sort(),
    meta: pageMeta(page, limit, total),
  });
});
