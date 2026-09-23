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
 * Compare a Paystack transaction with our payment record. Returns a list of
 * mismatched fields; an empty list means the transaction is exactly the one we
 * initialised (same reference, amount, currency, user and payment).
 */
export function validateGatewayTransaction(payment, tx) {
  const problems = [];
  if (!tx || typeof tx !== "object") return ["transaction"];
  if (tx.reference !== payment.reference) problems.push("reference");
  if (Number(tx.amount) !== toSubunit(payment.amount)) problems.push("amount");
  if (String(tx.currency || "").toUpperCase() !== String(payment.currency).toUpperCase()) problems.push("currency");
  const meta = parseMetadata(tx.metadata);
  if (meta.userId && String(meta.userId) !== String(payment.user)) problems.push("user");
  if (meta.paymentId && String(meta.paymentId) !== String(payment._id)) problems.push("payment");
  return problems;
}
