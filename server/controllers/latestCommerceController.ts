/**
 * Live commerce tape for the admin "Latest" desk.
 * GET /api/admin/latest?hours=1|6|24|168&kind=&q=
 *
 * Built from documents that already exist — no new collection:
 * orders (buy, pay, ship, deliver, cancel, failed pay),
 * payouts (seller got paid), products (listed),
 * carts, wishlists, and showroom cart / wishlist / purchase events.
 */
import { Request, Response } from "express";
import { type Model } from "mongoose";
import OrderModel from "../models/Order.js";
import PayoutModel from "../models/Payout.js";
import ProductModel from "../models/Products.js";
import CartModel from "../models/Cart.js";
import WishlistModel from "../models/Wishlist.js";
import ShowroomEventModel from "../models/ShowroomEvent.js";

const Order = OrderModel as Model<any>;
const Payout = PayoutModel as Model<any>;
const Product = ProductModel as Model<any>;
const Cart = CartModel as Model<any>;
const Wishlist = WishlistModel as Model<any>;
const ShowroomEvent = ShowroomEventModel as Model<any>;

export type LatestKind =
  | "bought"
  | "paid"
  | "payment_failed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "seller_paid"
  | "listed"
  | "cart"
  | "wishlist";

type LatestLink = { label: string; href: string };

type LatestEvent = {
  id: string;
  kind: LatestKind;
  at: string;
  title: string;
  summary: string;
  region?: string;
  money?: { amount: number; currency: string };
  actor?: { id?: string; name: string; email?: string; storeName?: string };
  other?: { id?: string; name: string; email?: string; storeName?: string };
  product?: { id?: string; name: string };
  order?: {
    id: string;
    number?: string;
    orderStatus?: string;
    paymentStatus?: string;
    total?: number;
    currency?: string;
  };
  links: LatestLink[];
  meta?: Record<string, string | number>;
};

const HOURS_OK = new Set([1, 6, 24, 168]);

function person(u: any) {
  if (!u || typeof u !== "object") return undefined;
  return {
    id: u._id ? String(u._id) : undefined,
    name: String(u.storeName || u.name || u.email || "User"),
    email: u.email ? String(u.email) : "",
    storeName: u.storeName ? String(u.storeName) : "",
  };
}

function productBit(p: any) {
  if (!p || typeof p !== "object") return undefined;
  return {
    id: p._id ? String(p._id) : undefined,
    name: String(p.name || p.documentName || "Product"),
  };
}

function currencyForRegion(region?: string) {
  const code = String(region || "NG").trim().toUpperCase();
  const map: Record<string, string> = {
    NG: "NGN",
    GH: "GHS",
    KE: "KES",
    ZA: "ZAR",
    EG: "EGP",
    US: "USD",
    CA: "CAD",
    GB: "GBP",
    UK: "GBP",
    DE: "EUR",
    FR: "EUR",
    AU: "AUD",
  };
  return map[code] || "USD";
}

function moneyOf(amount: unknown, currency: unknown) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return undefined;
  return { amount: n, currency: String(currency || "NGN").toUpperCase() || "NGN" };
}

function orderLinks(order: any): LatestLink[] {
  const links: LatestLink[] = [
    { label: "Orders desk", href: "/orders" },
    { label: "Payments", href: "/monetization/payments" },
  ];
  if (order?.paymentStatus === "failed" || order?.paymentStatus === "refunded") {
    links.push({ label: "Failed pay desk", href: "/monetization/failed-payments" });
  }
  if (order?.seller) {
    links.push({ label: "Merchants", href: "/merchants" });
  }
  links.push({ label: "People", href: "/users" });
  return links;
}

function push(bucket: LatestEvent[], ev: LatestEvent | null) {
  if (!ev || !ev.at) return;
  const t = new Date(ev.at).getTime();
  if (!Number.isFinite(t)) return;
  bucket.push(ev);
}

async function safe<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (e) {
    console.warn("latest feed", label, e);
    return fallback;
  }
}

export const getLatestCommerce = async (req: Request, res: Response) => {
  try {
    const hoursRaw = Number(req.query.hours || 24);
    const hours = HOURS_OK.has(hoursRaw) ? hoursRaw : 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const kind = String(req.query.kind || "all").toLowerCase();
    const q = String(req.query.q || "").trim().toLowerCase();

    const [
      placed,
      shipped,
      delivered,
      cancelled,
      failedPay,
      payouts,
      listings,
      carts,
      wishes,
      showroom,
    ] = await Promise.all([
      safe("placed", () =>
        Order.find({ createdAt: { $gte: since } })
          .sort({ createdAt: -1 })
          .limit(80)
          .populate("buyer", "name email")
          .populate("seller", "name email storeName")
          .select(
            "orderNumber orderStatus paymentStatus totalAmount currency region createdAt items buyer seller"
          )
          .lean(), []),
      safe("shipped", () =>
        Order.find({
          $or: [
            { "shipping.shippedAt": { $gte: since } },
            { orderStatus: "Shipped", updatedAt: { $gte: since } },
          ],
        })
          .sort({ updatedAt: -1 })
          .limit(60)
          .populate("buyer", "name email")
          .populate("seller", "name email storeName")
          .select(
            "orderNumber orderStatus paymentStatus totalAmount currency region shipping.shippedAt shipping.trackingNumber shipping.deliveryCompany updatedAt buyer seller"
          )
          .lean(), []),
      safe("delivered", () =>
        Order.find({ orderStatus: "Delivered", updatedAt: { $gte: since } })
          .sort({ updatedAt: -1 })
          .limit(60)
          .populate("buyer", "name email")
          .populate("seller", "name email storeName")
          .select(
            "orderNumber orderStatus paymentStatus totalAmount currency region deliveredAt updatedAt buyer seller"
          )
          .lean(), []),
      safe("cancelled", () =>
        Order.find({ orderStatus: "Cancelled", updatedAt: { $gte: since } })
          .sort({ updatedAt: -1 })
          .limit(40)
          .populate("buyer", "name email")
          .populate("seller", "name email storeName")
          .select(
            "orderNumber orderStatus paymentStatus totalAmount currency region cancellation updatedAt buyer seller"
          )
          .lean(), []),
      safe("failedPay", () =>
        Order.find({ paymentStatus: "failed", updatedAt: { $gte: since } })
          .sort({ updatedAt: -1 })
          .limit(40)
          .populate("buyer", "name email")
          .populate("seller", "name email storeName")
          .select(
            "orderNumber orderStatus paymentStatus totalAmount currency region updatedAt buyer seller"
          )
          .lean(), []),
      safe("payouts", () =>
        Payout.find({ status: "success", updatedAt: { $gte: since } })
          .sort({ updatedAt: -1 })
          .limit(60)
          .populate("seller", "name email storeName")
          .populate("order", "orderNumber")
          .select("amount currency status reference updatedAt seller order provider")
          .lean(), []),
      safe("listings", () =>
        Product.find({ createdAt: { $gte: since } })
          .sort({ createdAt: -1 })
          .limit(60)
          .populate("seller", "name email storeName")
          .select("name price region createdAt seller")
          .lean(), []),
      safe("carts", () =>
        Cart.find({ updatedAt: { $gte: since }, "items.0": { $exists: true } })
          .sort({ updatedAt: -1 })
          .limit(60)
          .populate("user", "name email")
          .populate("items.product", "name")
          .select("user items totalAmount updatedAt")
          .lean(), []),
      safe("wishes", () =>
        Wishlist.find({ updatedAt: { $gte: since }, "products.0": { $exists: true } })
          .sort({ updatedAt: -1 })
          .limit(60)
          .populate("user", "name email")
          .populate("products", "name")
          .select("user products updatedAt")
          .lean(), []),
      safe("showroom", () =>
        ShowroomEvent.find({
          createdAt: { $gte: since },
          type: { $in: ["cart", "wishlist", "purchase"] },
        })
          .sort({ createdAt: -1 })
          .limit(120)
          .populate("user", "name email")
          .populate("product", "name")
          .select("type user product region createdAt")
          .lean(), []),
    ]);

    const events: LatestEvent[] = [];

    for (const o of placed as any[]) {
      const buyer = person(o.buyer);
      const seller = person(o.seller);
      const itemName = o.items?.[0]?.name || o.items?.[0]?.productName || "an order";
      const paid = o.paymentStatus === "paid";
      push(events, {
        id: `bought:${o._id}`,
        kind: "bought",
        at: new Date(o.createdAt).toISOString(),
        title: paid ? "Buyer paid for an order" : "New order placed",
        summary: `${buyer?.name || "A buyer"} ordered from ${seller?.storeName || seller?.name || "a seller"}.`,
        region: o.region,
        money: moneyOf(o.totalAmount, o.currency),
        actor: buyer,
        other: seller,
        product: itemName ? { name: String(itemName) } : undefined,
        order: {
          id: String(o._id),
          number: o.orderNumber,
          orderStatus: o.orderStatus,
          paymentStatus: o.paymentStatus,
          total: o.totalAmount,
          currency: o.currency,
        },
        links: orderLinks(o),
        meta: { items: Array.isArray(o.items) ? o.items.length : 0 },
      });
      if (paid) {
        push(events, {
          id: `paid:${o._id}`,
          kind: "paid",
          at: new Date(o.createdAt).toISOString(),
          title: "Buyer payment captured",
          summary: `${buyer?.name || "Buyer"} payment is paid on ${o.orderNumber || "this order"}.`,
          region: o.region,
          money: moneyOf(o.totalAmount, o.currency),
          actor: buyer,
          other: seller,
          order: {
            id: String(o._id),
            number: o.orderNumber,
            orderStatus: o.orderStatus,
            paymentStatus: o.paymentStatus,
            total: o.totalAmount,
            currency: o.currency,
          },
          links: orderLinks(o),
        });
      }
    }

    for (const o of shipped as any[]) {
      const at = o.shipping?.shippedAt || o.updatedAt;
      if (!at || new Date(at) < since) continue;
      const seller = person(o.seller);
      push(events, {
        id: `shipped:${o._id}`,
        kind: "shipped",
        at: new Date(at).toISOString(),
        title: "Seller shipped an order",
        summary: `${seller?.storeName || seller?.name || "Seller"} marked ${o.orderNumber || "an order"} as shipped${o.shipping?.trackingNumber ? ` · ${o.shipping.trackingNumber}` : ""}.`,
        region: o.region,
        money: moneyOf(o.totalAmount, o.currency),
        actor: seller,
        other: person(o.buyer),
        order: {
          id: String(o._id),
          number: o.orderNumber,
          orderStatus: o.orderStatus,
          paymentStatus: o.paymentStatus,
          total: o.totalAmount,
          currency: o.currency,
        },
        links: orderLinks(o),
        meta: {
          carrier: o.shipping?.deliveryCompany || "",
          tracking: o.shipping?.trackingNumber || "",
        },
      });
    }

    for (const o of delivered as any[]) {
      const at = o.deliveredAt || o.updatedAt;
      push(events, {
        id: `delivered:${o._id}`,
        kind: "delivered",
        at: new Date(at).toISOString(),
        title: "Order delivered",
        summary: `${o.orderNumber || "Order"} is delivered. Buyer can confirm so the seller can be paid.`,
        region: o.region,
        money: moneyOf(o.totalAmount, o.currency),
        actor: person(o.buyer),
        other: person(o.seller),
        order: {
          id: String(o._id),
          number: o.orderNumber,
          orderStatus: o.orderStatus,
          paymentStatus: o.paymentStatus,
          total: o.totalAmount,
          currency: o.currency,
        },
        links: [
          ...orderLinks(o),
          { label: "Revenue", href: "/monetization/revenue" },
        ],
      });
    }

    for (const o of cancelled as any[]) {
      const at = o.cancellation?.cancelledAt || o.updatedAt;
      push(events, {
        id: `cancelled:${o._id}`,
        kind: "cancelled",
        at: new Date(at).toISOString(),
        title: "Order cancelled",
        summary: `${o.orderNumber || "Order"} was cancelled${o.cancellation?.cancelledBy ? ` by ${o.cancellation.cancelledBy}` : ""}.`,
        region: o.region,
        money: moneyOf(o.totalAmount, o.currency),
        actor: person(o.buyer),
        other: person(o.seller),
        order: {
          id: String(o._id),
          number: o.orderNumber,
          orderStatus: o.orderStatus,
          paymentStatus: o.paymentStatus,
        },
        links: orderLinks(o),
        meta: { reason: o.cancellation?.reasonLabel || o.cancellation?.reasonCode || "" },
      });
    }

    for (const o of failedPay as any[]) {
      push(events, {
        id: `payfail:${o._id}`,
        kind: "payment_failed",
        at: new Date(o.updatedAt).toISOString(),
        title: "Buyer payment failed",
        summary: `Charge failed on ${o.orderNumber || "an order"}.`,
        region: o.region,
        money: moneyOf(o.totalAmount, o.currency),
        actor: person(o.buyer),
        other: person(o.seller),
        order: {
          id: String(o._id),
          number: o.orderNumber,
          orderStatus: o.orderStatus,
          paymentStatus: o.paymentStatus,
          total: o.totalAmount,
          currency: o.currency,
        },
        links: orderLinks(o),
      });
    }

    for (const p of payouts as any[]) {
      const seller = person(p.seller);
      const number = p.order?.orderNumber || "";
      push(events, {
        id: `payout:${p._id}`,
        kind: "seller_paid",
        at: new Date(p.updatedAt).toISOString(),
        title: "Seller got paid",
        summary: `${seller?.storeName || seller?.name || "Seller"} received a payout${number ? ` for ${number}` : ""}.`,
        money: moneyOf(p.amount, p.currency),
        actor: seller,
        order: p.order?._id
          ? {
              id: String(p.order._id),
              number,
            }
          : undefined,
        links: [
          { label: "Payments", href: "/monetization/payments" },
          { label: "Revenue", href: "/monetization/revenue" },
          { label: "Merchants", href: "/merchants" },
          { label: "Orders desk", href: "/orders" },
        ],
        meta: { provider: p.provider || "", reference: p.reference || "" },
      });
    }

    for (const prod of listings as any[]) {
      const seller = person(prod.seller);
      push(events, {
        id: `listed:${prod._id}`,
        kind: "listed",
        at: new Date(prod.createdAt).toISOString(),
        title: "Seller listed a product",
        summary: `${seller?.storeName || seller?.name || "A seller"} listed ${prod.name || "a product"}.`,
        region: prod.region,
        money: moneyOf(prod.price, currencyForRegion(prod.region)),
        actor: seller,
        product: productBit(prod),
        links: [
          { label: "Catalog", href: "/products" },
          { label: "Merchants", href: "/merchants" },
          { label: "Showroom", href: "/showroom" },
        ],
      });
    }

    for (const c of carts as any[]) {
      const who = person(c.user);
      const first = c.items?.[0]?.product;
      const n = Array.isArray(c.items) ? c.items.length : 0;
      push(events, {
        id: `cart:${c._id}:${new Date(c.updatedAt).getTime()}`,
        kind: "cart",
        at: new Date(c.updatedAt).toISOString(),
        title: "Bag updated",
        summary: `${who?.name || "A shopper"} has ${n} item${n === 1 ? "" : "s"} in bag${first?.name ? ` · ${first.name}` : ""}.`,
        money: moneyOf(c.totalAmount, undefined),
        actor: who,
        product: productBit(first),
        links: [
          { label: "Catalog", href: "/products" },
          { label: "People", href: "/users" },
          { label: "Showroom", href: "/showroom" },
        ],
        meta: { items: n },
      });
    }

    for (const w of wishes as any[]) {
      const who = person(w.user);
      const products = Array.isArray(w.products) ? w.products : [];
      const last = products[products.length - 1];
      push(events, {
        id: `wishdoc:${w._id}:${new Date(w.updatedAt).getTime()}`,
        kind: "wishlist",
        at: new Date(w.updatedAt).toISOString(),
        title: "Wishlist updated",
        summary: `${who?.name || "A shopper"} saved ${products.length} product${products.length === 1 ? "" : "s"}${last?.name ? ` · latest ${last.name}` : ""}.`,
        actor: who,
        product: productBit(last),
        links: [
          { label: "Catalog", href: "/products" },
          { label: "People", href: "/users" },
        ],
        meta: { saved: products.length },
      });
    }

    for (const e of showroom as any[]) {
      const who = person(e.user) || { name: "Guest", email: "" };
      const prod = productBit(e.product);
      const map: Record<string, { kind: LatestKind; title: string; verb: string }> = {
        cart: { kind: "cart", title: "Added to cart", verb: "added to cart" },
        wishlist: { kind: "wishlist", title: "Added to wishlist", verb: "saved" },
        purchase: { kind: "bought", title: "Showroom purchase", verb: "purchased" },
      };
      const spec = map[e.type];
      if (!spec) continue;
      push(events, {
        id: `showroom:${e._id}`,
        kind: spec.kind,
        at: new Date(e.createdAt).toISOString(),
        title: spec.title,
        summary: `${who.name} ${spec.verb} ${prod?.name || "a product"} in the showroom.`,
        region: e.region,
        actor: who,
        product: prod,
        links: [
          { label: "Showroom", href: "/showroom" },
          { label: "Catalog", href: "/products" },
          { label: "People", href: "/users" },
        ],
        meta: { source: "showroom" },
      });
    }

    events.sort((a, b) => +new Date(b.at) - +new Date(a.at));

    const counts: Record<string, number> = { all: events.length };
    for (const ev of events) counts[ev.kind] = (counts[ev.kind] || 0) + 1;

    let items = events;
    if (kind && kind !== "all") items = items.filter((e) => e.kind === kind);
    if (q) {
      items = items.filter((e) => {
        const blob = [
          e.title,
          e.summary,
          e.actor?.name,
          e.actor?.email,
          e.actor?.storeName,
          e.other?.name,
          e.other?.storeName,
          e.product?.name,
          e.order?.number,
          e.region,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
    }

    return res.json({
      success: true,
      data: {
        items: items.slice(0, 120),
        counts,
        windowHours: hours,
        serverTime: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("getLatestCommerce:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to load latest commerce",
    });
  }
};
