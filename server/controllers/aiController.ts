import { Request, Response } from "express";
import ProductAI from "../models/ProductAI.js";

export const getProductAI = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ai = await ProductAI.findOne({ productId: id }).lean();

    if (!ai) {
      return res.status(404).json({
        success: false,
        message: "Plazore AI not available for this product yet",
      });
    }

    // Never expose internal error details to buyers unless useful
    const response = {
      status: ai.status,
      summary: ai.summary,
      overview: ai.overview,
      highlights: ai.highlights,
      bestFor: ai.bestFor,
      shippingSummary: ai.shippingSummary,
      thingsToConsider: ai.thingsToConsider,
      buyerConfidence: ai.buyerConfidence,
      confidenceExplanation: ai.confidenceExplanation,
      generatedAt: ai.generatedAt,
    };

    return res.json({
      success: true,
      data: response,
    });
  } catch (err: any) {
    console.error("[Plazore AI] getProductAI error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load Plazore AI",
    });
  }
};