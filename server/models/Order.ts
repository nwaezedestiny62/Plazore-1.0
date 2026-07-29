import mongoose from "mongoose";
import { IOrder } from "../types/index.js";

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
  note: {                         // ← MUST exist
    type: String,
    maxlength: 120,
    default: "",
  },
});

const orderSchema = new mongoose.Schema(
  {
    // Who bought
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Who is selling (one order = one seller)
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

    // Status flow: Preparing → Shipped → Delivered
    orderStatus: {
      type: String,
      enum: ["Preparing", "Shipped", "Delivered", "Cancelled"],
      default: "Preparing",
    },

    // Shipping info (filled when seller ships)
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

    // Money fields (ready for future payment)
    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },

    // Future payment fields (leave empty for now)
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
  },
  { timestamps: true }
);

// Indexes for performance
orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ orderNumber: 1 });

const Order = mongoose.model("Order", orderSchema);
export default Order;