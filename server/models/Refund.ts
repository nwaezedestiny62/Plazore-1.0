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

    /** paystack | stripe */
    provider: {
      type: String,
      enum: ["paystack", "stripe"],
      default: "paystack",
      index: true,
    },

    /** Gateway refund id (re_… / Paystack id) */
    providerRefundId: { type: String, default: null, index: true },

    /** Original payment reference / PaymentIntent id */
    transactionReference: { type: String, required: true },

    initiatedBy: {
      type: String,
      enum: ["admin", "system", "seller_cancel"],
      default: "admin",
    },
    adminId: { type: Schema.Types.ObjectId, ref: "User", default: null },

    failureReason: { type: String, default: "" },
    processedAt: { type: Date, default: null },

    /** Webhook-confirmed final status payload snippet */
    gatewayPayload: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

refundSchema.index({ order: 1, status: 1 });
refundSchema.index({ provider: 1, status: 1 });
refundSchema.index({ providerRefundId: 1 });

export default mongoose.model("Refund", refundSchema);
