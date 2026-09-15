"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useMarketplace } from "@/context/MarketplaceContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  Check,
  ChevronLeft,
  CreditCard,
  Globe2,
  Home,
  MapPin,
  Navigation,
  Plus,
  Receipt,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import { clearCart, getCart, type CartItem } from "@/lib/cart";
import {
  convertPrice,
  DEFAULT_REGION,
  formatMoney,
  formatProductPrice,
} from "@/lib/regions";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#2563EB)";

type Address = {
  _id: string;
  type?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  isDefault?: boolean;
};

type Card = {
  _id: string;
  brand?: string;
  last4?: string;
  expMonth?: string | number;
  expYear?: string | number;
  name?: string;
  isDefault?: boolean;
};

type Phase = "idle" | "processing" | "success" | "error";
type Toast = {
  title: string;
  message?: string;
  tone?: "info" | "success" | "danger";
} | null;

type ShipFrom = {
  label: string;
  country: string;
  hasShipFrom: boolean;
  storeName: string;
  sellerId: string;
};

type RouteGroup = {
  key: string;
  ship: ShipFrom;
  items: CartItem[];
  productSubtotalDisplay: number;
  deliveryFeeDisplay: number;
  isInternational: boolean;
  missingShipFrom: boolean;
  invalidItems: string[];
};

function productRegion(product: CartItem["product"]) {
  if (product?.region) return String(product.region);
  return DEFAULT_REGION;
}

function locationLabel(parts: {
  city?: string;
  state?: string;
  country?: string;
}) {
  const city = (parts.city || "").trim();
  const state = (parts.state || "").trim();
  const country = (parts.country || "").trim();
  const left = city || state;
  if (left && country) return `${left}, ${country}`;
  return left || country || "";
}

function normCountry(c?: string) {
  return (c || "").trim().toLowerCase();
}

function resolveShipFrom(product: CartItem["product"]): ShipFrom {
  const seller = product?.seller;
  const sellerObj = seller && typeof seller === "object" ? seller : null;
  const sellerId =
    sellerObj && "_id" in sellerObj
      ? String((sellerObj as { _id?: string })._id || "")
      : typeof seller === "string"
        ? seller
        : "";
  const storeName =
    (sellerObj as { storeName?: string; name?: string } | null)?.storeName ||
    (sellerObj as { name?: string } | null)?.name ||
    "Seller";
  const fl = product?.fulfillmentLocation;
  if (fl && (fl.city || fl.state) && fl.country) {
    return {
      label:
        fl.displayLabel ||
        locationLabel({ city: fl.city, state: fl.state, country: fl.country }),
      country: String(fl.country || "").trim(),
      hasShipFrom: true,
      storeName,
      sellerId,
    };
  }
  return {
    label: "Shipping origin not set",
    country: "",
    hasShipFrom: false,
    storeName,
    sellerId,
  };
}

function maskCard(last4?: string) {
  return last4 ? `•••• ${last4}` : "••••";
}

function addressComplete(a: Address | null): boolean {
  if (!a) return false;
  return !!(
    (a.street || "").trim() &&
    (a.city || "").trim() &&
    (a.country || "").trim()
  );
}

async function apiAuth<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: T }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  let body = {} as T;
  try {
    body = (await res.json()) as T;
  } catch {
    /* non-JSON */
  }
  return { ok: res.ok, status: res.status, body };
}

export default function CheckoutPage() {
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const { region: marketplaceRegion } = useMarketplace();
  const displayRegion = marketplaceRegion || DEFAULT_REGION;

  const [items, setItems] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [orderError, setOrderError] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const placingLock = useRef(false);

  useEffect(() => {
    const bag = getCart();
    setItems(Array.isArray(bag) ? bag : []);
    setCartReady(true);
  }, []);

  const loadExtras = useCallback(async () => {
    if (!isSignedIn) return;
    const token = await getToken();
    if (!token) return;
    try {
      const addr = await apiAuth<{ success?: boolean; data?: Address[] }>(
        "/addresses",
        token,
      );
      if (addr.body?.success && Array.isArray(addr.body.data)) {
        const list = addr.body.data;
        setAddresses(list);
        setSelectedAddress(
          list.find((a) => a.isDefault) || list[0] || null,
        );
      }
    } catch {
      /* keep empty */
    }
    try {
      const pay = await apiAuth<{ success?: boolean; data?: Card[] }>(
        "/payment-methods",
        token,
      );
      if (pay.body?.success && Array.isArray(pay.body.data)) {
        const list = pay.body.data;
        setCards(list);
        setSelectedCard(list.find((c) => c.isDefault) || list[0] || null);
      }
    } catch {
      /* keep empty */
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  const fmt = (n: number) => formatMoney(n, displayRegion);
  const fmtProduct = (n: number, region?: string | null) =>
    formatProductPrice(n, region, displayRegion);

  /** Group bag by seller route + money in display currency */
  const routeGroups: RouteGroup[] = useMemo(() => {
    const map = new Map<string, RouteGroup>();

    for (const item of items) {
      const product = item.product;
      if (!product) continue;

      const ship = resolveShipFrom(product);
      const key = ship.sellerId || `anon-${ship.storeName}`;
      const region = productRegion(product);
      const unit = Number(item.price ?? product.price) || 0;
      const qty = Math.max(1, Number(item.quantity) || 1);
      const lineDisplay = convertPrice(unit * qty, region, displayRegion);
      const feeRaw = Number(product.shipping?.deliveryFee) || 0;
      const feeDisplay = convertPrice(feeRaw, region, displayRegion);

      const invalid: string[] = [];
      if (!product._id) invalid.push("Missing product id");
      if (!(unit > 0)) invalid.push("Invalid price");
      if (!ship.hasShipFrom) invalid.push("No ship-from location");

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          ship,
          items: [item],
          productSubtotalDisplay: lineDisplay,
          deliveryFeeDisplay: feeDisplay,
          isInternational: false,
          missingShipFrom: !ship.hasShipFrom,
          invalidItems: invalid,
        });
      } else {
        existing.items.push(item);
        existing.productSubtotalDisplay += lineDisplay;
        // One delivery fee per seller route (max listed fee on their lines)
        existing.deliveryFeeDisplay = Math.max(
          existing.deliveryFeeDisplay,
          feeDisplay,
        );
        existing.missingShipFrom =
          existing.missingShipFrom || !ship.hasShipFrom;
        existing.invalidItems = [
          ...new Set([...existing.invalidItems, ...invalid]),
        ];
      }
    }

    const destCountry = normCountry(selectedAddress?.country);
    for (const g of map.values()) {
      const origin = normCountry(g.ship.country);
      g.isInternational = !!(
        g.ship.hasShipFrom &&
        origin &&
        destCountry &&
        origin !== destCountry
      );
    }

    return Array.from(map.values());
  }, [items, displayRegion, selectedAddress?.country]);

  const { productPrice, deliveryFee, totalAmount } = useMemo(() => {
    let products = 0;
    let fees = 0;
    for (const g of routeGroups) {
      products += g.productSubtotalDisplay;
      fees += g.deliveryFeeDisplay;
    }
    return {
      productPrice: products,
      deliveryFee: fees,
      totalAmount: products + fees,
    };
  }, [routeGroups]);

  const itemCount = items.reduce((n, i) => n + (Number(i.quantity) || 0), 0);
  const hasItems = cartReady && items.length > 0;

  const allRoutesShipReady =
    routeGroups.length > 0 && routeGroups.every((g) => !g.missingShipFrom);
  const noInvalidLines = routeGroups.every((g) => g.invalidItems.length === 0);
  const addressOk = addressComplete(selectedAddress);
  const cardOk = !!selectedCard?._id;

  const internationalRoutes = routeGroups.filter((g) => g.isInternational);
  const hasInternational = internationalRoutes.length > 0;
  const incompleteSellers = routeGroups.filter((g) => g.missingShipFrom);

  /** Hard gate: nothing places without a real bag + valid routes + address + card + auth */
  const canPlaceOrder =
    hasItems &&
    allRoutesShipReady &&
    noInvalidLines &&
    addressOk &&
    cardOk &&
    !!isSignedIn;

  const blockReason = useMemo(() => {
    if (!hasItems) return "Your bag is empty. Add products before checkout.";
    if (!isSignedIn) return "Sign in to place an order on Plazore.";
    if (!allRoutesShipReady)
      return "One or more sellers have not set a shipping origin. Checkout is blocked until they complete it.";
    if (!noInvalidLines)
      return "One or more items have invalid price or product data. Remove them or try again later.";
    if (!addressOk) return "Select a complete delivery address (street, city, country).";
    if (!cardOk) return "Select a payment card.";
    return null;
  }, [
    hasItems,
    isSignedIn,
    allRoutesShipReady,
    noInvalidLines,
    addressOk,
    cardOk,
  ]);

  const deliverToLabel = selectedAddress
    ? locationLabel({
        city: selectedAddress.city,
        state: selectedAddress.state,
        country: selectedAddress.country,
      })
    : "";

  const placeOrder = async () => {
    if (placingLock.current || phase === "processing") return;

    if (!hasItems) {
      setToast({
        title: "Empty bag",
        message: "There is nothing to checkout.",
        tone: "danger",
      });
      return;
    }
    if (!canPlaceOrder) {
      setToast({
        title: "Cannot place order",
        message: blockReason || "Complete all required steps first.",
        tone: "danger",
      });
      return;
    }

    placingLock.current = true;
    setOrderError("");
    setPhase("processing");

    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in required");

      const payloadItems = items
        .map((item) => {
          const id = item.product?._id;
          const qty = Math.max(1, Number(item.quantity) || 1);
          const price = Number(item.price ?? item.product?.price) || 0;
          return {
            productId: id,
            quantity: qty,
            price,
            note: (item.note || "").trim().slice(0, 120),
          };
        })
        .filter((i) => i.productId && i.price > 0 && i.quantity > 0);

      if (!payloadItems.length) {
        throw new Error("No valid products in bag");
      }

      if (!selectedAddress || !addressComplete(selectedAddress)) {
        throw new Error("Delivery address is incomplete");
      }

      const res = await apiAuth<{ success?: boolean; message?: string }>(
        "/orders",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            shippingAddress: {
              street: selectedAddress.street,
              city: selectedAddress.city,
              state: selectedAddress.state,
              zipCode: selectedAddress.zipCode,
              country: selectedAddress.country,
            },
            paymentMethodId: selectedCard?._id,
            buyerNote: hasInternational
              ? "International shipment — seller review may apply."
              : "",
            items: payloadItems,
          }),
        },
      );

      if (res.ok && res.body?.success) {
        clearCart();
        setItems([]);
        setPhase("success");
      } else {
        setPhase("error");
        setOrderError(
          res.body?.message ||
            (res.status === 401
              ? "Session expired. Sign in again."
              : res.status >= 500
                ? "Server error. Please try again in a moment."
                : "Could not place order. Please review your bag and try again."),
        );
      }
    } catch (e: unknown) {
      setPhase("error");
      setOrderError(
        e instanceof Error ? e.message : "Something went wrong. Please try again.",
      );
    } finally {
      placingLock.current = false;
    }
  };

  const placing = phase === "processing";

  /* ── Empty bag: hard stop UI ── */
  if (cartReady && !hasItems && phase === "idle") {
    return (
      <div className="min-h-screen bg-bg text-text">
        <header className="flex items-center px-2 py-2.5 md:px-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center border border-white/8 bg-[#0E1116]"
            aria-label="Back"
          >
            <ChevronLeft className="h-[22px] w-[22px]" />
          </button>
          <p className="flex-1 text-center text-[17px] font-extrabold tracking-tight">
            Checkout
          </p>
          <span className="w-11" />
        </header>
        <div
          className="mx-4 h-px md:mx-6"
          style={{
            background:
              "linear-gradient(90deg,transparent,rgba(0,229,117,0.4),rgba(37,99,235,0.3),transparent)",
          }}
        />
        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
          <span className="flex h-16 w-16 items-center justify-center border border-white/10 bg-[#0E1116]">
            <ShoppingBag className="h-7 w-7 text-white/40" />
          </span>
          <p className="mt-6 text-lg font-extrabold">Your bag is empty</p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/50">
            Checkout is only available when there is at least one product in
            your bag. Nothing can be ordered from this page until you add items.
          </p>
          <Link
            href="/"
            className="mt-8 flex h-12 w-full max-w-xs items-center justify-center gap-2 text-[14px] font-extrabold text-[#041412]"
            style={{ backgroundImage: GRAD }}
          >
            Go to Showroom
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      {toast && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-lg overflow-hidden border border-white/8 bg-[#0E1116]">
          <span
            className={`w-[3px] ${
              toast.tone === "danger"
                ? "bg-red-500"
                : toast.tone === "success"
                  ? "bg-green"
                  : "bg-blue"
            }`}
          />
          <div className="flex-1 p-3">
            <p className="text-sm font-bold">{toast.title}</p>
            {toast.message && (
              <p className="mt-1 text-[12.5px] leading-[17px] text-white/55">
                {toast.message}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-2.5 text-white/38"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {(phase === "processing" || phase === "success" || phase === "error") && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-bg/94 p-5">
          <div className="w-full max-w-md border border-white/8 bg-[#0E1116] p-8 text-center">
            {phase === "processing" && (
              <>
                <div className="mx-auto h-[110px] w-[110px] animate-spin rounded-full border-[2.4px] border-transparent border-l-green border-r-blue border-t-green" />
                <p className="mt-6 text-lg font-extrabold">Placing your order</p>
                <p className="mt-2 text-[13px] text-white/55">
                  Securing your bag and confirming with{" "}
                  {routeGroups.length > 1
                    ? `${routeGroups.length} sellers`
                    : "the seller"}
                  …
                </p>
              </>
            )}
            {phase === "error" && (
              <>
                <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center border border-red-500/25 bg-red-500/12">
                  <X className="h-8 w-8 text-red-500" />
                </div>
                <p className="mt-6 text-lg font-extrabold">Order failed</p>
                <p className="mt-2 text-[13px] text-white/55">
                  {orderError || "Something went wrong. Please try again."}
                </p>
                <button
                  type="button"
                  onClick={() => setPhase("idle")}
                  className="mt-6 border border-white/8 bg-[#14181F] px-6 py-3 text-sm font-bold"
                >
                  Try again
                </button>
              </>
            )}
            {phase === "success" && (
              <>
                <div
                  className="mx-auto flex h-[72px] w-[72px] items-center justify-center"
                  style={{
                    backgroundImage: "linear-gradient(135deg,#00E575,#2563EB)",
                  }}
                >
                  <Check className="h-9 w-9 text-[#041412]" />
                </div>
                <p className="mt-4 text-[22px] font-extrabold tracking-tight">
                  Order Successful
                </p>
                <p className="mt-1.5 text-[13px] text-white/55">
                  Your order is confirmed on Plazore.
                </p>
                <div className="mt-5 w-full border border-white/8 bg-[#14181F] p-3.5 text-left">
                  <p className="mb-2.5 text-[10px] font-extrabold tracking-[0.14em] text-white/38">
                    HOW YOUR ORDER WORKS
                  </p>
                  {[
                    [
                      "1",
                      "Confirmed",
                      "Your bag is locked and each seller is notified for their items.",
                    ],
                    [
                      "2",
                      "Seller prepares",
                      "Items are packed. International routes may need a short seller review first.",
                    ],
                    [
                      "3",
                      "Shipped",
                      "Tracking updates appear in Orders as each package moves.",
                    ],
                    [
                      "4",
                      "Delivered",
                      "You receive your order at the address you selected.",
                    ],
                  ].map(([n, t, d]) => (
                    <div key={n} className="mb-3 flex gap-3">
                      <span
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-extrabold text-[#041412]"
                        style={{ backgroundImage: GRAD }}
                      >
                        {n}
                      </span>
                      <span>
                        <span className="block text-[13px] font-bold">{t}</span>
                        <span className="mt-0.5 block text-xs leading-[17px] text-white/55">
                          {d}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/orders"
                  className="mt-4 flex w-full items-center justify-center gap-2 py-3.5 text-[15px] font-extrabold text-[#041412]"
                  style={{ backgroundImage: GRAD }}
                >
                  View Order <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/"
                  className="mt-3 block w-full border border-white/8 bg-[#14181F] py-3 text-sm font-semibold"
                >
                  Go back to Showroom
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      <header className="flex items-center px-2 py-2.5 md:px-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center border border-white/8 bg-[#0E1116]"
          aria-label="Back"
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <p className="flex-1 text-center text-[17px] font-extrabold tracking-tight">
          Checkout
        </p>
        <span className="w-11" />
      </header>
      <div
        className="mx-4 h-px md:mx-6"
        style={{
          background:
            "linear-gradient(90deg,transparent,rgba(0,229,117,0.4),rgba(37,99,235,0.3),transparent)",
        }}
      />

      <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-32 pt-4 md:grid-cols-[1fr_340px] md:px-6 md:pb-10">
        <div>
          <p className="mb-3.5 text-[11px] font-bold tracking-[0.16em] text-white/38">
            REVIEW · DELIVER · PAY
          </p>

          {/* ── Bag grouped by seller ── */}
          <section className="mb-3 overflow-hidden border border-white/8 bg-[#0E1116]">
            <div className="flex items-center justify-between border-b border-white/8 bg-[#14181F] px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-[30px] w-[30px] items-center justify-center border border-white/8 bg-[#0E1116]">
                  <ShoppingBag className="h-3.5 w-3.5 text-white/55" />
                </span>
                <p className="text-sm font-extrabold">Your Bag</p>
              </div>
              <p className="text-xs font-semibold text-white/55">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
                {routeGroups.length > 1
                  ? ` · ${routeGroups.length} sellers`
                  : ""}
              </p>
            </div>

            {routeGroups.map((group) => (
              <div
                key={group.key}
                className="border-b border-white/8 last:border-b-0"
              >
                <div className="flex items-center gap-2 bg-[#14181F]/80 px-3.5 py-2">
                  <Store className="h-3.5 w-3.5 text-white/45" />
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-white/55">
                    {group.ship.storeName}
                  </p>
                  {group.isInternational && (
                    <span className="ml-auto flex items-center gap-1 border border-blue/30 bg-blue/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-300">
                      <Globe2 className="h-3 w-3" />
                      International
                    </span>
                  )}
                  {group.missingShipFrom && (
                    <span className="ml-auto border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-400">
                      No ship-from
                    </span>
                  )}
                </div>
                {group.items.map((item, i) => {
                  const region = productRegion(item.product);
                  const unit =
                    Number(item.price ?? item.product?.price) || 0;
                  const qty = Number(item.quantity) || 1;
                  return (
                    <div
                      key={item.id || `${group.key}-${i}`}
                      className="flex items-center border-t border-white/[0.04] px-3.5 py-3"
                    >
                      {item.product?.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.product.images[0]}
                          alt=""
                          className="h-14 w-14 bg-[#14181F] object-cover"
                        />
                      ) : (
                        <div className="h-14 w-14 bg-[#14181F]" />
                      )}
                      <div className="ml-3 min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-[18px]">
                          {item.product?.name || "Product"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-white/55">
                          Qty {qty} · {fmtProduct(unit, region)} each
                        </p>
                        <p className="text-[10px] text-white/35">
                          Listed in {region} · shown in your marketplace
                          currency
                        </p>
                      </div>
                      <p className="ml-2 text-[13px] font-bold">
                        {fmtProduct(unit * qty, region)}
                      </p>
                    </div>
                  );
                })}
                <div className="flex justify-between border-t border-white/[0.06] bg-[#0A0C10] px-3.5 py-2 text-[11px]">
                  <span className="text-white/40">
                    Route subtotal · delivery{" "}
                    {fmt(group.deliveryFeeDisplay)}
                  </span>
                  <span className="font-bold text-white/70">
                    {fmt(
                      group.productSubtotalDisplay + group.deliveryFeeDisplay,
                    )}
                  </span>
                </div>
              </div>
            ))}
          </section>

          {/* ── Address ── */}
          <section className="mb-3 overflow-hidden border border-white/8 bg-[#0E1116]">
            <div className="flex items-center justify-between border-b border-white/8 bg-[#14181F] px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-[30px] w-[30px] items-center justify-center border border-white/8 bg-[#0E1116]">
                  <Home className="h-3.5 w-3.5 text-white/55" />
                </span>
                <p className="text-sm font-extrabold">Deliver To</p>
              </div>
              <Link
                href="/addresses"
                className="text-[13px] font-bold text-green"
              >
                Change
              </Link>
            </div>
            {addresses.length > 0 ? (
              <div className="space-y-2 p-3">
                {addresses.map((addr) => {
                  const on = selectedAddress?._id === addr._id;
                  return (
                    <button
                      key={addr._id}
                      type="button"
                      onClick={() => setSelectedAddress(addr)}
                      className={`flex w-full gap-3 border p-3 text-left ${
                        on ? "border-green/50 bg-[#14181F]" : "border-white/8"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-[18px] w-[18px] items-center justify-center border-2 ${
                          on ? "border-green" : "border-white/38"
                        }`}
                      >
                        {on && <span className="h-2 w-2 bg-green" />}
                      </span>
                      <span>
                        <span className="flex items-center gap-2">
                          <span className="text-[13px] font-bold">
                            {addr.type || "Address"}
                          </span>
                          {addr.isDefault && (
                            <span className="border border-white/8 px-1.5 py-0.5 text-[10px] text-white/55">
                              Default
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-[18px] text-white/55">
                          {addr.street}
                          <br />
                          {addr.city}
                          {addr.state ? `, ${addr.state}` : ""} {addr.zipCode}
                          <br />
                          {addr.country}
                        </span>
                      </span>
                    </button>
                  );
                })}
                <Link
                  href="/addresses"
                  className="flex items-center justify-center gap-1.5 border border-white/8 bg-[#14181F] py-3 text-[13px] font-bold text-green"
                >
                  <Plus className="h-4 w-4" /> Add new address
                </Link>
              </div>
            ) : (
              <Link
                href={isSignedIn ? "/addresses" : "/sign-in"}
                className="block py-7 text-center"
              >
                <MapPin className="mx-auto mb-3 h-6 w-6 text-white/38" />
                <p className="text-sm font-bold">Add delivery address</p>
                <p className="mt-1 text-xs text-white/38">
                  Street, city and country are required to place an order.
                </p>
              </Link>
            )}
          </section>

          {/* ── Payment ── */}
          <section className="mb-3 overflow-hidden border border-white/8 bg-[#0E1116]">
            <div className="flex items-center justify-between border-b border-white/8 bg-[#14181F] px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-[30px] w-[30px] items-center justify-center border border-white/8 bg-[#0E1116]">
                  <CreditCard className="h-3.5 w-3.5 text-white/55" />
                </span>
                <p className="text-sm font-extrabold">Pay with Card</p>
              </div>
              <Link
                href="/payment-methods"
                className="text-[13px] font-bold text-green"
              >
                Change
              </Link>
            </div>
            {cards.length > 0 ? (
              <div className="space-y-2 p-3">
                {cards.map((card) => {
                  const on = selectedCard?._id === card._id;
                  return (
                    <button
                      key={card._id}
                      type="button"
                      onClick={() => setSelectedCard(card)}
                      className={`flex w-full gap-3 border p-3 text-left ${
                        on ? "border-green/50 bg-[#14181F]" : "border-white/8"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-[18px] w-[18px] items-center justify-center border-2 ${
                          on ? "border-green" : "border-white/38"
                        }`}
                      >
                        {on && <span className="h-2 w-2 bg-green" />}
                      </span>
                      <span>
                        <span className="text-[13px] font-bold">
                          {card.brand || "Card"} {maskCard(card.last4)}
                        </span>
                        <span className="mt-1 block text-xs text-white/55">
                          Expires {card.expMonth}/{card.expYear}
                          {card.name ? ` · ${card.name}` : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}
                <Link
                  href="/payment-methods"
                  className="flex items-center justify-center gap-1.5 border border-white/8 bg-[#14181F] py-3 text-[13px] font-bold text-green"
                >
                  <Plus className="h-4 w-4" /> Add new card
                </Link>
              </div>
            ) : (
              <Link
                href={isSignedIn ? "/payment-methods" : "/sign-in"}
                className="block py-7 text-center"
              >
                <CreditCard className="mx-auto mb-3 h-6 w-6 text-white/38" />
                <p className="text-sm font-bold">Add a payment card</p>
                <p className="mt-1 text-xs text-white/38">
                  A saved card is required before you can place an order.
                </p>
              </Link>
            )}
          </section>

          {/* ── Shipping routes (per seller) ── */}
          <section className="mb-3 overflow-hidden border border-white/8 bg-[#0E1116]">
            <div className="flex items-center gap-2.5 border-b border-white/8 bg-[#14181F] px-3.5 py-3">
              <span className="flex h-[30px] w-[30px] items-center justify-center border border-white/8 bg-[#0E1116]">
                <Navigation className="h-3.5 w-3.5 text-white/55" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">Shipping routes</p>
                <p className="text-[10px] text-white/40">
                  Each seller ships separately from their own origin
                </p>
              </div>
              {routeGroups.length > 1 && (
                <span className="text-[10px] font-bold text-white/45">
                  {routeGroups.length} routes
                </span>
              )}
            </div>

            {incompleteSellers.length > 0 && (
              <div className="m-3.5 flex gap-3 border border-amber-500/30 bg-amber-500/10 p-3.5">
                <AlertCircle className="h-[18px] w-[18px] shrink-0 text-amber-500" />
                <div>
                  <p className="text-[13px] font-bold text-amber-500">
                    Shipping incomplete
                  </p>
                  <p className="mt-1 text-xs leading-[18px] text-white/55">
                    {incompleteSellers
                      .map((g) => g.ship.storeName)
                      .join(", ")}{" "}
                    {incompleteSellers.length === 1 ? "has" : "have"} not set a
                    ship-from location. Checkout stays locked until every seller
                    on this order has a complete origin.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3 p-3.5">
              {routeGroups.map((group, idx) => (
                <div
                  key={group.key}
                  className={`border p-3.5 ${
                    group.missingShipFrom
                      ? "border-amber-500/30 bg-amber-500/[0.04]"
                      : group.isInternational
                        ? "border-blue/25 bg-blue/[0.04]"
                        : "border-white/8 bg-[#14181F]"
                  }`}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span
                      className="flex h-6 min-w-[1.5rem] items-center justify-center px-1.5 text-[11px] font-extrabold text-[#041412]"
                      style={{ backgroundImage: GRAD }}
                    >
                      {idx + 1}
                    </span>
                    <p className="text-[12px] font-extrabold">
                      {group.ship.storeName}
                    </p>
                    <span className="text-[10px] text-white/40">
                      {group.items.length} item
                      {group.items.length !== 1 ? "s" : ""}
                    </span>
                    {group.isInternational && (
                      <span className="flex items-center gap-1 border border-blue/30 px-1.5 py-0.5 text-[9px] font-bold uppercase text-blue-300">
                        <Globe2 className="h-3 w-3" />
                        Cross-border
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] font-extrabold uppercase text-white/38">
                    Ships from
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {group.ship.hasShipFrom
                      ? group.ship.label
                      : "Not set by seller"}
                  </p>
                  {group.ship.country && (
                    <p className="mt-0.5 text-[11px] text-white/40">
                      Origin country: {group.ship.country}
                    </p>
                  )}

                  <div className="my-2 flex items-center gap-1 text-white/38">
                    <span className="h-2.5 w-px bg-white/8" />
                    <ArrowDown className="h-3 w-3" />
                  </div>

                  <p className="text-[10px] font-extrabold uppercase text-white/38">
                    Delivering to
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {deliverToLabel || "Select a delivery address"}
                  </p>
                  {selectedAddress?.country && (
                    <p className="mt-0.5 text-[11px] text-white/40">
                      Destination country: {selectedAddress.country}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.06] pt-2 text-[11px] text-white/45">
                    <span>
                      Products {fmt(group.productSubtotalDisplay)}
                    </span>
                    <span>
                      Delivery {fmt(group.deliveryFeeDisplay)}
                    </span>
                  </div>

                  {group.isInternational && (
                    <p className="mt-2 text-[11px] leading-[16px] text-blue-200/80">
                      This route crosses countries. The seller may review the
                      order before packing and shipping. Delivery times and
                      carrier options can differ from domestic routes.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── International summary ── */}
          {hasInternational && selectedAddress && (
            <div className="mb-3 border border-blue/25 bg-blue/8 p-3.5">
              <div className="flex items-start gap-2.5">
                <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
                <div>
                  <p className="text-sm font-extrabold">International order</p>
                  <p className="mt-1.5 text-xs leading-[18px] text-white/55">
                    {internationalRoutes.length === 1
                      ? `${internationalRoutes[0].ship.storeName} ships from ${internationalRoutes[0].ship.country} to ${selectedAddress.country}.`
                      : `${internationalRoutes.length} of ${routeGroups.length} routes are cross-border.`}{" "}
                    Cross-border legs may require seller approval before
                    shipment. Duties, taxes, or extra carrier fees are not
                    included in the delivery fee shown unless the seller listed
                    them in product shipping.
                  </p>
                  <ul className="mt-2 list-inside list-disc text-[11px] leading-[17px] text-white/45">
                    {internationalRoutes.map((g) => (
                      <li key={g.key}>
                        {g.ship.storeName}: {g.ship.country || "?"} →{" "}
                        {selectedAddress.country}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {blockReason && hasItems && (
            <div className="mb-3 flex gap-3 border border-white/10 bg-[#14181F] p-3.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-white/45" />
              <p className="text-[12px] leading-[18px] text-white/55">
                {blockReason}
              </p>
            </div>
          )}
        </div>

        {/* ── Receipt ── */}
        <aside className="h-fit border border-white/8 bg-[#0E1116] md:sticky md:top-6">
          <div className="flex items-center gap-2.5 border-b border-white/8 bg-[#14181F] px-3.5 py-3">
            <span className="flex h-[30px] w-[30px] items-center justify-center border border-white/8 bg-[#0E1116]">
              <Receipt className="h-3.5 w-3.5 text-white/55" />
            </span>
            <p className="text-sm font-extrabold">Receipt</p>
          </div>
          <div className="space-y-2.5 p-3.5">
            <div className="flex justify-between text-[13px]">
              <span className="text-white/55">Product price</span>
              <span className="font-bold">{fmt(productPrice)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-white/55">
                Delivery
                {routeGroups.length > 1
                  ? ` (${routeGroups.length} routes)`
                  : ""}
              </span>
              <span className="font-bold">{fmt(deliveryFee)}</span>
            </div>
            {routeGroups.length > 1 && (
              <div className="space-y-1 border border-white/[0.06] bg-[#0A0C10] p-2 text-[10px] text-white/40">
                {routeGroups.map((g) => (
                  <div key={g.key} className="flex justify-between gap-2">
                    <span className="truncate">{g.ship.storeName}</span>
                    <span>
                      {fmt(g.productSubtotalDisplay)} +{" "}
                      {fmt(g.deliveryFeeDisplay)} ship
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="h-px bg-white/8" />
            <div className="flex justify-between">
              <span className="text-sm font-extrabold">Total</span>
              <span className="text-[17px] font-extrabold text-green">
                {fmt(totalAmount)}
              </span>
            </div>
            <p className="text-[11px] text-white/38">
              Prices converted to your marketplace currency ({displayRegion}).
              Each product keeps its original listing region for conversion.
            </p>
            {hasInternational && (
              <p className="text-[11px] text-blue-200/70">
                International routes may take longer and can require seller
                review before ship.
              </p>
            )}
          </div>
          <div className="hidden border-t border-white/8 p-4 md:block">
            <p className="text-[10px] font-extrabold tracking-[0.11em] text-white/38">
              AMOUNT DUE
            </p>
            <p className="mt-1 text-xl font-extrabold">{fmt(totalAmount)}</p>
            <button
              type="button"
              onClick={placeOrder}
              disabled={placing || !canPlaceOrder}
              className="mt-4 flex w-full items-center justify-center gap-2 py-3.5 text-[15px] font-extrabold disabled:text-white/38"
              style={{
                backgroundImage:
                  placing || !canPlaceOrder ? undefined : GRAD,
                backgroundColor:
                  placing || !canPlaceOrder ? "#2A2F38" : undefined,
                color:
                  placing || !canPlaceOrder ? undefined : "#041412",
              }}
            >
              {!hasItems
                ? "Empty bag"
                : !canPlaceOrder
                  ? "Complete required steps"
                  : placing
                    ? "Placing…"
                    : "Place Order"}
              {canPlaceOrder && !placing && (
                <ArrowRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/8 bg-[#0E1116] md:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold tracking-[0.11em] text-white/38">
              AMOUNT DUE
            </p>
            <p className="text-xl font-extrabold">{fmt(totalAmount)}</p>
          </div>
          <button
            type="button"
            onClick={placeOrder}
            disabled={placing || !canPlaceOrder}
            className="flex min-w-[140px] items-center justify-center gap-2 px-5 py-3.5 text-[15px] font-extrabold disabled:text-white/38"
            style={{
              backgroundImage: placing || !canPlaceOrder ? undefined : GRAD,
              backgroundColor:
                placing || !canPlaceOrder ? "#2A2F38" : undefined,
              color: placing || !canPlaceOrder ? undefined : "#041412",
            }}
          >
            {!hasItems
              ? "Empty"
              : !canPlaceOrder
                ? "Unavailable"
                : placing
                  ? "…"
                  : "Place Order"}
          </button>
        </div>
      </div>

      <p className="pb-8 text-center text-[11px] font-semibold tracking-wide text-white/38 md:pb-6">
        Plazore · Discovery-Led Commerce
      </p>
    </div>
  );
}