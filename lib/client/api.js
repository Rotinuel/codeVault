"use client";

export class ClientApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
    this.errors = payload?.errors || null;
  }
}

/**
 * fetch wrapper for our JSON API. Cookies are sent automatically (same origin).
 * Throws ClientApiError with the server's message on failure.
 */
export async function apiFetch(url, { method = "GET", body, signal } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      signal,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ClientApiError("Network error. Check your connection and try again.", 0, null);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
      window.location.href = `/api/auth/session-reset?reason=invalid`;
    }
    if (res.status === 403 && json?.code === "EMAIL_NOT_VERIFIED" && typeof window !== "undefined") {
      window.location.href = "/verify-email";
    }
    throw new ClientApiError(json?.message || `Request failed (${res.status})`, res.status, json);
  }
  return json?.data ?? {};
}

export function toQuery(params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
