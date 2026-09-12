/**
 * Plazore Showroom Ranker (V1)
 * FULLNESS FIRST · ADAPTABILITY SECOND
 *
 * Capacities:
 *   Room 1 = 50 unique
 *   Room 2 = 14 unique
 *   Room 1 + Room 2 = 64 unique (no overlap)
 *   Room 3 = 16
 *   Room 4 = 30
 *   Full mall = 110 slots
 *
 * Eligible = isActive === true AND stock > 0
 *
 * Adaptive ON  only when eligibleCount >= 110
 * Adaptive OFF when eligibleCount < 110
 *   → show every real eligible product
 *   → never pad / never duplicate just to look full
 *   → no seller / category caps that hide inventory
 *
 * Rooms 3 & 4 may reuse Room 1/2 products ONLY when adaptive is ON
 * and a real ranking signal justifies another appearance.
 */

import crypto from "crypto";
import Product from "../models/Products.js";
import ProductPerformance from "../models/ProductPerformance.js";
import ShowroomSession from "../models/ShowroomSession.js";
import ShowroomEvent from "../models/ShowroomEvent.js";

export const ROOM_CAPACITY = {
  1: 50,
  2: 14,
  3: 16,
  4: 30,
} as const;

export const FULL_SHOWROOM_SLOTS =
  ROOM_CAPACITY[1] + ROOM_CAPACITY[2] + ROOM_CAPACITY[3] + ROOM_CAPACITY[4]; // 110

export const ADAPTIVE_THRESHOLD = FULL_SHOWROOM_SLOTS;

export const SESSION_TTL_MS = 1000 * 60 * 60 * 6;

const SELLER_PUBLIC_FIELDS =
  "name storeName storeLogo storeDescription isSellerVerified marketplaceRegion shippingDefaults";

const ELIGIBLE_FILTER = { isActive: true, stock: { $gt: 0 } } as const;

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

function productId(p: any): string {
  return String(p?._id || p || "");
}

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
  softInterest?: boolean;
}): ScoredProduct {
  const {
    product,
    perf,
    region,
    interest,
    exposureCount,
    searchQuery,
    softInterest = true,
  } = opts;
  const reasons: string[] = [];
  let score = 0;

  const pRegion = String(product.region || "").toUpperCase();
  const uRegion = String(region || "NG").toUpperCase();
  let regional = 0.4;
  if (pRegion === uRegion) {
    regional = 1;
    reasons.push("local_region");
  } else if (pRegion && uRegion && pRegion.slice(0, 2) === uRegion.slice(0, 2)) {
    regional = 0.7;
    reasons.push("nearby_region");
  }
  score += regional * 1.35;

  const views = perf?.views || 0;
  const carts = perf?.cartAdds || 0;
  const purchases = perf?.purchases || 0;
  const wishlist = product.wishlistCount || 0;

  const conversion =
    views > 0 ? (purchases * 3 + carts) / Math.max(views, 1) : 0;
  const commerceRaw =
    purchases * 15 + carts * 5 + views * 0.4 + wishlist * 2 + conversion * 40;
  const commerce = Math.log10(1 + commerceRaw) / 3;
  score += clamp(commerce) * 1.15;
  if (purchases > 0 || carts > 2) reasons.push("commerce_signal");

  const age = daysSince(product.createdAt);
  const freshness = clamp(1 - age / 21);
  score += freshness * 1.0;
  if (age <= 7) reasons.push("fresh");

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
  const interestWeight = softInterest ? 1.15 : 1.6;
  score += clamp(interestScore) * interestWeight;
  if (interestScore > 0.15) reasons.push("matches_interest");

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

  let quality = 0.3;
  if (product.isActive !== false) quality += 0.2;
  if ((product.stock || 0) > 0) quality += 0.25;
  if (product.images?.length > 0) quality += 0.15;
  if (product.isFeatured) quality += 0.2;
  score += quality * 0.5;

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

  const positiveSignal = purchases * 3 + carts * 2 + wishlist;
  const rawPenalty = Math.max(0, exposureCount - positiveSignal * 0.5);
  const exposurePenalty = Math.min(1.4, rawPenalty * 0.22);
  score -= exposurePenalty * 1.3;
  if (exposurePenalty > 0.3) reasons.push("exposure_penalty");

  return { product, score, reasons };
}

/** Unique sequential pick. No seller/category hiding. Never fabricates rows. */
function takeUnique(
  scored: ScoredProduct[],
  capacity: number,
  exclude: Set<string>
): ScoredProduct[] {
  if (capacity <= 0) return [];
  const selected: ScoredProduct[] = [];
  const used = new Set<string>();

  for (const item of scored) {
    if (selected.length >= capacity) break;
    const id = productId(item.product);
    if (!id || used.has(id) || exclude.has(id)) continue;
    selected.push(item);
    used.add(id);
  }

  return selected;
}

/**
 * Adaptive-mode diversity pick.
 * Second pass relaxes caps so we still fill from real inventory, never clones.
 */
function selectWithDiversity(
  scored: ScoredProduct[],
  capacity: number,
  opts: {
    maxPerCategory?: number;
    maxPerSeller?: number;
    excludeIds?: Set<string>;
  } = {}
): ScoredProduct[] {
  if (capacity <= 0) return [];
  const maxPerCategory = opts.maxPerCategory ?? 12;
  const maxPerSeller = opts.maxPerSeller ?? 6;
  const exclude = opts.excludeIds || new Set<string>();
  const selected: ScoredProduct[] = [];
  const catCount = new Map<string, number>();
  const sellerCount = new Map<string, number>();
  const used = new Set<string>();

  const tryPick = (relax: boolean) => {
    for (const item of scored) {
      if (selected.length >= capacity) break;
      const id = productId(item.product);
      if (!id || used.has(id) || exclude.has(id)) continue;

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

  tryPick(false);
  if (selected.length < capacity) tryPick(true);

  return selected;
}

function hasReuseReason(s: ScoredProduct): boolean {
  return (
    s.reasons.includes("matches_interest") ||
    s.reasons.includes("commerce_signal") ||
    s.reasons.includes("local_region") ||
    s.reasons.includes("fresh") ||
    s.reasons.includes("exploration_new") ||
    s.reasons.includes("search_match")
  );
}

/**
 * Rooms 3/4 reuse of Room 1/2 — only when adaptive is ON
 * and the product actually earned another look.
 */
function selectAdaptiveWithControlledReuse(
  scored: ScoredProduct[],
  capacity: number,
  usedEarlier: Set<string>,
  opts: {
    maxPerCategory?: number;
    maxPerSeller?: number;
    reuseMinScoreRatio?: number;
  } = {}
): ScoredProduct[] {
  if (capacity <= 0 || scored.length === 0) return [];

  const maxPerCategory = opts.maxPerCategory ?? 8;
  const maxPerSeller = opts.maxPerSeller ?? 4;
  const ratio = opts.reuseMinScoreRatio ?? 0.72;
  const topScore = scored[0]?.score || 1;
  const reuseFloor = topScore * ratio;

  const fresh = scored.filter((s) => !usedEarlier.has(productId(s.product)));
  const reuseCandidates = scored.filter((s) => {
    const id = productId(s.product);
    if (!usedEarlier.has(id)) return false;
    if (s.score < reuseFloor) return false;
    return hasReuseReason(s);
  });

  const pool: ScoredProduct[] = [
    ...fresh,
    ...reuseCandidates.map((s) => ({
      ...s,
      score: s.score * 0.82,
      reasons: [...s.reasons, "controlled_reuse"],
    })),
  ].sort((a, b) => b.score - a.score);

  return selectWithDiversity(pool, capacity, {
    maxPerCategory,
    maxPerSeller,
  });
}

/**
 * INVENTORY FIRST (eligibleCount < 110)
 *
 * Put every unique eligible product on the floor.
 * Room 1 fills first (up to 50), leftover unique items go 2 → 3 → 4.
 * Zero seller/category caps. Zero padding. Zero clones.
 *
 * 5 products from one seller → Room 1 shows all 5.
 */
function distributeInventoryFirst(scored: ScoredProduct[]): {
  room1: ScoredProduct[];
  room2: ScoredProduct[];
  room3: ScoredProduct[];
  room4: ScoredProduct[];
} {
  const n = scored.length;
  if (n === 0) {
    return { room1: [], room2: [], room3: [], room4: [] };
  }

  const used = new Set<string>();

  const room1 = takeUnique(scored, Math.min(ROOM_CAPACITY[1], n), used);
  room1.forEach((s) => used.add(productId(s.product)));

  const room2 = takeUnique(
    scored,
    Math.min(ROOM_CAPACITY[2], n - used.size),
    used
  );
  room2.forEach((s) => used.add(productId(s.product)));

  const room3 = takeUnique(
    scored,
    Math.min(ROOM_CAPACITY[3], n - used.size),
    used
  );
  room3.forEach((s) => used.add(productId(s.product)));

  const room4 = takeUnique(
    scored,
    Math.min(ROOM_CAPACITY[4], n - used.size),
    used
  );

  return { room1, room2, room3, room4 };
}

/**
 * ADAPTIVE ON (eligibleCount >= 110)
 * Fill 50 / 14 / 16 / 30. Rooms 1+2 unique. 3/4 may carefully reuse.
 */
function distributeAdaptive(scored: ScoredProduct[]): {
  room1: ScoredProduct[];
  room2: ScoredProduct[];
  room3: ScoredProduct[];
  room4: ScoredProduct[];
} {
  const room1 = selectWithDiversity(scored, ROOM_CAPACITY[1], {
    maxPerCategory: 14,
    maxPerSeller: 7,
  });
  const used1 = new Set(room1.map((s) => productId(s.product)));

  const room2 = selectWithDiversity(
    scored.filter((s) => !used1.has(productId(s.product))),
    ROOM_CAPACITY[2],
    {
      maxPerCategory: 8,
      maxPerSeller: 4,
      excludeIds: used1,
    }
  );
  const used12 = new Set([
    ...used1,
    ...room2.map((s) => productId(s.product)),
  ]);

  const room3 = selectAdaptiveWithControlledReuse(
    scored,
    ROOM_CAPACITY[3],
    used12,
    {
      maxPerCategory: 6,
      maxPerSeller: 3,
      reuseMinScoreRatio: 0.75,
    }
  );

  const room4 = selectAdaptiveWithControlledReuse(
    scored,
    ROOM_CAPACITY[4],
    used12,
    {
      maxPerCategory: 10,
      maxPerSeller: 5,
      reuseMinScoreRatio: 0.7,
    }
  );

  const fillUniqueOnly = (
    room: ScoredProduct[],
    cap: number,
    exclude: Set<string>
  ) => {
    if (room.length >= cap) return room;
    const have = new Set(room.map((r) => productId(r.product)));
    for (const s of scored) {
      if (room.length >= cap) break;
      const id = productId(s.product);
      if (!id || have.has(id) || exclude.has(id)) continue;
      room.push(s);
      have.add(id);
    }
    return room;
  };

  fillUniqueOnly(room3, ROOM_CAPACITY[3], used12);
  fillUniqueOnly(room4, ROOM_CAPACITY[4], new Set());

  return { room1, room2, room3, room4 };
}

function cachedUniqueIds(session: any): string[] {
  const allIds = [
    ...(session.productIdsByRoom?.[1] || []),
    ...(session.productIdsByRoom?.[2] || []),
    ...(session.productIdsByRoom?.[3] || []),
    ...(session.productIdsByRoom?.[4] || []),
  ];
  return [...new Set(allIds.map(String).filter(Boolean))];
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
    opts.sessionId || crypto.randomBytes(16).toString("hex");
  const userId = opts.userId || null;
  const searchQuery = opts.searchQuery?.trim() || "";

  let session = await ShowroomSession.findOne({ sessionId });
  const now = new Date();

  const eligibleCountLive = await Product.countDocuments(ELIGIBLE_FILTER);

  const cacheIsFresh =
    session &&
    !opts.forceRefresh &&
    session.expiresAt > now &&
    !searchQuery;

  if (cacheIsFresh) {
    const uniqueIds = cachedUniqueIds(session);

    // Inventory grew (e.g. 4 cached, 5 listed) → rebuild. Do not serve a stale mall.
    const inventoryGrew = eligibleCountLive > uniqueIds.length;

    if (!inventoryGrew && uniqueIds.length > 0) {
      const products = await Product.find({
        _id: { $in: uniqueIds },
        ...ELIGIBLE_FILTER,
      })
        .populate("seller", SELLER_PUBLIC_FIELDS)
        .lean();

      const map = new Map(products.map((p: any) => [String(p._id), p]));
      const hydrate = (ids: string[]) =>
        (ids || []).map((id) => map.get(String(id))).filter(Boolean);

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
        meta: {
          adaptive: eligibleCountLive >= ADAPTIVE_THRESHOLD,
          fromCache: true,
          eligibleCount: eligibleCountLive,
          adaptiveThreshold: ADAPTIVE_THRESHOLD,
        },
      };
    }
  }

  const localProducts = await Product.find({
    ...ELIGIBLE_FILTER,
    region,
  })
    .populate("seller", SELLER_PUBLIC_FIELDS)
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(800)
    .lean();

  let candidates = [...localProducts];

  const extra = await Product.find({
    ...ELIGIBLE_FILTER,
    ...(localProducts.length
      ? { _id: { $nin: localProducts.map((p: any) => p._id) } }
      : {}),
  })
    .populate("seller", SELLER_PUBLIC_FIELDS)
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(1200)
    .lean();

  candidates = [...candidates, ...extra];

  const eligibleCount = candidates.length;

  if (eligibleCount === 0) {
    return {
      sessionId,
      region,
      rooms: { 1: [], 2: [], 3: [], 4: [] },
      cached: false,
      meta: {
        adaptive: false,
        eligibleCount: 0,
        adaptiveThreshold: ADAPTIVE_THRESHOLD,
      },
    };
  }

  const ids = candidates.map((p: any) => p._id);
  const perfs = await ProductPerformance.find({ product: { $in: ids } })
    .select("product views cartAdds purchases score")
    .lean();
  const perfMap = new Map(perfs.map((p: any) => [String(p.product), p]));

  const interest = await buildInterestProfile(userId, sessionId);
  const exposureCounts: Record<string, number> = {};
  if (session?.exposureCounts) {
    const raw =
      session.exposureCounts instanceof Map
        ? Object.fromEntries(session.exposureCounts)
        : session.exposureCounts;
    Object.assign(exposureCounts, raw || {});
  }

  const adaptiveOn = eligibleCount >= ADAPTIVE_THRESHOLD;

  const scored = candidates
    .map((product: any) =>
      scoreProduct({
        product,
        perf: perfMap.get(String(product._id)) || null,
        region,
        interest,
        exposureCount: Number(exposureCounts[String(product._id)] || 0),
        searchQuery,
        softInterest: true,
      })
    )
    .sort((a, b) => b.score - a.score);

  const { room1, room2, room3, room4 } = adaptiveOn
    ? distributeAdaptive(scored)
    : distributeInventoryFirst(scored);

  const ids1 = new Set(room1.map((s) => productId(s.product)));
  const final2 = room2.filter((s) => !ids1.has(productId(s.product)));

  const productIdsByRoom = {
    1: room1.map((s) => productId(s.product)),
    2: final2.map((s) => productId(s.product)),
    3: room3.map((s) => productId(s.product)),
    4: room4.map((s) => productId(s.product)),
  };

  const nextExposure = { ...exposureCounts };
  for (const id of [
    ...productIdsByRoom[1],
    ...productIdsByRoom[2],
    ...productIdsByRoom[3],
    ...productIdsByRoom[4],
  ]) {
    if (!id) continue;
    nextExposure[id] = (nextExposure[id] || 0) + 1;
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await ShowroomSession.findOneAndUpdate(
    { sessionId },
    {
      sessionId,
      user: userId || null,
      region,
      behaviorSig: searchQuery
        ? `search:${searchQuery}`
        : adaptiveOn
          ? "adaptive"
          : "inventory_first",
      productIdsByRoom,
      exposureCounts: nextExposure,
      expiresAt,
    },
    { upsert: true, returnDocument: "after" }
  );

  return {
    sessionId,
    region,
    rooms: {
      1: room1.map((s) => s.product),
      2: final2.map((s) => s.product),
      3: room3.map((s) => s.product),
      4: room4.map((s) => s.product),
    },
    cached: false,
    meta: {
      adaptive: adaptiveOn,
      eligibleCount,
      adaptiveThreshold: ADAPTIVE_THRESHOLD,
      localCount: localProducts.length,
      roomSizes: {
        1: room1.length,
        2: final2.length,
        3: room3.length,
        4: room4.length,
      },
    },
  };
}

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
        softInterest: true,
      })
    )
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.product);
}