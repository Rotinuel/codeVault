import { getRouteId, ok, withApi } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { recordView } from "@/lib/services/betcodes";

export const POST = withApi(async (request, context) => {
  const user = await requireAuth();
  const id = await getRouteId(context);
  const result = await recordView(user, id);
  return ok(result);
});
