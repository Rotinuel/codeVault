// Development provider: logs messages instead of sending them. Used automatically
// when WhatsApp credentials are not configured, so local development works
// without a Meta account. It is never selected when credentials are present.
export function createConsoleProvider() {
  return {
    name: "console",
    isConfigured: true,
    async send({ to, text, template }) {
      const label = template?.name ? `template:${template.name}` : "text";
      console.info(`\n[whatsapp:console] → ${to} (${label})\n${text}\n`);
      return { id: `console_${Date.now()}` };
    },
  };
}
