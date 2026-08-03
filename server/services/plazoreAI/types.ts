import { IBuyerConfidence } from "../../models/ProductAI.js";

/**
 * Everything the AI is allowed to see about a product listing.
 * Only information provided by the seller (or calculated by the backend) belongs here.
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
  seller?: {
    storeName?: string;
    storeLogo?: string;
    storeDescription?: string;
    isSellerVerified?: boolean;
  };
  /**
   * Buyer Confidence is already calculated by the Plazore backend.
   * The AI must never calculate, modify, or question this value —
   * it only explains what the provided level represents.
   */
  buyerConfidence: IBuyerConfidence;
}

/**
 * The exact shape the AI must return.
 * No extra keys. No missing keys. No renamed keys.
 * Every field should feel calm, clear, and genuinely helpful.
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
 * using a system prompt and a user prompt.
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