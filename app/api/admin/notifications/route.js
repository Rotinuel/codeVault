import mongoose from "mongoose";
import { ok, parseBody, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import Broadcast from "@/models/Broadcast";
import MessageOutbox from "@/models/MessageOutbox";
import Subscription from "@/models/Subscription";
import User from "@/models/User";
import { broadcastSchema } from "@/lib/validation";
import { ROLES, SUBSCRIPTION_STATUS, USER_STATUS } from "@/lib/constants";
import { activeSubscriptionFilter } from "@/lib/services/subscriptions";
import { notifyUsers } from "@/lib/notifications";
import { messages } from "@/lib/messages";
import { whatsappStatus } from "@/lib/whatsapp";
import { getSettings } from "@/lib/settings";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

function maskPhone(p = "") {
  return p.length > 6 ? `${p.slice(0, 4)}•••${p.slice(-3)}` : "•••";
}

export const GET = withApi(async () => {
  await requirePermission(PERMISSIONS.NOTIFICATIONS_SEND);
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [broadcasts, stats, recent, settings] = await Promise.all([
    Broadcast.find({}).sort({ createdAt: -1 }).limit(20).populate("sentBy", "name").lean(),
    MessageOutbox.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    MessageOutbox.find({}).sort({ createdAt: -1 }).limit(25).lean(),
    getSettings(),
  ]);
  return ok({
    whatsapp: { ...whatsappStatus(), enabled: settings.whatsapp.enabled },
    broadcasts: broadcasts.map((b) => ({
      id: String(b._id),
      title: b.title,
      message: b.message,
      audience: b.audience,
      channels: b.channels,
      recipientCount: b.recipientCount,
      whatsappQueued: b.whatsappQueued,
      sentBy: b.sentBy?.name ?? "—",
      createdAt: b.createdAt,
    })),
    outboxStats: Object.fromEntries(stats.map((s) => [s._id, s.count])),
    recentMessages: recent.map((m) => ({
      id: String(m._id),
      to: maskPhone(m.to),
      event: m.event,
      status: m.status,
      attempts: m.attempts,
      lastError: m.lastError,
      createdAt: m.createdAt,
      sentAt: m.sentAt,
    })),
  });
});

async function resolveAudience({ audience, minLevel, planId }) {
  const now = new Date();
  const active = activeSubscriptionFilter(now);
  switch (audience) {
    case "ALL":
      return null; // all active client accounts
    case "SUBSCRIBERS":
      return Subscription.distinct("user", active);
    case "MIN_LEVEL":
      return Subscription.distinct("user", { ...active, accessLevel: { $gte: minLevel } });
    case "PLAN":
      return Subscription.distinct("user", { ...active, plan: new mongoose.Types.ObjectId(planId) });
    case "EXPIRED": {
      const [expired, current] = await Promise.all([
        Subscription.distinct("user", { status: SUBSCRIPTION_STATUS.EXPIRED }),
        Subscription.distinct("user", active),
      ]);
      const activeSet = new Set(current.map(String));
      return expired.filter((id) => !activeSet.has(String(id)));
    }
    case "UNSUBSCRIBED": {
      const current = await Subscription.distinct("user", active);
      return { $nin: current };
    }
    default:
      return [];
  }
}

export const POST = withApi(async (request) => {
  const { user: actor } = await requirePermission(PERMISSIONS.NOTIFICATIONS_SEND);
  await enforceRateLimit(request, "broadcast", { ...LIMITS.broadcast, key: String(actor._id) });
  const body = await parseBody(request, broadcastSchema);

  const ids = await resolveAudience(body);
  const userFilter = { role: ROLES.USER, status: USER_STATUS.ACTIVE };
  if (Array.isArray(ids)) userFilter._id = { $in: ids };
  else if (ids) userFilter._id = ids;

  const recipients = await User.find(userFilter).select("name phone status notificationPrefs").lean();
  const msg = messages.broadcast({ title: body.title, message: body.message });
  const result = recipients.length
    ? await notifyUsers(recipients, msg, { inApp: body.inApp, whatsapp: body.whatsapp })
    : { inApp: 0, whatsappQueued: 0 };

  const broadcast = await Broadcast.create({
    title: body.title,
    message: body.message,
    audience: { kind: body.audience, minLevel: body.minLevel ?? null, plan: body.planId ?? null },
    channels: { inApp: body.inApp, whatsapp: body.whatsapp },
    recipientCount: recipients.length,
    whatsappQueued: result.whatsappQueued,
    sentBy: actor._id,
  });
  await logAudit({
    actor,
    action: AUDIT_ACTIONS.BROADCAST_SENT,
    targetType: "Broadcast",
    targetId: broadcast._id,
    metadata: { title: body.title, audience: body.audience, recipients: recipients.length, whatsappQueued: result.whatsappQueued },
    request,
  });
  return ok(
    { recipients: recipients.length, whatsappQueued: result.whatsappQueued },
    { message: `Sent to ${recipients.length} user${recipients.length === 1 ? "" : "s"}` }
  );
});
