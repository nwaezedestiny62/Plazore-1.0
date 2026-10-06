import Order from "../../models/Order.js";
import { PAYOUT_JOB_INTERVAL_MS } from "../../config/payment.js";
import { processSellerPayout } from "../payoutService.js";
import { isPaystackConfigured } from "../paystack/client.js";

/**
 * Process orders that are delivery-confirmed and payout-eligible.
 * Only runs real transfers when Paystack is configured.
 */
export async function runProcessEligiblePayoutsJob() {
  if (!isPaystackConfigured()) {
    return { skipped: true, reason: "Paystack not configured" };
  }

  const candidates = await Order.find({
    paymentStatus: "paid",
    "payout.status": { $in: ["eligible", "failed"] },
    paymentLifecycle: {
      $in: ["DELIVERY_CONFIRMED", "SELLER_PAYOUT_PENDING", "SETTLED_SELLER_FAVOUR"],
    },
    "buyerConfirmation.status": { $in: ["confirmed", "auto_confirmed"] },
  }).limit(20);

  let ok = 0;
  let failed = 0;

  for (const order of candidates) {
    try {
      await processSellerPayout(order._id.toString(), { triggeredBy: "system" });
      ok++;
    } catch (err: any) {
      failed++;
      console.error(`[payoutJob] order ${order._id}:`, err.message || err);
    }
  }

  if (ok || failed) {
    console.log(`[payoutJob] processed ok=${ok} failed=${failed}`);
  }
  return { scanned: candidates.length, ok, failed };
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
