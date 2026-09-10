import Notification from "../models/Notification.js";
export const getMyNotifications = async (req, res) => {
    try {
        const userId = req.user._id;
        const notifications = await Notification.find({
            user: userId,
        })
            .populate("product", "name images")
            .populate("conversation", "product buyer seller lastMessage")
            .sort({ createdAt: -1 })
            .limit(80)
            .lean();
        res.json({
            success: true,
            data: notifications,
            meta: {
                count: notifications.length,
                userId: String(userId),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true }, { new: true });
        if (!notification) {
            return res
                .status(404)
                .json({ success: false, message: "Notification not found" });
        }
        res.json({ success: true, data: notification });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
        res.json({ success: true, message: "All notifications marked as read" });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
