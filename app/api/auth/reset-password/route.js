import { ok, parseBody, withApi, Errors } from "@/lib/api";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { resetPasswordSchema } from "@/lib/validation";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { hashPassword, hashToken } from "@/lib/password";
import { notifyUser } from "@/lib/notifications";
import { messages } from "@/lib/messages";

export const POST = withApi(async (request) => {
  await enforceRateLimit(request, "reset", LIMITS.reset);
  const { token, password } = await parseBody(request, resetPasswordSchema);
  await connectDB();

  const user = await User.findOneAndUpdate(
    { resetPasswordTokenHash: hashToken(token), resetPasswordExpires: { $gt: new Date() } },
    {
      $set: { password: await hashPassword(password), resetPasswordTokenHash: null, resetPasswordExpires: null },
      $inc: { tokenVersion: 1 }, // sign out every existing session
    },
    { returnDocument: "after" }
  ).select("name phone status notificationPrefs");
  if (!user) throw Errors.badRequest("This reset link is invalid or has expired. Request a new one.");

  await notifyUser(user.toObject(), messages.passwordChanged({ name: user.name }));
  return ok({ redirectTo: "/login?reset=1" }, { message: "Password updated. You can now sign in." });
});
