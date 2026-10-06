import Order from "../../models/Order.js";
import {
  DELIVERY_CONFIRMATION_WINDOW_MS,
  AUTO_CONFIRM_JOB_INTERVAL_MS,
} from "../../config/payment.js";
import { markDeliveryConfirmed } from "../payoutService.js";

/**
 * Server-side 17-hour auto-confirm.
 * Runs even if buyer closes the app.
 * Skips orders with issue_reported or DISPUTED lifecycle.
 */
export async function runAutoConfirmDeliveryJob() {
  const now = new Date();

  const candidates = await Order.find({
    orderStatus: "Delivered",
    "buyerConfirmation.status": "pending",
    "buyerConfirmation.confirmationDeadline": { $lte: now },
    paymentStatus: "paid",
    paymentLifecycle: { $nin: ["DISPUTED", "REFUNDED", "REFUND_PENDING", "CANCELLED"] },
  }).limit(50);

  let confirmed = 0;
  for (const order of candidates) {
    try {
      // Re-check issue flag
      if ((order as any).buyerConfirmation?.status === "issue_reported") continue;
      if ((order as any).payout?.status === "blocked_issue") continue;

      await markDeliveryConfirmed(order._id.toString(), "auto");
      confirmed++;
    } catch (err: any) {
      console.error(
        `[autoConfirm] order ${order._id}:`,
        err.message || err
      );
    }
  }

  if (confirmed > 0) {
    console.log(`[autoConfirm] auto-confirmed ${confirmed} order(s)`);
  }
  return { scanned: candidates.length, confirmed };
}

let timer: NodeJS.Timeout | null = null;

export function startAutoConfirmDeliveryScheduler() {
  if (timer) return;
  console.log(
    `[autoConfirm] scheduler started (every ${AUTO_CONFIRM_JOB_INTERVAL_MS / 1000}s, window=${DELIVERY_CONFIRMATION_WINDOW_MS / 3600000}h)`
  );
  // Initial delay then interval
  setTimeout(() => {
    runAutoConfirmDeliveryJob().catch(console.error);
    timer = setInterval(() => {
      runAutoConfirmDeliveryJob().catch(console.error);
    }, AUTO_CONFIRM_JOB_INTERVAL_MS);
  }, 15_000);
}
