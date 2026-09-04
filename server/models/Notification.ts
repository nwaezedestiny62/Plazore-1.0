import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "new_order",
        "order_shipped",
        "order_delivered",
        "order_cancelled",
        "order_reminder",
        "order_shipped_reminder",
        "general",
        "contact_reply",
"contact_need_info",
"report_received",
"report_update",
"announcement",
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

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },

    orderNumber: {
      type: String,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: "ContactMessage" },
report: { type: mongoose.Schema.Types.ObjectId, ref: "Report" },
announcement: { type: mongoose.Schema.Types.ObjectId, ref: "Announcement" },
link: { type: String, default: "" },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;