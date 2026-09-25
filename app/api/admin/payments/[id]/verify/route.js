import { Errors, getRouteId, ok, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { connectDB } from "@/lib/mongodb";
import { fulfillPayment, serializePayment } from "@/lib/services/payments";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { PAYMENT_STATUS } from "@/lib/constants";
import Payment from "@/models/Payment";

// Admin "Re-check with Paystack": verifies the transaction again, server to
// server. A subscription is only activated if Paystack confirms the payment
// and every check (reference, amount, currency, customer) passes.
export const POST = withApi(async (request, context) => {
  const id = await getRouteId(context);
  const { user: actor } = await requirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE);
  await connectDB();
  const payment = await Payment.findById(id).select("reference status gateway").lean();
  if (!payment) throw Errors.notFound("Payment not found");
  if (payment.gateway !== "paystack") throw Errors.badRequest("Only Paystack payments can be re-checked");

  const before = payment.status;
  const result = await fulfillPayment(payment.reference, { source: "manual" });
  const after = result.status;

  await logAudit({
    actor,
    action: AUDIT_ACTIONS.PAYMENT_REVERIFIED,
    targetType: "Payment",
    targetId: id,
    metadata: { reference: payment.reference, before, after, mismatch: result.mismatch ?? null },
    request,
  });

  const message =
    after === PAYMENT_STATUS.SUCCESS
      ? result.alreadyProcessed
        ? "Payment was already successful"
        : "Payment confirmed and subscription activated"
      : `Paystack status: ${after.toLowerCase()}${result.mismatch ? ` (mismatch: ${result.mismatch.join(", ")})` : ""}`;
  return ok({ status: after, payment: serializePayment(result.payment) }, { message });
});
