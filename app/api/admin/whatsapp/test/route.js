import { ok, parseBody, withApi, ApiError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { whatsappTestSchema, normalizePhone } from "@/lib/validation";
import { getWhatsAppProvider } from "@/lib/whatsapp";
import { getSettings } from "@/lib/settings";
import { enforceRateLimit } from "@/lib/rate-limit";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

// Sends one message immediately (bypassing the queue) to verify credentials.
export const POST = withApi(async (request) => {
  const { user: actor } = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  await enforceRateLimit(request, "wa-test", { limit: 10, windowSec: 3600, key: String(actor._id) });
  const body = await parseBody(request, whatsappTestSchema);
  const provider = getWhatsAppProvider();
  if (!provider.isConfigured) throw new ApiError(400, "WhatsApp credentials are not configured on the server");
  const settings = await getSettings();
  const to = normalizePhone(body.phone, process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "234");
  try {
    const res = await provider.send({ to, text: body.message || `Test message from ${settings.platformName}. WhatsApp notifications are working ✅` });
    await logAudit({ actor, action: AUDIT_ACTIONS.WHATSAPP_TEST_SENT, targetType: "Settings", targetId: "whatsapp", metadata: { to: `${to.slice(0, 4)}…`, provider: provider.name }, request });
    return ok({ provider: provider.name, messageId: res?.id ?? null }, { message: provider.name === "console" ? "Logged to the server console (development provider)" : "Test message sent" });
  } catch (error) {
    throw new ApiError(502, `WhatsApp error: ${error?.message || "send failed"}`);
  }
});
