/**
 * server/services/jobs/releaseAbandonedPayments.ts
 * NEW FILE — copy into your repo as-is
 */

import Order from "../../models/Order.js";
import Payment from "../../models/Payment.js";
import {
  ABANDONED_PAYMENT_TIMEOUT_MS,
  ABANDONED_PAYMENT_JOB_INTERVAL_MS,
} from "../../config/payment.js";
import { releaseStockForOrder } from "../paymentService.js";

export async function runReleaseAbandonedPaymentsJob() {
  const cutoff = new Date(Date.now() - ABANDONED_PAYMENT_TIMEOUT_MS);

  const candidates = await Order.find({
    paymentStatus: { $in: ["pending", "failed"] },
    paymentLifecycle: {
      $in: ["PENDING_PAYMENT", "PAYMENT_PROCESSING", "PAYMENT_FAILED"],
    },
    "stockReservation.reserved": true,
    "stockReservation.committed": { $ne: true },
    "stockReservation.released": { $ne: true },
    createdAt: { $lte: cutoff },
  })
    .limit(40)
    .select("_id orderNumber paymentLifecycle paymentStatus createdAt");

  let released = 0;
  let skipped = 0;

  for (const order of candidates) {
    try {
      const paid = await Payment.findOne({
        order: order._id,
        status: "success",
      }).lean();
      if (paid) {
        skipped++;
        continue;
      }

      const result = await releaseStockForOrder(
        order._id.toString(),
        "Payment not completed within 45 minutes — stock released"
      );
      if (result.released) released++;
      else skipped++;
    } catch (err: any) {
      console.error(`[abandonJob] order ${order._id}:`, err.message || err);
    }
  }

  if (released || candidates.length) {
    console.log(
      `[abandonJob] scanned=${candidates.length} released=${released} skipped=${skipped}`
    );
  }
  return { scanned: candidates.length, released, skipped };
}

let timer: NodeJS.Timeout | null = null;

export function startAbandonedPaymentScheduler() {
  if (timer) return;
  console.log(
    `[abandonJob] scheduler started (every ${
      ABANDONED_PAYMENT_JOB_INTERVAL_MS / 1000
    }s, timeout=${ABANDONED_PAYMENT_TIMEOUT_MS / 60000}min)`
  );
  setTimeout(() => {
    runReleaseAbandonedPaymentsJob().catch(console.error);
    timer = setInterval(() => {
      runReleaseAbandonedPaymentsJob().catch(console.error);
    }, ABANDONED_PAYMENT_JOB_INTERVAL_MS);
  }, 20_000);
}
