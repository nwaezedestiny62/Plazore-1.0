import Notification from "../models/Notification.js";

export type NotificationType =
  | "new_order"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled"
  | "order_reminder"
  | "order_shipped_reminder"
  | "general";

interface SendNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string;
  orderNumber?: string;
}

export const sendNotification = async ({
  userId,
  type,
  title,
  message,
  orderId,
  orderNumber,
}: SendNotificationParams) => {
  try {
    if (!userId) return;

    await Notification.create({
      user: userId,
      type,
      title,
      message,
      order: orderId || undefined,
      orderNumber: orderNumber || undefined,
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
};