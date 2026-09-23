import "server-only";
import AuditLog from "../models/AuditLog.js";
import { getRequestMeta } from "./request.js";

export const AUDIT_ACTIONS = Object.freeze({
  BETCODE_CREATED: "BETCODE_CREATED",
  BETCODE_BATCH_CREATED: "BETCODE_BATCH_CREATED",
  BETCODE_UPDATED: "BETCODE_UPDATED",
  BETCODE_PUBLISHED: "BETCODE_PUBLISHED",
  BETCODE_SCHEDULED: "BETCODE_SCHEDULED",
  BETCODE_UNPUBLISHED: "BETCODE_UNPUBLISHED",
  BETCODE_ARCHIVED: "BETCODE_ARCHIVED",
  BETCODE_RESTORED: "BETCODE_RESTORED",
  BETCODE_FEATURED: "BETCODE_FEATURED",
  BETCODE_RESULT_SET: "BETCODE_RESULT_SET",
  BETCODE_DELETED: "BETCODE_DELETED",
  CATEGORY_CREATED: "CATEGORY_CREATED",
  CATEGORY_UPDATED: "CATEGORY_UPDATED",
  CATEGORY_DELETED: "CATEGORY_DELETED",
  PLAN_CREATED: "PLAN_CREATED",
  PLAN_UPDATED: "PLAN_UPDATED",
  PLAN_PRICE_CHANGED: "PLAN_PRICE_CHANGED",
  PLAN_DELETED: "PLAN_DELETED",
  USER_UPDATED: "USER_UPDATED",
  USER_SUSPENDED: "USER_SUSPENDED",
  USER_BANNED: "USER_BANNED",
  USER_REACTIVATED: "USER_REACTIVATED",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  ADMIN_CREATED: "ADMIN_CREATED",
  ADMIN_REMOVED: "ADMIN_REMOVED",
  SUBSCRIPTION_GRANTED: "SUBSCRIPTION_GRANTED",
  SUBSCRIPTION_EXTENDED: "SUBSCRIPTION_EXTENDED",
  SUBSCRIPTION_CANCELLED: "SUBSCRIPTION_CANCELLED",
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
  PERMISSIONS_UPDATED: "PERMISSIONS_UPDATED",
  BROADCAST_SENT: "BROADCAST_SENT",
  WHATSAPP_TEST_SENT: "WHATSAPP_TEST_SENT",
  PAYMENT_MISMATCH: "PAYMENT_MISMATCH",
  LOGIN_FAILED_LOCK: "LOGIN_FAILED_LOCK",
});

/**
 * Record an administrative/security action. Never throws: an audit failure
 * must not break the primary operation, but it is logged loudly.
 */
export async function logAudit({ actor, action, targetType = null, targetId = null, metadata = {}, request = null }) {
  try {
    const meta = await getRequestMeta(request);
    await AuditLog.create({
      user: actor?._id ?? null,
      userEmail: actor?.email ?? null,
      userRole: actor?.role ?? null,
      action,
      targetType,
      targetId: targetId ? String(targetId) : null,
      metadata,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  } catch (error) {
    console.error("[audit] Failed to write audit log:", action, error?.message);
  }
}
