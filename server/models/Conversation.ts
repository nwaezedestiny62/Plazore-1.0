import mongoose, { Schema } from "mongoose";

const conversationSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Last message preview (for inbox list)
    lastMessage: {
      text: { type: String, default: "" },
      sender: { type: Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date },
    },
    // Unread counts
    unreadByBuyer: { type: Number, default: 0 },
    unreadBySeller: { type: Number, default: 0 },
    // Status
    status: {
      type: String,
      enum: ["active", "archived", "blocked"],
      default: "active",
    },
  },
  { timestamps: true }
);

// One conversation per buyer + product
conversationSchema.index({ buyer: 1, product: 1 }, { unique: true });
conversationSchema.index({ seller: 1, updatedAt: -1 });
conversationSchema.index({ buyer: 1, updatedAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;