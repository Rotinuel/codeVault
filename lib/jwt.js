// JWT helpers built on `jose`. Kept free of `server-only` so proxy.js can use
// it too; it only ever runs on the server (proxy + route handlers).
import { SignJWT, jwtVerify } from "jose";

const ISSUER = "codevault";
const AUDIENCE = "codevault:session";

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters long.");
  }
  return new TextEncoder().encode(secret);
}

export function sessionMaxAgeSeconds() {
  const raw = process.env.JWT_EXPIRES_IN || "7d";
  const m = /^(\d+)\s*([smhd])$/.exec(raw.trim());
  if (!m) return 7 * 24 * 3600;
  const n = Number(m[1]);
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[m[2]];
  return Math.max(60, n * mult);
}

/** Sign a session token. Only non-sensitive identifiers go in the payload. */
export async function signSessionToken({ userId, role, tokenVersion }) {
  return new SignJWT({ role, tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${sessionMaxAgeSeconds()}s`)
    .sign(getSecretKey());
}

/** Returns the verified payload or null (expired, tampered, wrong alg...). */
export async function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}
