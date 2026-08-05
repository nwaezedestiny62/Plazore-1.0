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
  specifications?: Record<string, string>;
  verificationDocuments?: { documentName?: string; documentType?: string }[];
}

/**
 * Pure backend calculation.
 * The model never decides the confidence level.
 */
export function calculateBuyerConfidence(
  input: ConfidenceInput
): IBuyerConfidence {
  let score = 0;
  const factors: string[] = [];

  // 1. Description (max 22)
  const desc = (input.description || "").trim();
  if (desc.length >= 300) {
    score += 22;
    factors.push("Detailed product description provided");
  } else if (desc.length >= 120) {
    score += 16;
    factors.push("Good product description provided");
  } else if (desc.length >= 40) {
    score += 9;
    factors.push("Basic product description provided");
  } else {
    factors.push("Limited product description");
  }

  // 2. Images (max 22)
  const imageCount = Array.isArray(input.images) ? input.images.length : 0;
  if (imageCount >= 5) {
    score += 22;
    factors.push("Multiple product images available");
  } else if (imageCount >= 3) {
    score += 16;
    factors.push("Several product images available");
  } else if (imageCount >= 1) {
    score += 9;
    factors.push("Product image available");
  } else {
    factors.push("No product images uploaded");
  }

  // 3. Shipping (max 16)
  const hasShippingMethod = !!input.shipping?.method;
  const hasCourier =
    input.shipping?.method === "courier"
      ? !!input.shipping?.courierCompany
      : true;

  if (hasShippingMethod && hasCourier) {
    score += 16;
    factors.push("Clear shipping information provided");
  } else if (hasShippingMethod) {
    score += 10;
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

  // 5. Specifications (max 8)
  const specCount = input.specifications
    ? Object.keys(input.specifications).filter(
        (k) => String(input.specifications![k] || "").trim().length > 0
      ).length
    : 0;
  if (specCount >= 3) {
    score += 8;
    factors.push("Detailed product specifications provided");
  } else if (specCount >= 1) {
    score += 4;
    factors.push("Some product specifications provided");
  }

  // 6. Verification documents — presence only (max 7)
  const docCount = Array.isArray(input.verificationDocuments)
    ? input.verificationDocuments.length
    : 0;
  if (docCount >= 1) {
    score += 7;
    factors.push("Supporting verification documents uploaded");
  }

  // 7. Seller profile (max 15)
  let sellerScore = 0;
  if (input.seller?.storeName) sellerScore += 5;
  if (input.seller?.storeLogo) sellerScore += 3;
  if (input.seller?.storeDescription) sellerScore += 3;
  if (input.seller?.isSellerVerified) sellerScore += 4;

  score += sellerScore;

  if (sellerScore >= 12) {
    factors.push("Complete and verified seller profile");
  } else if (sellerScore >= 7) {
    factors.push("Seller profile partially complete");
  } else {
    factors.push("Limited seller profile information");
  }

  score = Math.min(100, Math.max(0, score));

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