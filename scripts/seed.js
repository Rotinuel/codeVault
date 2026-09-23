#!/usr/bin/env bun
/**
 * Seed script — creates the initial Super Admin, default plans, categories,
 * platform settings and DEMONSTRATION bet codes.
 *
 *   bun run seed           # idempotent: safe to run multiple times
 *   bun run seed --reset   # also removes previously seeded demo bet codes first
 *
 * Bun loads .env / .env.local automatically. Required:
 *   MONGODB_URI, SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_PASSWORD
 * Plans and categories are only inserted if their slug doesn't exist yet, so
 * prices you later change in the admin panel are never overwritten.
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "../lib/mongodb.js";
import { BetCode, Category, Setting, SubscriptionPlan, User, models } from "../models/index.js";

const DEMO_BATCH = "SEED_DEMO";
const args = new Set(process.argv.slice(2));

const PLANS = [
  {
    name: "Basic",
    slug: "basic",
    description: "Get started with daily basic bet codes.",
    price: 5000,
    durationDays: 30,
    accessLevel: 1,
    historyDays: 7,
    features: ["Basic bet codes", "Limited daily releases", "Basic statistics", "7-day history", "WhatsApp alerts"],
    sortOrder: 1,
  },
  {
    name: "Standard",
    slug: "standard",
    description: "More codes and more detailed analysis.",
    price: 10000,
    durationDays: 30,
    accessLevel: 2,
    historyDays: 30,
    features: ["Everything in Basic", "Standard bet codes", "More detailed information", "Betting analysis", "30-day history"],
    sortOrder: 2,
  },
  {
    name: "Premium",
    slug: "premium",
    description: "High-value codes with advanced analysis.",
    price: 20000,
    durationDays: 30,
    accessLevel: 3,
    historyDays: null,
    priorityNotifications: true,
    isFeatured: true,
    badge: "Most popular",
    features: ["Everything in Standard", "Premium bet codes", "High-value information", "Advanced analysis", "Full history", "Priority notifications"],
    sortOrder: 3,
  },
  {
    name: "VIP",
    slug: "vip",
    description: "Every code we release, first.",
    price: 50000,
    durationDays: 30,
    accessLevel: 4,
    historyDays: null,
    priorityNotifications: true,
    features: ["Everything in Premium", "VIP-only bet codes", "Earliest release alerts", "Full history", "Priority support"],
    sortOrder: 4,
  },
];

const CATEGORIES = [
  ["Football", "#10b981"],
  ["Basketball", "#f97316"],
  ["Tennis", "#84cc16"],
  ["Virtual", "#8b5cf6"],
  ["Accumulator", "#0ea5e9"],
  ["Single", "#14b8a6"],
  ["Premium", "#f59e0b"],
  ["VIP", "#111827"],
  ["Other", "#64748b"],
];

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function log(icon, msg) {
  console.log(`${icon}  ${msg}`);
}

async function seedSettings() {
  const res = await Setting.updateOne({ key: "platform" }, { $setOnInsert: { key: "platform" } }, { upsert: true });
  log("⚙️ ", res.upsertedCount ? "Platform settings created" : "Platform settings already exist");
}

async function seedSuperAdmin() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const name = process.env.SEED_SUPER_ADMIN_NAME?.trim() || "Super Admin";
  const phone = process.env.SEED_SUPER_ADMIN_PHONE?.replace(/[^\d]/g, "") || null;

  if (!email || !password) {
    log("⚠️ ", "SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD not set — skipping super admin creation.");
    return (await User.findOne({ role: "SUPER_ADMIN" }).lean()) ?? null;
  }
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("SEED_SUPER_ADMIN_PASSWORD must be at least 12 characters and include letters and numbers.");
  }

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== "SUPER_ADMIN") {
      existing.role = "SUPER_ADMIN";
      existing.status = "ACTIVE";
      existing.tokenVersion = (existing.tokenVersion ?? 0) + 1;
      await existing.save();
      log("🛡️ ", `Promoted existing account ${email} to SUPER_ADMIN (password unchanged)`);
    } else {
      log("🛡️ ", `Super admin ${email} already exists (password unchanged)`);
    }
    return existing.toObject();
  }

  const user = await User.create({
    name,
    email,
    phone,
    password: await bcrypt.hash(password, 12),
    role: "SUPER_ADMIN",
    status: "ACTIVE",
  });
  log("🛡️ ", `Super admin created: ${email}`);
  return user.toObject();
}

async function seedPlans() {
  let created = 0;
  for (const p of PLANS) {
    const res = await SubscriptionPlan.updateOne(
      { slug: p.slug },
      { $setOnInsert: { currency: "NGN", isActive: true, priorityNotifications: false, isFeatured: false, badge: "", ...p } },
      { upsert: true }
    );
    if (res.upsertedCount) created++;
  }
  log("💳", `Plans: ${created} created, ${PLANS.length - created} already present (existing prices untouched)`);
}

async function seedCategories() {
  let created = 0;
  for (const [i, [name, color]] of CATEGORIES.entries()) {
    const res = await Category.updateOne(
      { slug: slugify(name) },
      { $setOnInsert: { name, slug: slugify(name), color, isActive: true, showAsTab: ["Football", "Basketball", "Tennis", "Premium", "VIP"].includes(name), sortOrder: i } },
      { upsert: true }
    );
    if (res.upsertedCount) created++;
  }
  log("🏷️ ", `Categories: ${created} created, ${CATEGORIES.length - created} already present`);
}

async function seedDemoBetCodes(admin) {
  if (!admin) {
    log("⚠️ ", "No super admin available — skipping demo bet codes.");
    return;
  }
  if (args.has("--reset")) {
    const del = await BetCode.deleteMany({ batchId: DEMO_BATCH });
    log("🧹", `Removed ${del.deletedCount} previous demo bet codes`);
  } else if (await BetCode.exists({ batchId: DEMO_BATCH })) {
    log("🎟️ ", "Demo bet codes already present (use --reset to recreate)");
    return;
  }

  const cat = Object.fromEntries((await Category.find({}).lean()).map((c) => [c.slug, c._id]));
  const H = 3_600_000;
  const now = Date.now();
  const at = (h) => new Date(now + h * H);
  const base = { createdBy: admin._id, updatedBy: admin._id, batchId: DEMO_BATCH, timezone: "Africa/Lagos", notifiedAt: new Date() };

  // All titles/codes are clearly marked as demonstration data.
  const codes = [
    { title: "[DEMO] Morning football double", code: "DEMO-BAS1-7K", bookmaker: "Demo Bookmaker", totalOdds: 3.2, category: cat.football, accessLevel: 1, status: "PUBLISHED", publishAt: at(-3), expiresAt: at(9), description: "Demonstration code for Basic subscribers." },
    { title: "[DEMO] Free sample single", code: "DEMO-FREE-01", bookmaker: "Demo Bookmaker", totalOdds: 1.85, category: cat.single, accessLevel: 0, status: "PUBLISHED", publishAt: at(-2), description: "A free demo code visible to every registered user." },
    { title: "[DEMO] Basketball evening pair", code: "DEMO-STD2-4Q", bookmaker: "Demo Bookmaker", totalOdds: 4.1, category: cat.basketball, accessLevel: 2, status: "PUBLISHED", publishAt: at(-1), expiresAt: at(12), description: "Demonstration code for Standard subscribers.", analysis: "Sample analysis text shown on the detail page." },
    { title: "[DEMO] Premium 5-fold accumulator", code: "DEMO-PRM3-9X", bookmaker: "Demo Bookmaker", totalOdds: 12.6, category: cat.accumulator, accessLevel: 3, status: "PUBLISHED", publishAt: at(-0.5), isFeatured: true, description: "Demonstration code for Premium subscribers.", analysis: "Premium-level sample analysis." },
    { title: "[DEMO] VIP high-odds special", code: "DEMO-VIP4-2Z", bookmaker: "Demo Bookmaker", totalOdds: 45, category: cat.vip, accessLevel: 4, status: "PUBLISHED", publishAt: at(-0.25), description: "Demonstration code for VIP subscribers only." },
    { title: "[DEMO] Afternoon tennis single", code: "DEMO-STD2-TN", bookmaker: "Demo Bookmaker", totalOdds: 2.05, category: cat.tennis, accessLevel: 2, status: "SCHEDULED", publishAt: at(2), notifiedAt: null, description: "Scheduled demo release (2 hours after seeding)." },
    { title: "[DEMO] Evening premium combo", code: "DEMO-PRM3-EV", bookmaker: "Demo Bookmaker", totalOdds: 8.4, category: cat.premium, accessLevel: 3, status: "SCHEDULED", publishAt: at(5), notifiedAt: null, description: "Scheduled demo release (5 hours after seeding)." },
    { title: "[DEMO] Yesterday's virtual pick", code: "DEMO-BAS1-VT", bookmaker: "Demo Bookmaker", totalOdds: 2.6, category: cat.virtual, accessLevel: 1, status: "EXPIRED", publishAt: at(-26), expiresAt: at(-20), result: "WON", description: "Expired demo code (appears in history)." },
    { title: "[DEMO] Draft — not visible to users", code: "DEMO-DRAFT-00", bookmaker: "Demo Bookmaker", category: cat.other, accessLevel: 1, status: "DRAFT", publishAt: null, description: "Draft demo code. Drafts are never sent to subscribers." },
  ];

  await BetCode.insertMany(codes.map((c) => ({ ...base, ...c, notifiedAt: c.notifiedAt === null ? null : base.notifiedAt })));
  log("🎟️ ", `Inserted ${codes.length} DEMO bet codes (titles start with “[DEMO]”)`);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set. Create .env.local from .env.example first.");
    process.exit(1);
  }
  await connectDB();
  log("🔌", `Connected to ${mongoose.connection.name}`);

  // Ensure indexes exist (non-destructive).
  for (const m of models) await m.createIndexes();

  await seedSettings();
  const admin = await seedSuperAdmin();
  await seedPlans();
  await seedCategories();
  await seedDemoBetCodes(admin);

  log("✅", "Seed complete.");
  if (process.env.SEED_SUPER_ADMIN_EMAIL) log("👉", `Sign in at ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login with ${process.env.SEED_SUPER_ADMIN_EMAIL}`);
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
