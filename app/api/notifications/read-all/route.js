import { ok, withApi } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import Notification from "@/models/Notification";

export const POST = withApi(async () => {
  const user = await requireAuth();
  const res = await Notification.updateMany({ user: user._id, read: false }, { $set: { read: true } });
  return ok({ updated: res.modifiedCount }, { message: "All notifications marked as read" });
});
