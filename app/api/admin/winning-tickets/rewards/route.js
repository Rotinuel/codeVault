import { ok, parseBody, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { ticketRewardsSchema } from "@/lib/validation";
import { getSettings, updateSettings } from "@/lib/settings";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

export const GET = withApi(async () => {
  await requirePermission(PERMISSIONS.WINNING_TICKETS_REVIEW);
  const settings = await getSettings({ fresh: true });
  return ok({ rewards: settings.ticketRewards });
});

// Super Admin: the monthly upload target and the discount it earns.
export const PATCH = withApi(async (request) => {
  const { user: actor } = await requirePermission(PERMISSIONS.WINNING_TICKETS_REVIEW);
  const ticketRewards = await parseBody(request, ticketRewardsSchema);
  const settings = await updateSettings({ ticketRewards }, actor._id);
  await logAudit({ actor, action: AUDIT_ACTIONS.TICKET_REWARDS_UPDATED, targetType: "Settings", targetId: "platform", metadata: { ticketRewards }, request });
  return ok({ rewards: settings.ticketRewards }, { message: "Reward settings saved" });
});
