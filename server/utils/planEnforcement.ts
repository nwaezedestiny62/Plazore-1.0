/**
 * Call from product create/update and order fee calculation.
 */

import { getActivePlanForSeller, maxImagesForPlan } from "../services/subscriptionService.js";
import type { PlanId } from "../config/plans.js";
import { calculateSellerPayout } from "../config/payment.js";

/** Throw 400 if image count exceeds active plan limit */
export async function assertImageLimit(sellerId: string, imageCount: number) {
  const active = await getActivePlanForSeller(sellerId);
  const max = active.maxImagesPerProduct || maxImagesForPlan(active.planId as PlanId);
  if (imageCount > max) {
    throw Object.assign(
      new Error(
        `Your plan allows up to ${max} images per product. Upgrade to add more.`
      ),
      { statusCode: 400, code: "PLAN_IMAGE_LIMIT" }
    );
  }
  return { max, planId: active.planId };
}

/**
 * Build feeBreakdown at order create using seller's active plan rate.
 * Product subtotal only — shipping never in fee.
 */
export async function feeBreakdownForSellerOrder(
  sellerId: string,
  subtotal: number,
  shippingCost: number,
  currency: string,
  region?: string
) {
  const active = await getActivePlanForSeller(sellerId);
  const calc = calculateSellerPayout(subtotal, shippingCost, currency, {
    feeRate: active.transactionFeeRate,
    planId: active.planId as PlanId,
  });
  return {
    subtotal,
    shippingCost,
    grossAmount: calc.grossAmount,
    platformFeeRate: calc.platformFeeRate,
    platformFee: calc.platformFee,
    sellerPayoutAmount: calc.sellerPayoutAmount,
    currency,
    region: region || undefined,
    planId: active.planId,
  };
}
