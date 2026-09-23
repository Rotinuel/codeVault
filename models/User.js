import mongoose from "mongoose";
import { ROLE_VALUES, ROLES, USER_STATUS, USER_STATUS_VALUES } from "../lib/constants.js";

const { Schema } = mongoose;

const NotificationPrefsSchema = new Schema(
  {
    whatsapp: { type: Boolean, default: true },
    betCodes: { type: Boolean, default: true },
    payments: { type: Boolean, default: true },
    subscription: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 160,
    },
    phone: { type: String, trim: true, maxlength: 20, default: null },
    // Always stored as a bcrypt hash. Excluded from queries unless explicitly selected.
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLE_VALUES, default: ROLES.USER, index: true },
    status: { type: String, enum: USER_STATUS_VALUES, default: USER_STATUS.ACTIVE, index: true },
    statusReason: { type: String, maxlength: 300, default: null },
    // Pointer to the most recent subscription. Access checks always re-validate
    // against the Subscription collection (status + dates), never this pointer alone.
    subscription: { type: Schema.Types.ObjectId, ref: "Subscription", default: null },
    notificationPrefs: { type: NotificationPrefsSchema, default: () => ({}) },
    // Incremented to invalidate every issued JWT (password change, role change, ban, logout-all).
    tokenVersion: { type: Number, default: 0, select: false },
    resetPasswordTokenHash: { type: String, select: false, default: null },
    resetPasswordExpires: { type: Date, select: false, default: null },
    lastLoginAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

UserSchema.index({ createdAt: -1 });
UserSchema.index({ name: "text", email: "text", phone: "text" });

UserSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.password;
    delete ret.tokenVersion;
    delete ret.resetPasswordTokenHash;
    delete ret.resetPasswordExpires;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.models.User || mongoose.model("User", UserSchema);
