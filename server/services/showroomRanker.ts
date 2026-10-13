/**
 * Plazore Showroom Ranker (V2)
 * FULLNESS FIRST · ADAPTABILITY SECOND
 *
 * Capacities (unchanged):
 *   Room 1 = 50 unique   (THE HORIZON / Expanded View)     rotate ~2h
 *   Room 2 = 14 unique   (THE CHAMBER / Private Selection) rotate ~3h
 *   Room 1 + Room 2 = 64 unique (no overlap)
 *   Room 3 = 16          (THE SIGNAL / The Watch)          rotate ~20m · user activity
 *   Room 4 = 30          (THE LOCALE)                      always live · regional top
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
 * Plan visibility boost applies to Rooms 1, 2, 4 ONLY (not Room 3).
 * Room 3 is pure user-activity signal.
 *
 * Rooms 3 & 4 may reuse Room 1/2 products ONLY when adaptive is ON
 * and a real ranking signal justifies another appearance.
 */

import crypto from "crypto";
import Product from "../models/Products.js";
import ProductPerformance from "../models/ProductPerformance.js";
import ShowroomSession from "../models/ShowroomSession.js";
import ShowroomEvent from "../models/ShowroomEvent.js";
import SellerSubscription from "../models/SellerSubscription.js";
import {
  getPlanBenefits,
  type PlanId,
} from "../config/plans.js";

export const ROOM_CAPACITY = {
  1: 50,
  2: 14,
  3: 16,
  4: 30,
} as const;

export const FULL_SHOWROOM_SLOTS =
  ROOM_CAPACITY[1] + ROOM_CAPACITY[2] + ROOM_CAPACITY[3] + ROOM_CAPACITY[4]; // 110

export const ADAPTIVE_THRESHOLD = FULL_SHOWROOM_SLOTS;

/** Per-room cache / rotation windows */
export const ROOM_TTL_MS = {
  1: 1000 * 60 * 60 * 2, // 2 hours — Expanded View
  2: 1000 * 60 * 60 * 3, // 3 hours — Private Selection
  3: 1000 * 60 * 20, // 20 minutes — The Watch (user activity)
  4: 0, // always live — The Locale
} as const;

/** Session document TTL (longest room + buffer) */
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
  productIds: Map<string, number>; // products user engaged with most
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

function categoryKey(p: any): string {
  return String(p?.category || "")
    .trim()
    .toLowerCase();
}

function subCategoryKey(p: any): string {
  return String(p?.subCategory || "")
    .trim()
    .toLowerCase();
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
    productIds: new Map(),
  };

  const query: any = { sessionId };
  if (userId) {
    query.$or = [{ sessionId }, { user: userId }];
  }

  const events = await ShowroomEvent.find(query)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("product", "category subCategory seller price")
    .lean();

  const now = Date.now();

  for (const raw of events as any[]) {
    const product: any = raw?.product;
    if (product == null) continue;

    const createdAt = raw?.createdAt ? new Date(raw.createdAt).getTime() : now;
    const ageHours = (now - createdAt) / (1000 * 60 * 60);
    // Room 3 is more reactive — shorter decay window
    const decay = Math.exp(-ageHours / 48);

    const eventType = String(raw?.type || "");
    let weight = 0;
    switch (eventType) {
      case "purchase":
        weight = 14;
        break;
      case "cart":
        weight = 8;
        break;
      case "wishlist":
        weight = 6;
        break;
      case "open":
        weight = 4;
        break;
      case "impression":
        weight = 0.5;
        break;
      case "skip":
        weight = -2.5;
        break;
      case "search":
        weight = 3;
        break;
      default:
        weight = 0;
    }

    const w = weight * decay;
    if (!w) continue;

    // product may be populated doc OR plain ObjectId / string
    const isDoc = typeof product === "object" && product !== null;
    const pid = isDoc ? productId(product) : String(product || "");
    if (!pid) continue;

    const cat = isDoc ? String(product.category || "").trim() : "";
    const sub = isDoc ? String(product.subCategory || "").trim() : "";
    const seller = isDoc ? String(product.seller || "").trim() : "";
    const band = isDoc ? priceBand(Number(product.price) || 0) : "";

    profile.productIds.set(pid, (profile.productIds.get(pid) || 0) + w);
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

/** Batch load discoveryPriority + visibility for seller IDs (one query). */
async function loadSellerPlanBoosts(
  sellerIds: string[]
): Promise<Map<string, { priority: number; visibility: string }>> {
  const map = new Map<string, { priority: number; visibility: string }>();
  const unique = [...new Set(sellerIds.map(String).filter(Boolean))];
  if (!unique.length) return map;

  try {
    const subs = await SellerSubscription.find({
      seller: { $in: unique },
      status: { $in: ["active", "pending_payment"] },
    })
      .select("seller planId status expiresAt isPromotional")
      .lean();

    const now = Date.now();
    for (const sub of subs as any[]) {
      let planId = String(sub.planId || "free") as PlanId;
      if (
        planId !== "free" &&
        sub.expiresAt &&
        new Date(sub.expiresAt).getTime() < now
      ) {
        planId = "free";
      }
      const benefits = getPlanBenefits(planId);
      map.set(String(sub.seller), {
        priority: benefits.discoveryPriority ?? 10,
        visibility: benefits.showroomVisibility || "standard",
      });
    }
  } catch (e) {
    console.error("[showroomRanker] plan boost load failed", e);
  }

  return map;
}

/**
 * Base commerce / quality / freshness score shared across rooms.
 * Plan boost is optional (rooms 1, 2, 4 only).
 */
function scoreProductBase(opts: {
  product: any;
  perf: any | null;
  region: string;
  interest: InterestProfile;
  exposureCount: number;
  searchQuery?: string;
  applyPlanBoost: boolean;
  planDiscoveryPriority?: number;
  planVisibility?: string;
  /** Extra weight on user interest (Room 3) */
  interestMultiplier?: number;
  /** Extra weight on regional commerce (Room 4) */
  regionalCommerceBoost?: boolean;
}): ScoredProduct {
  const {
    product,
    perf,
    region,
    interest,
    exposureCount,
    searchQuery,
    applyPlanBoost,
    planDiscoveryPriority = 10,
    planVisibility = "standard",
    interestMultiplier = 1,
    regionalCommerceBoost = false,
  } = opts;

  const reasons: string[] = [];
  let score = 0;

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
  score += regional * (regionalCommerceBoost ? 1.85 : 1.25);

  const views = perf?.views || 0;
  const carts = perf?.cartAdds || 0;
  const purchases = perf?.purchases || 0;
  const wishlist = product.wishlistCount || 0;

  const conversion =
    views > 0 ? (purchases * 3 + carts) / Math.max(views, 1) : 0;
  const commerceRaw =
    purchases * 15 + carts * 5 + views * 0.4 + wishlist * 2 + conversion * 40;
  const commerce = Math.log10(1 + commerceRaw) / 3;
  const commerceWeight = regionalCommerceBoost ? 1.55 : 1.1;
  score += clamp(commerce) * commerceWeight;
  if (purchases > 0 || carts > 2) reasons.push("commerce_signal");

  const age = daysSince(product.createdAt);
  const freshness = clamp(1 - age / 21);
  score += freshness * 0.95;
  if (age <= 7) reasons.push("fresh");

  // User interest
  let interestScore = 0;
  const cat = String(product.category || "").trim();
  const sub = String(product.subCategory || "").trim();
  const sellerId = String(product.seller?._id || product.seller || "");
  const band = priceBand(Number(product.price) || 0);
  const pid = productId(product);

  if (pid && interest.productIds.has(pid)) {
    interestScore += clamp(interest.productIds.get(pid)! / 18) * 0.7;
    reasons.push("user_engaged_product");
  }
  if (cat && interest.categories.has(cat)) {
    interestScore += clamp(interest.categories.get(cat)! / 20) * 0.5;
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
  score += clamp(interestScore) * 1.2 * interestMultiplier;
  if (interestScore > 0.12) reasons.push("matches_interest");

  // Exploration / underexposed (strong for Room 1)
  let exploration = 0;
  if (age <= 14 && (views < 30 || purchases === 0)) {
    exploration += 0.55;
    reasons.push("exploration_new");
  }
  if (views < 8 && carts === 0) {
    exploration += 0.28;
    reasons.push("underexposed");
  }
  score += exploration * 0.95;

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

  // Plan boost — Rooms 1, 2, 4 only
  if (applyPlanBoost) {
    const planPri = Number(planDiscoveryPriority) || 10;
    const planBoost = clamp(planPri / 100) * 1.45;
    score += planBoost;
    if (planPri >= 100) reasons.push("plan_global_reach");
    else if (planPri >= 70) reasons.push("plan_business_plus");
    else if (planPri >= 40) reasons.push("plan_dominant");

    if (planVisibility === "maximum" || planVisibility === "high") {
      score += 0.22;
      reasons.push("plan_visibility_" + planVisibility);
    } else if (planVisibility === "increased") {
      score += 0.1;
      reasons.push("plan_visibility_increased");
    }
  }

  const positiveSignal = purchases * 3 + carts * 2 + wishlist;
  const rawPenalty = Math.max(0, exposureCount - positiveSignal * 0.5);
  const exposurePenalty = Math.min(1.4, rawPenalty * 0.22);
  score -= exposurePenalty * 1.25;
  if (exposurePenalty > 0.3) reasons.push("exposure_penalty");

  // Slight deterministic jitter so room 1 doesn't feel static within a window
  const idHash = [...pid].reduce((a, c) => a + c.charCodeAt(0), 0);
  score += ((idHash % 17) / 17) * 0.08;

  return { product, score, reasons };
}

/** Unique sequential pick. Never fabricates rows. */
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

/**
 * Room 2 — Private Selection
 * Pair similar products side-by-side (same category preferred, then subcategory).
 * Returns up to `capacity` unique products ordered as pairs: [A1, A2, B1, B2, ...]
 */
function selectComparisonPairs(
  scored: ScoredProduct[],
  capacity: number,
  exclude: Set<string>
): ScoredProduct[] {
  if (capacity <= 0) return [];

  // Group by category
  const byCat = new Map<string, ScoredProduct[]>();
  for (const s of scored) {
    const id = productId(s.product);
    if (!id || exclude.has(id)) continue;
    const cat = categoryKey(s.product) || "other";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(s);
  }

  // Sort each category by score
  for (const list of byCat.values()) {
    list.sort((a, b) => b.score - a.score);
  }

  // Categories ordered by best score in group (attractiveness)
  const catOrder = [...byCat.entries()].sort(
    (a, b) => (b[1][0]?.score || 0) - (a[1][0]?.score || 0)
  );

  const selected: ScoredProduct[] = [];
  const used = new Set<string>();

  const pushPair = (a: ScoredProduct, b: ScoredProduct | null) => {
    const idA = productId(a.product);
    if (used.has(idA) || selected.length >= capacity) return;
    selected.push({
      ...a,
      reasons: [...a.reasons, "comparison_pair"],
    });
    used.add(idA);
    if (b && selected.length < capacity) {
      const idB = productId(b.product);
      if (!used.has(idB)) {
        selected.push({
          ...b,
          reasons: [...b.reasons, "comparison_pair"],
        });
        used.add(idB);
      }
    }
  };

  // Prefer pairs within same category; second item prefers same subcategory
  for (const [, list] of catOrder) {
    if (selected.length >= capacity) break;
    const remaining = list.filter((s) => !used.has(productId(s.product)));
    for (let i = 0; i < remaining.length; i++) {
      if (selected.length >= capacity) break;
      if (used.has(productId(remaining[i].product))) continue;
      const a = remaining[i];
      const subA = subCategoryKey(a.product);
      let partner: ScoredProduct | null = null;
      for (let j = i + 1; j < remaining.length; j++) {
        const cand = remaining[j];
        if (used.has(productId(cand.product))) continue;
        if (subA && subCategoryKey(cand.product) === subA) {
          partner = cand;
          break;
        }
        if (!partner) partner = cand; // fallback same category
      }
      pushPair(a, partner);
    }
  }

  // Fill remainder with top remaining unique scores
  if (selected.length < capacity) {
    for (const s of scored) {
      if (selected.length >= capacity) break;
      const id = productId(s.product);
      if (!id || used.has(id) || exclude.has(id)) continue;
      selected.push(s);
      used.add(id);
    }
  }

  return selected.slice(0, capacity);
}

function hasReuseReason(s: ScoredProduct): boolean {
  return (
    s.reasons.includes("matches_interest") ||
    s.reasons.includes("user_engaged_product") ||
    s.reasons.includes("commerce_signal") ||
    s.reasons.includes("local_region") ||
    s.reasons.includes("fresh") ||
    s.reasons.includes("exploration_new") ||
    s.reasons.includes("search_match") ||
    s.reasons.includes("plan_global_reach") ||
    s.reasons.includes("plan_business_plus") ||
    s.reasons.includes("plan_dominant")
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
 * Put every unique eligible product on the floor.
 * Room 1 fills first (up to 50), leftover unique → 2 → 3 → 4.
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

  // Room 2 still tries comparison pairing from remaining
  const remaining = scored.filter((s) => !used.has(productId(s.product)));
  const room2 = selectComparisonPairs(
    remaining,
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
 *
 * Room 1 — strong exploration + plan visibility (unique)
 * Room 2 — intelligent similar pairs (unique vs room 1)
 * Room 3 — user activity heavy, NO plan boost
 * Room 4 — regional top performers + plan visibility, live
 */
function distributeAdaptive(opts: {
  scoredRoom1: ScoredProduct[];
  scoredRoom2: ScoredProduct[];
  scoredRoom3: ScoredProduct[];
  scoredRoom4: ScoredProduct[];
}): {
  room1: ScoredProduct[];
  room2: ScoredProduct[];
  room3: ScoredProduct[];
  room4: ScoredProduct[];
} {
  const { scoredRoom1, scoredRoom2, scoredRoom3, scoredRoom4 } = opts;

  const room1 = selectWithDiversity(scoredRoom1, ROOM_CAPACITY[1], {
    maxPerCategory: 14,
    maxPerSeller: 7,
  });
  const used1 = new Set(room1.map((s) => productId(s.product)));

  const room2 = selectComparisonPairs(
    scoredRoom2.filter((s) => !used1.has(productId(s.product))),
    ROOM_CAPACITY[2],
    used1
  );
  const used12 = new Set([
    ...used1,
    ...room2.map((s) => productId(s.product)),
  ]);

  // Room 3 — activity first; may carefully reuse high-interest items
  const room3 = selectAdaptiveWithControlledReuse(
    scoredRoom3,
    ROOM_CAPACITY[3],
    used12,
    {
      maxPerCategory: 6,
      maxPerSeller: 3,
      reuseMinScoreRatio: 0.68,
    }
  );

  // Room 4 — regional commerce; may carefully reuse
  const room4 = selectAdaptiveWithControlledReuse(
    scoredRoom4,
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
    pool: ScoredProduct[],
    cap: number,
    exclude: Set<string>
  ) => {
    if (room.length >= cap) return room;
    const have = new Set(room.map((r) => productId(r.product)));
    for (const s of pool) {
      if (room.length >= cap) break;
      const id = productId(s.product);
      if (!id || have.has(id) || exclude.has(id)) continue;
      room.push(s);
      have.add(id);
    }
    return room;
  };

  fillUniqueOnly(room3, scoredRoom3, ROOM_CAPACITY[3], used12);
  fillUniqueOnly(room4, scoredRoom4, ROOM_CAPACITY[4], new Set());

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

/**
 * Decide which rooms need a rebuild based on per-room TTL.
 * Room 4 is always rebuilt (live).
 */
function roomsNeedingRefresh(
  session: any | null,
  forceRefresh: boolean
): Set<number> {
  const need = new Set<number>();
  if (forceRefresh || !session) {
    need.add(1);
    need.add(2);
    need.add(3);
    need.add(4);
    return need;
  }

  const now = Date.now();
  const sess: any = session;
  const builtAtRaw = sess?.roomBuiltAt || {};
  const builtAt: Record<string, any> =
    builtAtRaw instanceof Map
      ? Object.fromEntries(builtAtRaw as Map<string, any>)
      : typeof builtAtRaw === "object" && builtAtRaw
        ? builtAtRaw
        : {};

  for (const r of [1, 2, 3, 4] as const) {
    if (ROOM_TTL_MS[r] === 0) {
      need.add(r); // always live
      continue;
    }
    const t = builtAt[String(r)] || builtAt[r as any];
    const ts = t ? new Date(t).getTime() : 0;
    if (!ts || now - ts >= ROOM_TTL_MS[r]) {
      need.add(r);
    }
  }

  // Also refresh if room is empty in cache
  for (const r of [1, 2, 3, 4] as const) {
    const ids = sess?.productIdsByRoom?.[r] || [];
    if (!ids.length) need.add(r);
  }

  return need;
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

  const needRefresh = roomsNeedingRefresh(session, !!opts.forceRefresh || !!searchQuery);

  // Full cache hit only if no room needs refresh and inventory didn't grow past cached set
  if (
    session &&
    !opts.forceRefresh &&
    !searchQuery &&
    needRefresh.size === 0 &&
    session.expiresAt > now
  ) {
    const uniqueIds = cachedUniqueIds(session);
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
          roomTtlMs: { ...ROOM_TTL_MS },
        },
      };
    }
    // Fall through to rebuild if inventory grew
    needRefresh.add(1);
    needRefresh.add(2);
    needRefresh.add(3);
    needRefresh.add(4);
  }

  // Load candidates
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
        roomTtlMs: { ...ROOM_TTL_MS },
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

  const sellerIds = candidates.map((p: any) =>
    String(p.seller?._id || p.seller || "")
  );
  const planBoostMap = await loadSellerPlanBoosts(sellerIds);

  const scoreFor = (
    applyPlanBoost: boolean,
    interestMultiplier: number,
    regionalCommerceBoost: boolean
  ) =>
    candidates
      .map((product: any) => {
        const sid = String(product.seller?._id || product.seller || "");
        const boost = planBoostMap.get(sid) || {
          priority: 10,
          visibility: "standard",
        };
        return scoreProductBase({
          product,
          perf: perfMap.get(String(product._id)) || null,
          region,
          interest,
          exposureCount: Number(exposureCounts[String(product._id)] || 0),
          searchQuery,
          applyPlanBoost,
          planDiscoveryPriority: boost.priority,
          planVisibility: boost.visibility,
          interestMultiplier,
          regionalCommerceBoost,
        });
      })
      .sort((a, b) => b.score - a.score);

  // Room-specific score lists
  // Room 1: exploration + plan (default weights)
  const scoredRoom1 = scoreFor(true, 1.0, false);
  // Room 2: similarity pairs use same plan-boosted scores (pairing does the intelligence)
  const scoredRoom2 = scoredRoom1;
  // Room 3: NO plan boost, heavy interest
  const scoredRoom3 = scoreFor(false, 2.15, false);
  // Room 4: plan boost + regional commerce emphasis
  const scoredRoom4 = scoreFor(true, 0.85, true);

  let room1: ScoredProduct[];
  let room2: ScoredProduct[];
  let room3: ScoredProduct[];
  let room4: ScoredProduct[];

  if (!adaptiveOn) {
    // Inventory-first uses one ranked list (plan on for overall quality)
    const dist = distributeInventoryFirst(scoredRoom1);
    room1 = dist.room1;
    room2 = dist.room2;
    room3 = dist.room3;
    room4 = dist.room4;
  } else {
    const dist = distributeAdaptive({
      scoredRoom1,
      scoredRoom2,
      scoredRoom3,
      scoredRoom4,
    });
    room1 = dist.room1;
    room2 = dist.room2;
    room3 = dist.room3;
    room4 = dist.room4;
  }

  // Partial refresh: keep cached rooms that are still fresh
  if (session && needRefresh.size < 4 && !searchQuery && !opts.forceRefresh) {
    const uniqueIds = cachedUniqueIds(session);
    if (uniqueIds.length) {
      const products = await Product.find({
        _id: { $in: uniqueIds },
        ...ELIGIBLE_FILTER,
      })
        .populate("seller", SELLER_PUBLIC_FIELDS)
        .lean();
      const map = new Map(products.map((p: any) => [String(p._id), p]));
      const hydrateScored = (ids: string[]): ScoredProduct[] =>
        (ids || [])
          .map((id) => {
            const p = map.get(String(id));
            return p ? { product: p, score: 0, reasons: ["cached"] } : null;
          })
          .filter(Boolean) as ScoredProduct[];

      if (!needRefresh.has(1) && session.productIdsByRoom?.[1]?.length) {
        room1 = hydrateScored(session.productIdsByRoom[1]);
      }
      if (!needRefresh.has(2) && session.productIdsByRoom?.[2]?.length) {
        room2 = hydrateScored(session.productIdsByRoom[2]);
      }
      if (!needRefresh.has(3) && session.productIdsByRoom?.[3]?.length) {
        room3 = hydrateScored(session.productIdsByRoom[3]);
      }
      // Room 4 always live — never keep stale from partial path when needRefresh has 4
    }
  }

  // Enforce uniqueness between room 1 and 2
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

  const roomBuiltAt: Record<string, Date> = {};
  const sessAny: any = session;
  const prevBuiltRaw = sessAny?.roomBuiltAt || {};
  const prevBuilt: Record<string, any> =
    prevBuiltRaw instanceof Map
      ? Object.fromEntries(prevBuiltRaw as Map<string, any>)
      : typeof prevBuiltRaw === "object" && prevBuiltRaw
        ? prevBuiltRaw
        : {};

  for (const r of [1, 2, 3, 4] as const) {
    if (needRefresh.has(r) || !prevBuilt[String(r)]) {
      roomBuiltAt[String(r)] = now;
    } else {
      roomBuiltAt[String(r)] = new Date(prevBuilt[String(r)]);
    }
  }
  // Room 4 always stamped as live
  roomBuiltAt["4"] = now;

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
      roomBuiltAt,
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
      planBoostEnabled: true,
      planBoostRooms: [1, 2, 4],
      roomTtlMs: { ...ROOM_TTL_MS },
      roomsRefreshed: [...needRefresh],
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

  const sellerIds = opts.products.map((p) =>
    String(p.seller?._id || p.seller || "")
  );
  const planBoostMap = await loadSellerPlanBoosts(sellerIds);

  const scored = opts.products
    .map((product) => {
      const sid = String(product.seller?._id || product.seller || "");
      const boost = planBoostMap.get(sid) || {
        priority: 10,
        visibility: "standard",
      };
      return scoreProductBase({
        product,
        perf: perfMap.get(String(product._id)) || null,
        region,
        interest,
        exposureCount: 0,
        searchQuery: opts.searchQuery,
        applyPlanBoost: true,
        planDiscoveryPriority: boost.priority,
        planVisibility: boost.visibility,
        interestMultiplier: 1.2,
        regionalCommerceBoost: false,
      });
    })
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.product);
}
