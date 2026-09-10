import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import { getPublicHero, getAdminContent, getAdminBannerSlot, saveAdminBannerDraft, publishAdminBanner, setAdminBannerActive, getAdminPersonalDiagnostics, } from "../controllers/contentController.js";
const ContentRouter = express.Router();
const adminOnly = [protect, authorize("admin")];
// Public hero resolution (auth optional — personalization if logged in)
ContentRouter.get("/hero", protect, getPublicHero);
// Allow anonymous with sessionId query (no auth required)
ContentRouter.get("/hero/public", getPublicHero);
// Admin content workspace
ContentRouter.get("/admin", ...adminOnly, getAdminContent);
ContentRouter.get("/admin/slots/:position", ...adminOnly, getAdminBannerSlot);
ContentRouter.put("/admin/slots/:position/draft", ...adminOnly, saveAdminBannerDraft);
ContentRouter.post("/admin/slots/:position/publish", ...adminOnly, publishAdminBanner);
ContentRouter.patch("/admin/slots/:position/active", ...adminOnly, setAdminBannerActive);
ContentRouter.get("/admin/diagnostics", ...adminOnly, getAdminPersonalDiagnostics);
export default ContentRouter;
