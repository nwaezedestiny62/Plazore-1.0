import Notification from "../models/Notification.js";
export const sendNotification = async ({ userId, type, title, message, orderId, orderNumber, conversationId, productId, productName, link, contactId, reportId, announcementId, }) => {
    try {
        if (!userId)
            return null;
        const base = {
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
        }
        catch (firstErr) {
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
    }
    catch (error) {
        console.error("Failed to send notification:", error);
        return null;
    }
};
