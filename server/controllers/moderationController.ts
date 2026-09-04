import { Request, Response } from "express";
import User from "../models/User.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
import Address from "../models/Address.js";
import Wishlist from "../models/Wishlist.js";
import PaymentMethod from "../models/PaymentMethod.js";
import SavedStores from "../models/SavedStores.js";
import Report from "../models/Report.js";
import ModerationCase from "../models/ModerationCase.js";
import ModerationEvent from "../models/ModerationEvent.js";
import { getCtx, resolveExpired, ModContext } from "../utils/moderation.js";

type Context = ModContext;

function ensureModerationShape(user: any) {
  if (!user.moderation) {
    user.moderation = { buyer: {}, seller: {} };
  }
  if (!user.moderation.buyer) {
    user.moderation.buyer = {};
  }
  if (!user.moderation.seller) {
    user.moderation.seller = {};
  }
}

async function applyState(
  user: any,
  context: Context,
  status: string,
  opts: {
    reason?: string;
    publicReason?: string;
    endsAt?: Date | null;
    caseId?: any;
    lastOutcome?: string | null;
  }
) {
  ensureModerationShape(user);

  const side = user.moderation[context];
  const prev = (side.status as string) || "NORMAL";

  side.status = status;
  side.reason = opts.reason ?? side.reason ?? "";
  side.publicReason = opts.publicReason ?? side.publicReason ?? "";
  side.startedAt = new Date();
  side.updatedAt = new Date();

  if (opts.endsAt === null) {
    side.endsAt = undefined;
  } else if (opts.endsAt !== undefined) {
    side.endsAt = opts.endsAt;
  }

  if (opts.caseId !== undefined) {
    side.caseId = opts.caseId;
  }

  if (opts.lastOutcome === null) {
    side.lastOutcome = undefined;
  } else if (opts.lastOutcome !== undefined) {
    side.lastOutcome = opts.lastOutcome;
  }

  if (context === "seller") {
    user.isSellerSuspended = status === "SUSPENDED" || status === "BLOCKED";
  }

  user.markModified("moderation");
  await user.save();
  return prev;
}

async function logEvent(payload: Record<string, any>) {
  return ModerationEvent.create(payload);
}

export const getModerationStats = async (_req: Request, res: Response) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      pendingChecks,
      underReview,
      sellerSuspensions,
      buyerSuspensions,
      sellerBlocks,
      buyerBlocks,
      recentlyPardoned,
      recentlyRestored,
      recentEvents,
    ] = await Promise.all([
      ModerationCase.countDocuments({
        status: { $in: ["ACTIVITY_CHECK", "UNDER_REVIEW"] },
        active: true,
      }),
      ModerationCase.countDocuments({ status: "UNDER_REVIEW", active: true }),
      User.countDocuments({ "moderation.seller.status": "SUSPENDED" }),
      User.countDocuments({ "moderation.buyer.status": "SUSPENDED" }),
      User.countDocuments({ "moderation.seller.status": "BLOCKED" }),
      User.countDocuments({ "moderation.buyer.status": "BLOCKED" }),
      ModerationEvent.countDocuments({
        action: "PARDONED",
        createdAt: { $gte: sevenDaysAgo },
      }),
      ModerationEvent.countDocuments({
        action: {
          $in: ["LIFTED_SUSPENSION", "LIFTED_BLOCK", "RESTORED", "EXPIRED_AUTO_LIFT"],
        },
        createdAt: { $gte: sevenDaysAgo },
      }),
      ModerationEvent.find()
        .sort({ createdAt: -1 })
        .limit(15)
        .populate("user", "name email role storeName")
        .populate("admin", "name email")
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        pendingChecks,
        underReview,
        sellerSuspensions,
        buyerSuspensions,
        sellerBlocks,
        buyerBlocks,
        recentlyPardoned,
        recentlyRestored,
        recentEvents,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const listModerationCases = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
    const context = String(req.query.context || "").trim();
    const status = String(req.query.status || "").trim();
    const activeOnly = String(req.query.active || "true") !== "false";

    const filter: Record<string, any> = {};
    if (activeOnly) filter.active = true;
    if (context === "buyer" || context === "seller") filter.context = context;
    if (status) filter.status = status;

    const [items, total] = await Promise.all([
      ModerationCase.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "name email role storeName image marketplaceRegion")
        .populate("openedBy", "name email")
        .populate("resolvedBy", "name email")
        .lean(),
      ModerationCase.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const searchModerationAccounts = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ success: true, data: [] });

    const filter: Record<string, any> = {
      $or: [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { storeName: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ],
    };

    if (/^[a-f\d]{24}$/i.test(q)) {
      filter.$or.push({ _id: q });
    }

    const users = await User.find(filter)
      .limit(25)
      .select(
        "name email role storeName image phone marketplaceRegion isSellerSuspended isSellerVerified moderation createdAt updatedAt"
      )
      .lean();

    res.json({ success: true, data: users });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getModerationProfile = async (req: Request, res: Response) => {
  try {
    let live: any = await User.findById(req.params.id);
    if (!live) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    live = await resolveExpired(live, "buyer");
    live = await resolveExpired(live, "seller");

    const user: any = await User.findById(req.params.id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const [
      cases,
      events,
      reports,
      products,
      productCount,
      orderAsBuyer,
      orderAsSeller,
      recentOrdersBuyer,
      recentOrdersSeller,
      addresses,
      paymentMethods,
      wishlistDoc,
      savedStoresDoc,
    ] = await Promise.all([
      ModerationCase.find({ user: user._id }).sort({ createdAt: -1 }).limit(25).lean(),
      ModerationEvent.find({ user: user._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("admin", "name email")
        .lean(),
      Report.find({ $or: [{ reporter: user._id }, { seller: user._id }] })
        .sort({ createdAt: -1 })
        .limit(25)
        .lean(),
      user.role === "seller"
        ? Product.find({ seller: user._id })
            .sort({ createdAt: -1 })
            .limit(20)
            .select("name price isActive stock region category createdAt")
            .lean()
        : Promise.resolve([]),
      Product.countDocuments({ seller: user._id }),
      Order.countDocuments({ buyer: user._id }),
      Order.countDocuments({ seller: user._id }),
      Order.find({ buyer: user._id })
        .sort({ createdAt: -1 })
        .limit(8)
        .select("orderNumber orderStatus paymentStatus totalAmount createdAt")
        .lean(),
      Order.find({ seller: user._id })
        .sort({ createdAt: -1 })
        .limit(8)
        .select("orderNumber orderStatus paymentStatus totalAmount createdAt")
        .lean(),
      Address.find({ user: user._id })
        .sort({ isDefault: -1, createdAt: -1 })
        .limit(20)
        .select("type street city state zipCode country isDefault")
        .lean(),
      PaymentMethod.find({ user: user._id })
        .sort({ isDefault: -1, createdAt: -1 })
        .limit(20)
        .select("brand name last4 expMonth expYear isDefault")
        .lean(),
      Wishlist.findOne({ user: user._id })
        .populate("products", "name price isActive")
        .lean(),
      SavedStores.findOne({ user: user._id })
        .populate("stores", "name storeName image")
        .lean(),
    ]);

    const wishlist = ((wishlistDoc as any)?.products || []).map((p: any) => ({
      _id: p?._id,
      name: p?.name,
      price: p?.price,
      isActive: p?.isActive,
    }));

    const savedStores = ((savedStoresDoc as any)?.stores || []).map((s: any) => ({
      _id: s?._id,
      name: s?.storeName || s?.name,
    }));

    res.json({
      success: true,
      data: {
        user,
        buyer: getCtx(user, "buyer"),
        seller: getCtx(user, "seller"),
        cases,
        events,
        reports,
        products,
        addresses,
        paymentMethods,
        wishlist,
        savedStores,
        activity: {
          productCount,
          orderAsBuyer,
          orderAsSeller,
          recentOrdersBuyer,
          recentOrdersSeller,
          addressCount: addresses.length,
          paymentMethodCount: paymentMethods.length,
          wishlistCount: wishlist.length,
          savedStoreCount: savedStores.length,
        },
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const suspendAccount = async (req: Request, res: Response) => {
  try {
    const context = req.body.context as Context;
    if (context !== "buyer" && context !== "seller") {
      return res
        .status(400)
        .json({ success: false, message: "context must be buyer or seller" });
    }

    const reason = String(req.body.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: "Reason is required" });
    }

    const rawHours = req.body.durationHours;
    const rawDays = req.body.durationDays;
    let hours = Number(rawHours);
    if (!Number.isFinite(hours) || hours < 0) {
      const days = Math.max(0, Number(rawDays || 0));
      hours = days * 24;
    }
    hours = Math.max(0, Math.min(24 * 90, Math.floor(hours)));

    const endsAt =
      hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000) : undefined;

    const publicReason =
      context === "seller"
        ? "Seller World is temporarily unavailable. Access returns when this period ends."
        : "Plazore access is temporarily limited. It returns when this period ends.";

    const admin = (req as any).user;
    const user: any = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const prev = getCtx(user, context).status;
    let caseId = getCtx(user, context).caseId;

    if (!caseId) {
      const c = await ModerationCase.create({
        user: user._id,
        context,
        status: "SUSPENDED",
        previousStatus: prev,
        reason,
        publicReason,
        endsAt,
        openedBy: admin._id,
        active: true,
      });
      caseId = c._id;
    } else {
      await ModerationCase.findByIdAndUpdate(caseId, {
        status: "SUSPENDED",
        reason,
        publicReason,
        endsAt: endsAt || null,
        active: true,
      });
    }

    await applyState(user, context, "SUSPENDED", {
      reason,
      publicReason,
      endsAt: endsAt || null,
      caseId,
      lastOutcome: null,
    });

    await logEvent({
      caseId,
      user: user._id,
      context,
      action: "SUSPENDED",
      previousState: prev,
      newState: "SUSPENDED",
      reason,
      publicReason,
      durationHours: hours || undefined,
      endsAt,
      admin: admin._id,
    });

    res.json({
      success: true,
      message: "Account suspended",
      data: {
        context,
        status: "SUSPENDED",
        endsAt: endsAt || null,
        durationHours: hours || null,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const requestActivityCheck = async (req: Request, res: Response) => {
  try {
    const context = req.body.context as Context;
    if (context !== "buyer" && context !== "seller") {
      return res
        .status(400)
        .json({ success: false, message: "context must be buyer or seller" });
    }

    const admin = (req as any).user;
    const user: any = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const prev = getCtx(user, context).status;
    const reason = String(req.body.reason || "Activity check requested").trim();
    const publicReason =
      "We're reviewing your activity to make sure everything is in order.";

    const c = await ModerationCase.create({
      user: user._id,
      context,
      status: "UNDER_REVIEW",
      previousStatus: prev,
      reason,
      publicReason,
      openedBy: admin._id,
      active: true,
    });

    await applyState(user, context, "UNDER_REVIEW", {
      reason,
      publicReason,
      endsAt: null,
      caseId: c._id,
      lastOutcome: null,
    });

    await logEvent({
      caseId: c._id,
      user: user._id,
      context,
      action: "ACTIVITY_CHECK_REQUESTED",
      previousState: prev,
      newState: "UNDER_REVIEW",
      reason,
      publicReason,
      admin: admin._id,
    });

    res.json({
      success: true,
      message: "Activity check started — account is under review",
      data: { caseId: c._id, status: "UNDER_REVIEW", context },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const pardonAccount = async (req: Request, res: Response) => {
  try {
    const context = req.body.context as Context;
    if (context !== "buyer" && context !== "seller") {
      return res
        .status(400)
        .json({ success: false, message: "context must be buyer or seller" });
    }

    const reason = String(req.body.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: "Reason is required" });
    }

    const admin = (req as any).user;
    const user: any = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const prev = getCtx(user, context).status;
    const caseId = getCtx(user, context).caseId;
    const publicReason =
      "We've completed our review and no further action is required on your account.";

    await applyState(user, context, "NORMAL", {
      reason,
      publicReason,
      endsAt: null,
      caseId,
      lastOutcome: "PARDONED",
    });

    if (caseId) {
      await ModerationCase.findByIdAndUpdate(caseId, {
        status: "PARDONED",
        active: false,
        resolvedAt: new Date(),
        resolvedBy: admin._id,
        reason,
      });
    }

    await logEvent({
      caseId: caseId || undefined,
      user: user._id,
      context,
      action: "PARDONED",
      previousState: prev,
      newState: "NORMAL",
      reason,
      publicReason,
      admin: admin._id,
    });

    res.json({
      success: true,
      message: "Account pardoned — access restored",
      data: { context, status: "NORMAL", lastOutcome: "PARDONED" },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};



export const blockAccount = async (req: Request, res: Response) => {
  try {
    const context = req.body.context as Context;
    if (context !== "buyer" && context !== "seller") {
      return res
        .status(400)
        .json({ success: false, message: "context must be buyer or seller" });
    }

    const reason = String(req.body.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: "Reason is required" });
    }

    const publicReason =
  context === "seller"
    ? "Seller World is blocked until Plazore lifts this restriction."
    : "This side of Plazore is blocked until it is lifted.";

    const admin = (req as any).user;
    const user: any = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const prev = getCtx(user, context).status;
    let caseId = getCtx(user, context).caseId;

    if (!caseId) {
      const c = await ModerationCase.create({
        user: user._id,
        context,
        status: "BLOCKED",
        previousStatus: prev,
        reason,
        publicReason,
        openedBy: admin._id,
        active: true,
      });
      caseId = c._id;
    } else {
      await ModerationCase.findByIdAndUpdate(caseId, {
        status: "BLOCKED",
        reason,
        publicReason,
        endsAt: null,
        active: true,
      });
    }

    await applyState(user, context, "BLOCKED", {
      reason,
      publicReason,
      endsAt: null,
      caseId,
      lastOutcome: null,
    });

    await logEvent({
      caseId,
      user: user._id,
      context,
      action: "BLOCKED",
      previousState: prev,
      newState: "BLOCKED",
      reason,
      publicReason,
      admin: admin._id,
    });

    res.json({
      success: true,
      message: "Account blocked",
      data: { context, status: "BLOCKED" },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const liftRestriction = async (req: Request, res: Response) => {
  try {
    const context = req.body.context as Context;
    if (context !== "buyer" && context !== "seller") {
      return res
        .status(400)
        .json({ success: false, message: "context must be buyer or seller" });
    }

    const reason = String(req.body.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: "Reason is required" });
    }

    const admin = (req as any).user;
    const user: any = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const prev = getCtx(user, context).status;
    const caseId = getCtx(user, context).caseId;

    if (!["SUSPENDED", "BLOCKED", "UNDER_REVIEW", "ACTIVITY_CHECK"].includes(prev)) {
      return res.status(400).json({
        success: false,
        message: `Nothing to lift — current status is ${prev}`,
      });
    }

    await applyState(user, context, "NORMAL", {
      reason,
      publicReason: "Your access has been restored",
      endsAt: null,
      caseId,
      lastOutcome: "RESTORED",
    });

    if (caseId) {
      await ModerationCase.findByIdAndUpdate(caseId, {
        status: "RESTORED",
        active: false,
        resolvedAt: new Date(),
        resolvedBy: admin._id,
        reason,
      });
    }

    const action =
      prev === "BLOCKED"
        ? "LIFTED_BLOCK"
        : prev === "SUSPENDED"
          ? "LIFTED_SUSPENSION"
          : "RESTORED";

    await logEvent({
      caseId: caseId || undefined,
      user: user._id,
      context,
      action,
      previousState: prev,
      newState: "NORMAL",
      reason,
      publicReason: "Your access has been restored",
      admin: admin._id,
    });

    res.json({
      success: true,
      message: "Restriction lifted — access restored",
      data: { context, status: "NORMAL", lastOutcome: "RESTORED" },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const addModerationNote = async (req: Request, res: Response) => {
  try {
    const body = String(req.body.body || "").trim();
    if (!body) {
      return res.status(400).json({ success: false, message: "Note body is required" });
    }

    const admin = (req as any).user;
    const c: any = await ModerationCase.findById(req.params.caseId);
    if (!c) {
      return res.status(404).json({ success: false, message: "Case not found" });
    }

    c.internalNotes.push({
      admin: admin._id,
      body,
      createdAt: new Date(),
    });
    await c.save();

    await logEvent({
      caseId: c._id,
      user: c.user,
      context: c.context,
      action: "NOTE_ADDED",
      previousState: c.status,
      newState: c.status,
      reason: body,
      admin: admin._id,
    });

    const populated = await ModerationCase.findById(c._id)
      .populate("internalNotes.admin", "name email")
      .lean();

    res.json({ success: true, data: populated });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getMyModeration = async (req: Request, res: Response) => {
  try {
    let user: any = (req as any).user;
    user = await resolveExpired(user, "buyer");
    user = await resolveExpired(user, "seller");

    const fresh: any = await User.findById(user._id).lean();
    if (!fresh) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      data: {
        buyer: getCtx(fresh, "buyer"),
        seller: getCtx(fresh, "seller"),
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const clearLastOutcome = async (req: Request, res: Response) => {
  try {
    const context = req.body.context as Context;
    if (context !== "buyer" && context !== "seller") {
      return res
        .status(400)
        .json({ success: false, message: "context must be buyer or seller" });
    }

    const user: any = await User.findById((req as any).user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    ensureModerationShape(user);
    user.moderation[context].lastOutcome = undefined;
    user.markModified("moderation");
    await user.save();

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};