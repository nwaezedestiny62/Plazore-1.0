/**
 * Seller subscription lifecycle — dual provider (Paystack + Stripe).
 *
 * Rules:
 * - Business location country → currency → plan price. Never buyer marketplace region.
 * - Paid plans activate ONLY after server-side verification (API or webhook).
 * - One active SellerSubscription document per seller.
 * - Free + promo paths never hit a payment gateway.
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
  type PlanId,
} from "../config/plans.js";
import {
  isPaystackConfigured,
} from "./paystack/client.js";
import {
  initializeTransaction,
  verifyTransaction,
} from "./paystack/transactions.js";
import {
  isStripeConfigured,
  getPublishableKey,
} from "./stripe/client.js";
import {
  createPaymentIntent,
  retrievePaymentIntent,
} from "./stripe/paymentIntents.js";

export type SubProvider = "paystack" | "stripe";

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

function normalizeProvider(raw?: string | null): SubProvider {
  const p = String(raw || "paystack").toLowerCase().trim();
  return p === "stripe" ? "stripe" : "paystack";
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
    lastVerificationSource: "system",
  });
  return sub;
}

/**
 * Resolve active plan. Auto-downgrades expired paid plans to Free.
 */
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
    provider: sub.provider,
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
    providers: {
      paystack: isPaystackConfigured(),
      stripe: isStripeConfigured(),
    },
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
  sub.stripePaymentIntentId = null;
  sub.stripeClientSecret = null;
  sub.stripeChargeId = null;
  sub.startedAt = new Date();
  sub.expiresAt = null;
  sub.isPromotional = false;
  sub.promoSlotNumber = null;
  sub.promoExpiresAt = null;
  sub.transactionFeeRate = benefits.transactionFeeRate;
  sub.maxImagesPerProduct = benefits.maxImagesPerProduct;
  sub.lastVerifiedAt = new Date();
  sub.lastVerificationSource = "system";
  await sub.save();

  return { subscription: sub };
}

export async function activatePromoDominant(sellerId: string) {
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

  // Already claimed previously — still ensure sub is on promo if active
  if (claim.already === true) {
    const existing = await getActivePlanForSeller(sellerId);
    if (existing.isPromotional && existing.status === "active") {
      return { subscription: existing.subscription, claim };
    }
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
  const duration = (DOMINANT_PROMO && DOMINANT_PROMO.durationMonths) || 7;
  const expires = addMonths(now, duration);

  sub.planId = "dominant";
  sub.status = "active";
  sub.country = country;
  sub.currency = currency;
  sub.amountPaid = 0;
  sub.provider = "promo";
  sub.paymentReference =
    slotNumber != null ? `PROMO_SLOT_${slotNumber}` : "PROMO_SLOT";
  sub.stripePaymentIntentId = null;
  sub.stripeClientSecret = null;
  sub.startedAt = now;
  sub.expiresAt = expires;
  sub.isPromotional = true;
  sub.promoSlotNumber = slotNumber;
  sub.promoExpiresAt = expires;
  sub.transactionFeeRate = benefits.transactionFeeRate;
  sub.maxImagesPerProduct = benefits.maxImagesPerProduct;
  sub.lastVerifiedAt = now;
  sub.lastVerificationSource = "promo";
  await sub.save();

  return { subscription: sub, claim };
}

/**
 * Start payment for a paid plan.
 * provider: "paystack" | "stripe"
 */
export async function initiatePlanPayment(
  sellerId: string,
  planIdInput: string,
  callbackUrl?: string,
  providerInput?: string
) {
  const planId = asPlanId(planIdInput);
  const provider = normalizeProvider(providerInput);

  if (planId === "free") {
    return {
      free: true,
      subscription: (await activateFreePlan(sellerId)).subscription,
    };
  }
  if (!(PLANS as any)[planId]) {
    throw Object.assign(new Error("Invalid plan"), { statusCode: 400 });
  }

  if (provider === "paystack" && !isPaystackConfigured()) {
    throw Object.assign(new Error("Paystack not configured"), {
      statusCode: 503,
      code: "PAYSTACK_NOT_CONFIGURED",
    });
  }
  if (provider === "stripe" && !isStripeConfigured()) {
    throw Object.assign(new Error("Stripe not configured"), {
      statusCode: 503,
      code: "STRIPE_NOT_CONFIGURED",
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
  sub.provider = provider;
  await sub.save();

  const reference = genRef("PLZSUB");
  const email = seller.email || `seller_${sellerId}@plazore.local`;

  // ── Stripe path ──
  if (provider === "stripe") {
    const intent = await createPaymentIntent({
      amountMajor: price.amount,
      currency,
      reference,
      orderId: `sub_${sellerId}`,
      orderNumber: `SUB-${planId.toUpperCase()}`,
      buyerId: String(sellerId),
      sellerId: String(sellerId),
      buyerEmail: email,
      returnUrl: callbackUrl,
      metadata: {
        type: "seller_subscription",
        sellerId: String(sellerId),
        planId,
        country,
        currency,
        amountMajor: String(price.amount),
      },
    });

    sub.paymentReference = reference;
    sub.stripePaymentIntentId = intent.paymentIntentId;
    sub.stripeClientSecret = intent.clientSecret;
    await sub.save();

    return {
      free: false,
      provider: "stripe" as const,
      reference,
      clientSecret: intent.clientSecret,
      paymentIntentId: intent.paymentIntentId,
      publicKey: getPublishableKey(),
      authorizationUrl: null,
      accessCode: null,
      amount: price.amount,
      currency,
      planId,
      country,
    };
  }

  // ── Paystack path ──
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
  sub.stripePaymentIntentId = null;
  sub.stripeClientSecret = null;
  await sub.save();

  return {
    free: false,
    provider: "paystack" as const,
    reference,
    authorizationUrl: init.authorization_url || init.authorizationUrl,
    accessCode: init.access_code,
    clientSecret: null,
    paymentIntentId: null,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
    amount: price.amount,
    currency,
    planId,
    country,
  };
}

/**
 * Shared activation after successful payment (API verify or webhook).
 */
async function activatePaidPlan(params: {
  sellerId: string;
  planId: PlanId;
  reference: string;
  provider: SubProvider;
  currency: string;
  country: string;
  amountMajor: number;
  source: "api" | "webhook";
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
}) {
  const benefits = getPlanBenefits(params.planId);
  const sub: any = await ensureSellerSubscription(params.sellerId);
  const now = new Date();

  // Idempotent: already active with same reference
  if (
    sub.status === "active" &&
    sub.paymentReference === params.reference &&
    asPlanId(sub.planId) === params.planId
  ) {
    return { subscription: sub, alreadyActive: true };
  }

  sub.planId = params.planId;
  sub.status = "active";
  sub.country = params.country;
  sub.currency = params.currency;
  sub.amountPaid = params.amountMajor;
  sub.provider = params.provider;
  sub.paymentReference = params.reference;
  if (params.stripePaymentIntentId) {
    sub.stripePaymentIntentId = params.stripePaymentIntentId;
  }
  if (params.stripeChargeId) {
    sub.stripeChargeId = params.stripeChargeId;
  }
  sub.stripeClientSecret = null;
  sub.startedAt = now;
  sub.expiresAt = addMonths(now, 1);
  sub.isPromotional = false;
  sub.promoSlotNumber = null;
  sub.promoExpiresAt = null;
  sub.transactionFeeRate = benefits.transactionFeeRate;
  sub.maxImagesPerProduct = benefits.maxImagesPerProduct;
  sub.lastVerifiedAt = now;
  sub.lastVerificationSource = params.source;
  await sub.save();

  return { subscription: sub, alreadyActive: false };
}

/**
 * Verify by reference (client callback or manual).
 * Routes to Stripe PaymentIntent or Paystack verify.
 */
export async function verifyAndActivatePlan(
  sellerId: string,
  reference: string
) {
  const sub: any = await (SellerSubscription as any).findOne({
    paymentReference: reference,
  });

  // Prefer record's provider; fall back to paystack
  const provider: SubProvider = normalizeProvider(
    sub?.provider || "paystack"
  );

  if (provider === "stripe") {
    if (!isStripeConfigured()) {
      throw Object.assign(new Error("Stripe not configured"), {
        statusCode: 503,
        code: "STRIPE_NOT_CONFIGURED",
      });
    }

    const intentId =
      sub?.stripePaymentIntentId ||
      (await findStripeIntentByReference(reference));

    if (!intentId) {
      throw Object.assign(new Error("Missing Stripe PaymentIntent for this reference"), {
        statusCode: 400,
      });
    }

    const intent = await retrievePaymentIntent(String(intentId));
    if (intent.status !== "succeeded") {
      throw Object.assign(
        new Error("Payment not successful — plan not activated"),
        { statusCode: 402 }
      );
    }

    const meta: any = intent.metadata || {};
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

    const country = String(meta.country || "NG").toUpperCase();
    const currency = String(
      intent.currency || meta.currency || "USD"
    ).toUpperCase();
    const amountMajor =
      meta.amountMajor != null
        ? Number(meta.amountMajor)
        : Number((getPlanPrice(planId, currency) || {}).amount || 0);

    let chargeId: string | null = null;
    const charge = (intent as any).latest_charge;
    if (typeof charge === "string") chargeId = charge;
    else if (charge?.id) chargeId = charge.id;

    return activatePaidPlan({
      sellerId,
      planId,
      reference,
      provider: "stripe",
      currency,
      country,
      amountMajor,
      source: "api",
      stripePaymentIntentId: String(intentId),
      stripeChargeId: chargeId,
    });
  }

  // Paystack
  if (!isPaystackConfigured()) {
    throw Object.assign(new Error("Paystack not configured"), {
      statusCode: 503,
      code: "PAYSTACK_NOT_CONFIGURED",
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
  const country = String(
    meta.country || (seller ? sellerBusinessCountry(seller) : "NG")
  ).toUpperCase();
  const currency = String(
    (data && data.currency) ||
      meta.currency ||
      currencyForBusinessCountry(country)
  ).toUpperCase();
  const amountMajor =
    meta.amountMajor != null
      ? Number(meta.amountMajor)
      : Number((getPlanPrice(planId, currency) || {}).amount || 0);

  return activatePaidPlan({
    sellerId,
    planId,
    reference,
    provider: "paystack",
    currency,
    country,
    amountMajor,
    source: "api",
  });
}

async function findStripeIntentByReference(
  reference: string
): Promise<string | null> {
  const row: any = await (SellerSubscription as any).findOne({
    paymentReference: reference,
  });
  return row?.stripePaymentIntentId || null;
}

/**
 * Webhook path — activate from Paystack charge.success or Stripe payment_intent.succeeded
 * when metadata.type === "seller_subscription".
 * Idempotent.
 */
export async function activatePlanFromWebhook(params: {
  provider: SubProvider;
  reference: string;
  metadata: Record<string, any>;
  amountMinor?: number;
  currency?: string;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
}) {
  const meta = params.metadata || {};
  if (String(meta.type || "") !== "seller_subscription") {
    return { handled: false, reason: "not_subscription" };
  }

  const sellerId = String(meta.sellerId || "");
  if (!sellerId) {
    return { handled: false, reason: "missing_seller" };
  }

  const planId = asPlanId(meta.planId || meta.plan_id);
  if (planId === "free") {
    return { handled: false, reason: "invalid_plan" };
  }

  const country = String(meta.country || "NG").toUpperCase();
  const currency = String(
    params.currency || meta.currency || currencyForBusinessCountry(country)
  ).toUpperCase();
  const amountMajor =
    meta.amountMajor != null
      ? Number(meta.amountMajor)
      : Number((getPlanPrice(planId, currency) || {}).amount || 0);

  const result = await activatePaidPlan({
    sellerId,
    planId,
    reference: params.reference,
    provider: params.provider,
    currency,
    country,
    amountMajor,
    source: "webhook",
    stripePaymentIntentId: params.stripePaymentIntentId,
    stripeChargeId: params.stripeChargeId,
  });

  return { handled: true, ...result };
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

/**
 * Batch-expire paid plans past expiresAt. Call from a cron job.
 */
export async function expireOverdueSubscriptions(limit = 200) {
  const now = new Date();
  const overdue: any[] = await (SellerSubscription as any)
    .find({
      status: "active",
      planId: { $ne: "free" },
      expiresAt: { $ne: null, $lt: now },
    })
    .limit(limit);

  const freeBenefits = getPlanBenefits("free");
  let count = 0;
  for (const sub of overdue) {
    sub.status = "expired";
    sub.planId = "free";
    sub.transactionFeeRate = freeBenefits.transactionFeeRate;
    sub.maxImagesPerProduct = freeBenefits.maxImagesPerProduct;
    sub.isPromotional = false;
    await sub.save();
    count += 1;
  }
  return { expired: count };
}

export { transactionFeeRateForPlan, maxImagesForPlan, getPlanBenefits };
