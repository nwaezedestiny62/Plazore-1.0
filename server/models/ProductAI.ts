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

export interface ICommerceSlice {
  orders: number;
  delivered: number;
  confirmed: number;
  issues: number;
  sellerCancelled: number;
}

export interface ICommerceEvidence {
  seller: ICommerceSlice;
  product: ICommerceSlice;
  gatheredAt?: Date;
}

export interface IProductAI extends Document {
  productId: mongoose.Types.ObjectId;
  fingerprint: string;
  status: AIStatus;
  modelVersion: string;
  promptVersion: number;
  generatedAt?: Date;

  summary: string;
  overview: string;
  highlights: string[];
  bestFor: string[];
  shippingSummary: string;
  thingsToConsider: string[];

  buyerConfidence: IBuyerConfidence;
  confidenceExplanation: string;

  /** Snapshot of order-derived evidence used for confidence (not shown raw to buyers). */
  commerceEvidence?: ICommerceEvidence;
  /** Last algorithm-only refresh (daily maintenance, no AI). */
  lastAlgorithmAt?: Date;

  error?: string;
  createdAt?: Date;
  updatedAt?: Date;
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

const commerceSliceSchema = new Schema(
  {
    orders: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    confirmed: { type: Number, default: 0 },
    issues: { type: Number, default: 0 },
    sellerCancelled: { type: Number, default: 0 },
  },
  { _id: false }
);

const commerceEvidenceSchema = new Schema(
  {
    seller: { type: commerceSliceSchema, default: () => ({}) },
    product: { type: commerceSliceSchema, default: () => ({}) },
    gatheredAt: { type: Date },
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

    commerceEvidence: {
      type: commerceEvidenceSchema,
      required: false,
    },
    lastAlgorithmAt: { type: Date },

    error: { type: String },
  },
  { timestamps: true }
);

productAISchema.index({ status: 1, generatedAt: -1 });

const ProductAI = mongoose.model<IProductAI>("ProductAI", productAISchema);

export default ProductAI;