import { Errors, getRouteId, ok, parseBody, withApi } from "@/lib/api";
import { requirePermission, getUserPermissions } from "@/lib/auth";
import { PERMISSIONS, canManageUser } from "@/lib/permissions";
import User from "@/models/User";
import Subscription from "@/models/Subscription";
import Payment from "@/models/Payment";
import { adminUser } from "@/lib/serializers";
import { adminUserUpdateSchema, normalizePhone } from "@/lib/validation";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { serializeSubscription } from "@/lib/services/subscriptions";
import { serializePayment } from "@/lib/services/payments";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

async function loadTarget(actor, id) {
  const target = await User.findById(id).lean();
  if (!target) throw Errors.notFound("User not found");
  // Admins can't see or act on staff accounts (IDOR guard).
  if (actor.role !== ROLES.SUPER_ADMIN && target.role !== ROLES.USER) throw Errors.notFound("User not found");
  return target;
}

export const GET = withApi(async (request, context) => {
  const { user: actor } = await requirePermission(PERMISSIONS.USERS_VIEW);
  const id = await getRouteId(context);
  const target = await loadTarget(actor, id);
  const perms = await getUserPermissions(actor);
  const [subscriptions, payments] = await Promise.all([
    Subscription.find({ user: id }).sort({ createdAt: -1 }).limit(20).lean(),
    perms.includes(PERMISSIONS.PAYMENTS_VIEW) ? Payment.find({ user: id }).sort({ createdAt: -1 }).limit(20).lean() : [],
  ]);
  return ok({
    user: adminUser(target),
    subscriptions: subscriptions.map(serializeSubscription),
    payments: payments.map(serializePayment),
    canManage: canManageUser(actor, target),
  });
});

export const PATCH = withApi(async (request, context) => {
  const { user: actor, permissions } = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const id = await getRouteId(context);
  const target = await loadTarget(actor, id);
  if (!canManageUser(actor, target)) throw Errors.forbidden("You can't modify this account");

  const body = await parseBody(request, adminUserUpdateSchema);
  const $set = {};
  const changes = {};
  let revokeSessions = false;

  if (body.name !== undefined && body.name !== target.name) {
    $set.name = body.name;
    changes.name = { from: target.name, to: body.name };
  }
  if (body.phone !== undefined) {
    const phone = normalizePhone(body.phone, process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "234");
    if (phone !== target.phone) {
      $set.phone = phone;
      changes.phone = { from: target.phone, to: phone };
    }
  }
  if (body.status && body.status !== target.status) {
    $set.status = body.status;
    $set.statusReason = body.status === USER_STATUS.ACTIVE ? null : body.statusReason || null;
    changes.status = { from: target.status, to: body.status };
    if (body.status !== USER_STATUS.ACTIVE) revokeSessions = true;
  }
  if (body.role && body.role !== target.role) {
    if (!permissions.includes(PERMISSIONS.ROLES_MANAGE)) throw Errors.forbidden("Only a Super Admin can change roles");
    if (target.role === ROLES.SUPER_ADMIN) {
      const supers = await User.countDocuments({ role: ROLES.SUPER_ADMIN, status: USER_STATUS.ACTIVE });
      if (supers <= 1) throw Errors.badRequest("At least one active Super Admin is required");
    }
    $set.role = body.role;
    changes.role = { from: target.role, to: body.role };
    revokeSessions = true;
  }
  if (body.emailVerified === true && target.emailVerified === false) {
    $set.emailVerified = true;
    $set.emailVerifiedAt = new Date();
    changes.emailVerified = { from: false, to: true, manual: true };
  }
  if (!Object.keys($set).length) return ok({ user: adminUser(target) }, { message: "No changes" });

  const update = { $set };
  if ($set.emailVerified) update.$unset = { emailVerification: 1 };
  if (revokeSessions) update.$inc = { tokenVersion: 1 };
  const updated = await User.findByIdAndUpdate(id, update, { returnDocument: "after", runValidators: true }).lean();

  let action = AUDIT_ACTIONS.USER_UPDATED;
  if (changes.role) action = AUDIT_ACTIONS.USER_ROLE_CHANGED;
  else if (changes.status?.to === USER_STATUS.SUSPENDED) action = AUDIT_ACTIONS.USER_SUSPENDED;
  else if (changes.status?.to === USER_STATUS.BANNED) action = AUDIT_ACTIONS.USER_BANNED;
  else if (changes.status?.to === USER_STATUS.ACTIVE) action = AUDIT_ACTIONS.USER_REACTIVATED;
  await logAudit({ actor, action, targetType: "User", targetId: id, metadata: { email: target.email, changes, reason: body.statusReason || undefined }, request });

  return ok({ user: adminUser(updated) }, { message: "User updated" });
});
