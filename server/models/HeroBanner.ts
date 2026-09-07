import mongoose from "mongoose";

/**
 * One document per hero position (1–5).
 * Positions 1 & 4 → controlType "system" (personalized; admin cannot edit creative)
 * Positions 2, 3, 5 → controlType "admin" (full CMS)
 */

const creativeSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, default: "" },
    headline: { type: String, default: "", maxlength: 80 },
    subheadline: { type: String, default: "", maxlength: 160 },
    ctaLabel: { type: String, default: "Explore", maxlength: 40 },
    ctaAction: {
      type: String,
      default: "scroll_showroom",
      // scroll_showroom | category | product | store | url | campaign
    },
    ctaTarget: { type: String, default: "" }, // category key, product id, store id, or url
    kicker: { type: String, default: "", maxlength: 40 },
  },
  { _id: false }
);

const versionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    creative: { type: creativeSchema, required: true },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    publishedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

const heroBannerSchema = new mongoose.Schema(
  {
    position: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
      max: 5,
      index: true,
    },
    controlType: {
      type: String,
      enum: ["system", "admin"],
      required: true,
    },
    label: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    /** Current live creative (admin slots only). System slots leave this empty. */
    published: { type: creativeSchema, default: () => ({}) },
    publishedVersion: { type: Number, default: 0 },
    draft: { type: creativeSchema, default: () => ({}) },
    history: { type: [versionSchema], default: [] },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

heroBannerSchema.index({ controlType: 1, position: 1 });

const HeroBanner = mongoose.model("HeroBanner", heroBannerSchema);
export default HeroBanner;