import { Errors, getRouteId, ok, parseBody, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import BetCode from "@/models/BetCode";
import Favorite from "@/models/Favorite";
import BetCodeView from "@/models/BetCodeView";
import { betCodeUpdateSchema } from "@/lib/validation";
import { getAdminBetCode, serializeForAdmin, updateBetCode } from "@/lib/services/betcodes";
import { getLevelNames } from "@/lib/services/subscriptions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

export const GET = withApi(async (request, context) => {
  await requirePermission(PERMISSIONS.BETCODES_VIEW);
  const id = await getRouteId(context);
  const doc = await BetCode.findById(id).populate("category", "name slug color").populate("createdBy", "name").lean();
  if (!doc) throw Errors.notFound("Bet code not found");
  return ok({ betCode: serializeForAdmin(doc, { levelNames: await getLevelNames() }) });
});

export const PATCH = withApi(async (request, context) => {
  const { user: actor, permissions } = await requirePermission(PERMISSIONS.BETCODES_EDIT);
  const id = await getRouteId(context);
  const body = await parseBody(request, betCodeUpdateSchema);
  if (["NOW", "SCHEDULE"].includes(body.releaseType) && !permissions.includes(PERMISSIONS.BETCODES_PUBLISH)) {
    throw Errors.forbidden("You don't have permission to publish or schedule bet codes");
  }
  const { doc, changes, statusChanged } = await updateBetCode(id, body, actor);
  await logAudit({
    actor,
    action: !statusChanged
      ? AUDIT_ACTIONS.BETCODE_UPDATED
      : doc.status === "PUBLISHED"
        ? AUDIT_ACTIONS.BETCODE_PUBLISHED
        : doc.status === "SCHEDULED"
          ? AUDIT_ACTIONS.BETCODE_SCHEDULED
          : AUDIT_ACTIONS.BETCODE_UNPUBLISHED,
    targetType: "BetCode",
    targetId: id,
    metadata: { title: doc.title, changes, status: doc.status, publishAt: doc.publishAt },
    request,
  });
  return ok({ betCode: await getAdminBetCode(id) }, { message: "Bet code updated" });
});

export const DELETE = withApi(async (request, context) => {
  const { user: actor } = await requirePermission(PERMISSIONS.BETCODES_DELETE);
  const id = await getRouteId(context);
  const doc = await BetCode.findByIdAndDelete(id).lean();
  if (!doc) throw Errors.notFound("Bet code not found");
  await Promise.all([Favorite.deleteMany({ betCode: id }), BetCodeView.deleteMany({ betCode: id })]);
  await logAudit({
    actor,
    action: AUDIT_ACTIONS.BETCODE_DELETED,
    targetType: "BetCode",
    targetId: id,
    metadata: { title: doc.title, accessLevel: doc.accessLevel, status: doc.status },
    request,
  });
  return ok({ id }, { message: "Bet code deleted" });
});
