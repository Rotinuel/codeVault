import "server-only";
import { connectDB } from "./mongodb.js";
import RateLimit from "../models/RateLimit.js";
import { Errors } from "./api.js";
import { getRequestMeta } from "./request.js";

/**
 * Fixed-window rate limiter backed by MongoDB (works across serverless instances).
 * @param {string} name   - bucket name, e.g. "login"
 * @param {string} id     - identifier, e.g. IP or email
 * @param {number} limit  - max requests per window
 * @param {number} windowSec
 */
export async function rateLimit(name, id, limit, windowSec) {
  await connectDB();
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSec * 1000)) * windowSec * 1000;
  const key = `${name}:${id}:${windowStart}`;
  const expiresAt = new Date(windowStart + windowSec * 1000);
  const bump = () =>
    RateLimit.findOneAndUpdate(
      { key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: "after" }
    ).lean();
  let doc;
  try {
    doc = await bump();
  } catch (error) {
    // Two concurrent upserts can race on the unique key; the retry hits the existing doc.
    if (error?.code !== 11000) throw error;
    doc = await bump();
  }
  const remaining = Math.max(0, limit - doc.count);
  const retryAfter = Math.ceil((expiresAt.getTime() - now) / 1000);
  return { allowed: doc.count <= limit, remaining, retryAfter };
}

/** Throws a 429 ApiError when the caller exceeds the limit. */
export async function enforceRateLimit(request, name, { limit, windowSec, key }) {
  const { ipAddress } = await getRequestMeta(request);
  const id = key ? `${ipAddress}:${key}` : ipAddress;
  try {
    const result = await rateLimit(name, id, limit, windowSec);
    if (!result.allowed) throw Errors.tooMany(undefined, result.retryAfter);
    return result;
  } catch (error) {
    if (error?.status === 429) throw error;
    // Fail open on limiter storage errors, but log them.
    console.error("[rate-limit] limiter error:", error?.message);
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }
}

// Sensible defaults per endpoint group.
export const LIMITS = {
  login: { limit: 10, windowSec: 15 * 60 },
  register: { limit: 5, windowSec: 60 * 60 },
  forgot: { limit: 5, windowSec: 60 * 60 },
  reset: { limit: 10, windowSec: 60 * 60 },
  password: { limit: 10, windowSec: 15 * 60 },
  paymentInit: { limit: 10, windowSec: 10 * 60 },
  paymentVerify: { limit: 30, windowSec: 10 * 60 },
  broadcast: { limit: 10, windowSec: 60 * 60 },
  ticketUpload: { limit: 10, windowSec: 24 * 60 * 60 },
  verifyEmail: { limit: 10, windowSec: 15 * 60 },
  verifyResend: { limit: 5, windowSec: 60 * 60 },
};
