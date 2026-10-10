import { Request, Response } from "express";
import User from "../models/User.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
import Payout from "../models/Payout.js";
import { clerkClient } from "@clerk/express";
import cloudinary from "../config/cloudinary.js";
import { isPaystackConfigured } from "../services/paystack/client.js";
import { paystackRequest } from "../services/paystack/client.js";
import { createTransferRecipient } from "../services/paystack/transfers.js";

function httpError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

function regionCurrency(region: string) {
  const code = String(region || "NG").trim().toUpperCase();
  if (code === "NG") return "NGN";
  if (code === "US") return "USD";
  if (code === "DE") return "EUR";
  if (code === "KE") return "KES";
  if (code === "GB") return "GBP";
  return "USD";
}

/**
 * Nigeria: Paystack must be able to pay this exact account.
 * When PAYSTACK_SECRET_KEY is set, resolve the name and cache a recipient.
 * When it is not set yet, still require a real bank code + 10-digit NUBAN
 * and mark unverified so payout does not pretend the account is ready.
 */
async function buildNgnPayout(input: {
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}) {
  const bankCode = String(input.bankCode || "").replace(/\D/g, "");
  const accountNumber = String(input.accountNumber || "").replace(/\D/g, "");
  const bankName = String(input.bankName || "").trim();

  if (!/^\d{3,6}$/.test(bankCode)) {
    throw httpError(400, "Select your bank from the list");
  }
  if (!/^\d{10}$/.test(accountNumber)) {
    throw httpError(400, "Nigerian account number must be 10 digits");
  }
  if (!bankName) {
    throw httpError(400, "Bank name is required");
  }

  let accountName = String(input.accountName || "").trim();
  let status: "verified" | "unverified" = "unverified";
  let paystackRecipientCode: string | null = null;

  if (isPaystackConfigured()) {
    const resolved = await paystackRequest<{
      account_name: string;
      account_number: string;
    }>(
      "GET",
      `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`
    );
    accountName = String(resolved.data?.account_name || "").trim();
    if (!accountName) {
      throw httpError(400, "Paystack could not verify this account");
    }
    const recipient = await createTransferRecipient({
      type: "nuban",
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN",
    });
    paystackRecipientCode = recipient.recipient_code;
    status = "verified";
  } else if (accountName.length < 2) {
    throw httpError(
      400,
      "Enter the account name. It will be checked with Paystack once keys are set."
    );
  }

  return {
    payout: {
      country: "NG",
      currency: "NGN",
      provider: "paystack" as const,
      bankName,
      bankCode,
      accountName,
      accountNumber,
      status,
      verifiedAt: status === "verified" ? new Date() : null,
    },
    paystackRecipientCode,
    stripeAccountId: null as string | null,
  };
}

/** US / DE / KE / other: do not collect a Nigerian account. Stripe Connect later. */
function buildConnectPayout(region: string) {
  const country = String(region || "US").trim().toUpperCase();
  return {
    payout: {
      country,
      currency: regionCurrency(country),
      provider: "stripe" as const,
      bankName: "",
      bankCode: "",
      accountName: "",
      accountNumber: "",
      status: "pending_connect" as const,
      verifiedAt: null,
    },
    paystackRecipientCode: null as string | null,
    stripeAccountId: null as string | null,
  };
}

async function resolvePayoutProfile(region: string, payout: any) {
  const code = String(region || "NG").trim().toUpperCase();
  if (code === "NG") {
    return buildNgnPayout(payout || {});
  }
  return buildConnectPayout(code);
}

function stripSecrets(doc: any) {
  if (!doc) return doc;
  const o = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  delete o.paystackRecipientCode;
  delete o.stripeAccountId;
  return o;
}

/** Net amount the seller earns from one paid order (after platform fee). */
function sellerAmountFromOrder(order: any): number {
  const fee = order.feeBreakdown || {};
  let amount = Number(fee.sellerPayoutAmount);
  if (Number.isFinite(amount) && amount > 0) return amount;

  const sub = Number(fee.subtotal ?? order.subtotal) || 0;
  const rate = Number(fee.platformFeeRate) || 0.08;
  const platformFee =
    Number(fee.platformFee) || Math.round(sub * rate * 100) / 100;
  const shipping = Number(fee.shippingCost ?? order.shippingCost) || 0;
  return Math.max(0, sub - platformFee + shipping);
}

function orderCountsAsPaidMoney(order: any): boolean {
  const status = String(order.orderStatus || "");
  return (
    order.paymentStatus === "paid" &&
    status !== "Cancelled" &&
    order.paymentLifecycle !== "REFUNDED" &&
    order.paymentLifecycle !== "PAYMENT_FAILED" &&
    order.paymentLifecycle !== "CANCELLED"
  );
}

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
      bankCode,
      accountName,
      accountNumber,
      marketplaceRegion,
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

    if (user.role === "seller" || user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "You are already a seller or admin",
      });
    }

    const region =
      String(marketplaceRegion || "NG").trim().toUpperCase() || "NG";
    let profile;
    try {
      profile = await resolvePayoutProfile(region, {
        bankName,
        bankCode,
        accountName,
        accountNumber,
      });
    } catch (err: any) {
      return res.status(err.statusCode || 400).json({
        success: false,
        message: err.message || "Payout details are invalid",
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
        marketplaceRegion: region,
        sellerAppliedAt: new Date(),
        isSellerVerified: true,
        sellerOnboardingCompleted: false,
        sellerOnboardingVersion: 0,
        businessLocationCompleted: false,
        payout: profile.payout,
        paystackRecipientCode: profile.paystackRecipientCode,
        stripeAccountId: profile.stripeAccountId,
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
      message:
        profile.payout.status === "pending_connect"
          ? "You are now a seller. Stripe Connect will be linked before payouts."
          : profile.payout.status === "verified"
            ? "You are now a seller. Payout account verified with Paystack."
            : "You are now a seller. Payout account saved. It will be verified when Paystack keys are set.",
      data: stripSecrets(updated),
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Seller dashboard stats — revenue is net seller payout amount.
 * Returns totalRevenue, pendingPayout, paidOut for the wallet UI.
 */
export const getSellerDashboard = async (req: Request, res: Response) => {
  try {
    const sellerId = (req as any).user._id;
    const user = (req as any).user;

    const [totalProducts, activeProducts, orders] = await Promise.all([
      Product.countDocuments({ seller: sellerId }),
      Product.countDocuments({ seller: sellerId, isActive: true }),
      Order.find({
        seller: sellerId,
        isSellerOwnedPurchase: { $ne: true },
      })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    let totalRevenue = 0;
    let pendingPayout = 0;
    let paidOut = 0;
    let pendingOrders = 0;
    let completedOrders = 0;

    const PENDING_PAYOUT_STATUSES = new Set([
      "awaiting_buyer",
      "eligible",
      "queued",
      "initiated",
    ]);
    const PAID_OUT_STATUSES = new Set(["completed"]);

    for (const order of orders) {
      const status = String(order.orderStatus || "");
      if (status === "Preparing" || status === "Shipped") pendingOrders += 1;
      if (status === "Delivered") completedOrders += 1;

      if (!orderCountsAsPaidMoney(order)) continue;

      const sellerAmount = sellerAmountFromOrder(order);
      totalRevenue += sellerAmount;

      const payoutStatus = String(order.payout?.status || "not_eligible");
      if (
        PAID_OUT_STATUSES.has(payoutStatus) ||
        order.paymentLifecycle === "SELLER_PAID"
      ) {
        paidOut += sellerAmount;
      } else if (PENDING_PAYOUT_STATUSES.has(payoutStatus)) {
        pendingPayout += sellerAmount;
      } else if (
        order.paymentLifecycle === "DELIVERY_CONFIRMED" ||
        order.paymentLifecycle === "SELLER_PAYOUT_PENDING" ||
        (status === "Delivered" && payoutStatus !== "not_eligible")
      ) {
        pendingPayout += sellerAmount;
      }
    }

    // Prefer Payout collection when transfer records exist
    try {
      const payoutAgg = await Payout.aggregate([
        {
          $match: {
            seller: sellerId,
            status: { $in: ["success", "queued", "initiated"] },
          },
        },
        {
          $group: {
            _id: "$status",
            total: { $sum: "$amount" },
          },
        },
      ]);
      let fromDocsPaid = 0;
      let fromDocsPending = 0;
      for (const row of payoutAgg) {
        if (row._id === "success") fromDocsPaid += row.total || 0;
        else fromDocsPending += row.total || 0;
      }
      if (fromDocsPaid > 0) paidOut = fromDocsPaid;
      if (fromDocsPending > 0) pendingPayout = fromDocsPending;
    } catch {
      // Order-based numbers still apply if Payout query fails
    }

    const plan =
      user?.subscription?.planId ||
      user?.subscription?.plan ||
      user?.sellerPlan ||
      user?.plan ||
      "free";

    const region = String(user?.marketplaceRegion || "NG").toUpperCase();
    const currency =
      orders.find((o: any) => o.currency)?.currency ||
      regionCurrency(region);

    res.json({
      success: true,
      data: {
        totalProducts,
        activeProducts,
        totalOrders: orders.length,
        pendingOrders,
        completedOrders,
        totalRevenue,
        revenue: totalRevenue,
        pendingPayout,
        paidOut,
        currency,
        storeName: user.storeName || "",
        isVerified: !!user.isSellerVerified,
        plan,
      },
    });
  } catch (error: any) {
    console.error("getSellerDashboard:", error);
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

const STORE_SELECT =
  "name email phone storeName storeDescription businessGoal storeLogo storeBanner payout shippingDefaults isSellerVerified sellerAppliedAt role marketplaceRegion";

// GET /api/seller/store
export const getMyStore = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const full = await User.findById(user._id).select(STORE_SELECT);

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

    const existing = await User.findById(user._id).select(
      "marketplaceRegion payout"
    );
    const region = String(existing?.marketplaceRegion || "NG").toUpperCase();

    let payout = body.payout;
    if (typeof payout === "string") {
      try {
        payout = JSON.parse(payout);
      } catch {
        payout = null;
      }
    }
    if (payout && typeof payout === "object") {
      const profile = await resolvePayoutProfile(region, payout);
      updates.payout = profile.payout;
      updates.paystackRecipientCode = profile.paystackRecipientCode;
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
          landmark: String(addr.landmark || "").trim(),
          label: String(addr.label || "").trim(),
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
    }).select(STORE_SELECT);

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("updateMyStore:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * PUBLIC storefront
 * Critical: products MUST include `region` so clients can convert
 * product.price (locked at creation) → buyer's marketplace currency.
 */
export const getPublicStorefront = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Store id is required",
      });
    }

    const seller = await User.findById(id).select(
      "storeName storeDescription businessGoal storeLogo storeBanner role isSellerVerified name shippingDefaults marketplaceRegion"
    );

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    if (seller.role !== "seller" && seller.role !== "admin") {
      return res.status(404).json({
        success: false,
        message: "This user does not have a public store",
      });
    }

    const products = await Product.find({
      seller: seller._id,
      isActive: true,
    })
      .select(
        "name price images category subCategory brand shipping isFeatured createdAt region"
      )
      .sort({ createdAt: -1 })
      .limit(60);

    const addr = seller.shippingDefaults?.address;

    res.json({
      success: true,
      data: {
        store: {
          id: seller._id,
          storeName: seller.storeName || seller.name || "Store",
          storeDescription: seller.storeDescription || "",
          businessGoal: seller.businessGoal || "",
          storeLogo: seller.storeLogo || "",
          storeBanner: seller.storeBanner || "",
          isVerified: !!seller.isSellerVerified,
          marketplaceRegion: seller.marketplaceRegion || "NG",
          location: {
            state: addr?.state || "",
            country: addr?.country || "",
          },
        },
        products,
        modules: {
          buyerConfidence: null,
          plazoreAI: null,
          recommendations: null,
        },
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

// Get seller's orders (top-level seller field — not items.seller)
export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const sellerId = (req as any).user._id;

    const orders = await Order.find({ seller: sellerId })
      .populate("buyer", "name email")
      .populate("items.product", "name images")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update order status for seller's order
export const updateMyOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderStatus } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const sellerId = String((req as any).user._id);
    const ownsOrder =
      String(order.seller) === sellerId || (req as any).user.role === "admin";

    if (!ownsOrder) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (orderStatus) order.orderStatus = orderStatus;
    if (orderStatus === "Delivered" || orderStatus === "delivered") {
      order.deliveredAt = new Date();
    }

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

    const full = await User.findById(user._id).select(
      "payout marketplaceRegion"
    );
    if (!full) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const stored = String(full.payout?.accountNumber ?? "").replace(/\D/g, "");
    const pendingConnect = full.payout?.status === "pending_connect";

    if (pendingConnect || !stored || stored.length < 4) {
      return res.json({
        success: true,
        data: {
          unlocked: true,
          setupRequired: !pendingConnect,
          pendingConnect: !!pendingConnect,
        },
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
      data: { unlocked: true, setupRequired: false, pendingConnect: false },
    });
  } catch (error: any) {
    console.error("verifyPayoutAccess:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Verification failed",
    });
  }
};

// ====================== SELLER ONBOARDING ======================

const CURRENT_ONBOARDING_VERSION = 1;

export const getOnboardingStatus = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const full = await User.findById(user._id).select(
      "role sellerAppliedAt sellerOnboardingCompleted sellerOnboardingVersion sellerOnboardingCompletedAt businessLocationCompleted businessLocationCompletedAt shippingDefaults marketplaceRegion storeName"
    );

    if (!full) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (full.role !== "seller" && full.role !== "admin") {
      return res.json({
        success: true,
        data: {
          isSeller: false,
          needsOnboarding: false,
          needsBusinessLocation: false,
        },
      });
    }

    if (full.role === "admin") {
      return res.json({
        success: true,
        data: {
          isSeller: true,
          needsOnboarding: false,
          needsBusinessLocation: false,
          sellerOnboardingCompleted: true,
          businessLocationCompleted: true,
        },
      });
    }

    const addr = full.shippingDefaults?.address;
    const hasExistingLocation = !!(addr?.city && addr?.country);

    let onboardingDone =
      !!full.sellerOnboardingCompleted &&
      (full.sellerOnboardingVersion ?? 0) >= CURRENT_ONBOARDING_VERSION;

    if (!onboardingDone && full.sellerAppliedAt) {
      const appliedMs = new Date(full.sellerAppliedAt).getTime();
      const featureLaunchMs = new Date("2026-10-04T00:00:00Z").getTime();
      if (appliedMs < featureLaunchMs || hasExistingLocation) {
        onboardingDone = true;
      }
    }

    let locationDone = !!full.businessLocationCompleted || hasExistingLocation;

    return res.json({
      success: true,
      data: {
        isSeller: true,
        needsOnboarding: !onboardingDone,
        needsBusinessLocation: onboardingDone && !locationDone,
        sellerOnboardingCompleted: onboardingDone,
        sellerOnboardingVersion: full.sellerOnboardingVersion ?? 0,
        businessLocationCompleted: locationDone,
        businessLocation: addr
          ? {
              street: addr.street || "",
              city: addr.city || "",
              state: addr.state || "",
              zipCode: addr.zipCode || "",
              country: addr.country || "",
              landmark: (addr as any).landmark || "",
              label: (addr as any).label || "",
            }
          : null,
        marketplaceRegion: full.marketplaceRegion || "NG",
        storeName: full.storeName || "",
      },
    });
  } catch (error: any) {
    console.error("getOnboardingStatus:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load onboarding status",
    });
  }
};

export const completeSellerOnboarding = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);

    if (user.role !== "seller" && user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only sellers can complete onboarding",
      });
    }

    const updated = await User.findByIdAndUpdate(
      user._id,
      {
        sellerOnboardingCompleted: true,
        sellerOnboardingVersion: CURRENT_ONBOARDING_VERSION,
        sellerOnboardingCompletedAt: new Date(),
      },
      { new: true }
    ).select(
      "sellerOnboardingCompleted sellerOnboardingVersion businessLocationCompleted"
    );

    return res.json({
      success: true,
      message: "Onboarding completed. Please set your business location.",
      data: {
        sellerOnboardingCompleted: true,
        sellerOnboardingVersion: CURRENT_ONBOARDING_VERSION,
        needsBusinessLocation: !updated?.businessLocationCompleted,
      },
    });
  } catch (error: any) {
    console.error("completeSellerOnboarding:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to complete onboarding",
    });
  }
};

export const completeBusinessLocation = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);

    if (user.role !== "seller" && user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only sellers can set business location",
      });
    }

    const { street, city, state, zipCode, country, landmark, label } =
      req.body || {};

    if (!country?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Country is required",
      });
    }
    if (!city?.trim()) {
      return res.status(400).json({
        success: false,
        message: "City is required",
      });
    }
    if (!street?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Business address is required",
      });
    }

    const address = {
      street: String(street).trim(),
      city: String(city).trim(),
      state: String(state || "").trim(),
      zipCode: String(zipCode || "").trim(),
      country: String(country).trim(),
      landmark: String(landmark || "").trim(),
      label: String(label || "").trim(),
    };

    const existing = await User.findById(user._id).select("shippingDefaults");
    const prevDefaults = existing?.shippingDefaults || {};

    await User.findByIdAndUpdate(
      user._id,
      {
        shippingDefaults: {
          address,
          deliveryMethod: (prevDefaults as any).deliveryMethod || "",
          courierCompany: (prevDefaults as any).courierCompany || "",
        },
        businessLocationCompleted: true,
        businessLocationCompletedAt: new Date(),
        sellerOnboardingCompleted: true,
        sellerOnboardingVersion: CURRENT_ONBOARDING_VERSION,
        sellerOnboardingCompletedAt:
          existing && (existing as any).sellerOnboardingCompletedAt
            ? (existing as any).sellerOnboardingCompletedAt
            : new Date(),
      },
      { new: true }
    );

    return res.json({
      success: true,
      message: "Business location saved. Welcome to your seller dashboard.",
      data: {
        businessLocationCompleted: true,
        sellerOnboardingCompleted: true,
        businessLocation: address,
      },
    });
  } catch (error: any) {
    console.error("completeBusinessLocation:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save business location",
    });
  }
};

export const updateBusinessLocation = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);

    if (user.role !== "seller" && user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only sellers can update business location",
      });
    }

    const { street, city, state, zipCode, country, landmark, label } =
      req.body || {};

    if (!country?.trim() || !city?.trim() || !street?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Country, city and business address are required",
      });
    }

    const address = {
      street: String(street).trim(),
      city: String(city).trim(),
      state: String(state || "").trim(),
      zipCode: String(zipCode || "").trim(),
      country: String(country).trim(),
      landmark: String(landmark || "").trim(),
      label: String(label || "").trim(),
    };

    const updated = await User.findByIdAndUpdate(
      user._id,
      {
        "shippingDefaults.address": address,
        businessLocationCompleted: true,
        businessLocationCompletedAt: new Date(),
      },
      { new: true }
    ).select("shippingDefaults businessLocationCompleted");

    return res.json({
      success: true,
      message: "Business location updated",
      data: {
        businessLocation: updated?.shippingDefaults?.address || address,
        businessLocationCompleted: true,
      },
    });
  } catch (error: any) {
    console.error("updateBusinessLocation:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update business location",
    });
  }
};
