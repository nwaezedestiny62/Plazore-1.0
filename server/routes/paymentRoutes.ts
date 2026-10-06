import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  getPaymentConfig,
  checkoutAndPay,
  initializePayment,
  verifyPayment,
  getPaymentForOrder,
  openDispute,
  adminRefundBuyer,
  adminSettleSeller,
} from "../controllers/paymentController.js";

const PaymentRouter = express.Router();

// Public config (public key only)
PaymentRouter.get("/config", getPaymentConfig);

// Buyer checkout + pay
PaymentRouter.post("/checkout", protect, checkoutAndPay);
PaymentRouter.post("/initialize", protect, initializePayment);
PaymentRouter.post("/verify", protect, verifyPayment);

// Order payment status
PaymentRouter.get("/order/:orderId", protect, getPaymentForOrder);

// Disputes
PaymentRouter.post("/disputes/:orderId/open", protect, openDispute);
PaymentRouter.post(
  "/admin/disputes/:orderId/refund-buyer",
  protect,
  authorize("admin"),
  adminRefundBuyer
);
PaymentRouter.post(
  "/admin/disputes/:orderId/settle-seller",
  protect,
  authorize("admin"),
  adminSettleSeller
);

export default PaymentRouter;
