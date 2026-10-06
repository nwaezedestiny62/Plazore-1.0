import mongoose, { Schema } from "mongoose";

/**
 * Immutable audit trail for every money-related action.
 * Append-only: never update or delete rows in production.
 */
const paymentAuditLogSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", index: true },
    payment: { type: Schema.Types.ObjectId, ref: "Payment", index: true },
    payout: { type: Schema.Types.ObjectId, ref: "Payout", index: true },
    refund: { type: Schema.Types.ObjectId, ref: "Refund", index: true },
    dispute: { type: Schema.Types.ObjectId, ref: "OrderDispute", index: true },

    action: {
      type: String,
      required: true,
      index: true,
      // e.g. payment.initialized, payment.verified, payout.initiated,
      // payout.completed, refund.created, dispute.opened, dispute.resolved_buyer
    },
    actorType: {
      type: String,
      enum: ["buyer", "seller", "admin", "system", "webhook"],
      required: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },

    fromLifecycle: { type: String, default: null },
    toLifecycle: { type: String, default: null },
    amount: { type: Number, default: null },
    currency: { type: String, default: null },
    reference: { type: String, default: null },
    note: { type: String, default: "" },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

paymentAuditLogSchema.index({ order: 1, createdAt: 1 });
paymentAuditLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model("PaymentAuditLog", paymentAuditLogSchema);
