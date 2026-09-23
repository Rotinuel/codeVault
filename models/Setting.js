import mongoose from "mongoose";
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from "../lib/constants.js";
import { DEFAULT_ADMIN_PERMISSIONS } from "../lib/permissions.js";

const { Schema } = mongoose;

const TemplateSchema = new Schema(
  {
    name: { type: String, trim: true, default: "" },
    language: { type: String, trim: true, default: "en" },
  },
  { _id: false }
);

// Singleton document (key: "platform") holding admin-configurable settings.
const SettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "platform" },
    platformName: { type: String, trim: true, maxlength: 60, default: "CodeVault" },
    tagline: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "Premium bet codes, delivered on schedule.",
    },
    logoUrl: { type: String, trim: true, default: "" },
    supportEmail: { type: String, trim: true, default: "" },
    supportPhone: { type: String, trim: true, default: "" },
    currency: { type: String, default: DEFAULT_CURRENCY },
    timezone: { type: String, default: DEFAULT_TIMEZONE },
    defaultSubscriptionDurationDays: { type: Number, min: 1, max: 3650, default: 30 },
    whatsapp: {
      enabled: { type: Boolean, default: false },
      // Optional approved Meta templates per event. Empty name = send free-form text.
      templates: { type: Map, of: TemplateSchema, default: () => new Map() },
    },
    notifications: {
      registration: { type: Boolean, default: true },
      subscriptionActivated: { type: Boolean, default: true },
      paymentSuccess: { type: Boolean, default: true },
      paymentFailed: { type: Boolean, default: true },
      expiryReminder: { type: Boolean, default: true },
      subscriptionExpired: { type: Boolean, default: true },
      betCodeReleased: { type: Boolean, default: true },
      expiryReminderDays: { type: Number, min: 1, max: 30, default: 3 },
    },
    betCodes: {
      showLockedPreviews: { type: Boolean, default: true },
      notifyOnPublishDefault: { type: Boolean, default: true },
      defaultExpiryHours: { type: Number, min: 0, max: 24 * 60, default: 0 },
      upcomingWindowHours: { type: Number, min: 1, max: 24 * 30, default: 48 },
    },
    adminPermissions: { type: [String], default: () => [...DEFAULT_ADMIN_PERMISSIONS] },
    jobsLastRunAt: { type: Date, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Setting || mongoose.model("Setting", SettingSchema);
