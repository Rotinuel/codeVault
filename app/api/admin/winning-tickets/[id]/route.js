import { getRouteId, ok, parseBody, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { ticketReviewSchema } from "@/lib/validation";
import { reviewTicket, serializeTicket } from "@/lib/services/winning-tickets";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

const AUDIT = {
  approve: AUDIT_ACTIONS.TICKET_APPROVED,
  reject: AUDIT_ACTIONS.TICKET_REJECTED,
  showcase: AUDIT_ACTIONS.TICKET_SHOWCASE_CHANGED,
};
const MESSAGE = {
  approve: "Ticket approved — the client has been notified",
  reject: "Ticket rejected — the client has been notified",
  showcase: "Homepage visibility updated",
};

// Super Admin: approve / reject a winning ticket, or toggle homepage display.
export const PATCH = withApi(async (request, context) => {
  const id = await getRouteId(context);
  const { user: actor } = await requirePermission(PERMISSIONS.WINNING_TICKETS_REVIEW);
  const input = await parseBody(request, ticketReviewSchema);
  const { ticket } = await reviewTicket({ id, input, actor });
  await logAudit({
    actor,
    action: AUDIT[input.action],
    targetType: "WinningTicket",
    targetId: id,
    metadata: {
      user: String(ticket.user),
      bookmaker: ticket.bookmaker,
      ticketRef: ticket.ticketRef,
      payout: ticket.payout,
      showcase: ticket.showcase,
      reason: input.reason ?? undefined,
    },
    request,
  });
  return ok({ ticket: serializeTicket(ticket.toObject(), { admin: true }) }, { message: MESSAGE[input.action] });
});
