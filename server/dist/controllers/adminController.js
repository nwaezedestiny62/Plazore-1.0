import mongoose from "mongoose";
import User from "../models/User.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
import ContactMessage from "../models/ContactMessage.js";
import ProductPerformance from "../models/ProductPerformance.js";
import Report from "../models/Report.js";
import Notification from "../models/Notification.js";
const COUNTRY_ALIASES = {
    NG: ["NG", "Nigeria"],
    GB: ["GB", "UK", "United Kingdom", "Great Britain"],
    US: ["US", "USA", "United States", "United States of America"],
    GH: ["GH", "Ghana"],
    KE: ["KE", "Kenya"],
    ZA: ["ZA", "South Africa"],
    CA: ["CA", "Canada"],
    EU: ["EU", "Europe"],
};
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
async function safeNotify(payload) {
    if (!payload.user)
        return;
    try {
        await Notification.create({
            user: payload.user,
            type: payload.type || "general",
            title: payload.title,
            message: payload.message,
            contact: payload.contact,
            report: payload.report,
            announcement: payload.announcement,
            link: payload.link || "",
        });
    }
    catch (e) {
        console.error("Notification create skipped:", e?.message);
    }
}
// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────
export const getDashboardStats = async (req, res) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [totalUsers, totalBuyers, totalSellers, newUsers7d, newSellers7d, totalProducts, activeProducts, inactiveProducts, newProducts7d, totalOrders, preparingOrders, shippedOrders, deliveredOrders, cancelledOrders, paidOrders, pendingPayments, failedPayments, gmvAgg, recentOrders, contactNew, contactOpen, reportsNew, reportsHigh, reportsUnresolved,] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: "buyer" }),
            User.countDocuments({ role: "seller" }),
            User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
            User.countDocuments({ role: "seller", createdAt: { $gte: sevenDaysAgo } }),
            Product.countDocuments(),
            Product.countDocuments({ isActive: true }),
            Product.countDocuments({ isActive: false }),
            Product.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
            Order.countDocuments(),
            Order.countDocuments({ orderStatus: "Preparing" }),
            Order.countDocuments({ orderStatus: "Shipped" }),
            Order.countDocuments({ orderStatus: "Delivered" }),
            Order.countDocuments({ orderStatus: "Cancelled" }),
            Order.countDocuments({ paymentStatus: "paid" }),
            Order.countDocuments({ paymentStatus: "pending" }),
            Order.countDocuments({ paymentStatus: "failed" }),
            Order.aggregate([
                { $match: { orderStatus: { $ne: "Cancelled" } } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ]),
            Order.find()
                .sort({ createdAt: -1 })
                .limit(8)
                .populate("buyer", "name email")
                .populate("seller", "name storeName email")
                .select("orderNumber orderStatus paymentStatus totalAmount createdAt"),
            ContactMessage.countDocuments({ status: "new" }),
            ContactMessage.countDocuments({
                status: { $in: ["new", "open", "awaiting_user", "awaiting_plazore"] },
            }),
            Report.countDocuments({
                status: { $in: ["new", "Submitted"] },
            }),
            Report.countDocuments({
                priority: { $in: ["high", "critical"] },
                status: {
                    $nin: ["resolved", "closed", "Resolved", "Closed"],
                },
            }),
            Report.countDocuments({
                status: {
                    $nin: ["resolved", "closed", "Resolved", "Closed"],
                },
            }),
        ]);
        const gmv = Math.round(gmvAgg?.[0]?.total || 0);
        res.json({
            success: true,
            data: {
                users: {
                    total: totalUsers,
                    buyers: totalBuyers,
                    sellers: totalSellers,
                    new7d: newUsers7d,
                    newSellers7d,
                },
                products: {
                    total: totalProducts,
                    active: activeProducts,
                    inactive: inactiveProducts,
                    new7d: newProducts7d,
                },
                orders: {
                    total: totalOrders,
                    preparing: preparingOrders,
                    shipped: shippedOrders,
                    delivered: deliveredOrders,
                    cancelled: cancelledOrders,
                },
                payments: {
                    paid: paidOrders,
                    pending: pendingPayments,
                    failed: failedPayments,
                },
                commerce: { gmv },
                support: {
                    contactNew,
                    contactOpen,
                    reportsNew,
                    reportsHigh,
                    reportsUnresolved,
                },
                platformSource: {
                    available: false,
                    note: "Orders do not currently store app vs web source.",
                },
                recentOrders,
                totalUsers,
                totalProducts,
                totalOrders,
                totalRevenue: gmv,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// ─────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────
export const getAdminUsers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
        const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
        const role = String(req.query.role || "").trim();
        const q = String(req.query.q || "").trim();
        const region = String(req.query.region || "").trim();
        const country = String(req.query.country || "").trim();
        const state = String(req.query.state || "").trim();
        const city = String(req.query.city || "").trim();
        const sort = String(req.query.sort || "newest").trim();
        const spot = String(req.query.spot || "").trim();
        const and = [];
        const now = Date.now();
        const d1 = new Date(now - 24 * 3600 * 1000);
        const d7 = new Date(now - 7 * 86400 * 1000);
        const d30 = new Date(now - 30 * 86400 * 1000);
        if (role && ["buyer", "seller", "admin"].includes(role)) {
            and.push({ role });
        }
        if (region) {
            and.push({
                marketplaceRegion: {
                    $regex: `^${escapeRegex(region)}$`,
                    $options: "i",
                },
            });
        }
        if (country) {
            const code = country.toUpperCase();
            const aliases = COUNTRY_ALIASES[code] || [country, code];
            const countryOr = [
                {
                    marketplaceRegion: {
                        $regex: `^${escapeRegex(code)}$`,
                        $options: "i",
                    },
                },
            ];
            for (const a of aliases) {
                countryOr.push({
                    "shippingDefaults.address.country": {
                        $regex: `^${escapeRegex(a)}$`,
                        $options: "i",
                    },
                });
            }
            and.push({ $or: countryOr });
        }
        if (state) {
            and.push({
                "shippingDefaults.address.state": {
                    $regex: escapeRegex(state),
                    $options: "i",
                },
            });
        }
        if (city) {
            and.push({
                "shippingDefaults.address.city": {
                    $regex: escapeRegex(city),
                    $options: "i",
                },
            });
        }
        if (q) {
            const or = [
                { name: { $regex: q, $options: "i" } },
                { email: { $regex: q, $options: "i" } },
                { storeName: { $regex: q, $options: "i" } },
                { phone: { $regex: q, $options: "i" } },
                { clerkId: { $regex: q, $options: "i" } },
                {
                    marketplaceRegion: {
                        $regex: `^${escapeRegex(q)}$`,
                        $options: "i",
                    },
                },
            ];
            if (/^[a-f\d]{24}$/i.test(q))
                or.push({ _id: q });
            and.push({ $or: or });
        }
        if (spot === "unverified") {
            and.push({
                role: "seller",
                isSellerVerified: { $ne: true },
                isSellerSuspended: { $ne: true },
            });
        }
        else if (spot === "suspended") {
            and.push({ isSellerSuspended: true });
        }
        else if (spot === "new") {
            and.push({ createdAt: { $gte: d7 } });
        }
        else if (spot === "active") {
            and.push({
                $or: [
                    { lastSeenAt: { $gte: d1 } },
                    {
                        $and: [
                            {
                                $or: [
                                    { lastSeenAt: null },
                                    { lastSeenAt: { $exists: false } },
                                ],
                            },
                            { updatedAt: { $gte: d1 } },
                        ],
                    },
                ],
            });
        }
        else if (spot === "dormant") {
            and.push({
                $or: [
                    { lastSeenAt: { $lte: d30 } },
                    {
                        $and: [
                            {
                                $or: [
                                    { lastSeenAt: null },
                                    { lastSeenAt: { $exists: false } },
                                ],
                            },
                            { updatedAt: { $lte: d30 } },
                        ],
                    },
                ],
            });
        }
        else if (spot === "no-region") {
            and.push({
                $or: [
                    { marketplaceRegion: { $exists: false } },
                    { marketplaceRegion: "" },
                    { marketplaceRegion: null },
                ],
            });
        }
        const filter = and.length ? { $and: and } : {};
        const sortMap = {
            newest: { createdAt: -1 },
            oldest: { createdAt: 1 },
            lastSeen: { lastSeenAt: -1, updatedAt: -1 },
            name: { name: 1 },
        };
        const [items, total, roleCounts, allForHealth] = await Promise.all([
            User.find(filter)
                .sort(sortMap[sort] || sortMap.newest)
                .skip((page - 1) * limit)
                .limit(limit)
                .select("name email phone role image clerkId marketplaceRegion storeName storeDescription businessGoal storeLogo storeBanner isSellerVerified isSellerSuspended sellerAppliedAt payout shippingDefaults lastSeenAt lastSeenPlatform createdAt updatedAt moderation")
                .lean(),
            User.countDocuments(filter),
            User.aggregate([{ $group: { _id: "$role", n: { $sum: 1 } } }]),
            User.find({}).select("lastSeenAt updatedAt").lean(),
        ]);
        const counts = { all: 0, buyer: 0, seller: 0, admin: 0 };
        for (const r of roleCounts) {
            const key = String(r._id || "");
            if (key in counts)
                counts[key] = r.n;
            counts.all += r.n;
        }
        let active24h = 0;
        let quiet7d = 0;
        let idle30d = 0;
        let dormant = 0;
        let unknown = 0;
        for (const u of allForHealth) {
            const seen = u.lastSeenAt || u.updatedAt;
            if (!seen) {
                unknown += 1;
                continue;
            }
            const hrs = (now - new Date(seen).getTime()) / 3600000;
            if (Number.isNaN(hrs))
                unknown += 1;
            else if (hrs < 24)
                active24h += 1;
            else if (hrs < 24 * 7)
                quiet7d += 1;
            else if (hrs < 24 * 30)
                idle30d += 1;
            else
                dormant += 1;
        }
        const known = active24h + quiet7d + idle30d + dormant;
        const activeShare = known > 0 ? active24h / known : 0;
        const dormantShare = known > 0 ? dormant / known : 0;
        let healthScore = Math.round(Math.max(5, Math.min(98, 40 + activeShare * 55 - dormantShare * 35)));
        let healthLabel = "Steady";
        let healthTone = "green";
        if (known === 0) {
            healthScore = 50;
            healthLabel = "Insufficient presence data";
            healthTone = "warn";
        }
        else if (healthScore >= 72) {
            healthLabel = "Healthy activity";
            healthTone = "green";
        }
        else if (healthScore >= 48) {
            healthLabel = "Mixed activity";
            healthTone = "warn";
        }
        else {
            healthLabel = "Low activity";
            healthTone = "error";
        }
        const sellerIds = items
            .filter((u) => u.role === "seller")
            .map((u) => u._id);
        const statsMap = {};
        if (sellerIds.length) {
            const grouped = await Product.aggregate([
                { $match: { seller: { $in: sellerIds } } },
                {
                    $group: {
                        _id: "$seller",
                        total: { $sum: 1 },
                        active: { $sum: { $cond: ["$isActive", 1, 0] } },
                    },
                },
            ]);
            for (const c of grouped) {
                statsMap[String(c._id)] = { total: c.total, active: c.active };
            }
        }
        res.json({
            success: true,
            data: items.map((u) => ({
                ...u,
                lastSeenAt: u.lastSeenAt || u.updatedAt || u.createdAt,
                productStats: statsMap[String(u._id)] || { total: 0, active: 0 },
            })),
            counts,
            activityHealth: {
                score: healthScore,
                label: healthLabel,
                tone: healthTone,
                active24h,
                quiet7d,
                idle30d,
                dormant,
                unknown,
                total: counts.all,
            },
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const getAdminUserDetail = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).lean();
        if (!user) {
            return res
                .status(404)
                .json({ success: false, message: "User not found" });
        }
        const [products, productCount, activeProductCount, orderCountAsBuyer, orderCountAsSeller, recentOrdersAsBuyer, recentOrdersAsSeller, gmvAsSeller,] = await Promise.all([
            user.role === "seller"
                ? Product.find({ seller: user._id })
                    .sort({ createdAt: -1 })
                    .limit(50)
                    .select("name price images category subCategory brand stock isActive region fulfillmentLocation createdAt updatedAt")
                    .lean()
                : Promise.resolve([]),
            user.role === "seller"
                ? Product.countDocuments({ seller: user._id })
                : Promise.resolve(0),
            user.role === "seller"
                ? Product.countDocuments({ seller: user._id, isActive: true })
                : Promise.resolve(0),
            Order.countDocuments({ buyer: user._id }),
            Order.countDocuments({ seller: user._id }),
            Order.find({ buyer: user._id })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate("seller", "name storeName")
                .select("orderNumber orderStatus paymentStatus totalAmount createdAt")
                .lean(),
            Order.find({ seller: user._id })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate("buyer", "name email")
                .select("orderNumber orderStatus paymentStatus totalAmount createdAt")
                .lean(),
            user.role === "seller"
                ? Order.aggregate([
                    {
                        $match: {
                            seller: user._id,
                            orderStatus: { $ne: "Cancelled" },
                            paymentStatus: "paid",
                        },
                    },
                    { $group: { _id: null, total: { $sum: "$totalAmount" } } },
                ])
                : Promise.resolve([]),
        ]);
        res.json({
            success: true,
            data: {
                user: {
                    ...user,
                    lastSeenAt: user.lastSeenAt || user.updatedAt || user.createdAt,
                },
                products,
                stats: {
                    productCount,
                    activeProductCount,
                    orderCountAsBuyer,
                    orderCountAsSeller,
                    orderCount: orderCountAsBuyer + orderCountAsSeller,
                    gmv: Math.round(gmvAsSeller?.[0]?.total || 0),
                },
                recentOrdersAsBuyer,
                recentOrdersAsSeller,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// ─────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────
export const getAdminProducts = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
        const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
        const q = String(req.query.q || "").trim();
        const region = String(req.query.region || "").trim();
        const city = String(req.query.city || "").trim();
        const active = String(req.query.active || "").trim();
        const sellerId = String(req.query.seller || "").trim();
        const sort = String(req.query.sort || "newest").trim();
        const filter = {};
        if (q) {
            filter.$or = [
                { name: { $regex: q, $options: "i" } },
                { brand: { $regex: q, $options: "i" } },
                { category: { $regex: q, $options: "i" } },
                { subCategory: { $regex: q, $options: "i" } },
            ];
        }
        if (region)
            filter.region = region;
        if (city) {
            filter["fulfillmentLocation.city"] = { $regex: city, $options: "i" };
        }
        if (active === "true")
            filter.isActive = true;
        if (active === "false")
            filter.isActive = false;
        if (sellerId)
            filter.seller = sellerId;
        const sortMap = {
            newest: { createdAt: -1 },
            oldest: { createdAt: 1 },
            priceHigh: { price: -1 },
            priceLow: { price: 1 },
            name: { name: 1 },
            stockHigh: { stock: -1 },
            stockLow: { stock: 1 },
        };
        const perfSortKeys = [
            "viewsHigh",
            "viewsLow",
            "cartHigh",
            "cartLow",
            "checkoutHigh",
            "checkoutLow",
        ];
        const needsPerfSort = perfSortKeys.includes(sort);
        const [rawItems, total, activeCount, inactiveCount] = await Promise.all([
            needsPerfSort
                ? Product.find(filter)
                    .populate("seller", "name storeName email marketplaceRegion isSellerSuspended")
                    .select("name price images category subCategory brand stock isActive region seller fulfillmentLocation wishlistCount createdAt updatedAt description")
                    .lean()
                : Product.find(filter)
                    .sort(sortMap[sort] || sortMap.newest)
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .populate("seller", "name storeName email marketplaceRegion isSellerSuspended")
                    .select("name price images category subCategory brand stock isActive region seller fulfillmentLocation wishlistCount createdAt updatedAt description")
                    .lean(),
            Product.countDocuments(filter),
            Product.countDocuments({ isActive: true }),
            Product.countDocuments({ isActive: false }),
        ]);
        const ids = rawItems.map((p) => p._id);
        const perfDocs = ids.length
            ? await ProductPerformance.find({ product: { $in: ids } })
                .select("product views cartAdds purchases score")
                .lean()
            : [];
        const perfMap = {};
        for (const p of perfDocs) {
            perfMap[String(p.product)] = {
                views: Number(p.views) || 0,
                cartAdds: Number(p.cartAdds) || 0,
                purchases: Number(p.purchases) || 0,
                score: Number(p.score) || 0,
            };
        }
        const orderAgg = ids.length
            ? await Order.aggregate([
                { $match: { "items.product": { $in: ids } } },
                { $unwind: "$items" },
                { $match: { "items.product": { $in: ids } } },
                {
                    $group: {
                        _id: "$items.product",
                        qty: { $sum: { $ifNull: ["$items.quantity", 1] } },
                    },
                },
            ])
            : [];
        const orderMap = {};
        for (const row of orderAgg) {
            orderMap[String(row._id)] = Number(row.qty) || 0;
        }
        let cartMap = {};
        try {
            const Cart = (await import("../models/Cart.js")).default;
            const liveCarts = ids.length
                ? await Cart.aggregate([
                    { $unwind: "$items" },
                    { $match: { "items.product": { $in: ids } } },
                    { $group: { _id: "$items.product", carts: { $sum: 1 } } },
                ])
                : [];
            for (const row of liveCarts) {
                cartMap[String(row._id)] = Number(row.carts) || 0;
            }
        }
        catch {
            /* optional */
        }
        let data = rawItems.map((p) => {
            const id = String(p._id);
            const perf = perfMap[id] || {
                views: 0,
                cartAdds: 0,
                purchases: 0,
                score: 0,
            };
            const views = perf.views;
            const cartAdds = Math.max(perf.cartAdds, cartMap[id] || 0);
            const checkouts = Math.max(perf.purchases, orderMap[id] || 0);
            return {
                ...p,
                metrics: { views, cartAdds, purchases: checkouts, score: perf.score },
                views,
                cartAdds,
                checkouts,
            };
        });
        if (needsPerfSort) {
            const key = sort.startsWith("views")
                ? "views"
                : sort.startsWith("cart")
                    ? "cartAdds"
                    : "checkouts";
            const desc = sort.endsWith("High");
            data.sort((a, b) => desc ? (b[key] || 0) - (a[key] || 0) : (a[key] || 0) - (b[key] || 0));
            const start = (page - 1) * limit;
            data = data.slice(start, start + limit);
        }
        res.json({
            success: true,
            data,
            counts: {
                all: activeCount + inactiveCount,
                active: activeCount,
                inactive: inactiveCount,
            },
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1,
            },
        });
    }
    catch (error) {
        console.error("getAdminProducts error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
// ─────────────────────────────────────────────────────────────
// SELLER / PRODUCT ACTIONS
// ─────────────────────────────────────────────────────────────
export const setSellerSuspended = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res
                .status(404)
                .json({ success: false, message: "User not found" });
        }
        if (user.role !== "seller") {
            return res
                .status(400)
                .json({ success: false, message: "User is not a seller" });
        }
        user.isSellerSuspended = Boolean(req.body?.suspended);
        await user.save();
        const full = await User.findById(user._id).lean();
        res.json({
            success: true,
            message: user.isSellerSuspended
                ? "Seller suspended"
                : "Seller reactivated",
            data: full,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const setSellerVerified = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res
                .status(404)
                .json({ success: false, message: "User not found" });
        }
        if (user.role !== "seller") {
            return res
                .status(400)
                .json({ success: false, message: "User is not a seller" });
        }
        user.isSellerVerified = Boolean(req.body?.verified);
        await user.save();
        const full = await User.findById(user._id).lean();
        res.json({
            success: true,
            message: user.isSellerVerified
                ? "Seller verified"
                : "Seller verification removed",
            data: full,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const setProductActive = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res
                .status(404)
                .json({ success: false, message: "Product not found" });
        }
        product.isActive = Boolean(req.body?.active);
        await product.save();
        res.json({
            success: true,
            message: product.isActive ? "Product activated" : "Product deactivated",
            data: { _id: product._id, isActive: product.isActive },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// ─────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────
export const getAdminOrders = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
        const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
        const status = String(req.query.status || "").trim();
        const payment = String(req.query.payment || "").trim();
        const q = String(req.query.q || "").trim();
        const city = String(req.query.city || "").trim();
        const region = String(req.query.region || "").trim();
        const filter = {};
        if (status)
            filter.orderStatus = status;
        if (payment)
            filter.paymentStatus = payment;
        if (city)
            filter["shippingAddress.city"] = { $regex: city, $options: "i" };
        if (region)
            filter["shippingAddress.country"] = { $regex: region, $options: "i" };
        if (q) {
            const orderNumberQ = q.replace(/^#/, "").trim();
            filter.$or = [
                { orderNumber: { $regex: orderNumberQ, $options: "i" } },
                { "buyerContact.name": { $regex: q, $options: "i" } },
                { "buyerContact.phone": { $regex: q, $options: "i" } },
                { "shippingAddress.city": { $regex: q, $options: "i" } },
            ];
        }
        const [raw, total] = await Promise.all([
            Order.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate("buyer", "name email marketplaceRegion phone")
                .populate("seller", "name storeName email marketplaceRegion")
                .select("orderNumber orderStatus paymentStatus paymentMethod totalAmount subtotal shippingCost createdAt buyer seller items buyerContact shippingAddress shipping productShipping cancellation deliveredAt")
                .lean(),
            Order.countDocuments(filter),
        ]);
        let data = raw;
        if (q) {
            const ql = q.toLowerCase();
            data = raw.filter((o) => {
                const hay = [
                    o.orderNumber,
                    o.buyer?.name,
                    o.buyer?.email,
                    o.seller?.storeName,
                    o.seller?.name,
                    o.seller?.email,
                    o.buyerContact?.name,
                    o.buyerContact?.phone,
                    o.shippingAddress?.city,
                    o.shippingAddress?.state,
                    o.shippingAddress?.country,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                return hay.includes(ql) || hay.includes(ql.replace(/^#/, ""));
            });
        }
        res.json({
            success: true,
            data,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const getAdminOrderDetail = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate("buyer", "name email phone marketplaceRegion")
            .populate("seller", "name storeName email phone marketplaceRegion isSellerSuspended")
            .populate("items.product", "name images price isActive region")
            .lean();
        if (!order) {
            return res
                .status(404)
                .json({ success: false, message: "Order not found" });
        }
        res.json({ success: true, data: order });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// ─────────────────────────────────────────────────────────────
// CONTACT (admin workspace)
// ─────────────────────────────────────────────────────────────
export const getAdminContacts = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
        const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
        const status = String(req.query.status || "").trim();
        const contactAs = String(req.query.contactAs || "").trim();
        const category = String(req.query.category || "").trim();
        const contextType = String(req.query.contextType || "").trim();
        const priority = String(req.query.priority || "").trim();
        const q = String(req.query.q || "").trim();
        const unread = String(req.query.unread || "").trim();
        const filter = {};
        if (status)
            filter.status = status;
        if (contactAs)
            filter.contactAs = contactAs;
        if (category)
            filter.category = category;
        if (contextType)
            filter.contextType = contextType;
        if (priority)
            filter.priority = priority;
        if (unread === "1")
            filter.unreadByAdmin = true;
        if (q) {
            filter.$or = [
                { email: { $regex: q, $options: "i" } },
                { subject: { $regex: q, $options: "i" } },
                { message: { $regex: q, $options: "i" } },
            ];
        }
        const [items, total, cNew, cOpen, cAwaitUser, cAwaitPlazore, cResolved, cClosed, cUnread, cHigh, cAll,] = await Promise.all([
            ContactMessage.find(filter)
                .sort({ lastMessageAt: -1, createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate("user", "name email role storeName marketplaceRegion")
                .populate("relatedProduct", "name")
                .populate("relatedSeller", "name storeName")
                .populate("assignedAdmin", "name email")
                .lean(),
            ContactMessage.countDocuments(filter),
            ContactMessage.countDocuments({ status: "new" }),
            ContactMessage.countDocuments({ status: "open" }),
            ContactMessage.countDocuments({ status: "awaiting_user" }),
            ContactMessage.countDocuments({ status: "awaiting_plazore" }),
            ContactMessage.countDocuments({ status: "resolved" }),
            ContactMessage.countDocuments({ status: "closed" }),
            ContactMessage.countDocuments({ unreadByAdmin: true }),
            ContactMessage.countDocuments({
                priority: { $in: ["high", "critical"] },
            }),
            ContactMessage.countDocuments({}),
        ]);
        res.json({
            success: true,
            data: items,
            counts: {
                new: cNew,
                open: cOpen,
                awaiting_user: cAwaitUser,
                awaiting_plazore: cAwaitPlazore,
                resolved: cResolved,
                closed: cClosed,
                unread: cUnread,
                high: cHigh,
                all: cAll,
            },
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const getAdminContactDetail = async (req, res) => {
    try {
        const item = await ContactMessage.findById(req.params.id)
            .populate("user", "name email role storeName marketplaceRegion phone")
            .populate("relatedProduct", "name price isActive images")
            .populate("relatedSeller", "name storeName email marketplaceRegion")
            .populate({
            path: "relatedOrder",
            select: "orderNumber orderStatus paymentStatus totalAmount deliveredAt buyerConfirmation payout buyer seller items",
            populate: [
                { path: "buyer", select: "name email phone" },
                { path: "seller", select: "name storeName email" },
            ],
        })
            .populate("assignedAdmin", "name email")
            .populate("messages.sender", "name email")
            .populate("internalNotes.admin", "name email")
            .populate("responses.admin", "name email")
            .lean();
        if (!item) {
            return res.status(404).json({ success: false, message: "Not found" });
        }
        res.json({ success: true, data: item });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// ─────────────────────────────────────────────────────────────
// CONTACT — Admin reach-out (PART 9)
// Mediated conversation. Never creates direct buyer↔seller chat.
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// CONTACT — Admin reach-out (PART 9)
// Mediated conversation. Never creates direct buyer↔seller chat.
// allowsReply: true  = user can text back
// allowsReply: false = one-way notice (no reply)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// CONTACT — Admin reach-out (PART 9)
// Mediated. Never direct buyer↔seller chat.
// allowsReply true  = user can text back
// allowsReply false = one-way notice
// ─────────────────────────────────────────────────────────────
export const adminReachOut = async (req, res) => {
    try {
        const admin = req.user;
        if (!admin?._id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const { targetUserId, contactAs = "buyer", contextType = "general", category = "account", subject = "", message, storeId, productId, orderId, allowsReply = true, } = req.body || {};
        if (!targetUserId || !mongoose.isValidObjectId(String(targetUserId))) {
            return res.status(400).json({
                success: false,
                message: "Valid targetUserId is required",
            });
        }
        const body = String(message || "").trim();
        if (!body) {
            return res.status(400).json({
                success: false,
                message: "Message is required",
            });
        }
        const words = body.split(/\s+/).filter(Boolean).length;
        if (words > 300) {
            return res.status(400).json({
                success: false,
                message: `Message must be 300 words or fewer (you wrote ${words})`,
            });
        }
        const target = await User.findById(targetUserId)
            .select("name email role storeName phone marketplaceRegion")
            .lean();
        if (!target) {
            return res.status(404).json({
                success: false,
                message: "Target user not found",
            });
        }
        const role = contactAs === "seller" || target.role === "seller"
            ? "seller"
            : "buyer";
        const allowedCtx = [
            "general",
            "store",
            "product",
            "order",
            "seller",
            "buyer",
        ];
        let ctx = allowedCtx.includes(String(contextType))
            ? String(contextType)
            : role === "seller"
                ? "seller"
                : "buyer";
        let relatedProduct = null;
        let relatedSeller = null;
        let relatedOrder = null;
        if (productId && mongoose.isValidObjectId(String(productId))) {
            const p = await Product.findById(productId).select("name seller").lean();
            if (p) {
                relatedProduct = p._id;
                relatedSeller = p.seller || null;
                if (ctx === "general")
                    ctx = "product";
            }
        }
        if (storeId && mongoose.isValidObjectId(String(storeId))) {
            relatedSeller = storeId;
            if (ctx === "general")
                ctx = "store";
        }
        else if (role === "seller") {
            relatedSeller = target._id;
        }
        if (orderId && mongoose.isValidObjectId(String(orderId))) {
            relatedOrder = orderId;
            if (ctx === "general")
                ctx = "order";
        }
        const canReply = Boolean(allowsReply);
        const now = new Date();
        const email = String(target.email || "").trim().toLowerCase() ||
            "unknown@plazore.local";
        const doc = await ContactMessage.create({
            user: target._id,
            contactAs: role,
            contextType: ctx,
            category: (category || "account"),
            subject: String(subject || `Message from Plazore`).slice(0, 200),
            email,
            location: {
                country: "—",
                state: "—",
                city: "—",
                street: "",
            },
            relatedProduct,
            relatedSeller,
            relatedOrder,
            message: body,
            messages: [
                {
                    senderType: "admin",
                    sender: admin._id,
                    body,
                    createdAt: now,
                },
            ],
            allowsReply: canReply,
            status: canReply ? "awaiting_user" : "open",
            priority: "normal",
            assignedAdmin: admin._id,
            unreadByAdmin: false,
            unreadByUser: true,
            lastMessageAt: now,
        });
        await safeNotify({
            user: target._id,
            title: canReply ? "Message from Plazore" : "Notice from Plazore",
            message: body.slice(0, 120) + (body.length > 120 ? "…" : ""),
            type: "contact_reply",
            contact: doc._id,
        });
        res.status(201).json({
            success: true,
            data: { _id: String(doc._id), allowsReply: canReply },
        });
    }
    catch (error) {
        console.error("adminReachOut:", error);
        res.status(500).json({
            success: false,
            message: error?.message || "Failed to start conversation",
        });
    }
};
export const updateAdminContact = async (req, res) => {
    try {
        const item = await ContactMessage.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: "Not found" });
        }
        const admin = req.user;
        const now = new Date();
        if (req.body.status)
            item.status = req.body.status;
        if (req.body.priority)
            item.priority = req.body.priority;
        if (req.body.assignedAdmin !== undefined) {
            item.assignedAdmin = req.body.assignedAdmin || admin._id;
        }
        else {
            item.assignedAdmin = admin._id;
        }
        // ─── Delivery issue resolution (PART 8) ───
        const resolveAction = String(req.body.resolveDeliveryIssue || "").trim();
        if (["refund_buyer", "seller_favour", "authorize_payout"].includes(resolveAction)) {
            if (!item.relatedOrder) {
                return res.status(400).json({
                    success: false,
                    message: "This conversation is not linked to an order",
                });
            }
            const order = await Order.findById(item.relatedOrder);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Linked order not found",
                });
            }
            if (order.orderStatus !== "Delivered") {
                return res.status(400).json({
                    success: false,
                    message: "Only delivered orders can be resolved this way",
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
                    message: "Order was already refunded",
                });
            }
            if (resolveAction === "refund_buyer") {
                order.paymentStatus = "refunded";
                order.buyerConfirmation = {
                    status: "issue_reported",
                    confirmedAt: order.buyerConfirmation?.confirmedAt,
                    issueReportedAt: order.buyerConfirmation?.issueReportedAt || now,
                    issueContactId: item._id,
                };
                order.payout = {
                    status: "refunded",
                    eligibleAt: undefined,
                    blockedReason: "Admin initiated refund after delivery issue",
                };
            }
            else if (resolveAction === "seller_favour") {
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
            }
            else if (resolveAction === "authorize_payout") {
                order.buyerConfirmation = {
                    status: "confirmed",
                    confirmedAt: now,
                    issueReportedAt: order.buyerConfirmation?.issueReportedAt,
                    issueContactId: order.buyerConfirmation?.issueContactId || item._id,
                };
                order.payout = {
                    status: "eligible",
                    eligibleAt: now,
                    blockedReason: "",
                };
            }
            await order.save();
            item.status = "resolved";
            item.resolvedAt = now;
            if (!Array.isArray(item.internalNotes)) {
                item.internalNotes = [];
            }
            item.internalNotes.push({
                admin: admin._id,
                body: `Delivery issue resolved: ${resolveAction.replace(/_/g, " ")}`,
                createdAt: now,
            });
            await safeNotify({
                user: order.buyer,
                title: "Delivery issue update",
                message: resolveAction === "refund_buyer"
                    ? `Your delivery issue on order ${order.orderNumber} has been resolved with a refund.`
                    : resolveAction === "authorize_payout"
                        ? `Your delivery issue on order ${order.orderNumber} has been resolved. The seller has been authorized for payout.`
                        : `Your delivery issue on order ${order.orderNumber} has been reviewed. Please confirm delivery if you have received the order.`,
                type: "contact_reply",
                contact: item._id,
            });
            if (resolveAction === "authorize_payout" ||
                resolveAction === "seller_favour") {
                await safeNotify({
                    user: order.seller,
                    title: "Delivery issue resolved",
                    message: resolveAction === "authorize_payout"
                        ? `Admin authorized payout for order ${order.orderNumber}.`
                        : `Delivery issue on order ${order.orderNumber} was resolved in your favour. Awaiting buyer confirmation.`,
                    type: "general",
                });
            }
        }
        // ─── Normal reply / note / markRead ───
        const replyBody = String(req.body.response || req.body.reply || "").trim();
        if (replyBody) {
            // One-way threads: no conversation-style admin reply
            if (item.allowsReply === false) {
                return res.status(403).json({
                    success: false,
                    message: "This thread is one-way (no text back). Use an internal note or status change instead.",
                });
            }
            if (!Array.isArray(item.messages)) {
                item.messages = [];
            }
            item.messages.push({
                senderType: "admin",
                sender: admin._id,
                body: replyBody,
                createdAt: now,
            });
            if (!Array.isArray(item.responses))
                item.responses = [];
            item.responses.push({
                admin: admin._id,
                body: replyBody,
                createdAt: now,
            });
            if (!req.body.status && !resolveAction) {
                item.status = "awaiting_user";
            }
            item.unreadByUser = true;
            item.unreadByAdmin = false;
            item.lastMessageAt = now;
            await safeNotify({
                user: item.user,
                title: "Plazore replied",
                message: "You have a new response regarding your contact request.",
                type: "contact_reply",
                contact: item._id,
            });
        }
        const note = String(req.body.internalNote || "").trim();
        if (note) {
            if (!Array.isArray(item.internalNotes)) {
                item.internalNotes = [];
            }
            item.internalNotes.push({
                admin: admin._id,
                body: note,
                createdAt: now,
            });
        }
        if (req.body.markRead === true) {
            item.unreadByAdmin = false;
        }
        if (["resolved", "closed"].includes(String(item.status))) {
            if (item.status === "resolved")
                item.resolvedAt = now;
            if (item.status === "closed")
                item.closedAt = now;
        }
        await item.save();
        const fresh = await ContactMessage.findById(item._id)
            .populate("user", "name email role storeName")
            .populate("relatedProduct", "name")
            .populate("relatedSeller", "name storeName")
            .populate({
            path: "relatedOrder",
            select: "orderNumber orderStatus paymentStatus totalAmount deliveredAt buyerConfirmation payout",
        })
            .populate("assignedAdmin", "name email")
            .populate("messages.sender", "name")
            .populate("internalNotes.admin", "name")
            .populate("responses.admin", "name")
            .lean();
        res.json({ success: true, data: fresh });
    }
    catch (error) {
        console.error("updateAdminContact:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
// ─────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────
export const getAdminReports = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
        const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
        const status = String(req.query.status || "").trim();
        const targetType = String(req.query.targetType || "").trim();
        const priority = String(req.query.priority || "").trim();
        const filter = {};
        if (status)
            filter.status = status;
        if (targetType)
            filter.targetType = targetType;
        if (priority)
            filter.priority = priority;
        const [items, total] = await Promise.all([
            Report.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate("reporter", "name email")
                .populate("product", "name isActive region")
                .populate("seller", "name storeName isSellerSuspended")
                .lean(),
            Report.countDocuments(filter),
        ]);
        res.json({
            success: true,
            data: items,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const updateAdminReport = async (req, res) => {
    try {
        const item = await Report.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: "Not found" });
        }
        const admin = req.user;
        if (req.body.status)
            item.status = req.body.status;
        if (req.body.priority)
            item.priority = req.body.priority;
        if (typeof req.body.resolutionNote === "string") {
            item.resolutionNote = req.body.resolutionNote;
        }
        item.assignedAdmin = admin._id;
        const statusLower = String(item.status).toLowerCase();
        if (["resolved", "closed"].includes(statusLower)) {
            if (statusLower === "resolved")
                item.resolvedAt = new Date();
            if (statusLower === "closed")
                item.closedAt = new Date();
        }
        await item.save();
        res.json({ success: true, data: item });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// ─────────────────────────────────────────────────────────────
// PRESENCE
// ─────────────────────────────────────────────────────────────
export const pingPresence = async (req, res) => {
    try {
        const platform = ["web", "app", "admin"].includes(String(req.body?.platform))
            ? String(req.body.platform)
            : "web";
        const id = req.user?._id;
        if (!id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        await User.findByIdAndUpdate(id, {
            lastSeenAt: new Date(),
            lastSeenPlatform: platform,
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
