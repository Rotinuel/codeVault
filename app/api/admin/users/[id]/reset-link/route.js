import { Errors, getRouteId, ok, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS, canManageUser } from "@/lib/permissions";
import User from "@/models/User";
import { createResetToken } from "@/lib/password";
import { appUrl } from "@/lib/request";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

// Generates a one-time password reset link an admin can pass to a client
// (fallback when WhatsApp delivery isn't available). Valid for 30 minutes.
export const POST = withApi(async (request, context) => {
  const { user: actor } = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const id = await getRouteId(context);
  const target = await User.findById(id).select("email role").lean();
  if (!target) throw Errors.notFound("User not found");
  if (!canManageUser(actor, target)) throw Errors.forbidden("You can't manage this account");

  const { token, hash, expires } = createResetToken();
  await User.updateOne({ _id: id }, { $set: { resetPasswordTokenHash: hash, resetPasswordExpires: expires } });
  await logAudit({ actor, action: AUDIT_ACTIONS.USER_UPDATED, targetType: "User", targetId: id, metadata: { email: target.email, resetLinkIssued: true }, request });
  return ok({ url: appUrl(`/reset-password?token=${token}`), expiresAt: expires }, { message: "Reset link generated" });
});
