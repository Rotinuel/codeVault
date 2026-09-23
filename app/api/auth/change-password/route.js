import { ok, parseBody, withApi, Errors } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import User from "@/models/User";
import { changePasswordSchema } from "@/lib/validation";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { notifyUser } from "@/lib/notifications";
import { messages } from "@/lib/messages";

export const POST = withApi(async (request) => {
  const current = await requireAuth();
  await enforceRateLimit(request, "password", { ...LIMITS.password, key: String(current._id) });
  const { currentPassword, newPassword } = await parseBody(request, changePasswordSchema);

  const user = await User.findById(current._id).select("+password +tokenVersion");
  if (!(await verifyPassword(currentPassword, user.password))) {
    throw Errors.badRequest("Your current password is incorrect");
  }
  if (await verifyPassword(newPassword, user.password)) {
    throw Errors.badRequest("Choose a password different from your current one");
  }
  user.password = await hashPassword(newPassword);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1; // revoke other sessions
  await user.save();
  await createSession(user); // keep this device signed in with the new token version
  await notifyUser(current, messages.passwordChanged({ name: current.name }));
  return ok({}, { message: "Password changed. Other devices have been signed out." });
});
