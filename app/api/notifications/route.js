import { z } from "zod";
import { ok, pageMeta, parseQuery, withApi } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import Notification from "@/models/Notification";
import { serializeNotification } from "@/lib/serializers";
import { NOTIFICATION_TYPE_VALUES } from "@/lib/constants";

const schema = z.object({
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  unread: z.enum(["1", "0"]).optional(),
  type: z.enum(NOTIFICATION_TYPE_VALUES).optional(),
});

export const GET = withApi(async (request) => {
  const user = await requireAuth();
  const { page, limit, unread, type } = parseQuery(request, schema);
  const filter = { user: user._id };
  if (unread === "1") filter.read = false;
  if (type) filter.type = type;
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: user._id, read: false }),
  ]);
  return ok({ notifications: items.map(serializeNotification), unreadCount, meta: pageMeta(page, limit, total) });
});
