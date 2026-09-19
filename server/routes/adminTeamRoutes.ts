import express from "express";
import { protect } from "../middleware/auth.js";
import {
  requireAdminAccess,
  requireAdminPermission,
} from "../middleware/adminAccess.js";
import {
  listTeam,
  createInvitation,
  resendInvitation,
  revokeInvitation,
  deactivateMember,
  previewInvitation,
  acceptInvitation,
} from "../controllers/adminTeamController.js";

const router = express.Router();

const teamManage = [
  protect,
  requireAdminAccess,
  requireAdminPermission("team.manage"),
] as const;

const teamView = [
  protect,
  requireAdminAccess,
  requireAdminPermission("team.view"),
] as const;

// Accept flow: authenticated user, not necessarily admin yet
router.get("/invitations/preview", protect, previewInvitation);
router.post("/invitations/accept", protect, acceptInvitation);

router.get("/", ...teamView, listTeam);
router.post("/invitations", ...teamManage, createInvitation);
router.post("/invitations/:id/resend", ...teamManage, resendInvitation);
router.post("/invitations/:id/revoke", ...teamManage, revokeInvitation);
router.post("/members/:id/deactivate", ...teamManage, deactivateMember);

export default router;