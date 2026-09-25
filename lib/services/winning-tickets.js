import "server-only";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { connectDB } from "../mongodb.js";
import WinningTicket from "../../models/WinningTicket.js";
import User from "../../models/User.js";
import { ApiError, Errors } from "../api.js";
import { getSettings } from "../settings.js";
import { notifyUser } from "../notifications.js";
import { messages } from "../messages.js";
import { PAYMENT_STATUS, TICKET_STATUS } from "../constants.js";
import Payment from "../../models/Payment.js";
import { evaluateMonthlyReward, monthKey, monthLabel, monthRange, shiftMonth, sniffImageType, ticketDedupeKey } from "../ticket-rewards.js";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// ── Rewards ────────────────────────────────────────────────────
// A client whose APPROVED uploads in a calendar month (platform timezone, by
// upload date) reach the Super Admin's target gets the set discount on ONE
// payment during the following month.

async function approvedInMonth(userId, key, timeZone) {
  const { start, end } = monthRange(key, timeZone);
  return WinningTicket.countDocuments({ user: userId, status: TICKET_STATUS.APPROVED, createdAt: { $gte: start, $lt: end } });
}

/** Where this client stands, and the discount they can use right now. Read-only. */
export async function getRewardStatus(userId, { now = new Date() } = {}) {
  await connectDB();
  const settings = await getSettings();
  const cfg = settings.ticketRewards;
  const tz = settings.timezone;
  const thisKey = monthKey(now, tz);
  const lastKey = shiftMonth(thisKey, -1);
  const { start, end } = monthRange(thisKey, tz);

  const [lastApproved, thisApproved, thisPending, usedPayment] = await Promise.all([
    approvedInMonth(userId, lastKey, tz),
    approvedInMonth(userId, thisKey, tz),
    WinningTicket.countDocuments({ user: userId, status: TICKET_STATUS.PENDING, createdAt: { $gte: start, $lt: end } }),
    Payment.findOne({ user: userId, rewardMonth: lastKey, status: { $in: [PAYMENT_STATUS.SUCCESS, PAYMENT_STATUS.PROCESSING] } })
      .select("_id paidAt createdAt")
      .lean(),
  ]);
  const reward = evaluateMonthlyReward(cfg, lastApproved, Boolean(usedPayment));

  return {
    enabled: Boolean(cfg.enabled),
    target: reward.target,
    percent: reward.percent,
    discount: reward.discount, // % to apply to the next payment (0 = none)
    rewardMonth: reward.available ? lastKey : null,
    lastMonth: {
      key: lastKey,
      label: monthLabel(lastKey),
      approved: lastApproved,
      qualified: reward.qualified,
      used: Boolean(usedPayment),
      usedAt: usedPayment ? usedPayment.paidAt || usedPayment.createdAt : null,
    },
    thisMonth: {
      key: thisKey,
      label: monthLabel(thisKey),
      approved: thisApproved,
      pending: thisPending,
      remaining: Math.max(0, reward.target - thisApproved),
      qualified: thisApproved >= reward.target,
      usableIn: monthLabel(shiftMonth(thisKey, 1)),
    },
  };
}

/** Mark the tickets whose month earned a paid discount (for display). Idempotent. */
export async function markRewardRedeemed(payment, now = new Date()) {
  if (!payment?.rewardMonth) return;
  const settings = await getSettings();
  const { start, end } = monthRange(payment.rewardMonth, settings.timezone);
  await WinningTicket.updateMany(
    { user: payment.user, status: TICKET_STATUS.APPROVED, createdAt: { $gte: start, $lt: end }, redeemedAt: null },
    { $set: { redeemedAt: now, redeemedPayment: payment._id } }
  );
}

// ── Client uploads ─────────────────────────────────────────────

function decodeImage(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const buf = Buffer.from(base64, "base64");
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) throw Errors.badRequest("Image must be smaller than 2 MB", { errors: { image: "Image must be smaller than 2 MB" } });
  const type = sniffImageType(buf);
  if (!type) throw Errors.badRequest("That file isn't a valid JPG, PNG or WebP image", { errors: { image: "Upload a JPG, PNG or WebP image" } });
  return { buf, type };
}

export async function createTicket({ user, input, ipAddress }) {
  await connectDB();
  const settings = await getSettings();
  const { buf, type } = decodeImage(input.image);
  const imageHash = crypto.createHash("sha256").update(buf).digest("hex");
  const bookmaker = input.bookmaker === "Other" ? input.bookmakerOther : input.bookmaker;
  const dedupeKey = ticketDedupeKey(bookmaker, input.ticketRef);

  const dupImage = await WinningTicket.exists({ imageHash, status: { $ne: TICKET_STATUS.REJECTED } });
  if (dupImage) throw new ApiError(409, "This ticket image has already been submitted.", { code: "DUPLICATE_TICKET", errors: { image: "Already submitted" } });

  try {
    const doc = await WinningTicket.create({
      user: user._id,
      bookmaker,
      ticketRef: input.ticketRef.trim(),
      stake: input.stake,
      payout: input.payout,
      currency: settings.currency,
      wonAt: new Date(`${input.wonAt}T12:00:00Z`),
      codeUsed: input.codeUsed,
      note: input.note,
      image: { data: buf, contentType: type, size: buf.length },
      imageHash,
      dedupeKey,
      showcaseConsent: Boolean(input.showcaseConsent),
      ipAddress,
    });
    return doc;
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, "A ticket with this bookmaker and ticket ID has already been submitted.", {
        code: "DUPLICATE_TICKET",
        errors: { ticketRef: "Already submitted" },
      });
    }
    throw error;
  }
}

export function serializeTicket(t, { admin = false } = {}) {
  const base = {
    id: String(t._id),
    status: t.status,
    bookmaker: t.bookmaker,
    ticketRef: t.ticketRef,
    stake: t.stake,
    payout: t.payout,
    currency: t.currency,
    wonAt: t.wonAt,
    codeUsed: t.codeUsed || "",
    note: t.note || "",
    showcaseConsent: Boolean(t.showcaseConsent),
    showcase: Boolean(t.showcase),
    rejectionReason: t.rejectionReason || "",
    reviewedAt: t.reviewedAt,
    redeemedAt: t.redeemedAt,
    createdAt: t.createdAt,
    imageUrl: `/api/winning-tickets/${t._id}/image?v=${new Date(t.updatedAt || t.createdAt).getTime()}`,
  };
  if (!admin) return base;
  return {
    ...base,
    user: t.user && typeof t.user === "object" && t.user._id
      ? { id: String(t.user._id), name: t.user.name, email: t.user.email, phone: t.user.phone || "" }
      : { id: String(t.user) },
    reviewedBy: t.reviewedBy && typeof t.reviewedBy === "object" && t.reviewedBy.name ? t.reviewedBy.name : null,
    imageSize: t.image?.size ?? 0,
    ipAddress: t.ipAddress || null,
  };
}

export async function listUserTickets(userId) {
  await connectDB();
  const items = await WinningTicket.find({ user: userId }).sort({ createdAt: -1 }).limit(100).lean();
  return items.map((t) => serializeTicket(t));
}

export async function withdrawTicket(userId, id) {
  await connectDB();
  const res = await WinningTicket.deleteOne({ _id: id, user: userId, status: TICKET_STATUS.PENDING });
  if (!res.deletedCount) throw Errors.badRequest("Only tickets that are still waiting for review can be withdrawn");
}

// ── Super Admin review ─────────────────────────────────────────

export async function reviewTicket({ id, input, actor }) {
  await connectDB();
  const ticket = await WinningTicket.findById(id);
  if (!ticket) throw Errors.notFound("Ticket not found");
  const now = new Date();

  if (input.action === "approve") {
    if (ticket.status === TICKET_STATUS.APPROVED) throw Errors.badRequest("This ticket is already approved");
    const dupKeyTaken = await WinningTicket.exists({ _id: { $ne: ticket._id }, dedupeKey: ticketDedupeKey(ticket.bookmaker, ticket.ticketRef) });
    if (dupKeyTaken) throw Errors.badRequest("Another ticket with the same bookmaker and ticket ID is already pending or approved");
    ticket.status = TICKET_STATUS.APPROVED;
    ticket.dedupeKey = ticketDedupeKey(ticket.bookmaker, ticket.ticketRef);
    ticket.showcase = Boolean(input.showcase && ticket.showcaseConsent);
    ticket.rejectionReason = "";
  } else if (input.action === "reject") {
    if (ticket.redeemedAt) throw Errors.badRequest("This ticket was already used for a discount and can't be rejected now");
    ticket.status = TICKET_STATUS.REJECTED;
    ticket.dedupeKey = null;
    ticket.showcase = false;
    ticket.rejectionReason = input.reason;
  } else if (input.action === "showcase") {
    if (ticket.status !== TICKET_STATUS.APPROVED) throw Errors.badRequest("Only approved tickets can be shown on the homepage");
    if (input.showcase && !ticket.showcaseConsent) throw Errors.badRequest("The client didn't agree to show this ticket publicly");
    ticket.showcase = input.showcase;
    await ticket.save();
    return { ticket };
  }

  ticket.reviewedBy = actor._id;
  ticket.reviewedAt = now;
  await ticket.save();

  const user = await User.findById(ticket.user).select("name phone status notificationPrefs").lean();
  if (user) {
    if (ticket.status === TICKET_STATUS.APPROVED) {
      const settings = await getSettings();
      const key = monthKey(ticket.createdAt, settings.timezone);
      const approved = await approvedInMonth(ticket.user, key, settings.timezone);
      const reward = evaluateMonthlyReward(settings.ticketRewards, approved, false);
      await notifyUser(
        user,
        messages.ticketApproved({
          name: user.name,
          payout: ticket.payout,
          currency: ticket.currency,
          rewardsEnabled: Boolean(settings.ticketRewards.enabled),
          approved,
          target: reward.target,
          percent: reward.percent,
          monthLabel: monthLabel(key),
          usableIn: monthLabel(shiftMonth(key, 1)),
        })
      );
    } else {
      await notifyUser(user, messages.ticketRejected({ name: user.name, payout: ticket.payout, currency: ticket.currency, reason: ticket.rejectionReason }));
    }
  }
  return { ticket };
}

export async function adminListTickets({ status, q, page, limit, showcase }) {
  await connectDB();
  const filter = {};
  if (status) filter.status = status;
  if (showcase) filter.showcase = true;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const users = await User.find({ $or: [{ name: rx }, { email: rx }, { phone: rx }] }).select("_id").limit(500).lean();
    filter.$or = [{ ticketRef: rx }, { bookmaker: rx }, { user: { $in: users.map((u) => u._id) } }];
  }
  const [items, total, counts] = await Promise.all([
    WinningTicket.find(filter)
      .populate("user", "name email phone")
      .populate("reviewedBy", "name")
      .sort({ status: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    WinningTicket.countDocuments(filter),
    WinningTicket.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);

  // Context for the reviewer: how many tickets each uploader has, by status.
  const userIds = [...new Set(items.map((t) => String(t.user?._id || t.user)))].map((id) => new mongoose.Types.ObjectId(id));
  const perUser = await WinningTicket.aggregate([
    { $match: { user: { $in: userIds } } },
    { $group: { _id: { user: "$user", status: "$status" }, n: { $sum: 1 } } },
  ]);
  const stats = {};
  for (const r of perUser) {
    const k = String(r._id.user);
    stats[k] ??= { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    stats[k][r._id.status] = r.n;
  }

  return {
    tickets: items.map((t) => ({ ...serializeTicket(t, { admin: true }), uploaderStats: stats[String(t.user?._id || t.user)] || null })),
    counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
    total,
  };
}

// ── Homepage showcase ──────────────────────────────────────────

/** Anonymous, approved, consented tickets for the public carousel. No user data. */
export async function getShowcaseTickets(limit = 16) {
  try {
    await connectDB();
    const settings = await getSettings();
    if (!settings.ticketRewards?.showcaseEnabled) return [];
    const items = await WinningTicket.find({ status: TICKET_STATUS.APPROVED, showcase: true, showcaseConsent: true })
      .sort({ reviewedAt: -1 })
      .limit(limit)
      .select("bookmaker stake payout currency wonAt updatedAt createdAt")
      .lean();
    return items.map((t) => ({
      id: String(t._id),
      bookmaker: t.bookmaker,
      stake: t.stake,
      payout: t.payout,
      currency: t.currency,
      wonAt: t.wonAt ? new Date(t.wonAt).toISOString() : null,
      imageUrl: `/api/winning-tickets/${t._id}/image?v=${new Date(t.updatedAt || t.createdAt).getTime()}`,
    }));
  } catch (error) {
    console.error("[tickets] showcase unavailable:", error?.message);
    return [];
  }
}
