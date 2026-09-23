import mongoose from "mongoose";
import { DEFAULT_CURRENCY, MAX_ACCESS_LEVEL } from "../lib/constants.js";

const { Schema } = mongoose;

const SubscriptionPlanSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    // Price in major currency units (e.g. Naira). Paystack amounts are derived server-side.
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: DEFAULT_CURRENCY, uppercase: true },
    durationDays: { type: Number, required: true, min: 1, max: 3650 },
    // Higher level = more access. A level-N subscriber sees content at levels <= N.
    accessLevel: { type: Number, required: true, min: 1, max: MAX_ACCESS_LEVEL, index: true },
    features: [{ type: String, trim: true, maxlength: 160 }],
    // How far back (in days) subscribers on this plan can browse bet code history. null = unlimited.
    historyDays: { type: Number, min: 1, default: null },
    priorityNotifications: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false },
    badge: { type: String, trim: true, maxlength: 30, default: "" },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

SubscriptionPlanSchema.index({ isActive: 1, accessLevel: 1, sortOrder: 1 });

export default mongoose.models.SubscriptionPlan ||
  mongoose.model("SubscriptionPlan", SubscriptionPlanSchema);
