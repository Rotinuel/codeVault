import { ok, parseBody, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { betCodeBatchSchema } from "@/lib/validation";
import { createBetCodeBatch } from "@/lib/services/betcodes";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

// Schedule several releases for one day in a single request, e.g.
// 10:00 → Code A, 13:00 → Code B, 16:00 → Code C, 20:00 → Code D.
export const POST = withApi(async (request) => {
  const { user: actor } = await requirePermission(PERMISSIONS.BETCODES_CREATE, PERMISSIONS.BETCODES_PUBLISH);
  const body = await parseBody(request, betCodeBatchSchema);
  const { batchId, created } = await createBetCodeBatch(body, actor);
  await logAudit({
    actor,
    action: AUDIT_ACTIONS.BETCODE_BATCH_CREATED,
    targetType: "BetCode",
    targetId: batchId,
    metadata: {
      date: body.date,
      timezone: body.timezone,
      accessLevel: body.accessLevel,
      releases: created.map((c) => ({ id: String(c._id), title: c.title, publishAt: c.publishAt })),
    },
    request,
  });
  return ok({ batchId, count: created.length }, { status: 201, message: `${created.length} release${created.length === 1 ? "" : "s"} scheduled` });
});
