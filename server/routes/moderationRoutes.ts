import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  getModerationStats,
  listModerationCases,
  searchModerationAccounts,
  getModerationProfile,
  requestActivityCheck,
  pardonAccount,
  suspendAccount,
  blockAccount,
  liftRestriction,
  addModerationNote,
  getMyModeration,
  clearLastOutcome,
} from "../controllers/moderationController.js";

const router = express.Router();
const adminOnly = [protect, authorize("admin")] as const;

// Platform (authenticated user)
router.get("/me", protect, getMyModeration);
router.post("/me/clear-outcome", protect, clearLastOutcome);

// Admin
router.get("/stats", ...adminOnly, getModerationStats);
router.get("/cases", ...adminOnly, listModerationCases);
router.get("/search", ...adminOnly, searchModerationAccounts);
router.get("/users/:id", ...adminOnly, getModerationProfile);
router.post("/users/:id/activity-check", ...adminOnly, requestActivityCheck);
router.post("/users/:id/pardon", ...adminOnly, pardonAccount);
router.post("/users/:id/suspend", ...adminOnly, suspendAccount);
router.post("/users/:id/block", ...adminOnly, blockAccount);
router.post("/users/:id/lift", ...adminOnly, liftRestriction);
router.post("/cases/:caseId/notes", ...adminOnly, addModerationNote);

export default router;