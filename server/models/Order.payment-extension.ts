/**
 * ORDER MODEL EXTENSION — merge these fields into existing models/Order.ts
 *
 * Do NOT replace the whole Order.ts file blindly.
 * Add the fields below into the existing orderSchema definition.
 * Keep all existing fields (items, shippingAddress, productShipping, etc.).
 */

/*
--- ADD to orderSchema ---

    // ========== PAYMENT LIFECYCLE (Paystack-ready) ==========
    paymentLifecycle: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "PAYMENT_PROCESSING",
        "PAYMENT_VERIFIED",
        "PAYMENT_PROTECTED",
        "PROCESSING_ORDER",
        "SHIPPED",
        "DELIVERED",
        "DELIVERY_CONFIRMED",
        "SELLER_PAYOUT_PENDING",
        "SELLER_PAID",
        "REFUND_PENDING",
        "REFUNDED",
        "DISPUTED",
        "SETTLED_SELLER_FAVOUR",
        "PAYMENT_FAILED",
        "CANCELLED",
      ],
      default: "PENDING_PAYMENT",
      index: true,
    },

    paymentRef: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
      index: true,
    },

    // Frozen fee breakdown at order/payment time (source of truth for admin & seller)
    feeBreakdown: {
      subtotal: { type: Number, default: 0 },
      shippingCost: { type: Number, default: 0 },
      grossAmount: { type: Number, default: 0 },
      platformFeeRate: { type: Number, default: 0.08 },
      platformFee: { type: Number, default: 0 },
      sellerPayoutAmount: { type: Number, default: 0 },
      currency: { type: String, default: "NGN" },
    },

    // Extend existing buyerConfirmation
    // buyerConfirmation.status already has: none | pending | confirmed | issue_reported
    // ADD:
    //   auto_confirmed (for 17h job)
    //   confirmationDeadline: Date  (set when seller marks Delivered)

    // Extend existing payout block:
    // payout.status already has: not_eligible | awaiting_buyer | eligible | blocked_issue | initiated | completed | refunded
    // ADD: queued | failed
    // payout.amount, payout.platformFee, payout.reference, payout.payoutRef (ObjectId)

    stockReservation: {
      reserved: { type: Boolean, default: false },
      committed: { type: Boolean, default: false },
      released: { type: Boolean, default: false },
    },
*/

/** Recommended full buyerConfirmation shape after merge: */
export const buyerConfirmationShape = {
  status: {
    type: String,
    enum: ["none", "pending", "confirmed", "issue_reported", "auto_confirmed"],
    default: "none",
  },
  confirmedAt: { type: Date },
  issueReportedAt: { type: Date },
  issueContactId: {
    type: "ObjectId" as any,
    ref: "ContactMessage",
    default: null,
  },
  /** Set when seller marks Delivered — 17 hours from this moment */
  confirmationDeadline: { type: Date, default: null },
};

/** Recommended full payout shape after merge: */
export const payoutShape = {
  status: {
    type: String,
    enum: [
      "not_eligible",
      "awaiting_buyer",
      "eligible",
      "blocked_issue",
      "queued",
      "initiated",
      "completed",
      "failed",
      "refunded",
    ],
    default: "not_eligible",
  },
  eligibleAt: { type: Date },
  blockedReason: { type: String, default: "" },
  amount: { type: Number, default: null },
  platformFee: { type: Number, default: null },
  reference: { type: String, default: null },
  payoutDocId: { type: "ObjectId" as any, ref: "Payout", default: null },
};

/**
 * Also update paymentStatus enum if needed:
 * existing: pending | paid | failed | refunded
 * keep as-is for compatibility; paymentLifecycle is the richer state.
 */
