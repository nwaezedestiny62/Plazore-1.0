import { ConfidenceLevel, IBuyerConfidence } from "../../models/ProductAI.js";

interface ConfidenceInput {
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
}

/**
 * Pure backend calculation.
 * GPT never decides the confidence level.
 */
export function calculateBuyerConfidence(
  input: ConfidenceInput
): IBuyerConfidence {
  let score = 0;
  const factors: string[] = [];

  // 1. Description quality (max 25)
  const desc = (input.description || "").trim();
  if (desc.length >= 300) {
    score += 25;
    factors.push("Detailed product description provided");
  } else if (desc.length >= 120) {
    score += 18;
    factors.push("Good product description provided");
  } else if (desc.length >= 40) {
    score += 10;
    factors.push("Basic product description provided");
  } else {
    factors.push("Limited product description");
  }

  // 2. Images (max 25)
  const imageCount = Array.isArray(input.images) ? input.images.length : 0;
  if (imageCount >= 5) {
    score += 25;
    factors.push("Multiple high-quality product images");
  } else if (imageCount >= 3) {
    score += 18;
    factors.push("Several product images available");
  } else if (imageCount >= 1) {
    score += 10;
    factors.push("Product image available");
  } else {
    factors.push("No product images uploaded");
  }

  // 3. Shipping information (max 20)
  const hasShippingMethod = !!input.shipping?.method;
  const hasCourier =
    input.shipping?.method === "courier"
      ? !!input.shipping?.courierCompany
      : true;

  if (hasShippingMethod && hasCourier) {
    score += 20;
    factors.push("Clear shipping information provided");
  } else if (hasShippingMethod) {
    score += 12;
    factors.push("Shipping method indicated");
  } else {
    factors.push("Shipping details incomplete");
  }

  // 4. Fulfillment location (max 10)
  if (
    input.fulfillmentLocation?.countryCode &&
    input.fulfillmentLocation?.city
  ) {
    score += 10;
    factors.push("Fulfillment location specified");
  } else {
    factors.push("Fulfillment location not fully specified");
  }

  // 5. Seller profile completeness (max 20)
  let sellerScore = 0;
  if (input.seller?.storeName) sellerScore += 6;
  if (input.seller?.storeLogo) sellerScore += 5;
  if (input.seller?.storeDescription) sellerScore += 5;
  if (input.seller?.isSellerVerified) sellerScore += 4;

  score += sellerScore;

  if (sellerScore >= 16) {
    factors.push("Complete and verified seller profile");
  } else if (sellerScore >= 10) {
    factors.push("Seller profile partially complete");
  } else {
    factors.push("Limited seller profile information");
  }

  // Clamp score
  score = Math.min(100, Math.max(0, score));

  // Map to level
  let level: ConfidenceLevel;
  if (score >= 75) {
    level = "High Confidence";
  } else if (score >= 45) {
    level = "Growing Confidence";
  } else {
    level = "Limited Confidence";
  }

  return {
    level,
    score,
    factors,
  };
}