import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  applyAsSeller,
  getSellerDashboard,
  getMyProducts,
  getMyOrders,
  updateMyOrderStatus,
} from "../controllers/sellerController.js";
import {
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import upload from "../middleware/upload.js";

const SellerRouter = express.Router();

// ====================== BECOME A SELLER ======================
SellerRouter.post("/apply", protect, authorize("buyer"), applyAsSeller);

// ====================== DASHBOARD ======================
SellerRouter.get(
  "/dashboard",
  protect,
  authorize("seller", "admin"),
  getSellerDashboard
);

// ====================== PRODUCTS ======================
SellerRouter.get(
  "/products",
  protect,
  authorize("seller", "admin"),
  getMyProducts
);

// ★ THIS WAS MISSING ★
SellerRouter.post(
  "/products",
  protect,
  authorize("seller", "admin"),
  upload.array("images", 5),
  createProduct
);

SellerRouter.put(
  "/products/:id",
  protect,
  authorize("seller", "admin"),
  upload.array("images", 5),
  updateProduct
);

SellerRouter.delete(
  "/products/:id",
  protect,
  authorize("seller", "admin"),
  deleteProduct
);

// ====================== ORDERS ======================
SellerRouter.get(
  "/orders",
  protect,
  authorize("seller", "admin"),
  getMyOrders
);

SellerRouter.put(
  "/orders/:id/status",
  protect,
  authorize("seller", "admin"),
  updateMyOrderStatus
);

export default SellerRouter;