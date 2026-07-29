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

// Buyer
OrderRouter.post("/", protect, createOrder);
OrderRouter.get("/", protect, getMyOrders);
OrderRouter.get("/:id", protect, getOrder);

// Seller
OrderRouter.get("/seller/my", protect, authorize("seller", "admin"), getSellerOrders);
OrderRouter.put("/:id/ship", protect, authorize("seller", "admin"), shipOrder);
OrderRouter.put("/:id/deliver", protect, authorize("seller", "admin"), deliverOrder);

// Admin
OrderRouter.get("/admin/all", protect, authorize("admin"), getAllOrders);

export default OrderRouter;