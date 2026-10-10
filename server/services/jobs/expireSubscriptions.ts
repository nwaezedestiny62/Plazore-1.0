/**
 * Background job: expire overdue seller subscriptions.
 * Call startSubscriptionExpiryScheduler() from server.ts after listen().
 */

import { expireOverdueSubscriptions } from "../subscriptionService.js";

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

let timer: ReturnType<typeof setInterval> | null = null;

export function startSubscriptionExpiryScheduler() {
  if (timer) return;
  // Run once shortly after boot
  setTimeout(() => {
    expireOverdueSubscriptions(200).catch((e) =>
      console.error("[expireSubscriptions]", e)
    );
  }, 20_000);

  timer = setInterval(() => {
    expireOverdueSubscriptions(200).catch((e) =>
      console.error("[expireSubscriptions]", e)
    );
  }, INTERVAL_MS);

  console.log("[expireSubscriptions] scheduler started (every 15m)");
}

export function stopSubscriptionExpiryScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
