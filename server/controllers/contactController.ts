import { Request, Response } from "express";
import mongoose from "mongoose";
import ContactMessage from "../models/ContactMessage.js";
import Report from "../models/Report.js";
import Product from "../models/Products.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

function wordCount(text: string) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function assertWords(text: string, max = 300) {
  const n = wordCount(text);
  if (n < 1) throw new Error("Message is required");
  if (n > max) {
    throw new Error(
      `Message must be ${max} words or fewer (you wrote ${n})`
    );
  }
}

async function safeNotify(payload: {
  user: any;
  title: string;
  message: string;
}) {
  try {
    // Notification.type enum on main only allows order types + "general"
    await Notification.create({
      user: payload.user,
      type: "general",
      title: payload.title,
      message: payload.message,
    });
  } catch (e) {
    console.error("Notification create skipped:", (e as any)?.message);
  }
}

export const createContact = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      contactAs,
      contextType = "general",
      category = "other",
      subject = "",
      message,
      email,
      country,
      state,
      city,
      street = "",
      productId,
      storeId,
      orderId,
    } = req.body || {};

    assertWords(String(message || ""), 300);

    if (!email || !String(email).includes("@")) {
      return res
        .status(400)
        .json({ success: false, message: "Valid email is required" });
    }
    if (!country || !state || !city) {
      return res.status(400).json({
        success: false,
        message: "Country, state, and city are required",
      });
    }

    let role: "buyer" | "seller" =
      contactAs === "seller" ? "seller" : "buyer";
    if (user.role === "seller" && contactAs !== "buyer") role = "seller";
    if (user.role === "buyer") role = "buyer";

    let relatedProduct: any = null;
    let relatedSeller: any = null;
    let relatedOrder: any = null;

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
      : "general";

    if (productId && mongoose.isValidObjectId(productId)) {
      const p = await Product.findById(productId).select("name seller").lean();
      if (p) {
        relatedProduct = p._id;
        relatedSeller = (p as any).seller || null;
        if (ctx === "general") ctx = "product";
      }
    }

    if (storeId && mongoose.isValidObjectId(storeId)) {
      const s = await User.findById(storeId)
        .select("_id role storeName")
        .lean();
      if (s && (s as any).role === "seller") {
        relatedSeller = s._id;
        if (ctx === "general") ctx = "store";
      }
    }

    if (orderId && mongoose.isValidObjectId(orderId)) {
      relatedOrder = orderId;
      if (ctx === "general") ctx = "order";
    }

    // Map UI categories onto schema-safe values
    const categoryMap: Record<string, string> = {
      buying: "buying",
      selling: "selling",
      order_payment: "order_payment",
      delivery: "delivery",
      feedback: "feedback",
      technical: "technical",
      account: "account",
      other: "other",
      // legacy aliases
      order: "order_payment",
      payment: "order_payment",
      seller: "selling",
    };
    const cat = categoryMap[String(category)] || "other";

       const body = String(message).trim();
    const now = new Date();

    const doc = await ContactMessage.create({
      user: user._id,
      contactAs: role,
      // cast so TS accepts dynamic context / category enums
      contextType: ctx as any,
      category: cat as any,
      subject: String(subject || "").slice(0, 200),
      email: String(email).trim().toLowerCase(),
      location: {
        country: String(country).trim(),
        state: String(state).trim(),
        city: String(city).trim(),
        street: String(street || "").trim(),
      },
      relatedProduct,
      relatedSeller,
      relatedOrder,
      message: body,
      messages: [
        {
          senderType: "user" as const,
          sender: user._id,
          body,
          createdAt: now,
        },
      ],
      status: "new" as any,
      priority: "normal" as any,
      unreadByAdmin: true,
      unreadByUser: false,
      lastMessageAt: now,
    });

    res.status(201).json({
      success: true,
      data: { _id: String(doc._id) },
    });
  } catch (error: any) {
    console.error("createContact:", error);
    res.status(400).json({
      success: false,
      message: error?.message || "Failed to submit contact",
    });
  }
};

export const createReport = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      targetType,
      productId,
      storeId,
      reason,
      description,
      email,
      country,
      state,
      city,
      street = "",
    } = req.body || {};

    if (!["product", "store"].includes(String(targetType))) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid targetType" });
    }
    assertWords(String(description || ""), 300);
    if (!reason) {
      return res
        .status(400)
        .json({ success: false, message: "Category is required" });
    }

    let product: any = null;
    let seller: any = null;

    if (targetType === "product") {
      if (!productId || !mongoose.isValidObjectId(productId)) {
        return res
          .status(400)
          .json({ success: false, message: "productId required" });
      }
      const p = await Product.findById(productId).select("seller").lean();
      if (!p) {
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }
      product = p._id;
      seller = (p as any).seller || null;
    } else {
      if (!storeId || !mongoose.isValidObjectId(storeId)) {
        return res
          .status(400)
          .json({ success: false, message: "storeId required" });
      }
      seller = storeId;
    }

    // Prefer new statuses; fall back to "new" if schema rejects "Submitted"
      let report: any;
    try {
      report = await Report.create({
        reporter: user._id,
        reporterRole: (user.role === "seller" ? "seller" : "buyer") as any,
        targetType: targetType as any,
        product,
        seller,
        reason: String(reason) as any,
        description: String(description).trim(),
        email: String(email || user.email || "").trim(),
        location: {
          country: String(country || "").trim(),
          state: String(state || "").trim(),
          city: String(city || "").trim(),
          street: String(street || "").trim(),
        },
        status: "Submitted" as any,
        priority: "normal" as any,
      });
    } catch {
      report = await Report.create({
        reporter: user._id,
        targetType: targetType as any,
        product,
        seller,
        reason: String(reason) as any,
        description: String(description).trim(),
        status: "new" as any,
        priority: "normal" as any,
      });
    }

    await safeNotify({
      user: user._id,
      title: "Report received",
      message: "We've received your report and will review it.",
    });

    res.status(201).json({
      success: true,
      data: { _id: String(report._id) },
    });
  } catch (error: any) {
    console.error("createReport:", error);
    res.status(400).json({
      success: false,
      message: error?.message || "Failed to submit report",
    });
  }
};

export const myContacts = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const items = await ContactMessage.find({ user: user._id })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .limit(50)
      .select("-internalNotes")
      .lean();

    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const myContactDetail = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const item = await ContactMessage.findOne({
      _id: req.params.id,
      user: user._id,
    })
      .select("-internalNotes")
      .populate("relatedProduct", "name images")
      .populate("relatedSeller", "name storeName")
      .lean();

    if (!item) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    await ContactMessage.updateOne(
      { _id: item._id },
      { $set: { unreadByUser: false } }
    ).catch(() => {});

    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const replyMyContact = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const body = String(req.body?.message || "").trim();
    assertWords(body, 300);

    const item = await ContactMessage.findOne({
      _id: req.params.id,
      user: user._id,
    });
    if (!item) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    if (String(item.status) === "closed") {
      return res
        .status(400)
        .json({ success: false, message: "Conversation is closed" });
    }

    const now = new Date();
    if (!Array.isArray((item as any).messages)) {
      (item as any).messages = [];
    }
       (item as any).messages.push({
      senderType: "user",
      sender: user._id,
      body,
      createdAt: now,
    });
    (item as any).status = "awaiting_plazore";
    (item as any).unreadByAdmin = true;
    (item as any).unreadByUser = false;
    (item as any).lastMessageAt = now;
    (item as any).message = body;
    await item.save();

    res.json({ success: true, data: { _id: String(item._id) } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};