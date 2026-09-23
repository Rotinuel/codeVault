import mongoose from "mongoose";

const { Schema } = mongoose;

const AuditLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    userEmail: { type: String, default: null },
    userRole: { type: String, default: null },
    action: { type: String, required: true, index: true },
    targetType: { type: String, default: null },
    targetId: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ user: 1, createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });

export default mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
