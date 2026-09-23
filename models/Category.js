import mongoose from "mongoose";

const { Schema } = mongoose;

const CategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    color: { type: String, trim: true, default: "#10b981", match: /^#[0-9a-fA-F]{6}$/ },
    isActive: { type: Boolean, default: true },
    showAsTab: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

CategorySchema.index({ isActive: 1, sortOrder: 1 });

export default mongoose.models.Category || mongoose.model("Category", CategorySchema);
