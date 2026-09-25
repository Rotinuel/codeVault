// Pure helpers for email verification codes/links (no I/O), unit-tested.
import crypto from "node:crypto";

export const CODE_TTL_MS = 30 * 60 * 1000; // 6-digit code: 30 minutes
export const LINK_TTL_MS = 24 * 60 * 60 * 1000; // link: 24 hours
export const MAX_CODE_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;

/** Uniformly random 6-digit code, e.g. "048213". */
export function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Random URL-safe token for the email link. */
export function generateLinkToken() {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Keyed hash of a code, bound to the user, so a database leak doesn't allow
 * brute-forcing 6-digit codes offline.
 */
export function hashCode(userId, code, secret) {
  return crypto.createHmac("sha256", String(secret)).update(`${userId}:${String(code).trim()}`).digest("hex");
}

export function hashLinkToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** Seconds until another email may be sent (0 = now). */
export function resendWaitSeconds(sentAt, now = Date.now()) {
  if (!sentAt) return 0;
  const left = new Date(sentAt).getTime() + RESEND_COOLDOWN_MS - now;
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

/** "e***@gmail.com" for display. */
export function maskEmail(email) {
  const [local = "", domain = ""] = String(email).split("@");
  if (!domain) return email;
  const shown = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${shown}${"•".repeat(Math.max(1, Math.min(6, local.length - shown.length)))}@${domain}`;
}
