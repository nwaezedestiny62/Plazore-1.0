import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  getDashboardStats,
  getAdminUsers,
  getAdminUserDetail,
  getAdminProducts,
  setSellerSuspended,
  setSellerVerified,
  setProductActive,
  getAdminOrders,
  getAdminOrderDetail,
  getAdminContacts,
  getAdminContactDetail,
  updateAdminContact,
  getAdminReports,
  updateAdminReport,
  pingPresence,
} from "../controllers/adminController.js";
import {
  getAdminShowroom,
  refreshAdminShowroom,
  getAdminIntelligence,
  getAdminIntelligenceDetail,
  regenerateAdminIntelligence,
  getAdminAnalytics,
} from "../controllers/adminObservabilityController.js";

const AdminRouter = express.Router();

const adminOnly = [protect, authorize("admin")] as const;

AdminRouter.get("/stats", ...adminOnly, getDashboardStats);

AdminRouter.get("/users", ...adminOnly, getAdminUsers);
AdminRouter.get("/users/:id", ...adminOnly, getAdminUserDetail);
AdminRouter.patch("/sellers/:id/suspend", ...adminOnly, setSellerSuspended);
AdminRouter.patch("/sellers/:id/verify", ...adminOnly, setSellerVerified);

AdminRouter.get("/products", ...adminOnly, getAdminProducts);
AdminRouter.patch("/products/:id/active", ...adminOnly, setProductActive);

AdminRouter.get("/orders", ...adminOnly, getAdminOrders);
AdminRouter.get("/orders/:id", ...adminOnly, getAdminOrderDetail);

AdminRouter.get("/contacts", ...adminOnly, getAdminContacts);
AdminRouter.get("/contacts/:id", ...adminOnly, getAdminContactDetail);
AdminRouter.patch("/contacts/:id", ...adminOnly, updateAdminContact);

AdminRouter.get("/reports", ...adminOnly, getAdminReports);
AdminRouter.patch("/reports/:id", ...adminOnly, updateAdminReport);

AdminRouter.get("/showroom", ...adminOnly, getAdminShowroom);
AdminRouter.post("/showroom/refresh", ...adminOnly, refreshAdminShowroom);

AdminRouter.get("/intelligence", ...adminOnly, getAdminIntelligence);
AdminRouter.get("/intelligence/:productId", ...adminOnly, getAdminIntelligenceDetail);
AdminRouter.post("/intelligence/:productId/regenerate", ...adminOnly, regenerateAdminIntelligence);

AdminRouter.get("/analytics", ...adminOnly, getAdminAnalytics);

// Any logged-in user (not admin-only) — used by web + mobile to record last seen
AdminRouter.post("/me/presence", protect, pingPresence);

export default AdminRouter;