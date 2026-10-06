import mongoose, { Schema } from "mongoose";
import type { PaymentLifecycle, PaymentProvider, PaymentStatus } from "../types/payment.js";

/**
 * One Payment document per Order (1:1).
 * Backend is source of truth. Never trust client for amount/status.
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
      enum: ["paystack", "manual", "none"] as PaymentProvider[],
      default: "paystack",
    },

    /** Our internal reference — unique, used as Paystack reference when possible */
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    /** Paystack transaction id (numeric string) after success */
    providerTransactionId: { type: String, default: null, index: true },

    /** Amount buyer must pay (major units). Frozen at initialize. */
    amount: { type: Number, required: true, min: 0 },
    /** Same amount in smallest currency unit (kobo etc.) sent to Paystack */
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "NGN" },

    /** Fee snapshot at payment time */
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

    /** Paystack authorization_url from initialize */
    authorizationUrl: { type: String, default: null },
    accessCode: { type: String, default: null },

    /** Channel used (card, bank, ussd, etc.) — from verify */
    channel: { type: String, default: null },
    gatewayResponse: { type: String, default: null },
    paidAt: { type: Date, default: null },

    /** Optional saved authorization for future charges (tokenized) */
    authorizationCode: { type: String, default: null },
    cardLast4: { type: String, default: null },
    cardBrand: { type: String, default: null },
    cardExpMonth: { type: String, default: null },
    cardExpYear: { type: String, default: null },
    reusable: { type: Boolean, default: false },

    metadata: { type: Schema.Types.Mixed, default: {} },

    /** Prevent double-processing of success */
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

export default mongoose.model("Payment", paymentSchema);
