import mongoose from "mongoose";
import { IUser } from "../types/index.js";

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, trim: true },
    email: { type: String, unique: true, trim: true },
    clerkId: { type: String, unique: true, sparse: true },
    image: { type: String },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      default: "buyer",
    },
    // Seller-specific
    storeName: { type: String, trim: true },
    storeDescription: { type: String },
    storeLogo: { type: String },
    isSellerVerified: { type: Boolean, default: false },
    isSellerSuspended: { type: Boolean, default: false },
    sellerAppliedAt: { type: Date },
  },
  { timestamps: true }
);

const User = mongoose.model<IUser>("User", userSchema);
export default User;