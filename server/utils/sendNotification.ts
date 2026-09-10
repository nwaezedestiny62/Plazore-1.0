import Notification from "../models/Notification.js";

export type NotificationType =
  | "new_order"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled"
  | "order_reminder"
  | "order_shipped_reminder"
  | "general"
  | "contact_reply"
  | "contact_need_info"
  | "report_received"
  | "report_update"
  | "announcement"
  | "chat_message";

interface SendNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string;
  orderNumber?: string;
  conversationId?: string;
  productId?: string;
  productName?: string;
  link?: string;
  contactId?: string;
  reportId?: string;
  announcementId?: string;
}

export const sendNotification = async ({
  userId,
  type,
  title,
  message,
  orderId,
  orderNumber,
  conversationId,
  productId,
  productName,
  link,
  contactId,
  reportId,
  announcementId,
}: SendNotificationParams) => {
  try {
    if (!userId) return null;

    const base: Record<string, any> = {
      user: userId,
      type,
      title,
      message,
      order: orderId || undefined,
      orderNumber: orderNumber || undefined,
      conversation: conversationId || undefined,
      product: productId || undefined,
      productName: productName || undefined,
      link: link || "",
      contact: contactId || undefined,
      report: reportId || undefined,
      announcement: announcementId || undefined,
      isRead: false,
    };

    try {
      return await Notification.create(base);
    } catch (firstErr: any) {
      // Schema not yet updated with chat_message — still deliver as general + link
      if (type === "chat_message") {
        return await Notification.create({
          ...base,
          type: "general",
          link: link || (conversationId ? `/chat/${conversationId}` : ""),
        });
      }
      console.error("Failed to send notification:", firstErr);
      return null;
    }
  } catch (error) {
    console.error("Failed to send notification:", error);
    return null;
  }
};