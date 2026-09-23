import mongoose from "mongoose";
import { MESSAGE_STATUS, MESSAGE_STATUS_VALUES } from "../lib/constants.js";

const { Schema } = mongoose;

// Durable queue for outbound WhatsApp messages. Messages are enqueued by the app
// and drained in small batches (after responses and by the cron job) so large
// broadcasts never block a request or exceed serverless time limits.
const MessageOutboxSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    channel: { type: String, default: "whatsapp" },
    to: { type: String, required: true },
    event: { type: String, required: true },
    text: { type: String, required: true, maxlength: 4096 },
    templateParams: [{ type: String }],
    priority: { type: Number, default: 0 },
    status: { type: String, enum: MESSAGE_STATUS_VALUES, default: MESSAGE_STATUS.QUEUED },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    providerMessageId: { type: String, default: null },
    sendAfter: { type: Date, default: () => new Date() },
    lockedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

MessageOutboxSchema.index({ status: 1, sendAfter: 1, priority: -1, createdAt: 1 });
MessageOutboxSchema.index({ createdAt: -1 });
// Keep 60 days of delivery history.
MessageOutboxSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 });

export default mongoose.models.MessageOutbox || mongoose.model("MessageOutbox", MessageOutboxSchema);
