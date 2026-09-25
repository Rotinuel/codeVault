// Role-based access control definitions. Client-safe (no secrets) so the UI can
// hide navigation, but every API route re-checks permissions on the server.

import { ROLES } from "./constants.js";

export const PERMISSIONS = Object.freeze({
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  SUBSCRIPTIONS_VIEW: "subscriptions.view",
  SUBSCRIPTIONS_MANAGE: "subscriptions.manage",
  PAYMENTS_VIEW: "payments.view",
  BETCODES_VIEW: "betcodes.view",
  BETCODES_CREATE: "betcodes.create",
  BETCODES_EDIT: "betcodes.edit",
  BETCODES_PUBLISH: "betcodes.publish",
  BETCODES_DELETE: "betcodes.delete",
  CATEGORIES_MANAGE: "categories.manage",
  PLANS_MANAGE: "plans.manage",
  NOTIFICATIONS_SEND: "notifications.send",
  ANALYTICS_BASIC: "analytics.basic",
  ANALYTICS_FULL: "analytics.full",
  AUDIT_VIEW: "audit.view",
  SETTINGS_MANAGE: "settings.manage",
  ADMINS_MANAGE: "admins.manage",
  ROLES_MANAGE: "roles.manage",
  WINNING_TICKETS_REVIEW: "winningTickets.review",
});

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const PERMISSION_LABELS = {
  "users.view": "View users & subscribers",
  "users.manage": "Suspend / ban / edit users",
  "subscriptions.view": "View subscriptions",
  "subscriptions.manage": "Manually modify subscriptions",
  "payments.view": "View payments & transactions",
  "betcodes.view": "View bet codes (admin)",
  "betcodes.create": "Create bet codes",
  "betcodes.edit": "Edit bet codes & access levels",
  "betcodes.publish": "Publish / schedule / archive bet codes",
  "betcodes.delete": "Delete bet codes",
  "categories.manage": "Create / edit / delete categories",
  "plans.manage": "Manage subscription plans & prices",
  "notifications.send": "Send notifications & WhatsApp broadcasts",
  "analytics.basic": "View basic analytics",
  "analytics.full": "View full analytics & revenue",
  "audit.view": "View audit logs",
  "settings.manage": "Manage platform settings",
  "admins.manage": "Create / remove administrators",
  "roles.manage": "Manage roles & permissions",
  "winningTickets.review": "Approve winning tickets & set reward discounts",
};

// Default ADMIN permissions (used until a Super Admin customises them).
export const DEFAULT_ADMIN_PERMISSIONS = [
  PERMISSIONS.USERS_VIEW,
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.SUBSCRIPTIONS_VIEW,
  PERMISSIONS.PAYMENTS_VIEW,
  PERMISSIONS.BETCODES_VIEW,
  PERMISSIONS.BETCODES_CREATE,
  PERMISSIONS.BETCODES_EDIT,
  PERMISSIONS.BETCODES_PUBLISH,
  PERMISSIONS.BETCODES_DELETE,
  PERMISSIONS.NOTIFICATIONS_SEND,
  PERMISSIONS.ANALYTICS_BASIC,
];

// Permissions a Super Admin MAY grant to ADMINs. Anything not listed here is
// Super-Admin-only and can never be delegated.
export const ADMIN_GRANTABLE_PERMISSIONS = [
  ...DEFAULT_ADMIN_PERMISSIONS,
  PERMISSIONS.CATEGORIES_MANAGE,
  PERMISSIONS.ANALYTICS_FULL,
  PERMISSIONS.AUDIT_VIEW,
];

export const SUPER_ADMIN_ONLY_PERMISSIONS = ALL_PERMISSIONS.filter(
  (p) => !ADMIN_GRANTABLE_PERMISSIONS.includes(p)
);

/**
 * Resolve the effective permissions for a role.
 * @param {string} role
 * @param {string[]|undefined} adminPermissions - customised ADMIN permissions from settings
 */
export function getRolePermissions(role, adminPermissions) {
  if (role === ROLES.SUPER_ADMIN) return [...ALL_PERMISSIONS];
  if (role === ROLES.ADMIN) {
    const source = Array.isArray(adminPermissions) ? adminPermissions : DEFAULT_ADMIN_PERMISSIONS;
    // Never allow a stored list to escalate beyond the grantable set.
    return source.filter((p) => ADMIN_GRANTABLE_PERMISSIONS.includes(p));
  }
  return [];
}

export function roleHasPermission(role, permission, adminPermissions) {
  return getRolePermissions(role, adminPermissions).includes(permission);
}

const ROLE_RANK = { [ROLES.USER]: 0, [ROLES.ADMIN]: 1, [ROLES.SUPER_ADMIN]: 2 };

export function roleRank(role) {
  return ROLE_RANK[role] ?? -1;
}

/**
 * Whether `actor` may modify `target`. Admins may only manage regular users;
 * Super Admins may manage anyone except (for destructive operations) themselves.
 */
export function canManageUser(actor, target) {
  if (!actor || !target) return false;
  if (String(actor._id ?? actor.id) === String(target._id ?? target.id)) return false;
  if (actor.role === ROLES.SUPER_ADMIN) return true;
  if (actor.role === ROLES.ADMIN) return target.role === ROLES.USER;
  return false;
}
