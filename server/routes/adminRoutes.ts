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
} from "../controllers/adminController.js";

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

export default AdminRouter;