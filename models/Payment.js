import mongoose from "mongoose";
import { PAYMENT_STATUS, PAYMENT_STATUS_VALUES, SUBSCRIPTION_TYPE_VALUES } from "../lib/constants.js";

const { Schema } = mongoose;

const PlanSnapshotSchema = new Schema(
  {
    name: String,
    slug: String,
    accessLevel: Number,
    durationDays: Number,
    price: Number,
    currency: String,
  },
  { _id: false }
);

const PaymentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
    // Plan terms locked at initialisation so later price edits never affect an in-flight payment.
    planSnapshot: { type: PlanSnapshotSchema, required: true },
    reference: { type: String, required: true, unique: true },
    // Amount in major units; Paystack is charged amount * 100 (kobo/pesewas/cents).
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "NGN" },
    status: { type: String, enum: PAYMENT_STATUS_VALUES, default: PAYMENT_STATUS.PENDING },
    intent: { type: String, enum: SUBSCRIPTION_TYPE_VALUES, default: "NEW" },
    appliedType: { type: String, enum: [...SUBSCRIPTION_TYPE_VALUES, null], default: null },
    paymentMethod: { type: String, default: null },
    gateway: { type: String, default: "paystack" },
    accessCode: { type: String, select: false, default: null },
    authorizationUrl: { type: String, default: null },
    // Selected, non-sensitive fields from Paystack's verify response.
    paystackData: { type: Schema.Types.Mixed, default: null },
    gatewayResponse: { type: String, default: null },
    failureReason: { type: String, default: null },
    subscription: { type: Schema.Types.ObjectId, ref: "Subscription", default: null },
    paidAt: { type: Date, default: null },
    processingAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
    verifiedVia: { type: String, enum: ["callback", "webhook", "manual", "job", null], default: null },
    failureNotifiedAt: { type: Date, default: null },
    ipAddress: { type: String, default: null },
  },
  { timestamps: true }
);

PaymentSchema.index({ user: 1, createdAt: -1 });
PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index({ user: 1, plan: 1, status: 1, createdAt: -1 });
PaymentSchema.index({ paidAt: -1 });

export default mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
