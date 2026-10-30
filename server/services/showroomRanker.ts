/**
 * Plazore Showroom Ranker (V3.0)
 * DISCIPLINED · LOCATION-AWARE · PLAN-EFFECTIVE · ACTIVITY-INTELLIGENT
 *
 * Capacities (unchanged):
 *   Room 1 = 50 unique   (THE HORIZON)     rotate every 1 hour
 *   Room 2 = 14 unique   (THE CHAMBER)     rotate every 30 minutes
 *   Room 1 + Room 2 = 64 unique (no overlap)
 *   Room 3 = 16          (THE SIGNAL)      rotate every 18 minutes · TikTok-style FYP
 *   Room 4 = 30          (THE LOCALE)      always live · regional first + nearest
 *   Full mall = 110 slots
 *
 * Priority order for ranking signals:
 *   1. Seller plan (Dominant Niche / Business Plus / Global Reach)
 *   2. Local region products (second priority)
 *   3. Commerce + user activity signals
 *   4. Freshness + quality
 *
 * Guest (unsigned) behaviour:
 *   - Uses detected region
 *   - Strong preference for local products
 *   - Paid plans are highly effective
 *   - Rooms are never random
 *
 * Adaptive ON  only when eligibleCount >= 110
 * Adaptive OFF when eligibleCount < 110 → inventory-first, no padding
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
import { getNearestRegions } from "../config/regions.js";
import { notifyShowroomRefresh } from "../utils/sendNotification.js";

export const ROOM_CAPACITY = {
  1: 50,
  2: 14,
  3: 16,
  4: 30,
} as const;

export const FULL_SHOWROOM_SLOTS =
  ROOM_CAPACITY[1] + ROOM_CAPACITY[2] + ROOM_CAPACITY[3] + ROOM_CAPACITY[4]; // 110

export const ADAPTIVE_THRESHOLD = FULL_SHOWROOM_SLOTS;

/** Updated rotation windows */
export const ROOM_TTL_MS = {
  1: 1000 * 60 * 60 * 1,  // 1 hour  — THE HORIZON
  2: 1000 * 60 * 30,      // 30 min  — THE CHAMBER
  3: 1000 * 60 * 18,      // 18 min  — THE SIGNAL (FYP)
  4: 0,                   // always live — THE LOCALE
} as const;

export const SESSION_TTL_MS = 1000 * 60 * 60 * 6;

const SELLER_PUBLIC_FIELDS =
  "name storeName storeLogo storeDescription isSellerVerified marketplaceRegion shippingDefaults";

export function buildEligibleQuery(extra: Record<string, any> = {}): any {
  const stockOr = {
    $or: [
      { stock: { $gt: 0 } },
      {
        hasVariants: true,
        variants: {
          $elemMatch: {
            available: { $ne: false },
            stock: { $gt: 0 },
          },
        },
      },
    ],
  };

  const parts: any[] = [{ isActive: true }, stockOr];

  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) continue;
    parts.push({ [key]: value });
  }

  return parts.length === 1 ? parts[0] : { $and: parts };
}

export const ELIGIBLE_FILTER = buildEligibleQuery();

export function isProductEligible(p: any): boolean {
  if (!p || p.isActive === false) return false;
  const topStock = Number(p.stock) || 0;
  if (topStock > 0) return true;
  if (p.hasVariants && Array.isArray(p.variants)) {
    return p.variants.some(
      (v: any) => v && v.available !== false && Number(v.stock) > 0
    );
  }
  return false;
}

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
  productIds: Map<string, number>;
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
  return String(p?.category || "").trim().toLowerCase();
}

function subCategoryKey(p: any): string {
  return String(p?.subCategory || "").trim().toLowerCase();
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
    .limit(220)
    .populate("product", "category subCategory seller price")
    .lean();

  const now = Date.now();

  for (const raw of events as any[]) {
    const product: any = raw?.product;
    if (product == null) continue;

    const createdAt = raw?.createdAt ? new Date(raw.createdAt).getTime() : now;
    const ageHours = (now - createdAt) / (1000 * 60 * 60);
    const decay = Math.exp(-ageHours / 48);

    const eventType = String(raw?.type || "");
    let weight = 0;
    switch (eventType) {
      case "purchase": weight = 16; break;
      case "cart":     weight = 9;  break;
      case "wishlist": weight = 6.5; break;
      case "open":     weight = 4.2; break;
      case "impression": weight = 0.45; break;
      case "skip":     weight = -2.8; break;
      case "search":   weight = 3.2; break;
      default: weight = 0;
    }

    const w = weight * decay;
    if (!w) continue;

    const isDoc = typeof product === "object" && product !== null;
    const pid = isDoc ? productId(product) : String(product || "");
    if (!pid) continue;

    const cat = isDoc ? String(product.category || "").trim() : "";
    const sub = isDoc ? String(product.subCategory || "").trim() : "";
    const seller = isDoc ? String(product.seller || "").trim() : "";
    const band = isDoc ? priceBand(Number(product.price) || 0) : "";

    profile.productIds.set(pid, (profile.productIds.get(pid) || 0) + w);
    if (cat) profile.categories.set(cat, (profile.categories.get(cat) || 0) + w);
    if (sub) profile.subCategories.set(sub, (profile.subCategories.get(sub) || 0) + w);
    if (seller) profile.sellers.set(seller, (profile.sellers.get(seller) || 0) + w);
    if (band) profile.priceBands.set(band, (profile.priceBands.get(band) || 0) + w);
  }

  return profile;
}

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
  interestMultiplier?: number;
  regionalCommerceBoost?: boolean;
  isGuest?: boolean;
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
    isGuest = false,
  } = opts;

  const reasons: string[] = [];
  let score = 0;

  // ── 1. LOCAL REGION (second priority after plan) ──────────────────────
  const pRegion = String(product.region || "").toUpperCase();
  const uRegion = String(region || "NG").toUpperCase();
  let regional = 0.22;
  if (pRegion === uRegion) {
    regional = isGuest ? 1.55 : 1.35; // stronger for guests
    reasons.push("local_region");
  } else if (pRegion && uRegion && pRegion.slice(0, 2) === uRegion.slice(0, 2)) {
    regional = 0.78;
    reasons.push("nearby_region");
  }
  score += regional * (regionalCommerceBoost ? 2.15 : 1.6);

  // ── 2. COMMERCE SIGNALS ───────────────────────────────────────────────
  const views = perf?.views || 0;
  const carts = perf?.cartAdds || 0;
  const purchases = perf?.purchases || 0;
  const wishlist = product.wishlistCount || 0;

  const conversion = views > 0 ? (purchases * 3 + carts) / Math.max(views, 1) : 0;
  const commerceRaw =
    purchases * 16 + carts * 5.5 + views * 0.42 + wishlist * 2.1 + conversion * 42;
  const commerce = Math.log10(1 + commerceRaw) / 3;
  const commerceWeight = regionalCommerceBoost ? 1.65 : 1.15;
  score += clamp(commerce) * commerceWeight;
  if (purchases > 0 || carts > 2) reasons.push("commerce_signal");

  // ── 3. FRESHNESS ──────────────────────────────────────────────────────
  const age = daysSince(product.createdAt);
  const freshness = clamp(1 - age / 21);
  score += freshness * 0.92;
  if (age <= 7) reasons.push("fresh");

  // ── 4. USER INTEREST / ACTIVITY ───────────────────────────────────────
  let interestScore = 0;
  const cat = String(product.category || "").trim();
  const sub = String(product.subCategory || "").trim();
  const sellerId = String(product.seller?._id || product.seller || "");
  const band = priceBand(Number(product.price) || 0);
  const pid = productId(product);

  if (pid && interest.productIds.has(pid)) {
    interestScore += clamp(interest.productIds.get(pid)! / 16) * 0.75;
    reasons.push("user_engaged_product");
  }
  if (cat && interest.categories.has(cat)) {
    interestScore += clamp(interest.categories.get(cat)! / 18) * 0.52;
  }
  if (sub && interest.subCategories.has(sub)) {
    interestScore += clamp(interest.subCategories.get(sub)! / 11) * 0.34;
  }
  if (sellerId && interest.sellers.has(sellerId)) {
    interestScore += clamp(interest.sellers.get(sellerId)! / 14) * 0.26;
  }
  if (band && interest.priceBands.has(band)) {
    interestScore += clamp(interest.priceBands.get(band)! / 14) * 0.16;
  }
  score += clamp(interestScore) * 1.25 * interestMultiplier;
  if (interestScore > 0.12) reasons.push("matches_interest");

  // ── 5. EXPLORATION / UNDER-EXPOSED ────────────────────────────────────
  let exploration = 0;
  if (age <= 14 && (views < 30 || purchases === 0)) {
    exploration += 0.52;
    reasons.push("exploration_new");
  }
  if (views < 8 && carts === 0) {
    exploration += 0.26;
    reasons.push("underexposed");
  }
  score += exploration * 0.9;

  // ── 6. QUALITY ────────────────────────────────────────────────────────
  let quality = 0.28;
  if (product.isActive !== false) quality += 0.18;
  if (isProductEligible(product)) quality += 0.22;
  if (product.images?.length > 0) quality += 0.16;
  if (product.isFeatured) quality += 0.18;
  score += quality * 0.48;

  // ── 7. SEARCH ─────────────────────────────────────────────────────────
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    const name = String(product.name || "").toLowerCase();
    const desc = String(product.description || "").toLowerCase();
    const brand = String(product.brand || "").toLowerCase();
    let searchHit = 0;
    if (name.includes(q)) searchHit += 1.25;
    if (brand.includes(q)) searchHit += 0.72;
    if (cat.toLowerCase().includes(q)) searchHit += 0.48;
    if (sub.toLowerCase().includes(q)) searchHit += 0.38;
    if (desc.includes(q)) searchHit += 0.22;
    score += searchHit * 1.85;
    if (searchHit > 0) reasons.push("search_match");
  }

  // ── 8. PLAN BOOST (strongest signal when enabled) ─────────────────────
  if (applyPlanBoost) {
    const planPri = Number(planDiscoveryPriority) || 10;
    // Stronger weighting so Dominant / Business Plus / Global Reach dominate
    const planBoost = clamp(planPri / 100) * 2.25;
    score += planBoost;

    if (planPri >= 100) reasons.push("plan_global_reach");
    else if (planPri >= 70) reasons.push("plan_business_plus");
    else if (planPri >= 40) reasons.push("plan_dominant");

    if (planVisibility === "maximum") {
      score += 0.48;
      reasons.push("plan_visibility_maximum");
    } else if (planVisibility === "high") {
      score += 0.30;
      reasons.push("plan_visibility_high");
    } else if (planVisibility === "increased") {
      score += 0.15;
      reasons.push("plan_visibility_increased");
    }
  }

  // ── 9. EXPOSURE PENALTY ───────────────────────────────────────────────
  const positiveSignal = purchases * 3 + carts * 2 + wishlist;
  const rawPenalty = Math.max(0, exposureCount - positiveSignal * 0.5);
  const exposurePenalty = Math.min(1.5, rawPenalty * 0.23);
  score -= exposurePenalty * 1.3;
  if (exposurePenalty > 0.3) reasons.push("exposure_penalty");

  // Tiny deterministic jitter so ranking is stable but not identical every time
  const idHash = [...pid].reduce((a, c) => a + c.charCodeAt(0), 0);
  score += ((idHash % 17) / 17) * 0.07;

  return { product, score, reasons };
}

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
 * Room 2 – Intelligent comparison pairs.
 * Priority: same subcategory → same category → fill.
 */
function selectComparisonPairs(
  scored: ScoredProduct[],
  capacity: number,
  exclude: Set<string>
): ScoredProduct[] {
  if (capacity <= 0) return [];

  const byCat = new Map<string, ScoredProduct[]>();
  for (const s of scored) {
    const id = productId(s.product);
    if (!id || exclude.has(id)) continue;
    const cat = categoryKey(s.product) || "other";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(s);
  }

  for (const list of byCat.values()) {
    list.sort((a, b) => b.score - a.score);
  }

  const catOrder = [...byCat.entries()].sort(
    (a, b) => (b[1][0]?.score || 0) - (a[1][0]?.score || 0)
  );

  const selected: ScoredProduct[] = [];
  const used = new Set<string>();

  const pushPair = (a: ScoredProduct, b: ScoredProduct | null) => {
    const idA = productId(a.product);
    if (used.has(idA) || selected.length >= capacity) return;
    selected.push({ ...a, reasons: [...a.reasons, "comparison_pair"] });
    used.add(idA);
    if (b && selected.length < capacity) {
      const idB = productId(b.product);
      if (!used.has(idB)) {
        selected.push({ ...b, reasons: [...b.reasons, "comparison_pair"] });
        used.add(idB);
      }
    }
  };

  // Pass 1: strict same-subcategory pairs only
  for (const [, list] of catOrder) {
    if (selected.length >= capacity) break;
    const remaining = list.filter((s) => !used.has(productId(s.product)));
    for (let i = 0; i < remaining.length; i++) {
      if (selected.length >= capacity) break;
      if (used.has(productId(remaining[i].product))) continue;
      const a = remaining[i];
      const subA = subCategoryKey(a.product);
      if (!subA) continue; // require subcategory for intelligent comparison

      let partner: ScoredProduct | null = null;
      for (let j = i + 1; j < remaining.length; j++) {
        const cand = remaining[j];
        if (used.has(productId(cand.product))) continue;
        if (subCategoryKey(cand.product) === subA) {
          partner = cand;
          break;
        }
      }
      if (partner) pushPair(a, partner);
    }
  }

  // Pass 2: same-category fallback only if still short
  if (selected.length < capacity) {
    for (const [, list] of catOrder) {
      if (selected.length >= capacity) break;
      const remaining = list.filter((s) => !used.has(productId(s.product)));
      for (let i = 0; i < remaining.length - 1; i += 2) {
        if (selected.length >= capacity) break;
        pushPair(remaining[i], remaining[i + 1] || null);
      }
    }
  }

  // Final fill
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
 * Inventory-first mode (< 110 eligible)
 */
function distributeInventoryFirst(scored: ScoredProduct[]): {
  room1: ScoredProduct[];
  room2: ScoredProduct[];
  room3: ScoredProduct[];
  room4: ScoredProduct[];
} {
  const n = scored.length;
  if (n === 0) return { room1: [], room2: [], room3: [], room4: [] };

  const used = new Set<string>();

  const room1 = takeUnique(scored, Math.min(ROOM_CAPACITY[1], n), used);
  room1.forEach((s) => used.add(productId(s.product)));

  const remaining = scored.filter((s) => !used.has(productId(s.product)));
  const room2 = selectComparisonPairs(
    remaining,
    Math.min(ROOM_CAPACITY[2], n - used.size),
    used
  );
  room2.forEach((s) => used.add(productId(s.product)));

  const room3 = takeUnique(scored, Math.min(ROOM_CAPACITY[3], n - used.size), used);
  room3.forEach((s) => used.add(productId(s.product)));

  const room4 = takeUnique(scored, Math.min(ROOM_CAPACITY[4], n - used.size), used);

  return { room1, room2, room3, room4 };
}

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

  // Room 1 – selective, plan-heavy, diversity controlled
  const room1 = selectWithDiversity(scoredRoom1, ROOM_CAPACITY[1], {
    maxPerCategory: 11,
    maxPerSeller: 5,
  });
  const used1 = new Set(room1.map((s) => productId(s.product)));

  // Room 2 – intelligent same-subcategory pairs
  const room2 = selectComparisonPairs(
    scoredRoom2.filter((s) => !used1.has(productId(s.product))),
    ROOM_CAPACITY[2],
    used1
  );
  const used12 = new Set([
    ...used1,
    ...room2.map((s) => productId(s.product)),
  ]);

  // Room 3 – FYP style, controlled reuse
  const room3 = selectAdaptiveWithControlledReuse(
    scoredRoom3,
    ROOM_CAPACITY[3],
    used12,
    {
      maxPerCategory: 6,
      maxPerSeller: 3,
      reuseMinScoreRatio: 0.66,
    }
  );

  // Room 4 – regional first
  const room4 = selectAdaptiveWithControlledReuse(
    scoredRoom4,
    ROOM_CAPACITY[4],
    used12,
    {
      maxPerCategory: 10,
      maxPerSeller: 5,
      reuseMinScoreRatio: 0.70,
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

function roomsNeedingRefresh(
  session: any | null,
  forceRefresh: boolean,
  eligibleCount: number
): Set<number> {
  const need = new Set<number>();
  if (forceRefresh || !session) {
    need.add(1); need.add(2); need.add(3); need.add(4);
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
      need.add(r);
      continue;
    }
    const t = builtAt[String(r)] || builtAt[r as any];
    const ts = t ? new Date(t).getTime() : 0;
    if (!ts || now - ts >= ROOM_TTL_MS[r]) {
      need.add(r);
    }
  }

  for (const r of [1, 2, 3, 4] as const) {
    const ids = sess?.productIdsByRoom?.[r] || [];
    if (!ids.length) need.add(r);
  }

  const cachedUnique = cachedUniqueIds(session).length;
  if (
    eligibleCount > 0 &&
    eligibleCount < ADAPTIVE_THRESHOLD &&
    cachedUnique < eligibleCount
  ) {
    need.add(1); need.add(2); need.add(3); need.add(4);
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
  const sessionId = opts.sessionId || crypto.randomBytes(16).toString("hex");
  const userId = opts.userId || null;
  const isGuest = !userId;
  const searchQuery = opts.searchQuery?.trim() || "";

  let session = await ShowroomSession.findOne({ sessionId });
  const now = new Date();

  const eligibleCountLive = await Product.countDocuments(buildEligibleQuery());

  const needRefresh = roomsNeedingRefresh(
    session,
    !!opts.forceRefresh || !!searchQuery,
    eligibleCountLive
  );

  // Full cache hit
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
      const products = await Product.find(
        buildEligibleQuery({ _id: { $in: uniqueIds } })
      )
        .populate("seller", SELLER_PUBLIC_FIELDS)
        .lean();

      const eligibleProducts = (products as any[]).filter(isProductEligible);
      const map = new Map(eligibleProducts.map((p: any) => [String(p._id), p]));
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
          isGuest,
        },
      };
    }
    needRefresh.add(1); needRefresh.add(2); needRefresh.add(3); needRefresh.add(4);
  }

  // Load candidates – prioritise local region first
  const localProducts = await Product.find(buildEligibleQuery({ region }))
    .populate("seller", SELLER_PUBLIC_FIELDS)
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(900)
    .lean();

  let candidates = [...localProducts];

  // Nearest regions next (for Room 4 fill quality)
  const nearest = getNearestRegions(region);
  if (nearest.length) {
    const nearProducts = await Product.find(
      buildEligibleQuery({
        region: { $in: nearest },
        _id: { $nin: localProducts.map((p: any) => p._id) },
      })
    )
      .populate("seller", SELLER_PUBLIC_FIELDS)
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(400)
      .lean();
    candidates = [...candidates, ...nearProducts];
  }

  // Rest of world
  const excludeIds = candidates.map((p: any) => p._id);
  const extra = await Product.find(
    buildEligibleQuery(excludeIds.length ? { _id: { $nin: excludeIds } } : {})
  )
    .populate("seller", SELLER_PUBLIC_FIELDS)
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(1000)
    .lean();

  candidates = [...candidates, ...extra];
  candidates = candidates.filter(isProductEligible);
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
        isGuest,
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
          isGuest,
        });
      })
      .sort((a, b) => b.score - a.score);

  // Room scoring profiles
  const scoredRoom1 = scoreFor(true, isGuest ? 0.9 : 1.05, false);
  const scoredRoom2 = scoredRoom1; // same base pool, different selection
  const scoredRoom3 = scoreFor(false, isGuest ? 1.8 : 2.6, false); // strong activity weight
  const scoredRoom4 = scoreFor(true, 0.8, true); // regional commerce heavy

  // Cold-start boost for Room 3 when user has almost no activity
  if (interest.productIds.size < 3 && interest.categories.size < 2) {
    scoredRoom3.forEach((s) => {
      if (
        s.reasons.includes("commerce_signal") ||
        s.reasons.includes("local_region") ||
        s.reasons.includes("plan_business_plus") ||
        s.reasons.includes("plan_global_reach") ||
        s.reasons.includes("fresh")
      ) {
        s.score *= 1.28;
      }
    });
    scoredRoom3.sort((a, b) => b.score - a.score);
  }

  let room1: ScoredProduct[];
  let room2: ScoredProduct[];
  let room3: ScoredProduct[];
  let room4: ScoredProduct[];

  if (!adaptiveOn) {
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

  // Partial refresh
  if (session && needRefresh.size < 4 && !searchQuery && !opts.forceRefresh) {
    const uniqueIds = cachedUniqueIds(session);
    if (uniqueIds.length) {
      const products = await Product.find(
        buildEligibleQuery({ _id: { $in: uniqueIds } })
      )
        .populate("seller", SELLER_PUBLIC_FIELDS)
        .lean();
      const map = new Map(
        (products as any[])
          .filter(isProductEligible)
          .map((p: any) => [String(p._id), p])
      );
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
    }
  }

  // Enforce uniqueness Room 1 ↔ Room 2
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

  if (userId && !searchQuery) {
    const changed = [...needRefresh].filter((r) => r === 1 || r === 2);
    if (changed.length) {
      notifyShowroomRefresh({
        userId: String(userId),
        rooms: changed,
      }).catch((err) => console.error("[showroom] push failed", err));
    }
  }

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
      mode: adaptiveOn ? "adaptive" : "inventory_first",
      isGuest,
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
        interestMultiplier: 1.25,
        regionalCommerceBoost: false,
        isGuest: !opts.userId,
      });
    })
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.product);
}