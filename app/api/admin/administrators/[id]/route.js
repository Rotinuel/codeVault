import { z } from "zod";
import { Errors, getRouteId, ok, parseBody, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import User from "@/models/User";
import { adminUser } from "@/lib/serializers";
import { ROLES, STAFF_ROLES, USER_STATUS } from "@/lib/constants";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

const schema = z.object({ role: z.enum([ROLES.ADMIN, ROLES.SUPER_ADMIN]) });

async function loadStaff(actor, id) {
  if (String(actor._id) === id) throw Errors.badRequest("You can't change your own administrator role");
  const target = await User.findById(id).lean();
  if (!target || !STAFF_ROLES.includes(target.role)) throw Errors.notFound("Administrator not found");
  return target;
}

async function assertNotLastSuperAdmin(target) {
  if (target.role !== ROLES.SUPER_ADMIN) return;
  const count = await User.countDocuments({ role: ROLES.SUPER_ADMIN, status: USER_STATUS.ACTIVE });
  if (count <= 1) throw Errors.badRequest("At least one active Super Admin is required");
}

export const PATCH = withApi(async (request, context) => {
  const { user: actor } = await requirePermission(PERMISSIONS.ADMINS_MANAGE, PERMISSIONS.ROLES_MANAGE);
  const id = await getRouteId(context);
  const target = await loadStaff(actor, id);
  const { role } = await parseBody(request, schema);
  if (role === target.role) return ok({ administrator: adminUser(target) });
  if (role === ROLES.ADMIN) await assertNotLastSuperAdmin(target);
  const updated = await User.findByIdAndUpdate(id, { $set: { role }, $inc: { tokenVersion: 1 } }, { returnDocument: "after" }).lean();
  await logAudit({ actor, action: AUDIT_ACTIONS.USER_ROLE_CHANGED, targetType: "User", targetId: id, metadata: { email: target.email, from: target.role, to: role }, request });
  return ok({ administrator: adminUser(updated) }, { message: "Role updated" });
});

// "Remove administrator" demotes the account to a regular client (history is preserved).
export const DELETE = withApi(async (request, context) => {
  const { user: actor } = await requirePermission(PERMISSIONS.ADMINS_MANAGE);
  const id = await getRouteId(context);
  const target = await loadStaff(actor, id);
  await assertNotLastSuperAdmin(target);
  await User.updateOne({ _id: id }, { $set: { role: ROLES.USER }, $inc: { tokenVersion: 1 } });
  await logAudit({ actor, action: AUDIT_ACTIONS.ADMIN_REMOVED, targetType: "User", targetId: id, metadata: { email: target.email, previousRole: target.role }, request });
  return ok({ id }, { message: "Administrator access removed" });
});
