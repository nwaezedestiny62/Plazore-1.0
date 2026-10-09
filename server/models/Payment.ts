import mongoose, { Schema } from "mongoose";
import type {
  PaymentLifecycle,
  PaymentProvider,
  PaymentStatus,
} from "../types/payment.js";

/**
 * One Payment document per Order (1:1).
 * Backend is source of truth. Never trust client for amount/status.
 * Supports both Paystack and Stripe under the same document.
 */
const paymentSchema = new Schema(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    provider: {
      type: String,
      enum: ["paystack", "stripe", "manual", "none"] as PaymentProvider[],
      default: "paystack",
      index: true,
    },

    /** Our internal reference — unique across providers */
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    /** Provider-specific transaction / intent ID */
    providerTransactionId: { type: String, default: null, index: true },

    // ===== Stripe-specific fields =====
    /** Stripe PaymentIntent ID (pi_...) */
    stripePaymentIntentId: { type: String, default: null, index: true },
    /** Stripe Charge ID (ch_...) after success */
    stripeChargeId: { type: String, default: null },
    /** Stripe Customer ID (cus_...) if used */
    stripeCustomerId: { type: String, default: null },
    /** client_secret returned to frontend for Stripe Elements / Payment Sheet */
    stripeClientSecret: { type: String, default: null, select: false },

    // ===== Amounts (frozen at initialize) =====
    amount: { type: Number, required: true, min: 0 },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "NGN" },

    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, required: true, default: 0 },
    platformFee: { type: Number, required: true },
    platformFeeRate: { type: Number, required: true, default: 0.08 },
    sellerPayoutAmount: { type: Number, required: true },

    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "success",
        "failed",
        "abandoned",
        "reversed",
      ] as PaymentStatus[],
      default: "pending",
      index: true,
    },

    lifecycle: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "PAYMENT_PROCESSING",
        "PAYMENT_VERIFIED",
        "PAYMENT_PROTECTED",
        "PROCESSING_ORDER",
        "SHIPPED",
        "DELIVERED",
        "DELIVERY_CONFIRMED",
        "SELLER_PAYOUT_PENDING",
        "SELLER_PAID",
        "REFUND_PENDING",
        "REFUNDED",
        "DISPUTED",
        "SETTLED_SELLER_FAVOUR",
        "PAYMENT_FAILED",
        "CANCELLED",
      ] as PaymentLifecycle[],
      default: "PENDING_PAYMENT",
      index: true,
    },

    // Paystack fields (kept for compatibility)
    authorizationUrl: { type: String, default: null },
    accessCode: { type: String, default: null },

    channel: { type: String, default: null },
    gatewayResponse: { type: String, default: null },
    paidAt: { type: Date, default: null },

    // Tokenized / saved method info (provider-agnostic display)
    authorizationCode: { type: String, default: null },
    cardLast4: { type: String, default: null },
    cardBrand: { type: String, default: null },
    cardExpMonth: { type: String, default: null },
    cardExpYear: { type: String, default: null },
    reusable: { type: Boolean, default: false },

    metadata: { type: Schema.Types.Mixed, default: {} },

    verifiedAt: { type: Date, default: null },
    verificationSource: {
      type: String,
      enum: ["api", "webhook", "manual", null],
      default: null,
    },

    failureReason: { type: String, default: "" },
  },
  { timestamps: true }
);

paymentSchema.index({ status: 1, lifecycle: 1 });
paymentSchema.index({ buyer: 1, createdAt: -1 });
paymentSchema.index({ seller: 1, createdAt: -1 });
paymentSchema.index({ provider: 1, status: 1 });
paymentSchema.index({ stripePaymentIntentId: 1 }, { sparse: true });

export default mongoose.model("Payment", paymentSchema);