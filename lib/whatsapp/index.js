// WhatsApp provider abstraction. To add a provider (e.g. Twilio, 360dialog),
// implement { name, isConfigured, send({ to, text, template }) } and register it here.
import "server-only";
import { createMetaProvider } from "./providers/meta.js";
import { createConsoleProvider } from "./providers/console.js";

export { ProviderError } from "./providers/meta.js";

let cached = null;

export function getWhatsAppProvider() {
  if (cached) return cached;
  const choice = (process.env.WHATSAPP_PROVIDER || "meta").toLowerCase();
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (choice === "meta" && accessToken && phoneNumberId) {
    cached = createMetaProvider({
      apiUrl: process.env.WHATSAPP_API_URL,
      accessToken,
      phoneNumberId,
    });
  } else if (choice === "console" || process.env.NODE_ENV !== "production") {
    cached = createConsoleProvider();
  } else {
    // Production without credentials: report as unconfigured so messages are skipped, not faked.
    cached = { name: "none", isConfigured: false, async send() { throw new Error("WhatsApp is not configured"); } };
  }
  return cached;
}

export function whatsappStatus() {
  const p = getWhatsAppProvider();
  return { provider: p.name, configured: p.isConfigured, live: p.name === "meta" };
}
