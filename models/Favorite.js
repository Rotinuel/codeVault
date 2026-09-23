import mongoose from "mongoose";

const { Schema } = mongoose;

const FavoriteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    betCode: { type: Schema.Types.ObjectId, ref: "BetCode", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

FavoriteSchema.index({ user: 1, betCode: 1 }, { unique: true });
FavoriteSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.Favorite || mongoose.model("Favorite", FavoriteSchema);
