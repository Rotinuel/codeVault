import "server-only";
import { connectDB } from "./mongodb.js";
import Setting from "../models/Setting.js";
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from "./constants.js";
import { DEFAULT_ADMIN_PERMISSIONS } from "./permissions.js";

const TTL_MS = 30_000;
const state = (globalThis.__cvSettings ??= { value: null, at: 0 });

export const DEFAULT_SETTINGS = Object.freeze({
  platformName: "CodeVault",
  tagline: "Premium bet codes, delivered on schedule.",
  logoUrl: "",
  supportEmail: "",
  supportPhone: "",
  currency: DEFAULT_CURRENCY,
  timezone: DEFAULT_TIMEZONE,
  defaultSubscriptionDurationDays: 30,
  whatsapp: { enabled: false, templates: {} },
  notifications: {
    registration: true,
    subscriptionActivated: true,
    paymentSuccess: true,
    paymentFailed: true,
    expiryReminder: true,
    subscriptionExpired: true,
    betCodeReleased: true,
    expiryReminderDays: 3,
  },
  betCodes: {
    showLockedPreviews: true,
    notifyOnPublishDefault: true,
    defaultExpiryHours: 0,
    upcomingWindowHours: 48,
  },
  ticketRewards: {
    enabled: true,
    showcaseEnabled: true,
    monthlyTarget: 5,
    percent: 10,
  },
  adminPermissions: [...DEFAULT_ADMIN_PERMISSIONS],
});

function toPlain(doc) {
  if (!doc) return { ...DEFAULT_SETTINGS };
  const templates = {};
  const rawTemplates = doc.whatsapp?.templates;
  if (rawTemplates) {
    const entries = rawTemplates instanceof Map ? rawTemplates.entries() : Object.entries(rawTemplates);
    for (const [k, v] of entries) templates[k] = { name: v?.name || "", language: v?.language || "en" };
  }
  return {
    platformName: doc.platformName ?? DEFAULT_SETTINGS.platformName,
    tagline: doc.tagline ?? DEFAULT_SETTINGS.tagline,
    logoUrl: doc.logoUrl ?? "",
    supportEmail: doc.supportEmail ?? "",
    supportPhone: doc.supportPhone ?? "",
    currency: doc.currency ?? DEFAULT_CURRENCY,
    timezone: doc.timezone ?? DEFAULT_TIMEZONE,
    defaultSubscriptionDurationDays: doc.defaultSubscriptionDurationDays ?? 30,
    whatsapp: { enabled: Boolean(doc.whatsapp?.enabled), templates },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(doc.notifications || {}) },
    betCodes: { ...DEFAULT_SETTINGS.betCodes, ...(doc.betCodes || {}) },
    ticketRewards: {
      enabled: doc.ticketRewards?.enabled ?? DEFAULT_SETTINGS.ticketRewards.enabled,
      showcaseEnabled: doc.ticketRewards?.showcaseEnabled ?? DEFAULT_SETTINGS.ticketRewards.showcaseEnabled,
      monthlyTarget: doc.ticketRewards?.monthlyTarget ?? DEFAULT_SETTINGS.ticketRewards.monthlyTarget,
      percent: doc.ticketRewards?.percent ?? DEFAULT_SETTINGS.ticketRewards.percent,
    },
    adminPermissions: Array.isArray(doc.adminPermissions) ? [...doc.adminPermissions] : [...DEFAULT_ADMIN_PERMISSIONS],
    updatedAt: doc.updatedAt ?? null,
  };
}

/** Platform settings with a short in-memory cache. Falls back to defaults if the DB is unreachable. */
export async function getSettings({ fresh = false } = {}) {
  if (!fresh && state.value && Date.now() - state.at < TTL_MS) return state.value;
  try {
    await connectDB();
    const doc = await Setting.findOne({ key: "platform" }).lean();
    state.value = toPlain(doc);
    state.at = Date.now();
    return state.value;
  } catch (error) {
    console.error("[settings] Falling back to defaults:", error?.message);
    return state.value ?? { ...DEFAULT_SETTINGS };
  }
}

export function invalidateSettings() {
  state.value = null;
  state.at = 0;
}

/** Deep-merge a validated patch into the settings document. */
export async function updateSettings(patch, actorId) {
  await connectDB();
  const $set = { updatedBy: actorId };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [sub, subValue] of Object.entries(value)) {
        if (subValue === undefined) continue;
        if (key === "whatsapp" && sub === "templates") {
          for (const [event, tpl] of Object.entries(subValue)) {
            $set[`whatsapp.templates.${event}`] = tpl;
          }
        } else {
          $set[`${key}.${sub}`] = subValue;
        }
      }
    } else {
      $set[key] = value;
    }
  }
  await Setting.findOneAndUpdate(
    { key: "platform" },
    { $set },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  invalidateSettings();
  return getSettings({ fresh: true });
}
