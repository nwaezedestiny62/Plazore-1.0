import mongoose, { Schema, Document } from "mongoose";

export const SUPPORTED_CURRENCIES = [
  "NGN", "GHS", "XOF", "XAF", "KES", "ZAR", "EGP",
  "USD", "CAD", "GBP", "EUR", "AUD",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const BASE_CURRENCY = "NGN";

/** 1 unit of currencyCode = rateToNgn units of NGN */
export interface IExchangeRate extends Document {
  currencyCode: SupportedCurrency;
  rateToNgn: string; // decimal string for precision
  isActive: boolean;
  version: number;
  previousRateToNgn?: string;
  changedBy?: mongoose.Types.ObjectId;
  changedByName?: string;
  reason?: string;
  sourceNote?: string;
  percentChange?: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const exchangeRateSchema = new Schema<IExchangeRate>(
  {
    currencyCode: {
      type: String,
      required: true,
      uppercase: true,
      enum: SUPPORTED_CURRENCIES,
      index: true,
    },
    rateToNgn: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
    version: { type: Number, required: true, default: 1 },
    previousRateToNgn: { type: String },
    changedBy: { type: Schema.Types.ObjectId, ref: "User" },
    changedByName: { type: String },
    reason: { type: String, maxlength: 500 },
    sourceNote: { type: String, maxlength: 300 },
    percentChange: { type: Number },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: { type: Date, default: null },
  },
  { timestamps: true }
);

exchangeRateSchema.index(
  { currencyCode: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);
exchangeRateSchema.index({ currencyCode: 1, version: -1 });

const ExchangeRate =
  mongoose.models.ExchangeRate ||
  mongoose.model<IExchangeRate>("ExchangeRate", exchangeRateSchema);

export default ExchangeRate;