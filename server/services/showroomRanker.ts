/**
 * Plazore Showroom Ranker (V1)
 * Deterministic, explainable, commerce-first ranking.
 * No AI / embeddings / vector DB.
 */

import Product from "../models/Products.js";
import ProductPerformance from "../models/ProductPerformance.js";
import ShowroomSession from "../models/ShowroomSession.js";
import ShowroomEvent from "../models/ShowroomEvent.js";
import crypto from "crypto";

const ROOM_CAPACITY = { 1: 50, 2: 14, 3: 16, 4: 33 } as const;
const SESSION_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

const SELLER_PUBLIC_FIELDS =
  "name storeName storeLogo storeDescription isSellerVerified marketplaceRegion shippingDefaults";

type ScoredProduct = {
  product: any;
  score: number;
  reasons: string[];
};

type InterestProfile = {
  categories: Map<string, number>;
  subCategories: Map<string, number>;
  sellers: Map<string, number>;
  priceBands: Map<string, number>;
};

function priceBand(price: number): string {
  if (price < 5000) return "budget";
  if (price < 25000) return "mid";
  if (price < 100000) return "premium";
  return "luxury";
}

function daysSince(date: Date | string | undefined): number {
  if (!date) return 999;
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return 999;
  return Math.max(0, (Date.now() - t) / (1000 * 60 * 60 * 24));
}

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

/** Build lightweight interest profile from recent ShowroomEvents */
async function buildInterestProfile(
  userId: string | null,
  sessionId: string
): Promise<InterestProfile> {
  const profile: InterestProfile = {
    categories: new Map(),
    subCategories: new Map(),
    sellers: new Map(),
    priceBands: new Map(),
  };

  const query: any = { sessionId };
  if (userId) {
    query.$or = [{ sessionId }, { user: userId }];
  }

  const events = await ShowroomEvent.find(query)
    .sort({ createdAt: -1 })
    .limit(120)
    .populate("product", "category subCategory seller price")
    .lean();

  const now = Date.now();

  for (const ev of events) {
    const product: any = ev.product;
    if (!product) continue;

    // Recency decay: half-life ~ 3 days
    const ageHours =
      (now - new Date((ev as any).createdAt).getTime()) / (1000 * 60 * 60);
    const decay = Math.exp(-ageHours / 72);

    let weight = 0;
    switch (ev.type) {
      case "purchase":
        weight = 12;
        break;
      case "cart":
        weight = 7;
        break;
      case "wishlist":
        weight = 5;
        break;
      case "open":
        weight = 3;
        break;
      case "impression":
        weight = 0.4;
        break;
      case "skip":
        weight = -2;
        break;
      default:
        weight = 0;
    }

    const w = weight * decay;
    if (!w) continue;

    const cat = String(product.category || "").trim();
    const sub = String(product.subCategory || "").trim();
    const seller = String(product.seller || "").trim();
    const band = priceBand(Number(product.price) || 0);

    if (cat) profile.categories.set(cat, (profile.categories.get(cat) || 0) + w);
    if (sub)
      profile.subCategories.set(sub, (profile.subCategories.get(sub) || 0) + w);
    if (seller)
      profile.sellers.set(seller, (profile.sellers.get(seller) || 0) + w);
    if (band)
      profile.priceBands.set(band, (profile.priceBands.get(band) || 0) + w);
  }

  return profile;
}

function scoreProduct(opts: {
  product: any;
  perf: any | null;
  region: string;
  interest: InterestProfile;
  exposureCount: number;
  searchQuery?: string;
}): ScoredProduct {
  const { product, perf, region, interest, exposureCount, searchQuery } = opts;
  const reasons: string[] = [];
  let score = 0;

  // ── 1. Regional relevance ──────────────────────────────
  const pRegion = String(product.region || "").toUpperCase();
  const uRegion = String(region || "NG").toUpperCase();
  let regional = 0.35;
  if (pRegion === uRegion) {
    regional = 1;
    reasons.push("local_region");
  } else if (pRegion && uRegion && pRegion.slice(0, 2) === uRegion.slice(0, 2)) {
    regional = 0.65;
    reasons.push("nearby_region");
  }
  score += regional * 1.4;

  // ── 2. Commerce health (normalized, conversion-aware) ──
  const views = perf?.views || 0;
  const carts = perf?.cartAdds || 0;
  const purchases = perf?.purchases || 0;
  const wishlist = product.wishlistCount || 0;

  const conversion =
    views > 0 ? (purchases * 3 + carts) / Math.max(views, 1) : 0;
  const commerceRaw =
    purchases * 15 + carts * 5 + views * 0.4 + wishlist * 2 + conversion * 40;
  // Soft log so big numbers don't dominate forever
  const commerce = Math.log10(1 + commerceRaw) / 3; // ~0–1 range for typical early marketplace
  score += clamp(commerce) * 1.2;
  if (purchases > 0 || carts > 2) reasons.push("commerce_signal");

  // ── 3. Freshness (decays ~21 days) ─────────────────────
  const age = daysSince(product.createdAt);
  const freshness = clamp(1 - age / 21);
  score += freshness * 1.0;
  if (age <= 7) reasons.push("fresh");

  // ── 4. User interest ───────────────────────────────────
  let interestScore = 0;
  const cat = String(product.category || "").trim();
  const sub = String(product.subCategory || "").trim();
  const sellerId = String(product.seller?._id || product.seller || "");
  const band = priceBand(Number(product.price) || 0);

  if (cat && interest.categories.has(cat)) {
    interestScore += clamp(interest.categories.get(cat)! / 20) * 0.55;
  }
  if (sub && interest.subCategories.has(sub)) {
    interestScore += clamp(interest.subCategories.get(sub)! / 12) * 0.3;
  }
  if (sellerId && interest.sellers.has(sellerId)) {
    interestScore += clamp(interest.sellers.get(sellerId)! / 15) * 0.25;
  }
  if (band && interest.priceBands.has(band)) {
    interestScore += clamp(interest.priceBands.get(band)! / 15) * 0.15;
  }
  score += clamp(interestScore) * 1.6;
  if (interestScore > 0.15) reasons.push("matches_interest");

  // ── 5. Exploration boost (new / underexposed) ──────────
  let exploration = 0;
  if (age <= 14 && (views < 30 || purchases === 0)) {
    exploration += 0.55;
    reasons.push("exploration_new");
  }
  if (views < 8 && carts === 0) {
    exploration += 0.25;
    reasons.push("underexposed");
  }
  score += exploration * 0.9;

  // ── 6. Quality / availability ──────────────────────────
  let quality = 0.3;
  if (product.isActive !== false) quality += 0.2;
  if ((product.stock || 0) > 0) quality += 0.25;
  if (product.images?.length > 0) quality += 0.15;
  if (product.isFeatured) quality += 0.2;
  score += quality * 0.5;

  // ── 7. Search relevance (when query present) ───────────
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    const name = String(product.name || "").toLowerCase();
    const desc = String(product.description || "").toLowerCase();
    const brand = String(product.brand || "").toLowerCase();
    let searchHit = 0;
    if (name.includes(q)) searchHit += 1.2;
    if (brand.includes(q)) searchHit += 0.7;
    if (cat.toLowerCase().includes(q)) searchHit += 0.5;
    if (sub.toLowerCase().includes(q)) searchHit += 0.4;
    if (desc.includes(q)) searchHit += 0.25;
    score += searchHit * 1.8;
    if (searchHit > 0) reasons.push("search_match");
  }

  // ── 8. Exposure penalty (repetition control) ───────────
  // Positive interactions reduce the penalty
  const positiveSignal = purchases * 3 + carts * 2 + wishlist;
  const rawPenalty = Math.max(0, exposureCount - positiveSignal * 0.5);
  const exposurePenalty = Math.min(1.4, rawPenalty * 0.22);
  score -= exposurePenalty * 1.3;
  if (exposurePenalty > 0.3) reasons.push("exposure_penalty");

  return { product, score, reasons };
}

/** Soft diversity selection */
function selectWithDiversity(
  scored: ScoredProduct[],
  capacity: number,
  opts: {
    maxPerCategory?: number;
    maxPerSeller?: number;
    allowReuseIds?: Set<string>;
  } = {}
): ScoredProduct[] {
  const maxPerCategory = opts.maxPerCategory ?? 12;
  const maxPerSeller = opts.maxPerSeller ?? 6;
  const selected: ScoredProduct[] = [];
  const catCount = new Map<string, number>();
  const sellerCount = new Map<string, number>();
  const used = new Set<string>();

  const tryPick = (relax: boolean) => {
    for (const item of scored) {
      if (selected.length >= capacity) break;
      const id = String(item.product._id);
      if (used.has(id)) continue;

      const cat = String(item.product.category || "other");
      const seller = String(
        item.product.seller?._id || item.product.seller || "unknown"
      );

      if (!relax) {
        if ((catCount.get(cat) || 0) >= maxPerCategory) continue;
        if ((sellerCount.get(seller) || 0) >= maxPerSeller) continue;
      }

      selected.push(item);
      used.add(id);
      catCount.set(cat, (catCount.get(cat) || 0) + 1);
      sellerCount.set(seller, (sellerCount.get(seller) || 0) + 1);
    }
  };

  // First pass: strict diversity
  tryPick(false);
  // Second pass: relax if not full
  if (selected.length < capacity) tryPick(true);

  return selected;
}

export async function generateShowroom(opts: {
  region?: string;
  sessionId?: string;
  userId?: string | null;
  searchQuery?: string;
  forceRefresh?: boolean;
}) {
  const region = (opts.region || "NG").trim().toUpperCase() || "NG";
  const sessionId =
    opts.sessionId ||
    crypto.randomBytes(16).toString("hex");
  const userId = opts.userId || null;
  const searchQuery = opts.searchQuery?.trim() || "";

  // ── Load or create session ─────────────────────────────
  let session = await ShowroomSession.findOne({ sessionId });
  const now = new Date();

  if (
    session &&
    !opts.forceRefresh &&
    session.expiresAt > now &&
    !searchQuery // search always recalculates
  ) {
    // Return cached room product IDs → hydrate
    const allIds = [
      ...(session.productIdsByRoom?.[1] || []),
      ...(session.productIdsByRoom?.[2] || []),
      ...(session.productIdsByRoom?.[3] || []),
      ...(session.productIdsByRoom?.[4] || []),
    ];
    const uniqueIds = [...new Set(allIds.map(String))];

    const products = await Product.find({
      _id: { $in: uniqueIds },
      isActive: true,
      stock: { $gt: 0 },
    })
      .populate("seller", SELLER_PUBLIC_FIELDS)
      .lean();

    const map = new Map(products.map((p: any) => [String(p._id), p]));

    const hydrate = (ids: string[]) =>
      ids.map((id) => map.get(String(id))).filter(Boolean);

    return {
      sessionId,
      region: session.region || region,
      rooms: {
        1: hydrate(session.productIdsByRoom?.[1] || []),
        2: hydrate(session.productIdsByRoom?.[2] || []),
        3: hydrate(session.productIdsByRoom?.[3] || []),
        4: hydrate(session.productIdsByRoom?.[4] || []),
      },
      cached: true,
    };
  }

  // ── Candidate pool ─────────────────────────────────────
  // Prefer local, then expand. Never hard-exclude global.
  const baseFilter: any = { isActive: true, stock: { $gt: 0 } };

  const localProducts = await Product.find({
    ...baseFilter,
    region,
  })
    .populate("seller", SELLER_PUBLIC_FIELDS)
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(400)
    .lean();

  let candidates = [...localProducts];

  if (candidates.length < 120) {
    const extra = await Product.find({
      ...baseFilter,
      region: { $ne: region },
    })
      .populate("seller", SELLER_PUBLIC_FIELDS)
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(300)
      .lean();
    candidates = [...candidates, ...extra];
  }

  // Tiny inventory: still proceed with whatever exists
  if (candidates.length === 0) {
    return {
      sessionId,
      region,
      rooms: { 1: [], 2: [], 3: [], 4: [] },
      cached: false,
    };
  }

  // Performance map
  const ids = candidates.map((p: any) => p._id);
  const perfs = await ProductPerformance.find({ product: { $in: ids } })
    .select("product views cartAdds purchases score")
    .lean();
  const perfMap = new Map(
    perfs.map((p: any) => [String(p.product), p])
  );

  // Interest + exposure
  const interest = await buildInterestProfile(userId, sessionId);
  const exposureCounts: Record<string, number> = {};
  if (session?.exposureCounts) {
    const raw =
      session.exposureCounts instanceof Map
        ? Object.fromEntries(session.exposureCounts)
        : session.exposureCounts;
    Object.assign(exposureCounts, raw || {});
  }

  // Score everything
  const scored = candidates
    .map((product: any) =>
      scoreProduct({
        product,
        perf: perfMap.get(String(product._id)) || null,
        region,
        interest,
        exposureCount: Number(exposureCounts[String(product._id)] || 0),
        searchQuery,
      })
    )
    .sort((a, b) => b.score - a.score);

  // ── Room selection with different philosophies ─────────
  // Room 1: broad discovery
  const room1 = selectWithDiversity(scored, ROOM_CAPACITY[1], {
    maxPerCategory: 14,
    maxPerSeller: 7,
  });

  const used1 = new Set(room1.map((s) => String(s.product._id)));

  // Room 2: tighter / higher score preference
  const room2Pool = scored.filter((s) => !used1.has(String(s.product._id)));
  const room2 = selectWithDiversity(room2Pool, ROOM_CAPACITY[2], {
    maxPerCategory: 5,
    maxPerSeller: 3,
  });
  const used2 = new Set([
    ...used1,
    ...room2.map((s) => String(s.product._id)),
  ]);

  // Room 3: more exploration + allow light reuse if needed
  const room3Pool = scored.filter((s) => {
    const id = String(s.product._id);
    if (!used2.has(id)) return true;
    // allow reuse of strong exploration candidates when inventory is thin
    return s.reasons.includes("exploration_new") || candidates.length < 40;
  });
  const room3 = selectWithDiversity(room3Pool, ROOM_CAPACITY[3], {
    maxPerCategory: 6,
    maxPerSeller: 3,
  });
  const used3 = new Set([
    ...used2,
    ...room3.map((s) => String(s.product._id)),
  ]);

  // Room 4: broader surface, allow more reuse when inventory is limited
  const room4Pool =
    candidates.length < 80
      ? scored // allow reuse
      : scored.filter((s) => !used3.has(String(s.product._id)));
  const room4 = selectWithDiversity(room4Pool, ROOM_CAPACITY[4], {
    maxPerCategory: 10,
    maxPerSeller: 5,
  });

  // Absolute inventory rule: if still short, fill from top scored
  const fillShort = (room: ScoredProduct[], cap: number) => {
    if (room.length >= cap || scored.length === 0) return room;
    const have = new Set(room.map((r) => String(r.product._id)));
    for (const s of scored) {
      if (room.length >= cap) break;
      const id = String(s.product._id);
      if (have.has(id)) continue;
      room.push(s);
      have.add(id);
    }
    // last resort: pure reuse
    if (room.length < cap && scored.length > 0) {
      let i = 0;
      while (room.length < cap) {
        room.push(scored[i % scored.length]);
        i++;
      }
    }
    return room;
  };

  const final1 = fillShort(room1, Math.min(ROOM_CAPACITY[1], scored.length));
  const final2 = fillShort(room2, Math.min(ROOM_CAPACITY[2], scored.length));
  const final3 = fillShort(room3, Math.min(ROOM_CAPACITY[3], scored.length));
  const final4 = fillShort(room4, Math.min(ROOM_CAPACITY[4], scored.length));

  const productIdsByRoom = {
    1: final1.map((s) => String(s.product._id)),
    2: final2.map((s) => String(s.product._id)),
    3: final3.map((s) => String(s.product._id)),
    4: final4.map((s) => String(s.product._id)),
  };

  // Update exposure counts
  const nextExposure = { ...exposureCounts };
  for (const id of [
    ...productIdsByRoom[1],
    ...productIdsByRoom[2],
    ...productIdsByRoom[3],
    ...productIdsByRoom[4],
  ]) {
    nextExposure[id] = (nextExposure[id] || 0) + 1;
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await ShowroomSession.findOneAndUpdate(
    { sessionId },
    {
      sessionId,
      user: userId || null,
      region,
      behaviorSig: searchQuery ? `search:${searchQuery}` : "default",
      productIdsByRoom,
      exposureCounts: nextExposure,
      expiresAt,
    },
    { upsert: true, new: true }
  );

  return {
    sessionId,
    region,
    rooms: {
      1: final1.map((s) => s.product),
      2: final2.map((s) => s.product),
      3: final3.map((s) => s.product),
      4: final4.map((s) => s.product),
    },
    cached: false,
    meta: {
      candidateCount: candidates.length,
      localCount: localProducts.length,
    },
  };
}

/** Shared scorer for search / product listing */
export async function rankProductsForSearch(opts: {
  products: any[];
  region?: string;
  userId?: string | null;
  sessionId?: string;
  searchQuery?: string;
}) {
  const region = (opts.region || "NG").toUpperCase();
  const interest = await buildInterestProfile(
    opts.userId || null,
    opts.sessionId || "search"
  );

  const ids = opts.products.map((p) => p._id);
  const perfs = await ProductPerformance.find({ product: { $in: ids } })
    .select("product views cartAdds purchases score")
    .lean();
  const perfMap = new Map(perfs.map((p: any) => [String(p.product), p]));

  const scored = opts.products
    .map((product) =>
      scoreProduct({
        product,
        perf: perfMap.get(String(product._id)) || null,
        region,
        interest,
        exposureCount: 0,
        searchQuery: opts.searchQuery,
      })
    )
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.product);
}