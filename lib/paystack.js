// Paystack API client (server-only). The secret key never leaves the server.
// Docs: https://paystack.com/docs/api/transaction/
import "server-only";
import crypto from "node:crypto";
import { toSubunit } from "./payment-validation.js";

function baseUrl() {
  return (process.env.PAYSTACK_API_URL || "https://api.paystack.co").replace(/\/+$/, "");
}

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

export class PaystackError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "PaystackError";
    this.status = status;
  }
}

async function request(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new PaystackError(`Could not reach Paystack: ${error?.message || "network error"}`, 502);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.status) {
    throw new PaystackError(json?.message || `Paystack request failed (HTTP ${res.status})`, res.status);
  }
  return json.data;
}

export { toSubunit };

export function generateReference(prefix = "CV") {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`.toUpperCase();
}

export async function initializeTransaction({ email, amount, currency, reference, callbackUrl, metadata }) {
  return request("/transaction/initialize", {
    method: "POST",
    body: {
      email,
      amount: String(toSubunit(amount)),
      currency,
      reference,
      callback_url: callbackUrl,
      metadata: JSON.stringify(metadata || {}),
    },
  });
}

/** Server-to-server verification. This, not the browser redirect, is the source of truth. */
export async function verifyTransaction(reference) {
  if (!/^[A-Za-z0-9_\-.=]{6,100}$/.test(String(reference))) {
    throw new PaystackError("Invalid transaction reference", 400);
  }
  return request(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/** Validate the `x-paystack-signature` header (HMAC-SHA512 of the raw body). */
export function verifyWebhookSignature(rawBody, signature) {
  if (!signature || typeof signature !== "string") return false;
  const expected = crypto.createHmac("sha512", secretKey()).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Only non-sensitive fields are persisted from Paystack responses. */
export function pickPaystackData(tx) {
  if (!tx) return null;
  return {
    id: tx.id,
    status: tx.status,
    reference: tx.reference,
    amount: tx.amount,
    currency: tx.currency,
    channel: tx.channel,
    gateway_response: tx.gateway_response,
    paid_at: tx.paid_at || tx.paidAt || null,
    created_at: tx.created_at || tx.createdAt || null,
    fees: tx.fees ?? null,
    customer_email: tx.customer?.email ?? null,
    card: tx.authorization
      ? {
          brand: tx.authorization.brand,
          last4: tx.authorization.last4,
          bank: tx.authorization.bank,
          card_type: tx.authorization.card_type,
        }
      : null,
  };
}
