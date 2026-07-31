import mongoose from "mongoose";
import { IUser } from "../types/index.js";

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, trim: true },
    email: { type: String, unique: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    clerkId: { type: String, unique: true, sparse: true },
    image: { type: String },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      default: "buyer",
    },

    // Marketplace Region
    marketplaceRegion: {
      type: String,
      default: "NG",
      index: true,
    },

    // Seller profile
    storeName: { type: String, trim: true },
    storeDescription: { type: String, default: "" },
    businessGoal: { type: String, default: "" },
    storeLogo: { type: String },
    storeBanner: { type: String },
    isSellerVerified: { type: Boolean, default: false },
    isSellerSuspended: { type: Boolean, default: false },
    sellerAppliedAt: { type: Date },

    // Payout
    payout: {
      bankName: { type: String, default: "" },
      accountName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
    },

    // Shipping defaults
    shippingDefaults: {
      address: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        zipCode: { type: String },
        country: { type: String },
      },
      deliveryMethod: {
        type: String,
        enum: ["courier", "self", ""],
        default: "",
      },
      courierCompany: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

const User = mongoose.model<IUser>("User", userSchema);
export default User;