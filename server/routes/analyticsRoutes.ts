import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  trackEvent,
  getSellerAnalytics,
  getProductAnalytics,
} from "../controllers/analyticsController.js";

const AnalyticsRouter = express.Router();

AnalyticsRouter.post("/track", protect, trackEvent);
AnalyticsRouter.get(
  "/seller",
  protect,
  authorize("seller", "admin"),
  getSellerAnalytics
);
AnalyticsRouter.get(
  "/seller/product/:id",
  protect,
  authorize("seller", "admin"),
  getProductAnalytics
);

export default AnalyticsRouter;