import mongoose from "mongoose";

/**
 * Display metadata only for cards.
 * Never store full PAN, CVV, or PIN.
 *
 * Paystack: stores authorization_code
 * Stripe:   stores PaymentMethod ID (pm_...) + Customer ID (cus_...)
 */
const PaymentMethodSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    brand: {
      type: String,
      enum: ["Visa", "Mastercard", "Verve", "Amex", "Other"],
      default: "Other",
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Display only — never full number
    last4: {
      type: String,
      required: true,
      minlength: 4,
      maxlength: 4,
    },
    expMonth: {
      type: String,
      required: true,
    },
    expYear: {
      type: String,
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },

    provider: {
      type: String,
      enum: ["paystack", "stripe", "manual"],
      default: "paystack",
      index: true,
    },

    // ===== Paystack tokenization =====
    paystackAuthorizationCode: {
      type: String,
      default: null,
      select: false,
    },
    paystackCustomerCode: { type: String, default: null },
    bin: { type: String, default: null },
    bank: { type: String, default: null },
    channel: { type: String, default: null },
    countryCode: { type: String, default: null },
    reusable: { type: Boolean, default: false },
    signature: { type: String, default: null },

    // ===== Stripe tokenization =====
    stripePaymentMethodId: {
      type: String,
      default: null,
      index: true,
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

PaymentMethodSchema.index({ user: 1, isDefault: 1 });
PaymentMethodSchema.index({ user: 1, provider: 1 });
PaymentMethodSchema.index({ user: 1, signature: 1 });

export default mongoose.model("PaymentMethod", PaymentMethodSchema);