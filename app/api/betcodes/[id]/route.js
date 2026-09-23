import { NextResponse } from "next/server";
import { getRouteId, ok, withApi } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getBetCodeForUser } from "@/lib/services/betcodes";

export const GET = withApi(async (request, context) => {
  const user = await requireAuth();
  const id = await getRouteId(context);
  const { betCode, authorized } = await getBetCodeForUser(user, id);
  if (!authorized) {
    // Locked preview only: no code, description, analysis or odds in the payload.
    return NextResponse.json(
      {
        success: false,
        code: "UPGRADE_REQUIRED",
        message:
          betCode.lockReason === "HISTORY_LIMIT"
            ? "This code is older than your plan's history window."
            : `Upgrade to ${betCode.accessLevelName} to access this bet code.`,
        data: { betCode },
      },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
  return ok({ betCode });
});
