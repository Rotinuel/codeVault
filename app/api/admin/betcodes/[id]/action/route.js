import { Errors, getRouteId, ok, parseBody, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { betCodeActionSchema } from "@/lib/validation";
import { applyBetCodeAction, getAdminBetCode } from "@/lib/services/betcodes";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

const ACTION_PERMISSION = {
  publish: PERMISSIONS.BETCODES_PUBLISH,
  unpublish: PERMISSIONS.BETCODES_PUBLISH,
  archive: PERMISSIONS.BETCODES_PUBLISH,
  restore: PERMISSIONS.BETCODES_PUBLISH,
  feature: PERMISSIONS.BETCODES_EDIT,
  unfeature: PERMISSIONS.BETCODES_EDIT,
  setResult: PERMISSIONS.BETCODES_EDIT,
};

const ACTION_AUDIT = {
  publish: AUDIT_ACTIONS.BETCODE_PUBLISHED,
  unpublish: AUDIT_ACTIONS.BETCODE_UNPUBLISHED,
  archive: AUDIT_ACTIONS.BETCODE_ARCHIVED,
  restore: AUDIT_ACTIONS.BETCODE_RESTORED,
  feature: AUDIT_ACTIONS.BETCODE_FEATURED,
  unfeature: AUDIT_ACTIONS.BETCODE_FEATURED,
  setResult: AUDIT_ACTIONS.BETCODE_RESULT_SET,
};

const MESSAGES = {
  publish: "Bet code published",
  unpublish: "Bet code moved to drafts",
  archive: "Bet code archived",
  restore: "Bet code restored to drafts",
  feature: "Bet code featured",
  unfeature: "Bet code unfeatured",
  setResult: "Result updated",
};

export const POST = withApi(async (request, context) => {
  const id = await getRouteId(context);
  const body = await parseBody(request, betCodeActionSchema);
  const permission = ACTION_PERMISSION[body.action];
  if (!permission) throw Errors.badRequest("Unknown action");
  const { user: actor } = await requirePermission(permission);
  const doc = await applyBetCodeAction(id, body, actor);
  await logAudit({
    actor,
    action: ACTION_AUDIT[body.action],
    targetType: "BetCode",
    targetId: id,
    metadata: { title: doc.title, action: body.action, result: body.result, featured: doc.isFeatured },
    request,
  });
  return ok({ betCode: await getAdminBetCode(id) }, { message: MESSAGES[body.action] });
});
