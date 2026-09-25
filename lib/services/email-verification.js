import "server-only";
import { connectDB } from "../mongodb.js";
import User from "../../models/User.js";
import { ApiError, Errors } from "../api.js";
import { appUrl } from "../request.js";
import { getSettings } from "../settings.js";
import { notifyUser } from "../notifications.js";
import { messages } from "../messages.js";
import { EmailError, sendEmail, verificationEmail } from "../email.js";
import {
  CODE_TTL_MS,
  LINK_TTL_MS,
  MAX_CODE_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  generateCode,
  generateLinkToken,
  hashCode,
  hashLinkToken,
  resendWaitSeconds,
  safeEqualHex,
} from "../verification-codes.js";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not configured");
  return s;
}

/** True only for accounts that must verify (field explicitly false). */
export function needsEmailVerification(user) {
  return Boolean(user) && user.emailVerified === false;
}

/**
 * Create a fresh code + link for `userId` and email them. Replaces any earlier
 * code/link. Enforces a 60-second cooldown between sends unless `force`.
 */
export async function sendVerificationEmail(userId, { force = false } = {}) {
  await connectDB();
  const user = await User.findById(userId).select("+emailVerification name email emailVerified").lean();
  if (!user) throw Errors.notFound("Account not found");
  if (!needsEmailVerification(user)) return { alreadyVerified: true };

  const wait = resendWaitSeconds(user.emailVerification?.sentAt);
  if (!force && wait > 0) {
    throw new ApiError(429, `Please wait ${wait} seconds before requesting another email.`, { code: "RESEND_COOLDOWN", retryAfter: wait });
  }

  const now = Date.now();
  const code = generateCode();
  const token = generateLinkToken();
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        "emailVerification.codeHash": hashCode(user._id, code, secret()),
        "emailVerification.codeExpiresAt": new Date(now + CODE_TTL_MS),
        "emailVerification.attempts": 0,
        "emailVerification.tokenHash": hashLinkToken(token),
        "emailVerification.tokenExpiresAt": new Date(now + LINK_TTL_MS),
        "emailVerification.sentAt": new Date(now),
      },
      $inc: { "emailVerification.sendCount": 1 },
    }
  );

  const settings = await getSettings();
  const link = appUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  const mail = verificationEmail({
    platformName: settings.platformName,
    name: user.name,
    code,
    link,
    codeMinutes: Math.round(CODE_TTL_MS / 60_000),
    linkHours: Math.round(LINK_TTL_MS / 3_600_000),
  });
  if (process.env.NODE_ENV !== "production") console.info(`[auth] Verification for ${user.email}: code ${code} · ${link}`);

  try {
    await sendEmail({ to: user.email, ...mail, tags: [{ name: "type", value: "verify_email" }] });
  } catch (error) {
    // Let the client retry straight away if the provider failed.
    await User.updateOne({ _id: user._id }, { $set: { "emailVerification.sentAt": null } });
    console.error("[email] verification send failed:", error?.message);
    throw new ApiError(502, "We couldn't send the verification email right now. Please try again in a moment.", {
      code: error instanceof EmailError ? "EMAIL_SEND_FAILED" : "SERVER_ERROR",
    });
  }
  return { sent: true, cooldown: Math.round(RESEND_COOLDOWN_MS / 1000) };
}

async function markVerified(userId) {
  const res = await User.findOneAndUpdate(
    { _id: userId, emailVerified: false },
    { $set: { emailVerified: true, emailVerifiedAt: new Date() }, $unset: { emailVerification: 1 } },
    { returnDocument: "after" }
  ).lean();
  if (res) {
    // Welcome message now that the address is confirmed.
    const settings = await getSettings();
    await notifyUser(res, messages.registration({ platformName: settings.platformName, name: res.name })).catch((e) =>
      console.error("[auth] welcome notification failed:", e?.message)
    );
  }
  return res;
}

/** Verify the signed-in (unverified) user with the 6-digit code. */
export async function verifyWithCode(userId, code) {
  await connectDB();
  const user = await User.findById(userId).select("+emailVerification emailVerified").lean();
  if (!user) throw Errors.notFound("Account not found");
  if (!needsEmailVerification(user)) return { verified: true, alreadyVerified: true };

  const v = user.emailVerification || {};
  if (!v.codeHash || !v.codeExpiresAt || new Date(v.codeExpiresAt).getTime() < Date.now()) {
    throw Errors.badRequest("This code has expired. Request a new one.", { errors: { code: "Code expired — send a new one" } });
  }
  if ((v.attempts || 0) >= MAX_CODE_ATTEMPTS) {
    throw Errors.badRequest("Too many wrong attempts. Request a new code.", { errors: { code: "Too many attempts — send a new code" } });
  }

  if (!safeEqualHex(hashCode(user._id, code, secret()), v.codeHash)) {
    const updated = await User.findOneAndUpdate({ _id: user._id }, { $inc: { "emailVerification.attempts": 1 } }, { returnDocument: "after" })
      .select("+emailVerification")
      .lean();
    const left = Math.max(0, MAX_CODE_ATTEMPTS - (updated?.emailVerification?.attempts || MAX_CODE_ATTEMPTS));
    throw Errors.badRequest(left ? `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong attempts. Request a new code.", {
      errors: { code: left ? "Incorrect code" : "Too many attempts — send a new code" },
    });
  }

  await markVerified(user._id);
  return { verified: true };
}

/** Verify from the email link (works without being signed in). */
export async function verifyWithToken(token) {
  await connectDB();
  const user = await User.findOne({ "emailVerification.tokenHash": hashLinkToken(token) })
    .select("+emailVerification emailVerified email")
    .lean();
  if (!user) throw Errors.badRequest("This verification link is invalid or has already been used.", { code: "INVALID_LINK" });
  if (!user.emailVerification?.tokenExpiresAt || new Date(user.emailVerification.tokenExpiresAt).getTime() < Date.now()) {
    throw Errors.badRequest("This verification link has expired. Sign in to get a new one.", { code: "LINK_EXPIRED" });
  }
  await markVerified(user._id);
  return { verified: true, userId: String(user._id) };
}
