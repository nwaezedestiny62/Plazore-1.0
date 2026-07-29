import { Request, Response } from "express";
import User from "../models/User.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
import { clerkClient } from "@clerk/express";

// Apply to become a seller
export const applyAsSeller = async (req: Request, res: Response) => {
  try {
    const { storeName, storeDescription } = req.body;

    if (!storeName) {
      return res
        .status(400)
        .json({ success: false, message: "Store name is required" });
    }

if (req.user.role === "seller" || req.user.role === "admin") {
  return res
    .status(400)
    .json({ success: false, message: "You are already a seller or admin" });
}

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        role: "seller",
        storeName,
        storeDescription: storeDescription || "",
        sellerAppliedAt: new Date(),
        isSellerVerified: false, // admin can verify later
      },
      { new: true }
    );

    // Sync to Clerk publicMetadata
    await clerkClient.users.updateUserMetadata(user!.clerkId, {
      publicMetadata: { role: "seller" },
    });

    res.json({
      success: true,
      message: "You are now a seller! Waiting for verification.",
      data: user,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Seller dashboard stats (only own data)
export const getSellerDashboard = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user._id;

    const totalProducts = await Product.countDocuments({ seller: sellerId });
    const activeProducts = await Product.countDocuments({
      seller: sellerId,
      isActive: true,
    });

    // Orders that contain at least one of this seller's items
    const orders = await Order.find({
      "items.seller": sellerId,
    }).sort({ createdAt: -1 });

    const totalOrders = orders.length;

    let totalRevenue = 0;
    orders.forEach((order) => {
      order.items.forEach((item: any) => {
        if (item.seller.toString() === sellerId.toString()) {
          totalRevenue += item.price * item.quantity;
        }
      });
    });

    const recentOrders = orders.slice(0, 5);

    res.json({
      success: true,
      data: {
        totalProducts,
        activeProducts,
        totalOrders,
        totalRevenue,
        recentOrders,
        storeName: req.user.storeName,
        isVerified: req.user.isSellerVerified,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get seller's own products
export const getMyProducts = async (req: Request, res: Response) => {
  try {
    const products = await Product.find({ seller: req.user._id }).sort({
      createdAt: -1,
    });
    res.json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get seller's orders (only items belonging to them)
export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const orders = await Order.find({ "items.seller": req.user._id })
      .populate("user", "name email")
      .populate("items.product", "name images")
      .sort({ createdAt: -1 });

    // Filter items to only this seller's items (optional, for cleaner UI)
    const filtered = orders.map((order) => {
      const sellerItems = order.items.filter(
        (item: any) => item.seller.toString() === req.user._id.toString()
      );
      return {
        ...order.toObject(),
        items: sellerItems,
      };
    });

    res.json({ success: true, data: filtered });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update order status for seller's items
export const updateMyOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderStatus } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Check if this seller has items in the order
    const hasItems = order.items.some(
      (item: any) => item.seller.toString() === req.user._id.toString()
    );

    if (!hasItems && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (orderStatus) order.orderStatus = orderStatus;
    if (orderStatus === "delivered") order.deliveredAt = new Date();

    await order.save();
    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};