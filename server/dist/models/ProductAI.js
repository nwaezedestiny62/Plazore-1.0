import mongoose, { Schema } from "mongoose";
const buyerConfidenceSchema = new Schema({
    level: {
        type: String,
        enum: ["High Confidence", "Growing Confidence", "Limited Confidence"],
        required: true,
    },
    score: { type: Number, required: true, min: 0, max: 100 },
    factors: [{ type: String }],
}, { _id: false });
const productAISchema = new Schema({
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
}, { timestamps: true });
// Helpful compound index for monitoring
productAISchema.index({ status: 1, generatedAt: -1 });
const ProductAI = mongoose.model("ProductAI", productAISchema);
export default ProductAI;
