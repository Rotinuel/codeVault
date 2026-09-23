import mongoose from "mongoose";
import {
  BET_RESULT,
  BET_RESULT_VALUES,
  BETCODE_STATUS,
  BETCODE_STATUS_VALUES,
  DEFAULT_TIMEZONE,
  MAX_ACCESS_LEVEL,
} from "../lib/constants.js";

const { Schema } = mongoose;

const BetCodeSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    // The protected value. Never serialised for users below `accessLevel`.
    code: { type: String, required: true, trim: true, maxlength: 120 },
    bookmaker: { type: String, trim: true, maxlength: 60, default: "" },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    analysis: { type: String, trim: true, maxlength: 5000, default: "" },
    totalOdds: { type: Number, min: 1, default: null },
    category: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    // 0 = free for any registered user; otherwise the minimum plan access level.
    accessLevel: { type: Number, required: true, min: 0, max: MAX_ACCESS_LEVEL, default: 1 },
    status: { type: String, enum: BETCODE_STATUS_VALUES, default: BETCODE_STATUS.DRAFT },
    publishAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    timezone: { type: String, default: DEFAULT_TIMEZONE },
    isFeatured: { type: Boolean, default: false },
    result: { type: String, enum: BET_RESULT_VALUES, default: BET_RESULT.PENDING },
    notifyOnRelease: { type: Boolean, default: true },
    notifiedAt: { type: Date, default: null },
    viewCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    batchId: { type: String, default: null },
  },
  { timestamps: true }
);

// Main user-facing query: visible statuses, by level, ordered by release time.
BetCodeSchema.index({ status: 1, accessLevel: 1, publishAt: -1 });
BetCodeSchema.index({ status: 1, publishAt: 1 });
BetCodeSchema.index({ status: 1, expiresAt: 1 });
BetCodeSchema.index({ category: 1, publishAt: -1 });
BetCodeSchema.index({ notifiedAt: 1, status: 1 });
BetCodeSchema.index({ title: "text", code: "text", description: "text" });

export default mongoose.models.BetCode || mongoose.model("BetCode", BetCodeSchema);
