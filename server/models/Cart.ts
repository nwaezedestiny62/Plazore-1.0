import mongoose, { Schema } from "mongoose";
import { ICart, ICartItem } from "../types/index.js";

const cartItemSchema = new Schema<ICartItem>({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  price: {
    type: Number,
    required: true,
  },
});

const cartSchema = new Schema<ICart>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
    totalAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Method to calculate total
cartSchema.methods.calculateTotal = function (this: ICart): number {
  this.totalAmount = this.items.reduce((total: number, item: ICartItem) => {
    return total + item.price * item.quantity;
  }, 0);

  return this.totalAmount;
};

const Cart = mongoose.model<ICart>("Cart", cartSchema);

export default Cart;