"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useMarketplace } from "@/context/MarketplaceContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Copy, Package, Receipt, X } from "lucide-react";
import { convertPrice, DEFAULT_REGION, formatMoney, formatProductPrice } from "@/lib/regions";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const steps = ["Preparing", "Shipped", "Delivered"];

function resolveOrderRegion(order: any, item?: any) {
  if (item?.product?.region) return String(item.product.region);
  if (item?.region) return String(item.region);
  if (order?.region) return String(order.region);
  if (order?.seller?.marketplaceRegion) return String(order.seller.marketplaceRegion);
  return DEFAULT_REGION;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(false);
  const { region: marketplaceRegion } = useMarketplace();
  const displayRegion = marketplaceRegion || DEFAULT_REGION;

  const fmt = useCallback(
    (amount: number, fromRegion?: string | null) => {
      if (fromRegion && fromRegion !== displayRegion) {
        return formatProductPrice(amount, fromRegion, displayRegion);
      }
      return formatMoney(amount, displayRegion);
    },
    [displayRegion]
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const token = await getToken();
        const res = await fetch(`${BASE}/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) setOrder(json.data);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isLoaded, isSignedIn, getToken, router]);

  const orderMoneyRegion = useMemo(() => {
    if (!order) return DEFAULT_REGION;
    return resolveOrderRegion(order, order.items?.[0]);
  }, [order]);

  const copyTracking = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast(true);
      setTimeout(() => setToast(false), 2200);
    } catch {}
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-[110px] w-[110px] animate-spin rounded-full border-[2.4px] border-transparent border-l-green border-r-blue border-t-green" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg text-center text-text">
        <Receipt className="h-9 w-9 text-[#6B7280]" />
        <p className="mt-3 text-[15px] text-secondary">Order not found</p>
        <button onClick={() => router.back()} className="mt-4 rounded-xl border border-white/7 bg-surface px-5 py-2.5 text-sm font-semibold">
          Go back
        </button>
      </div>
    );
  }

  const isCancelled = order.orderStatus === "Cancelled";
  const currentStep = Math.max(0, steps.indexOf(order.orderStatus));
  const shipping = order.shipping || {};
  const method = shipping.shippingMethod || order.productShipping?.method || (shipping.deliveryCompany ? "courier" : undefined);
  const isSelf = method === "self";
  const sellerNote = (shipping.selfDeliveryNote || "").trim();
  const tracking = (shipping.trackingNumber || "").trim();
  const hasShippingBlock =
    !isCancelled && (order.orderStatus === "Shipped" || order.orderStatus === "Delivered" || !!shipping.shippedAt);

  return (
    <div className="min-h-screen bg-bg text-text">
      {toast && (
        <div className="fixed left-4 right-4 top-2 z-50 flex items-center justify-center gap-2 rounded-[14px] border border-white/7 bg-surface py-3">
          <Check className="h-[18px] w-[18px] text-green" />
          <span className="text-[13px] font-bold">Tracking Number Copied</span>
        </div>
      )}

      <header className="flex items-center border-b border-white/7 px-2 py-2.5">
        <button onClick={() => router.back()} className="flex h-[42px] w-[42px] items-center justify-center">
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-base font-bold tracking-tight">{order.orderNumber}</p>
          <p className="mt-0.5 text-[11px] text-[#6B7280]">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <span className="w-[42px]" />
      </header>

      <div className="mx-auto grid max-w-5xl gap-3 p-4 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          {isCancelled ? (
            <div className="mb-3 rounded-2xl border border-red-500/25 bg-red-500/8 p-4">
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15">
                  <X className="h-[22px] w-[22px] text-red-500" />
                </span>
                <p className="text-base font-bold text-red-500">
                  {order.cancellation?.cancelledBy === "seller" ? "Cancelled by Seller" : "Order Cancelled"}
                </p>
              </div>
              <p className="text-[13px] leading-5 text-secondary">Unfortunately, the seller was unable to fulfill your order.</p>
              {(order.cancellation?.reasonLabel || order.cancellation?.note) && (
                <div className="mt-3 border-t border-red-500/20 pt-3">
                  <p className="mb-1 text-[11px] text-[#6B7280]">Reason</p>
                  <p className="text-sm leading-5">“{order.cancellation.reasonLabel || order.cancellation.note}”</p>
                </div>
              )}
            </div>
          ) : (
            <div className="mb-3 rounded-2xl border border-white/7 bg-surface p-4">
              <p className="mb-3.5 text-base font-bold">Order Progress</p>
              {steps.map((step, index) => {
                const isActive = index <= currentStep;
                const isCurrent = index === currentStep;
                const isLast = index === steps.length - 1;
                return (
                  <div key={step} className="flex min-h-12 items-start">
                    <div className="mr-3 flex w-[30px] flex-col items-center">
                      {isActive ? (
                        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full" style={{ backgroundImage: "linear-gradient(135deg,#00E575,#3B82F6)" }}>
                          <Check className="h-3.5 w-3.5 text-white" />
                        </span>
                      ) : (
                        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-white/7 bg-surface-2 text-[11px] font-semibold text-[#6B7280]">
                          {index + 1}
                        </span>
                      )}
                      {!isLast && (
                        <span
                          className="my-0.5 w-0.5 min-h-[18px] flex-1"
                          style={index < currentStep ? { backgroundImage: "linear-gradient(#00E575,#3B82F6)" } : { background: "rgba(255,255,255,0.07)" }}
                        />
                      )}
                    </div>
                    <p className={`pt-1 text-sm ${isCurrent ? "font-bold text-text" : isActive ? "font-medium text-secondary" : "font-medium text-[#6B7280]"}`}>
                      {step}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mb-3 rounded-2xl border border-white/7 bg-surface p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Sold by</p>
            <p className="text-[17px] font-bold">{order.seller?.storeName || order.seller?.name || "Seller"}</p>
          </div>

          <p className="mb-2.5 ml-0.5 mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6B7280]">Items</p>
          {order.items?.map((item: any, idx: number) => {
            const itemRegion = resolveOrderRegion(order, item);
            return (
              <div key={idx} className="mb-2.5 rounded-2xl border border-white/7 bg-surface p-3.5">
                <div className="flex items-center">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" className="h-14 w-14 rounded-xl object-cover bg-surface-2" />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-surface-2" />
                  )}
                  <div className="ml-3 min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-[19px]">{item.name}</p>
                    <p className="mt-0.5 text-xs text-secondary">
                      Qty {item.quantity} · {fmt(Number(item.price) || 0, itemRegion)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">Your note</p>
                  <p className="text-[13px] leading-[18px] text-secondary">{item.note?.trim() ? item.note : "No note added."}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          {hasShippingBlock && (
            <div className="mb-3 rounded-2xl border border-white/7 bg-surface p-4">
              <p className="mb-3.5 text-base font-bold">Shipping Details</p>
              <div className="mb-3.5">
                <p className="mb-1 text-[11px] font-semibold uppercase text-[#6B7280]">Method</p>
                <p className="text-[15px] font-semibold">{isSelf ? "Self Delivery" : "Courier"}</p>
              </div>
              {!!shipping.deliveryCompany && (
                <div className="mb-3.5">
                  <p className="mb-1 text-[11px] font-semibold uppercase text-[#6B7280]">Courier Company</p>
                  <p className="text-[15px] font-semibold">{shipping.deliveryCompany}</p>
                </div>
              )}
              {!!tracking && (
                <div className="mb-3.5">
                  <p className="mb-1 text-[11px] font-semibold uppercase text-[#6B7280]">Tracking Number</p>
                  <button onClick={() => copyTracking(tracking)} className="mt-1 flex w-full items-center rounded-xl border border-white/7 bg-surface-2 px-3.5 py-3">
                    <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{tracking}</span>
                    <span className="ml-3 flex items-center gap-1 border-l border-white/7 pl-3 text-xs font-semibold text-secondary">
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </span>
                  </button>
                </div>
              )}
              {!!sellerNote && (
                <div className="mb-1 rounded-xl bg-surface-2 p-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase text-[#6B7280]">Note from seller</p>
                  <p className="text-[15px] font-semibold">{sellerNote}</p>
                </div>
              )}
              {!!shipping.estimatedDelivery && (
                <div className="mb-1">
                  <p className="mb-1 text-[11px] font-semibold uppercase text-[#6B7280]">Estimated Delivery</p>
                  <p className="text-[15px] font-semibold">{new Date(shipping.estimatedDelivery).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          )}

          {!isCancelled && order.orderStatus === "Preparing" && (
            <div className="mb-3 flex gap-3 rounded-[14px] border border-blue/20 bg-blue/8 p-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-blue/15">
                <Package className="h-[18px] w-[18px] text-blue" />
              </span>
              <div>
                <p className="mb-0.5 text-sm font-bold">Preparing your order</p>
                <p className="text-xs leading-[18px] text-secondary">
                  The seller is packing your items. Tracking and seller notes appear after they mark it as shipped.
                </p>
              </div>
            </div>
          )}

          <div className="mb-3 rounded-2xl border border-white/7 bg-surface p-4">
            <p className="mb-3.5 text-base font-bold">Delivery Address</p>
            <p className="text-sm leading-[22px] text-secondary">
              {order.shippingAddress?.street}
              <br />
              {order.shippingAddress?.city}, {order.shippingAddress?.state}
              <br />
              {order.shippingAddress?.country}
              <br />
              {order.shippingAddress?.zipCode}
            </p>
          </div>

          <div className="rounded-2xl border border-white/7 bg-surface p-4">
            <p className="mb-3.5 text-base font-bold">Receipt</p>
            <div className="mb-2.5 flex justify-between text-[13px]">
              <span className="text-secondary">Subtotal</span>
              <span className="font-semibold">{fmt(Number(order.subtotal) || 0, orderMoneyRegion)}</span>
            </div>
            <div className="mb-2.5 flex justify-between text-[13px]">
              <span className="text-secondary">Delivery</span>
              <span className="font-semibold">{fmt(Number(order.shippingCost) || 0, orderMoneyRegion)}</span>
            </div>
            <div className="my-2 h-px bg-white/7" />
            <div className="flex justify-between">
              <span className="text-sm font-bold">Order Total</span>
              <span className="text-xl font-extrabold tracking-tight">{fmt(Number(order.totalAmount) || 0, orderMoneyRegion)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}