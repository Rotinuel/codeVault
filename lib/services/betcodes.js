// Bet code service. ALL user-facing access control for bet codes lives here:
// queries are filtered by the caller's access level in MongoDB itself, and the
// serializer strips protected fields from anything the caller may not see.
import "server-only";
import mongoose from "mongoose";
import { after } from "next/server";
import { connectDB } from "../mongodb.js";
import BetCode from "../../models/BetCode.js";
import Category from "../../models/Category.js";
import Favorite from "../../models/Favorite.js";
import BetCodeView from "../../models/BetCodeView.js";
import Subscription from "../../models/Subscription.js";
import SubscriptionPlan from "../../models/SubscriptionPlan.js";
import User from "../../models/User.js";
import { BETCODE_STATUS, FREE_ACCESS_LEVEL, ROLES, SUBSCRIPTION_STATUS, USER_STATUS } from "../constants.js";
import { canAccessLevel } from "../access.js";
import { ApiError } from "../api.js";
import { getSettings } from "../settings.js";
import { dayBoundsInZone, zonedTimeToUtc } from "../timezone.js";
import { escapeRegex } from "../validation.js";
import { getAccessContext, getLevelNames, levelName } from "./subscriptions.js";
import { notifyUsers } from "../notifications.js";
import { messages } from "../messages.js";

const RELEASED_STATUSES = [BETCODE_STATUS.PUBLISHED, BETCODE_STATUS.SCHEDULED, BETCODE_STATUS.EXPIRED];
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

// ── Availability rules (server-side source of truth) ──────────

/** A code is released when its status allows it and its publish time has passed. */
export function releasedFilter(now = new Date()) {
  return { status: { $in: RELEASED_STATUSES }, publishAt: { $ne: null, $lte: now } };
}

export function liveFilter(now = new Date()) {
  return {
    status: { $in: [BETCODE_STATUS.PUBLISHED, BETCODE_STATUS.SCHEDULED] },
    publishAt: { $ne: null, $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };
}

export function isReleased(code, now = new Date()) {
  return RELEASED_STATUSES.includes(code.status) && code.publishAt && new Date(code.publishAt) <= now;
}

export function isExpired(code, now = new Date()) {
  return code.status === BETCODE_STATUS.EXPIRED || (code.expiresAt && new Date(code.expiresAt) <= now);
}

/** Effective status as users and admins should see it right now. */
export function effectiveStatus(code, now = new Date()) {
  if (code.status === BETCODE_STATUS.DRAFT || code.status === BETCODE_STATUS.ARCHIVED) return code.status;
  if (code.publishAt && new Date(code.publishAt) > now) return BETCODE_STATUS.SCHEDULED;
  if (isExpired(code, now)) return BETCODE_STATUS.EXPIRED;
  return BETCODE_STATUS.PUBLISHED;
}

function historyFloor(historyDays, now) {
  return historyDays ? new Date(now.getTime() - historyDays * DAY_MS) : null;
}

// ── Serialisation ─────────────────────────────────────────────

function serializeCategory(cat) {
  // Only populated categories carry a name; a bare ObjectId is not serialised.
  if (!cat || !cat._id || !cat.name) return null;
  return { id: String(cat._id), name: cat.name, slug: cat.slug, color: cat.color };
}

/**
 * Serialise a bet code for a regular user. When `locked` is true the protected
 * fields (code, description, analysis, odds, bookmaker) are simply never added.
 */
export function serializeForUser(doc, { locked, levelNames, favorite = false, viewed = false, upcoming = false, reason = null, now = new Date() }) {
  const base = {
    id: String(doc._id),
    title: doc.title,
    category: serializeCategory(doc.category),
    accessLevel: doc.accessLevel,
    accessLevelName: levelName(levelNames, doc.accessLevel),
    publishAt: doc.publishAt,
    expiresAt: doc.expiresAt,
    status: effectiveStatus(doc, now),
    isFeatured: Boolean(doc.isFeatured),
    locked: Boolean(locked || upcoming),
    upcoming: Boolean(upcoming),
  };
  if (locked || upcoming) {
    return { ...base, lockReason: upcoming ? "UPCOMING" : reason || "UPGRADE_REQUIRED" };
  }
  return {
    ...base,
    code: doc.code,
    bookmaker: doc.bookmaker || "",
    description: doc.description || "",
    analysis: doc.analysis || "",
    totalOdds: doc.totalOdds ?? null,
    result: doc.result,
    favorite,
    viewed,
  };
}

export function serializeForAdmin(doc, { levelNames, now = new Date() } = {}) {
  return {
    id: String(doc._id),
    title: doc.title,
    code: doc.code,
    bookmaker: doc.bookmaker || "",
    description: doc.description || "",
    analysis: doc.analysis || "",
    totalOdds: doc.totalOdds ?? null,
    category: serializeCategory(doc.category),
    accessLevel: doc.accessLevel,
    accessLevelName: levelName(levelNames, doc.accessLevel),
    status: doc.status,
    effectiveStatus: effectiveStatus(doc, now),
    publishAt: doc.publishAt,
    expiresAt: doc.expiresAt,
    timezone: doc.timezone,
    isFeatured: Boolean(doc.isFeatured),
    result: doc.result,
    notifyOnRelease: doc.notifyOnRelease,
    notifiedAt: doc.notifiedAt,
    viewCount: doc.viewCount || 0,
    createdBy: doc.createdBy?.name ? { id: String(doc.createdBy._id), name: doc.createdBy.name } : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ── User-facing queries ──────────────────────────────────────

async function resolveCategoryId(category) {
  if (!category) return null;
  if (mongoose.isValidObjectId(category)) return new mongoose.Types.ObjectId(String(category));
  const cat = await Category.findOne({ slug: String(category).toLowerCase() }).select("_id").lean();
  return cat?._id ?? "__none__";
}

/**
 * List bet codes the user is authorised to see.
 * @param {object} user
 * @param {{tab?: string, category?: string, q?: string, page?: number, limit?: number}} opts
 */
export async function listBetCodesForUser(user, { tab = "all", category = null, q = "", page = 1, limit = 12 } = {}) {
  await connectDB();
  const now = new Date();
  const [ctx, settings, levelNames] = await Promise.all([getAccessContext(user), getSettings(), getLevelNames()]);
  const level = ctx.level;
  const floor = historyFloor(ctx.historyDays, now);
  const categoryId = await resolveCategoryId(category);
  if (categoryId === "__none__") return emptyList(page, limit);

  const and = [{ accessLevel: { $lte: level } }];
  if (categoryId) and.push({ category: categoryId });
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    and.push({ $or: [{ title: rx }, { description: rx }, { bookmaker: rx }] });
  }

  // Upcoming releases: authorised levels only, and never with the code attached.
  if (tab === "upcoming") {
    const windowEnd = new Date(now.getTime() + (settings.betCodes.upcomingWindowHours || 48) * HOUR_MS);
    const filter = { $and: [...and, { status: BETCODE_STATUS.SCHEDULED, publishAt: { $gt: now, $lte: windowEnd } }] };
    const [docs, total] = await Promise.all([
      BetCode.find(filter)
        .select("title category accessLevel publishAt expiresAt status isFeatured")
        .populate("category", "name slug color")
        .sort({ publishAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BetCode.countDocuments(filter),
    ]);
    return {
      items: docs.map((d) => serializeForUser(d, { upcoming: true, levelNames, now })),
      locked: [],
      meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      level,
    };
  }

  if (tab === "favorites") {
    const favIds = await Favorite.find({ user: user._id }).distinct("betCode");
    and.push({ _id: { $in: favIds } });
  }
  if (tab === "featured") and.push({ isFeatured: true });

  const released = releasedFilter(now);
  const timeClauses = [released];
  if (floor) timeClauses.push({ publishAt: { $gte: floor } });
  if (tab === "today") {
    const { start, end } = dayBoundsInZone(settings.timezone, now);
    timeClauses.push({ publishAt: { $gte: start, $lt: end } });
  }
  if (tab === "live") timeClauses.push({ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }, { status: { $ne: BETCODE_STATUS.EXPIRED } });
  if (tab === "history") timeClauses.push({ $or: [{ status: BETCODE_STATUS.EXPIRED }, { expiresAt: { $ne: null, $lte: now } }] });

  const filter = { $and: [...and, ...timeClauses] };
  const [docs, total] = await Promise.all([
    BetCode.find(filter)
      .populate("category", "name slug color")
      .sort({ isFeatured: -1, publishAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    BetCode.countDocuments(filter),
  ]);

  const ids = docs.map((d) => d._id);
  const [favs, views] = await Promise.all([
    Favorite.find({ user: user._id, betCode: { $in: ids } }).distinct("betCode"),
    BetCodeView.find({ user: user._id, betCode: { $in: ids } }).distinct("betCode"),
  ]);
  const favSet = new Set(favs.map(String));
  const viewSet = new Set(views.map(String));

  const items = docs.map((d) =>
    serializeForUser(d, { locked: false, levelNames, favorite: favSet.has(String(d._id)), viewed: viewSet.has(String(d._id)), now })
  );

  // Teasers for higher tiers: metadata only, protected fields are never selected from the DB.
  let locked = [];
  if (settings.betCodes.showLockedPreviews && page === 1 && !["favorites", "history"].includes(tab) && !ctx.isStaff) {
    const lockedFilter = {
      $and: [
        { accessLevel: { $gt: level } },
        liveFilter(now),
        ...(categoryId ? [{ category: categoryId }] : []),
        ...(tab === "today" ? [timeClauses[timeClauses.length - 1]] : []),
      ],
    };
    const lockedDocs = await BetCode.find(lockedFilter)
      .select("title category accessLevel publishAt expiresAt status isFeatured")
      .populate("category", "name slug color")
      .sort({ publishAt: -1 })
      .limit(6)
      .lean();
    locked = lockedDocs.map((d) => serializeForUser(d, { locked: true, levelNames, now }));
  }

  return { items, locked, meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }, level };
}

function emptyList(page, limit) {
  return { items: [], locked: [], meta: { page, limit, total: 0, pages: 1 }, level: 0 };
}

/**
 * Fetch one code for a user. Unreleased codes (draft/scheduled/archived) are
 * reported as not found; unauthorised codes come back locked without the code.
 */
export async function getBetCodeForUser(user, id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Bet code not found");
  await connectDB();
  const now = new Date();
  const [ctx, levelNames] = await Promise.all([getAccessContext(user), getLevelNames()]);
  const doc = await BetCode.findOne({ _id: id, ...releasedFilter(now) })
    .populate("category", "name slug color")
    .lean();
  if (!doc) throw new ApiError(404, "Bet code not found");

  if (!canAccessLevel(ctx.level, doc.accessLevel)) {
    return { betCode: serializeForUser(doc, { locked: true, levelNames, now }), authorized: false };
  }
  const floor = historyFloor(ctx.historyDays, now);
  if (floor && doc.publishAt < floor) {
    return {
      betCode: serializeForUser(doc, { locked: true, levelNames, reason: "HISTORY_LIMIT", now }),
      authorized: false,
    };
  }
  const [fav, viewed] = await Promise.all([
    Favorite.exists({ user: user._id, betCode: doc._id }),
    BetCodeView.exists({ user: user._id, betCode: doc._id }),
  ]);
  return {
    betCode: serializeForUser(doc, { locked: false, levelNames, favorite: Boolean(fav), viewed: Boolean(viewed), now }),
    authorized: true,
  };
}

/** Throws unless the user may see this code's protected content. */
async function assertAuthorized(user, id) {
  const { authorized, betCode } = await getBetCodeForUser(user, id);
  if (!authorized) {
    throw new ApiError(403, betCode.lockReason === "HISTORY_LIMIT" ? "This code is outside your plan's history window" : "Upgrade your subscription to access this bet code", {
      code: "UPGRADE_REQUIRED",
    });
  }
  return betCode;
}

export async function recordView(user, id) {
  await assertAuthorized(user, id);
  if (user.role !== ROLES.USER) return { recorded: false };
  try {
    await BetCodeView.create({ user: user._id, betCode: id });
    await BetCode.updateOne({ _id: id }, { $inc: { viewCount: 1 } });
    return { recorded: true };
  } catch (error) {
    if (error?.code === 11000) return { recorded: false };
    throw error;
  }
}

export async function setFavorite(user, id, favorite) {
  await assertAuthorized(user, id);
  if (favorite) {
    await Favorite.updateOne({ user: user._id, betCode: id }, { $setOnInsert: { user: user._id, betCode: id } }, { upsert: true });
  } else {
    await Favorite.deleteOne({ user: user._id, betCode: id });
  }
  return { favorite };
}

/** Numbers for the user dashboard overview cards. */
export async function getUserBetCodeStats(user) {
  await connectDB();
  const now = new Date();
  const [ctx, settings] = await Promise.all([getAccessContext(user), getSettings()]);
  const { start, end } = dayBoundsInZone(settings.timezone, now);
  const base = { accessLevel: { $lte: ctx.level } };
  const [available, today, viewed, favorites] = await Promise.all([
    BetCode.countDocuments({ ...base, ...liveFilter(now) }),
    BetCode.countDocuments({ ...base, ...releasedFilter(now), publishAt: { $gte: start, $lt: end, $lte: now } }),
    BetCodeView.countDocuments({ user: user._id }),
    Favorite.countDocuments({ user: user._id }),
  ]);
  return { available, today, viewed, favorites, level: ctx.level };
}

// ── Admin: create / update / lifecycle ───────────────────────

/** Populated, admin-serialised bet code (used after every admin mutation). */
export async function getAdminBetCode(id) {
  await connectDB();
  const [doc, levelNames] = await Promise.all([
    BetCode.findById(id).populate("category", "name slug color").populate("createdBy", "name").lean(),
    getLevelNames(),
  ]);
  return doc ? serializeForAdmin(doc, { levelNames }) : null;
}

/**
 * Translate the admin's release form (Publish now / Schedule / Draft + expiry)
 * into stored fields. All times are converted from the chosen timezone to UTC.
 */
export function computeRelease(input, { now = new Date(), defaultTimezone, defaultExpiryHours = 0, existing = null }) {
  const timezone = input.timezone || existing?.timezone || defaultTimezone;
  let status = existing?.status ?? BETCODE_STATUS.DRAFT;
  let publishAt = existing?.publishAt ?? null;
  let expiresAt = existing?.expiresAt ?? null;

  switch (input.releaseType) {
    case "NOW":
      status = BETCODE_STATUS.PUBLISHED;
      publishAt = now;
      break;
    case "SCHEDULE": {
      const at = zonedTimeToUtc(input.publishDate, input.publishTime, timezone);
      if (!at) throw new ApiError(422, "Invalid release date/time", { code: "VALIDATION_ERROR" });
      if (at.getTime() < now.getTime() - 5 * 60_000) {
        throw new ApiError(422, "The scheduled time is in the past. Use “Publish now” or pick a future time.", { code: "VALIDATION_ERROR" });
      }
      publishAt = at;
      status = at > now ? BETCODE_STATUS.SCHEDULED : BETCODE_STATUS.PUBLISHED;
      break;
    }
    case "DRAFT":
      status = BETCODE_STATUS.DRAFT;
      publishAt = null;
      break;
    default:
      break; // KEEP
  }

  const anchor = publishAt || now;
  switch (input.expiryType) {
    case "NONE":
      expiresAt = defaultExpiryHours > 0 && !existing ? new Date(anchor.getTime() + defaultExpiryHours * HOUR_MS) : null;
      break;
    case "DATETIME":
      expiresAt = zonedTimeToUtc(input.expiresDate, input.expiresTime, timezone);
      if (!expiresAt) throw new ApiError(422, "Invalid expiry date/time", { code: "VALIDATION_ERROR" });
      break;
    case "HOURS":
      expiresAt = new Date(anchor.getTime() + Number(input.expiresInHours) * HOUR_MS);
      break;
    default:
      break; // KEEP
  }

  if (expiresAt && expiresAt <= anchor) {
    throw new ApiError(422, "Expiry must be after the release time", { code: "VALIDATION_ERROR" });
  }
  if (status === BETCODE_STATUS.EXPIRED && (!expiresAt || expiresAt > now)) status = BETCODE_STATUS.PUBLISHED;
  return { status, publishAt, expiresAt, timezone };
}

async function assertCategory(categoryId) {
  if (!categoryId) return;
  const exists = await Category.exists({ _id: categoryId });
  if (!exists) throw new ApiError(422, "Selected category does not exist", { code: "VALIDATION_ERROR" });
}

export async function createBetCode(input, actor) {
  await connectDB();
  await assertCategory(input.category);
  const settings = await getSettings();
  const release = computeRelease(input, {
    defaultTimezone: settings.timezone,
    defaultExpiryHours: settings.betCodes.defaultExpiryHours,
  });
  const doc = await BetCode.create({
    title: input.title,
    code: input.code,
    bookmaker: input.bookmaker,
    description: input.description,
    analysis: input.analysis,
    totalOdds: input.totalOdds,
    category: input.category,
    accessLevel: input.accessLevel,
    isFeatured: input.isFeatured,
    notifyOnRelease: input.notifyOnRelease,
    result: input.result,
    ...release,
    createdBy: actor._id,
    updatedBy: actor._id,
  });
  if (doc.status === BETCODE_STATUS.PUBLISHED) scheduleReleaseProcessing();
  return doc;
}

export async function createBetCodeBatch(input, actor) {
  await connectDB();
  await assertCategory(input.category);
  const now = new Date();
  const batchId = `B${now.getTime().toString(36)}`;
  const docs = [];
  const seen = new Set();
  for (const item of input.items) {
    if (seen.has(item.time)) throw new ApiError(422, `Two releases share the time ${item.time}`, { code: "VALIDATION_ERROR" });
    seen.add(item.time);
    const publishAt = zonedTimeToUtc(input.date, item.time, input.timezone);
    if (!publishAt) throw new ApiError(422, `Invalid time ${item.time}`, { code: "VALIDATION_ERROR" });
    if (publishAt.getTime() < now.getTime() - 5 * 60_000) {
      throw new ApiError(422, `${item.time} on ${input.date} is in the past`, { code: "VALIDATION_ERROR" });
    }
    docs.push({
      title: item.title,
      code: item.code,
      totalOdds: item.totalOdds,
      description: item.description,
      bookmaker: input.bookmaker,
      category: input.category,
      accessLevel: input.accessLevel,
      notifyOnRelease: input.notifyOnRelease,
      status: publishAt > now ? BETCODE_STATUS.SCHEDULED : BETCODE_STATUS.PUBLISHED,
      publishAt,
      expiresAt: input.expiresInHours ? new Date(publishAt.getTime() + input.expiresInHours * HOUR_MS) : null,
      timezone: input.timezone,
      createdBy: actor._id,
      updatedBy: actor._id,
      batchId,
    });
  }
  const created = await BetCode.insertMany(docs);
  if (created.some((d) => d.status === BETCODE_STATUS.PUBLISHED)) scheduleReleaseProcessing();
  return { batchId, created };
}

export async function updateBetCode(id, input, actor) {
  await connectDB();
  const doc = await BetCode.findById(id);
  if (!doc) throw new ApiError(404, "Bet code not found");
  if (input.category !== undefined) await assertCategory(input.category);
  const settings = await getSettings();
  const release = computeRelease(input, { defaultTimezone: settings.timezone, existing: doc.toObject() });

  const fields = ["title", "code", "bookmaker", "description", "analysis", "totalOdds", "category", "accessLevel", "isFeatured", "notifyOnRelease", "result"];
  const changes = {};
  for (const f of fields) {
    if (input[f] !== undefined && String(input[f]) !== String(doc[f])) {
      changes[f] = { from: doc[f], to: input[f] };
      doc[f] = input[f];
    }
  }
  const prevStatus = doc.status;
  Object.assign(doc, release, { updatedBy: actor._id });
  await doc.save();
  if (doc.status === BETCODE_STATUS.PUBLISHED) scheduleReleaseProcessing();
  // Never log the protected code value itself in the audit trail.
  if (changes.code) changes.code = { changed: true };
  return { doc, changes, statusChanged: prevStatus !== doc.status };
}

export async function applyBetCodeAction(id, { action, result }, actor) {
  await connectDB();
  const doc = await BetCode.findById(id);
  if (!doc) throw new ApiError(404, "Bet code not found");
  const now = new Date();
  switch (action) {
    case "publish":
      if (doc.status === BETCODE_STATUS.ARCHIVED) throw new ApiError(400, "Restore the code before publishing it");
      if (doc.expiresAt && doc.expiresAt <= now) throw new ApiError(400, "This code's expiry has passed. Update the expiry first.");
      doc.status = BETCODE_STATUS.PUBLISHED;
      if (!doc.publishAt || doc.publishAt > now) doc.publishAt = now;
      break;
    case "unpublish":
      doc.status = BETCODE_STATUS.DRAFT;
      doc.publishAt = null;
      break;
    case "archive":
      doc.status = BETCODE_STATUS.ARCHIVED;
      break;
    case "restore":
      doc.status = BETCODE_STATUS.DRAFT;
      doc.publishAt = null;
      break;
    case "feature":
      doc.isFeatured = true;
      break;
    case "unfeature":
      doc.isFeatured = false;
      break;
    case "setResult":
      if (!result) throw new ApiError(422, "Choose a result", { code: "VALIDATION_ERROR" });
      doc.result = result;
      break;
    default:
      throw new ApiError(400, "Unknown action");
  }
  doc.updatedBy = actor._id;
  await doc.save();
  if (action === "publish") scheduleReleaseProcessing();
  return doc;
}

// ── Release processing (cron + after-response) ──────────────

/** Run release processing after the current response is sent. */
export function scheduleReleaseProcessing() {
  try {
    after(async () => {
      try {
        await processDueReleases();
      } catch (error) {
        console.error("[betcodes] release processing failed:", error?.message);
      }
    });
  } catch {
    // outside a request scope
  }
}

/**
 * 1. SCHEDULED codes whose time has come → PUBLISHED.
 * 2. Released, un-notified codes → notify entitled users (claimed atomically; never twice).
 * 3. PUBLISHED codes past expiry → EXPIRED.
 * Visibility never depends on this job (queries check times directly); it keeps
 * statuses tidy and drives notifications.
 */
export async function processDueReleases(now = new Date()) {
  await connectDB();
  const promoted = await BetCode.updateMany(
    { status: BETCODE_STATUS.SCHEDULED, publishAt: { $lte: now } },
    { $set: { status: BETCODE_STATUS.PUBLISHED } }
  );
  const expired = await BetCode.updateMany(
    { status: BETCODE_STATUS.PUBLISHED, expiresAt: { $ne: null, $lte: now } },
    { $set: { status: BETCODE_STATUS.EXPIRED } }
  );

  let notified = 0;
  const settings = await getSettings();
  // Mark stale releases (older than 6h) as handled without notifying to avoid late spam.
  await BetCode.updateMany(
    { notifiedAt: null, status: { $in: RELEASED_STATUSES }, publishAt: { $lte: new Date(now.getTime() - 6 * HOUR_MS) } },
    { $set: { notifiedAt: now } }
  );
  for (let i = 0; i < 20; i++) {
    const code = await BetCode.findOneAndUpdate(
      { notifiedAt: null, status: BETCODE_STATUS.PUBLISHED, publishAt: { $lte: now } },
      { $set: { notifiedAt: now } },
      { sort: { publishAt: 1 }, returnDocument: "after" }
    ).lean();
    if (!code) break;
    if (!code.notifyOnRelease || settings.notifications.betCodeReleased === false) continue;
    if (code.expiresAt && code.expiresAt <= now) continue;
    await notifyBetCodeRelease(code);
    notified++;
  }
  return { promoted: promoted.modifiedCount, expired: expired.modifiedCount, notified };
}

/** Notify ONLY users whose active subscription level covers the code. */
export async function notifyBetCodeRelease(code) {
  const now = new Date();
  const levelNames = await getLevelNames();
  const priorityPlans = new Set(
    (await SubscriptionPlan.find({ priorityNotifications: true }).distinct("_id")).map(String)
  );

  let audience;
  if (code.accessLevel <= FREE_ACCESS_LEVEL) {
    const users = await User.find({ role: ROLES.USER, status: USER_STATUS.ACTIVE }).select("_id").lean();
    audience = users.map((u) => ({ _id: u._id, level: 0, plans: [] }));
    const subs = await Subscription.aggregate([
      { $match: { status: SUBSCRIPTION_STATUS.ACTIVE, startDate: { $lte: now }, endDate: { $gt: now } } },
      { $group: { _id: "$user", level: { $max: "$accessLevel" }, plans: { $addToSet: "$plan" } } },
    ]);
    const byUser = new Map(subs.map((s) => [String(s._id), s]));
    audience = audience.map((a) => byUser.get(String(a._id)) ?? a);
  } else {
    audience = await Subscription.aggregate([
      {
        $match: {
          status: SUBSCRIPTION_STATUS.ACTIVE,
          startDate: { $lte: now },
          endDate: { $gt: now },
          accessLevel: { $gte: code.accessLevel },
        },
      },
      { $group: { _id: "$user", level: { $max: "$accessLevel" }, plans: { $addToSet: "$plan" } } },
    ]);
  }
  if (!audience.length) return { recipients: 0 };

  const meta = new Map(audience.map((a) => [String(a._id), a]));
  const msg = messages.betCodeReleased({
    levelName: levelName(levelNames, code.accessLevel),
    title: code.title,
    betCodeId: String(code._id),
  });
  msg.metadata = { betCodeId: String(code._id) };

  let totals = { inApp: 0, whatsappQueued: 0 };
  const ids = audience.map((a) => a._id);
  for (let i = 0; i < ids.length; i += 1000) {
    const users = await User.find({ _id: { $in: ids.slice(i, i + 1000) }, status: USER_STATUS.ACTIVE, role: ROLES.USER })
      .select("name phone status notificationPrefs")
      .lean();
    const recipients = users.map((u) => {
      const m = meta.get(String(u._id));
      const isPriority = (m?.plans || []).some((p) => priorityPlans.has(String(p)));
      // Higher tiers are delivered first; plans with priority notifications jump the queue.
      return { ...u, priority: (m?.level || 0) * 10 + (isPriority ? 1000 : 0) };
    });
    const r = await notifyUsers(recipients, msg);
    totals = { inApp: totals.inApp + r.inApp, whatsappQueued: totals.whatsappQueued + r.whatsappQueued };
  }
  return { recipients: totals.inApp, ...totals };
}
