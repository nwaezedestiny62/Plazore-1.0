import mongoose from "mongoose";

/**
 * Keep enum in sync with server/utils/sendNotification.ts NotificationType
 */
export const NOTIFICATION_TYPES = [
  "new_order",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
  "order_reminder",
  "order_shipped_reminder",
  "confirm_delivery",
  "payment_released",
  "payment_pending_release",
  "ship_required",
  "showroom_refresh",
  "general",
  "contact_reply",
  "contact_need_info",
  "report_received",
  "report_update",
  "announcement",
  "chat_message",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

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
      enum: NOTIFICATION_TYPES,
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
    announcement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Announcement",
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    productName: {
      type: String,
      default: "",
    },
    link: { type: String, default: "" },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
