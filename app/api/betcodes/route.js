import { z } from "zod";
import { ok, parseQuery, withApi } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { listBetCodesForUser } from "@/lib/services/betcodes";
import { maybeRunJobs } from "@/lib/jobs";

const schema = z.object({
  tab: z.enum(["all", "live", "today", "upcoming", "history", "favorites", "featured"]).optional().default("all"),
  category: z.string().trim().max(80).regex(/^[a-z0-9-]*$/i).optional(),
  q: z.string().trim().max(80).optional().default(""),
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
});

// Returns ONLY codes the caller's subscription covers. Higher-tier teasers (if
// enabled) are returned separately and never include the code or analysis.
export const GET = withApi(async (request) => {
  const user = await requireAuth();
  const query = parseQuery(request, schema);
  const result = await listBetCodesForUser(user, query);
  maybeRunJobs();
  return ok(result);
});
