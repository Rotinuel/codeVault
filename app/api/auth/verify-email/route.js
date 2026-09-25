import { z } from "zod";
import { ok, parseBody, withApi } from "@/lib/api";
import { getCurrentUser, requireSession } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { verifyWithCode, verifyWithToken } from "@/lib/services/email-verification";

const schema = z.union([
  z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email") }),
  z.object({ token: z.string().trim().regex(/^[A-Za-z0-9_-]{20,100}$/, "Invalid verification link") }),
]);

// Verify an email address with the 6-digit code (signed in) or the emailed link token.
export const POST = withApi(async (request) => {
  await enforceRateLimit(request, "verify-email", LIMITS.verifyEmail);
  const body = await parseBody(request, schema);

  if ("token" in body) {
    const { userId } = await verifyWithToken(body.token);
    const current = await getCurrentUser().catch(() => null);
    const signedIn = Boolean(current && String(current._id) === userId);
    return ok(
      { verified: true, redirectTo: signedIn ? "/dashboard/subscription" : "/login?verified=1" },
      { message: "Email verified" }
    );
  }

  const user = await requireSession();
  await enforceRateLimit(request, "verify-email-account", { ...LIMITS.verifyEmail, key: String(user._id) });
  await verifyWithCode(user._id, body.code);
  return ok({ verified: true, redirectTo: "/dashboard/subscription" }, { message: "Email verified" });
});
