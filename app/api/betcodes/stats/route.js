import { ok, withApi } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getUserBetCodeStats } from "@/lib/services/betcodes";

export const GET = withApi(async () => {
  const user = await requireAuth();
  return ok(await getUserBetCodeStats(user));
});
