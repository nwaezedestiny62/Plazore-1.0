import mongoose, { Schema } from "mongoose";

/**
 * Order-level payment/delivery dispute.
 * Separate from product/store Report model.
 */
const orderDisputeSchema = new Schema(
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
      default: null,
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

    reason: { type: String, required: true, maxlength: 500 },
    description: { type: String, default: "", maxlength: 4000 },

    status: {
      type: String,
      enum: [
        "open",
        "under_review",
        "resolved_buyer",
        "resolved_seller",
        "closed",
      ],
      default: "open",
      index: true,
    },

    resolution: {
      type: String,
      enum: ["REFUND_BUYER", "SETTLE_SELLER_FAVOUR", null],
      default: null,
    },
    resolutionNote: { type: String, default: "", maxlength: 2000 },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    /** Snapshot of money at dispute open time */
    amountPaid: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    currency: { type: String, default: "NGN" },
    paymentReference: { type: String, default: "" },

    refund: { type: Schema.Types.ObjectId, ref: "Refund", default: null },
    payout: { type: Schema.Types.ObjectId, ref: "Payout", default: null },

    events: [
      {
        at: { type: Date, default: Date.now },
        actor: { type: String, default: "" }, // buyer | seller | admin | system
        action: { type: String, default: "" },
        note: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

orderDisputeSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("OrderDispute", orderDisputeSchema);
