import ProductAI from "../../models/ProductAI.js";
import { refreshBuyerConfidenceForProduct } from "../plazoreAI/confidence.js";

/**
 * Daily algorithm pass — NO AI calls.
 * Recomputes Buyer Confidence from Order Confirm Delivery / Issues.
 */
export async function runDailyBuyerConfidenceRefresh() {
  const ids = await ProductAI.find({ status: "ready" })
    .select("productId")
    .lean();

  let updated = 0;
  for (const row of ids) {
    try {
      const r = await refreshBuyerConfidenceForProduct(String(row.productId));
      if (r.updated) updated += 1;
    } catch (e: any) {
      console.error(
        `[BuyerConfidence] refresh failed ${row.productId}:`,
        e?.message
      );
    }
  }

  console.log(
    `[BuyerConfidence] daily pass done — ${ids.length} products, ${updated} level/score changes`
  );
}

/** Simple in-process daily scheduler (V1). */
export function startBuyerConfidenceScheduler() {
  const DAY_MS = 24 * 60 * 60 * 1000;
  // First run a few minutes after boot, then every 24h
  setTimeout(() => {
    void runDailyBuyerConfidenceRefresh();
    setInterval(() => {
      void runDailyBuyerConfidenceRefresh();
    }, DAY_MS);
  }, 5 * 60 * 1000);
}