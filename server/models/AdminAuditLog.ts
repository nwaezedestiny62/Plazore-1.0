import mongoose from "mongoose";

const adminAuditLogSchema = new mongoose.Schema(
  {
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorEmail: { type: String, default: "" },
    action: {
      type: String,
      required: true,
      index: true,
      // e.g. admin.invite.created, admin.invite.resent, admin.invite.revoked,
      // admin.invite.accepted, admin.member.deactivated, admin.member.role_changed
    },
    targetType: {
      type: String,
      enum: ["invitation", "membership", "user"],
      required: true,
    },
    targetId: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

adminAuditLogSchema.index({ createdAt: -1 });

const AdminAuditLog =
  mongoose.models.AdminAuditLog ||
  mongoose.model("AdminAuditLog", adminAuditLogSchema);

export default AdminAuditLog;