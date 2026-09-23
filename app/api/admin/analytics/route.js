import { z } from "zod";
import { ok, parseQuery, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getAnalytics } from "@/lib/services/analytics";

const schema = z.object({ days: z.coerce.number().int().refine((d) => [7, 30, 90].includes(d)).optional().default(30) });

export const GET = withApi(async (request) => {
  const { permissions } = await requirePermission(PERMISSIONS.ANALYTICS_BASIC);
  const { days } = parseQuery(request, schema);
  const data = await getAnalytics({ days, full: permissions.includes(PERMISSIONS.ANALYTICS_FULL) });
  return ok(data);
});
