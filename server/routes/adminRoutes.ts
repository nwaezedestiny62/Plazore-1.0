import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import { getDashboardStats } from "../controllers/adminController.js";

const AdminRouter = express.Router();

// Get admin dashboard statistics
// GET /api/admin/stats
AdminRouter.get(
  "/stats",
  protect,
  authorize("admin"),
  getDashboardStats
);

export default AdminRouter;