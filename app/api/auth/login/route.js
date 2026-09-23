import { ok, parseBody, withApi, Errors } from "@/lib/api";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { loginSchema } from "@/lib/validation";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { publicUser } from "@/lib/serializers";
import { STAFF_ROLES, USER_STATUS } from "@/lib/constants";

function safeNext(next, fallback) {
  // Only allow same-site relative paths to prevent open redirects.
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) return next;
  return fallback;
}

export const POST = withApi(async (request) => {
  await enforceRateLimit(request, "login", LIMITS.login);
  const body = await parseBody(request, loginSchema);
  // Per-account limit as well, to slow credential stuffing from many IPs.
  await enforceRateLimit(request, "login-account", { limit: 20, windowSec: 15 * 60, key: body.email });

  await connectDB();
  const user = await User.findOne({ email: body.email }).select("+password +tokenVersion");
  const valid = await verifyPassword(body.password, user?.password);
  if (!user || !valid) throw Errors.unauthorized("Invalid email or password");

  if (user.status === USER_STATUS.SUSPENDED) throw Errors.forbidden("Your account is suspended. Contact support.");
  if (user.status === USER_STATUS.BANNED) throw Errors.forbidden("Your account has been banned.");

  user.lastLoginAt = new Date();
  user.lastSeenAt = new Date();
  await user.save();
  await createSession(user);

  const url = new URL(request.url);
  const fallback = STAFF_ROLES.includes(user.role) ? "/admin" : "/dashboard";
  return ok({ user: publicUser(user), redirectTo: safeNext(url.searchParams.get("next"), fallback) }, { message: "Welcome back" });
});
