import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import ProductAI from "../models/ProductAI.js";
import ProductPerformance from "../models/ProductPerformance.js";
import ShowroomSession from "../models/ShowroomSession.js";
import ShowroomEvent from "../models/ShowroomEvent.js";
import {
  generateShowroom,
  ROOM_CAPACITY,
  SESSION_TTL_MS,
} from "../services/showroomRanker.js";
import { enqueueProductAI } from "../services/jobs/generateProductAI.js";
import { generateProductFingerprint } from "../services/plazoreAI/index.js";

const FIRST_200 = 200;

const ALGORITHM = {
  version: "V1",
  name: "Plazore Showroom Ranker",
  type: "deterministic_commerce_first",
  sessionTtlMs: SESSION_TTL_MS,
  refreshIntervalLabel: "6 hours (session TTL)",
  capacities: ROOM_CAPACITY,
  eligibility: ["Product isActive = true", "stock > 0"],
  rankingSignals: [
    { name: "Regional relevance", weight: "primary", notes: "Local match, then nearby, then fallback" },
    { name: "Commerce health", weight: "high", notes: "Purchases, carts, views, wishlist, conversion" },
    { name: "Freshness", weight: "medium", notes: "Decays over ~21 days" },
    { name: "Interest match", weight: "high", notes: "From showroom session behavior when a user exists" },
    { name: "Exploration", weight: "medium", notes: "New / underexposed products" },
    { name: "Quality & availability", weight: "low", notes: "Images, stock, featured, active" },
    { name: "Exposure penalty", weight: "control", notes: "Repetition control unless positive engagement" },
  ],
  diversity: {
    room1: { maxPerCategory: 14, maxPerSeller: 7 },
    room2: { maxPerCategory: 5, maxPerSeller: 3 },
    room3: { maxPerCategory: 6, maxPerSeller: 3 },
    room4: { maxPerCategory: 10, maxPerSeller: 5 },
  },
  reusePolicy:
    "Rooms 1–2 are the primary unique set. Rooms 3–4 may reuse earlier products when inventory is thin (room 3 if candidates < 40, room 4 if candidates < 80), then fill-short as last resort.",
  regionalFallback:
    "Prefer the selected region. If local eligible inventory is under 120, supplement with other regions.",
};

function asId(v: any) {
  return String(v || "");
}

function dist(items: any[], keyFn: (p: any) => string) {
  const map: Record<string, number> = {};
  for (const p of items) {
    const k = keyFn(p) || "—";
    map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));
}

function compactProduct(p: any) {
  if (!p) return null;
  const seller = p.seller && typeof p.seller === "object" ? p.seller : null;
  return {
    _id: asId(p._id),
    name: p.name,
    images: p.images || [],
    price: p.price,
    category: p.category || "",
    subCategory: p.subCategory || "",
    brand: p.brand || "",
    region: p.region || "",
    stock: p.stock ?? 0,
    isActive: p.isActive !== false,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    seller: seller
      ? {
          _id: asId(seller._id),
          name: seller.name,
          storeName: seller.storeName,
          email: seller.email,
          isSellerSuspended: !!seller.isSellerSuspended,
        }
      : null,
  };
}

async function hydrateRooms(idsByRoom: {
  1?: string[];
  2?: string[];
  3?: string[];
  4?: string[];
}) {
  const all = [
    ...(idsByRoom[1] || []),
    ...(idsByRoom[2] || []),
    ...(idsByRoom[3] || []),
    ...(idsByRoom[4] || []),
  ].filter(Boolean);
  const unique = [...new Set(all.map(asId))];
  const docs = unique.length
    ? await Product.find({ _id: { $in: unique } })
        .populate("seller", "name storeName email isSellerSuspended")
        .lean()
    : [];
  const map = new Map(docs.map((p: any) => [asId(p._id), p]));
  const pick = (ids?: string[]) =>
    (ids || []).map((id) => compactProduct(map.get(asId(id)))).filter(Boolean);
  return {
    1: pick(idsByRoom[1]),
    2: pick(idsByRoom[2]),
    3: pick(idsByRoom[3]),
    4: pick(idsByRoom[4]),
  };
}

function roomStats(products: any[], capacity: number, earlierIds: Set<string>) {
  const populated = products.length;
  const reused = products.filter((p) => earlierIds.has(asId(p._id))).length;
  return {
    capacity,
    populated,
    fillPct: capacity ? Math.round((populated / capacity) * 100) : 0,
    reusedFromEarlier: reused,
    unique: populated - reused,
    categories: dist(products, (p) => p.category),
    sellers: dist(products, (p) => p.seller?.storeName || p.seller?.name || "—").slice(0, 8),
    regions: dist(products, (p) => p.region),
    products,
  };
}

function showroomHealth(input: {
  eligible: number;
  localEligible: number;
  categoryCount: number;
  populatedTotal: number;
  capacityTotal: number;
  sessionOk: boolean;
}) {
  const issues: { code: string; label: string }[] = [];
  if (!input.sessionOk) {
    issues.push({ code: "refresh_issue", label: "No valid showroom session for this region" });
  }
  if (input.eligible < 20) {
    issues.push({ code: "limited_inventory", label: "Limited eligible inventory" });
  }
  if (input.localEligible < 40) {
    issues.push({ code: "regional_shortage", label: "Regional inventory shortage" });
  }
  if (input.eligible >= 20 && input.categoryCount < 3) {
    issues.push({ code: "category_diversity", label: "Insufficient category diversity" });
  }
  if (input.eligible < input.capacityTotal && input.populatedTotal < input.capacityTotal) {
    issues.push({ code: "eligibility_shortage", label: "Not enough eligible products to fill all slots" });
  }

  let status: "healthy" | "watch" | "issue" = "healthy";
  let label = "Healthy";
  if (issues.some((i) => i.code === "refresh_issue")) {
    status = "issue";
    label = "Algorithm refresh issue";
  } else if (issues.length >= 1) {
    status = "watch";
    label = issues[0].label;
  }
  return { status, label, issues };
}

export const getAdminShowroom = async (req: Request, res: Response) => {
  try {
    const region = String(req.query.region || "NG").trim() || "NG";
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const baseEligible = { isActive: true, stock: { $gt: 0 } };

    const [
      totalActive,
      eligible,
      localEligible,
      outOfStock,
      inactive,
      recentAdded,
      recentUpdated,
      categoryRows,
      sellerCount,
      regionRows,
      latestSession,
      sessionCount,
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Product.countDocuments(baseEligible),
      Product.countDocuments({ ...baseEligible, region }),
      Product.countDocuments({ isActive: true, stock: { $lte: 0 } }),
      Product.countDocuments({ isActive: false }),
      Product.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Product.countDocuments({ updatedAt: { $gte: sevenDaysAgo } }),
      Product.aggregate([
        { $match: baseEligible },
        { $group: { _id: "$category", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 20 },
      ]),
      Product.distinct("seller", baseEligible as any),
      Product.aggregate([
        { $match: baseEligible },
        { $group: { _id: "$region", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
      ]),
      ShowroomSession.findOne({ region }).sort({ updatedAt: -1 }).lean(),
      ShowroomSession.countDocuments({ region }),
    ]);

    let session = latestSession as any;
    if (!session) {
      const generated = await generateShowroom({ region, forceRefresh: true });
      session = await ShowroomSession.findOne({ sessionId: generated.sessionId }).lean();
    }

    const idsByRoom = {
      1: (session?.productIdsByRoom?.[1] || []).map(asId),
      2: (session?.productIdsByRoom?.[2] || []).map(asId),
      3: (session?.productIdsByRoom?.[3] || []).map(asId),
      4: (session?.productIdsByRoom?.[4] || []).map(asId),
    };

    const roomsHydrated = await hydrateRooms(idsByRoom);
    const earlier12 = new Set([...idsByRoom[1], ...idsByRoom[2]]);
    const earlier123 = new Set([...earlier12, ...idsByRoom[3]]);

    const sections = {
      1: roomStats(roomsHydrated[1], ROOM_CAPACITY[1], new Set()),
      2: roomStats(roomsHydrated[2], ROOM_CAPACITY[2], new Set(idsByRoom[1])),
      3: roomStats(roomsHydrated[3], ROOM_CAPACITY[3], earlier12),
      4: roomStats(roomsHydrated[4], ROOM_CAPACITY[4], earlier123),
    };

    const populatedTotal =
      sections[1].populated +
      sections[2].populated +
      sections[3].populated +
      sections[4].populated;
    const capacityTotal =
      ROOM_CAPACITY[1] + ROOM_CAPACITY[2] + ROOM_CAPACITY[3] + ROOM_CAPACITY[4];

    const health = showroomHealth({
      eligible,
      localEligible,
      categoryCount: categoryRows.length,
      populatedTotal,
      capacityTotal,
      sessionOk: !!session,
    });

    const now = Date.now();
    const expiresAt = session?.expiresAt ? new Date(session.expiresAt).getTime() : 0;
    const lastRefresh = session?.updatedAt || session?.createdAt || null;
    const nextRefresh = expiresAt ? new Date(expiresAt).toISOString() : null;

    res.json({
      success: true,
      data: {
        region,
        overview: {
          totalActive,
          eligible,
          localEligible,
          outOfStock,
          inactive,
          categoriesRepresented: categoryRows.length,
          sellersContributing: Array.isArray(sellerCount) ? sellerCount.length : 0,
          recentlyAdded7d: recentAdded,
          recentlyUpdated7d: recentUpdated,
          lastRefresh,
          sessionCount,
          algorithmStatus: session && expiresAt > now ? "live" : "expired_or_empty",
        },
        categories: categoryRows.map((r: any) => ({ key: r._id || "—", count: r.n })),
        regions: regionRows.map((r: any) => ({ key: r._id || "—", count: r.n })),
        algorithm: {
          ...ALGORITHM,
          status: session && expiresAt > now ? "live" : "needs_refresh",
          lastRefresh,
          nextScheduledRefresh: nextRefresh,
          sessionId: session?.sessionId || null,
          cachedSessionExpired: !!(session && expiresAt <= now),
        },
        sections,
        totals: {
          populated: populatedTotal,
          capacity: capacityTotal,
          note: "Capacity is 113 slots. Populated count is real inventory — never padded with fake products.",
        },
        health,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const refreshAdminShowroom = async (req: Request, res: Response) => {
  try {
    const region = String(req.body?.region || req.query.region || "NG").trim() || "NG";
    const generated = await generateShowroom({ region, forceRefresh: true });
    res.json({
      success: true,
      data: {
        region: generated.region,
        sessionId: generated.sessionId,
        cached: generated.cached,
        meta: (generated as any).meta || {},
        populated: {
          1: (generated.rooms?.[1] || []).length,
          2: (generated.rooms?.[2] || []).length,
          3: (generated.rooms?.[3] || []).length,
          4: (generated.rooms?.[4] || []).length,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminIntelligence = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim();
    const confidence = String(req.query.confidence || "").trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(10, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      ready,
      pending,
      failed,
      withAi,
      totalProducts,
      recentReady,
      lastReady,
      confidenceRows,
    ] = await Promise.all([
      ProductAI.countDocuments({ status: "ready" }),
      ProductAI.countDocuments({ status: "pending" }),
      ProductAI.countDocuments({ status: "failed" }),
      ProductAI.countDocuments(),
      Product.countDocuments(),
      ProductAI.countDocuments({ status: "ready", generatedAt: { $gte: sevenDaysAgo } }),
      ProductAI.findOne({ status: "ready" }).sort({ generatedAt: -1 }).select("generatedAt").lean(),
      ProductAI.aggregate([
        { $match: { status: "ready" } },
        { $group: { _id: "$buyerConfidence.level", n: { $sum: 1 } } },
      ]),
    ]);

    const missing = Math.max(0, totalProducts - withAi);

    const overview = {
      withIntelligence: ready,
      pending,
      failed,
      missing,
      recentlyUpdated7d: recentReady,
      lastSuccessfulUpdate: (lastReady as any)?.generatedAt || null,
      buyerConfidence: {
        high: confidenceRows.find((r: any) => r._id === "High Confidence")?.n || 0,
        growing: confidenceRows.find((r: any) => r._id === "Growing Confidence")?.n || 0,
        limited: confidenceRows.find((r: any) => r._id === "Limited Confidence")?.n || 0,
      },
    };

    if (status === "missing") {
      const aiIds = await ProductAI.distinct("productId");
      const productFilter: any = { _id: { $nin: aiIds } };
      if (q) {
        productFilter.$or = [
          { name: { $regex: q, $options: "i" } },
          { category: { $regex: q, $options: "i" } },
          { brand: { $regex: q, $options: "i" } },
        ];
      }
      const [items, total] = await Promise.all([
        Product.find(productFilter)
          .populate("seller", "name storeName email")
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(productFilter),
      ]);
      return res.json({
        success: true,
        data: {
          overview,
          items: items.map((p: any) => ({
            _id: asId(p._id),
            productId: asId(p._id),
            status: "missing",
            name: p.name,
            category: p.category,
            region: p.region,
            price: p.price,
            image: p.images?.[0] || "",
            seller: p.seller,
            generatedAt: null,
            buyerConfidence: null,
            error: null,
            updatedAt: p.updatedAt,
          })),
          pagination: {
            page,
            limit,
            total,
            pages: Math.max(1, Math.ceil(total / limit)),
          },
        },
      });
    }

    const aiFilter: any = {};
    if (status) aiFilter.status = status;
    if (confidence) aiFilter["buyerConfidence.level"] = confidence;

    if (q) {
      const matched = await Product.find({
        $or: [
          { name: { $regex: q, $options: "i" } },
          { category: { $regex: q, $options: "i" } },
          { brand: { $regex: q, $options: "i" } },
        ],
      })
        .select("_id")
        .lean();

      const sellers = await User.find({
        $or: [
          { storeName: { $regex: q, $options: "i" } },
          { name: { $regex: q, $options: "i" } },
        ],
        role: "seller",
      }).select("_id");

      const sellerProducts = await Product.find({
        seller: { $in: sellers.map((s) => s._id) },
      }).select("_id");

      const productIdsFilter = [
        ...matched.map((p: any) => p._id),
        ...sellerProducts.map((p) => p._id),
      ];
      aiFilter.productId = { $in: productIdsFilter };
    }

    const [aiItems, total] = await Promise.all([
      ProductAI.find(aiFilter)
        .sort({ generatedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductAI.countDocuments(aiFilter),
    ]);

    const pids = aiItems.map((i: any) => i.productId);
    const products = await Product.find({ _id: { $in: pids } })
      .populate("seller", "name storeName email")
      .lean();
    const pmap = new Map(products.map((p: any) => [asId(p._id), p]));

    res.json({
      success: true,
      data: {
        overview,
        items: aiItems.map((row: any) => {
          const p = pmap.get(asId(row.productId));
          return {
            _id: asId(row._id),
            productId: asId(row.productId),
            status: row.status,
            name: p?.name || "Unknown product",
            category: p?.category || "",
            region: p?.region || "",
            price: p?.price,
            image: p?.images?.[0] || "",
            seller: p?.seller || null,
            generatedAt: row.generatedAt || null,
            buyerConfidence: row.buyerConfidence || null,
            error: row.error || null,
            updatedAt: row.updatedAt,
          };
        }),
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminIntelligenceDetail = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.productId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    const product = await Product.findById(id)
      .populate(
        "seller",
        "name storeName email isSellerVerified isSellerSuspended marketplaceRegion createdAt"
      )
      .lean();
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const sellerId = (product as any).seller?._id || (product as any).seller;
    const [ai, perf, sellerProductCount, sellerOrderCount] = await Promise.all([
      ProductAI.findOne({ productId: id }).lean(),
      ProductPerformance.findOne({ product: id }).lean(),
      Product.countDocuments({ seller: sellerId }),
      Order.countDocuments({ seller: sellerId }),
    ]);

    const currentFingerprint = generateProductFingerprint(product);
    const fingerprintMatch = ai ? ai.fingerprint === currentFingerprint : false;
    const needsRefresh = !!ai && !fingerprintMatch;

    const specs =
      (product as any).specifications instanceof Map
        ? Object.fromEntries((product as any).specifications)
        : (product as any).specifications || {};

    res.json({
      success: true,
      data: {
        source: {
          _id: asId((product as any)._id),
          name: (product as any).name,
          description: (product as any).description,
          category: (product as any).category,
          subCategory: (product as any).subCategory,
          brand: (product as any).brand,
          price: (product as any).price,
          region: (product as any).region,
          stock: (product as any).stock,
          isActive: (product as any).isActive,
          images: (product as any).images || [],
          shipping: (product as any).shipping || null,
          fulfillmentLocation: (product as any).fulfillmentLocation || null,
          specifications: specs,
          updatedAt: (product as any).updatedAt,
          createdAt: (product as any).createdAt,
          seller: (product as any).seller,
          activity: {
            views: (perf as any)?.views || 0,
            cartAdds: (perf as any)?.cartAdds || 0,
            purchases: (perf as any)?.purchases || 0,
            score: (perf as any)?.score || 0,
          },
          sellerActivity: {
            productsListed: sellerProductCount,
            ordersGenerated: sellerOrderCount,
          },
        },
        generated: ai
          ? {
              status: ai.status,
              modelVersion: ai.modelVersion,
              promptVersion: ai.promptVersion,
              generatedAt: ai.generatedAt,
              updatedAt: (ai as any).updatedAt,
              summary: ai.summary,
              overview: ai.overview,
              highlights: ai.highlights || [],
              bestFor: ai.bestFor || [],
              shippingSummary: ai.shippingSummary,
              thingsToConsider: ai.thingsToConsider || [],
              buyerConfidence: ai.buyerConfidence,
              confidenceExplanation: ai.confidenceExplanation,
              error: ai.error || null,
              fingerprint: ai.fingerprint,
            }
          : null,
        pipeline: {
          fingerprintMatch,
          needsRefresh,
          currentFingerprint,
          note: fingerprintMatch
            ? "Saved intelligence matches the current product fingerprint."
            : ai
            ? "Product changed after last generation — latest saved intelligence stays visible until refresh completes."
            : "No intelligence generated yet.",
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const regenerateAdminIntelligence = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.productId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }
    const product = await Product.findById(id).select("_id");
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    await ProductAI.updateOne(
      { productId: id },
      { $set: { status: "pending", error: "" } }
    );
    enqueueProductAI(id);
    res.json({ success: true, data: { productId: id, queued: true } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function fillDays(keys: string[], byDay: Map<string, any>, extra: (row: any) => any) {
  return keys.map((date) => extra(byDay.get(date) || { date }));
}

export const getAdminAnalytics = async (req: Request, res: Response) => {
  try {
    const days = Math.min(90, Math.max(7, Number(req.query.days || 30)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const keys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }

    const notCancelled = { orderStatus: { $ne: "Cancelled" } };

    const [
      gmvAgg,
      completed,
      cancelled,
      refunded,
      failedPayments,
      orderTotal,
      aovAgg,
      cartsWithItems,
      cartDocs,
      orderSeries,
      sellersTotal,
      sellersNew,
      productsListed,
      usersTotal,
      buyers,
      sellerAccounts,
      usersNew,
      activeUsers,
      repeat,
      presence,
      showroomFunnel,
      aiReady,
      aiFailed,
      aiPending,
      perfTotals,
    ] = await Promise.all([
      Order.aggregate([
        { $match: { ...notCancelled, createdAt: { $gte: since } } },
        { $group: { _id: null, gmv: { $sum: "$totalAmount" }, n: { $sum: 1 } } },
      ]),
      Order.countDocuments({ orderStatus: "Delivered", createdAt: { $gte: since } }),
      Order.countDocuments({ orderStatus: "Cancelled", createdAt: { $gte: since } }),
      Order.countDocuments({ paymentStatus: "refunded", createdAt: { $gte: since } }),
      Order.countDocuments({ paymentStatus: "failed", createdAt: { $gte: since } }),
      Order.countDocuments({ createdAt: { $gte: since } }),
      Order.aggregate([
        { $match: { ...notCancelled, createdAt: { $gte: since } } },
        { $group: { _id: null, avg: { $avg: "$totalAmount" }, n: { $sum: 1 } } },
      ]),
      Cart.countDocuments({ "items.0": { $exists: true } }),
      Cart.countDocuments(),
      Order.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            orders: { $sum: 1 },
            gmv: {
              $sum: {
                $cond: [{ $ne: ["$orderStatus", "Cancelled"] }, "$totalAmount", 0],
              },
            },
            delivered: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "Delivered"] }, 1, 0] },
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "Cancelled"] }, 1, 0] },
            },
          },
        },
      ]),
      User.countDocuments({ role: "seller" }),
      User.countDocuments({ role: "seller", createdAt: { $gte: sevenDaysAgo } }),
      Product.countDocuments({ isActive: true }),
      User.countDocuments(),
      User.countDocuments({ role: "buyer" }),
      User.countDocuments({ role: "seller" }),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      User.countDocuments({ lastSeenAt: { $gte: sevenDaysAgo } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$buyer", n: { $sum: 1 } } },
        { $match: { n: { $gte: 2 } } },
        { $count: "n" },
      ]),
      User.aggregate([{ $group: { _id: "$lastSeenPlatform", n: { $sum: 1 } } }]),
      ShowroomEvent.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$type", n: { $sum: 1 } } },
      ]),
      ProductAI.countDocuments({ status: "ready" }),
      ProductAI.countDocuments({ status: "failed" }),
      ProductAI.countDocuments({ status: "pending" }),
      ProductPerformance.aggregate([
        {
          $group: {
            _id: null,
            views: { $sum: "$views" },
            cartAdds: { $sum: "$cartAdds" },
            purchases: { $sum: "$purchases" },
          },
        },
      ]),
    ]);

    const gmv = Math.round(gmvAgg?.[0]?.gmv || 0);
    const aov = Math.round(aovAgg?.[0]?.avg || 0);
    const views = perfTotals?.[0]?.views || 0;
    const cartAdds = perfTotals?.[0]?.cartAdds || 0;
    const purchases = perfTotals?.[0]?.purchases || 0;
    const conversion = views > 0 ? Math.round((purchases / views) * 10000) / 100 : null;

    const seriesMap = new Map((orderSeries || []).map((r: any) => [r._id, r]));
    const series = fillDays(keys, seriesMap, (row) => ({
      date: row._id || row.date,
      orders: row.orders || 0,
      gmv: Math.round(row.gmv || 0),
      delivered: row.delivered || 0,
      cancelled: row.cancelled || 0,
    }));

    const funnelMap: Record<string, number> = {};
    for (const r of showroomFunnel || []) funnelMap[r._id] = r.n;
    const funnel = {
      impression: funnelMap.impression || 0,
      open: funnelMap.open || 0,
      cart: funnelMap.cart || 0,
      wishlist: funnelMap.wishlist || 0,
      purchase: funnelMap.purchase || 0,
      skip: funnelMap.skip || 0,
    };

    const presenceMap: Record<string, number> = { web: 0, app: 0, admin: 0, unknown: 0 };
    for (const r of presence || []) {
      const k = r._id || "unknown";
      if (k === "web" || k === "app" || k === "admin") presenceMap[k] = r.n;
      else presenceMap.unknown += r.n;
    }

    const remaining = Math.max(0, FIRST_200 - sellersTotal);

    res.json({
      success: true,
      data: {
        rangeDays: days,
        commerce: {
          gmv,
          orders: orderTotal,
          completedDelivered: completed,
          averageOrderValue: aov,
          cancelled,
          refunds: refunded,
          failedPayments,
          cartsWithItems,
          cartDocuments: cartDocs,
          catalogViews: views,
          catalogCartAdds: cartAdds,
          catalogPurchases: purchases,
          conversionRatePct: conversion,
          series,
        },
        appVsWeb: {
          availableForOrders: false,
          note: "Orders do not store app vs web source. Showing last-seen presence only — not order attribution.",
          presence: presenceMap,
        },
        sellers: {
          total: sellersTotal,
          new7d: sellersNew,
          productsListed,
          campaign: {
            name: "First 200 Seller Campaign",
            cap: FIRST_200,
            recruited: sellersTotal,
            remaining,
            status: sellersTotal >= FIRST_200 ? "cap_reached" : "open",
          },
        },
        buyers: {
          registered: usersTotal,
          buyerOnly: buyers,
          sellerAccounts,
          new7d: usersNew,
          active7d: activeUsers,
          repeatShoppers: repeat?.[0]?.n || 0,
          referralAttribution: {
            available: false,
            note: "User model has no referral/source field in V1.",
          },
        },
        discovery: {
          funnel,
          catalog: { views, cartAdds, purchases },
          unavailable: [
            "Showroom impressions are counted only when the client posts /products/showroom/event",
            "No dwell-time, search-log, or store-visit collection in V1",
          ],
        },
        intelligence: {
          productsReady: aiReady,
          pending: aiPending,
          failed: aiFailed,
          views: {
            available: false,
            note: "Product Intelligence views are not tracked as a separate event.",
          },
        },
        platformHealth: {
          failedPayments,
          cancelledOrders: cancelled,
          intelligenceFailures: aiFailed,
          intelligencePending: aiPending,
          unavailable: [
            "No API error log collection",
            "No notification failure collection",
            "No media-processing failure collection",
          ],
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};