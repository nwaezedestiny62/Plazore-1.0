import { Request, Response } from "express";
import User from "../models/User.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
import ContactMessage from "../models/ContactMessage.js";
import Report from "../models/Report.js";

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
        .select("orderNumber orderStatus paymentStatus totalAmount createdAt"),
      ContactMessage.countDocuments({ status: "new" }),
      ContactMessage.countDocuments({ status: { $in: ["new", "open", "in_progress"] } }),
      Report.countDocuments({ status: "new" }),
      Report.countDocuments({
        priority: { $in: ["high", "critical"] },
        status: { $nin: ["resolved", "closed"] },
      }),
      Report.countDocuments({ status: { $nin: ["resolved", "closed"] } }),
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
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
    const role = String(req.query.role || "").trim();
    const q = String(req.query.q || "").trim();
    const region = String(req.query.region || "").trim();
    const city = String(req.query.city || "").trim();

    const filter: any = {};
    if (role && ["buyer", "seller", "admin"].includes(role)) filter.role = role;
    if (region) filter.marketplaceRegion = region;
    if (city) {
      filter["shippingDefaults.address.city"] = { $regex: city, $options: "i" };
    }
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { storeName: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { clerkId: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(
          "name email phone role image clerkId marketplaceRegion storeName storeDescription businessGoal storeLogo storeBanner isSellerVerified isSellerSuspended sellerAppliedAt payout shippingDefaults createdAt updatedAt"
        )
        .lean(),
      User.countDocuments(filter),
    ]);

    const sellerIds = items.filter((u: any) => u.role === "seller").map((u: any) => u._id);
    const statsMap: Record<string, { total: number; active: number }> = {};

    if (sellerIds.length) {
      const counts = await Product.aggregate([
        { $match: { seller: { $in: sellerIds } } },
        {
          $group: {
            _id: "$seller",
            total: { $sum: 1 },
            active: { $sum: { $cond: ["$isActive", 1, 0] } },
          },
        },
      ]);
      for (const c of counts) {
        statsMap[String(c._id)] = { total: c.total, active: c.active };
      }
    }

    res.json({
      success: true,
      data: items.map((u: any) => ({
        ...u,
        productStats: statsMap[String(u._id)] || { total: 0, active: 0 },
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** FULL user document + rich related data */
export const getAdminUserDetail = async (req: Request, res: Response) => {
  try {
    // No .select() — return every field on the user
    const user = await User.findById(req.params.id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
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
        user, // FULL document
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
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
    const q = String(req.query.q || "").trim();
    const region = String(req.query.region || "").trim();
    const city = String(req.query.city || "").trim();
    const active = String(req.query.active || "").trim();
    const sellerId = String(req.query.seller || "").trim();

    const filter: any = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { brand: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
      ];
    }
    if (region) filter.region = region;
    if (city) filter["fulfillmentLocation.city"] = { $regex: city, $options: "i" };
    if (active === "true") filter.isActive = true;
    if (active === "false") filter.isActive = false;
    if (sellerId) filter.seller = sellerId;

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("seller", "name storeName email marketplaceRegion isSellerSuspended")
        .select(
          "name price images category subCategory brand stock isActive region seller fulfillmentLocation createdAt updatedAt"
        )
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const setSellerSuspended = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.role !== "seller") {
      return res.status(400).json({ success: false, message: "User is not a seller" });
    }
    user.isSellerSuspended = Boolean(req.body?.suspended);
    await user.save();

    // Return full user so UI can live-update without another fetch if desired
    const full = await User.findById(user._id).lean();

    res.json({
      success: true,
      message: user.isSellerSuspended ? "Seller suspended" : "Seller reactivated",
      data: full,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const setSellerVerified = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.role !== "seller") {
      return res.status(400).json({ success: false, message: "User is not a seller" });
    }
    user.isSellerVerified = Boolean(req.body?.verified);
    await user.save();

    const full = await User.findById(user._id).lean();

    res.json({
      success: true,
      message: user.isSellerVerified ? "Seller verified" : "Seller verification removed",
      data: full,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const setProductActive = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
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
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
    const status = String(req.query.status || "").trim();
    const payment = String(req.query.payment || "").trim();
    const q = String(req.query.q || "").trim();
    const city = String(req.query.city || "").trim();
    const region = String(req.query.region || "").trim();

    const filter: any = {};
    if (status) filter.orderStatus = status;
    if (payment) filter.paymentStatus = payment;
    if (city) filter["shippingAddress.city"] = { $regex: city, $options: "i" };
    if (region) filter["shippingAddress.country"] = { $regex: region, $options: "i" };

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
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminOrderDetail = async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("buyer", "name email phone marketplaceRegion")
      .populate("seller", "name storeName email phone marketplaceRegion isSellerSuspended")
      .populate("items.product", "name images price isActive region")
      .lean();
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminContacts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
    const status = String(req.query.status || "").trim();
    const contactAs = String(req.query.contactAs || "").trim();
    const category = String(req.query.category || "").trim();

    const filter: any = {};
    if (status) filter.status = status;
    if (contactAs) filter.contactAs = contactAs;
    if (category) filter.category = category;

    const [items, total] = await Promise.all([
      ContactMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "name email role storeName")
        .populate("relatedProduct", "name")
        .populate("relatedSeller", "name storeName")
        .lean(),
      ContactMessage.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminContactDetail = async (req: Request, res: Response) => {
  try {
    const item = await ContactMessage.findById(req.params.id)
      .populate("user", "name email role storeName marketplaceRegion")
      .populate("relatedProduct", "name price isActive")
      .populate("relatedSeller", "name storeName email")
      .populate("relatedOrder")
      .populate("responses.admin", "name email")
      .lean();
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAdminContact = async (req: Request, res: Response) => {
  try {
    const item = await ContactMessage.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    const admin = (req as any).user;

    if (req.body.status) item.status = req.body.status;
    if (req.body.response) {
      item.responses.push({
        admin: admin._id,
        body: String(req.body.response).trim(),
        createdAt: new Date(),
      } as any);
      if (item.status === "new") item.status = "open";
    }
    if (["resolved", "closed"].includes(item.status)) {
      if (item.status === "resolved") item.resolvedAt = new Date();
      if (item.status === "closed") item.closedAt = new Date();
    }
    item.assignedAdmin = admin._id;
    await item.save();
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminReports = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
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
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAdminReport = async (req: Request, res: Response) => {
  try {
    const item = await Report.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    const admin = (req as any).user;

    if (req.body.status) item.status = req.body.status;
    if (req.body.priority) item.priority = req.body.priority;
    if (typeof req.body.resolutionNote === "string") {
      item.resolutionNote = req.body.resolutionNote;
    }
    item.assignedAdmin = admin._id;
    if (["resolved", "closed"].includes(item.status)) {
      if (item.status === "resolved") item.resolvedAt = new Date();
      if (item.status === "closed") item.closedAt = new Date();
    }
    await item.save();
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};