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

/** Country/region code → subscription currency */
export const BUSINESS_COUNTRY_CURRENCY: Record<string, string> = {
  NG: "NGN",
  GH: "GHS",
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
  // default fallback handled in helper
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
    prices: {
      NGN: { amount: 0, currency: "NGN", interval: "month" },
      USD: { amount: 0, currency: "USD", interval: "month" },
      EUR: { amount: 0, currency: "EUR", interval: "month" },
      GBP: { amount: 0, currency: "GBP", interval: "month" },
      GHS: { amount: 0, currency: "GHS", interval: "month" },
      KES: { amount: 0, currency: "KES", interval: "month" },
    },
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
    prices: {
      NGN: { amount: 12000, currency: "NGN", interval: "month" },
      USD: { amount: 12, currency: "USD", interval: "month" },
      EUR: { amount: 12, currency: "EUR", interval: "month" },
      GBP: { amount: 10, currency: "GBP", interval: "month" },
      GHS: { amount: 150, currency: "GHS", interval: "month" },
      KES: { amount: 1500, currency: "KES", interval: "month" },
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
    prices: {
      NGN: { amount: 30000, currency: "NGN", interval: "month" },
      USD: { amount: 30, currency: "USD", interval: "month" },
      EUR: { amount: 28, currency: "EUR", interval: "month" },
      GBP: { amount: 25, currency: "GBP", interval: "month" },
      GHS: { amount: 380, currency: "GHS", interval: "month" },
      KES: { amount: 3800, currency: "KES", interval: "month" },
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
    prices: {
      NGN: { amount: 75000, currency: "NGN", interval: "month" },
      USD: { amount: 75, currency: "USD", interval: "month" },
      EUR: { amount: 70, currency: "EUR", interval: "month" },
      GBP: { amount: 60, currency: "GBP", interval: "month" },
      GHS: { amount: 950, currency: "GHS", interval: "month" },
      KES: { amount: 9500, currency: "KES", interval: "month" },
    },
  },
};

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
