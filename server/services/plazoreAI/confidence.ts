/**
 * Buyer Confidence — evidence-based, not a rating.
 * Listing quality is secondary. Commerce history (seller + product) drives level.
 * Algorithm maintains after AI baseline. No invented evidence.
 */

import mongoose from "mongoose";
import Order from "../../models/Order.js";
import ProductAI, {
  ConfidenceLevel,
  IBuyerConfidence,
} from "../../models/ProductAI.js";

export interface ListingInput {
  description?: string;
  images?: string[];
  shipping?: {
    method?: string;
    courierCompany?: string;
    deliveryFee?: number;
  };
  fulfillmentLocation?: any;
  seller?: {
    storeName?: string;
    storeLogo?: string;
    storeDescription?: string;
    isSellerVerified?: boolean;
  };
  specifications?: Record<string, string>;
  verificationDocuments?: { documentName?: string; documentType?: string }[];
}

export interface CommerceSlice {
  orders: number;
  delivered: number;
  confirmed: number;
  issues: number;
  sellerCancelled: number;
}

export interface CommerceEvidence {
  seller: CommerceSlice;
  product: CommerceSlice;
  gatheredAt: Date;
}

export interface ConfidenceResult extends IBuyerConfidence {
  evidence: CommerceEvidence;
  /** Safe buyer-facing line if AI explanation is missing */
  defaultExplanation: string;
}

const EMPTY_SLICE: CommerceSlice = {
  orders: 0,
  delivered: 0,
  confirmed: 0,
  issues: 0,
  sellerCancelled: 0,
};

function emptyEvidence(): CommerceEvidence {
  return {
    seller: { ...EMPTY_SLICE },
    product: { ...EMPTY_SLICE },
    gatheredAt: new Date(),
  };
}

function levelFromScore(score: number): ConfidenceLevel {
  if (score >= 72) return "High Confidence";
  if (score >= 40) return "Growing Confidence";
  return "Limited Confidence";
}

export function defaultExplanationFor(level: ConfidenceLevel): string {
  if (level === "High Confidence") {
    return "Plazore has substantial commerce evidence supporting this confidence level.";
  }
  if (level === "Growing Confidence") {
    return "Plazore is building more evidence from real commerce activity on this listing and seller.";
  }
  return "There isn’t enough Plazore commerce evidence yet — common for newer listings and sellers.";
}

/** Listing quality only — capped so it cannot alone produce High Confidence. */
function listingQualityPoints(input: ListingInput): {
  points: number;
  factors: string[];
} {
  let points = 0;
  const factors: string[] = [];
  const desc = (input.description || "").trim();

  if (desc.length >= 300) {
    points += 8;
    factors.push("Detailed product description");
  } else if (desc.length >= 120) {
    points += 5;
    factors.push("Clear product description");
  } else if (desc.length >= 40) {
    points += 2;
    factors.push("Basic product description");
  }

  const imageCount = Array.isArray(input.images) ? input.images.length : 0;
  if (imageCount >= 5) {
    points += 8;
    factors.push("Multiple product images");
  } else if (imageCount >= 3) {
    points += 5;
    factors.push("Several product images");
  } else if (imageCount >= 1) {
    points += 2;
    factors.push("Product image available");
  }

  const hasShippingMethod = !!input.shipping?.method;
  const hasCourier =
    input.shipping?.method === "courier"
      ? !!input.shipping?.courierCompany
      : true;
  if (hasShippingMethod && hasCourier) {
    points += 4;
    factors.push("Shipping details provided");
  } else if (hasShippingMethod) {
    points += 2;
    factors.push("Shipping method indicated");
  }

  if (
    input.fulfillmentLocation?.countryCode &&
    input.fulfillmentLocation?.city
  ) {
    points += 3;
    factors.push("Fulfillment location specified");
  }

  const specCount = input.specifications
    ? Object.keys(input.specifications).filter(
        (k) => String(input.specifications![k] || "").trim().length > 0
      ).length
    : 0;
  if (specCount >= 3) points += 2;
  else if (specCount >= 1) points += 1;

  const docCount = Array.isArray(input.verificationDocuments)
    ? input.verificationDocuments.length
    : 0;
  if (docCount >= 1) {
    points += 2;
    factors.push("Supporting documents uploaded");
  }

  let sellerPts = 0;
  if (input.seller?.storeName) sellerPts += 2;
  if (input.seller?.storeLogo) sellerPts += 1;
  if (input.seller?.storeDescription) sellerPts += 1;
  if (input.seller?.isSellerVerified) sellerPts += 2;
  points += sellerPts;
  if (sellerPts >= 5) factors.push("Complete seller profile");
  else if (sellerPts >= 2) factors.push("Seller profile on file");

  // Cap listing contribution — High requires commerce volume
  points = Math.min(28, points);
  return { points, factors };
}

/**
 * Volume-aware commerce score for one slice.
 * Positive rate alone is not enough; sample size matters.
 */
function sliceScore(
  slice: CommerceSlice,
  role: "seller" | "product"
): { points: number; factors: string[] } {
  const factors: string[] = [];
  const delivered = slice.delivered;
  const confirmed = slice.confirmed;
  const issues = slice.issues;
  const decided = confirmed + issues;

  if (delivered === 0) {
    factors.push(
      role === "product"
        ? "No delivered orders for this product yet"
        : "Limited seller delivery history on Plazore"
    );
    return { points: 0, factors };
  }

  let points = 0;

  // Volume ladder
  if (delivered >= 50) points += role === "seller" ? 22 : 18;
  else if (delivered >= 20) points += role === "seller" ? 16 : 14;
  else if (delivered >= 8) points += role === "seller" ? 11 : 10;
  else if (delivered >= 3) points += role === "seller" ? 6 : 6;
  else points += 2;

  factors.push(
    role === "product"
      ? `${delivered} delivered order${delivered === 1 ? "" : "s"} for this product`
      : `${delivered} delivered order${delivered === 1 ? "" : "s"} across this seller`
  );

  // Confirm vs issues (only when buyers have responded)
  if (decided >= 3) {
    const confirmRate = confirmed / decided;
    if (confirmRate >= 0.92 && issues <= Math.max(1, Math.floor(decided * 0.08))) {
      points += role === "seller" ? 18 : 16;
      factors.push("Buyers consistently confirm delivery");
    } else if (confirmRate >= 0.8) {
      points += role === "seller" ? 12 : 11;
      factors.push("Most buyers confirm delivery");
    } else if (confirmRate >= 0.6) {
      points += 5;
      factors.push("Mixed delivery confirmation outcomes");
    } else {
      points -= role === "seller" ? 12 : 10;
      factors.push("Meaningful pattern of delivery issues");
    }
  } else if (confirmed >= 1 && issues === 0) {
    points += 3;
    factors.push("Early positive delivery confirmations");
  } else if (issues >= 2 && issues > confirmed) {
    points -= 8;
    factors.push("Several delivery issues reported");
  }

  // Seller-cancelled fulfilments (light signal)
  if (slice.sellerCancelled >= 5 && slice.sellerCancelled > delivered * 0.15) {
    points -= 6;
    factors.push("Elevated seller cancellations");
  }

  return { points: Math.max(-20, points), factors };
}

/**
 * Pure calculation from listing + commerce evidence.
 * Reversible: level can rise or fall with new evidence.
 */
export function calculateBuyerConfidence(
  listing: ListingInput,
  commerce: CommerceEvidence = emptyEvidence()
): ConfidenceResult {
  const listingPart = listingQualityPoints(listing);
  const sellerPart = sliceScore(commerce.seller, "seller");
  const productPart = sliceScore(commerce.product, "product");

  // Weights: product history + seller history dominate; listing is secondary
  let score =
    listingPart.points +
    Math.round(sellerPart.points * 0.55) +
    Math.round(productPart.points * 0.7);

  // Tiny samples cannot reach High
  const totalDelivered = commerce.seller.delivered + commerce.product.delivered;
  const totalConfirmed = commerce.seller.confirmed + commerce.product.confirmed;
  if (totalDelivered < 8 || totalConfirmed < 5) {
    score = Math.min(score, 68); // below High threshold
  }
  if (totalDelivered === 0 && totalConfirmed === 0) {
    // New seller / new product: stay in Limited band unless listing is rich
    score = Math.min(score, 38);
  }

  score = Math.min(100, Math.max(0, Math.round(score)));
  const level = levelFromScore(score);

  const factors = [
    ...productPart.factors.slice(0, 2),
    ...sellerPart.factors.slice(0, 2),
    ...listingPart.factors.slice(0, 3),
  ].slice(0, 8);

  return {
    level,
    score,
    factors,
    evidence: commerce,
    defaultExplanation: defaultExplanationFor(level),
  };
}

/** Aggregate order rows into a commerce slice. */
function aggregateOrders(orders: any[]): CommerceSlice {
  const slice: CommerceSlice = { ...EMPTY_SLICE };
  for (const o of orders) {
    slice.orders += 1;
    if (o.orderStatus === "Delivered") {
      slice.delivered += 1;
      const st = o.buyerConfirmation?.status;
      if (st === "confirmed") slice.confirmed += 1;
      if (st === "issue_reported") slice.issues += 1;
    }
    if (
      o.orderStatus === "Cancelled" &&
      o.cancellation?.cancelledBy === "seller"
    ) {
      slice.sellerCancelled += 1;
    }
  }
  return slice;
}

/**
 * Load real commerce evidence from Order (Confirm Delivery / Issues).
 * Does not invent signals that are not in the schema.
 */
export async function gatherCommerceEvidence(
  productId: string | mongoose.Types.ObjectId,
  sellerId: string | mongoose.Types.ObjectId
): Promise<CommerceEvidence> {
  const pid = new mongoose.Types.ObjectId(String(productId));
  const sid = new mongoose.Types.ObjectId(String(sellerId));

  const [sellerOrders, productOrders] = await Promise.all([
    Order.find({ seller: sid })
      .select("orderStatus buyerConfirmation cancellation")
      .lean(),
    Order.find({ seller: sid, "items.product": pid })
      .select("orderStatus buyerConfirmation cancellation")
      .lean(),
  ]);

  return {
    seller: aggregateOrders(sellerOrders),
    product: aggregateOrders(productOrders),
    gatheredAt: new Date(),
  };
}

/**
 * Algorithm-only refresh for one product (no AI call).
 * Updates buyerConfidence when the level/score meaningfully changes.
 */
export async function refreshBuyerConfidenceForProduct(
  productId: string
): Promise<{ updated: boolean; level: ConfidenceLevel }> {
  const Product = (await import("../../models/Products.js")).default;
  const product = await Product.findById(productId).lean();
  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  const User = (await import("../../models/User.js")).default;
  const seller = await User.findById(product.seller)
    .select("storeName storeLogo storeDescription isSellerVerified")
    .lean();

  const commerce = await gatherCommerceEvidence(
    product._id,
    product.seller as any
  );

  const specifications =
    product.specifications instanceof Map
      ? Object.fromEntries(product.specifications)
      : (product as any).specifications || {};

  const result = calculateBuyerConfidence(
    {
      description: product.description,
      images: product.images,
      shipping: product.shipping,
      fulfillmentLocation: product.fulfillmentLocation,
      seller: seller || undefined,
      specifications,
      verificationDocuments: (product as any).verificationDocuments,
    },
    commerce
  );

  const aiDoc = await ProductAI.findOne({ productId: product._id });
  if (!aiDoc) {
    return { updated: false, level: result.level };
  }

  const prev = aiDoc.buyerConfidence;
  const changed =
    !prev ||
    prev.level !== result.level ||
    Math.abs((prev.score || 0) - result.score) >= 4;

  if (changed) {
    aiDoc.buyerConfidence = {
      level: result.level,
      score: result.score,
      factors: result.factors,
    };
    // Keep AI prose unless empty; fill calm default if needed
    if (!aiDoc.confidenceExplanation?.trim()) {
      aiDoc.confidenceExplanation = result.defaultExplanation;
    } else if (prev?.level !== result.level) {
      // Level moved — prefer accurate default until next AI edit pass
      aiDoc.confidenceExplanation = result.defaultExplanation;
    }
    (aiDoc as any).commerceEvidence = {
      seller: commerce.seller,
      product: commerce.product,
      gatheredAt: commerce.gatheredAt,
    };
    (aiDoc as any).lastAlgorithmAt = new Date();
    await aiDoc.save();
  } else {
    (aiDoc as any).lastAlgorithmAt = new Date();
    (aiDoc as any).commerceEvidence = {
      seller: commerce.seller,
      product: commerce.product,
      gatheredAt: commerce.gatheredAt,
    };
    await aiDoc.save();
  }

  return { updated: changed, level: result.level };
}