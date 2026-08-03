import Product from "../../models/Products.js";
import ProductAI from "../../models/ProductAI.js";
import User from "../../models/User.js";
import { generateProductFingerprint } from "./fingerprint.js";
import { calculateBuyerConfidence } from "./confidence.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
  PROMPT_VERSION,
} from "./prompts.js";
import { validateAIResponse } from "./validators.js";
import { GeminiFlashProvider } from "./providers/gemini.js";
import { AIGenerationInput } from "./types.js";

const provider = new GeminiFlashProvider();

/**
 * Main entry point used by the background job.
 * Quietly generates (or regenerates) Plazore AI for a product listing.
 * The goal is simple: help buyers understand — never decide for them.
 */
export async function generateProductAI(productId: string): Promise<void> {
  // 1. Load the product and the seller who listed it
  const product = await Product.findById(productId).lean();
  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  const seller = await User.findById(product.seller)
    .select("storeName storeLogo storeDescription isSellerVerified")
    .lean();

  // 2. Create a fingerprint of the current listing
  //    so we only regenerate when something meaningful has changed
  const fingerprint = generateProductFingerprint(product);

  // 3. Look for any existing AI document
  let aiDoc = await ProductAI.findOne({ productId });

  // If the fingerprint matches and the content is already ready,
  // there is nothing more to do
  if (
    aiDoc &&
    aiDoc.fingerprint === fingerprint &&
    aiDoc.status === "ready"
  ) {
    return;
  }

  // 4. Calculate Buyer Confidence on the backend
  //    The AI will never calculate, modify, or question this value —
  //    it only explains what the provided level represents
  const buyerConfidence = calculateBuyerConfidence({
    description: product.description,
    images: product.images,
    shipping: product.shipping,
    fulfillmentLocation: product.fulfillmentLocation,
    seller: seller || undefined,
  });

  // 5. Prepare the exact input the AI is allowed to see
  //    Only information provided by the seller (or calculated by the backend)
  const input: AIGenerationInput = {
    productId: String(product._id),
    name: product.name,
    description: product.description,
    price: product.price,
    images: product.images || [],
    category: product.category,
    subCategory: product.subCategory,
    brand: product.brand,
    shipping: product.shipping,
    fulfillmentLocation: product.fulfillmentLocation,
    seller: seller || undefined,
    buyerConfidence,
  };

  // 6. Mark the document as pending
  //    Previous good content is preserved until a successful generation replaces it
  if (aiDoc) {
    aiDoc.status = "pending";
    aiDoc.fingerprint = fingerprint;
    aiDoc.error = undefined;
    await aiDoc.save();
  } else {
    aiDoc = await ProductAI.create({
      productId: product._id,
      fingerprint,
      status: "pending",
      modelVersion: process.env.PLAZORE_AI_MODEL || "gemini-3.5-flash-lite",
      promptVersion: PROMPT_VERSION,
      buyerConfidence,
      summary: "",
      overview: "",
      highlights: [],
      bestFor: [],
      shippingSummary: "",
      thingsToConsider: [],
      confidenceExplanation: "",
    });
  }

  try {
    // 7. Ask the model to interpret the listing
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(input);

    const raw = await provider.generate(systemPrompt, userPrompt, {
      temperature: 0.3,
      maxTokens: 1200,
    });

    // 8. Validate that the response is exactly the shape we expect
    const result = validateAIResponse(raw);

    // 9. Save the successful result
    aiDoc.status = "ready";
    aiDoc.summary = result.summary;
    aiDoc.overview = result.overview;
    aiDoc.highlights = result.highlights;
    aiDoc.bestFor = result.bestFor;
    aiDoc.shippingSummary = result.shippingSummary;
    aiDoc.thingsToConsider = result.thingsToConsider;
    aiDoc.confidenceExplanation = result.confidenceExplanation;
    aiDoc.buyerConfidence = buyerConfidence;
    aiDoc.modelVersion = process.env.PLAZORE_AI_MODEL || "gemini-2.5-flash";
    aiDoc.promptVersion = PROMPT_VERSION;
    aiDoc.generatedAt = new Date();
    aiDoc.error = undefined;

    await aiDoc.save();
  } catch (err: any) {
    // On failure we keep any previous good content and simply mark the attempt as failed
    console.error(
      `[Plazore AI] Generation failed for ${productId}:`,
      err.message
    );

    aiDoc.status = "failed";
    aiDoc.error = err.message || "Unknown generation error";
    await aiDoc.save();

    // Re-throw so the job system can decide on retries
    throw err;
  }
}