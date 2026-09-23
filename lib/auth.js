// Server-side authentication & authorization helpers.
//
// API routes use the throwing helpers (requireAuth, requireRole, requirePermission,
// requireSubscription, requireAccessLevel) inside `withApi`, which converts the
// thrown ApiError into a JSON response. Server Components use the *Page variants,
// which redirect instead of throwing.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "./mongodb.js";
import User from "../models/User.js";
import { readSession } from "./session.js";
import { Errors } from "./api.js";
import { ROLES, STAFF_ROLES, USER_STATUS } from "./constants.js";
import { canAccessLevel } from "./access.js";
import { getRolePermissions } from "./permissions.js";
import { getSettings } from "./settings.js";
import { getAccessContext } from "./services/subscriptions.js";

const SEEN_THROTTLE_MS = 10 * 60 * 1000;

/**
 * Resolve the session cookie to a live user record.
 * Returns { user, reason } where reason ∈ null | "NO_SESSION" | "INVALID" | "SUSPENDED" | "BANNED".
 * The DB lookup (not the JWT) is the source of truth for role and status, and
 * tokenVersion lets us revoke every outstanding token instantly.
 */
export const getAuthState = cache(async () => {
  const session = await readSession();
  if (!session) return { user: null, reason: "NO_SESSION" };
  if (!mongoose.isValidObjectId(session.sub)) return { user: null, reason: "INVALID" };

  await connectDB();
  const user = await User.findById(session.sub).select("+tokenVersion").lean();
  if (!user) return { user: null, reason: "INVALID" };
  if ((user.tokenVersion ?? 0) !== (session.tv ?? 0)) return { user: null, reason: "INVALID" };
  if (user.status === USER_STATUS.BANNED) return { user: null, reason: "BANNED" };
  if (user.status === USER_STATUS.SUSPENDED) return { user: null, reason: "SUSPENDED" };

  if (!user.lastSeenAt || Date.now() - new Date(user.lastSeenAt).getTime() > SEEN_THROTTLE_MS) {
    User.updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
  }

  delete user.tokenVersion;
  return { user, reason: null };
});

export async function getCurrentUser() {
  const { user } = await getAuthState();
  return user;
}

export function isStaff(user) {
  return Boolean(user && STAFF_ROLES.includes(user.role));
}

export async function getUserPermissions(user) {
  if (!user) return [];
  if (user.role === ROLES.USER) return [];
  const settings = await getSettings();
  return getRolePermissions(user.role, settings.adminPermissions);
}

export async function hasPermission(user, permission) {
  const perms = await getUserPermissions(user);
  return perms.includes(permission);
}

// ── API helpers (throw) ──────────────────────────────────────

export async function requireAuth() {
  const { user, reason } = await getAuthState();
  if (!user) {
    if (reason === "SUSPENDED") throw Errors.forbidden("Your account is suspended. Contact support.");
    if (reason === "BANNED") throw Errors.forbidden("Your account has been banned.");
    throw Errors.unauthorized(reason === "INVALID" ? "Your session is no longer valid. Please log in again." : undefined);
  }
  return user;
}

export async function requireRole(...roles) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) throw Errors.forbidden();
  return user;
}

export async function requireStaff() {
  return requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN);
}

export async function requirePermission(...permissions) {
  const user = await requireStaff();
  const perms = await getUserPermissions(user);
  const allowed = permissions.every((p) => perms.includes(p));
  if (!allowed) throw Errors.forbidden();
  return { user, permissions: perms };
}

/** Requires an ACTIVE, non-expired subscription (staff bypass). Returns the access context. */
export async function requireSubscription(user) {
  const u = user ?? (await requireAuth());
  const ctx = await getAccessContext(u);
  if (!ctx.isStaff && !ctx.subscription) {
    throw Errors.subscriptionRequired("An active subscription is required to access this content.");
  }
  return ctx;
}

/** Requires the user's effective access level to be >= `requiredLevel`. */
export async function requireAccessLevel(requiredLevel, user) {
  const u = user ?? (await requireAuth());
  const ctx = await getAccessContext(u);
  if (!canAccessLevel(ctx.level, requiredLevel)) {
    if (!ctx.subscription && requiredLevel > 0) {
      throw Errors.subscriptionRequired("An active subscription is required to access this content.");
    }
    throw Errors.forbidden("Upgrade your subscription to access this content.");
  }
  return ctx;
}

// ── Page helpers (redirect) ──────────────────────────────────

export async function requireUserPage() {
  const { user, reason } = await getAuthState();
  if (!user) {
    // A cookie exists but is unusable (revoked, user blocked): clear it via a route
    // handler first, otherwise proxy.js would bounce between /login and /dashboard.
    if (reason !== "NO_SESSION") redirect(`/api/auth/session-reset?reason=${reason.toLowerCase()}`);
    redirect("/login");
  }
  return user;
}

export async function requireStaffPage(permission) {
  const user = await requireUserPage();
  if (!isStaff(user)) redirect("/dashboard");
  const permissions = await getUserPermissions(user);
  if (permission && !permissions.includes(permission)) redirect("/admin?denied=1");
  return { user, permissions };
}

export async function requireSuperAdminPage() {
  const user = await requireUserPage();
  if (user.role !== ROLES.SUPER_ADMIN) redirect("/admin?denied=1");
  return user;
}
