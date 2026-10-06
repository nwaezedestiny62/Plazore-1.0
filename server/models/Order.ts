import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  /** Listing region currency this line price was frozen in (product.region at checkout) */
  region: { type: String, default: "", trim: true, index: true },
  image: { type: String },
  note: {
    type: String,
    maxlength: 120,
    default: "",
  },
  /**
   * Set only by the backend at order creation when the authenticated buyer
   * is the same user as the product's seller. Never accept from the client.
   * Used to exclude self-purchases from Buyer Confidence / demand metrics.
   */
  isSellerOwnedPurchase: {
    type: Boolean,
    default: false,
    index: true,
  },
});

const orderSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    items: [orderItemSchema],

    buyerContact: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
    },

    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    },

    buyerNote: {
      type: String,
      maxlength: 120,
      default: "",
    },

    orderStatus: {
      type: String,
      enum: ["Preparing", "Shipped", "Delivered", "Cancelled"],
      default: "Preparing",
    },

    productShipping: {
      method: {
        type: String,
        enum: ["self", "courier"],
        default: "courier",
      },
      courierCompany: { type: String, default: "" },
      deliveryFee: { type: Number, default: 0 },
    },

    shipping: {
      shippingMethod: {
        type: String,
        enum: ["courier", "self"],
        default: "courier",
      },
      deliveryCompany: { type: String, default: "" },
      trackingNumber: { type: String, default: "" },
      estimatedDelivery: { type: Date },
      selfDeliveryNote: { type: String, default: "" },
      shippedAt: { type: Date },
    },

    cancellation: {
      cancelledBy: {
        type: String,
        enum: ["seller", "buyer", "admin", "system"],
      },
      reasonCode: {
        type: String,
        enum: [
          "out_of_stock",
          "unable_to_deliver",
          "shipping_limitations",
          "incorrect_inventory",
          "temporary_closure",
          "other",
        ],
      },
      reasonLabel: { type: String, default: "" },
      note: { type: String, maxlength: 200, default: "" },
      cancelledAt: { type: Date },
      refundStatus: {
        type: String,
        enum: ["not_applicable", "pending", "processed", "failed"],
        default: "not_applicable",
      },
    },

    /**
     * Primary currency region for this order's frozen amounts (product listing region).
     * Snapshot at createOrder — same semantics as product.region.
     */
    region: { type: String, default: "", trim: true, index: true },

    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "transfer", "pending", "paystack"],
      default: "pending",
    },

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
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
      index: true,
    },

    /** Frozen fee breakdown — platform fee is always 8% of subtotal */
    feeBreakdown: {
      subtotal: { type: Number, default: 0 },
      shippingCost: { type: Number, default: 0 },
      grossAmount: { type: Number, default: 0 },
      platformFeeRate: { type: Number, default: 0.08 },
      platformFee: { type: Number, default: 0 },
      sellerPayoutAmount: { type: Number, default: 0 },
      currency: { type: String, default: "NGN" },
    },

    stockReservation: {
      reserved: { type: Boolean, default: false },
      committed: { type: Boolean, default: false },
      released: { type: Boolean, default: false },
    },

    deliveredAt: { type: Date },

    // After seller marks Delivered — buyer confirms or 17h auto-confirm
    buyerConfirmation: {
      status: {
        type: String,
        enum: [
          "none",
          "pending",
          "confirmed",
          "issue_reported",
          "auto_confirmed",
        ],
        default: "none",
      },
      confirmedAt: { type: Date },
      issueReportedAt: { type: Date },
      issueContactId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ContactMessage",
        default: null,
      },
      /** Server-side deadline — set when seller marks Delivered (now + 17h) */
      confirmationDeadline: { type: Date, default: null },
    },

    // Payout gate (Paystack transfer)
    payout: {
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
      payoutDocId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payout",
        default: null,
      },
    },

    /**
     * True when the authenticated buyer is the same user as this order's seller.
     * Set only by the backend (createOrder). Because Plazore splits carts into
     * one Order document per seller, this is reliable at order level; items also
     * carry the same flag for future multi-item analytics.
     * Missing/false on legacy orders → treated as independent unless buyer===seller.
     */
    isSellerOwnedPurchase: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ "buyerConfirmation.status": 1 });
orderSchema.index({ "buyerConfirmation.confirmationDeadline": 1 });
orderSchema.index({ "payout.status": 1 });
orderSchema.index({ paymentLifecycle: 1 });
orderSchema.index({ seller: 1, isSellerOwnedPurchase: 1, orderStatus: 1 });

const Order = mongoose.model("Order", orderSchema);
export default Order;