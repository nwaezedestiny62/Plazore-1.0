import mongoose, { Schema } from "mongoose";
import { IProduct } from "../types/index.js";

const fulfillmentLocationSchema = new Schema(
  {
    countryCode: { type: String, required: true, trim: true, index: true },
    country: { type: String, required: true, trim: true },
    stateCode: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    city: { type: String, required: true, trim: true, index: true },
    displayLabel: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const verificationDocumentSchema = new Schema(
  {
    documentName: { type: String, required: true, trim: true },
    documentType: { type: String, required: true, trim: true },
    secureUrl: { type: String, required: true },
  },
  { _id: false }
);

/** Buyer-selectable option group (e.g. Size, Color). Not the same as specifications. */
const productOptionSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    values: {
      type: [String],
      default: [],
      validate: {
        validator: (arr: string[]) => Array.isArray(arr) && arr.length <= 30,
        message: "Each option may have at most 30 values",
      },
    },
  },
  { _id: false }
);

/**
 * Concrete combination of option values.
 * Inventory and optional price live here when hasVariants is true.
 */
const productVariantSchema = new Schema(
  {
    variantId: { type: String, required: true, trim: true },
    /** Deterministic key e.g. "color=navy|size=m" (sorted option names) */
    key: { type: String, required: true, trim: true, index: true },
    options: {
      type: Map,
      of: String,
      default: {},
    },
    stock: { type: Number, required: true, default: 0, min: 0 },
    /** null / undefined = use product.price */
    price: { type: Number, default: null, min: 0 },
    available: { type: Boolean, default: true },
  },
  { _id: false }
);

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    images: [{ type: String }],
    category: { type: String, required: true, trim: true },
    subCategory: { type: String, default: "", trim: true },
    brand: { type: String, default: "", trim: true },
    /** Simple-product inventory. When hasVariants is true, purchases use variants[].stock instead. */
    stock: { type: Number, required: true, default: 0, min: 0 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    region: {
      type: String,
      required: true,
      index: true,
      default: "NG",
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    shipping: {
      feeMode: {
        type: String,
        enum: ["free", "fixed", "on_delivery"],
        required: true,
        default: "fixed",
      },
      method: {
        type: String,
        enum: ["self", "courier"],
        required: false,
        default: "courier",
      },
      courierCompany: { type: String, default: "" },
      deliveryFee: { type: Number, default: 0, min: 0 },
      deliveryNote: { type: String, default: "", trim: true },
    },

    fulfillmentLocation: {
      type: fulfillmentLocationSchema,
      required: false,
    },

    // Category-specific structured specs (key → value) — factual product info
    specifications: {
      type: Map,
      of: String,
      default: {},
    },

    // Cloudinary metadata only — never file buffers
    verificationDocuments: {
      type: [verificationDocumentSchema],
      default: [],
    },

    wishlistCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ——— Product options & variants (optional; existing products stay simple) ———
    hasVariants: {
      type: Boolean,
      default: false,
      index: true,
    },
    options: {
      type: [productOptionSchema],
      default: [],
      validate: {
        validator: (arr: unknown[]) => Array.isArray(arr) && arr.length <= 5,
        message: "A product may have at most 5 option groups",
      },
    },
    variants: {
      type: [productVariantSchema],
      default: [],
      validate: {
        validator: (arr: unknown[]) => Array.isArray(arr) && arr.length <= 200,
        message: "A product may have at most 200 variants",
      },
    },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text" });
productSchema.index({ category: 1, subCategory: 1 });
productSchema.index({ region: 1, isActive: 1, createdAt: -1 });
productSchema.index({ seller: 1, region: 1 });
productSchema.index({ "fulfillmentLocation.countryCode": 1, isActive: 1 });
productSchema.index({
  "fulfillmentLocation.city": 1,
  "fulfillmentLocation.countryCode": 1,
});
productSchema.index({ "variants.variantId": 1 });

const Product = mongoose.model<IProduct>("Product", productSchema);
export default Product;