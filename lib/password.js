import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const ROUNDS = 12;
// A real hash (computed once) so failed lookups take as long as real password checks,
// preventing email enumeration through response timing.
let dummyHash = null;
function getDummyHash() {
  dummyHash ??= bcrypt.hash(crypto.randomBytes(16).toString("hex"), ROUNDS);
  return dummyHash;
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain, hash) {
  if (!hash) {
    await bcrypt.compare(plain, await getDummyHash()).catch(() => false);
    return false;
  }
  return bcrypt.compare(plain, hash);
}

export function createResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: hashToken(token), expires: new Date(Date.now() + 30 * 60 * 1000) };
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}
