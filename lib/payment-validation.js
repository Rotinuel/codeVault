// Pure payment checks (no I/O) so they can be unit-tested in isolation.

/** Convert a major-unit amount (e.g. ₦5,000) to Paystack's subunit integer (500000 kobo). */
export function toSubunit(amount) {
  return Math.round(Number(amount) * 100);
}

function parseMetadata(meta) {
  if (!meta) return {};
  if (typeof meta === "string") {
    try {
      return JSON.parse(meta);
    } catch {
      return {};
    }
  }
  return meta;
}

/**
 * Did Paystack collect exactly what we asked for? `tx.amount` is what the
 * customer was charged. When the Paystack account passes transaction fees to
 * the customer ("bearer: customer"), that figure includes the fee, and the
 * original price is reported as `requested_amount` (and the fee as `fees`).
 * Underpayment is always rejected.
 */
export function amountMatches(payment, tx) {
  const expected = toSubunit(payment.amount);
  const charged = Number(tx.amount);
  if (!Number.isFinite(charged) || charged < expected) return false;
  if (charged === expected) return true;
  if (tx.requested_amount != null && Number(tx.requested_amount) === expected) return true;
  const fees = Number(tx.fees);
  return Number.isFinite(fees) && fees > 0 && charged - fees === expected;
}

/**
 * Compare a Paystack transaction with our payment record. Returns a list of
 * mismatched fields; an empty list means the transaction is exactly the one we
 * initialised (same reference, amount, currency, user and payment).
 */
export function validateGatewayTransaction(payment, tx) {
  const problems = [];
  if (!tx || typeof tx !== "object") return ["transaction"];
  if (tx.reference !== payment.reference) problems.push("reference");
  if (!amountMatches(payment, tx)) problems.push("amount");
  if (String(tx.currency || "").toUpperCase() !== String(payment.currency).toUpperCase()) problems.push("currency");
  const meta = parseMetadata(tx.metadata);
  if (meta.userId && String(meta.userId) !== String(payment.user)) problems.push("user");
  if (meta.paymentId && String(meta.paymentId) !== String(payment._id)) problems.push("payment");
  return problems;
}
