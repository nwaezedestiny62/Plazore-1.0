import mongoose from "mongoose";

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
    // Only last 4 digits — never store full number
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
    // Ready for Stripe later
    stripePaymentMethodId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

PaymentMethodSchema.index({ user: 1, isDefault: 1 });

export default mongoose.model("PaymentMethod", PaymentMethodSchema);