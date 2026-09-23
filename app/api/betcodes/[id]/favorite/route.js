import { z } from "zod";
import { getRouteId, ok, parseBody, withApi } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { setFavorite } from "@/lib/services/betcodes";

const schema = z.object({ favorite: z.boolean() });

export const POST = withApi(async (request, context) => {
  const user = await requireAuth();
  const id = await getRouteId(context);
  const { favorite } = await parseBody(request, schema);
  const result = await setFavorite(user, id, favorite);
  return ok(result, { message: favorite ? "Added to favourites" : "Removed from favourites" });
});
