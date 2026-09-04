import { Request, Response } from "express";
import User from "../models/User.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
import ContactMessage from "../models/ContactMessage.js";
import ProductPerformance from "../models/ProductPerformance.js";
import Report from "../models/Report.js";
import Notification from "../models/Notification.js";

const COUNTRY_ALIASES: Record<string, string[]> = {
  NG: ["NG", "Nigeria"],
  GB: ["GB", "UK", "United Kingdom", "Great Britain"],
  US: ["US", "USA", "United States", "United States of America"],
  GH: ["GH", "Ghana"],
  KE: ["KE", "Kenya"],
  ZA: ["ZA", "South Africa"],
  CA: ["CA", "Canada"],
  EU: ["EU", "Europe"],
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function safeNotify(userId: any, title: string, message: string) {
  try {
    await Notification.create({
      user: userId,
      type: "general",
      title,
      message,
    });
  } catch (e) {
    console.error("admin notify skipped:", (e as any)?.message);
  }
}

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      totalUsers,
      totalBuyers,
      totalSellers,
      newUsers7d,
      newSellers7d,
      totalProducts,
      activeProducts,
      inactiveProducts,
      newProducts7d,
      totalOrders,
      preparingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      paidOrders,
      pendingPayments,
      failedPayments,
      gmvAgg,
      recentOrders,
      contactNew,
      contactOpen,
      reportsNew,
      reportsHigh,
      reportsUnresolved,
    ] = await Promise.all([
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
        .select(
          "orderNumber orderStatus paymentStatus totalAmount createdAt"
        ),
           ContactMessage.countDocuments({ status: "new" } as any),
      ContactMessage.countDocuments({
        status: {
          $in: [
            "new",
            "open",
            "in_progress",
            "awaiting_user",
            "awaiting_plazore",
          ],
        },
      } as any),
      Report.countDocuments({
        status: { $in: ["new", "Submitted"] },
      } as any),
      Report.countDocuments({
        priority: { $in: ["high", "critical"] },
        status: {
          $nin: ["resolved", "closed", "Resolved", "Closed"],
        },
      } as any),
      Report.countDocuments({
        status: {
          $nin: ["resolved", "closed", "Resolved", "Closed"],
        },
      } as any),
    ]);

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
        commerce: { gmv: Math.round(gmvAgg?.[0]?.total || 0) },
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
        totalRevenue: Math.round(gmvAgg?.[0]?.total || 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminUsers = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit || "20"), 10))
    );
    const role = String(req.query.role || "").trim();
    const q = String(req.query.q || "").trim();
    const region = String(req.query.region || "").trim();
    const country = String(req.query.country || "").trim();
    const state = String(req.query.state || "").trim();
    const city = String(req.query.city || "").trim();
    const sort = String(req.query.sort || "newest").trim();
    const spot = String(req.query.spot || "").trim();

    const and: any[] = [];
    const now = Date.now();
    const d1 = new Date(now - 24 * 3600000);
    const d7 = new Date(now - 7 * 86400000);
    const d30 = new Date(now - 30 * 86400000);

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
      const countryOr: any[] = [
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
      const or: any[] = [
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
      if (/^[a-f\d]{24}$/i.test(q)) or.push({ _id: q });
      and.push({ $or: or });
    }

    if (spot === "unverified") {
      and.push({
        role: "seller",
        isSellerVerified: { $ne: true },
        isSellerSuspended: { $ne: true },
      });
    } else if (spot === "suspended") {
      and.push({ isSellerSuspended: true });
    } else if (spot === "new") {
      and.push({ createdAt: { $gte: d7 } });
    } else if (spot === "active") {
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
    } else if (spot === "dormant") {
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
    } else if (spot === "no-region") {
      and.push({
        $or: [
          { marketplaceRegion: { $exists: false } },
          { marketplaceRegion: "" },
          { marketplaceRegion: null },
        ],
      });
    }

    const filter = and.length ? { $and: and } : {};

    const sortMap: Record<string, any> = {
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
        .select(
          "name email phone role image clerkId marketplaceRegion storeName storeDescription businessGoal storeLogo storeBanner isSellerVerified isSellerSuspended sellerAppliedAt payout shippingDefaults lastSeenAt lastSeenPlatform createdAt updatedAt"
        )
        .lean(),
      User.countDocuments(filter),
      User.aggregate([{ $group: { _id: "$role", n: { $sum: 1 } } }]),
      User.find({}).select("lastSeenAt updatedAt").lean(),
    ]);

    const counts = { all: 0, buyer: 0, seller: 0, admin: 0 };
    for (const r of roleCounts as any[]) {
      const key = String(r._id || "");
      if (key in counts) (counts as any)[key] = r.n;
      counts.all += r.n;
    }

    let active24h = 0;
    let quiet7d = 0;
    let idle30d = 0;
    let dormant = 0;
    let unknown = 0;
    for (const u of allForHealth as any[]) {
      const seen = u.lastSeenAt || u.updatedAt;
      if (!seen) {
        unknown += 1;
        continue;
      }
      const hrs = (now - new Date(seen).getTime()) / 3600000;
      if (Number.isNaN(hrs)) unknown += 1;
      else if (hrs < 24) active24h += 1;
      else if (hrs < 24 * 7) quiet7d += 1;
      else if (hrs < 24 * 30) idle30d += 1;
      else dormant += 1;
    }

    const known = active24h + quiet7d + idle30d + dormant;
    const activeShare = known > 0 ? active24h / known : 0;
    const dormantShare = known > 0 ? dormant / known : 0;
    let healthScore = Math.round(
      Math.max(5, Math.min(98, 40 + activeShare * 55 - dormantShare * 35))
    );
    let healthLabel = "Steady";
    let healthTone: "green" | "warn" | "error" = "green";
    if (known === 0) {
      healthScore = 50;
      healthLabel = "Insufficient presence data";
      healthTone = "warn";
    } else if (healthScore >= 72) {
      healthLabel = "Healthy activity";
      healthTone = "green";
    } else if (healthScore >= 48) {
      healthLabel = "Mixed activity";
      healthTone = "warn";
    } else {
      healthLabel = "Low activity";
      healthTone = "error";
    }

    const sellerIds = items
      .filter((u: any) => u.role === "seller")
      .map((u: any) => u._id);
    const statsMap: Record<string, { total: number; active: number }> = {};
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
      data: items.map((u: any) => ({
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminUserDetail = async (req: Request, res: Response) => {
  try {
    const user: any = await User.findById(req.params.id).lean();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const [
      products,
      productCount,
      activeProductCount,
      orderCountAsBuyer,
      orderCountAsSeller,
      recentOrdersAsBuyer,
      recentOrdersAsSeller,
      gmvAsSeller,
    ] = await Promise.all([
      user.role === "seller"
        ? Product.find({ seller: user._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .select(
              "name price images category subCategory brand stock isActive region fulfillmentLocation createdAt updatedAt"
            )
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
          gmv: Math.round((gmvAsSeller as any)?.[0]?.total || 0),
        },
        recentOrdersAsBuyer,
        recentOrdersAsSeller,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminProducts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit || "20"), 10))
    );
    const q = String(req.query.q || "").trim();
    const region = String(req.query.region || "").trim();
    const city = String(req.query.city || "").trim();
    const active = String(req.query.active || "").trim();
    const sellerId = String(req.query.seller || "").trim();
    const sort = String(req.query.sort || "newest").trim();

    const filter: any = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { brand: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
        { subCategory: { $regex: q, $options: "i" } },
      ];
    }
    if (region) filter.region = region;
    if (city) {
      filter["fulfillmentLocation.city"] = { $regex: city, $options: "i" };
    }
    if (active === "true") filter.isActive = true;
    if (active === "false") filter.isActive = false;
    if (sellerId) filter.seller = sellerId;

    const sortMap: Record<string, any> = {
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
            .populate(
              "seller",
              "name storeName email marketplaceRegion isSellerSuspended"
            )
            .select(
              "name price images category subCategory brand stock isActive region seller fulfillmentLocation wishlistCount createdAt updatedAt description"
            )
            .lean()
        : Product.find(filter)
            .sort(sortMap[sort] || sortMap.newest)
            .skip((page - 1) * limit)
            .limit(limit)
            .populate(
              "seller",
              "name storeName email marketplaceRegion isSellerSuspended"
            )
            .select(
              "name price images category subCategory brand stock isActive region seller fulfillmentLocation wishlistCount createdAt updatedAt description"
            )
            .lean(),
      Product.countDocuments(filter),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: false }),
    ]);

    const ids = rawItems.map((p: any) => p._id);

    const perfDocs = ids.length
      ? await ProductPerformance.find({ product: { $in: ids } })
          .select("product views cartAdds purchases score")
          .lean()
      : [];

    const perfMap: Record<
      string,
      { views: number; cartAdds: number; purchases: number; score: number }
    > = {};
    for (const p of perfDocs as any[]) {
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

    const orderMap: Record<string, number> = {};
    for (const row of orderAgg as any[]) {
      orderMap[String(row._id)] = Number(row.qty) || 0;
    }

    let cartMap: Record<string, number> = {};
    try {
      const Cart = (await import("../models/Cart.js")).default;
      const liveCarts = ids.length
        ? await Cart.aggregate([
            { $unwind: "$items" },
            { $match: { "items.product": { $in: ids } } },
            { $group: { _id: "$items.product", carts: { $sum: 1 } } },
          ])
        : [];
      for (const row of liveCarts as any[]) {
        cartMap[String(row._id)] = Number(row.carts) || 0;
      }
    } catch {
      /* optional */
    }

    let data = rawItems.map((p: any) => {
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
      data.sort((a: any, b: any) =>
        desc ? (b[key] || 0) - (a[key] || 0) : (a[key] || 0) - (b[key] || 0)
      );
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
  } catch (error: any) {
    console.error("getAdminProducts error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const setSellerSuspended = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const setSellerVerified = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const setProductActive = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    product.isActive = Boolean(req.body?.active);
    await product.save();
    res.json({
      success: true,
      message: product.isActive ? "Product activated" : "Product deactivated",
      data: { _id: product._id, isActive: product.isActive },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminOrders = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit || "20"), 10))
    );
    const status = String(req.query.status || "").trim();
    const payment = String(req.query.payment || "").trim();
    const q = String(req.query.q || "").trim();
    const city = String(req.query.city || "").trim();
    const region = String(req.query.region || "").trim();

    const filter: any = {};
    if (status) filter.orderStatus = status;
    if (payment) filter.paymentStatus = payment;
    if (city) filter["shippingAddress.city"] = { $regex: city, $options: "i" };
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
        .select(
          "orderNumber orderStatus paymentStatus paymentMethod totalAmount subtotal shippingCost createdAt buyer seller items buyerContact shippingAddress shipping productShipping cancellation deliveredAt"
        )
        .lean(),
      Order.countDocuments(filter),
    ]);

    let data = raw;
    if (q) {
      const ql = q.toLowerCase();
      data = raw.filter((o: any) => {
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminOrderDetail = async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("buyer", "name email phone marketplaceRegion")
      .populate(
        "seller",
        "name storeName email phone marketplaceRegion isSellerSuspended"
      )
      .populate("items.product", "name images price isActive region")
      .lean();
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** ─── CONTACT (admin workspace) ─── */

export const getAdminContacts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit || "20"), 10))
    );
    const status = String(req.query.status || "").trim();
    const contactAs = String(req.query.contactAs || "").trim();
    const category = String(req.query.category || "").trim();
    const contextType = String(req.query.contextType || "").trim();
    const priority = String(req.query.priority || "").trim();
    const q = String(req.query.q || "").trim();
    const unread = String(req.query.unread || "").trim();

    const filter: any = {};
    if (status) filter.status = status;
    if (contactAs) filter.contactAs = contactAs;
    if (category) filter.category = category;
    if (contextType) filter.contextType = contextType;
    if (priority) filter.priority = priority;
    if (unread === "1") filter.unreadByAdmin = true;
    if (q) {
      filter.$or = [
        { email: { $regex: q, $options: "i" } },
        { subject: { $regex: q, $options: "i" } },
        { message: { $regex: q, $options: "i" } },
      ];
    }

    const [
      items,
      total,
      cNew,
      cOpen,
      cAwaitUser,
      cAwaitPlazore,
      cResolved,
      cClosed,
      cUnread,
      cHigh,
    ] = await Promise.all([
      ContactMessage.find(filter)
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "name email role storeName marketplaceRegion")
        .populate("relatedProduct", "name")
        .populate("relatedSeller", "name storeName")
        .populate("assignedAdmin", "name email")
        .lean(),
           ContactMessage.countDocuments({ status: "new" } as any),
      ContactMessage.countDocuments({
        status: { $in: ["open", "in_progress"] },
      } as any),
      ContactMessage.countDocuments({ status: "awaiting_user" } as any),
      ContactMessage.countDocuments({ status: "awaiting_plazore" } as any),
      ContactMessage.countDocuments({ status: "resolved" } as any),
      ContactMessage.countDocuments({ status: "closed" } as any),
      ContactMessage.countDocuments({ unreadByAdmin: true } as any),
      ContactMessage.countDocuments({
        priority: { $in: ["high", "critical"] },
      } as any),
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
        all: await ContactMessage.countDocuments({}),
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminContactDetail = async (req: Request, res: Response) => {
  try {
    const item = await ContactMessage.findById(req.params.id)
      .populate("user", "name email role storeName marketplaceRegion phone")
      .populate("relatedProduct", "name price isActive images")
      .populate("relatedSeller", "name storeName email marketplaceRegion")
      .populate("relatedOrder")
      .populate("assignedAdmin", "name email")
      .populate("messages.sender", "name email")
      .populate("internalNotes.admin", "name email")
      .populate("responses.admin", "name email")
      .lean();
    if (!item)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAdminContact = async (req: Request, res: Response) => {
  try {
    const item = await ContactMessage.findById(req.params.id);
    if (!item)
      return res.status(404).json({ success: false, message: "Not found" });
    const admin = (req as any).user;
    const now = new Date();

    if (req.body.status) item.status = req.body.status;
    if (req.body.priority) (item as any).priority = req.body.priority;
    if (req.body.assignedAdmin !== undefined) {
      item.assignedAdmin = req.body.assignedAdmin || admin._id;
    } else {
      item.assignedAdmin = admin._id;
    }

    const replyBody = String(
      req.body.response || req.body.reply || ""
    ).trim();
    if (replyBody) {
      if (!Array.isArray((item as any).messages)) {
        (item as any).messages = [];
      }
      (item as any).messages.push({
        senderType: "admin",
        sender: admin._id,
        body: replyBody,
        createdAt: now,
      });
      if (!Array.isArray(item.responses)) item.responses = [] as any;
      item.responses.push({
        admin: admin._id,
        body: replyBody,
        createdAt: now,
      } as any);

      if (!req.body.status) {
        try {
          item.status = "awaiting_user" as any;
        } catch {
          item.status = "open" as any;
        }
      }
      (item as any).unreadByUser = true;
      (item as any).unreadByAdmin = false;
      (item as any).lastMessageAt = now;

      await safeNotify(
        item.user,
        "Plazore replied",
        "You have a new response regarding your contact request."
      );
    }

    const note = String(req.body.internalNote || "").trim();
    if (note) {
      if (!Array.isArray((item as any).internalNotes)) {
        (item as any).internalNotes = [];
      }
      (item as any).internalNotes.push({
        admin: admin._id,
        body: note,
        createdAt: now,
      });
    }

    if (req.body.markRead === true) {
      (item as any).unreadByAdmin = false;
    }

    if (["resolved", "closed"].includes(String(item.status))) {
      if (item.status === "resolved") item.resolvedAt = now;
      if (item.status === "closed") item.closedAt = now;
    }

    await item.save();

    const fresh = await ContactMessage.findById(item._id)
      .populate("user", "name email role storeName")
      .populate("relatedProduct", "name")
      .populate("relatedSeller", "name storeName")
      .populate("assignedAdmin", "name email")
      .populate("messages.sender", "name")
      .populate("internalNotes.admin", "name")
      .populate("responses.admin", "name")
      .lean();

    res.json({ success: true, data: fresh });
  } catch (error: any) {
    console.error("updateAdminContact:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminReports = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit || "20"), 10))
    );
    const status = String(req.query.status || "").trim();
    const targetType = String(req.query.targetType || "").trim();
    const priority = String(req.query.priority || "").trim();

    const filter: any = {};
    if (status) filter.status = status;
    if (targetType) filter.targetType = targetType;
    if (priority) filter.priority = priority;

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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAdminReport = async (req: Request, res: Response) => {
  try {
    const item = await Report.findById(req.params.id);
    if (!item)
      return res.status(404).json({ success: false, message: "Not found" });
    const admin = (req as any).user;

    if (req.body.status) item.status = req.body.status;
    if (req.body.priority) item.priority = req.body.priority;
    if (typeof req.body.resolutionNote === "string") {
      item.resolutionNote = req.body.resolutionNote;
    }
    item.assignedAdmin = admin._id;
    if (["resolved", "closed", "Resolved", "Closed"].includes(String(item.status))) {
      if (String(item.status).toLowerCase() === "resolved")
        item.resolvedAt = new Date();
      if (String(item.status).toLowerCase() === "closed")
        item.closedAt = new Date();
    }
    await item.save();
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const pingPresence = async (req: Request, res: Response) => {
  try {
    const platform = ["web", "app", "admin"].includes(
      String(req.body?.platform)
    )
      ? String(req.body.platform)
      : "web";
    const id = (req as any).user?._id;
    if (!id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    await User.findByIdAndUpdate(id, {
      lastSeenAt: new Date(),
      lastSeenPlatform: platform,
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};