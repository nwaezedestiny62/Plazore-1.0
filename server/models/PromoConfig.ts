import mongoose, { Schema, Types, Document } from "mongoose";
import { DOMINANT_PROMO } from "../config/plans.js";

/**
 * Singleton config for the 200 Dominant Niche free slots.
 * Atomic claim: findOneAndUpdate only when enabled AND claimedSlots < totalSlots.
 * Race-safe: two concurrent sellers cannot both get the 200th slot.
 */

export interface IPromoClaim {
  seller: Types.ObjectId;
  slotNumber: number;
  claimedAt: Date;
}

export interface IPromoConfig extends Document {
  key: string;
  enabled: boolean;
  totalSlots: number;
  claimedSlots: number;
  durationMonths: number;
  claims: IPromoClaim[];
  createdAt?: Date;
  updatedAt?: Date;
}

const promoClaimSchema = new Schema(
  {
    seller: { type: Schema.Types.ObjectId, ref: "User", required: true },
    slotNumber: { type: Number, required: true },
    claimedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const promoConfigSchema = new Schema(
  {
    key: { type: String, unique: true, default: "dominant_niche_200" },
    enabled: { type: Boolean, default: false },
    totalSlots: { type: Number, default: DOMINANT_PROMO?.totalSlots ?? 200 },
    claimedSlots: { type: Number, default: 0 },
    durationMonths: {
      type: Number,
      default: DOMINANT_PROMO?.durationMonths ?? 7,
    },
    claims: { type: [promoClaimSchema], default: [] },
  },
  { timestamps: true }
);

const PromoConfig =
  (mongoose.models.PromoConfig as mongoose.Model<IPromoConfig>) ||
  mongoose.model<IPromoConfig>("PromoConfig", promoConfigSchema);

export default PromoConfig;

export type ClaimResult =
  | { claimed: true; already: true; slotNumber: number | null }
  | { claimed: true; already: false; slotNumber: number }
  | {
      claimed: false;
      reason: "promotion_off" | "slots_exhausted" | "unavailable";
    };

/**
 * Atomically claim one Dominant Niche promo slot.
 * Safe under concurrent claims (Mongo $expr + $inc).
 */
export async function claimDominantPromoSlot(
  sellerId: string
): Promise<ClaimResult> {
  const sellerOid = new Types.ObjectId(String(sellerId));

  await PromoConfig.findOneAndUpdate(
    { key: "dominant_niche_200" },
    {
      $setOnInsert: {
        key: "dominant_niche_200",
        enabled: false,
        totalSlots: DOMINANT_PROMO?.totalSlots ?? 200,
        claimedSlots: 0,
        durationMonths: DOMINANT_PROMO?.durationMonths ?? 7,
        claims: [],
      },
    },
    { upsert: true, new: true }
  );

  const existing = await PromoConfig.findOne({
    key: "dominant_niche_200",
    "claims.seller": sellerOid,
  })
    .select("claims")
    .lean<{ claims?: Array<{ seller?: unknown; slotNumber?: number }> }>()
    .exec();

  if (existing) {
    const claims = Array.isArray(existing.claims) ? existing.claims : [];
    const claim = claims.find(
      (c) => c && String(c.seller) === String(sellerOid)
    );
    return {
      claimed: true,
      already: true,
      slotNumber:
        claim && typeof claim.slotNumber === "number" ? claim.slotNumber : null,
    };
  }

  const updated = await PromoConfig.findOneAndUpdate(
    {
      key: "dominant_niche_200",
      enabled: true,
      $expr: { $lt: ["$claimedSlots", "$totalSlots"] },
    },
    { $inc: { claimedSlots: 1 } },
    { new: true }
  )
    .lean<{ claimedSlots?: number; enabled?: boolean; totalSlots?: number }>()
    .exec();

  if (!updated) {
    const cfg = await PromoConfig.findOne({ key: "dominant_niche_200" })
      .lean<{
        enabled?: boolean;
        claimedSlots?: number;
        totalSlots?: number;
      }>()
      .exec();

    if (!cfg?.enabled) {
      return { claimed: false, reason: "promotion_off" };
    }
    if ((cfg.claimedSlots || 0) >= (cfg.totalSlots || 200)) {
      return { claimed: false, reason: "slots_exhausted" };
    }
    return { claimed: false, reason: "unavailable" };
  }

  const slotNumber = Number(updated.claimedSlots) || 0;

  await PromoConfig.updateOne(
    { key: "dominant_niche_200" },
    {
      $push: {
        claims: {
          seller: sellerOid,
          slotNumber,
          claimedAt: new Date(),
        },
      },
    }
  ).exec();

  return { claimed: true, already: false, slotNumber };
}
