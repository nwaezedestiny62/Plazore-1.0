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

function normalizeSpecifications(raw: any): Record<string, string> {
  if (!raw) return {};
  if (raw instanceof Map) {
    return Object.fromEntries(
      [...raw.entries()].filter(
        ([, v]) => v != null && String(v).trim().length > 0
      )
    );
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v != null && String(v).trim()) out[String(k)] = String(v).trim();
    }
    return out;
  }
  return {};
}

/**
 * Main entry point used by the background job.
 * Quietly generates (or regenerates) Plazore AI for a product listing.
 * Goal: help buyers understand — never decide for them.
 */
export async function generateProductAI(productId: string): Promise<void> {
  const product = await Product.findById(productId).lean();
  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  const seller = await User.findById(product.seller)
    .select("storeName storeLogo storeDescription isSellerVerified")
    .lean();

  const fingerprint = generateProductFingerprint(product);

  let aiDoc = await ProductAI.findOne({ productId });

  if (
    aiDoc &&
    aiDoc.fingerprint === fingerprint &&
    aiDoc.status === "ready"
  ) {
    return;
  }

  const specifications = normalizeSpecifications(
    (product as any).specifications
  );

  const verificationDocuments = Array.isArray(
    (product as any).verificationDocuments
  )
    ? (product as any).verificationDocuments.map((d: any) => ({
        documentName: String(d.documentName || "").trim(),
        documentType: String(d.documentType || "").trim(),
      }))
    : [];

  const buyerConfidence = calculateBuyerConfidence({
    description: product.description,
    images: product.images,
    shipping: product.shipping,
    fulfillmentLocation: product.fulfillmentLocation,
    seller: seller || undefined,
    specifications,
    verificationDocuments,
  });

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
    specifications,
    verificationDocuments,
    seller: seller || undefined,
    buyerConfidence,
  };

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
      modelVersion: process.env.PLAZORE_AI_MODEL || "gemini-2.5-flash",
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
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(input);

    const raw = await provider.generate(systemPrompt, userPrompt, {
      temperature: 0.35,
      maxTokens: 900,
    });

    const result = validateAIResponse(raw);

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
    console.error(
      `[Plazore AI] Generation failed for ${productId}:`,
      err.message
    );

    aiDoc.status = "failed";
    aiDoc.error = err.message || "Unknown generation error";
    await aiDoc.save();

    throw err;
  }
}