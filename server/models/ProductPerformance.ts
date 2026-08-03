import mongoose from "mongoose";

const daySchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    views: { type: Number, default: 0 },
    cartAdds: { type: Number, default: 0 },
    purchases: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
  },
  { _id: false }
);

const productPerformanceSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
      index: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    views: { type: Number, default: 0 },
    cartAdds: { type: Number, default: 0 },
    purchases: { type: Number, default: 0 },
    score: { type: Number, default: 0, index: true },
    daily: { type: [daySchema], default: [] },
    milestones: {
      p200: { type: Boolean, default: false },
      p500: { type: Boolean, default: false },
      p1000: { type: Boolean, default: false },
      p2500: { type: Boolean, default: false },
      p5000: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

productPerformanceSchema.index({ seller: 1, score: -1 });

const ProductPerformance = mongoose.model(
  "ProductPerformance",
  productPerformanceSchema
);

export default ProductPerformance;