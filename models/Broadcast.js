import mongoose from "mongoose";

const { Schema } = mongoose;

// History of admin-initiated notifications (in-app and/or WhatsApp).
const BroadcastSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 2000 },
    audience: {
      kind: { type: String, enum: ["ALL", "SUBSCRIBERS", "MIN_LEVEL", "PLAN", "EXPIRED", "UNSUBSCRIBED"], required: true },
      minLevel: { type: Number, default: null },
      plan: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", default: null },
    },
    channels: {
      inApp: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
    },
    recipientCount: { type: Number, default: 0 },
    whatsappQueued: { type: Number, default: 0 },
    sentBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

BroadcastSchema.index({ createdAt: -1 });

export default mongoose.models.Broadcast || mongoose.model("Broadcast", BroadcastSchema);
