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

    // Store appearance
    storeName: { type: String, trim: true },
    storeDescription: { type: String, default: "" },
    businessGoal: { type: String, default: "" },
    storeLogo: { type: String, default: "" },
    storeBanner: { type: String, default: "" },

    isSellerVerified: { type: Boolean, default: false },
    isSellerSuspended: { type: Boolean, default: false },
    sellerAppliedAt: { type: Date },

    payout: {
      bankName: { type: String, default: "" },
      accountName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
    },

    // Defaults used when creating products (product can override)
    shippingDefaults: {
      address: {
        street: { type: String, default: "" },
        city: { type: String, default: "" },
        state: { type: String, default: "" },
        zipCode: { type: String, default: "" },
        country: { type: String, default: "" },
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