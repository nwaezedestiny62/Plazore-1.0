import Product from "../models/Products.js";
import ProductPerformance from "../models/ProductPerformance.js";

export type PerfAction = "view" | "cart" | "purchase";

const WEIGHT: Record<PerfAction, number> = {
  view: 1,
  cart: 5,
  purchase: 15,
};

/** true while testing; set to false later so sellers don't count on their own products */
export const ALLOW_SELLER_SELF_TRACKING = true;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function trackProductPerformance(opts: {
  productId: string;
  action: PerfAction;
  actorUserId?: string | null;
  quantity?: number;
}) {
  try {
    const { productId, action, actorUserId } = opts;
    const qty = Math.max(1, Number(opts.quantity) || 1);

    const product = await Product.findById(productId).select("seller").lean();
    if (!product || !product.seller) return null;

    const sellerId = String(product.seller);

    if (
      !ALLOW_SELLER_SELF_TRACKING &&
      actorUserId &&
      actorUserId === sellerId
    ) {
      return null;
    }

    const points = WEIGHT[action] * (action === "purchase" ? qty : 1);
    const day = todayKey();

    let doc = await ProductPerformance.findOne({ product: productId });

    if (!doc) {
      doc = new ProductPerformance({
        product: productId,
        seller: sellerId,
        views: 0,
        cartAdds: 0,
        purchases: 0,
        score: 0,
        daily: [],
        milestones: {
          p200: false,
          p500: false,
          p1000: false,
          p2500: false,
          p5000: false,
        },
      });
    }

    if (action === "view") doc.views += 1;
    if (action === "cart") doc.cartAdds += 1;
    if (action === "purchase") doc.purchases += qty;
    doc.score += points;

    // Find or create today's row
    const daily = doc.daily as Array<{
      date: string;
      views: number;
      cartAdds: number;
      purchases: number;
      score: number;
    }>;

    let dayRow = daily.find((d) => d.date === day);
    if (!dayRow) {
      dayRow = {
        date: day,
        views: 0,
        cartAdds: 0,
        purchases: 0,
        score: 0,
      };
      daily.push(dayRow);
    }

    if (action === "view") dayRow.views += 1;
    if (action === "cart") dayRow.cartAdds += 1;
    if (action === "purchase") dayRow.purchases += qty;
    dayRow.score += points;

    // Keep ~90 days
    if (daily.length > 90) {
      doc.daily = daily.slice(-90) as any;
    }

    // Milestones (never stop counting past them)
        // Milestones (never stop counting past them)
    if (!doc.milestones) {
      doc.milestones = {
        p200: false,
        p500: false,
        p1000: false,
        p2500: false,
        p5000: false,
      } as any;
    }

    const m = doc.milestones as {
      p200?: boolean;
      p500?: boolean;
      p1000?: boolean;
      p2500?: boolean;
      p5000?: boolean;
    };

    if (doc.score >= 200) m.p200 = true;
    if (doc.score >= 500) m.p500 = true;
    if (doc.score >= 1000) m.p1000 = true;
    if (doc.score >= 2500) m.p2500 = true;
    if (doc.score >= 5000) m.p5000 = true;

    doc.milestones = m as any;
    doc.markModified("milestones");

    await doc.save();
    return doc;
  } catch (err) {
    console.error("trackProductPerformance error:", err);
    return null;
  }
}