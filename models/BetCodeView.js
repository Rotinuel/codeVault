import mongoose from "mongoose";

const { Schema } = mongoose;

// One document per (user, bet code) the first time a user opens/copies a code.
const BetCodeViewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    betCode: { type: Schema.Types.ObjectId, ref: "BetCode", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

BetCodeViewSchema.index({ user: 1, betCode: 1 }, { unique: true });
BetCodeViewSchema.index({ createdAt: -1 });

export default mongoose.models.BetCodeView || mongoose.model("BetCodeView", BetCodeViewSchema);
