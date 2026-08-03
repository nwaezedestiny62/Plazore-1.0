import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  createOrder,
  getMyOrders,
  getOrder,
  getSellerOrders,
  shipOrder,
  deliverOrder,
  getAllOrders,
  cancelOrderBySeller, // ← import this from ordersController
} from "../controllers/ordersController.js";

const OrderRouter = express.Router();

// Specific paths FIRST (before /:id)
OrderRouter.post("/", protect, createOrder);
OrderRouter.get("/", protect, getMyOrders);
OrderRouter.get(
  "/seller/my",
  protect,
  authorize("seller", "admin"),
  getSellerOrders
);
OrderRouter.get("/admin/all", protect, authorize("admin"), getAllOrders);

// Param routes AFTER
OrderRouter.get("/:id", protect, getOrder);

OrderRouter.put(
  "/:id/ship",
  protect,
  authorize("seller", "admin"),
  shipOrder
);

OrderRouter.put(
  "/:id/deliver",
  protect,
  authorize("seller", "admin"),
  deliverOrder
);

// NEW — seller cancel
OrderRouter.put(
  "/:id/cancel",
  protect,
  authorize("seller", "admin"),
  cancelOrderBySeller
);

export default OrderRouter;