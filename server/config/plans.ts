/**
 * Single source of truth for seller plans.
 * Business location country → currency → plan prices & benefits.
 * Marketplace browse region must NEVER override this.
 */

export type PlanId = "free" | "dominant" | "business_plus" | "global_reach";

export type PlanBenefits = {
  maxImagesPerProduct: number;
  showroomVisibility: "standard" | "increased" | "high" | "maximum";
  discoveryPriority: number; // higher = shown earlier
  transactionFeeRate: number; // product subtotal only — never shipping
  bannerEligible: boolean;
  priorityDiscovery: boolean;
};

export type PlanPrice = {
  amount: number; // major units
  currency: string;
  interval: "month";
};

export type PlanDefinition = {
  id: PlanId;
  name: string;
  benefits: PlanBenefits;
  /** Prices keyed by ISO currency */
  prices: Record<string, PlanPrice>;
};

/**
 * Country/region code → subscription currency.
 * Nigeria → NGN (local tier). Every other Plazore region → that region's currency
 * with international USD-based amounts converted in PLANS.prices.
 */
export const BUSINESS_COUNTRY_CURRENCY: Record<string, string> = {
  NG: "NGN",
  GH: "GHS",
  BJ: "XOF",
  CM: "XAF",
  KE: "KES",
  ZA: "ZAR",
  EG: "EGP",
  UG: "UGX",
  TZ: "TZS",
  RW: "RWF",
  US: "USD",
  CA: "CAD",
  GB: "GBP",
  UK: "GBP",
  DE: "EUR",
  FR: "EUR",
  NL: "EUR",
  IT: "EUR",
  ES: "EUR",
  AU: "AUD",
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free Seller",
    benefits: {
      maxImagesPerProduct: 6,
      showroomVisibility: "standard",
      discoveryPriority: 10,
      transactionFeeRate: 0.08,
      bannerEligible: false,
      priorityDiscovery: false,
    },
    prices: zeroPrices(),
  },
  dominant: {
    id: "dominant",
    name: "Dominant Niche",
    benefits: {
      maxImagesPerProduct: 12,
      showroomVisibility: "increased",
      discoveryPriority: 40,
      transactionFeeRate: 0.05,
      bannerEligible: false,
      priorityDiscovery: false,
    },
    // NG local tier; all other currencies = international USD $12 converted
    prices: {
      NGN: { amount: 12000, currency: "NGN", interval: "month" },
      USD: { amount: 12, currency: "USD", interval: "month" },
      EUR: { amount: 11, currency: "EUR", interval: "month" },
      GBP: { amount: 10, currency: "GBP", interval: "month" },
      CAD: { amount: 16, currency: "CAD", interval: "month" },
      AUD: { amount: 18, currency: "AUD", interval: "month" },
      GHS: { amount: 150, currency: "GHS", interval: "month" },
      KES: { amount: 1550, currency: "KES", interval: "month" },
      ZAR: { amount: 220, currency: "ZAR", interval: "month" },
      EGP: { amount: 580, currency: "EGP", interval: "month" },
      XOF: { amount: 7500, currency: "XOF", interval: "month" },
      XAF: { amount: 7500, currency: "XAF", interval: "month" },
      UGX: { amount: 45000, currency: "UGX", interval: "month" },
      TZS: { amount: 30000, currency: "TZS", interval: "month" },
      RWF: { amount: 15500, currency: "RWF", interval: "month" },
    },
  },
  business_plus: {
    id: "business_plus",
    name: "Business Plus",
    benefits: {
      maxImagesPerProduct: 16,
      showroomVisibility: "high",
      discoveryPriority: 70,
      transactionFeeRate: 0.035,
      bannerEligible: false,
      priorityDiscovery: true,
    },
    // NG local tier; international ≈ USD $30 converted
    prices: {
      NGN: { amount: 30000, currency: "NGN", interval: "month" },
      USD: { amount: 30, currency: "USD", interval: "month" },
      EUR: { amount: 28, currency: "EUR", interval: "month" },
      GBP: { amount: 24, currency: "GBP", interval: "month" },
      CAD: { amount: 41, currency: "CAD", interval: "month" },
      AUD: { amount: 46, currency: "AUD", interval: "month" },
      GHS: { amount: 380, currency: "GHS", interval: "month" },
      KES: { amount: 3900, currency: "KES", interval: "month" },
      ZAR: { amount: 550, currency: "ZAR", interval: "month" },
      EGP: { amount: 1450, currency: "EGP", interval: "month" },
      XOF: { amount: 18500, currency: "XOF", interval: "month" },
      XAF: { amount: 18500, currency: "XAF", interval: "month" },
      UGX: { amount: 112000, currency: "UGX", interval: "month" },
      TZS: { amount: 78000, currency: "TZS", interval: "month" },
      RWF: { amount: 39000, currency: "RWF", interval: "month" },
    },
  },
  global_reach: {
    id: "global_reach",
    name: "Global Reach",
    benefits: {
      maxImagesPerProduct: 20,
      showroomVisibility: "maximum",
      discoveryPriority: 100,
      transactionFeeRate: 0.02,
      bannerEligible: true,
      priorityDiscovery: true,
    },
    // NG local tier; international ≈ USD $75 converted
    prices: {
      NGN: { amount: 75000, currency: "NGN", interval: "month" },
      USD: { amount: 75, currency: "USD", interval: "month" },
      EUR: { amount: 70, currency: "EUR", interval: "month" },
      GBP: { amount: 60, currency: "GBP", interval: "month" },
      CAD: { amount: 102, currency: "CAD", interval: "month" },
      AUD: { amount: 115, currency: "AUD", interval: "month" },
      GHS: { amount: 950, currency: "GHS", interval: "month" },
      KES: { amount: 9700, currency: "KES", interval: "month" },
      ZAR: { amount: 1380, currency: "ZAR", interval: "month" },
      EGP: { amount: 3650, currency: "EGP", interval: "month" },
      XOF: { amount: 46500, currency: "XOF", interval: "month" },
      XAF: { amount: 46500, currency: "XAF", interval: "month" },
      UGX: { amount: 280000, currency: "UGX", interval: "month" },
      TZS: { amount: 195000, currency: "TZS", interval: "month" },
      RWF: { amount: 97000, currency: "RWF", interval: "month" },
    },
  },
};

function zeroPrices(): Record<string, PlanPrice> {
  const codes = [
    "NGN",
    "USD",
    "EUR",
    "GBP",
    "CAD",
    "AUD",
    "GHS",
    "KES",
    "ZAR",
    "EGP",
    "XOF",
    "XAF",
    "UGX",
    "TZS",
    "RWF",
  ];
  const out: Record<string, PlanPrice> = {};
  for (const c of codes) {
    out[c] = { amount: 0, currency: c, interval: "month" };
  }
  return out;
}

/** 200 Dominant Niche free promotional slots (7 months) */
export const DOMINANT_PROMO = {
  totalSlots: 200,
  durationMonths: 7,
  planId: "dominant" as PlanId,
  priceAmount: 0,
};

export function currencyForBusinessCountry(country?: string | null): string {
  const key = String(country || "NG")
    .trim()
    .toUpperCase()
    .split(/[-_]/)[0];
  return BUSINESS_COUNTRY_CURRENCY[key] || "USD";
}

export function getPlanPrice(planId: PlanId, currency: string): PlanPrice {
  const plan = PLANS[planId];
  const cur = currency.toUpperCase();
  if (plan.prices[cur]) return plan.prices[cur];
  // Fallback: USD if available, else free
  if (plan.prices.USD) return plan.prices.USD;
  return plan.prices.NGN || { amount: 0, currency: cur, interval: "month" };
}

export function getPlanBenefits(planId: PlanId): PlanBenefits {
  return PLANS[planId]?.benefits || PLANS.free.benefits;
}

/** Active plan fee rate for product subtotal only */
export function transactionFeeRateForPlan(planId?: PlanId | null): number {
  if (!planId || !PLANS[planId]) return PLANS.free.benefits.transactionFeeRate;
  return PLANS[planId].benefits.transactionFeeRate;
}

export function maxImagesForPlan(planId?: PlanId | null): number {
  if (!planId || !PLANS[planId]) return PLANS.free.benefits.maxImagesPerProduct;
  return PLANS[planId].benefits.maxImagesPerProduct;
}

export function listPlansForCurrency(currency: string) {
  const cur = currency.toUpperCase();
  return (Object.keys(PLANS) as PlanId[]).map((id) => {
    const def = PLANS[id];
    const price = getPlanPrice(id, cur);
    return {
      id: def.id,
      name: def.name,
      benefits: def.benefits,
      price,
    };
  });
}
