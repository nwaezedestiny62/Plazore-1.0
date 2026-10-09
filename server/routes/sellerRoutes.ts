import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import { requireSellerAccess } from "../middleware/moderationGuard.js";
import {
  applyAsSeller,
  getSellerDashboard,
  getMyProducts,
  getMyOrders,
  updateMyOrderStatus,
  getMyStore,
  updateMyStore,
  getPublicStorefront,
  verifyPayoutAccess,
  getOnboardingStatus,
  completeSellerOnboarding,
  completeBusinessLocation,
  updateBusinessLocation,
} from "../controllers/sellerController.js";
import {
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import {
  getSellerPlans,
  getMySubscription,
  initiateSubscription,
  verifySubscription,
  activatePromo,
  activateFree,
  onboardingCompleteHook,
} from "../controllers/subscriptionController.js";
import upload from "../middleware/upload.js";

const SellerRouter = express.Router();

SellerRouter.post("/apply", protect, authorize("buyer"), applyAsSeller);

// ——— Seller onboarding (must complete before dashboard) ———
SellerRouter.get(
  "/onboarding-status",
  protect,
  authorize("seller", "admin"),
  getOnboardingStatus
);

SellerRouter.post(
  "/onboarding/complete",
  protect,
  authorize("seller", "admin"),
  completeSellerOnboarding
);

SellerRouter.post(
  "/business-location",
  protect,
  authorize("seller", "admin"),
  completeBusinessLocation
);

SellerRouter.put(
  "/business-location",
  protect,
  authorize("seller", "admin"),
  updateBusinessLocation
);

// Promo slot claim after onboarding (does not auto-switch plan)
SellerRouter.post(
  "/onboarding/promo-claim",
  protect,
  authorize("seller", "admin"),
  onboardingCompleteHook
);

// ——— Subscriptions (business-location currency, not browse region) ———
SellerRouter.get(
  "/plans",
  protect,
  authorize("seller", "admin"),
  getSellerPlans
);

SellerRouter.get(
  "/subscription",
  protect,
  authorize("seller", "admin"),
  getMySubscription
);

SellerRouter.post(
  "/subscriptions/initiate",
  protect,
  authorize("seller", "admin"),
  initiateSubscription
);

SellerRouter.post(
  "/subscriptions/verify",
  protect,
  authorize("seller", "admin"),
  verifySubscription
);

SellerRouter.post(
  "/subscriptions/activate-promo",
  protect,
  authorize("seller", "admin"),
  activatePromo
);

SellerRouter.post(
  "/subscriptions/activate-free",
  protect,
  authorize("seller", "admin"),
  activateFree
);

SellerRouter.get(
  "/dashboard",
  protect,
  authorize("seller", "admin"),
  requireSellerAccess,
  getSellerDashboard
);

SellerRouter.get(
  "/store",
  protect,
  authorize("seller", "admin"),
  requireSellerAccess,
  getMyStore
);

SellerRouter.put(
  "/store",
  protect,
  authorize("seller", "admin"),
  requireSellerAccess,
  upload.fields([
    { name: "storeLogo", maxCount: 1 },
    { name: "storeBanner", maxCount: 1 },
  ]),
  updateMyStore
);

SellerRouter.post(
  "/store/verify-payout",
  protect,
  authorize("seller", "admin"),
  requireSellerAccess,
  verifyPayoutAccess
);

SellerRouter.get("/store/:id", getPublicStorefront);

SellerRouter.get(
  "/products",
  protect,
  authorize("seller", "admin"),
  requireSellerAccess,
  getMyProducts
);

SellerRouter.post(
  "/products",
  protect,
  authorize("seller", "admin"),
  requireSellerAccess,
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
  requireSellerAccess,
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
  requireSellerAccess,
  deleteProduct
);

SellerRouter.get(
  "/orders",
  protect,
  authorize("seller", "admin"),
  requireSellerAccess,
  getMyOrders
);

SellerRouter.put(
  "/orders/:id/status",
  protect,
  authorize("seller", "admin"),
  requireSellerAccess,
  updateMyOrderStatus
);

export default SellerRouter;