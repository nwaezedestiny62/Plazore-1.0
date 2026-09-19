import { Request, Response } from "express";
import { clerkClient } from "@clerk/express";
import User from "../models/User.js";
import AdminMembership, {
  ADMIN_ROLES,
  type AdminRole,
} from "../models/AdminMembership.js";
import AdminInvitation from "../models/AdminInvitation.js";
import { generateInviteToken, hashInviteToken, inviteExpiry } from "../utils/adminTokens.js";
import { canAssignRole } from "../utils/adminPermissions.js";
import { writeAdminAudit } from "../utils/adminAudit.js";
import { sendAdminInviteEmail } from "../services/adminInviteEmail.js";

function adminWebBase() {
  return (
    process.env.ADMIN_WEB_URL ||
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** GET /api/admin/team */
export const listTeam = async (req: Request, res: Response) => {
  try {
    const members = await AdminMembership.find({ status: "active" })
      .sort({ createdAt: 1 })
      .lean();

    const pending = await AdminInvitation.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .lean();

    // Mark expired in response (and soft-update)
    const now = Date.now();
    const pendingOut = [];
    for (const inv of pending) {
      if (inv.expiresAt && new Date(inv.expiresAt).getTime() < now) {
        await AdminInvitation.updateOne(
          { _id: inv._id, status: "pending" },
          { $set: { status: "expired" } }
        );
        continue;
      }
      pendingOut.push({
        id: String(inv._id),
        name: inv.name,
        email: inv.email,
        role: inv.role,
        status: "pending",
        invitedAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        invitedByName: inv.invitedByName,
        invitedByEmail: inv.invitedByEmail,
        lastSentAt: inv.lastSentAt,
        sendCount: inv.sendCount,
      });
    }

    res.json({
      success: true,
      data: {
        administrators: members.map((m) => ({
          id: String(m._id),
          userId: String(m.userId),
          name: m.name,
          email: m.email,
          role: m.role,
          status: m.status,
          activatedAt: m.activatedAt || m.createdAt,
          lastActiveAt: m.lastActiveAt,
        })),
        invitations: pendingOut,
        roles: ADMIN_ROLES,
      },
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, message: e?.message || "Failed" });
  }
};

/** POST /api/admin/team/invitations */
export const createInvitation = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const ctx = (req as any).adminContext;
    const { name, email, role } = req.body || {};

    const inviteeName = String(name || "").trim();
    const inviteeEmail = String(email || "").toLowerCase().trim();
    const inviteRole = String(role || "").trim() as AdminRole;

    if (!inviteeName || inviteeName.length < 2) {
      return res.status(400).json({ success: false, message: "Full name is required" });
    }
    if (!isValidEmail(inviteeEmail)) {
      return res.status(400).json({ success: false, message: "Valid email is required" });
    }
    if (!ADMIN_ROLES.includes(inviteRole)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }
    if (!canAssignRole(ctx.role, inviteRole)) {
      return res.status(403).json({
        success: false,
        message: "You cannot assign this role",
      });
    }

    // Already an active admin?
    const existingMember = await AdminMembership.findOne({
      email: inviteeEmail,
      status: "active",
    });
    if (existingMember) {
      return res.status(409).json({
        success: false,
        message: "This email already has active administrator access",
      });
    }

    // Existing pending invite?
    const existingPending = await AdminInvitation.findOne({
      email: inviteeEmail,
      status: "pending",
    });
    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: "A pending invitation already exists for this email. Resend or revoke it.",
      });
    }

    const { raw, hash } = generateInviteToken();
    const expiresAt = inviteExpiry(7);

    const inv = await AdminInvitation.create({
      email: inviteeEmail,
      name: inviteeName,
      role: inviteRole,
      tokenHash: hash,
      status: "pending",
      invitedByUserId: actor._id,
      invitedByEmail: actor.email || ctx.email,
      invitedByName: actor.name || "Administrator",
      expiresAt,
      lastSentAt: new Date(),
      sendCount: 1,
    });

    const acceptUrl = `${adminWebBase()}/invite/accept?token=${encodeURIComponent(raw)}`;

    const mail = await sendAdminInviteEmail({
      to: inviteeEmail,
      inviteeName,
      inviterName: actor.name || "A Plazore administrator",
      role: inviteRole,
      acceptUrl,
      expiresAt,
    });

    await writeAdminAudit({
      actorUserId: String(actor._id),
      actorEmail: actor.email,
      action: "admin.invite.created",
      targetType: "invitation",
      targetId: String(inv._id),
      metadata: {
        email: inviteeEmail,
        role: inviteRole,
        emailSent: mail.sent,
      },
      req,
    });

    res.status(201).json({
      success: true,
      data: {
        id: String(inv._id),
        email: inviteeEmail,
        name: inviteeName,
        role: inviteRole,
        status: "pending",
        expiresAt,
        emailSent: mail.sent,
        emailError: mail.error || null,
        // Only expose accept URL when email could not be sent (ops visibility)
        acceptUrl: mail.sent ? undefined : acceptUrl,
      },
      message: mail.sent
        ? "Invitation created and email sent"
        : "Invitation created but email was not sent",
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, message: e?.message || "Failed" });
  }
};

/** POST /api/admin/team/invitations/:id/resend */
export const resendInvitation = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const inv = await AdminInvitation.findById(req.params.id);
    if (!inv || inv.status !== "pending") {
      return res.status(404).json({ success: false, message: "Pending invitation not found" });
    }
    if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) {
      inv.status = "expired";
      await inv.save();
      return res.status(410).json({ success: false, message: "Invitation has expired" });
    }

    const { raw, hash } = generateInviteToken();
    inv.tokenHash = hash;
    inv.lastSentAt = new Date();
    inv.sendCount = (inv.sendCount || 0) + 1;
    // extend expiry on resend
    inv.expiresAt = inviteExpiry(7);
    await inv.save();

    const acceptUrl = `${adminWebBase()}/invite/accept?token=${encodeURIComponent(raw)}`;
    const mail = await sendAdminInviteEmail({
      to: inv.email,
      inviteeName: inv.name,
      inviterName: actor.name || "A Plazore administrator",
      role: inv.role,
      acceptUrl,
      expiresAt: inv.expiresAt,
    });

    await writeAdminAudit({
      actorUserId: String(actor._id),
      actorEmail: actor.email,
      action: "admin.invite.resent",
      targetType: "invitation",
      targetId: String(inv._id),
      metadata: { email: inv.email, emailSent: mail.sent },
      req,
    });

    res.json({
      success: true,
      data: {
        id: String(inv._id),
        emailSent: mail.sent,
        emailError: mail.error || null,
        acceptUrl: mail.sent ? undefined : acceptUrl,
        expiresAt: inv.expiresAt,
      },
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, message: e?.message || "Failed" });
  }
};

/** POST /api/admin/team/invitations/:id/revoke */
export const revokeInvitation = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const inv = await AdminInvitation.findById(req.params.id);
    if (!inv || inv.status !== "pending") {
      return res.status(404).json({ success: false, message: "Pending invitation not found" });
    }
    inv.status = "revoked";
    inv.revokedAt = new Date();
    inv.revokedByUserId = actor._id;
    inv.tokenHash = hashInviteToken(`revoked-${inv._id}-${Date.now()}`);
    await inv.save();

    await writeAdminAudit({
      actorUserId: String(actor._id),
      actorEmail: actor.email,
      action: "admin.invite.revoked",
      targetType: "invitation",
      targetId: String(inv._id),
      metadata: { email: inv.email },
      req,
    });

    res.json({ success: true, message: "Invitation revoked" });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, message: e?.message || "Failed" });
  }
};

/** POST /api/admin/team/members/:id/deactivate */
export const deactivateMember = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const ctx = (req as any).adminContext;
    const membership = await AdminMembership.findById(req.params.id);
    if (!membership || membership.status !== "active") {
      return res.status(404).json({ success: false, message: "Active member not found" });
    }
    if (String(membership.userId) === String(actor._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own access",
      });
    }
    if (membership.role === "super_admin" && ctx.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can deactivate a Super Admin",
      });
    }

    membership.status = "deactivated";
    membership.deactivatedAt = new Date();
    membership.deactivatedByUserId = actor._id;
    await membership.save();

    // Drop marketplace admin flag so legacy authorize("admin") also fails
    await User.updateOne({ _id: membership.userId }, { $set: { role: "buyer" } });

    try {
      if (membership.clerkId) {
        await clerkClient.users.updateUserMetadata(membership.clerkId, {
          publicMetadata: { role: "buyer", plazoreAdmin: false },
        });
      }
    } catch {
      /* non-fatal */
    }

    await writeAdminAudit({
      actorUserId: String(actor._id),
      actorEmail: actor.email,
      action: "admin.member.deactivated",
      targetType: "membership",
      targetId: String(membership._id),
      metadata: { email: membership.email, role: membership.role },
      req,
    });

    res.json({ success: true, message: "Administrator deactivated" });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, message: e?.message || "Failed" });
  }
};

/**
 * GET /api/admin/team/invitations/preview?token=...
 * Public-ish: only needs protect (signed in). Used by accept page.
 * Does NOT consume the token.
 */
export const previewInvitation = async (req: Request, res: Response) => {
  try {
    const raw = String(req.query.token || "");
    if (!raw || raw.length < 20) {
      return res.status(400).json({ success: false, message: "Invalid token" });
    }
    const hash = hashInviteToken(raw);
    const inv = await AdminInvitation.findOne({ tokenHash: hash });
    if (!inv) {
      return res.status(404).json({ success: false, message: "Invitation not found" });
    }
    if (inv.status === "revoked") {
      return res.status(410).json({ success: false, message: "Invitation was revoked" });
    }
    if (inv.status === "accepted") {
      return res.status(410).json({ success: false, message: "Invitation already accepted" });
    }
    if (inv.status !== "pending") {
      return res.status(410).json({ success: false, message: "Invitation is no longer valid" });
    }
    if (inv.expiresAt.getTime() < Date.now()) {
      inv.status = "expired";
      await inv.save();
      return res.status(410).json({ success: false, message: "Invitation has expired" });
    }

    res.json({
      success: true,
      data: {
        name: inv.name,
        email: inv.email,
        role: inv.role,
        invitedByName: inv.invitedByName,
        expiresAt: inv.expiresAt,
      },
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, message: e?.message || "Failed" });
  }
};

/**
 * POST /api/admin/team/invitations/accept
 * Body: { token }
 * Auth: protect (signed-in Clerk user). Email MUST match invite email.
 */
export const acceptInvitation = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const raw = String(req.body?.token || "");
    if (!raw || raw.length < 20) {
      return res.status(400).json({ success: false, message: "Invalid token" });
    }

    const hash = hashInviteToken(raw);
    const inv = await AdminInvitation.findOne({ tokenHash: hash });
    if (!inv) {
      return res.status(404).json({ success: false, message: "Invitation not found" });
    }
    if (inv.status === "revoked") {
      return res.status(410).json({ success: false, message: "Invitation was revoked" });
    }
    if (inv.status === "accepted") {
      return res.status(410).json({ success: false, message: "Invitation already accepted" });
    }
    if (inv.status !== "pending") {
      return res.status(410).json({ success: false, message: "Invitation is no longer valid" });
    }
    if (inv.expiresAt.getTime() < Date.now()) {
      inv.status = "expired";
      await inv.save();
      return res.status(410).json({ success: false, message: "Invitation has expired" });
    }

    const authEmail = String(user.email || "").toLowerCase().trim();
    if (!authEmail || authEmail !== inv.email) {
      return res.status(403).json({
        success: false,
        message: `This invitation must be accepted while signed in as ${inv.email}. You are signed in as ${authEmail || "unknown"}.`,
      });
    }

    // Already active?
    const existing = await AdminMembership.findOne({
      userId: user._id,
      status: "active",
    });
    if (existing) {
      inv.status = "accepted";
      inv.acceptedAt = new Date();
      inv.acceptedByUserId = user._id;
      inv.tokenHash = hashInviteToken(`used-${inv._id}-${Date.now()}`);
      await inv.save();
      return res.json({
        success: true,
        message: "You already have administrator access",
        data: { membershipId: String(existing._id) },
      });
    }

    // Activate membership
    const membership = await AdminMembership.create({
      userId: user._id,
      clerkId: user.clerkId || "",
      email: inv.email,
      name: inv.name || user.name || "",
      role: inv.role,
      status: "active",
      invitedByUserId: inv.invitedByUserId,
      invitationId: inv._id,
      activatedAt: new Date(),
      lastActiveAt: new Date(),
    });

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          role: "admin",
          name: inv.name || user.name,
        },
      }
    );

    try {
      if (user.clerkId) {
        await clerkClient.users.updateUserMetadata(user.clerkId, {
          publicMetadata: {
            role: "admin",
            plazoreAdmin: true,
            plazoreAdminRole: inv.role,
          },
        });
      }
    } catch {
      /* non-fatal */
    }

    inv.status = "accepted";
    inv.acceptedAt = new Date();
    inv.acceptedByUserId = user._id;
    inv.tokenHash = hashInviteToken(`used-${inv._id}-${Date.now()}`);
    await inv.save();

    await writeAdminAudit({
      actorUserId: String(user._id),
      actorEmail: user.email,
      action: "admin.invite.accepted",
      targetType: "invitation",
      targetId: String(inv._id),
      metadata: {
        membershipId: String(membership._id),
        role: inv.role,
        email: inv.email,
      },
      req,
    });

    res.json({
      success: true,
      message: "Invitation accepted. Administrator access is active.",
      data: {
        membershipId: String(membership._id),
        role: membership.role,
      },
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, message: e?.message || "Failed" });
  }
};