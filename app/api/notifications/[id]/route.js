import { z } from "zod";
import { Errors, getRouteId, ok, parseBody, withApi } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import Notification from "@/models/Notification";

const schema = z.object({ read: z.boolean() });

// Every query includes { user: user._id } so users can never touch another user's notifications.
export const PATCH = withApi(async (request, context) => {
  const user = await requireAuth();
  const id = await getRouteId(context);
  const { read } = await parseBody(request, schema);
  const res = await Notification.updateOne({ _id: id, user: user._id }, { $set: { read } });
  if (!res.matchedCount) throw Errors.notFound("Notification not found");
  return ok({ id, read });
});

export const DELETE = withApi(async (request, context) => {
  const user = await requireAuth();
  const id = await getRouteId(context);
  const res = await Notification.deleteOne({ _id: id, user: user._id });
  if (!res.deletedCount) throw Errors.notFound("Notification not found");
  return ok({ id }, { message: "Notification removed" });
});
