import { ok, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/services/email-verification";

// Send a new verification code + link to the signed-in user's email.
export const POST = withApi(async (request) => {
  const user = await requireSession();
  await enforceRateLimit(request, "verify-resend", { ...LIMITS.verifyResend, key: String(user._id) });
  const result = await sendVerificationEmail(user._id);
  if (result.alreadyVerified) return ok({ alreadyVerified: true, redirectTo: "/dashboard" }, { message: "Your email is already verified" });
  return ok({ cooldown: result.cooldown }, { message: "A new code is on its way" });
});
