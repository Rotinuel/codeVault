import mongoose from "mongoose";
import {
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_STATUS_VALUES,
  SUBSCRIPTION_TYPE_VALUES,
} from "../lib/constants.js";

const { Schema } = mongoose;

const SubscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
    // Snapshot of the plan at purchase time: what the user actually paid for.
    planName: { type: String, required: true },
    planSlug: { type: String, default: "" },
    accessLevel: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "NGN" },
    durationDays: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUS_VALUES,
      default: SUBSCRIPTION_STATUS.PENDING,
    },
    type: { type: String, enum: SUBSCRIPTION_TYPE_VALUES, default: "NEW" },
    // Every payment that created or extended this subscription (idempotency guard).
    payments: [{ type: Schema.Types.ObjectId, ref: "Payment" }],
    renewalCount: { type: Number, default: 0 },
    previousSubscription: { type: Schema.Types.ObjectId, ref: "Subscription", default: null },
    replacedBy: { type: Schema.Types.ObjectId, ref: "Subscription", default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, maxlength: 300, default: null },
    creditDays: { type: Number, default: 0 },
    reminderSentAt: { type: Date, default: null },
    expiredNotifiedAt: { type: Date, default: null },
    modifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, maxlength: 500, default: "" },
  },
  { timestamps: true }
);

// Hot path: "does this user have an active subscription right now?"
SubscriptionSchema.index({ user: 1, status: 1, endDate: -1 });
// Expiry sweeps & audience queries for notifications.
SubscriptionSchema.index({ status: 1, endDate: 1 });
SubscriptionSchema.index({ status: 1, accessLevel: 1, endDate: 1 });
SubscriptionSchema.index({ payments: 1 });
SubscriptionSchema.index({ createdAt: -1 });

export default mongoose.models.Subscription || mongoose.model("Subscription", SubscriptionSchema);
