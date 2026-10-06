import mongoose from "mongoose";

/**
 * REPLACE existing models/PaymentMethod.ts with this version.
 *
 * Changes:
 * - Adds Paystack authorization fields (tokenized — never store PAN/CVV)
 * - Keeps last4 / brand / exp for display only
 * - Removes stripe placeholder; uses paystackAuthorizationCode
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
      enum: ["Visa", "Mastercard", "Verve", "Other"],
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
    expMonth: { type: String, required: true },
    expYear: { type: String, required: true },
    isDefault: { type: Boolean, default: false },

    // ===== Paystack tokenization (from successful charge authorization) =====
    provider: {
      type: String,
      enum: ["paystack", "manual"],
      default: "paystack",
    },
    /** Paystack authorization_code — used for charge_authorization on return customers */
    paystackAuthorizationCode: {
      type: String,
      default: null,
      select: false, // do not leak in normal queries
    },
    paystackCustomerCode: { type: String, default: null },
    bin: { type: String, default: null },
    bank: { type: String, default: null },
    channel: { type: String, default: null },
    countryCode: { type: String, default: null },
    reusable: { type: Boolean, default: false },
    signature: { type: String, default: null }, // Paystack signature for uniqueness

    // Legacy Stripe field — keep null for migration safety
    stripePaymentMethodId: { type: String, default: null },
  },
  { timestamps: true }
);

PaymentMethodSchema.index({ user: 1, isDefault: 1 });
PaymentMethodSchema.index({ user: 1, signature: 1 });

export default mongoose.model("PaymentMethod", PaymentMethodSchema);
