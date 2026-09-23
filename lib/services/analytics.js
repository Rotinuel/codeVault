import "server-only";
import { connectDB } from "../mongodb.js";
import User from "../../models/User.js";
import Subscription from "../../models/Subscription.js";
import Payment from "../../models/Payment.js";
import BetCode from "../../models/BetCode.js";
import BetCodeView from "../../models/BetCodeView.js";
import { BETCODE_STATUS, PAYMENT_STATUS, ROLES, SUBSCRIPTION_STATUS } from "../constants.js";
import { activeSubscriptionFilter } from "./subscriptions.js";
import { getSettings } from "../settings.js";
import { utcToZonedParts } from "../timezone.js";

const DAY_MS = 86_400_000;

function fillSeries(rows, days, timezone, keys) {
  const map = new Map(rows.map((r) => [r._id, r]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const { date } = utcToZonedParts(new Date(Date.now() - i * DAY_MS), timezone);
    const row = map.get(date) || {};
    const entry = { date };
    for (const k of keys) entry[k] = row[k] ?? 0;
    out.push(entry);
  }
  return out;
}

/**
 * Platform analytics. Revenue figures are only included when `full` is true
 * (Super Admins, or Admins granted analytics.full).
 */
export async function getAnalytics({ days = 30, full = false } = {}) {
  await connectDB();
  const settings = await getSettings();
  const tz = settings.timezone;
  const now = new Date();
  const since = new Date(now.getTime() - days * DAY_MS);
  const active = activeSubscriptionFilter(now);

  const [
    totalUsers,
    newUsers,
    activeUsers,
    activeSubscriberIds,
    expiredSubscriberIds,
    subsByPlan,
    signupsDaily,
    purchaseTypes,
    betCodesPublished,
    betCodesTotalLive,
    viewsInPeriod,
    viewsTotal,
    topCodes,
  ] = await Promise.all([
    User.countDocuments({ role: ROLES.USER }),
    User.countDocuments({ role: ROLES.USER, createdAt: { $gte: since } }),
    User.countDocuments({ role: ROLES.USER, lastSeenAt: { $gte: new Date(now.getTime() - 7 * DAY_MS) } }),
    Subscription.distinct("user", active),
    Subscription.distinct("user", { status: SUBSCRIPTION_STATUS.EXPIRED }),
    Subscription.aggregate([
      { $match: active },
      { $group: { _id: "$planName", count: { $sum: 1 }, level: { $max: "$accessLevel" } } },
      { $sort: { level: 1 } },
    ]),
    User.aggregate([
      { $match: { role: ROLES.USER, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: tz } }, signups: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { status: PAYMENT_STATUS.SUCCESS, paidAt: { $gte: since } } },
      { $group: { _id: "$appliedType", count: { $sum: 1 } } },
    ]),
    BetCode.countDocuments({
      status: { $in: [BETCODE_STATUS.PUBLISHED, BETCODE_STATUS.SCHEDULED, BETCODE_STATUS.EXPIRED] },
      publishAt: { $gte: since, $lte: now },
    }),
    BetCode.countDocuments({
      status: { $in: [BETCODE_STATUS.PUBLISHED, BETCODE_STATUS.SCHEDULED] },
      publishAt: { $lte: now },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }),
    BetCodeView.countDocuments({ createdAt: { $gte: since } }),
    BetCodeView.estimatedDocumentCount(),
    BetCode.find({ viewCount: { $gt: 0 } }).sort({ viewCount: -1 }).limit(5).select("title viewCount accessLevel publishAt").lean(),
  ]);

  const activeSet = new Set(activeSubscriberIds.map(String));
  const expiredOnly = expiredSubscriberIds.filter((id) => !activeSet.has(String(id))).length;
  const types = Object.fromEntries(purchaseTypes.map((t) => [t._id || "UNKNOWN", t.count]));

  const result = {
    periodDays: days,
    timezone: tz,
    currency: settings.currency,
    users: { total: totalUsers, new: newUsers, active7d: activeUsers },
    subscribers: { active: activeSubscriberIds.length, expired: expiredOnly, byPlan: subsByPlan.map((p) => ({ plan: p._id, count: p.count })) },
    subscriptions: {
      new: types.NEW || 0,
      renewals: types.RENEWAL || 0,
      upgrades: (types.UPGRADE || 0) + (types.SWITCH || 0),
    },
    betCodes: {
      publishedInPeriod: betCodesPublished,
      live: betCodesTotalLive,
      viewsInPeriod,
      viewsTotal,
      top: topCodes.map((c) => ({ id: String(c._id), title: c.title, views: c.viewCount, accessLevel: c.accessLevel })),
    },
    series: fillSeries(signupsDaily, days, tz, ["signups"]),
    revenue: null,
    recentPayments: [],
  };

  if (full) {
    const [allTime, inPeriod, byPlan, daily, recent] = await Promise.all([
      Payment.aggregate([{ $match: { status: PAYMENT_STATUS.SUCCESS } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      Payment.aggregate([
        { $match: { status: PAYMENT_STATUS.SUCCESS, paidAt: { $gte: since } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { status: PAYMENT_STATUS.SUCCESS, paidAt: { $gte: since } } },
        { $group: { _id: "$planSnapshot.name", revenue: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
      ]),
      Payment.aggregate([
        { $match: { status: PAYMENT_STATUS.SUCCESS, paidAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt", timezone: tz } },
            revenue: { $sum: "$amount" },
            payments: { $sum: 1 },
          },
        },
      ]),
      Payment.find({}).sort({ createdAt: -1 }).limit(8).populate("user", "name email").lean(),
    ]);
    const revenueSeries = fillSeries(daily, days, tz, ["revenue", "payments"]);
    result.series = result.series.map((s, i) => ({ ...s, revenue: revenueSeries[i].revenue, payments: revenueSeries[i].payments }));
    result.revenue = {
      allTime: allTime[0]?.total ?? 0,
      period: inPeriod[0]?.total ?? 0,
      paymentsInPeriod: inPeriod[0]?.count ?? 0,
      byPlan: byPlan.map((p) => ({ plan: p._id || "—", revenue: p.revenue, count: p.count })),
    };
    result.recentPayments = recent.map((p) => ({
      id: String(p._id),
      reference: p.reference,
      user: p.user ? { name: p.user.name, email: p.user.email } : null,
      planName: p.planSnapshot?.name,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt,
    }));
  }
  return result;
}
