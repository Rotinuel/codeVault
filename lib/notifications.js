// Notification service: in-app notifications + queued WhatsApp delivery.
// Every user-facing event goes through `notifyUser` / `notifyUsers`, which
// respect platform toggles, per-user preferences and phone availability.
import "server-only";
import { after } from "next/server";
import { connectDB } from "./mongodb.js";
import Notification from "../models/Notification.js";
import MessageOutbox from "../models/MessageOutbox.js";
import User from "../models/User.js";
import { getSettings } from "./settings.js";
import { getWhatsAppProvider } from "./whatsapp/index.js";
import { MESSAGE_STATUS, NOTIFICATION_EVENTS, USER_STATUS } from "./constants.js";
import { normalizePhone } from "./validation.js";

const EVENT_SETTING_KEY = {
  REGISTRATION: "registration",
  SUBSCRIPTION_ACTIVATED: "subscriptionActivated",
  PAYMENT_SUCCESS: "paymentSuccess",
  PAYMENT_FAILED: "paymentFailed",
  SUBSCRIPTION_EXPIRY_REMINDER: "expiryReminder",
  SUBSCRIPTION_EXPIRED: "subscriptionExpired",
  BET_CODE_RELEASED: "betCodeReleased",
};

const EVENT_PREF_KEY = {
  PAYMENT_SUCCESS: "payments",
  PAYMENT_FAILED: "payments",
  SUBSCRIPTION_ACTIVATED: "subscription",
  SUBSCRIPTION_EXPIRY_REMINDER: "subscription",
  SUBSCRIPTION_EXPIRED: "subscription",
  BET_CODE_RELEASED: "betCodes",
};

// Security messages are sent whenever a provider is configured, regardless of toggles.
const ALWAYS_SEND = new Set([NOTIFICATION_EVENTS.PASSWORD_RESET]);

function defaultCountryCode() {
  return process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "234";
}

/** Should a WhatsApp message for `event` go to `user`? */
export function shouldSendWhatsApp(event, user, settings) {
  if (!event || !user?.phone) return false;
  if (ALWAYS_SEND.has(event)) return true;
  if (!settings.whatsapp?.enabled) return false;
  if (user.status && user.status !== USER_STATUS.ACTIVE) return false;
  const settingKey = EVENT_SETTING_KEY[event];
  if (settingKey && settings.notifications?.[settingKey] === false) return false;
  const prefs = user.notificationPrefs || {};
  if (prefs.whatsapp === false) return false;
  const prefKey = EVENT_PREF_KEY[event];
  if (prefKey && prefs[prefKey] === false) return false;
  return true;
}

function outboxDoc(user, msg, priority = 0) {
  const to = normalizePhone(user.phone, defaultCountryCode());
  if (!to || to.length < 8) return null;
  return {
    user: user._id,
    to,
    event: msg.event,
    text: msg.whatsapp,
    templateParams: (msg.params || []).map(String),
    priority,
    metadata: msg.metadata || {},
  };
}

/** Drain the WhatsApp queue after the current response is sent (no-op outside a request). */
export function scheduleQueueDrain() {
  try {
    after(async () => {
      try {
        await processWhatsAppQueue({ limit: 40, timeBudgetMs: 8_000 });
      } catch (error) {
        console.error("[whatsapp] queue drain failed:", error?.message);
      }
    });
  } catch {
    // Called outside a request scope (scripts/cron runner) — the caller drains explicitly.
  }
}

/**
 * Notify one user in-app and (if allowed) via WhatsApp.
 * @param {object|string} userOrId - lean user doc or id
 * @param {object} msg - output of a builder in lib/messages.js (+ optional metadata)
 */
export async function notifyUser(userOrId, msg, { priority = 0, inApp = true } = {}) {
  try {
    await connectDB();
    const user =
      typeof userOrId === "object" && userOrId?._id && "phone" in userOrId
        ? userOrId
        : await User.findById(userOrId?._id ?? userOrId).select("name phone status notificationPrefs").lean();
    if (!user) return;

    if (inApp) {
      await Notification.create({
        user: user._id,
        title: msg.title,
        message: msg.message,
        type: msg.type,
        link: msg.link ?? null,
        metadata: { event: msg.event, ...(msg.metadata || {}) },
      });
    }

    if (msg.whatsapp) {
      const settings = await getSettings();
      if (shouldSendWhatsApp(msg.event, user, settings)) {
        const doc = outboxDoc(user, msg, priority);
        if (doc) {
          await MessageOutbox.create(doc);
          scheduleQueueDrain();
        }
      }
    }
  } catch (error) {
    // Notifications must never break the operation that triggered them.
    console.error("[notifications] notifyUser failed:", error?.message);
  }
}

/**
 * Bulk notify. `recipients` is an array of { _id, name, phone, status, notificationPrefs, priority }.
 * Returns counts of in-app notifications and queued WhatsApp messages.
 */
export async function notifyUsers(recipients, msgFor, { inApp = true, whatsapp = true } = {}) {
  await connectDB();
  const settings = await getSettings();
  let inAppCount = 0;
  let queued = 0;
  const CHUNK = 500;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const notifs = [];
    const outbox = [];
    for (const user of chunk) {
      const msg = typeof msgFor === "function" ? msgFor(user) : msgFor;
      if (inApp) {
        notifs.push({
          user: user._id,
          title: msg.title,
          message: msg.message,
          type: msg.type,
          link: msg.link ?? null,
          metadata: { event: msg.event, ...(msg.metadata || {}) },
        });
      }
      if (whatsapp && msg.whatsapp && shouldSendWhatsApp(msg.event, user, settings)) {
        const doc = outboxDoc(user, msg, user.priority ?? 0);
        if (doc) outbox.push(doc);
      }
    }
    if (notifs.length) {
      await Notification.insertMany(notifs, { ordered: false });
      inAppCount += notifs.length;
    }
    if (outbox.length) {
      await MessageOutbox.insertMany(outbox, { ordered: false });
      queued += outbox.length;
    }
  }
  if (queued) scheduleQueueDrain();
  return { inApp: inAppCount, whatsappQueued: queued };
}

/** Send queued WhatsApp messages in priority order within a time budget. */
export async function processWhatsAppQueue({ limit = 25, timeBudgetMs = 8_000 } = {}) {
  await connectDB();
  const started = Date.now();
  const provider = getWhatsAppProvider();
  const settings = await getSettings();
  const stats = { sent: 0, failed: 0, skipped: 0, retried: 0 };

  // Recover messages locked by a crashed worker.
  await MessageOutbox.updateMany(
    { status: MESSAGE_STATUS.PROCESSING, lockedAt: { $lt: new Date(Date.now() - 5 * 60_000) } },
    { $set: { status: MESSAGE_STATUS.QUEUED, lockedAt: null } }
  );

  for (let i = 0; i < limit; i++) {
    if (Date.now() - started > timeBudgetMs) break;
    const msg = await MessageOutbox.findOneAndUpdate(
      { status: MESSAGE_STATUS.QUEUED, sendAfter: { $lte: new Date() } },
      { $set: { status: MESSAGE_STATUS.PROCESSING, lockedAt: new Date() }, $inc: { attempts: 1 } },
      { sort: { priority: -1, createdAt: 1 }, returnDocument: "after" }
    );
    if (!msg) break;

    const alwaysSend = ALWAYS_SEND.has(msg.event);
    if ((!settings.whatsapp?.enabled && !alwaysSend) || !provider.isConfigured) {
      msg.status = MESSAGE_STATUS.SKIPPED;
      msg.lastError = provider.isConfigured ? "WhatsApp notifications are disabled" : "WhatsApp provider not configured";
      msg.lockedAt = null;
      await msg.save();
      stats.skipped++;
      continue;
    }

    const tpl = settings.whatsapp?.templates?.[msg.event];
    try {
      const result = await provider.send({
        to: msg.to,
        text: msg.text,
        template: tpl?.name ? { name: tpl.name, language: tpl.language, params: msg.templateParams } : null,
      });
      msg.status = MESSAGE_STATUS.SENT;
      msg.sentAt = new Date();
      msg.providerMessageId = result?.id ?? null;
      msg.lastError = null;
      stats.sent++;
    } catch (error) {
      const retryable = error?.retryable && msg.attempts < 5;
      msg.lastError = String(error?.message || "Send failed").slice(0, 500);
      if (retryable) {
        msg.status = MESSAGE_STATUS.QUEUED;
        msg.sendAfter = new Date(Date.now() + 2 ** msg.attempts * 60_000);
        stats.retried++;
      } else {
        msg.status = MESSAGE_STATUS.FAILED;
        stats.failed++;
      }
    }
    msg.lockedAt = null;
    await msg.save();
  }
  return stats;
}
