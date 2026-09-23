import { ok, withApi } from "@/lib/api";
import { destroySession } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import User from "@/models/User";

// POST /api/auth/logout            → end this session
// POST /api/auth/logout?all=1      → revoke every session for this account
export const POST = withApi(async (request) => {
  const url = new URL(request.url);
  if (url.searchParams.get("all") === "1") {
    const user = await getCurrentUser();
    if (user) await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
  }
  await destroySession();
  return ok({ redirectTo: "/login" }, { message: "Signed out" });
});
