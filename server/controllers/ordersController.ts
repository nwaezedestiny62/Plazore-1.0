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

function optionsToPlain(
  opts: Map<string, string> | Record<string, string> | undefined
): Record<string, string> {
  if (!opts) return {};
  if (opts instanceof Map) return Object.fromEntries(opts);
  return { ...opts };
}

/**
 * Atomic stock decrement.
 * Simple product: product.stock
 * Variant product: matching variants.$.stock
 * Returns false if insufficient stock (no write).
 */
async function atomicDecrementStock(params: {
  productId: mongoose.Types.ObjectId | string;
  quantity: number;
  variantId?: string;
  hasVariants?: boolean;
}): Promise<boolean> {
  const { productId, quantity, variantId, hasVariants } = params;
  if (quantity <= 0) return false;

  if (hasVariants && variantId) {
    const result = await Product.findOneAndUpdate(
      {
        _id: productId,
        hasVariants: true,
        variants: {
          $elemMatch: {
            variantId,
            available: true,
            stock: { $gte: quantity },
          },
        },
      },
      {
        $inc: {
          "variants.$.stock": -quantity,
          stock: -quantity,
        },
      },
      { returnDocument: "after" }
    );
    return !!result;
  }

  const result = await Product.findOneAndUpdate(
    {
      _id: productId,
      $or: [{ hasVariants: false }, { hasVariants: { $exists: false } }],
      stock: { $gte: quantity },
    },
    { $inc: { stock: -quantity } },
    { returnDocument: "after" }
  );
  return !!result;
}

async function atomicRestoreStock(params: {
  productId: mongoose.Types.ObjectId | string;
  quantity: number;
  variantId?: string;
  hasVariants?: boolean;
}): Promise<void> {
  const { productId, quantity, variantId, hasVariants } = params;
  if (quantity <= 0) return;

  if (hasVariants && variantId) {
    await Product.findOneAndUpdate(
      {
        _id: productId,
        "variants.variantId": variantId,
      },
      {
        $inc: {
          "variants.$.stock": quantity,
          stock: quantity,
        },
      }
    );
    return;
  }

  await Product.findByIdAndUpdate(productId, {
    $inc: { stock: quantity },
  });
}

function resolveVariant(product: any, item: any) {
  const hasVariants = !!(product as any).hasVariants;
  if (!hasVariants) {
    return {
      hasVariants: false,
      variantId: "",
      variantKey: "",
      selectedOptions: {} as Record<string, string>,
      unitPrice: Number(item.price ?? product.price),
      availableStock: Number(product.stock) || 0,
    };
  }

  const variants: any[] = (product as any).variants || [];
  let variant: any = null;

  const variantId = String(item.variantId || "").trim();
  const variantKey = String(item.variantKey || "").trim();
  const selectedFromItem = optionsToPlain(item.selectedOptions);

  if (variantId) {
    variant = variants.find((v) => String(v.variantId) === variantId);
  }
  if (!variant && variantKey) {
    variant = variants.find((v) => String(v.key) === variantKey);
  }
  if (!variant && Object.keys(selectedFromItem).length > 0) {
    const keyFromOpts = Object.entries(selectedFromItem)
      .map(([k, v]) => [
        String(k).trim().toLowerCase(),
        String(v).trim().toLowerCase(),
      ])
      .filter(([k, v]) => k && v)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`)
      .join("|");
    variant = variants.find((v) => String(v.key) === keyFromOpts);
  }

  if (!variant || variant.available === false) {
    return null;
  }

  const optPlain = optionsToPlain(variant.options);
  const priceOverride =
    variant.price != null && Number.isFinite(Number(variant.price))
      ? Number(variant.price)
      : null;

  return {
    hasVariants: true,
    variantId: String(variant.variantId),
    variantKey: String(variant.key),
    selectedOptions: optPlain,
    unitPrice:
      priceOverride != null
        ? priceOverride
        : Number(item.price ?? product.price),
    availableStock: Number(variant.stock) || 0,
  };
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
        variantId: item.variantId || "",
        variantKey: item.variantKey || "",
        selectedOptions: optionsToPlain(item.selectedOptions),
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

    // Validate all items first (no stock writes yet)
    const prepared: {
      sellerId: string;
      row: any;
      product: any;
      resolved: NonNullable<ReturnType<typeof resolveVariant>>;
    }[] = [];

    for (const item of rawItems) {
      const productId = item.productId || item.product;
      const qty = Number(item.quantity) || 0;
      if (qty < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid quantity",
        });
      }

      const product = await Product.findById(productId);

      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product not found or inactive: ${productId}`,
        });
      }

      const resolved = resolveVariant(product, item);
      if (!resolved) {
        return res.status(400).json({
          success: false,
          message: `Selected option is unavailable for ${product.name}`,
        });
      }

      if (resolved.availableStock < qty) {
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

      prepared.push({
        sellerId,
        product,
        resolved,
        row: {
          product: product._id,
          name: product.name,
          quantity: qty,
          price: resolved.unitPrice,
          image: product.images?.[0] || "",
          note: String(item.note || "")
            .trim()
            .slice(0, 120),
          variantId: resolved.variantId,
          variantKey: resolved.variantKey,
          selectedOptions: resolved.selectedOptions,
        },
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

    for (const p of prepared) {
      if (!itemsBySeller[p.sellerId]) itemsBySeller[p.sellerId] = [];
      itemsBySeller[p.sellerId].push({
        ...p.row,
        _meta: {
          hasVariants: p.resolved.hasVariants,
          variantId: p.resolved.variantId,
        },
      });
    }

    const createdOrders = [];
    const contactPhone = String(phone || user.phone || "").trim();
    const decremented: {
      productId: any;
      quantity: number;
      variantId: string;
      hasVariants: boolean;
    }[] = [];

    try {
      for (const sellerId of Object.keys(itemsBySeller)) {
        const sellerItems = itemsBySeller[sellerId];
        const snap = shippingBySeller[sellerId];

        // Atomic decrement per line
        for (const row of sellerItems) {
          const ok = await atomicDecrementStock({
            productId: row.product,
            quantity: row.quantity,
            variantId: row._meta.variantId,
            hasVariants: row._meta.hasVariants,
          });
          if (!ok) {
            // roll back previous decrements
            for (const d of decremented) {
              await atomicRestoreStock(d);
            }
            return res.status(409).json({
              success: false,
              message: `Insufficient stock for ${row.name}. Please refresh and try again.`,
            });
          }
          decremented.push({
            productId: row.product,
            quantity: row.quantity,
            variantId: row._meta.variantId,
            hasVariants: row._meta.hasVariants,
          });
        }

        const orderItems = sellerItems.map(({ _meta, ...rest }) => rest);

        const subtotal = orderItems.reduce(
          (sum, row) => sum + row.price * row.quantity,
          0
        );
        const shippingCost = snap?.deliveryFee || 0;

        const order = await Order.create({
          buyer: user._id,
          seller: sellerId,
          orderNumber: `PLZ#${Math.floor(10000 + Math.random() * 90000)}`,
          items: orderItems,
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
          buyerConfirmation: { status: "none" },
          payout: { status: "not_eligible" },
        });

        for (const row of orderItems) {
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
    } catch (err) {
      for (const d of decremented) {
        await atomicRestoreStock(d);
      }
      throw err;
    }

    try {
      const cart = await Cart.findOne({ user: user._id });
      if (cart) {
        cart.items = [];
        (cart as any).totalAmount = 0;
        await cart.save();
      }
    } catch {
      /* non-fatal */
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
      .populate("items.product", "name images shipping fulfillmentLocation");

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

    (order as any).buyerConfirmation = {
      status: "pending",
      confirmedAt: undefined,
      issueReportedAt: undefined,
      issueContactId: null,
    };
    (order as any).payout = {
      status: "awaiting_buyer",
      eligibleAt: undefined,
      blockedReason: "",
    };

    await order.save();

    await sendNotification({
      userId: order.buyer.toString(),
      type: "order_delivered",
      title: "Order Delivered",
      message: `Order ${order.orderNumber} has been delivered. Please confirm you received it.`,
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

// ====================== BUYER: Confirm delivery ======================
export const confirmDelivery = async (req: Request, res: Response) => {
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

    if (order.buyer.toString() !== user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    if (order.orderStatus !== "Delivered") {
      return res.status(400).json({
        success: false,
        message: "Only delivered orders can be confirmed",
      });
    }

    if ((order as any).buyerConfirmation?.status === "confirmed") {
      return res.json({ success: true, data: order, alreadyConfirmed: true });
    }

    if ((order as any).buyerConfirmation?.status === "issue_reported") {
      return res.status(400).json({
        success: false,
        message:
          "This order has an open delivery issue. Plazore is reviewing it.",
      });
    }

    if (
      (order as any).payout?.status === "initiated" ||
      (order as any).payout?.status === "completed"
    ) {
      return res.status(400).json({
        success: false,
        message: "Payout already in progress or completed",
      });
    }

    if (order.paymentStatus === "refunded") {
      return res.status(400).json({
        success: false,
        message: "This order was refunded",
      });
    }

    (order as any).buyerConfirmation = {
      status: "confirmed",
      confirmedAt: new Date(),
      issueReportedAt: (order as any).buyerConfirmation?.issueReportedAt,
      issueContactId:
        (order as any).buyerConfirmation?.issueContactId || null,
    };
    (order as any).payout = {
      status: "eligible",
      eligibleAt: new Date(),
      blockedReason: "",
    };

    await order.save();

    await sendNotification({
      userId: order.seller.toString(),
      type: "order_delivered",
      title: "Delivery confirmed",
      message: `Buyer confirmed delivery for ${order.orderNumber}.`,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
    });

    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ====================== BUYER: Report delivery issue ======================
export const reportDeliveryIssue = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { id } = req.params;
    const contactId = req.body?.contactId;

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

    if (order.buyer.toString() !== user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    if (order.orderStatus !== "Delivered") {
      return res.status(400).json({
        success: false,
        message: "Issues can only be reported on delivered orders",
      });
    }

    if ((order as any).buyerConfirmation?.status === "confirmed") {
      return res.status(400).json({
        success: false,
        message: "Delivery already confirmed",
      });
    }

    if ((order as any).buyerConfirmation?.status === "issue_reported") {
      return res.json({ success: true, data: order, alreadyReported: true });
    }

    (order as any).buyerConfirmation = {
      status: "issue_reported",
      confirmedAt: undefined,
      issueReportedAt: new Date(),
      issueContactId:
        contactId && mongoose.isValidObjectId(String(contactId))
          ? contactId
          : (order as any).buyerConfirmation?.issueContactId || null,
    };
    (order as any).payout = {
      status: "blocked_issue",
      eligibleAt: undefined,
      blockedReason: "Buyer reported a delivery issue",
    };

    await order.save();

    res.json({ success: true, data: order });
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

    // Restore stock — use snapshot variantId when present
    for (const row of order.items as any[]) {
      const variantId = String(row.variantId || "").trim();
      await atomicRestoreStock({
        productId: row.product,
        quantity: row.quantity,
        variantId,
        hasVariants: !!variantId,
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