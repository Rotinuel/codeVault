import { ok, parseBody, withApi } from "@/lib/api";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { forgotPasswordSchema } from "@/lib/validation";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { createResetToken } from "@/lib/password";
import { notifyUser } from "@/lib/notifications";
import { messages } from "@/lib/messages";
import { getSettings } from "@/lib/settings";
import { appUrl } from "@/lib/request";
import { USER_STATUS } from "@/lib/constants";

const GENERIC = "If an account exists for that email, a reset link has been sent to its WhatsApp number.";

export const POST = withApi(async (request) => {
  await enforceRateLimit(request, "forgot", LIMITS.forgot);
  const { email } = await parseBody(request, forgotPasswordSchema);
  await connectDB();

  const user = await User.findOne({ email, status: USER_STATUS.ACTIVE }).select("name phone status notificationPrefs");
  if (user) {
    const { token, hash, expires } = createResetToken();
    await User.updateOne({ _id: user._id }, { $set: { resetPasswordTokenHash: hash, resetPasswordExpires: expires } });
    const resetUrl = appUrl(`/reset-password?token=${token}`);
    const settings = await getSettings();
    await notifyUser(user.toObject(), messages.passwordReset({ platformName: settings.platformName, name: user.name, resetUrl }), {
      inApp: false,
      priority: 10_000,
    });
    if (process.env.NODE_ENV !== "production") console.info(`[auth] Password reset link for ${email}: ${resetUrl}`);
  }
  // Same response either way to avoid revealing which emails are registered.
  return ok({}, { message: GENERIC });
});
