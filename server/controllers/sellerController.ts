import { Request, Response } from "express";
import User from "../models/User.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
import { clerkClient } from "@clerk/express";
import cloudinary from "../config/cloudinary.js";

// Apply to become a seller
export const applyAsSeller = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      storeName,
      storeDescription,
      businessGoal,
      phone,
      bankName,
      accountName,
      accountNumber,
    } = req.body;

    if (!storeName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Store name is required",
      });
    }
    if (!storeDescription?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Business description is required",
      });
    }
    if (!businessGoal?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Business goal is required",
      });
    }
    if (!phone?.trim() || String(phone).trim().length < 7) {
      return res.status(400).json({
        success: false,
        message: "Valid phone number is required",
      });
    }
    if (!bankName?.trim() || !accountName?.trim() || !accountNumber?.trim()) {
      return res.status(400).json({
        success: false,
        message: "All payout / bank details are required",
      });
    }

    if (user.role === "seller" || user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "You are already a seller or admin",
      });
    }

    const updated = await User.findByIdAndUpdate(
      user._id,
      {
        role: "seller",
        storeName: storeName.trim(),
        storeDescription: storeDescription.trim(),
        businessGoal: businessGoal.trim(),
        phone: String(phone).trim(),
        sellerAppliedAt: new Date(),
        isSellerVerified: true, // immediate access — no 17h review for now
        payout: {
          bankName: bankName.trim(),
          accountName: accountName.trim(),
          accountNumber: String(accountNumber).trim(),
        },
      },
      { new: true }
    );

    if (updated?.clerkId) {
      await clerkClient.users.updateUserMetadata(updated.clerkId, {
        publicMetadata: { role: "seller" },
      });
    }

    res.json({
      success: true,
      message: "You are now a seller. Welcome to the Seller Lounge.",
      data: updated,
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

// ====================== MY STORE ======================

const getUser = (req: Request) => (req as any).user;

const uploadOne = (file: any, folder: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (err, result) => {
        if (err) reject(err);
        else resolve(result!.secure_url);
      }
    );
    stream.end(file.buffer);
  });

// GET /api/seller/store
export const getMyStore = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const full = await User.findById(user._id).select(
      "name email phone storeName storeDescription businessGoal storeLogo storeBanner payout shippingDefaults isSellerVerified sellerAppliedAt role"
    );

    if (!full) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, data: full });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/seller/store
export const updateMyStore = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const body = req.body || {};
    const updates: any = {};

    if (body.storeName !== undefined)
      updates.storeName = String(body.storeName).trim();
    if (body.storeDescription !== undefined)
      updates.storeDescription = String(body.storeDescription).trim();
    if (body.businessGoal !== undefined)
      updates.businessGoal = String(body.businessGoal).trim();
    if (body.phone !== undefined) updates.phone = String(body.phone).trim();

    let payout = body.payout;
    if (typeof payout === "string") {
      try {
        payout = JSON.parse(payout);
      } catch {
        payout = null;
      }
    }
    if (payout && typeof payout === "object") {
      updates.payout = {
        bankName: String(payout.bankName || "").trim(),
        accountName: String(payout.accountName || "").trim(),
        accountNumber: String(payout.accountNumber || "").trim(),
      };
    }

    let shippingDefaults = body.shippingDefaults;
    if (typeof shippingDefaults === "string") {
      try {
        shippingDefaults = JSON.parse(shippingDefaults);
      } catch {
        shippingDefaults = null;
      }
    }
    if (shippingDefaults && typeof shippingDefaults === "object") {
      const addr = shippingDefaults.address || {};
      updates.shippingDefaults = {
        address: {
          street: String(addr.street || "").trim(),
          city: String(addr.city || "").trim(),
          state: String(addr.state || "").trim(),
          zipCode: String(addr.zipCode || "").trim(),
          country: String(addr.country || "").trim(),
        },
        deliveryMethod:
          shippingDefaults.deliveryMethod === "self" ||
          shippingDefaults.deliveryMethod === "courier"
            ? shippingDefaults.deliveryMethod
            : "",
        courierCompany: String(shippingDefaults.courierCompany || "").trim(),
      };
    }

    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;

    if (files?.storeLogo?.[0]) {
      updates.storeLogo = await uploadOne(files.storeLogo[0], "plazore/store");
    }
    if (files?.storeBanner?.[0]) {
      updates.storeBanner = await uploadOne(
        files.storeBanner[0],
        "plazore/store"
      );
    }

    if (body.clearLogo === "true") updates.storeLogo = "";
    if (body.clearBanner === "true") updates.storeBanner = "";

    const updated = await User.findByIdAndUpdate(user._id, updates, {
      new: true,
      runValidators: true,
    }).select(
      "name email phone storeName storeDescription businessGoal storeLogo storeBanner payout shippingDefaults isSellerVerified sellerAppliedAt role"
    );

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("updateMyStore:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPublicStorefront = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Store id is required',
      })
    }

    const seller = await User.findById(id).select(
      'storeName storeDescription businessGoal storeLogo storeBanner role isSellerVerified name shippingDefaults'
    )

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      })
    }

    if (seller.role !== 'seller' && seller.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'This user does not have a public store',
      })
    }

    const products = await Product.find({
      seller: seller._id,
      isActive: true,
    })
      .select(
        'name price images category subCategory brand shipping isFeatured createdAt'
      )
      .sort({ createdAt: -1 })
      .limit(60)

    const addr = seller.shippingDefaults?.address

    res.json({
      success: true,
      data: {
        store: {
          id: seller._id,
          storeName: seller.storeName || seller.name || 'Store',
          storeDescription: seller.storeDescription || '',
          businessGoal: seller.businessGoal || '',
          storeLogo: seller.storeLogo || '',
          storeBanner: seller.storeBanner || '',
          isVerified: !!seller.isSellerVerified,
          location: {
            state: addr?.state || '',
            country: addr?.country || '',
          },
        },
        products,
        modules: {
          buyerConfidence: null,
          plazoreAI: null,
          recommendations: null,
        },
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message })
  }
}

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

// ── Gate: last 4 digits of payout accountNumber ──
export const verifyPayoutAccess = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?._id) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const raw = String(
      req.body?.lastFour ?? req.body?.last4 ?? req.body?.digits ?? ""
    );
    const digits = raw.replace(/\D/g, "").slice(-4);

    if (digits.length !== 4) {
      return res.status(400).json({
        success: false,
        message: "Enter exactly 4 digits",
      });
    }

    const full = await User.findById(user._id).select("payout");
    if (!full) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const stored = String(full.payout?.accountNumber ?? "").replace(/\D/g, "");

    // No account yet → allow setup
    if (!stored || stored.length < 4) {
      return res.json({
        success: true,
        data: { unlocked: true, setupRequired: true },
      });
    }

    const expected = stored.slice(-4);
    if (digits !== expected) {
      return res.status(403).json({
        success: false,
        message: "Those digits do not match your payout account",
      });
    }

    return res.json({
      success: true,
      data: { unlocked: true, setupRequired: false },
    });
  } catch (error: any) {
    console.error("verifyPayoutAccess:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Verification failed",
    });
  }
};