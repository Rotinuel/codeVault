// Transactional email via Resend (https://resend.com/docs/api-reference/emails/send-email).
// Server-only. Without RESEND_API_KEY, emails are printed to the server console
// in development so sign-up still works locally.
import "server-only";

export class EmailError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "EmailError";
    this.status = status;
  }
}

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress() {
  return process.env.EMAIL_FROM || "CodeVault <onboarding@resend.dev>";
}

/**
 * Send one email. Returns { id } (or { id: null, logged: true } in dev without a key).
 * Throws EmailError if the provider rejects it.
 */
export async function sendEmail({ to, subject, html, text, tags }) {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV === "production") throw new EmailError("Email is not configured (RESEND_API_KEY missing)", 500);
    console.info(`\n[email] (not sent — RESEND_API_KEY not set)\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return { id: null, logged: true };
  }

  let res;
  try {
    res = await fetch(`${(process.env.RESEND_API_URL || "https://api.resend.com").replace(/\/+$/, "")}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromAddress(), to: [to], subject, html, text, tags }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new EmailError(`Could not reach the email service: ${error?.message || "network error"}`, 502);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new EmailError(json?.message || `Email service error (HTTP ${res.status})`, res.status);
  return { id: json?.id ?? null };
}

// ── Templates ─────────────────────────────────────────────────

function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function verificationEmail({ platformName, name, code, link, codeMinutes, linkHours }) {
  const first = String(name || "").split(" ")[0] || "there";
  const subject = `${code} is your ${platformName} verification code`;
  const text = [
    `Hi ${first},`,
    "",
    `Welcome to ${platformName}! Confirm your email address to finish creating your account.`,
    "",
    `Your verification code: ${code}`,
    `(expires in ${codeMinutes} minutes)`,
    "",
    `Or open this link (valid for ${linkHours} hours):`,
    link,
    "",
    "If you didn't sign up, you can ignore this email.",
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
        <tr><td style="background:#0b1220;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:700">${escapeHtml(platformName)}</td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 12px;font-size:16px">Hi ${escapeHtml(first)},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#334155">Welcome! Enter this code to confirm your email address and finish creating your account.</p>
          <div style="margin:0 0 8px;padding:16px;border-radius:12px;background:#f1f5f9;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;font-family:Menlo,Consolas,monospace">${escapeHtml(code)}</div>
          <p style="margin:0 0 24px;font-size:13px;color:#64748b;text-align:center">Expires in ${codeMinutes} minutes</p>
          <p style="margin:0 0 12px;font-size:15px;color:#334155;text-align:center">Or verify with one tap:</p>
          <p style="margin:0 0 24px;text-align:center">
            <a href="${escapeHtml(link)}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:10px">Verify my email</a>
          </p>
          <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8">The button works for ${linkHours} hours. If you didn't create an account, ignore this email and nothing will happen.</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#94a3b8">18+ only. Please gamble responsibly.</p>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html, text };
}
