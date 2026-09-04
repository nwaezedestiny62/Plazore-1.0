import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema(
  {
    senderType: {
      type: String,
      enum: ["user", "admin", "system"],
      required: true,
    },
    sender: { type: Schema.Types.ObjectId, ref: "User", default: null },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const internalNoteSchema = new Schema(
  {
    admin: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const contactMessageSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    contactAs: {
      type: String,
      enum: ["buyer", "seller"],
      required: true,
      index: true,
    },
    contextType: {
      type: String,
      enum: ["general", "store", "product", "order", "seller", "buyer"],
      default: "general",
      index: true,
    },
    category: {
      type: String,
      enum: [
        "buying",
        "selling",
        "order_payment",
        "delivery",
        "feedback",
        "technical",
        "account",
        "other",
      ],
      default: "other",
      index: true,
    },
    subject: { type: String, default: "", trim: true, maxlength: 200 },
    email: { type: String, required: true, trim: true, maxlength: 200 },
    location: {
      country: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      street: { type: String, default: "", trim: true },
    },
    relatedProduct: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    relatedSeller: { type: Schema.Types.ObjectId, ref: "User", default: null },
    relatedOrder: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    messages: { type: [messageSchema], default: [] },
    internalNotes: { type: [internalNoteSchema], default: [] },
    status: {
      type: String,
      enum: [
        "new",
        "open",
        "awaiting_user",
        "awaiting_plazore",
        "resolved",
        "closed",
      ],
      default: "new",
      index: true,
    },
    priority: {
      type: String,
      enum: ["normal", "high", "critical"],
      default: "normal",
      index: true,
    },
    assignedAdmin: { type: Schema.Types.ObjectId, ref: "User", default: null },
    unreadByAdmin: { type: Boolean, default: true, index: true },
    unreadByUser: { type: Boolean, default: false, index: true },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    // legacy field kept so old rows still load
    message: { type: String, default: "" },
    responses: { type: Array, default: [] },
  },
  { timestamps: true }
);

contactMessageSchema.index({ status: 1, lastMessageAt: -1 });
contactMessageSchema.index({ contactAs: 1, status: 1 });

export default mongoose.model("ContactMessage", contactMessageSchema);