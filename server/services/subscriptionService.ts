/**
 * Seller subscription lifecycle.
 * Business location country → currency → plan. Never buyer marketplace region.
 *
 * Typed loosely on purpose so the rest of the codebase does not go red
 * when plans / PromoConfig / SellerSubscription are still being wired.
 */

import crypto from "crypto";
import User from "../models/User.js";
import SellerSubscription from "../models/SellerSubscription.js";
import PromoConfig from "../models/PromoConfig.js";
import { claimDominantPromoSlot } from "../models/PromoConfig.js";
import {
  PLANS,
  currencyForBusinessCountry,
  getPlanBenefits,
  getPlanPrice,
  listPlansForCurrency,
  transactionFeeRateForPlan,
  maxImagesForPlan,
  DOMINANT_PROMO,
} from "../config/plans.js";
import { isPaystackConfigured } from "./paystack/client.js";
import {
  initializeTransaction,
  verifyTransaction,
} from "./paystack/transactions.js";

// Plan ids used on the server (must match SellerSubscription enum + plans.ts)
type PlanId = "free" | "dominant" | "business_plus" | "global_reach";

function genRef(prefix = "PLZSUB") {
  return `${prefix}_${Date.now().toString(36).toUpperCase()}_${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function asPlanId(v: any): PlanId {
  const s = String(v || "free")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (s === "dominant" || s === "dominant_niche" || s === "pro") return "dominant";
  if (s === "business_plus" || s === "business" || s === "plus") return "business_plus";
  if (s === "global_reach" || s === "global") return "global_reach";
  return "free";
}

export function sellerBusinessCountry(seller: any): string {
  const raw = String(
    seller?.payout?.country ||
      seller?.businessLocation?.country ||
      seller?.businessCountry ||
      seller?.shippingDefaults?.address?.country ||
      "NG"
  )
    .trim()
    .toUpperCase();
  return raw || "NG";
}

export async function ensureSellerSubscription(sellerId: string) {
  let sub: any = await (SellerSubscription as any).findOne({ seller: sellerId });
  if (sub) return sub;

  const seller: any = await (User as any).findById(sellerId);
  if (!seller) {
    throw Object.assign(new Error("Seller not found"), { statusCode: 404 });
  }
  const country = sellerBusinessCountry(seller);
  const currency = currencyForBusinessCountry(country);
  const benefits = getPlanBenefits("free");

  sub = await (SellerSubscription as any).create({
    seller: sellerId,
    planId: "free",
    status: "active",
    country,
    currency,
    amountPaid: 0,
    provider: "system",
    startedAt: new Date(),
    expiresAt: null,
    isPromotional: false,
    transactionFeeRate: benefits.transactionFeeRate,
    maxImagesPerProduct: benefits.maxImagesPerProduct,
  });
  return sub;
}

export async function getActivePlanForSeller(sellerId: string) {
  const sub: any = await ensureSellerSubscription(sellerId);
  const now = new Date();

  let planId: PlanId = asPlanId(sub.planId);
  let status = String(sub.status || "active");

  if (sub.expiresAt && new Date(sub.expiresAt) < now && status === "active") {
    status = "expired";
    planId = "free";
    try {
      sub.status = "expired";
      sub.planId = "free";
      const freeBenefits = getPlanBenefits("free");
      sub.transactionFeeRate = freeBenefits.transactionFeeRate;
      sub.maxImagesPerProduct = freeBenefits.maxImagesPerProduct;
      sub.isPromotional = false;
      await sub.save();
    } catch {
      /* ignore */
    }
  }

  if (status !== "active") planId = "free";

  const benefits = getPlanBenefits(planId);
  return {
    planId,
    status: status === "active" ? "active" : "inactive",
    subscription: sub,
    transactionFeeRate: benefits.transactionFeeRate,
    maxImagesPerProduct: benefits.maxImagesPerProduct,
    benefits,
    isPromotional: !!sub.isPromotional,
    expiresAt: sub.expiresAt,
    country: sub.country,
    currency: sub.currency,
  };
}

export async function listPlansForSeller(sellerId: string) {
  const seller: any = await (User as any).findById(sellerId);
  if (!seller) {
    throw Object.assign(new Error("Seller not found"), { statusCode: 404 });
  }
  const country = sellerBusinessCountry(seller);
  const currency = currencyForBusinessCountry(country);
  const active = await getActivePlanForSeller(sellerId);
  const plans = listPlansForCurrency(currency);

  let promoEligible = false;
  let promoRemaining = 0;
  try {
    const cfg: any = await (PromoConfig as any)
      .findOne({ key: "dominant_niche_200" })
      .lean();
    if (cfg && cfg.enabled) {
      const claimed = Number(cfg.claimedSlots) || 0;
      const total = Number(cfg.totalSlots) || 200;
      promoRemaining = Math.max(0, total - claimed);
      const already = Array.isArray(cfg.claims)
        ? cfg.claims.some((c: any) => String(c.seller) === String(sellerId))
        : false;
      promoEligible = promoRemaining > 0 && !already && !active.isPromotional;
    }
  } catch {
    /* ignore */
  }

  return {
    country,
    currency,
    activePlan: active.planId,
    activeStatus: active.status,
    isPromotional: active.isPromotional,
    expiresAt: active.expiresAt,
    promo: {
      eligible: promoEligible,
      remainingSlots: promoRemaining,
      durationMonths: (DOMINANT_PROMO && DOMINANT_PROMO.durationMonths) || 7,
    },
    plans,
  };
}

export async function activateFreePlan(sellerId: string) {
  const seller: any = await (User as any).findById(sellerId);
  if (!seller) {
    throw Object.assign(new Error("Seller not found"), { statusCode: 404 });
  }
  const country = sellerBusinessCountry(seller);
  const currency = currencyForBusinessCountry(country);
  const benefits = getPlanBenefits("free");
  const sub: any = await ensureSellerSubscription(sellerId);

  sub.planId = "free";
  sub.status = "active";
  sub.country = country;
  sub.currency = currency;
  sub.amountPaid = 0;
  sub.provider = "system";
  sub.paymentReference = null;
  sub.startedAt = new Date();
  sub.expiresAt = null;
  sub.isPromotional = false;
  sub.promoSlotNumber = null;
  sub.promoExpiresAt = null;
  sub.transactionFeeRate = benefits.transactionFeeRate;
  sub.maxImagesPerProduct = benefits.maxImagesPerProduct;
  await sub.save();

  return { subscription: sub };
}

/**
 * Activate promotional Dominant Niche (free for DOMINANT_PROMO.durationMonths).
 */
export async function activatePromoDominant(sellerId: string) {
  // claim is a plain object — do not use strict discriminated-union access
  const claim: any = await claimDominantPromoSlot(sellerId);

  if (!claim || claim.claimed !== true) {
    const reason = String((claim && claim.reason) || "unavailable");
    const message =
      reason === "slots_exhausted"
        ? "All 200 promotional slots have been claimed"
        : reason === "promotion_off"
          ? "Promotion is currently off"
          : "Promotional slot unavailable";
    throw Object.assign(new Error(message), {
      statusCode: 400,
      code: reason,
    });
  }

  const slotNumber =
    claim.slotNumber != null ? Number(claim.slotNumber) : null;

  const seller: any = await (User as any).findById(sellerId);
  if (!seller) {
    throw Object.assign(new Error("Seller not found"), { statusCode: 404 });
  }

  const country = sellerBusinessCountry(seller);
  const currency = currencyForBusinessCountry(country);
  const benefits = getPlanBenefits("dominant");
  const sub: any = await ensureSellerSubscription(sellerId);
  const now = new Date();
  const duration =
    (DOMINANT_PROMO && DOMINANT_PROMO.durationMonths) || 7;
  const expires = addMonths(now, duration);

  sub.planId = "dominant";
  sub.status = "active";
  sub.country = country;
  sub.currency = currency;
  sub.amountPaid = 0;
  sub.provider = "promo";
  sub.paymentReference =
    slotNumber != null ? `PROMO_SLOT_${slotNumber}` : "PROMO_SLOT";
  sub.startedAt = now;
  sub.expiresAt = expires;
  sub.isPromotional = true;
  sub.promoSlotNumber = slotNumber;
  sub.promoExpiresAt = expires;
  sub.transactionFeeRate = benefits.transactionFeeRate;
  sub.maxImagesPerProduct = benefits.maxImagesPerProduct;
  await sub.save();

  return { subscription: sub, claim };
}

export async function initiatePlanPayment(
  sellerId: string,
  planIdInput: string,
  callbackUrl?: string
) {
  const planId = asPlanId(planIdInput);

  if (planId === "free") {
    return { free: true, subscription: (await activateFreePlan(sellerId)).subscription };
  }
  if (!(PLANS as any)[planId]) {
    throw Object.assign(new Error("Invalid plan"), { statusCode: 400 });
  }
  if (!isPaystackConfigured()) {
    throw Object.assign(new Error("Paystack not configured"), {
      statusCode: 503,
    });
  }

  const seller: any = await (User as any).findById(sellerId);
  if (!seller) {
    throw Object.assign(new Error("Seller not found"), { statusCode: 404 });
  }

  const country = sellerBusinessCountry(seller);
  const currency = currencyForBusinessCountry(country);
  const price = getPlanPrice(planId, currency);
  if (!price || price.amount <= 0) {
    throw Object.assign(new Error("Plan price unavailable for your country"), {
      statusCode: 400,
    });
  }

  const sub: any = await ensureSellerSubscription(sellerId);
  sub.status = "pending_payment";
  sub.planId = planId;
  sub.country = country;
  sub.currency = currency;
  await sub.save();

  const reference = genRef("PLZSUB");
  const email = seller.email || `seller_${sellerId}@plazore.local`;
  const init: any = await initializeTransaction({
    email,
    amountMajor: price.amount,
    currency,
    reference,
    callbackUrl,
    metadata: {
      type: "seller_subscription",
      sellerId: String(sellerId),
      planId,
      country,
      currency,
      amountMajor: price.amount,
    },
  });

  sub.paymentReference = reference;
  await sub.save();

  return {
    free: false,
    reference,
    authorizationUrl: init.authorization_url || init.authorizationUrl,
    accessCode: init.access_code,
    amount: price.amount,
    currency,
    planId,
    country,
  };
}

/**
 * verifyTransaction returns the INNER Paystack object — never use .data again.
 */
export async function verifyAndActivatePlan(
  sellerId: string,
  reference: string
) {
  if (!isPaystackConfigured()) {
    throw Object.assign(new Error("Paystack not configured"), {
      statusCode: 503,
    });
  }

  const data: any = await verifyTransaction(reference);
  const status = String((data && data.status) || "").toLowerCase();
  if (status !== "success") {
    throw Object.assign(
      new Error("Payment not successful — plan not activated"),
      { statusCode: 402 }
    );
  }

  const meta: any = (data && data.metadata) || {};
  const planId = asPlanId(meta.planId || meta.plan_id);
  if (planId === "free") {
    throw Object.assign(new Error("Invalid plan in payment metadata"), {
      statusCode: 400,
    });
  }

  if (meta.sellerId && String(meta.sellerId) !== String(sellerId)) {
    throw Object.assign(new Error("Payment does not belong to this seller"), {
      statusCode: 403,
    });
  }

  const seller: any = await (User as any).findById(sellerId);
  if (!seller) {
    throw Object.assign(new Error("Seller not found"), { statusCode: 404 });
  }

  const country = String(meta.country || sellerBusinessCountry(seller));
  const currency = String(
    (data && data.currency) ||
      meta.currency ||
      currencyForBusinessCountry(country)
  ).toUpperCase();

  const benefits = getPlanBenefits(planId);
  const sub: any = await ensureSellerSubscription(sellerId);
  const now = new Date();

  sub.planId = planId;
  sub.status = "active";
  sub.country = country;
  sub.currency = currency;
  sub.amountPaid =
    meta.amountMajor != null
      ? Number(meta.amountMajor)
      : Number((getPlanPrice(planId, currency) || {}).amount || 0);
  sub.provider = "paystack";
  sub.paymentReference = reference;
  sub.startedAt = now;
  sub.expiresAt = addMonths(now, 1);
  sub.isPromotional = false;
  sub.promoSlotNumber = null;
  sub.promoExpiresAt = null;
  sub.transactionFeeRate = benefits.transactionFeeRate;
  sub.maxImagesPerProduct = benefits.maxImagesPerProduct;
  await sub.save();

  return { subscription: sub, verified: true };
}

export async function onSellerOnboardingComplete(sellerId: string) {
  const claim: any = await claimDominantPromoSlot(sellerId);
  return claim;
}

export async function getPromoOverview() {
  let cfg: any = await (PromoConfig as any).findOne({
    key: "dominant_niche_200",
  });
  if (!cfg) {
    cfg = await (PromoConfig as any).create({
      key: "dominant_niche_200",
      enabled: false,
      totalSlots: (DOMINANT_PROMO && DOMINANT_PROMO.totalSlots) || 200,
      claimedSlots: 0,
      durationMonths: (DOMINANT_PROMO && DOMINANT_PROMO.durationMonths) || 7,
      claims: [],
    });
  }
  return {
    enabled: !!cfg.enabled,
    totalSlots: cfg.totalSlots,
    claimedSlots: cfg.claimedSlots,
    remaining: Math.max(0, (cfg.totalSlots || 0) - (cfg.claimedSlots || 0)),
    durationMonths: cfg.durationMonths,
  };
}

export async function setPromoEnabled(enabled: boolean) {
  const cfg: any = await (PromoConfig as any).findOneAndUpdate(
    { key: "dominant_niche_200" },
    {
      $set: { enabled: !!enabled },
      $setOnInsert: {
        key: "dominant_niche_200",
        totalSlots: (DOMINANT_PROMO && DOMINANT_PROMO.totalSlots) || 200,
        claimedSlots: 0,
        durationMonths: (DOMINANT_PROMO && DOMINANT_PROMO.durationMonths) || 7,
        claims: [],
      },
    },
    { upsert: true, new: true }
  );
  if (!cfg) {
    throw Object.assign(new Error("Failed to update promo config"), {
      statusCode: 500,
    });
  }
  return {
    enabled: !!cfg.enabled,
    totalSlots: cfg.totalSlots,
    claimedSlots: cfg.claimedSlots,
    remaining: Math.max(0, (cfg.totalSlots || 0) - (cfg.claimedSlots || 0)),
  };
}

export async function listSubscriptionsAdmin(limit = 50) {
  const rows = await (SellerSubscription as any)
    .find()
    .sort({ updatedAt: -1 })
    .limit(Math.min(200, Math.max(1, limit)))
    .populate("seller", "name email storeName role")
    .lean();
  return rows;
}

export { transactionFeeRateForPlan, maxImagesForPlan, getPlanBenefits };
