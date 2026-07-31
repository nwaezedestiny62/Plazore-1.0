import mongoose, { Schema } from "mongoose";

const productSchema = new Schema(
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
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text" });
productSchema.index({ category: 1, subCategory: 1 });

const Product = mongoose.model("Product", productSchema);
export default Product;