import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  /**
   * Listing unit price frozen at checkout (server product.price).
   * Always in the currency of `region` / `currency` — never client-sent.
   */
  price: { type: Number, required: true },
  /**
   * Product listing region at checkout (e.g. NG, US, DE).
   * Same semantics as product.region.
   */
  region: {
    type: String,
    default: "",
    trim: true,
    uppercase: true,
    index: true,
  },
  /**
   * ISO 4217 for this line’s frozen price (from currencyForRegion(region)).
   */
  currency: {
    type: String,
    default: "",
    trim: true,
    uppercase: true,
    index: true,
  },
  image: { type: String },
  note: {
    type: String,
    maxlength: 120,
    default: "",
  },
  /**
   * Set only by the backend when buyer === product seller.
   * Never accept from the client.
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

    /** Listing region frozen at create (product.region). */
    region: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      index: true,
    },

    /**
     * ISO 4217 the buyer was / will be charged.
     * Set via currencyForRegion(region) at order create — never live FX.
     */
    currency: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      index: true,
    },

    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    /** paystack | stripe — set when payment is initialized */
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "transfer", "pending", "paystack", "stripe"],
      default: "pending",
    },

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

    /**
     * Frozen fee snapshot — all amounts in `currency`.
     * platformFeeRate always 0.08 (8% of subtotal only).
     */
    feeBreakdown: {
      subtotal: { type: Number, default: 0 },
      shippingCost: { type: Number, default: 0 },
      grossAmount: { type: Number, default: 0 },
      platformFeeRate: { type: Number, default: 0.08 },
      platformFee: { type: Number, default: 0 },
      sellerPayoutAmount: { type: Number, default: 0 },
      currency: { type: String, default: "NGN", uppercase: true },
      region: { type: String, default: "", uppercase: true },
    },

    stockReservation: {
      reserved: { type: Boolean, default: false },
      committed: { type: Boolean, default: false },
      released: { type: Boolean, default: false },
    },

    deliveredAt: { type: Date },

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
      confirmationDeadline: { type: Date, default: null },
    },

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
orderSchema.index({ region: 1, currency: 1 });
orderSchema.index({ currency: 1, paymentStatus: 1 });

const Order = mongoose.model("Order", orderSchema);
export default Order;
