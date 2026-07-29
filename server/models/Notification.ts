import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    // Who should receive this notification
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Type of notification
    type: {
      type: String,
      enum: [
        "new_order",           // Seller gets this when buyer places order
        "order_shipped",       // Buyer gets this when seller ships
        "order_delivered",     // Buyer gets this
        "order_reminder",      // Seller reminder (Preparing too long)
        "order_shipped_reminder", // Seller reminder (Shipped too long)
        "general",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    // Optional: link to a specific order
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },

    orderNumber: {
      type: String, // e.g. PLZ#23467 (for easy display)
    },

    // Has the user read it?
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for fast queries
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;