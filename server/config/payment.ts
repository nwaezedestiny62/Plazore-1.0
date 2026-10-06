/**
 * Plazore payment configuration
 * Fee is FIXED at 8%. Do not change without product decision.
 */

export const PLAZORE_TRANSACTION_FEE_RATE = 0.08; // 8% — NEVER 7%

/** Buyer confirmation window after seller marks Delivered (server-side). */
export const DELIVERY_CONFIRMATION_WINDOW_MS = 17 * 60 * 60 * 1000; // 17 hours

/** How often the auto-confirm job runs. */
export const AUTO_CONFIRM_JOB_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** How often eligible payouts are attempted. */
export const PAYOUT_JOB_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fee is calculated on product subtotal only.
 * Shipping is passed through 100% to the seller.
 */
export function calculatePlatformFee(subtotal: number): number {
  if (!Number.isFinite(subtotal) || subtotal < 0) return 0;
  // Round to nearest whole currency unit (kobo handled at Paystack layer)
  return Math.round(subtotal * PLAZORE_TRANSACTION_FEE_RATE);
}

export function calculateSellerPayout(
  subtotal: number,
  shippingCost: number
): { platformFee: number; sellerPayoutAmount: number; grossAmount: number } {
  const grossAmount = subtotal + shippingCost;
  const platformFee = calculatePlatformFee(subtotal);
  const sellerPayoutAmount = grossAmount - platformFee;
  return { platformFee, sellerPayoutAmount, grossAmount };
}

/** Paystack expects amount in smallest unit (kobo for NGN). */
export function toPaystackAmount(majorUnits: number): number {
  return Math.round(majorUnits * 100);
}

export function fromPaystackAmount(minorUnits: number): number {
  return minorUnits / 100;
}

export const PAYSTACK_BASE_URL =
  process.env.PAYSTACK_BASE_URL || "https://api.paystack.co";

export const PAYSTACK_DEFAULT_CURRENCY =
  process.env.PAYSTACK_DEFAULT_CURRENCY || "NGN";

/**
 * Map Plazore region codes to Paystack currency codes.
 * Extend as you enable more markets.
 */
export const REGION_TO_CURRENCY: Record<string, string> = {
  NG: "NGN",
  GH: "GHS",
  ZA: "ZAR",
  KE: "KES",
  US: "USD",
  GB: "GBP",
  CA: "CAD",
  EU: "EUR",
};

export function currencyForRegion(region?: string): string {
  if (!region) return PAYSTACK_DEFAULT_CURRENCY;
  return REGION_TO_CURRENCY[region.toUpperCase()] || PAYSTACK_DEFAULT_CURRENCY;
}
