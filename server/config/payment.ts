/**
 * Plazore payment configuration
 * Platform fee is FIXED at 8%. Never use 7%.
 * Shared by both Paystack and Stripe rails.
 */

export const PLAZORE_TRANSACTION_FEE_RATE = 0.08;

export const DELIVERY_CONFIRMATION_WINDOW_MS = 17 * 60 * 60 * 1000;
export const AUTO_CONFIRM_JOB_INTERVAL_MS = 5 * 60 * 1000;
export const PAYOUT_JOB_INTERVAL_MS = 10 * 60 * 1000;

/** Pending/processing payment older than this → stock released */
export const ABANDONED_PAYMENT_TIMEOUT_MS = 45 * 60 * 1000; // 45 min

/** How often the abandoned-payment cleaner runs */
export const ABANDONED_PAYMENT_JOB_INTERVAL_MS = 5 * 60 * 1000; // 5 min

export const PAYSTACK_BASE_URL =
  process.env.PAYSTACK_BASE_URL || "https://api.paystack.co";

export const PAYSTACK_DEFAULT_CURRENCY =
  process.env.PAYSTACK_DEFAULT_CURRENCY || "NGN";

/** Region code → ISO 4217 (align with web/mobile regions) */
export const REGION_TO_CURRENCY: Record<string, string> = {
  NG: "NGN",
  GH: "GHS",
  BJ: "XOF",
  TG: "XOF",
  CI: "XOF",
  SN: "XOF",
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
  EU: "EUR",
  AU: "AUD",
};

const ZERO_DECIMAL = new Set(["NGN", "XOF", "XAF", "KES", "JPY", "UGX", "RWF"]);

const KNOWN_ISO = new Set([
  "NGN",
  "USD",
  "EUR",
  "GBP",
  "GHS",
  "CAD",
  "AUD",
  "ZAR",
  "KES",
  "EGP",
  "XOF",
  "XAF",
  "UGX",
  "TZS",
  "RWF",
]);

export function currencyForRegion(region?: string): string {
  if (!region) return PAYSTACK_DEFAULT_CURRENCY;
  const r = String(region).trim().toUpperCase();
  if (REGION_TO_CURRENCY[r]) return REGION_TO_CURRENCY[r];
  if (r.length === 3 && /^[A-Z]{3}$/.test(r) && KNOWN_ISO.has(r)) return r;
  const base = r.split(/[-_]/)[0];
  if (REGION_TO_CURRENCY[base]) return REGION_TO_CURRENCY[base];
  return PAYSTACK_DEFAULT_CURRENCY;
}

export function roundMoney(amount: number, currency?: string): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  const cur = String(currency || "NGN").toUpperCase();
  if (ZERO_DECIMAL.has(cur)) return Math.round(n);
  return Math.round(n * 100) / 100;
}

/** 8% of product subtotal only. Shipping passes through. */
export function calculatePlatformFee(
  subtotal: number,
  currency?: string
): number {
  if (!Number.isFinite(subtotal) || subtotal < 0) return 0;
  return roundMoney(subtotal * PLAZORE_TRANSACTION_FEE_RATE, currency);
}

export function calculateSellerPayout(
  subtotal: number,
  shippingCost: number,
  currency?: string
): {
  platformFee: number;
  sellerPayoutAmount: number;
  grossAmount: number;
} {
  const cur = currency || "NGN";
  const grossAmount = roundMoney(
    (Number(subtotal) || 0) + (Number(shippingCost) || 0),
    cur
  );
  const platformFee = calculatePlatformFee(subtotal, cur);
  const sellerPayoutAmount = roundMoney(grossAmount - platformFee, cur);
  return { platformFee, sellerPayoutAmount, grossAmount };
}

/** Convert major units → minor units for the given currency (works for both providers) */
export function toMinorUnits(
  majorUnits: number,
  currency?: string
): number {
  const cur = String(currency || "NGN").toUpperCase();
  if (ZERO_DECIMAL.has(cur)) return Math.round(majorUnits);
  return Math.round(majorUnits * 100);
}

export function fromMinorUnits(
  minorUnits: number,
  currency?: string
): number {
  const cur = String(currency || "NGN").toUpperCase();
  if (ZERO_DECIMAL.has(cur)) return minorUnits;
  return minorUnits / 100;
}

// Backwards-compatible aliases used by existing Paystack code
export const toPaystackAmount = toMinorUnits;
export const fromPaystackAmount = fromMinorUnits;

/**
 * Recommended provider by region (can be overridden by buyer choice).
 * Used only as a soft default at checkout.
 */
export function recommendedProvider(region?: string): "paystack" | "stripe" {
  const r = String(region || "NG").toUpperCase();
  if (["NG", "GH", "KE", "ZA", "EG", "CI", "SN", "CM"].includes(r)) {
    return "paystack";
  }
  return "stripe";
}