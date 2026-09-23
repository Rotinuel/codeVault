import { ok, parseBody, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { settingsSchema } from "@/lib/validation";
import { getSettings, updateSettings } from "@/lib/settings";
import { whatsappStatus } from "@/lib/whatsapp";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

function publicSettings(s) {
  // adminPermissions and job bookkeeping are managed elsewhere.
  const { adminPermissions: _p, ...rest } = s;
  return rest;
}

export const GET = withApi(async () => {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const settings = await getSettings({ fresh: true });
  return ok({
    settings: publicSettings(settings),
    whatsapp: whatsappStatus(),
    paystack: { configured: Boolean(process.env.PAYSTACK_SECRET_KEY), mode: process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_live") ? "live" : "test" },
    cron: { configured: Boolean(process.env.CRON_SECRET) },
  });
});

export const PATCH = withApi(async (request) => {
  const { user: actor } = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const body = await parseBody(request, settingsSchema);
  const settings = await updateSettings(body, actor._id);
  await logAudit({ actor, action: AUDIT_ACTIONS.SETTINGS_UPDATED, targetType: "Settings", targetId: "platform", metadata: { changes: body }, request });
  return ok({ settings: publicSettings(settings) }, { message: "Settings saved" });
});
