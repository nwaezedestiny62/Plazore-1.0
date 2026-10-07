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
  Lock,
  MapPin,
  Navigation,
  Plus,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import { clearCart, getCart, type CartItem } from "@/lib/cart";
import { formatSelectedOptions } from "@/lib/types";
import {
  convertPrice,
  DEFAULT_REGION,
  formatMoney,
  formatProductPrice,
} from "@/lib/regions";

const BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com/api";
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

type SavedCard = {
  _id: string;
  brand?: string;
  last4?: string;
  expMonth?: string | number;
  expYear?: string | number;
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

function addressComplete(a: Address | null): boolean {
  if (!a) return false;
  return !!(
    (a.street || "").trim() &&
    (a.city || "").trim() &&
    (a.country || "").trim()
  );
}

function maskCard(last4?: string) {
  if (!last4) return "••••";
  return `•••• ${last4}`;
}

async function apiAuth<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  let body: any = {};
  try {
    body = await res.json();
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
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
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
      const [addr, pm] = await Promise.all([
        apiAuth("/addresses", token),
        apiAuth("/payment-methods", token),
      ]);

      if (addr.body?.success && Array.isArray(addr.body.data)) {
        const list = addr.body.data as Address[];
        setAddresses(list);
        setSelectedAddress(list.find((a) => a.isDefault) || list[0] || null);
      }

      if (pm.body?.success && Array.isArray(pm.body.data)) {
        const list = pm.body.data as SavedCard[];
        setCards(list);
        const def = list.find((c) => c.isDefault) || list[0] || null;
        setSelectedCardId(def?._id || null);
      } else if (Array.isArray(pm.body?.data)) {
        const list = pm.body.data as SavedCard[];
        setCards(list);
        setSelectedCardId(list[0]?._id || null);
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
      const feeMode =
        (product.shipping as { feeMode?: string } | undefined)?.feeMode ||
        (feeRaw > 0 ? "fixed" : "free");
      const feeDisplay =
        feeMode === "fixed"
          ? convertPrice(feeRaw, region, displayRegion)
          : 0;

      const invalid: string[] = [];
      if (!product._id) invalid.push("Missing product id");
      if (!(unit > 0)) invalid.push("Invalid price");
      if (!ship.hasShipFrom) invalid.push("No ship-from location");
      if (
        product.hasVariants &&
        Array.isArray(product.variants) &&
        product.variants.length > 0 &&
        !item.variantKey &&
        !item.variantId
      ) {
        invalid.push("Missing variant selection");
      }

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
        existing.deliveryFeeDisplay = Math.max(
          existing.deliveryFeeDisplay,
          feeDisplay
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

  const internationalRoutes = routeGroups.filter((g) => g.isInternational);
  const hasInternational = internationalRoutes.length > 0;
  const incompleteSellers = routeGroups.filter((g) => g.missingShipFrom);

  const canPlaceOrder =
    hasItems &&
    allRoutesShipReady &&
    noInvalidLines &&
    addressOk &&
    !!isSignedIn;

  const blockReason = useMemo(() => {
    if (!hasItems) return "Your bag is empty. Add products before checkout.";
    if (!isSignedIn) return "Sign in to place an order on Plazore.";
    if (!allRoutesShipReady)
      return "One or more sellers have not set a shipping origin. Checkout is blocked until they complete it.";
    if (!noInvalidLines)
      return "One or more items have invalid price, product data, or missing options. Remove them or re-add from the product page.";
    if (!addressOk)
      return "Select a complete delivery address (street, city, country).";
    return null;
  }, [
    hasItems,
    isSignedIn,
    allRoutesShipReady,
    noInvalidLines,
    addressOk,
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
        title: "Cannot continue",
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
          return {
            productId: id,
            quantity: qty,
            note: (item.note || "").trim().slice(0, 120),
            variantId: item.variantId || "",
            variantKey: item.variantKey || "",
            selectedOptions: item.selectedOptions || {},
          };
        })
        .filter((i) => i.productId && i.quantity > 0);

      if (!payloadItems.length) {
        throw new Error("No valid products in bag");
      }

      if (!selectedAddress || !addressComplete(selectedAddress)) {
        throw new Error("Delivery address is incomplete");
      }

      const res = await apiAuth("/payments/checkout", token, {
        method: "POST",
        body: JSON.stringify({
          shippingAddress: {
            street: selectedAddress.street,
            city: selectedAddress.city,
            state: selectedAddress.state,
            zipCode: selectedAddress.zipCode,
            country: selectedAddress.country,
          },
          buyerNote: hasInternational
            ? "International shipment — seller review may apply."
            : "",
          items: payloadItems,
          // Optional hint for backend (tokenized charge later)
          paymentMethodId: selectedCardId || undefined,
          callbackUrl:
            typeof window !== "undefined"
              ? `${window.location.origin}/checkout/callback`
              : undefined,
        }),
      });

      const body = res.body || {};
      const data = body.data || body;

      // Backend gate: fail = order unsuccessful
      if (!res.ok || body.success === false) {
        setPhase("error");
        setOrderError(
          body.message ||
            (res.status === 503 || body.code === "PAYSTACK_NOT_CONFIGURED"
              ? "Order unsuccessful. Payment is not available yet — Paystack is not connected. Nothing was charged."
              : res.status === 402
                ? "Order unsuccessful. Payment could not be started. Nothing was charged."
                : res.status === 401
                  ? "Session expired. Sign in again."
                  : "Order unsuccessful. Please review your bag and try again.")
        );
        return;
      }

      const authUrl =
        data.authorization_url ||
        data.authorizationUrl ||
        body.authorization_url ||
        body.authorizationUrl;

      const reference = data.reference || body.reference || "";

      // No Paystack URL = order was NOT successfully paid / placed
      if (!authUrl) {
        setPhase("error");
        setOrderError(
          body.message ||
            "Order unsuccessful. Payment could not be started. No charge was made."
        );
        return;
      }

      try {
        sessionStorage.setItem("plazore_pay_ref", reference);
      } catch {
        /* ignore */
      }

      // Leave phase processing until browser navigates away
      window.location.href = authUrl;
    } catch (e: unknown) {
      setPhase("error");
      setOrderError(
        e instanceof Error
          ? e.message
          : "Order unsuccessful. Something went wrong. Please try again."
      );
    } finally {
      placingLock.current = false;
    }
  };

  const placing = phase === "processing";

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
            your bag.
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
                <p className="mt-6 text-lg font-extrabold">
                  Preparing secure payment
                </p>
                <p className="mt-2 text-[13px] text-white/55">
                  Opening Paystack. Your order is only confirmed after payment
                  succeeds.
                </p>
              </>
            )}
            {phase === "error" && (
              <>
                <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center border border-red-500/25 bg-red-500/12">
                  <X className="h-8 w-8 text-red-500" />
                </div>
                <p className="mt-6 text-lg font-extrabold">
                  Order unsuccessful
                </p>
                <p className="mt-2 text-[13px] text-white/55">
                  {orderError ||
                    "Payment failed or could not be started. Nothing was charged."}
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
                  Payment confirmed
                </p>
                <p className="mt-1.5 text-[13px] text-white/55">
                  Your order is paid and locked on Plazore.
                </p>
                <Link
                  href="/orders"
                  className="mt-6 flex w-full items-center justify-center gap-2 py-3.5 text-[15px] font-extrabold text-[#041412]"
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

          {/* Bag — same as before */}
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
                  const config = formatSelectedOptions(item.selectedOptions);
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
                        {config ? (
                          <p className="mt-0.5 text-[11px] font-medium tracking-wide text-white/50">
                            {config}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[11px] text-white/55">
                          Qty {qty} · {fmtProduct(unit, region)} each
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
                    Route subtotal · delivery {fmt(group.deliveryFeeDisplay)}
                  </span>
                  <span className="font-bold text-white/70">
                    {fmt(
                      group.productSubtotalDisplay + group.deliveryFeeDisplay
                    )}
                  </span>
                </div>
              </div>
            ))}
          </section>

          {/* Address */}
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
                  Street, city and country are required.
                </p>
              </Link>
            )}
          </section>

          {/* Saved cards — like addresses */}
          <section className="mb-3 overflow-hidden border border-white/8 bg-[#0E1116]">
            <div className="flex items-center justify-between border-b border-white/8 bg-[#14181F] px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-[30px] w-[30px] items-center justify-center border border-white/8 bg-[#0E1116]">
                  <CreditCard className="h-3.5 w-3.5 text-white/55" />
                </span>
                <div>
                  <p className="text-sm font-extrabold">Payment method</p>
                  <p className="text-[10px] text-white/40">
                    Saved cards · Paystack hosts entry
                  </p>
                </div>
              </div>
              <Link
                href="/payment-methods"
                className="text-[13px] font-bold text-green"
              >
                Manage
              </Link>
            </div>

            <div className="space-y-2 p-3">
              {/* Always available: pay with new card on Paystack */}
              <button
                type="button"
                onClick={() => setSelectedCardId(null)}
                className={`flex w-full gap-3 border p-3 text-left ${
                  selectedCardId === null
                    ? "border-green/50 bg-[#14181F]"
                    : "border-white/8"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-[18px] w-[18px] items-center justify-center border-2 ${
                    selectedCardId === null ? "border-green" : "border-white/38"
                  }`}
                >
                  {selectedCardId === null && (
                    <span className="h-2 w-2 bg-green" />
                  )}
                </span>
                <span>
                  <span className="text-[13px] font-bold">
                    New card on Paystack
                  </span>
                  <span className="mt-1 block text-xs text-white/55">
                    Enter card securely on Paystack. Order only succeeds if the
                    card is valid and funds are available.
                  </span>
                </span>
              </button>

              {cards.map((card) => {
                const on = selectedCardId === card._id;
                return (
                  <button
                    key={card._id}
                    type="button"
                    onClick={() => setSelectedCardId(card._id)}
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
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span>
                        <span className="flex items-center gap-2">
                          <span className="text-[13px] font-bold">
                            {card.brand || "Card"} {maskCard(card.last4)}
                          </span>
                          {card.isDefault && (
                            <span className="border border-white/8 px-1.5 py-0.5 text-[10px] text-white/55">
                              Default
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs text-white/55">
                          Exp {card.expMonth || "—"}/{card.expYear || "—"}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}

              <Link
                href="/payment-methods"
                className="flex items-center justify-center gap-1.5 border border-white/8 bg-[#14181F] py-3 text-[13px] font-bold text-green"
              >
                <Plus className="h-4 w-4" /> Add / change cards
              </Link>

              <div className="flex gap-2.5 pt-1">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green" />
                <p className="text-[12px] leading-[18px] text-white/50">
                  Declined cards, insufficient funds, or invalid details ={" "}
                  <span className="font-semibold text-white/70">
                    order unsuccessful
                  </span>
                  . Plazore never stores full card numbers.
                </p>
              </div>
            </div>
          </section>

          {/* Shipping routes */}
          <section className="mb-3 overflow-hidden border border-white/8 bg-[#0E1116]">
            <div className="flex items-center gap-2.5 border-b border-white/8 bg-[#14181F] px-3.5 py-3">
              <span className="flex h-[30px] w-[30px] items-center justify-center border border-white/8 bg-[#0E1116]">
                <Navigation className="h-3.5 w-3.5 text-white/55" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">Shipping routes</p>
                <p className="text-[10px] text-white/40">
                  Each seller ships separately
                </p>
              </div>
            </div>

            {incompleteSellers.length > 0 && (
              <div className="m-3.5 flex gap-3 border border-amber-500/30 bg-amber-500/10 p-3.5">
                <AlertCircle className="h-[18px] w-[18px] shrink-0 text-amber-500" />
                <div>
                  <p className="text-[13px] font-bold text-amber-500">
                    Shipping incomplete
                  </p>
                  <p className="mt-1 text-xs leading-[18px] text-white/55">
                    {incompleteSellers.map((g) => g.ship.storeName).join(", ")}{" "}
                    missing ship-from. Checkout stays locked.
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
                  </div>
                  <p className="text-[10px] font-extrabold uppercase text-white/38">
                    Ships from
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {group.ship.hasShipFrom
                      ? group.ship.label
                      : "Not set by seller"}
                  </p>
                  <div className="my-2 flex items-center gap-1 text-white/38">
                    <ArrowDown className="h-3 w-3" />
                  </div>
                  <p className="text-[10px] font-extrabold uppercase text-white/38">
                    Delivering to
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {deliverToLabel || "Select a delivery address"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {blockReason && hasItems && (
            <div className="mb-3 flex gap-3 border border-white/10 bg-[#14181F] p-3.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-white/45" />
              <p className="text-[12px] leading-[18px] text-white/55">
                {blockReason}
              </p>
            </div>
          )}
        </div>

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
              <span className="text-white/55">Delivery</span>
              <span className="font-bold">{fmt(deliveryFee)}</span>
            </div>
            <div className="h-px bg-white/8" />
            <div className="flex justify-between">
              <span className="text-sm font-extrabold">Total</span>
              <span className="text-[17px] font-extrabold text-green">
                {fmt(totalAmount)}
              </span>
            </div>
            <p className="text-[11px] text-white/38">
              Order is placed only after Paystack confirms payment.
            </p>
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
                color: placing || !canPlaceOrder ? undefined : "#041412",
              }}
            >
              {!hasItems
                ? "Empty bag"
                : !canPlaceOrder
                  ? "Complete required steps"
                  : placing
                    ? "Opening Paystack…"
                    : "Pay with Paystack"}
              {canPlaceOrder && !placing && <Lock className="h-4 w-4" />}
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
            className="flex min-w-[150px] items-center justify-center gap-2 px-5 py-3.5 text-[14px] font-extrabold disabled:text-white/38"
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
                  : "Pay with Paystack"}
          </button>
        </div>
      </div>

      <p className="pb-8 text-center text-[11px] font-semibold tracking-wide text-white/38 md:pb-6">
        Plazore · Digital Mall
      </p>
    </div>
  );
}