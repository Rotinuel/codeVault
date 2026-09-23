import { ok, parseBody, withApi } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import User from "@/models/User";
import { profileSchema, normalizePhone } from "@/lib/validation";
import { publicUser } from "@/lib/serializers";

// Users may only change their own name, phone and notification preferences.
// Email, role, status and subscription are never writable here.
export const PATCH = withApi(async (request) => {
  const user = await requireAuth();
  const body = await parseBody(request, profileSchema);
  const $set = {};
  if (body.name !== undefined) $set.name = body.name;
  if (body.phone !== undefined) $set.phone = normalizePhone(body.phone, process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "234");
  if (body.notificationPrefs) {
    for (const [k, v] of Object.entries(body.notificationPrefs)) {
      if (typeof v === "boolean") $set[`notificationPrefs.${k}`] = v;
    }
  }
  const updated = await User.findByIdAndUpdate(user._id, { $set }, { returnDocument: "after", runValidators: true }).lean();
  return ok({ user: publicUser(updated) }, { message: "Profile updated" });
});
