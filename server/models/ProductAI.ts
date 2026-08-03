import mongoose, { Schema, Document } from "mongoose";

export type ConfidenceLevel =
  | "High Confidence"
  | "Growing Confidence"
  | "Limited Confidence";

export type AIStatus = "pending" | "ready" | "failed";

export interface IBuyerConfidence {
  level: ConfidenceLevel;
  score: number; // 0–100
  factors: string[];
}

export interface IProductAI extends Document {
  productId: mongoose.Types.ObjectId;
  fingerprint: string;
  status: AIStatus;
  modelVersion: string;
  promptVersion: number;
  generatedAt?: Date;

  // AI content
  summary: string; // Quick Insights (60–100 words)
  overview: string;
  highlights: string[];
  bestFor: string[];
  shippingSummary: string;
  thingsToConsider: string[];

  // Buyer Confidence (backend only)
  buyerConfidence: IBuyerConfidence;
  confidenceExplanation: string;

  error?: string;
}

const buyerConfidenceSchema = new Schema<IBuyerConfidence>(
  {
    level: {
      type: String,
      enum: ["High Confidence", "Growing Confidence", "Limited Confidence"],
      required: true,
    },
    score: { type: Number, required: true, min: 0, max: 100 },
    factors: [{ type: String }],
  },
  { _id: false }
);

const productAISchema = new Schema<IProductAI>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
      index: true,
    },
    fingerprint: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "ready", "failed"],
      default: "pending",
      index: true,
    },
    modelVersion: { type: String, required: true },
    promptVersion: { type: Number, required: true, default: 1 },
    generatedAt: { type: Date },

    summary: { type: String, default: "" },
    overview: { type: String, default: "" },
    highlights: [{ type: String }],
    bestFor: [{ type: String }],
    shippingSummary: { type: String, default: "" },
    thingsToConsider: [{ type: String }],

    buyerConfidence: {
      type: buyerConfidenceSchema,
      required: true,
    },
    confidenceExplanation: { type: String, default: "" },

    error: { type: String },
  },
  { timestamps: true }
);

// Helpful compound index for monitoring
productAISchema.index({ status: 1, generatedAt: -1 });

const ProductAI = mongoose.model<IProductAI>("ProductAI", productAISchema);

export default ProductAI;