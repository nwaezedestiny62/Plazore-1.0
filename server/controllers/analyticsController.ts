import { Request, Response } from "express";
import mongoose from "mongoose";
import Product from "../models/Products.js";
import ProductPerformance from "../models/ProductPerformance.js";
import {
  trackProductPerformance,
  PerfAction,
} from "../utils/performance.js";

const getUser = (req: Request) => (req as any).user;

export const trackEvent = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { productId, action, quantity } = req.body;

    if (!productId || !["view", "cart", "purchase"].includes(String(action))) {
      return res.status(400).json({
        success: false,
        message: "productId and action (view|cart|purchase) required",
      });
    }

    const doc = await trackProductPerformance({
      productId: String(productId),
      action: action as PerfAction,
      actorUserId: user?._id?.toString?.() || null,
      quantity,
    });

    res.json({ success: true, data: doc });
  } catch (error: any) {
    console.error("trackEvent error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSellerAnalytics = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const days = Math.min(90, Math.max(7, Number(req.query.range) || 30));

    const perfs = await ProductPerformance.find({ seller: user._id })
      .populate("product", "name images price isActive")
      .sort({ score: -1 })
      .lean();

    const keys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }

    const series = keys.map((date) => {
      let score = 0;
      let views = 0;
      let cartAdds = 0;
      let purchases = 0;
      for (const p of perfs) {
        const row = (p.daily || []).find((x: any) => x.date === date);
        if (row) {
          score += row.score || 0;
          views += row.views || 0;
          cartAdds += row.cartAdds || 0;
          purchases += row.purchases || 0;
        }
      }
      return { date, score, views, cartAdds, purchases };
    });

    const topProducts = perfs.slice(0, 7).map((p: any) => ({
      productId: p.product?._id || p.product,
      name: p.product?.name || "Product",
      image: p.product?.images?.[0] || "",
      score: p.score || 0,
      views: p.views || 0,
      cartAdds: p.cartAdds || 0,
      purchases: p.purchases || 0,
      milestone200: !!p.milestones?.p200,
    }));

    const totals = {
      score: perfs.reduce((s, p) => s + (p.score || 0), 0),
      views: perfs.reduce((s, p) => s + (p.views || 0), 0),
      cartAdds: perfs.reduce((s, p) => s + (p.cartAdds || 0), 0),
      purchases: perfs.reduce((s, p) => s + (p.purchases || 0), 0),
    };

    res.json({
      success: true,
      data: { series, topProducts, totals, rangeDays: days },
    });
  } catch (error: any) {
    console.error("getSellerAnalytics error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductAnalytics = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { id } = req.params;

    if (!id || !mongoose.isValidObjectId(String(id))) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const product = await Product.findById(id)
      .select("name images seller")
      .lean();

    if (!product) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    if (
      product.seller.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    let perf: any = await ProductPerformance.findOne({ product: id }).lean();
    if (!perf) {
      perf = {
        views: 0,
        cartAdds: 0,
        purchases: 0,
        score: 0,
        daily: [],
        milestones: {},
      };
    }

    const days = 30;
    const keys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }

    const series = keys.map((date) => {
      const row = (perf.daily || []).find((x: any) => x.date === date);
      return {
        date,
        score: row?.score || 0,
        views: row?.views || 0,
        cartAdds: row?.cartAdds || 0,
        purchases: row?.purchases || 0,
      };
    });

    res.json({
      success: true,
      data: {
        product: {
          id: product._id,
          name: product.name,
          image: product.images?.[0] || "",
        },
        views: perf.views || 0,
        cartAdds: perf.cartAdds || 0,
        purchases: perf.purchases || 0,
        score: perf.score || 0,
        milestones: perf.milestones || {},
        series,
      },
    });
  } catch (error: any) {
    console.error("getProductAnalytics error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};