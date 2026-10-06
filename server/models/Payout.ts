import mongoose, { Schema } from "mongoose";

/**
 * Seller payout record. One active payout attempt chain per order.
 * Prevents double transfer via unique order + status machine.
 */
const payoutSchema = new Schema(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },
    payment: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    grossAmount: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    platformFeeRate: { type: Number, required: true, default: 0.08 },
    shippingCost: { type: Number, required: true, default: 0 },
    subtotal: { type: Number, required: true },
    /** Final amount transferred to seller */
    amount: { type: Number, required: true, min: 0 },
    amountMinor: { type: Number, required: true },
    currency: { type: String, required: true, default: "NGN" },

    status: {
      type: String,
      enum: [
        "queued",
        "initiated",
        "success",
        "failed",
        "reversed",
        "cancelled",
      ],
      default: "queued",
      index: true,
    },

    /** Our unique transfer reference */
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    /** Paystack transfer recipient code */
    recipientCode: { type: String, default: null },
    /** Paystack transfer code / id */
    providerTransferCode: { type: String, default: null },
    providerTransferId: { type: String, default: null },

    bankSnapshot: {
      bankName: { type: String, default: "" },
      accountName: { type: String, default: "" },
      accountNumberLast4: { type: String, default: "" },
      // Never store full account number long-term if avoidable; snapshot for audit
      accountNumber: { type: String, default: "" },
    },

    failureReason: { type: String, default: "" },
    initiatedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    /** Who triggered: system job | admin settle | manual */
    triggeredBy: {
      type: String,
      enum: ["system", "admin", "manual"],
      default: "system",
    },
    adminId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

payoutSchema.index({ seller: 1, status: 1, createdAt: -1 });
payoutSchema.index({ status: 1, createdAt: 1 });

export default mongoose.model("Payout", payoutSchema);
