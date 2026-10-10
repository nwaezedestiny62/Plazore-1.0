import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import { clerkMiddleware } from "@clerk/express";
import { clerkWebhook } from "./controllers/webhooks.js";
import makeAdmin from "./scripts/makeAdmin.js";

import ProductRouter from "./routes/productsRoutes.js";
import CartRouter from "./routes/cartRoutes.js";
import ContentRouter from "./routes/contentRoutes.js";
import AdminTeamRouter from "./routes/adminTeamRoutes.js";
import OrderRouter from "./routes/ordersRoutes.js";
import AddressRouter from "./routes/addressRoutes.js";
import CurrencyRouter from "./routes/currencyRoutes.js";
import AdminRouter from "./routes/adminRoutes.js";
import { startBuyerConfidenceScheduler } from "./services/jobs/refreshBuyerConfidence.js";
import SellerRouter from "./routes/sellerRoutes.js";
import NotificationRouter from "./routes/notificationRoutes.js";
import UserRouter from "./routes/userRoutes.js";
import WishlistRouter from "./routes/wishlistRoutes.js";
import AnalyticsRouter from "./routes/analyticsRoutes.js";
import AIRouter from "./routes/aiRoutes.js";
import ChatRouter from "./routes/chatRoutes.js";
import SavedStoreRouter from "./routes/savedStoreRoutes.js";
import PaymentMethodRouter from "./routes/paymentMethodRoutes.js";
import ModerationRouter from "./routes/moderationRoutes.js";
import AnnouncementRouter from "./routes/announcementRoutes.js";
import { telemetryMiddleware } from "./middleware/telemetry.js";
import ContactRouter from "./routes/contactRoutes.js";

// Payment architecture (Paystack + Stripe)
import PaymentRouter from "./routes/paymentRoutes.js";
import { paystackWebhook } from "./controllers/paymentController.js";
import { stripeWebhook } from "./controllers/stripeWebhookController.js";
import { startAutoConfirmDeliveryScheduler } from "./services/jobs/autoConfirmDelivery.js";
import { startPayoutScheduler } from "./services/jobs/processEligiblePayouts.js";
import { startAbandonedPaymentScheduler } from "./services/jobs/releaseAbandonedPayments.js";

// Seller subscriptions (Paystack + Stripe plan payments)
import SubscriptionRouter, {
  mountAdminSubscriptionRoutes,
} from "./routes/subscriptionRoutes.js";
import { startSubscriptionExpiryScheduler } from "./services/jobs/expireSubscriptions.js";

const app = express();

await connectDB();

// ============================================
// WEBHOOKS THAT NEED RAW BODY
// Must stay BEFORE express.json()
// ============================================

// Clerk webhook
app.post(
  "/api/clerk",
  express.raw({ type: "application/json" }),
  clerkWebhook
);

// Paystack webhook — raw body for HMAC signature verification
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    (req as any).rawBody = req.body;
    try {
      if (Buffer.isBuffer(req.body)) {
        req.body = JSON.parse(req.body.toString("utf8"));
      }
    } catch {
      // handler will fail safely
    }
    next();
  },
  paystackWebhook
);

// Stripe webhook — raw body for signature verification
app.post(
  "/api/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    (req as any).rawBody = req.body; // keep raw Buffer for constructEvent
    next();
  },
  stripeWebhook
);

// ============================================
// NORMAL MIDDLEWARE
// ============================================
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(clerkMiddleware());

const port = process.env.PORT || 3000;

app.get("/api/test", (req: Request, res: Response) => {
  console.log("✅ PUBLIC /api/test route hit!");
  res.json({ success: true, message: "Backend is reachable!" });
});

app.get("/api", (req: Request, res: Response) => {
  res.json({ success: true, message: "Root API endpoint working" });
});

app.get("/", (req: Request, res: Response) => {
  res.send("Server is Live!");
});

// ============================================
// ROUTES
// ============================================
app.use("/api/products", ProductRouter);
app.use("/api/cart", CartRouter);
app.use("/api/orders", OrderRouter);
app.use("/api/addresses", AddressRouter);
app.use("/api/admin", AdminRouter);
app.use("/api/seller", SellerRouter);
// Seller plans / subscriptions (mounted under /api/seller)
// → GET  /api/seller/plans
// → GET  /api/seller/subscription
// → POST /api/seller/subscriptions/initiate
// → POST /api/seller/subscriptions/verify
// → POST /api/seller/subscriptions/activate-promo
// → POST /api/seller/subscriptions/activate-free
// → POST /api/seller/onboarding/complete-hook
app.use("/api/seller", SubscriptionRouter);
app.use("/api/notifications", NotificationRouter);
app.use("/api/users", UserRouter);
app.use("/api/wishlist", WishlistRouter);
app.use("/api/analytics", AnalyticsRouter);
app.use("/api/ai", AIRouter);
app.use("/api/chat", ChatRouter);
app.use("/api/saved-stores", SavedStoreRouter);
app.use("/api/payment-methods", PaymentMethodRouter);
app.use("/api/payments", PaymentRouter);
app.use("/api/contact", ContactRouter);
app.use("/api/content", ContentRouter);
app.use("/api/announcements", AnnouncementRouter);
app.use("/api/currency", CurrencyRouter);
app.use("/api/admin/team", AdminTeamRouter);
app.use(telemetryMiddleware);

// Single moderation mount (covers /me + admin actions)
app.use("/api/moderation", ModerationRouter);

// Admin subscription routes on AdminRouter:
// → GET  /api/admin/subscriptions/overview
// → POST /api/admin/subscriptions/promo
// → POST /api/admin/subscriptions/expire-overdue
mountAdminSubscriptionRoutes(AdminRouter);

await makeAdmin();

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  startBuyerConfidenceScheduler();
  startAutoConfirmDeliveryScheduler();
  startPayoutScheduler();
  startAbandonedPaymentScheduler(); // stock release for abandoned payments
  startSubscriptionExpiryScheduler(); // downgrade expired seller plans → Free
});