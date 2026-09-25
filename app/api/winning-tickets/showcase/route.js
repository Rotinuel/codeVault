import { ok, withApi } from "@/lib/api";
import { getShowcaseTickets } from "@/lib/services/winning-tickets";

// Public: anonymous approved tickets for the homepage carousel (no names or IDs).
export const GET = withApi(async () => {
  const tickets = await getShowcaseTickets();
  return ok({ tickets });
});
