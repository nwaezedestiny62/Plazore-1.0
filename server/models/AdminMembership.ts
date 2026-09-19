import mongoose from "mongoose";

export const ADMIN_ROLES = [
  "super_admin",
  "operations_admin",
  "moderation_admin",
  "marketing_admin",
  "finance_admin",
  "support_admin",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  "team.manage",
  "team.view",
  "moderation.manage",
  "content.manage",
  "marketing.manage",
  "finance.view",
  "finance.manage",
  "support.manage",
  "orders.manage",
  "users.manage",
  "analytics.view",
  "system.manage",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/** Default permission sets per role — enforced server-side only */
export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: [...ADMIN_PERMISSIONS],
  operations_admin: [
    "team.view",
    "orders.manage",
    "users.manage",
    "analytics.view",
    "support.manage",
  ],
  moderation_admin: ["moderation.manage", "users.manage", "analytics.view"],
  marketing_admin: ["content.manage", "marketing.manage", "analytics.view"],
  finance_admin: ["finance.view", "finance.manage", "orders.manage", "analytics.view"],
  support_admin: ["support.manage", "orders.manage", "users.manage"],
};

const adminMembershipSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    clerkId: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    name: { type: String, trim: true, default: "" },
    role: {
      type: String,
      enum: ADMIN_ROLES,
      required: true,
      default: "support_admin",
    },
    /** Optional extras on top of role defaults — never trust client blindly */
    extraPermissions: [{ type: String }],
    status: {
      type: String,
      enum: ["active", "deactivated"],
      default: "active",
      index: true,
    },
    invitedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    invitationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminInvitation",
      default: null,
    },
    activatedAt: { type: Date, default: Date.now },
    deactivatedAt: { type: Date, default: null },
    deactivatedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastActiveAt: { type: Date, default: null },
  },
  { timestamps: true }
);

adminMembershipSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

const AdminMembership =
  mongoose.models.AdminMembership ||
  mongoose.model("AdminMembership", adminMembershipSchema);

export default AdminMembership;