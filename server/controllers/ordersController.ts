import { Request, Response } from "express";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Products.js";
import { sendNotification } from "../utils/sendNotification.js";

// Helper: Generate order number like PLZ#23467
const generateOrderNumber = () => {
  const random = Math.floor(10000 + Math.random() * 90000);
  return `PLZ#${random}`;
};

// ====================== CREATE ORDER ======================
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { shippingAddress, buyerNote, items: frontendItems } = req.body;

    console.log("Received body:", JSON.stringify(req.body, null, 2)); // debug

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required",
      });
    }

    // ========== GET ITEMS ==========
    let rawItems: any[] = [];

    if (frontendItems && Array.isArray(frontendItems) && frontendItems.length > 0) {
      console.log("Using frontend items");
      rawItems = frontendItems;
    } else {
      console.log("Trying database cart");
      const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Cart is empty",
        });
      }
      rawItems = cart.items.map((item: any) => ({
        productId: item.product._id,
        quantity: item.quantity,
        price: item.price,
      }));
    }

    if (rawItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    // ========== GROUP BY SELLER ==========
    const itemsBySeller: Record<string, any[]> = {};

    for (const item of rawItems) {
      const productId = item.productId || item.product;
      const product = await Product.findById(productId);

      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product not found or inactive: ${productId}`,
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
      }

      const sellerId = product.seller.toString();

      if (!itemsBySeller[sellerId]) {
        itemsBySeller[sellerId] = [];
      }

itemsBySeller[sellerId].push({
  product: product._id,
  name: product.name,
  quantity: item.quantity,
  price: item.price || product.price,
  image: product.images?.[0] || "",
  note: (item.note || "").trim().slice(0, 120),   // ← THIS LINE MUST BE THERE
});
    }

    const createdOrders = [];

    // ========== CREATE ONE ORDER PER SELLER ==========
    for (const sellerId of Object.keys(itemsBySeller)) {
      const sellerItems = itemsBySeller[sellerId];

      const subtotal = sellerItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      const order = await Order.create({
        buyer: req.user._id,
        seller: sellerId,
        orderNumber: `PLZ#${Math.floor(10000 + Math.random() * 90000)}`,
        items: sellerItems,
        shippingAddress,
        buyerNote: buyerNote || "",
        orderStatus: "Preparing",
        subtotal,
        shippingCost: 0,
        totalAmount: subtotal,
        paymentStatus: "pending",
        paymentMethod: "pending",
      });

      // Reduce stock
      for (const item of sellerItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity },
        });
      }

      // Notify seller
      await sendNotification({
        userId: sellerId,
        type: "new_order",
        title: "New Order Received",
        message: `A new order has been placed. Order: ${order.orderNumber}`,
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
      });

      createdOrders.push(order);
    }

    res.status(201).json({
      success: true,
      message: "Order(s) placed successfully",
      data: createdOrders,
    });
  } catch (error: any) {
    console.error("Create order error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ====================== BUYER: Get my orders ======================
// GET /api/orders
export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const orders = await Order.find({ buyer: req.user._id })
      .populate("seller", "name storeName storeLogo")
      .populate("items.product", "name images")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ====================== BUYER: Get single order ======================
// GET /api/orders/:id
export const getOrder = async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("seller", "name storeName storeLogo")
      .populate("buyer", "name email")
      .populate("items.product", "name images");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Only buyer, seller of this order, or admin can view
    const isBuyer = order.buyer._id.toString() === req.user._id.toString();
    const isSeller = order.seller._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ====================== SELLER: Get my orders ======================
// GET /api/orders/seller/my
export const getSellerOrders = async (req: Request, res: Response) => {
  try {
    const orders = await Order.find({ seller: req.user._id })
      .populate("buyer", "name email")
      .populate("items.product", "name images")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ====================== SELLER: Ship Order ======================
// PUT /api/orders/:id/ship
export const shipOrder = async (req: Request, res: Response) => {
  try {
    const {
      deliveryCompany,
      trackingNumber,
      estimatedDelivery,
      shippingMethod,
      selfDeliveryNote,
    } = req.body;

    console.log("SHIP BODY →", req.body); // important debug

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (
      order.seller.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (order.orderStatus !== "Preparing") {
      return res.status(400).json({
        success: false,
        message: `Order is already ${order.orderStatus}. Only Preparing orders can be shipped.`,
      });
    }

    // Force the correct method
    const method = shippingMethod === "self" ? "self" : "courier";

    order.orderStatus = "Shipped";
    order.shipping = {
      shippingMethod: method,
      deliveryCompany: method === "courier" ? (deliveryCompany || "") : "",
      trackingNumber: method === "courier" ? (trackingNumber || "") : "",
      estimatedDelivery: estimatedDelivery
        ? new Date(estimatedDelivery)
        : undefined,
      selfDeliveryNote: method === "self" ? (selfDeliveryNote || "") : "",
      shippedAt: new Date(),
    };

    await order.save();

    // Notify buyer
    await sendNotification({
      userId: order.buyer.toString(),
      type: "order_shipped",
      title: "Your Order Has Been Shipped",
      message: `Order ${order.orderNumber} is now on its way.`,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
    });

    res.json({ success: true, data: order });
  } catch (error: any) {
    console.error("Ship error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ====================== SELLER: Mark as Delivered ======================
// PUT /api/orders/:id/deliver
export const deliverOrder = async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.seller.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (order.orderStatus !== "Shipped") {
      return res.status(400).json({
        success: false,
        message: "Order must be Shipped before it can be marked as Delivered",
      });
    }

    order.orderStatus = "Delivered";
    order.deliveredAt = new Date();
    await order.save();

    // Notify the buyer
    await sendNotification({
      userId: order.buyer.toString(),
      type: "order_delivered",
      title: "Order Delivered",
      message: `Order ${order.orderNumber} has been delivered.`,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
    });

    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ====================== ADMIN: Get all orders ======================
// GET /api/orders/admin/all
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query: any = {};

    if (status) query.orderStatus = status;

    const total = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .populate("buyer", "name email")
      .populate("seller", "name storeName")
      .populate("items.product", "name")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};