import mongoose, { Schema } from "mongoose";

/**
 * Idempotency log for every Paystack webhook (and optional verify responses).
 * Unique on eventId prevents duplicate processing of the same webhook delivery.
 */
const paymentEventSchema = new Schema(
  {
    /** Paystack event id when present, else hash of reference+event+paid_at */
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    event: {
      type: String,
      required: true,
      index: true,
    },
    reference: {
      type: String,
      default: null,
      index: true,
    },
    payment: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
      index: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    /** Raw payload for audit (do not log secrets) */
    payload: { type: Schema.Types.Mixed, default: {} },
    processed: { type: Boolean, default: false, index: true },
    processedAt: { type: Date, default: null },
    processingError: { type: String, default: "" },
    signatureValid: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("PaymentEvent", paymentEventSchema);
