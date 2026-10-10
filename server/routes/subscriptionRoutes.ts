import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  getSellerPlans,
  getMySubscription,
  initiateSubscription,
  verifySubscription,
  activatePromo,
  activateFree,
  onboardingCompleteHook,
  adminSubscriptionsOverview,
  adminSetPromo,
  adminExpireOverdue,
} from "../controllers/subscriptionController.js";

const SubscriptionRouter = express.Router();

// ── Seller ─────────────────────────────────────────────
SubscriptionRouter.get(
  "/plans",
  protect,
  authorize("seller", "admin"),
  getSellerPlans
);

SubscriptionRouter.get(
  "/subscription",
  protect,
  authorize("seller", "admin"),
  getMySubscription
);

SubscriptionRouter.post(
  "/subscriptions/initiate",
  protect,
  authorize("seller", "admin"),
  initiateSubscription
);

SubscriptionRouter.post(
  "/subscriptions/verify",
  protect,
  authorize("seller", "admin"),
  verifySubscription
);

SubscriptionRouter.post(
  "/subscriptions/activate-promo",
  protect,
  authorize("seller", "admin"),
  activatePromo
);

SubscriptionRouter.post(
  "/subscriptions/activate-free",
  protect,
  authorize("seller", "admin"),
  activateFree
);

SubscriptionRouter.post(
  "/onboarding/complete-hook",
  protect,
  authorize("seller", "admin"),
  onboardingCompleteHook
);

export default SubscriptionRouter;

/** Mount admin routes on /api/admin */
export function mountAdminSubscriptionRoutes(adminRouter: express.Router) {
  adminRouter.get(
    "/subscriptions/overview",
    protect,
    authorize("admin"),
    adminSubscriptionsOverview
  );
  adminRouter.post(
    "/subscriptions/promo",
    protect,
    authorize("admin"),
    adminSetPromo
  );
  adminRouter.post(
    "/subscriptions/expire-overdue",
    protect,
    authorize("admin"),
    adminExpireOverdue
  );
}
