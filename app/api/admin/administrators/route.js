import { ok, parseBody, withApi, Errors } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import User from "@/models/User";
import { createAdminSchema, normalizePhone } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { adminUser } from "@/lib/serializers";
import { ROLES, STAFF_ROLES, USER_STATUS } from "@/lib/constants";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

export const GET = withApi(async () => {
  await requirePermission(PERMISSIONS.ADMINS_MANAGE);
  const admins = await User.find({ role: { $in: STAFF_ROLES } }).sort({ role: -1, createdAt: 1 }).lean();
  return ok({ administrators: admins.map(adminUser) });
});

// Create a new staff account, or promote an existing client by email.
export const POST = withApi(async (request) => {
  const { user: actor } = await requirePermission(PERMISSIONS.ADMINS_MANAGE);
  const body = await parseBody(request, createAdminSchema);
  const existing = await User.findOne({ email: body.email }).lean();
  if (existing) {
    if (STAFF_ROLES.includes(existing.role)) throw Errors.conflict("This user is already an administrator");
    throw Errors.conflict("A client account uses this email. Promote it from the Users page instead.");
  }
  const user = await User.create({
    name: body.name,
    email: body.email,
    phone: body.phone ? normalizePhone(body.phone, process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "234") : null,
    password: await hashPassword(body.password),
    role: body.role,
    status: USER_STATUS.ACTIVE,
    createdBy: actor._id,
  });
  await logAudit({
    actor,
    action: AUDIT_ACTIONS.ADMIN_CREATED,
    targetType: "User",
    targetId: user._id,
    metadata: { email: user.email, role: user.role },
    request,
  });
  return ok({ administrator: adminUser(user) }, { status: 201, message: `${body.role === ROLES.SUPER_ADMIN ? "Super admin" : "Administrator"} created` });
});
