import { ok, parseBody, withApi } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request";
import { ticketUploadSchema } from "@/lib/validation";
import { createTicket, getRewardStatus, listUserTickets, serializeTicket } from "@/lib/services/winning-tickets";

// Client: my winning tickets + the discount they currently earn.
export const GET = withApi(async () => {
  const user = await requireRole(ROLES.USER);
  const [tickets, reward] = await Promise.all([listUserTickets(user._id), getRewardStatus(user._id)]);
  return ok({ tickets, reward });
});

// Client: upload a winning ticket for Super Admin review.
export const POST = withApi(async (request) => {
  const user = await requireRole(ROLES.USER);
  await enforceRateLimit(request, "ticket-upload", { ...LIMITS.ticketUpload, key: String(user._id) });
  const input = await parseBody(request, ticketUploadSchema);
  const { ipAddress } = await getRequestMeta(request);
  const ticket = await createTicket({ user, input, ipAddress });
  return ok({ ticket: serializeTicket(ticket.toObject()) }, { status: 201, message: "Ticket submitted for review" });
});
