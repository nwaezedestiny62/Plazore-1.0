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

export default OrderRouter;