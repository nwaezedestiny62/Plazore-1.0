import Order from "../../models/Order.js";
import { PAYOUT_JOB_INTERVAL_MS } from "../../config/payment.js";
import { processSellerPayout } from "../payoutService.js";
import { isPaystackConfigured } from "../paystack/client.js";
import { isStripeConfigured } from "../stripe/client.js";

/**
 * Process orders that are delivery-confirmed and payout-eligible.
 * Runs when either Paystack or Stripe is configured.
 * processSellerPayout routes by payment.provider.
 */
export async function runProcessEligiblePayoutsJob() {
  if (!isPaystackConfigured() && !isStripeConfigured()) {
    return { skipped: true, reason: "No payment provider configured" };
  }

  const candidates = await Order.find({
    paymentStatus: "paid",
    "payout.status": { $in: ["eligible", "failed", "queued"] },
    paymentLifecycle: {
      $in: [
        "DELIVERY_CONFIRMED",
        "SELLER_PAYOUT_PENDING",
        "SETTLED_SELLER_FAVOUR",
      ],
    },
    "buyerConfirmation.status": { $in: ["confirmed", "auto_confirmed"] },
  }).limit(20);

  let ok = 0;
  let failed = 0;
  let queued = 0;

  for (const order of candidates) {
    try {
      const result = await processSellerPayout(order._id.toString(), {
        triggeredBy: "system",
      });
      if ((result as any)?.queuedOnly) queued++;
      else ok++;
    } catch (err: any) {
      failed++;
      console.error(`[payoutJob] order ${order._id}:`, err.message || err);
    }
  }

  if (ok || failed || queued) {
    console.log(
      `[payoutJob] processed ok=${ok} queued=${queued} failed=${failed}`
    );
  }
  return { scanned: candidates.length, ok, queued, failed };
}

let timer: NodeJS.Timeout | null = null;

export function startPayoutScheduler() {
  if (timer) return;
  console.log(
    `[payoutJob] scheduler started (every ${PAYOUT_JOB_INTERVAL_MS / 1000}s)`
  );
  setTimeout(() => {
    runProcessEligiblePayoutsJob().catch(console.error);
    timer = setInterval(() => {
      runProcessEligiblePayoutsJob().catch(console.error);
    }, PAYOUT_JOB_INTERVAL_MS);
  }, 30_000);
}
