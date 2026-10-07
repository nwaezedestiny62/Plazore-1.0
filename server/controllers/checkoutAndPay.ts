/**
 * Plazore payment configuration
 * Fee is FIXED at 8%. Do not change without product decision.
 * Currency follows product listing region — buyer pays in that currency.
 */

export const PLAZORE_TRANSACTION_FEE_RATE = 0.08; // 8% — NEVER 7%

/** Buyer confirmation window after seller marks Delivered (server-side). */
export const DELIVERY_CONFIRMATION_WINDOW_MS = 17 * 60 * 60 * 1000; // 17 hours

export const AUTO_CONFIRM_JOB_INTERVAL_MS = 5 * 60 * 1000;
export const PAYOUT_JOB_INTERVAL_MS = 10 * 60 * 1000;

/** How long a pending/processing payment may sit before stock is released */
export const ABANDONED_PAYMENT_TIMEOUT_MS = 45 * 60 * 1000; // 45 minutes

/** How often the abandoned-payment cleaner runs */
export const ABANDONED_PAYMENT_JOB_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fee on product subtotal only. Shipping passes 100% to seller.
 * Amounts are in the order’s listing currency (not converted here).
 */
export function calculatePlatformFee(subtotal: number): number {
  if (!Number.isFinite(subtotal) || subtotal < 0) return 0;
  return Math.round(subtotal * PLAZORE_TRANSACTION_FEE_RATE * 100) / 100;
}

export function calculateSellerPayout(
  subtotal: number,
  shippingCost: number
): { platformFee: number; sellerPayoutAmount: number; grossAmount: number } {
  const grossAmount =
    (Number.isFinite(subtotal) ? subtotal : 0) +
    (Number.isFinite(shippingCost) ? shippingCost : 0);
  const platformFee = calculatePlatformFee(subtotal);
  const sellerPayoutAmount =
    Math.round((grossAmount - platformFee) * 100) / 100;
  return {
    platformFee,
    sellerPayoutAmount,
    grossAmount: Math.round(grossAmount * 100) / 100,
  };
}

/** Paystack expects amount in smallest unit (kobo / cents). */
export function toPaystackAmount(majorUnits: number): number {
  return Math.round(Number(majorUnits) * 100);
}

export function fromPaystackAmount(minorUnits: number): number {
  return Number(minorUnits) / 100;
}

export const PAYSTACK_BASE_URL =
  process.env.PAYSTACK_BASE_URL || "https://api.paystack.co";

export const PAYSTACK_DEFAULT_CURRENCY =
  process.env.PAYSTACK_DEFAULT_CURRENCY || "NGN";

/**
 * Plazore region code → ISO 4217 currency.
 * Product.region and Order.region use region codes; payment uses currency.
 */
export const REGION_TO_CURRENCY: Record<string, string> = {
  // West Africa
  NG: "NGN",
  GH: "GHS",
  BJ: "XOF",
  TG: "XOF",
  CI: "XOF",
  SN: "XOF",
  // Central Africa
  CM: "XAF",
  // East / Southern Africa
  KE: "KES",
  ZA: "ZAR",
  EG: "EGP",
  // Americas
  US: "USD",
  CA: "CAD",
  // Europe
  GB: "GBP",
  UK: "GBP",
  DE: "EUR",
  FR: "EUR",
  NL: "EUR",
  IT: "EUR",
  ES: "EUR",
  EU: "EUR",
  // Oceania
  AU: "AUD",
};

/** Currencies we may already store as region-like codes */
const KNOWN_CURRENCIES = new Set(Object.values(REGION_TO_CURRENCY));

/**
 * Resolve ISO currency for a listing region (or currency code).
 * Used at order freeze + Paystack initialize — payment must match this.
 */
export function currencyForRegion(region?: string | null): string {
  if (!region) return PAYSTACK_DEFAULT_CURRENCY;
  const key = String(region).trim().toUpperCase();
  if (!key) return PAYSTACK_DEFAULT_CURRENCY;
  if (REGION_TO_CURRENCY[key]) return REGION_TO_CURRENCY[key];
  if (KNOWN_CURRENCIES.has(key)) return key;
  // "US-CA" style → first segment
  const base = key.split(/[-_]/)[0];
  if (REGION_TO_CURRENCY[base]) return REGION_TO_CURRENCY[base];
  return PAYSTACK_DEFAULT_CURRENCY;
}

/** Human label for admin UI (optional helper). */
export function regionDisplayName(region?: string | null): string {
  const map: Record<string, string> = {
    NG: "Nigeria",
    GH: "Ghana",
    BJ: "Benin",
    TG: "Togo",
    CI: "Côte d'Ivoire",
    SN: "Senegal",
    CM: "Cameroon",
    KE: "Kenya",
    ZA: "South Africa",
    EG: "Egypt",
    US: "United States",
    CA: "Canada",
    GB: "United Kingdom",
    UK: "United Kingdom",
    DE: "Germany",
    FR: "France",
    NL: "Netherlands",
    IT: "Italy",
    ES: "Spain",
    EU: "Europe",
    AU: "Australia",
  };
  if (!region) return "—";
  const key = String(region).trim().toUpperCase();
  return map[key] || key;
}
