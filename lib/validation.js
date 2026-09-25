// Zod request schemas + sanitisation. Every API route validates input with these
// before touching the database, which also blocks NoSQL operator injection
// (objects like {"$gt": ""} never pass a string/number schema).
import { z } from "zod";
import {
  BET_RESULT_VALUES,
  BOOKMAKERS,
  MAX_ACCESS_LEVEL,
  NOTIFICATION_EVENT_VALUES,
  ROLES,
  SUPPORTED_CURRENCIES,
  USER_STATUS_VALUES,
} from "./constants.js";
import { ALL_PERMISSIONS } from "./permissions.js";
import { isValidTimeZone } from "./timezone.js";

// ── Sanitisers ────────────────────────────────────────────────
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function stripTags(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(CONTROL_CHARS, "")
    .trim();
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizePhone(value, defaultCountryCode = "234") {
  if (!value) return "";
  let digits = String(value).replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `${defaultCountryCode}${digits.slice(1)}`;
  return digits.replace(/\D/g, "");
}

const text = (max, min = 0) =>
  z
    .string()
    .max(max * 2, `Must be at most ${max} characters`)
    .transform(stripTags)
    .pipe(z.string().min(min, min ? `Must be at least ${min} characters` : undefined).max(max, `Must be at most ${max} characters`));

const optionalText = (max) => text(max).optional().default("");

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid identifier");
const nullableObjectId = z
  .union([objectId, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));
// For partial updates: undefined = "leave unchanged", "" / null = "clear".
const updatableObjectId = z
  .union([objectId, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(160)
  .pipe(z.email("Enter a valid email address"));

const phone = z
  .string()
  .trim()
  .max(24)
  .regex(/^\+?[\d\s\-()]{7,20}$/, "Enter a valid phone number");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/\d/, "Password must contain a number");

const bool = z.boolean();
const int = (min, max) => z.coerce.number().int().min(min).max(max);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm");
const timezone = z.string().refine(isValidTimeZone, "Invalid timezone");

// ── Auth ──────────────────────────────────────────────────────
export const registerSchema = z.object({
  name: text(80, 2),
  email,
  phone,
  password,
  acceptTerms: z.literal(true, { error: "You must accept the terms" }),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(128),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i, "Invalid or expired reset link"),
  password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(128),
  newPassword: password,
});

export const profileSchema = z.object({
  name: text(80, 2).optional(),
  phone: phone.optional(),
  notificationPrefs: z
    .object({
      whatsapp: bool.optional(),
      betCodes: bool.optional(),
      payments: bool.optional(),
      subscription: bool.optional(),
      marketing: bool.optional(),
    })
    .optional(),
});

// ── Plans & payments ─────────────────────────────────────────
// Base shapes carry no defaults so partial updates never overwrite unspecified fields
// (in Zod 4, defaults inside .optional() still apply).
const planShape = {
  name: text(60, 2),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,60}$/, "Slug may contain lowercase letters, numbers and dashes"),
  description: text(500),
  price: z.coerce.number().min(0, "Price cannot be negative").max(100_000_000),
  durationDays: int(1, 3650),
  accessLevel: int(1, MAX_ACCESS_LEVEL),
  features: z.array(text(160, 1)).max(30),
  historyDays: z.union([int(1, 3650), z.null()]),
  priorityNotifications: bool,
  isActive: bool,
  isFeatured: bool,
  badge: text(30),
  sortOrder: int(-1000, 1000),
};

export const planSchema = z.object({
  ...planShape,
  slug: planShape.slug.optional(),
  description: planShape.description.optional().default(""),
  features: planShape.features.optional().default([]),
  historyDays: planShape.historyDays.optional().default(null),
  priorityNotifications: bool.optional().default(false),
  isActive: bool.optional().default(true),
  isFeatured: bool.optional().default(false),
  badge: planShape.badge.optional().default(""),
  sortOrder: planShape.sortOrder.optional().default(0),
});
export const planUpdateSchema = z.object(planShape).partial();

export const planSelectSchema = z.object({ planId: objectId });

// ── Categories ───────────────────────────────────────────────
const categoryShape = {
  name: text(50, 2),
  description: text(300),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #10b981"),
  isActive: bool,
  showAsTab: bool,
  sortOrder: int(-1000, 1000),
};
export const categorySchema = z.object({
  name: categoryShape.name,
  description: categoryShape.description.optional().default(""),
  color: categoryShape.color.optional().default("#10b981"),
  isActive: bool.optional().default(true),
  showAsTab: bool.optional().default(true),
  sortOrder: categoryShape.sortOrder.optional().default(0),
});
export const categoryUpdateSchema = z.object(categoryShape).partial();

// ── Bet codes ────────────────────────────────────────────────
const codeValue = z
  .string()
  .trim()
  .min(2, "Code is required")
  .max(120)
  .regex(/^[A-Za-z0-9\-_ .:#/|,+]+$/, "Code contains unsupported characters");

const releaseFields = {
  releaseType: z.enum(["NOW", "SCHEDULE", "DRAFT"]),
  publishDate: dateStr.optional(),
  publishTime: timeStr.optional(),
  timezone: timezone.optional(),
  expiryType: z.enum(["NONE", "DATETIME", "HOURS"]).optional().default("NONE"),
  expiresDate: dateStr.optional(),
  expiresTime: timeStr.optional(),
  expiresInHours: z.coerce.number().min(0.25).max(24 * 60).optional(),
};

export const betCodeSchema = z
  .object({
    title: text(140, 2),
    code: codeValue,
    bookmaker: optionalText(60),
    description: optionalText(2000),
    analysis: optionalText(5000),
    totalOdds: z.union([z.coerce.number().min(1).max(1_000_000), z.null(), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
    category: nullableObjectId,
    accessLevel: int(0, MAX_ACCESS_LEVEL),
    isFeatured: bool.optional().default(false),
    notifyOnRelease: bool.optional().default(true),
    result: z.enum(BET_RESULT_VALUES).optional(),
    ...releaseFields,
  })
  .superRefine((v, ctx) => {
    if (v.releaseType === "SCHEDULE" && (!v.publishDate || !v.publishTime)) {
      ctx.addIssue({ code: "custom", path: ["publishDate"], message: "Choose a release date and time" });
    }
    if (v.expiryType === "DATETIME" && (!v.expiresDate || !v.expiresTime)) {
      ctx.addIssue({ code: "custom", path: ["expiresDate"], message: "Choose an expiry date and time" });
    }
    if (v.expiryType === "HOURS" && !v.expiresInHours) {
      ctx.addIssue({ code: "custom", path: ["expiresInHours"], message: "Enter the number of hours" });
    }
  });

export const betCodeUpdateSchema = z
  .object({
    title: text(140, 2).optional(),
    code: codeValue.optional(),
    bookmaker: text(60).optional(),
    description: text(2000).optional(),
    analysis: text(5000).optional(),
    totalOdds: z.union([z.coerce.number().min(1).max(1_000_000), z.null(), z.literal("")]).optional().transform((v) => (v === "" ? null : v)),
    category: updatableObjectId,
    accessLevel: int(0, MAX_ACCESS_LEVEL).optional(),
    isFeatured: bool.optional(),
    notifyOnRelease: bool.optional(),
    result: z.enum(BET_RESULT_VALUES).optional(),
    releaseType: z.enum(["NOW", "SCHEDULE", "DRAFT", "KEEP"]).optional().default("KEEP"),
    publishDate: dateStr.optional(),
    publishTime: timeStr.optional(),
    timezone: timezone.optional(),
    expiryType: z.enum(["NONE", "DATETIME", "HOURS", "KEEP"]).optional().default("KEEP"),
    expiresDate: dateStr.optional(),
    expiresTime: timeStr.optional(),
    expiresInHours: z.coerce.number().min(0.25).max(24 * 60).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.releaseType === "SCHEDULE" && (!v.publishDate || !v.publishTime)) {
      ctx.addIssue({ code: "custom", path: ["publishDate"], message: "Choose a release date and time" });
    }
    if (v.expiryType === "DATETIME" && (!v.expiresDate || !v.expiresTime)) {
      ctx.addIssue({ code: "custom", path: ["expiresDate"], message: "Choose an expiry date and time" });
    }
  });

export const betCodeActionSchema = z.object({
  action: z.enum(["publish", "unpublish", "archive", "restore", "feature", "unfeature", "setResult"]),
  result: z.enum(BET_RESULT_VALUES).optional(),
});

export const betCodeBatchSchema = z.object({
  date: dateStr,
  timezone,
  category: nullableObjectId,
  accessLevel: int(0, MAX_ACCESS_LEVEL),
  bookmaker: optionalText(60),
  expiresInHours: z.union([z.coerce.number().min(0.25).max(24 * 60), z.null()]).optional().default(null),
  notifyOnRelease: bool.optional().default(true),
  items: z
    .array(
      z.object({
        time: timeStr,
        title: text(140, 2),
        code: codeValue,
        totalOdds: z.union([z.coerce.number().min(1).max(1_000_000), z.null(), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
        description: optionalText(2000),
      })
    )
    .min(1, "Add at least one release")
    .max(24, "At most 24 releases per batch"),
});

// ── Admin: users, subscriptions, notifications ───────────────
export const adminUserUpdateSchema = z.object({
  name: text(80, 2).optional(),
  phone: phone.optional(),
  status: z.enum(USER_STATUS_VALUES).optional(),
  statusReason: optionalText(300),
  role: z.enum([ROLES.USER, ROLES.ADMIN, ROLES.SUPER_ADMIN]).optional(),
  emailVerified: z.literal(true).optional(),
});

export const manualSubscriptionSchema = z
  .object({
    action: z.enum(["GRANT", "EXTEND", "CANCEL"]),
    planId: objectId.optional(),
    days: int(1, 3650).optional(),
    notes: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.action === "GRANT" && !v.planId) ctx.addIssue({ code: "custom", path: ["planId"], message: "Choose a plan" });
    if (v.action === "EXTEND" && !v.days) ctx.addIssue({ code: "custom", path: ["days"], message: "Enter days" });
  });

export const createAdminSchema = z.object({
  name: text(80, 2),
  email,
  phone: phone.optional(),
  password,
  role: z.enum([ROLES.ADMIN, ROLES.SUPER_ADMIN]).default(ROLES.ADMIN),
});

export const broadcastSchema = z
  .object({
    title: text(160, 2),
    message: text(2000, 2),
    audience: z.enum(["ALL", "SUBSCRIBERS", "MIN_LEVEL", "PLAN", "EXPIRED", "UNSUBSCRIBED"]),
    minLevel: int(1, MAX_ACCESS_LEVEL).optional(),
    planId: objectId.optional(),
    inApp: bool.default(true),
    whatsapp: bool.default(false),
  })
  .superRefine((v, ctx) => {
    if (v.audience === "MIN_LEVEL" && !v.minLevel) ctx.addIssue({ code: "custom", path: ["minLevel"], message: "Choose a level" });
    if (v.audience === "PLAN" && !v.planId) ctx.addIssue({ code: "custom", path: ["planId"], message: "Choose a plan" });
    if (!v.inApp && !v.whatsapp) ctx.addIssue({ code: "custom", path: ["inApp"], message: "Choose at least one channel" });
  });

export const rolesUpdateSchema = z.object({
  adminPermissions: z.array(z.enum(ALL_PERMISSIONS)).max(ALL_PERMISSIONS.length),
});

const templateSchema = z.object({
  name: z.string().trim().max(120).regex(/^[a-z0-9_]*$/, "Template names use lowercase letters, numbers and _").default(""),
  language: z.string().trim().max(10).default("en"),
});

export const settingsSchema = z.object({
  platformName: text(60, 2).optional(),
  tagline: text(160).optional(),
  logoUrl: z.union([z.url({ protocol: /^https?$/ }), z.literal("")]).optional(),
  supportEmail: z.union([email, z.literal("")]).optional(),
  supportPhone: z.union([phone, z.literal("")]).optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  timezone: timezone.optional(),
  defaultSubscriptionDurationDays: int(1, 3650).optional(),
  whatsapp: z
    .object({
      enabled: bool.optional(),
      templates: z.partialRecord(z.enum(NOTIFICATION_EVENT_VALUES), templateSchema).optional(),
    })
    .optional(),
  notifications: z
    .object({
      registration: bool.optional(),
      subscriptionActivated: bool.optional(),
      paymentSuccess: bool.optional(),
      paymentFailed: bool.optional(),
      expiryReminder: bool.optional(),
      subscriptionExpired: bool.optional(),
      betCodeReleased: bool.optional(),
      expiryReminderDays: int(1, 30).optional(),
    })
    .optional(),
  betCodes: z
    .object({
      showLockedPreviews: bool.optional(),
      notifyOnPublishDefault: bool.optional(),
      defaultExpiryHours: int(0, 24 * 60).optional(),
      upcomingWindowHours: int(1, 24 * 30).optional(),
    })
    .optional(),
});

// ── Winning tickets ──────────────────────────────────────────
const money = z.coerce.number().min(0).max(1_000_000_000);
const MAX_IMAGE_BASE64 = Math.ceil((2 * 1024 * 1024 * 4) / 3) + 64; // ~2 MB image

export const ticketUploadSchema = z
  .object({
    bookmaker: z.enum(BOOKMAKERS),
    bookmakerOther: optionalText(40),
    ticketRef: z
      .string()
      .trim()
      .min(4, "Enter the ticket / booking ID printed on the slip")
      .max(60)
      .regex(/^[A-Za-z0-9\-_/ .#]+$/, "Use only letters, numbers and - _ / . #"),
    stake: money.refine((v) => v > 0, "Enter your stake"),
    payout: money.refine((v) => v > 0, "Enter the amount won"),
    wonAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date you won"),
    codeUsed: optionalText(60),
    note: optionalText(300),
    showcaseConsent: bool.optional().default(false),
    image: z
      .string()
      .max(MAX_IMAGE_BASE64, "Image is too large (max 2 MB)")
      .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Upload a JPG, PNG or WebP image"),
  })
  .superRefine((v, ctx) => {
    if (v.bookmaker === "Other" && v.bookmakerOther.length < 2) ctx.addIssue({ code: "custom", path: ["bookmakerOther"], message: "Enter the bookmaker" });
    if (v.payout <= v.stake) ctx.addIssue({ code: "custom", path: ["payout"], message: "Winnings should be more than the stake" });
    const d = new Date(`${v.wonAt}T12:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 36 * 3600_000) ctx.addIssue({ code: "custom", path: ["wonAt"], message: "Date can't be in the future" });
    if (d.getTime() < Date.now() - 366 * 24 * 3600_000) ctx.addIssue({ code: "custom", path: ["wonAt"], message: "Ticket is older than a year" });
  });

export const ticketReviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), showcase: bool.optional().default(false) }),
  z.object({ action: z.literal("reject"), reason: text(300, 3) }),
  z.object({ action: z.literal("showcase"), showcase: bool }),
]);

export const ticketRewardsSchema = z.object({
  enabled: bool,
  showcaseEnabled: bool,
  monthlyTarget: int(1, 100),
  percent: int(1, 90),
});

export const whatsappTestSchema = z.object({ phone, message: text(500, 1).optional() });

// ── List / query params ──────────────────────────────────────
export function listQuerySchema(sortable = [], extra = {}) {
  return z.object({
    page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    q: z.string().trim().max(100).optional().default(""),
    sort: z
      .string()
      .optional()
      .transform((v) => (v && sortable.includes(v) ? v : sortable[0] || "createdAt")),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
    ...extra,
  });
}
