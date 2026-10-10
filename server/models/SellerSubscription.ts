import mongoose, { Schema } from "mongoose";

/**
 * One active subscription document per seller (latest wins).
 * Paid plans activate only after server-side payment verification
 * (API verify OR webhook — never client-trusted alone).
 */
const sellerSubscriptionSchema = new Schema(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    planId: {
      type: String,
      enum: ["free", "dominant", "business_plus", "global_reach"],
      required: true,
      default: "free",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "pending_payment", "cancelled"],
      default: "active",
      index: true,
    },
    /** Business location country at activation — source of truth for currency */
    country: { type: String, required: true, uppercase: true, trim: true },
    currency: { type: String, required: true, uppercase: true, trim: true },
    amountPaid: { type: Number, default: 0 },
    paymentReference: { type: String, default: null, index: true },
    provider: {
      type: String,
      enum: ["paystack", "stripe", "promo", "system"],
      default: "system",
    },

    // ── Stripe-specific ──────────────────────────────────
    stripePaymentIntentId: { type: String, default: null, index: true },
    stripeClientSecret: { type: String, default: null, select: false },
    stripeChargeId: { type: String, default: null },

    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null, index: true },

    /** Promotional Dominant Niche (7 months free) */
    isPromotional: { type: Boolean, default: false },
    promoSlotNumber: { type: Number, default: null },
    promoExpiresAt: { type: Date, default: null },

    /** Snapshotted benefits at activation */
    transactionFeeRate: { type: Number, default: 0.08 },
    maxImagesPerProduct: { type: Number, default: 6 },

    /** Last verification source for audit */
    lastVerifiedAt: { type: Date, default: null },
    lastVerificationSource: {
      type: String,
      enum: ["api", "webhook", "promo", "system", null],
      default: null,
    },
  },
  { timestamps: true }
);

sellerSubscriptionSchema.index({ status: 1, expiresAt: 1 });
sellerSubscriptionSchema.index({ isPromotional: 1, promoSlotNumber: 1 });
sellerSubscriptionSchema.index({ paymentReference: 1, provider: 1 });

export default mongoose.model("SellerSubscription", sellerSubscriptionSchema);
