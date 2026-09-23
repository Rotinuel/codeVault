import { ok, parseBody, withApi, Errors } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import {
  ADMIN_GRANTABLE_PERMISSIONS,
  ALL_PERMISSIONS,
  DEFAULT_ADMIN_PERMISSIONS,
  PERMISSION_LABELS,
  PERMISSIONS,
  SUPER_ADMIN_ONLY_PERMISSIONS,
} from "@/lib/permissions";
import { rolesUpdateSchema } from "@/lib/validation";
import { getSettings, updateSettings } from "@/lib/settings";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

export const GET = withApi(async () => {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const settings = await getSettings({ fresh: true });
  return ok({
    permissions: ALL_PERMISSIONS.map((p) => ({
      key: p,
      label: PERMISSION_LABELS[p],
      grantable: ADMIN_GRANTABLE_PERMISSIONS.includes(p),
      superAdminOnly: SUPER_ADMIN_ONLY_PERMISSIONS.includes(p),
    })),
    adminPermissions: settings.adminPermissions,
    defaults: DEFAULT_ADMIN_PERMISSIONS,
  });
});

export const PATCH = withApi(async (request) => {
  const { user: actor } = await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const { adminPermissions } = await parseBody(request, rolesUpdateSchema);
  const invalid = adminPermissions.filter((p) => !ADMIN_GRANTABLE_PERMISSIONS.includes(p));
  if (invalid.length) throw Errors.badRequest(`These permissions are Super-Admin-only: ${invalid.join(", ")}`);
  const before = (await getSettings({ fresh: true })).adminPermissions;
  const unique = [...new Set(adminPermissions)];
  await updateSettings({ adminPermissions: unique }, actor._id);
  await logAudit({ actor, action: AUDIT_ACTIONS.PERMISSIONS_UPDATED, targetType: "Settings", targetId: "roles", metadata: { from: before, to: unique }, request });
  return ok({ adminPermissions: unique }, { message: "Admin permissions updated" });
});
