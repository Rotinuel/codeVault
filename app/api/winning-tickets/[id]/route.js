import { getRouteId, ok, withApi } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { withdrawTicket } from "@/lib/services/winning-tickets";

// Client: withdraw a ticket that hasn't been reviewed yet.
export const DELETE = withApi(async (request, context) => {
  const id = await getRouteId(context);
  const user = await requireRole(ROLES.USER);
  await withdrawTicket(user._id, id);
  return ok({}, { message: "Ticket withdrawn" });
});
