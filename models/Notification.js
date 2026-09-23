import mongoose from "mongoose";
import { NOTIFICATION_TYPE_VALUES } from "../lib/constants.js";

const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 2000 },
    type: { type: String, enum: NOTIFICATION_TYPE_VALUES, default: "SYSTEM" },
    read: { type: Boolean, default: false },
    link: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, createdAt: -1 });
// Keep the collection lean: notifications older than 180 days are removed automatically.
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export default mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
