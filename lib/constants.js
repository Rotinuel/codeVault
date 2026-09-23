// Shared, client-safe constants. Never put secrets in this file.

export const ROLES = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  USER: "USER",
});
export const ROLE_VALUES = Object.values(ROLES);
export const STAFF_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

export const USER_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  BANNED: "BANNED",
});
export const USER_STATUS_VALUES = Object.values(USER_STATUS);

export const SUBSCRIPTION_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
  PENDING: "PENDING",
});
export const SUBSCRIPTION_STATUS_VALUES = Object.values(SUBSCRIPTION_STATUS);

export const SUBSCRIPTION_TYPE = Object.freeze({
  NEW: "NEW",
  RENEWAL: "RENEWAL",
  UPGRADE: "UPGRADE",
  SWITCH: "SWITCH",
  DOWNGRADE: "DOWNGRADE",
  MANUAL: "MANUAL",
});
export const SUBSCRIPTION_TYPE_VALUES = Object.values(SUBSCRIPTION_TYPE);

export const PAYMENT_STATUS = Object.freeze({
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  ABANDONED: "ABANDONED",
});
export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

export const BETCODE_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  PUBLISHED: "PUBLISHED",
  EXPIRED: "EXPIRED",
  ARCHIVED: "ARCHIVED",
});
export const BETCODE_STATUS_VALUES = Object.values(BETCODE_STATUS);

export const BET_RESULT = Object.freeze({
  PENDING: "PENDING",
  WON: "WON",
  LOST: "LOST",
  VOID: "VOID",
});
export const BET_RESULT_VALUES = Object.values(BET_RESULT);

export const NOTIFICATION_TYPES = Object.freeze({
  PAYMENT: "PAYMENT",
  SUBSCRIPTION: "SUBSCRIPTION",
  BET_CODE: "BET_CODE",
  SYSTEM: "SYSTEM",
  SECURITY: "SECURITY",
});
export const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPES);

// Events that can trigger a WhatsApp message. Used for per-event toggles and templates.
export const NOTIFICATION_EVENTS = Object.freeze({
  REGISTRATION: "REGISTRATION",
  SUBSCRIPTION_ACTIVATED: "SUBSCRIPTION_ACTIVATED",
  SUBSCRIPTION_EXPIRY_REMINDER: "SUBSCRIPTION_EXPIRY_REMINDER",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
  PAYMENT_SUCCESS: "PAYMENT_SUCCESS",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  BET_CODE_RELEASED: "BET_CODE_RELEASED",
  PASSWORD_RESET: "PASSWORD_RESET",
  BROADCAST: "BROADCAST",
});
export const NOTIFICATION_EVENT_VALUES = Object.values(NOTIFICATION_EVENTS);

export const NOTIFICATION_EVENT_LABELS = {
  REGISTRATION: "Registration welcome",
  SUBSCRIPTION_ACTIVATED: "Subscription activated",
  SUBSCRIPTION_EXPIRY_REMINDER: "Subscription expiry reminder",
  SUBSCRIPTION_EXPIRED: "Subscription expired",
  PAYMENT_SUCCESS: "Payment successful",
  PAYMENT_FAILED: "Payment failed",
  BET_CODE_RELEASED: "Bet code released",
  PASSWORD_RESET: "Password reset link",
  BROADCAST: "Admin broadcast",
};

export const MESSAGE_STATUS = Object.freeze({
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  SENT: "SENT",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
});
export const MESSAGE_STATUS_VALUES = Object.values(MESSAGE_STATUS);

export const SESSION_COOKIE = "cv_session";
export const FREE_ACCESS_LEVEL = 0;
export const MAX_ACCESS_LEVEL = 100;
export const DEFAULT_TIMEZONE = "Africa/Lagos";
export const DEFAULT_CURRENCY = "NGN";
export const SUPPORTED_CURRENCIES = ["NGN", "GHS", "ZAR", "KES", "USD"];
