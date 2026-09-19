import mongoose from "mongoose";
import { ADMIN_ROLES } from "./AdminMembership.js";

const adminInvitationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ADMIN_ROLES,
      required: true,
    },
    extraPermissions: [{ type: String }],
    /** SHA-256 of the raw token — never store raw token */
    tokenHash: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked", "expired"],
      default: "pending",
      index: true,
    },
    invitedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    invitedByEmail: { type: String, default: "" },
    invitedByName: { type: String, default: "" },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date, default: null },
    acceptedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    revokedAt: { type: Date, default: null },
    revokedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastSentAt: { type: Date, default: Date.now },
    sendCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

adminInvitationSchema.index(
  { email: 1, status: 1 },
  { partialFilterExpression: { status: "pending" } }
);

const AdminInvitation =
  mongoose.models.AdminInvitation ||
  mongoose.model("AdminInvitation", adminInvitationSchema);

export default AdminInvitation;