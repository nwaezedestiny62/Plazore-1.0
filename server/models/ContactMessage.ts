import mongoose, { Schema } from "mongoose";

const contactMessageSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    contactAs: {
      type: String,
      enum: ["buyer", "seller"],
      required: true,
      index: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    category: {
      type: String,
      enum: ["account", "order", "seller", "payment", "technical", "other"],
      default: "other",
      index: true,
    },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    status: {
      type: String,
      enum: ["new", "open", "in_progress", "resolved", "closed"],
      default: "new",
      index: true,
    },
    relatedOrder: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    relatedProduct: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    relatedSeller: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assignedAdmin: { type: Schema.Types.ObjectId, ref: "User", default: null },
    responses: [
      {
        admin: { type: Schema.Types.ObjectId, ref: "User" },
        body: { type: String, required: true, maxlength: 4000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    resolvedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("ContactMessage", contactMessageSchema);