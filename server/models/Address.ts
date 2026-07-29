import mongoose from "mongoose";
import { IAddress } from "../types/index.js";

const AddressSchema = new mongoose.Schema<IAddress>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // fast lookup, but NOT unique
    },
    type: {
      type: String,
      enum: ["Home", "Office", "Work", "Other"],
      default: "Home",
    },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Optional: help queries
AddressSchema.index({ user: 1, isDefault: 1 });

export default mongoose.model<IAddress>("Address", AddressSchema);