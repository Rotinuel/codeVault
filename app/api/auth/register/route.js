import { ok, parseBody, withApi, Errors } from "@/lib/api";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { registerSchema, normalizePhone } from "@/lib/validation";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { notifyUser } from "@/lib/notifications";
import { messages } from "@/lib/messages";
import { getSettings } from "@/lib/settings";
import { publicUser } from "@/lib/serializers";
import { ROLES, USER_STATUS } from "@/lib/constants";

export const POST = withApi(async (request) => {
  await enforceRateLimit(request, "register", LIMITS.register);
  const body = await parseBody(request, registerSchema);
  await connectDB();

  const exists = await User.exists({ email: body.email });
  if (exists) throw Errors.conflict("An account with this email already exists");

  const phone = normalizePhone(body.phone, process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "234");
  // Role and status are always set server-side; any client-supplied values are ignored.
  const user = await User.create({
    name: body.name,
    email: body.email,
    phone,
    password: await hashPassword(body.password),
    role: ROLES.USER,
    status: USER_STATUS.ACTIVE,
    lastLoginAt: new Date(),
  });

  await createSession(user);
  const settings = await getSettings();
  await notifyUser(user.toObject(), messages.registration({ platformName: settings.platformName, name: user.name }));

  return ok({ user: publicUser(user), redirectTo: "/dashboard/subscription" }, { status: 201, message: "Account created" });
});
