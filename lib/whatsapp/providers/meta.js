// WhatsApp Cloud API (Meta) provider.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
//
// Note: free-form text messages are only delivered inside the 24-hour customer
// service window. For business-initiated messages configure approved templates
// per event in Admin → Settings → WhatsApp; the provider then sends a template
// message whose body parameters are filled from `templateParams`.

export class ProviderError extends Error {
  constructor(message, { retryable = false, status = null } = {}) {
    super(message);
    this.name = "ProviderError";
    this.retryable = retryable;
    this.status = status;
  }
}

export function createMetaProvider({ apiUrl, accessToken, phoneNumberId }) {
  const base = (apiUrl || "https://graph.facebook.com/v22.0").replace(/\/+$/, "");
  const endpoint = `${base}/${phoneNumberId}/messages`;

  async function post(payload) {
    let res;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new ProviderError(`WhatsApp request failed: ${error?.message || "network error"}`, { retryable: true });
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = json?.error?.message || `WhatsApp API error (HTTP ${res.status})`;
      throw new ProviderError(message, { retryable: res.status >= 500 || res.status === 429, status: res.status });
    }
    return { id: json?.messages?.[0]?.id ?? null };
  }

  return {
    name: "meta",
    isConfigured: Boolean(accessToken && phoneNumberId),
    async send({ to, text, template }) {
      if (template?.name) {
        return post({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "template",
          template: {
            name: template.name,
            language: { code: template.language || "en" },
            components: template.params?.length
              ? [
                  {
                    type: "body",
                    parameters: template.params.map((p) => ({ type: "text", text: String(p).slice(0, 1000) })),
                  },
                ]
              : [],
          },
        });
      }
      return post({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: String(text).slice(0, 4096) },
      });
    },
  };
}
