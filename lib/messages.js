// Message builders for every notification event. Each returns the in-app
// title/message, the WhatsApp text, and ordered template params (used when an
// approved Meta template is configured for the event).
import { NOTIFICATION_EVENTS, NOTIFICATION_TYPES } from "./constants.js";
import { formatCurrency, formatDate } from "./utils.js";

function link(path) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path}`;
}

export const messages = {
  registration({ platformName, name }) {
    return {
      event: NOTIFICATION_EVENTS.REGISTRATION,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: `Welcome to ${platformName}`,
      message: `Hi ${name}, your account is ready. Choose a subscription plan to start receiving bet codes.`,
      whatsapp: `Welcome to ${platformName}, ${name}! 🎉\n\nYour account is ready. Choose a plan to start receiving bet codes:\n${link("/dashboard/subscription")}`,
      params: [name, platformName],
      link: "/dashboard/subscription",
    };
  },

  subscriptionActivated({ platformName, name, planName, endDate, type }) {
    const verb = type === "RENEWAL" ? "renewed" : type === "UPGRADE" ? "upgraded" : "activated";
    return {
      event: NOTIFICATION_EVENTS.SUBSCRIPTION_ACTIVATED,
      type: NOTIFICATION_TYPES.SUBSCRIPTION,
      title: `Subscription ${verb}`,
      message: `Your ${planName} subscription has been ${verb}. It is valid until ${formatDate(endDate)}.`,
      whatsapp: `Hi ${name}, your ${platformName} *${planName}* subscription has been ${verb}. ✅\n\nValid until: ${formatDate(endDate)}\n\nView your bet codes: ${link("/dashboard/betcodes")}`,
      params: [name, planName, formatDate(endDate)],
      link: "/dashboard/betcodes",
    };
  },

  paymentSuccess({ name, amount, currency, reference, planName }) {
    return {
      event: NOTIFICATION_EVENTS.PAYMENT_SUCCESS,
      type: NOTIFICATION_TYPES.PAYMENT,
      title: "Payment successful",
      message: `We received your payment of ${formatCurrency(amount, currency)} for ${planName}. Reference: ${reference}.`,
      whatsapp: `Hi ${name}, we received your payment of ${formatCurrency(amount, currency)} for *${planName}*.\n\nReference: ${reference}\n\nThank you!`,
      params: [name, formatCurrency(amount, currency), planName, reference],
      link: "/dashboard/payments",
    };
  },

  paymentFailed({ name, amount, currency, reference, planName, reason }) {
    return {
      event: NOTIFICATION_EVENTS.PAYMENT_FAILED,
      type: NOTIFICATION_TYPES.PAYMENT,
      title: "Payment not completed",
      message: `Your payment of ${formatCurrency(amount, currency)} for ${planName} was not completed${reason ? ` (${reason})` : ""}. Reference: ${reference}.`,
      whatsapp: `Hi ${name}, your payment of ${formatCurrency(amount, currency)} for *${planName}* was not completed.\n\nReference: ${reference}\n\nYou can try again here: ${link("/dashboard/subscription")}`,
      params: [name, formatCurrency(amount, currency), planName, reference],
      link: "/dashboard/subscription",
    };
  },

  expiryReminder({ name, planName, endDate, days }) {
    return {
      event: NOTIFICATION_EVENTS.SUBSCRIPTION_EXPIRY_REMINDER,
      type: NOTIFICATION_TYPES.SUBSCRIPTION,
      title: "Subscription expiring soon",
      message: `Your ${planName} subscription expires in ${days} day${days === 1 ? "" : "s"} (${formatDate(endDate)}). Renew to keep your access.`,
      whatsapp: `Hi ${name}, your *${planName}* subscription expires in ${days} day${days === 1 ? "" : "s"} (${formatDate(endDate)}).\n\nRenew now to keep receiving bet codes: ${link("/dashboard/subscription")}`,
      params: [name, planName, String(days), formatDate(endDate)],
      link: "/dashboard/subscription",
    };
  },

  subscriptionExpired({ name, planName }) {
    return {
      event: NOTIFICATION_EVENTS.SUBSCRIPTION_EXPIRED,
      type: NOTIFICATION_TYPES.SUBSCRIPTION,
      title: "Subscription expired",
      message: `Your ${planName} subscription has expired. Renew to regain access to your bet codes.`,
      whatsapp: `Hi ${name}, your *${planName}* subscription has expired.\n\nRenew to regain access: ${link("/dashboard/subscription")}`,
      params: [name, planName],
      link: "/dashboard/subscription",
    };
  },

  betCodeReleased({ levelName, title, betCodeId }) {
    return {
      event: NOTIFICATION_EVENTS.BET_CODE_RELEASED,
      type: NOTIFICATION_TYPES.BET_CODE,
      title: "New Bet Code Available",
      message: `A new ${levelName} bet code has been released: ${title}.`,
      whatsapp: `*New Bet Code Available*\n\nA new [${levelName}] bet code has been released.\n\nLogin to your account to view it:\n${link(`/dashboard/betcodes/${betCodeId}`)}`,
      params: [levelName],
      link: `/dashboard/betcodes/${betCodeId}`,
    };
  },

  passwordReset({ platformName, name, resetUrl }) {
    return {
      event: NOTIFICATION_EVENTS.PASSWORD_RESET,
      type: NOTIFICATION_TYPES.SECURITY,
      title: "Password reset requested",
      message: "A password reset was requested for your account. If this wasn't you, you can ignore it.",
      whatsapp: `Hi ${name}, use this link to reset your ${platformName} password (valid for 30 minutes):\n${resetUrl}\n\nIf you didn't request this, ignore this message.`,
      params: [name, resetUrl],
      link: null,
    };
  },

  passwordChanged({ name }) {
    return {
      event: null,
      type: NOTIFICATION_TYPES.SECURITY,
      title: "Password changed",
      message: `Hi ${name}, your password was changed. If this wasn't you, reset your password immediately and contact support.`,
      whatsapp: null,
      params: [],
      link: "/dashboard/profile",
    };
  },

  broadcast({ title, message }) {
    return {
      event: NOTIFICATION_EVENTS.BROADCAST,
      type: NOTIFICATION_TYPES.SYSTEM,
      title,
      message,
      whatsapp: `*${title}*\n\n${message}`,
      params: [title, message],
      link: null,
    };
  },
};
