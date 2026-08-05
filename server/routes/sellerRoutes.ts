import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  applyAsSeller,
  getSellerDashboard,
  getMyProducts,
  getMyOrders,
  updateMyOrderStatus,
  getMyStore,
  updateMyStore,
  getPublicStorefront,
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

// ====================== MY STORE ======================
SellerRouter.get("/store", protect, authorize("seller", "admin"), getMyStore);

SellerRouter.put(
  "/store",
  protect,
  authorize("seller", "admin"),
  upload.fields([
    { name: "storeLogo", maxCount: 1 },
    { name: "storeBanner", maxCount: 1 },
  ]),
  updateMyStore
);

// ====================== PUBLIC STOREFRONT ======================
SellerRouter.get("/store/:id", getPublicStorefront);

// ====================== PRODUCTS ======================
SellerRouter.get(
  "/products",
  protect,
  authorize("seller", "admin"),
  getMyProducts
);

SellerRouter.post(
  "/products",
  protect,
  authorize("seller", "admin"),
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "documents", maxCount: 5 },
  ]),
  createProduct
);

SellerRouter.put(
  "/products/:id",
  protect,
  authorize("seller", "admin"),
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "documents", maxCount: 5 },
  ]),
  updateProduct
);

SellerRouter.delete(
  "/products/:id",
  protect,
  authorize("seller", "admin"),
  deleteProduct
);

// ====================== ORDERS ======================
SellerRouter.get("/orders", protect, authorize("seller", "admin"), getMyOrders);

SellerRouter.put(
  "/orders/:id/status",
  protect,
  authorize("seller", "admin"),
  updateMyOrderStatus
);

export default SellerRouter;