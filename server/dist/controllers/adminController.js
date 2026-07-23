import User from "../models/User.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
// Get dashboard stats
// GET /api/admin/stats
export const getDashboardStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalProducts = await Product.countDocuments();
        const totalOrders = await Order.countDocuments();
        // Calculate revenue from non-cancelled orders
        const validOrders = await Order.find({
            orderStatus: { $ne: "cancelled" }
        });
        const totalRevenue = validOrders.reduce((sum, order) => {
            return sum + (order.totalAmount || 0);
        }, 0);
        // Get recent orders with user info
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("user", "name email");
        res.json({
            success: true,
            data: {
                totalUsers,
                totalProducts,
                totalOrders,
                totalRevenue,
                recentOrders,
            },
        });
    }
    catch (error) {
        console.error("Dashboard stats error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Server error while fetching dashboard stats",
        });
    }
};
