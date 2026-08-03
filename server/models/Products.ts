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

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    images: [{ type: String }],
    category: { type: String, required: true, trim: true },
    subCategory: { type: String, default: "", trim: true },
    brand: { type: String, default: "", trim: true },
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
      method: {
        type: String,
        enum: ["self", "courier"],
        required: true,
        default: "courier",
      },
      courierCompany: { type: String, default: "" },
      deliveryFee: { type: Number, default: 0, min: 0 },
    },

    // Independent of shipping method — where THIS product ships from
    fulfillmentLocation: {
      type: fulfillmentLocationSchema,
      required: false, // optional for older products; required on create in controller
    },

    wishlistCount: {
      type: Number,
      default: 0,
      min: 0,
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

const Product = mongoose.model<IProduct>("Product", productSchema);
export default Product;