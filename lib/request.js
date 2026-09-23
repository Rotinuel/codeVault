import "server-only";
import { headers } from "next/headers";

export function getClientIpFromHeaders(h) {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 64);
  return (h.get("x-real-ip") || "unknown").slice(0, 64);
}

/** IP + user agent for audit logs and rate limiting. */
export async function getRequestMeta(request) {
  let h = request?.headers;
  if (!h) {
    try {
      h = await headers();
    } catch {
      // Outside a request scope (e.g. background work): no client metadata.
      return { ipAddress: null, userAgent: null };
    }
  }
  return {
    ipAddress: getClientIpFromHeaders(h),
    userAgent: (h.get("user-agent") || "").slice(0, 300),
  };
}

export function appUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path}`;
}

/**
 * CSRF defence for cookie-authenticated mutations: the Origin header (sent by
 * all modern browsers on POST/PATCH/DELETE) must match our own host.
 * SameSite=Lax cookies already block most cross-site requests; this closes the gap.
 */
export function assertSameOrigin(request) {
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser clients (no ambient cookies) or same-origin navigations
  try {
    const originHost = new URL(origin).host;
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const allowed = new Set([host]);
    if (process.env.NEXT_PUBLIC_APP_URL) allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).host);
    return allowed.has(originHost);
  } catch {
    return false;
  }
}
