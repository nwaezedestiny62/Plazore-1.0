"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  Check,
  ChevronLeft,
  CreditCard,
  Home,
  MapPin,
  Navigation,
  Plus,
  Receipt,
  ShoppingBag,
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
type Toast = { title: string; message?: string; tone?: "info" | "success" | "danger" } | null;

function productRegion(product: CartItem["product"]) {
  if (product.region) return String(product.region);
  return DEFAULT_REGION;
}

function locationLabel(parts: { city?: string; state?: string; country?: string }) {
  const city = (parts.city || "").trim();
  const state = (parts.state || "").trim();
  const country = (parts.country || "").trim();
  const left = city || state;
  if (left && country) return `${left}, ${country}`;
  return left || country || "";
}

function resolveShipFrom(product: CartItem["product"]) {
  const seller = product?.seller;
  const sellerObj = seller && typeof seller === "object" ? seller : null;
  const sellerId = sellerObj && "_id" in sellerObj ? String(sellerObj._id) : typeof seller === "string" ? seller : "";
  const fl = product.fulfillmentLocation;
  if (fl && (fl.city || fl.state) && fl.country) {
    return {
      label: fl.displayLabel || locationLabel({ city: fl.city, state: fl.state, country: fl.country }),
      country: fl.country,
      hasShipFrom: true,
      storeName: sellerObj?.storeName || sellerObj?.name || "Seller",
      sellerId,
    };
  }
  return {
    label: "Not set",
    country: "",
    hasShipFrom: false,
    storeName: sellerObj?.storeName || sellerObj?.name || "Seller",
    sellerId,
  };
}

function maskCard(last4?: string) {
  return last4 ? `•••• ${last4}` : "••••";
}

async function apiAuth<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  return res.json();
}

export default function CheckoutPage() {
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [orderError, setOrderError] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const displayRegion = DEFAULT_REGION;

  useEffect(() => {
    setItems(getCart());
  }, []);

  const loadExtras = useCallback(async () => {
    if (!isSignedIn) return;
    const token = await getToken();
    if (!token) return;
    try {
      const addr = await apiAuth<{ success: boolean; data: Address[] }>("/addresses", token);
      if (addr.success) {
        const list = addr.data || [];
        setAddresses(list);
        setSelectedAddress(list.find((a) => a.isDefault) || list[0] || null);
      }
    } catch {}
    try {
      const pay = await apiAuth<{ success: boolean; data: Card[] }>("/payment-methods", token);
      if (pay.success) {
        const list = pay.data || [];
        setCards(list);
        setSelectedCard(list.find((c) => c.isDefault) || list[0] || null);
      }
    } catch {}
  }, [getToken, isSignedIn]);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  const fmt = (n: number) => formatMoney(n, displayRegion);
  const fmtProduct = (n: number, region?: string | null) => formatProductPrice(n, region, displayRegion);

  const { productPrice, deliveryFee, totalAmount } = useMemo(() => {
    if (!items.length) return { productPrice: 0, deliveryFee: 0, totalAmount: 0 };
    let productsSum = 0;
    const bySeller: Record<string, number> = {};
    let noSellerMax = 0;
    for (const item of items) {
      const region = productRegion(item.product);
      const unit = Number(item.price ?? item.product?.price) || 0;
      const qty = Number(item.quantity) || 1;
      productsSum += convertPrice(unit * qty, region, displayRegion);
      const feeConverted = convertPrice(Number(item.product?.shipping?.deliveryFee) || 0, region, displayRegion);
      const seller = item.product?.seller as { _id?: string } | string | undefined;
      const sellerId = typeof seller === "string" ? seller : seller?._id ? String(seller._id) : "";
      if (sellerId) bySeller[sellerId] = Math.max(bySeller[sellerId] || 0, feeConverted);
      else noSellerMax = Math.max(noSellerMax, feeConverted);
    }
    const feeSum = Object.values(bySeller).reduce((s, f) => s + f, 0) + noSellerMax;
    return { productPrice: productsSum, deliveryFee: feeSum, totalAmount: productsSum + feeSum };
  }, [items, displayRegion]);

  const itemCount = items.reduce((n, i) => n + (i.quantity || 0), 0);

  const shippingRoutes = useMemo(() => {
    const map = new Map<string, ReturnType<typeof resolveShipFrom>>();
    for (const item of items) {
      const ship = resolveShipFrom(item.product);
      const key = ship.sellerId || `anon-${ship.storeName}`;
      if (!map.has(key)) map.set(key, ship);
    }
    return Array.from(map.values());
  }, [items]);

  const canCheckout = items.length > 0 && shippingRoutes.length > 0 && shippingRoutes.every((r) => r.hasShipFrom);
  const deliverToLabel = selectedAddress
    ? locationLabel({ city: selectedAddress.city, state: selectedAddress.state, country: selectedAddress.country })
    : "";
  const hasInternational =
    !!selectedAddress &&
    shippingRoutes.some(
      (r) =>
        r.hasShipFrom &&
        (r.country || "").trim().toLowerCase() &&
        (r.country || "").trim().toLowerCase() !== (selectedAddress.country || "").trim().toLowerCase()
    );

  const placeOrder = async () => {
    if (!canCheckout) {
      setToast({ title: "Unavailable", message: "This seller has not completed their shipping information yet.", tone: "danger" });
      return;
    }
    if (!isSignedIn) {
      setToast({ title: "Sign in needed", message: "Sign in to place this order on Plazore.", tone: "info" });
      return;
    }
    if (!selectedAddress) {
      setToast({ title: "Address needed", message: "Please add or select a delivery address.", tone: "info" });
      return;
    }
    if (!selectedCard) {
      setToast({ title: "Card needed", message: "Please add or select a payment card.", tone: "info" });
      return;
    }

    setOrderError("");
    setPhase("processing");
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in required");
      const payloadItems = items
        .map((item) => ({
          productId: item.product?._id,
          quantity: Number(item.quantity) || 1,
          price: Number(item.price ?? item.product?.price) || 0,
          note: (item.note || "").trim().slice(0, 120),
        }))
        .filter((i) => i.productId);

      const res = await apiAuth<{ success: boolean; message?: string }>("/orders", token, {
        method: "POST",
        body: JSON.stringify({
          shippingAddress: {
            street: selectedAddress.street,
            city: selectedAddress.city,
            state: selectedAddress.state,
            zipCode: selectedAddress.zipCode,
            country: selectedAddress.country,
          },
          buyerNote: "",
          items: payloadItems,
        }),
      });

      if (res.success) {
        clearCart();
        setItems([]);
        setPhase("success");
      } else {
        setPhase("error");
        setOrderError(res.message || "Could not place order");
      }
    } catch (e: unknown) {
      setPhase("error");
      setOrderError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const placing = phase === "processing";

  return (
    <div className="min-h-screen bg-bg text-text">
      {toast && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-lg overflow-hidden border border-white/8 bg-[#0E1116]">
          <span className={`w-[3px] ${toast.tone === "danger" ? "bg-red-500" : toast.tone === "success" ? "bg-green" : "bg-blue"}`} />
          <div className="flex-1 p-3">
            <p className="text-sm font-bold">{toast.title}</p>
            {toast.message && <p className="mt-1 text-[12.5px] leading-[17px] text-white/55">{toast.message}</p>}
          </div>
          <button onClick={() => setToast(null)} className="p-2.5 text-white/38">
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
                <p className="mt-2 text-[13px] text-white/55">Securing your bag and confirming with the seller…</p>
              </>
            )}
            {phase === "error" && (
              <>
                <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center border border-red-500/25 bg-red-500/12">
                  <X className="h-8 w-8 text-red-500" />
                </div>
                <p className="mt-6 text-lg font-extrabold">Order failed</p>
                <p className="mt-2 text-[13px] text-white/55">{orderError || "Something went wrong. Please try again."}</p>
                <button onClick={() => setPhase("idle")} className="mt-6 border border-white/8 bg-[#14181F] px-6 py-3 text-sm font-bold">
                  Try again
                </button>
              </>
            )}
            {phase === "success" && (
              <>
                <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center" style={{ backgroundImage: "linear-gradient(135deg,#00E575,#2563EB)" }}>
                  <Check className="h-9 w-9 text-[#041412]" />
                </div>
                <p className="mt-4 text-[22px] font-extrabold tracking-tight">Order Successful</p>
                <p className="mt-1.5 text-[13px] text-white/55">Your order is confirmed on Plazore.</p>
                <div className="mt-5 w-full border border-white/8 bg-[#14181F] p-3.5 text-left">
                  <p className="mb-2.5 text-[10px] font-extrabold tracking-[0.14em] text-white/38">HOW YOUR ORDER WORKS</p>
                  {[
                    ["1", "Confirmed", "Your bag is locked and the seller is notified."],
                    ["2", "Seller prepares", "Items are packed. International orders may need a short seller review first."],
                    ["3", "Shipped", "Tracking updates appear in Orders as the package moves."],
                    ["4", "Delivered", "You receive your order at the address you selected."],
                  ].map(([n, t, d]) => (
                    <div key={n} className="mb-3 flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-extrabold text-[#041412]" style={{ backgroundImage: GRAD }}>
                        {n}
                      </span>
                      <span>
                        <span className="block text-[13px] font-bold">{t}</span>
                        <span className="mt-0.5 block text-xs leading-[17px] text-white/55">{d}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <Link href="/orders" className="mt-4 flex w-full items-center justify-center gap-2 py-3.5 text-[15px] font-extrabold text-[#041412]" style={{ backgroundImage: GRAD }}>
                  View Order <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/" className="mt-3 block w-full border border-white/8 bg-[#14181F] py-3 text-sm font-semibold">
                  Go back to Showroom
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      <header className="flex items-center px-2 py-2.5 md:px-6">
        <button onClick={() => router.back()} className="flex h-11 w-11 items-center justify-center border border-white/8 bg-[#0E1116]">
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <p className="flex-1 text-center text-[17px] font-extrabold tracking-tight">Checkout</p>
        <span className="w-11" />
      </header>
      <div className="mx-4 h-px md:mx-6" style={{ background: "linear-gradient(90deg,transparent,rgba(0,229,117,0.4),rgba(37,99,235,0.3),transparent)" }} />

      <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-32 pt-4 md:grid-cols-[1fr_340px] md:px-6 md:pb-10">
        <div>
          <p className="mb-3.5 text-[11px] font-bold tracking-[0.16em] text-white/38">REVIEW  ·  DELIVER  ·  PAY</p>

          <section className="mb-3 overflow-hidden border border-white/8 bg-[#0E1116]">
            <div className="flex items-center justify-between border-b border-white/8 bg-[#14181F] px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-[30px] w-[30px] items-center justify-center border border-white/8 bg-[#0E1116]">
                  <ShoppingBag className="h-3.5 w-3.5 text-white/55" />
                </span>
                <p className="text-sm font-extrabold">Your Bag</p>
              </div>
              <p className="text-xs font-semibold text-white/55">{itemCount} item{itemCount !== 1 ? "s" : ""}</p>
            </div>
            {items.length === 0 ? (
              <div className="py-7 text-center text-[13px] text-white/38">Your bag is empty</div>
            ) : (
              items.map((item, i) => {
                const region = productRegion(item.product);
                const unit = Number(item.price ?? item.product?.price) || 0;
                const lineFee = Number(item.product?.shipping?.deliveryFee) || 0;
                return (
                  <div key={item.id} className={`flex items-center px-3.5 py-3 ${i < items.length - 1 ? "border-b border-white/8" : ""}`}>
                    {item.product?.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.product.images[0]} alt="" className="h-14 w-14 object-cover bg-[#14181F]" />
                    ) : (
                      <div className="h-14 w-14 bg-[#14181F]" />
                    )}
                    <div className="ml-3 min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-[18px]">{item.product?.name || "Product"}</p>
                      <p className="mt-0.5 text-[11px] text-white/55">
                        Qty {item.quantity} · {fmtProduct(unit, region)} each
                      </p>
                      {lineFee > 0 && <p className="text-[10px] text-white/38">Delivery {fmtProduct(lineFee, region)}</p>}
                    </div>
                    <p className="ml-2 text-[13px] font-bold">{fmtProduct(unit * (item.quantity || 1), region)}</p>
                  </div>
                );
              })
            )}
          </section>

          <section className="mb-3 overflow-hidden border border-white/8 bg-[#0E1116]">
            <div className="flex items-center justify-between border-b border-white/8 bg-[#14181F] px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-[30px] w-[30px] items-center justify-center border border-white/8 bg-[#0E1116]">
                  <Home className="h-3.5 w-3.5 text-white/55" />
                </span>
                <p className="text-sm font-extrabold">Deliver To</p>
              </div>
              <Link href="/addresses" className="text-[13px] font-bold text-green">Change</Link>
            </div>
            {addresses.length > 0 ? (
              <div className="space-y-2 p-3">
                {addresses.map((addr) => {
                  const on = selectedAddress?._id === addr._id;
                  return (
                    <button
                      key={addr._id}
                      onClick={() => setSelectedAddress(addr)}
                      className={`flex w-full gap-3 border p-3 text-left ${on ? "border-green/50 bg-[#14181F]" : "border-white/8"}`}
                    >
                      <span className={`mt-0.5 flex h-[18px] w-[18px] items-center justify-center border-2 ${on ? "border-green" : "border-white/38"}`}>
                        {on && <span className="h-2 w-2 bg-green" />}
                      </span>
                      <span>
                        <span className="flex items-center gap-2">
                          <span className="text-[13px] font-bold">{addr.type || "Address"}</span>
                          {addr.isDefault && <span className="border border-white/8 px-1.5 py-0.5 text-[10px] text-white/55">Default</span>}
                        </span>
                        <span className="mt-1 block text-xs leading-[18px] text-white/55">
                          {addr.street}
                          <br />
                          {addr.city}, {addr.state} {addr.zipCode}
                          <br />
                          {addr.country}
                        </span>
                      </span>
                    </button>
                  );
                })}
                <Link href="/addresses" className="flex items-center justify-center gap-1.5 border border-white/8 bg-[#14181F] py-3 text-[13px] font-bold text-green">
                  <Plus className="h-4 w-4" /> Add new address
                </Link>
              </div>
            ) : (
              <Link href={isSignedIn ? "/addresses" : "/sign-in"} className="block py-7 text-center">
                <MapPin className="mx-auto mb-3 h-6 w-6 text-white/38" />
                <p className="text-sm font-bold">Add delivery address</p>
                <p className="mt-1 text-xs text-white/38">Where should we send your order?</p>
              </Link>
            )}
          </section>

          <section className="mb-3 overflow-hidden border border-white/8 bg-[#0E1116]">
            <div className="flex items-center justify-between border-b border-white/8 bg-[#14181F] px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-[30px] w-[30px] items-center justify-center border border-white/8 bg-[#0E1116]">
                  <CreditCard className="h-3.5 w-3.5 text-white/55" />
                </span>
                <p className="text-sm font-extrabold">Pay with Card</p>
              </div>
              <Link href="/payment-methods" className="text-[13px] font-bold text-green">Change</Link>
            </div>
            {cards.length > 0 ? (
              <div className="space-y-2 p-3">
                {cards.map((card) => {
                  const on = selectedCard?._id === card._id;
                  return (
                    <button
                      key={card._id}
                      onClick={() => setSelectedCard(card)}
                      className={`flex w-full gap-3 border p-3 text-left ${on ? "border-green/50 bg-[#14181F]" : "border-white/8"}`}
                    >
                      <span className={`mt-0.5 flex h-[18px] w-[18px] items-center justify-center border-2 ${on ? "border-green" : "border-white/38"}`}>
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
                <Link href="/payment-methods" className="flex items-center justify-center gap-1.5 border border-white/8 bg-[#14181F] py-3 text-[13px] font-bold text-green">
                  <Plus className="h-4 w-4" /> Add new card
                </Link>
              </div>
            ) : (
              <Link href={isSignedIn ? "/payment-methods" : "/sign-in"} className="block py-7 text-center">
                <CreditCard className="mx-auto mb-3 h-6 w-6 text-white/38" />
                <p className="text-sm font-bold">Add a payment card</p>
                <p className="mt-1 text-xs text-white/38">Save a card to pay securely at checkout</p>
              </Link>
            )}
          </section>

          {items.length > 0 && (
            <section className="mb-3 overflow-hidden border border-white/8 bg-[#0E1116]">
              <div className="flex items-center gap-2.5 border-b border-white/8 bg-[#14181F] px-3.5 py-3">
                <span className="flex h-[30px] w-[30px] items-center justify-center border border-white/8 bg-[#0E1116]">
                  <Navigation className="h-3.5 w-3.5 text-white/55" />
                </span>
                <p className="text-sm font-extrabold">Shipping Route</p>
              </div>
              {!canCheckout ? (
                <div className="m-3.5 flex gap-3 border border-amber-500/30 bg-amber-500/10 p-3.5">
                  <AlertCircle className="h-[18px] w-[18px] shrink-0 text-amber-500" />
                  <div>
                    <p className="text-[13px] font-bold text-amber-500">Shipping not available yet</p>
                    <p className="mt-1 text-xs leading-[18px] text-white/55">
                      This seller has not completed their shipping information yet. Please try again later.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-3.5">
                  {shippingRoutes.map((route) => (
                    <div key={route.sellerId || route.storeName} className="border border-white/8 bg-[#14181F] p-3.5">
                      {shippingRoutes.length > 1 && (
                        <p className="mb-3 text-[10px] font-extrabold uppercase tracking-wide text-white/38">{route.storeName}</p>
                      )}
                      <p className="text-[10px] font-extrabold uppercase text-white/38">Ships From</p>
                      <p className="mt-1 text-sm font-semibold">{route.label}</p>
                      <div className="my-2 flex items-center gap-1 text-white/38">
                        <span className="h-2.5 w-px bg-white/8" />
                        <ArrowDown className="h-3 w-3" />
                      </div>
                      <p className="text-[10px] font-extrabold uppercase text-white/38">Delivering To</p>
                      <p className="mt-1 text-sm font-semibold">{deliverToLabel || "Select a delivery address"}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {canCheckout && hasInternational && selectedAddress && (
            <div className="mb-3 border border-blue/25 bg-blue/8 p-3.5">
              <p className="text-sm font-extrabold">International Order</p>
              <p className="mt-1.5 text-xs leading-[18px] text-white/55">
                This order will be reviewed by the seller before shipment begins. Once approved, the seller will prepare and continue delivery.
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
              <span className="text-white/55">Product Price</span>
              <span className="font-bold">{fmt(productPrice)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-white/55">Delivery Fee</span>
              <span className="font-bold">{fmt(deliveryFee)}</span>
            </div>
            <div className="h-px bg-white/8" />
            <div className="flex justify-between">
              <span className="text-sm font-extrabold">Total</span>
              <span className="text-[17px] font-extrabold text-green">{fmt(totalAmount)}</span>
            </div>
            <p className="text-[11px] text-white/38">Prices shown in your marketplace currency</p>
          </div>
          <div className="hidden border-t border-white/8 p-4 md:block">
            <p className="text-[10px] font-extrabold tracking-[0.11em] text-white/38">AMOUNT DUE</p>
            <p className="mt-1 text-xl font-extrabold">{fmt(totalAmount)}</p>
            <button
              onClick={placeOrder}
              disabled={placing || !canCheckout || !items.length}
              className="mt-4 flex w-full items-center justify-center gap-2 py-3.5 text-[15px] font-extrabold disabled:text-white/38"
              style={{
                backgroundImage: placing || !canCheckout || !items.length ? undefined : GRAD,
                backgroundColor: placing || !canCheckout || !items.length ? "#2A2F38" : undefined,
                color: placing || !canCheckout || !items.length ? undefined : "#041412",
              }}
            >
              {!canCheckout ? "Unavailable" : "Place Order"}
              {canCheckout && !placing && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/8 bg-[#0E1116] md:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold tracking-[0.11em] text-white/38">AMOUNT DUE</p>
            <p className="text-xl font-extrabold">{fmt(totalAmount)}</p>
          </div>
          <button
            onClick={placeOrder}
            disabled={placing || !canCheckout || !items.length}
            className="flex min-w-[140px] items-center justify-center gap-2 px-5 py-3.5 text-[15px] font-extrabold disabled:text-white/38"
            style={{
              backgroundImage: placing || !canCheckout || !items.length ? undefined : GRAD,
              backgroundColor: placing || !canCheckout || !items.length ? "#2A2F38" : undefined,
              color: placing || !canCheckout || !items.length ? undefined : "#041412",
            }}
          >
            {!canCheckout ? "Unavailable" : "Place Order"}
          </button>
        </div>
      </div>

      <p className="pb-8 text-center text-[11px] font-semibold tracking-wide text-white/38 md:pb-6">
        Plazore · Premium Digital Mall
      </p>
    </div>
  );
}