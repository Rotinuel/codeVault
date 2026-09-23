import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { fulfillPayment } from "@/lib/services/payments";

// Paystack webhook. The raw body is HMAC-SHA512 signed with our secret key;
// unsigned or tampered requests are rejected before any processing. Even for
// valid events we re-verify the transaction via the Paystack API.
export async function POST(request) {
  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  let valid = false;
  try {
    valid = verifyWebhookSignature(raw, signature);
  } catch (error) {
    console.error("[webhook] signature check failed:", error?.message);
  }
  if (!valid) return NextResponse.json({ success: false, message: "Invalid signature" }, { status: 401 });

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ success: false, message: "Invalid payload" }, { status: 400 });
  }

  const reference = event?.data?.reference;
  if (reference && ["charge.success", "charge.failed"].includes(event.event)) {
    try {
      await fulfillPayment(String(reference), { source: "webhook" });
    } catch (error) {
      // 404 = not one of our subscription payments; anything else is logged and
      // retried by Paystack (non-2xx) or by the reconciliation job.
      if (error?.status !== 404) {
        console.error("[webhook] processing failed:", reference, error?.message);
        return NextResponse.json({ success: false }, { status: 500 });
      }
    }
  }
  return NextResponse.json({ success: true });
}
