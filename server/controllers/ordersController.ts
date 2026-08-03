import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Products.js";
import User from "../models/User.js";
import { sendNotification } from "../utils/sendNotification.js";
import { trackProductPerformance } from "../utils/performance.js";

const getUser = (req: Request) => (req as any).user;

const CANCEL_REASONS: Record<string, string> = {
  out_of_stock: "Product is out of stock",
  unable_to_deliver: "Unable to deliver to the destination",
  shipping_limitations: "Shipping limitations",
  incorrect_inventory: "Incorrect inventory",
  temporary_closure: "Temporary business closure",
  other: "Other",
};

function hasShipFromLocation(product: any, seller: any): boolean {
  const fl = product?.fulfillmentLocation;
  if (fl && (fl.city || fl.state) && fl.country) return true;

  const addr = seller?.shippingDefaults?.address;
  if (addr && (addr.city || addr.state) && addr.country) return true;

  return false;
}

// ====================== CREATE ORDER ======================
export const createOrder = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { shippingAddress, buyerNote, items: frontendItems, phone } =
      req.body;

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required",
      });
    }

    let rawItems: any[] = [];

    if (
      frontendItems &&
      Array.isArray(frontendItems) &&
      frontendItems.length > 0
    ) {
      rawItems = frontendItems;
    } else {
      const cart = await Cart.findOne({ user: user._id }).populate(
        "items.product"
      );
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Cart is empty",
        });
      }
      rawItems = cart.items.map((item: any) => ({
        productId: item.product?._id || item.product,
        quantity: item.quantity,
        price: item.price,
        note: item.note || "",
      }));
    }

    if (rawItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    const itemsBySeller: Record<string, any[]> = {};
    const shippingBySeller: Record<
      string,
      { method: "self" | "courier"; courierCompany: string; deliveryFee: number }
    > = {};

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

      const sellerUser = await User.findById(sellerId)
        .select("storeName shippingDefaults")
        .lean();

      if (!hasShipFromLocation(product, sellerUser)) {
        return res.status(400).json({
          success: false,
          message:
            "This seller has not completed their shipping information yet. Please try again later.",
        });
      }

      if (!itemsBySeller[sellerId]) itemsBySeller[sellerId] = [];

      itemsBySeller[sellerId].push({
        product: product._id,
        name: product.name,
        quantity: item.quantity,
        price: item.price ?? product.price,
        image: product.images?.[0] || "",
        note: String(item.note || "")
          .trim()
          .slice(0, 120),
      });

      const method =
        (product as any).shipping?.method === "self" ? "self" : "courier";
      const fee = Number((product as any).shipping?.deliveryFee) || 0;
      const company = String(
        (product as any).shipping?.courierCompany || ""
      ).trim();

      if (!shippingBySeller[sellerId]) {
        shippingBySeller[sellerId] = {
          method,
          courierCompany: company,
          deliveryFee: fee,
        };
      } else if (fee > shippingBySeller[sellerId].deliveryFee) {
        shippingBySeller[sellerId] = {
          method,
          courierCompany: company,
          deliveryFee: fee,
        };
      }
    }

    const createdOrders = [];
    const contactPhone = String(phone || user.phone || "").trim();

    for (const sellerId of Object.keys(itemsBySeller)) {
      const sellerItems = itemsBySeller[sellerId];
      const snap = shippingBySeller[sellerId];

      const subtotal = sellerItems.reduce(
        (sum, row) => sum + row.price * row.quantity,
        0
      );
      const shippingCost = snap?.deliveryFee || 0;

      const order = await Order.create({
        buyer: user._id,
        seller: sellerId,
        orderNumber: `PLZ#${Math.floor(10000 + Math.random() * 90000)}`,
        items: sellerItems,
        shippingAddress,
        buyerNote: buyerNote || "",
        buyerContact: {
          name: user.name || "",
          phone: contactPhone,
        },
        productShipping: {
          method: snap?.method || "courier",
          courierCompany: snap?.courierCompany || "",
          deliveryFee: shippingCost,
        },
        orderStatus: "Preparing",
        subtotal,
        shippingCost,
        totalAmount: subtotal + shippingCost,
        paymentStatus: "pending",
        paymentMethod: "pending",
      });

      // Stock decrease
      for (const row of sellerItems) {
        await Product.findByIdAndUpdate(row.product, {
          $inc: { stock: -row.quantity },
        });
      }

      // ★ PERFORMANCE: successful checkout = +15 × quantity per product
      for (const row of sellerItems) {
        trackProductPerformance({
          productId: String(row.product),
          action: "purchase",
          actorUserId: user._id.toString(),
          quantity: row.quantity || 1,
        }).catch(() => {});
      }

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

    // Clear cart after successful order (optional but usual)
    try {
      const cart = await Cart.findOne({ user: user._id });
      if (cart) {
        cart.items = [];
        (cart as any).totalAmount = 0;
        await cart.save();
      }
    } catch {
      // non-fatal
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
export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);

    const orders = await Order.find({ buyer: user._id })
      .populate("seller", "name storeName storeLogo")
      .populate("items.product", "name images")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ====================== Get single order ======================
export const getOrder = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { id } = req.params;

    if (!id || !mongoose.isValidObjectId(String(id))) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const order = await Order.findById(id)
      .populate("seller", "name storeName storeLogo shippingDefaults")
      .populate("buyer", "name phone")
      .populate(
        "items.product",
        "name images shipping fulfillmentLocation"
      );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const buyerId =
      (order.buyer as any)?._id?.toString?.() ||
      (order.buyer as any)?.toString?.();
    const sellerId =
      (order.seller as any)?._id?.toString?.() ||
      (order.seller as any)?.toString?.();

    const isBuyer = buyerId === user._id.toString();
    const isSeller = sellerId === user._id.toString();
    const isAdmin = user.role === "admin";

    if (!isBuyer && !isSeller && !isAdmin) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ====================== SELLER: Get my orders ======================
export const getSellerOrders = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);

    const orders = await Order.find({ seller: user._id })
      .populate("buyer", "name phone")
      .populate("items.product", "name images")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ====================== SELLER: Ship order ======================
export const shipOrder = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { id } = req.params;
    const {
      deliveryCompany,
      trackingNumber,
      estimatedDelivery,
      selfDeliveryNote,
    } = req.body;

    if (!id || !mongoose.isValidObjectId(String(id))) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (
      order.seller.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    if (order.orderStatus !== "Preparing") {
      return res.status(400).json({
        success: false,
        message: `Order is already ${order.orderStatus}. Only Preparing orders can be shipped.`,
      });
    }

    const method =
      (order as any).productShipping?.method === "self" ? "self" : "courier";
    const frozenCompany =
      (order as any).productShipping?.courierCompany || "";

    order.orderStatus = "Shipped";
    (order as any).shipping = {
      shippingMethod: method,
      deliveryCompany:
        method === "courier"
          ? String(deliveryCompany || frozenCompany || "").trim()
          : "",
      trackingNumber:
        method === "courier" ? String(trackingNumber || "").trim() : "",
      estimatedDelivery: estimatedDelivery
        ? new Date(estimatedDelivery)
        : undefined,
      selfDeliveryNote: String(selfDeliveryNote || "")
        .trim()
        .slice(0, 120),
      shippedAt: new Date(),
    };
    await order.save();

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
export const deliverOrder = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { id } = req.params;

    if (!id || !mongoose.isValidObjectId(String(id))) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (
      order.seller.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
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
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query: any = {};

    if (status) query.orderStatus = status;

    const total = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .populate("buyer", "name email phone")
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

// ====================== SELLER: Cancel order ======================
export const cancelOrderBySeller = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { id } = req.params;
    const { reasonCode, note } = req.body;

    if (!id || !mongoose.isValidObjectId(String(id))) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const code = String(reasonCode || "").trim();
    if (!CANCEL_REASONS[code]) {
      return res.status(400).json({
        success: false,
        message: "A valid cancellation reason is required",
      });
    }

    const extraNote = String(note || "")
      .trim()
      .slice(0, 200);

    if (code === "other" && !extraNote) {
      return res.status(400).json({
        success: false,
        message: "Please add a short explanation for Other",
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (
      order.seller.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    if (String(order.orderStatus) !== "Preparing") {
      return res.status(400).json({
        success: false,
        message: `Only Preparing orders can be cancelled. Current status: ${order.orderStatus}`,
      });
    }

    const reasonLabel =
      code === "other" && extraNote ? extraNote : CANCEL_REASONS[code];

    order.orderStatus = "Cancelled" as any;
    (order as any).cancellation = {
      cancelledBy: "seller",
      reasonCode: code,
      reasonLabel,
      note: extraNote,
      cancelledAt: new Date(),
      refundStatus: "not_applicable",
    };

    await order.save();

    for (const row of order.items) {
      await Product.findByIdAndUpdate(row.product, {
        $inc: { stock: row.quantity },
      });
    }

    const displayReason =
      code === "other" && extraNote ? extraNote : CANCEL_REASONS[code];

    await sendNotification({
      userId: order.buyer.toString(),
      type: "order_cancelled",
      title: "Order Cancelled",
      message: `Unfortunately, the seller was unable to fulfill your order.\nReason: "${displayReason}"\nYour order has been cancelled successfully.`,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
    });

    res.json({ success: true, data: order });
  } catch (error: any) {
    console.error("Cancel order error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};