import mongoose from "mongoose";

/**
 * Persisted personalized creative for Banner 1 and Banner 4.
 * Keyed by user (preferred) or anonymous sessionId.
 * Refresh only when expiresAt has passed (6h cycle) or force on app-return signal.
 */

const personalizedBannerStateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    sessionId: { type: String, default: "", index: true },
    position: { type: Number, required: true, enum: [1, 4], index: true },
    region: { type: String, default: "NG" },

    // Generated creative
    imageUrl: { type: String, default: "" },
    headline: { type: String, default: "" },
    subheadline: { type: String, default: "" },
    ctaLabel: { type: String, default: "Explore" },
    ctaAction: { type: String, default: "scroll_showroom" },
    ctaTarget: { type: String, default: "" },
    kicker: { type: String, default: "" },
    usedName: { type: Boolean, default: false },

    // Diagnostics (safe, operational — no private reasoning)
    mode: {
      type: String,
      enum: ["behavioral", "cold_start"],
      default: "cold_start",
    },
    primarySignal: { type: String, default: "" },
    supportingSignals: { type: [String], default: [] },
    categoryContext: { type: String, default: "" },
    subCategoryContext: { type: String, default: "" },
    visualSource: {
      type: String,
      default: "fallback",
      // product_image | category_fallback | static_hero
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    signalScore: { type: Number, default: 0 },

    cycleId: { type: String, required: true },
    generatedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

personalizedBannerStateSchema.index(
  { user: 1, position: 1 },
  { unique: true, partialFilterExpression: { user: { $type: "objectId" } } }
);
personalizedBannerStateSchema.index(
  { sessionId: 1, position: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sessionId: { $type: "string", $gt: "" },
      user: null,
    },
  }
);

const PersonalizedBannerState = mongoose.model(
  "PersonalizedBannerState",
  personalizedBannerStateSchema
);
export default PersonalizedBannerState;