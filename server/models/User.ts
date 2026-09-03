import mongoose from "mongoose";
import { IUser } from "../types/index.js";

const moderationSideSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        "NORMAL",
        "ACTIVITY_CHECK",
        "UNDER_REVIEW",
        "SUSPENDED",
        "BLOCKED",
        "PARDONED",
        "RESTORED",
      ],
      default: "NORMAL",
    },
    reason: { type: String, default: "" },
    publicReason: { type: String, default: "" },
    startedAt: { type: Date },
    endsAt: { type: Date },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: "ModerationCase" },
    updatedAt: { type: Date },
    // do NOT put null in enum — use String + default undefined
    lastOutcome: {
      type: String,
      enum: ["PARDONED", "RESTORED"],
      default: undefined,
    },
    restrictions: {
      preventNewListings: { type: Boolean, default: false },
      preventPublishing: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
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

    marketplaceRegion: {
      type: String,
      default: "NG",
      index: true,
    },

    storeName: { type: String, trim: true },
    storeDescription: { type: String, default: "" },
    businessGoal: { type: String, default: "" },
    storeLogo: { type: String },
    storeBanner: { type: String },
    isSellerVerified: { type: Boolean, default: false },
    isSellerSuspended: { type: Boolean, default: false },
    sellerAppliedAt: { type: Date },

    payout: {
      bankName: { type: String, default: "" },
      accountName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
    },

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

    moderation: {
      buyer: { type: moderationSideSchema, default: () => ({}) },
      seller: { type: moderationSideSchema, default: () => ({}) },
    },
  },
  { timestamps: true }
);

const User = mongoose.model<IUser>("User", userSchema);
export default User;