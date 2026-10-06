import mongoose, { Schema } from "mongoose";

const refundSchema = new Schema(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    payment: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /** Full or partial amount in major units */
    amount: { type: Number, required: true, min: 0 },
    amountMinor: { type: Number, required: true },
    currency: { type: String, required: true },

    status: {
      type: String,
      enum: ["pending", "processing", "processed", "failed", "needs_attention"],
      default: "pending",
      index: true,
    },

    reason: { type: String, default: "" },
    customerNote: { type: String, default: "" },
    merchantNote: { type: String, default: "" },

    /** Our reference */
    reference: { type: String, required: true, unique: true, index: true },
    /** Paystack refund id */
    providerRefundId: { type: String, default: null, index: true },
    /** Original payment reference */
    transactionReference: { type: String, required: true },

    initiatedBy: {
      type: String,
      enum: ["admin", "system", "seller_cancel"],
      default: "admin",
    },
    adminId: { type: Schema.Types.ObjectId, ref: "User", default: null },

    failureReason: { type: String, default: "" },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

refundSchema.index({ order: 1, status: 1 });

export default mongoose.model("Refund", refundSchema);
