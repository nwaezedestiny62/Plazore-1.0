import Notification from "../models/Notification.js";

type NotificationType =
  | "new_order"
  | "order_shipped"
  | "order_delivered"
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
    await Notification.create({
      user: userId,
      type,
      title,
      message,
      order: orderId,
      orderNumber,
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
};