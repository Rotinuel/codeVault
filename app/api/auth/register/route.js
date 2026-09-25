import { ok, parseBody, withApi, Errors } from "@/lib/api";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { registerSchema, normalizePhone } from "@/lib/validation";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { publicUser } from "@/lib/serializers";
import { ROLES, TERMS_VERSION, USER_STATUS } from "@/lib/constants";
import { sendVerificationEmail } from "@/lib/services/email-verification";

export const POST = withApi(async (request) => {
  await enforceRateLimit(request, "register", LIMITS.register);
  const body = await parseBody(request, registerSchema);
  await connectDB();

  const existing = await User.findOne({ email: body.email }).select("_id emailVerified role").lean();
  if (existing) {
    // An unverified sign-up never proved it owns this address (and can't have paid
    // or uploaded anything), so whoever can verify the email may claim it.
    if (existing.emailVerified === false && existing.role === ROLES.USER) await User.deleteOne({ _id: existing._id, emailVerified: false });
    else throw Errors.conflict("An account with this email already exists");
  }

  const phone = normalizePhone(body.phone, process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "234");
  // Role and status are always set server-side; any client-supplied values are ignored.
  const user = await User.create({
    name: body.name,
    email: body.email,
    phone,
    password: await hashPassword(body.password),
    role: ROLES.USER,
    status: USER_STATUS.ACTIVE,
    emailVerified: false,
    termsAcceptedAt: new Date(),
    termsVersion: TERMS_VERSION,
    lastLoginAt: new Date(),
  });

  await createSession(user);
  // The welcome message goes out once the email is verified. If sending fails
  // now, the account still exists and the verify page offers "Resend".
  let emailSent = true;
  try {
    await sendVerificationEmail(user._id, { force: true });
  } catch (error) {
    emailSent = false;
    console.error("[auth] verification email failed at sign-up:", error?.message);
  }

  return ok(
    { user: publicUser(user), redirectTo: "/verify-email", emailSent },
    { status: 201, message: "Account created — check your email for a verification code" }
  );
});
