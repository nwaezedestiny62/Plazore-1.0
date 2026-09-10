import mongoose from "mongoose";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Products.js";
import User from "../models/User.js";
import { sendNotification } from "../utils/sendNotification.js";
import { trackProductPerformance } from "../utils/performance.js";
const getUser = (req) => req.user;
const CANCEL_REASONS = {
    out_of_stock: "Product is out of stock",
    unable_to_deliver: "Unable to deliver to the destination",
    shipping_limitations: "Shipping limitations",
    incorrect_inventory: "Incorrect inventory",
    temporary_closure: "Temporary business closure",
    other: "Other",
};
function hasShipFromLocation(product, seller) {
    const fl = product?.fulfillmentLocation;
    if (fl && (fl.city || fl.state) && fl.country)
        return true;
    const addr = seller?.shippingDefaults?.address;
    if (addr && (addr.city || addr.state) && addr.country)
        return true;
    return false;
}
// ====================== CREATE ORDER ======================
export const createOrder = async (req, res) => {
    try {
        const user = getUser(req);
        const { shippingAddress, buyerNote, items: frontendItems, phone } = req.body;
        if (!shippingAddress) {
            return res.status(400).json({
                success: false,
                message: "Shipping address is required",
            });
        }
        let rawItems = [];
        if (frontendItems &&
            Array.isArray(frontendItems) &&
            frontendItems.length > 0) {
            rawItems = frontendItems;
        }
        else {
            const cart = await Cart.findOne({ user: user._id }).populate("items.product");
            if (!cart || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Cart is empty",
                });
            }
            rawItems = cart.items.map((item) => ({
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
        const itemsBySeller = {};
        const shippingBySeller = {};
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
                    message: "This seller has not completed their shipping information yet. Please try again later.",
                });
            }
            if (!itemsBySeller[sellerId])
                itemsBySeller[sellerId] = [];
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
            const method = product.shipping?.method === "self" ? "self" : "courier";
            const fee = Number(product.shipping?.deliveryFee) || 0;
            const company = String(product.shipping?.courierCompany || "").trim();
            if (!shippingBySeller[sellerId]) {
                shippingBySeller[sellerId] = {
                    method,
                    courierCompany: company,
                    deliveryFee: fee,
                };
            }
            else if (fee > shippingBySeller[sellerId].deliveryFee) {
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
            const subtotal = sellerItems.reduce((sum, row) => sum + row.price * row.quantity, 0);
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
                buyerConfirmation: { status: "none" },
                payout: { status: "not_eligible" },
            });
            for (const row of sellerItems) {
                await Product.findByIdAndUpdate(row.product, {
                    $inc: { stock: -row.quantity },
                });
            }
            for (const row of sellerItems) {
                trackProductPerformance({
                    productId: String(row.product),
                    action: "purchase",
                    actorUserId: user._id.toString(),
                    quantity: row.quantity || 1,
                }).catch(() => { });
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
        try {
            const cart = await Cart.findOne({ user: user._id });
            if (cart) {
                cart.items = [];
                cart.totalAmount = 0;
                await cart.save();
            }
        }
        catch {
            /* non-fatal */
        }
        res.status(201).json({
            success: true,
            message: "Order(s) placed successfully",
            data: createdOrders,
        });
    }
    catch (error) {
        console.error("Create order error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
// ====================== BUYER: Get my orders ======================
export const getMyOrders = async (req, res) => {
    try {
        const user = getUser(req);
        const orders = await Order.find({ buyer: user._id })
            .populate("seller", "name storeName storeLogo")
            .populate("items.product", "name images")
            .sort({ createdAt: -1 });
        res.json({ success: true, data: orders });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// ====================== Get single order ======================
export const getOrder = async (req, res) => {
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
        const buyerId = order.buyer?._id?.toString?.() ||
            order.buyer?.toString?.();
        const sellerId = order.seller?._id?.toString?.() ||
            order.seller?.toString?.();
        const isBuyer = buyerId === user._id.toString();
        const isSeller = sellerId === user._id.toString();
        const isAdmin = user.role === "admin";
        if (!isBuyer && !isSeller && !isAdmin) {
            return res
                .status(403)
                .json({ success: false, message: "Not authorized" });
        }
        res.json({ success: true, data: order });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// ====================== SELLER: Get my orders ======================
export const getSellerOrders = async (req, res) => {
    try {
        const user = getUser(req);
        const orders = await Order.find({ seller: user._id })
            .populate("buyer", "name phone")
            .populate("items.product", "name images")
            .sort({ createdAt: -1 });
        res.json({ success: true, data: orders });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// ====================== SELLER: Ship order ======================
export const shipOrder = async (req, res) => {
    try {
        const user = getUser(req);
        const { id } = req.params;
        const { deliveryCompany, trackingNumber, estimatedDelivery, selfDeliveryNote, } = req.body;
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
        if (order.seller.toString() !== user._id.toString() &&
            user.role !== "admin") {
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
        const method = order.productShipping?.method === "self" ? "self" : "courier";
        const frozenCompany = order.productShipping?.courierCompany || "";
        order.orderStatus = "Shipped";
        order.shipping = {
            shippingMethod: method,
            deliveryCompany: method === "courier"
                ? String(deliveryCompany || frozenCompany || "").trim()
                : "",
            trackingNumber: method === "courier" ? String(trackingNumber || "").trim() : "",
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
    }
    catch (error) {
        console.error("Ship error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
// ====================== SELLER: Mark as Delivered ======================
export const deliverOrder = async (req, res) => {
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
        if (order.seller.toString() !== user._id.toString() &&
            user.role !== "admin") {
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
        // Open buyer confirmation gate (does not change seller flow)
        order.buyerConfirmation = {
            status: "pending",
            confirmedAt: undefined,
            issueReportedAt: undefined,
            issueContactId: null,
        };
        order.payout = {
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// ====================== ADMIN: Get all orders ======================
export const getAllOrders = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const query = {};
        if (status)
            query.orderStatus = status;
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// ====================== BUYER: Confirm delivery ======================
export const confirmDelivery = async (req, res) => {
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
        if (order.buyerConfirmation?.status === "confirmed") {
            return res.json({ success: true, data: order, alreadyConfirmed: true });
        }
        if (order.buyerConfirmation?.status === "issue_reported") {
            return res.status(400).json({
                success: false,
                message: "This order has an open delivery issue. Plazore is reviewing it.",
            });
        }
        if (order.payout?.status === "initiated" ||
            order.payout?.status === "completed") {
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
        order.buyerConfirmation = {
            status: "confirmed",
            confirmedAt: new Date(),
            issueReportedAt: order.buyerConfirmation?.issueReportedAt,
            issueContactId: order.buyerConfirmation?.issueContactId || null,
        };
        order.payout = {
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// ====================== BUYER: Report delivery issue ======================
export const reportDeliveryIssue = async (req, res) => {
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
        if (order.buyerConfirmation?.status === "confirmed") {
            return res.status(400).json({
                success: false,
                message: "Delivery already confirmed",
            });
        }
        if (order.buyerConfirmation?.status === "issue_reported") {
            return res.json({ success: true, data: order, alreadyReported: true });
        }
        order.buyerConfirmation = {
            status: "issue_reported",
            confirmedAt: undefined,
            issueReportedAt: new Date(),
            issueContactId: contactId && mongoose.isValidObjectId(String(contactId))
                ? contactId
                : order.buyerConfirmation?.issueContactId || null,
        };
        order.payout = {
            status: "blocked_issue",
            eligibleAt: undefined,
            blockedReason: "Buyer reported a delivery issue",
        };
        await order.save();
        res.json({ success: true, data: order });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// ====================== SELLER: Cancel order ======================
export const cancelOrderBySeller = async (req, res) => {
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
        if (order.seller.toString() !== user._id.toString() &&
            user.role !== "admin") {
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
        const reasonLabel = code === "other" && extraNote ? extraNote : CANCEL_REASONS[code];
        order.orderStatus = "Cancelled";
        order.cancellation = {
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
        const displayReason = code === "other" && extraNote ? extraNote : CANCEL_REASONS[code];
        await sendNotification({
            userId: order.buyer.toString(),
            type: "order_cancelled",
            title: "Order Cancelled",
            message: `Unfortunately, the seller was unable to fulfill your order.\nReason: "${displayReason}"\nYour order has been cancelled successfully.`,
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
        });
        res.json({ success: true, data: order });
    }
    catch (error) {
        console.error("Cancel order error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
