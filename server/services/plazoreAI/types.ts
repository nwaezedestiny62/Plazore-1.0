import { IBuyerConfidence } from "../../models/ProductAI.js";

/**
 * Everything the AI is allowed to see about a product listing.
 * Only seller-provided data + backend-calculated confidence belong here.
 * Nothing is invented. Nothing is assumed.
 */
export interface AIGenerationInput {
  productId: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category?: string;
  subCategory?: string;
  brand?: string;
  shipping?: {
    method?: string;
    courierCompany?: string;
    deliveryFee?: number;
  };
  fulfillmentLocation?: {
    countryCode?: string;
    country?: string;
    state?: string;
    city?: string;
    displayLabel?: string;
  };
  /** Category-specific fields from the seller (size, color, year, mileage, etc.). */
  specifications?: Record<string, string>;
  /**
   * Name/type only — never file contents.
   * On Plazore these mainly apply to cars and other high-value items.
   */
  verificationDocuments?: Array<{
    documentName?: string;
    documentType?: string;
  }>;
  seller?: {
    storeName?: string;
    storeLogo?: string;
    storeDescription?: string;
    isSellerVerified?: boolean;
  };
  /**
   * Calculated by the Plazore backend from listing + commerce evidence.
   * The AI must never calculate, modify, or override this —
   * it only explains what the given level means.
   */
  buyerConfidence: IBuyerConfidence;
}

/**
 * Exact shape the AI must return.
 * No extra keys. No missing keys. No renamed keys.
 */
export interface AIGenerationResult {
  summary: string;
  overview: string;
  highlights: string[];
  bestFor: string[];
  shippingSummary: string;
  thingsToConsider: string[];
  confidenceExplanation: string;
}

/**
 * Any model provider that can generate a response
 * from a system prompt and a user prompt.
 */
export interface AIModelProvider {
  generate(
    systemPrompt: string,
    userPrompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;
}