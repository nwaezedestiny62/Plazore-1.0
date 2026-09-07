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
  image: { type: String },
  note: {
    type: String,
    maxlength: 120,
    default: "",
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
      enum: ["cash", "card", "transfer", "pending"],
      default: "pending",
    },

    deliveredAt: { type: Date },

    // After seller marks Delivered — buyer must confirm or report issue
    buyerConfirmation: {
      status: {
        type: String,
        enum: ["none", "pending", "confirmed", "issue_reported"],
        default: "none",
      },
      confirmedAt: { type: Date },
      issueReportedAt: { type: Date },
      issueContactId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ContactMessage",
        default: null,
      },
    },

    // Payout gate (Paystack transfer comes later)
    payout: {
      status: {
        type: String,
        enum: [
          "not_eligible",
          "awaiting_buyer",
          "eligible",
          "blocked_issue",
          "initiated",
          "completed",
          "refunded",
        ],
        default: "not_eligible",
      },
      eligibleAt: { type: Date },
      blockedReason: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ "buyerConfirmation.status": 1 });
orderSchema.index({ "payout.status": 1 });

const Order = mongoose.model("Order", orderSchema);
export default Order;