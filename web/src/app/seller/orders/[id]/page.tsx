"use client";

import { useAuth } from "@clerk/nextjs";
import {
  Check,
  ChevronLeft,
  MapPin,
  Package,
  Plane,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMarketplace } from "@/context/MarketplaceContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const GRAD = "linear-gradient(90deg,#00E575,#3B82F6)";
const DEFAULT_REGION = "NG";

const CANCEL_OPTIONS = [
  { code: "out_of_stock", label: "Product is out of stock" },
  { code: "unable_to_deliver", label: "Unable to deliver to the destination" },
  { code: "shipping_limitations", label: "Shipping limitations" },
  { code: "incorrect_inventory", label: "Incorrect inventory" },
  { code: "temporary_closure", label: "Temporary business closure" },
  { code: "other", label: "Other" },
] as const;

type OverlayTone = "info" | "success" | "danger";
type OverlayAction = {
  label: string;
  onPress: () => void;
  primary?: boolean;
  destructive?: boolean;
};
type Overlay = {
  title: string;
  message?: string;
  tone?: OverlayTone;
  actions?: OverlayAction[];
  durationMs?: number;
} | null;

function resolveOrderRegion(order: any, item?: any): string {
  if (item?.product?.region) return String(item.product.region);
  if (item?.region) return String(item.region);
  if (order?.region) return String(order.region);
  if (order?.seller?.marketplaceRegion) return String(order.seller.marketplaceRegion);
  return DEFAULT_REGION;
}

function statusColor(status: string) {
  if (status === "Cancelled") return "#EF4444";
  if (status === "Delivered") return "#00E575";
  if (status === "Shipped") return "#3B82F6";
  return "#F0C070";
}

async function readJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const t = await res.text();
    throw new Error(`Bad response ${res.status}: ${t.slice(0, 80)}`);
  }
  return res.json();
}

function TopOverlay({ state, onDismiss }: { state: Overlay; onDismiss: () => void }) {
  useEffect(() => {
    if (!state || state.actions?.length) return;
    const t = setTimeout(onDismiss, state.durationMs ?? 3800);
    return () => clearTimeout(t);
  }, [state, onDismiss]);

  if (!state) return null;
  const accent =
    state.tone === "danger" ? "#EF4444" : state.tone === "success" ? "#00E575" : "#3B82F6";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[300] flex justify-center px-3.5 pt-3">
      <div className="pointer-events-auto flex w-full max-w-lg overflow-hidden border border-white/10 bg-[#11141A] shadow-2xl">
        <span className="w-[3px] shrink-0" style={{ backgroundColor: accent }} />
        <div className="flex-1 p-3.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-[#F5F7FA]">{state.title}</p>
              {state.message && (
                <p className="mt-1.5 whitespace-pre-line text-[13px] leading-[19px] text-[#A7ADB8]">
                  {state.message}
                </p>
              )}
            </div>
            {!state.actions?.length && (
              <button type="button" onClick={onDismiss} aria-label="Dismiss">
                <X className="h-4 w-4 text-[#737A86]" />
              </button>
            )}
          </div>
          {!!state.actions?.length && (
            <div className="mt-3.5 flex gap-2.5">
              {state.actions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => {
                    onDismiss();
                    setTimeout(() => a.onPress(), 40);
                  }}
                  className={`flex-1 py-3 text-[13px] font-extrabold ${
                    a.primary
                      ? "bg-[#00E575] text-[#041412]"
                      : a.destructive
                        ? "bg-[#EF4444]/12 text-[#EF4444]"
                        : "border border-white/[0.07] bg-[#171B22] text-[#F5F7FA]"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeliveredBurst({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [visible, onDone]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/45">
      <div className="flex flex-col items-center px-6 text-center animate-in fade-in zoom-in duration-300">
        <div
          className="flex h-[88px] w-[88px] items-center justify-center rounded-full p-[3px]"
          style={{ backgroundImage: GRAD }}
        >
          <div className="flex h-full w-full items-center justify-center rounded-full bg-[#090B0F]">
            <Check className="h-9 w-9 text-[#00E575]" strokeWidth={3} />
          </div>
        </div>
        <p className="mt-4 text-[22px] font-extrabold tracking-tight text-[#F5F7FA]">
          Delivered
        </p>
        <p className="mt-1 text-[13px] text-[#A7ADB8]">Buyer will see the update</p>
      </div>
    </div>
  );
}

function OrbLoader() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3.5 bg-[#090B0F]">
      <div className="relative h-[110px] w-[110px]">
        <div className="absolute inset-0 animate-spin rounded-full border-[2.4px] border-transparent border-t-[#00E575] border-r-[#3B82F6] border-l-[#00E575]" />
      </div>
      <p className="text-[13px] text-[#737A86]">Loading order</p>
    </div>
  );
}

export default function SellerOrderDetailsPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const { formatProduct } = useMarketplace();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [trackingNumber, setTrackingNumber] = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [sellerNote, setSellerNote] = useState("");

  const [showCancel, setShowCancel] = useState(false);
  const [cancelCode, setCancelCode] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [overlay, setOverlay] = useState<Overlay>(null);
  const [showDeliveredBurst, setShowDeliveredBurst] = useState(false);

  const toast = useCallback(
    (title: string, message?: string, tone: OverlayTone = "info") => {
      setOverlay({ title, message, tone, durationMs: 3800 });
    },
    []
  );

  const fmt = useCallback(
    (amount: number, fromRegion?: string | null) => {
      try {
        return formatProduct(amount, (fromRegion || DEFAULT_REGION) as any);
      } catch {
        return String(amount);
      }
    },
    [formatProduct]
  );

  const loadOrder = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API}/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await readJson(res);
      if (json?.success) setOrder(json.data);
      else toast("Error", json?.message || "Could not load order", "danger");
    } catch (e: any) {
      console.error(e);
      toast("Error", e?.message || "Could not load order", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, getToken, toast]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      if (isLoaded && !isSignedIn) setLoading(false);
      return;
    }
    loadOrder();
  }, [isLoaded, isSignedIn, loadOrder]);

  const orderMoneyRegion = useMemo(() => {
    if (!order) return DEFAULT_REGION;
    return resolveOrderRegion(order, order.items?.[0]);
  }, [order]);

  const impliedMethod =
    order?.productShipping?.method === "self" ? "self" : "courier";
  const courierName = order?.productShipping?.courierCompany || "";

  const handleShip = async () => {
    if (!estimatedDelivery.trim()) {
      toast("Required", "Enter an estimated delivery date (YYYY-MM-DD)", "danger");
      return;
    }
    try {
      setSubmitting(true);
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const body: any = {
        estimatedDelivery: estimatedDelivery.trim(),
        selfDeliveryNote: sellerNote.trim().slice(0, 120),
      };
      if (impliedMethod === "courier") {
        body.trackingNumber = trackingNumber.trim();
        body.deliveryCompany = courierName;
      }
      const res = await fetch(`${API}/orders/${id}/ship`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = await readJson(res);
      if (json?.success) {
        setOrder(json.data);
        toast("Shipped", "Order marked as shipped. Buyer has been notified.", "success");
      } else {
        toast("Error", json?.message || "Failed to ship order", "danger");
      }
    } catch (e: any) {
      toast("Error", e?.message || "Failed to ship order", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const performDeliver = async () => {
    try {
      setSubmitting(true);
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`${API}/orders/${id}/deliver`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const json = await readJson(res);
      if (json?.success) {
        setOrder(json.data);
        setShowDeliveredBurst(true);
      } else {
        toast("Error", json?.message || "Failed to update status", "danger");
      }
    } catch (e: any) {
      toast("Error", e?.message || "Failed to update status", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const requestDeliver = () => {
    setOverlay({
      title: "Confirm delivery",
      message:
        "Only confirm if the buyer has received this order.\n\n" +
        "• Status will change to Delivered\n" +
        "• The buyer will be notified\n" +
        "• This cannot be undone from here\n\n" +
        "Is this order really delivered?",
      tone: "info",
      actions: [
        { label: "Not yet", onPress: () => {} },
        { label: "Yes, delivered", primary: true, onPress: () => performDeliver() },
      ],
    });
  };

  const handleConfirmCancel = async () => {
    if (!cancelCode) {
      toast("Required", "Select a cancellation reason", "danger");
      return;
    }
    if (cancelCode === "other" && !cancelNote.trim()) {
      toast("Required", "Add a short explanation", "danger");
      return;
    }
    try {
      setCancelling(true);
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`${API}/orders/${id}/cancel`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reasonCode: cancelCode,
          note: cancelNote.trim().slice(0, 200),
        }),
      });
      const json = await readJson(res);
      if (json?.success) {
        setOrder(json.data);
        setShowCancel(false);
        setCancelCode("");
        setCancelNote("");
        toast(
          "Order cancelled",
          "The buyer has been notified with your reason.",
          "success"
        );
      } else {
        toast("Error", json?.message || "Could not cancel order", "danger");
      }
    } catch (e: any) {
      toast("Error", e?.message || "Could not cancel order", "danger");
    } finally {
      setCancelling(false);
    }
  };

  if (!isLoaded || loading) return <OrbLoader />;

  if (!isSignedIn) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center bg-[#090B0F] px-6 text-center">
        <p className="font-semibold text-[#F5F7FA]">Sign in to view this order</p>
        <Link
          href="/sign-in"
          className="mt-4 rounded-full bg-[#F5F7FA] px-6 py-2.5 text-sm font-bold text-[#090B0F]"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center bg-[#090B0F]">
        <p className="text-[#737A86]">Order not found</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 font-bold text-[#00E575]"
        >
          Go back
        </button>
      </div>
    );
  }

  const isPreparing = order.orderStatus === "Preparing";
  const isShipped = order.orderStatus === "Shipped";
  const isDelivered = order.orderStatus === "Delivered";
  const isCancelled = order.orderStatus === "Cancelled";
  const tone = statusColor(order.orderStatus);

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <TopOverlay state={overlay} onDismiss={() => setOverlay(null)} />
      <DeliveredBurst
        visible={showDeliveredBurst}
        onDone={() => {
          setShowDeliveredBurst(false);
          toast("Delivered", "Order marked as delivered.", "success");
        }}
      />

      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#090B0F]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href="/seller/orders"
            className="flex h-10 w-10 items-center justify-center border border-white/[0.07] bg-[#11141A] text-[#A7ADB8] hover:text-[#F5F7FA]"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold tracking-tight">
              {order.orderNumber}
            </h1>
            <p className="mt-0.5 text-xs text-[#737A86]">
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-3.5 px-4 py-4 sm:px-6 lg:px-8">
        {/* Status */}
        <section className="border border-white/[0.07] bg-[#11141A] p-4">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
            Current status
          </p>
          <p className="text-[26px] font-extrabold tracking-tight" style={{ color: tone }}>
            {isCancelled && order.cancellation?.cancelledBy === "seller"
              ? "Cancelled by Seller"
              : order.orderStatus}
          </p>
        </section>

        {isCancelled && order.cancellation && (
          <section className="border border-[#EF4444]/25 bg-[#EF4444]/[0.06] p-4">
            <p className="text-base font-bold text-[#EF4444]">Cancellation</p>
            {!!order.cancellation.cancelledAt && (
              <p className="mt-0.5 text-xs text-[#737A86]">
                {new Date(order.cancellation.cancelledAt).toLocaleString()}
              </p>
            )}
            <p className="mb-1 mt-2.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
              Reason
            </p>
            <p className="text-sm leading-[21px] text-[#A7ADB8]">
              {order.cancellation.reasonLabel || order.cancellation.note || "—"}
            </p>
          </section>
        )}

        {/* Buyer */}
        <section className="border border-white/[0.07] bg-[#11141A] p-4">
          <h2 className="mb-3 text-[17px] font-bold tracking-tight">Buyer</h2>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
            Name
          </p>
          <p className="text-[15px] font-semibold">
            {order.buyerContact?.name || order.buyer?.name || "Buyer"}
          </p>
          <p className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
            Phone
          </p>
          <p className="text-sm text-[#A7ADB8]">
            {order.buyerContact?.phone || order.buyer?.phone || "Not provided"}
          </p>
          <div className="mt-3.5 border border-white/[0.07] bg-[#171B22] p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#3B82F6]" />
              <span className="text-[15px] font-semibold">Delivery address</span>
            </div>
            <p className="text-sm leading-[21px] text-[#A7ADB8]">
              {order.shippingAddress?.street}
              <br />
              {order.shippingAddress?.city}, {order.shippingAddress?.state}{" "}
              {order.shippingAddress?.zipCode}
              <br />
              {order.shippingAddress?.country}
            </p>
          </div>
        </section>

        {/* Products */}
        <p className="ml-0.5 text-[11px] font-bold uppercase tracking-[1.2px] text-[#737A86]">
          Products
        </p>
        {order.items?.map((item: any, index: number) => {
          const itemRegion = resolveOrderRegion(order, item);
          const unit = Number(item.price) || 0;
          return (
            <section
              key={index}
              className="border border-white/[0.07] bg-[#11141A] p-4"
            >
              <div className="flex gap-3">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt=""
                    className="h-16 w-16 object-cover bg-[#171B22]"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center bg-[#171B22]">
                    <Package className="h-5 w-5 text-[#737A86]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[15px] font-semibold">{item.name}</p>
                  <p className="mt-0.5 text-xs text-[#737A86]">
                    Qty: {item.quantity} · {fmt(unit, itemRegion)}
                  </p>
                </div>
              </div>
              <div className="mt-3 bg-[#171B22] p-3">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                  Buyer note
                </p>
                <p className="text-sm leading-[21px] text-[#A7ADB8]">
                  {item.note?.trim() ? item.note : "No buyer note."}
                </p>
              </div>
            </section>
          );
        })}

        {/* Preparing */}
        {isPreparing && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col items-center border border-white/[0.07] bg-[#11141A] py-3.5">
                <Plane className="h-5 w-5 text-[#3B82F6]" />
                <p className="mt-1.5 text-[13px] font-bold">Ship order</p>
                <p className="mt-0.5 text-[10px] text-[#737A86]">Use form below</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCancel(true)}
                className="flex flex-col items-center border border-[#EF4444]/28 bg-[#EF4444]/[0.08] py-3.5"
              >
                <XCircle className="h-5 w-5 text-[#EF4444]" />
                <p className="mt-1.5 text-[13px] font-bold text-[#EF4444]">Cancel</p>
              </button>
            </div>

            <section className="border border-white/[0.07] bg-[#11141A] p-4">
              <h2 className="mb-1 text-[17px] font-bold tracking-tight">Ship this order</h2>
              <p className="mb-3.5 text-xs text-[#737A86]">
                Delivery method was set when the product was published.
              </p>

              <div className="mb-4 flex items-center gap-2 border border-white/[0.07] bg-[#171B22] px-3 py-3">
                {impliedMethod === "self" ? (
                  <Package className="h-[18px] w-[18px] text-[#3B82F6]" />
                ) : (
                  <Truck className="h-[18px] w-[18px] text-[#3B82F6]" />
                )}
                <span className="font-semibold">
                  {impliedMethod === "self"
                    ? "Self delivery"
                    : `Courier${courierName ? ` · ${courierName}` : ""}`}
                </span>
              </div>

              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                Estimated delivery date *
              </p>
              <input
                type="date"
                value={estimatedDelivery}
                onChange={(e) => setEstimatedDelivery(e.target.value)}
                className="mb-3 w-full rounded-[14px] border border-white/[0.07] bg-[#0A121C] px-3.5 py-[13px] text-[15px] text-[#F5F7FA] outline-none focus:border-[#00E575]/40"
              />

              {impliedMethod === "courier" && (
                <>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                    Tracking number
                  </p>
                  <input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Optional"
                    className="mb-3 w-full rounded-[14px] border border-white/[0.07] bg-[#0A121C] px-3.5 py-[13px] text-[15px] text-[#F5F7FA] outline-none placeholder:text-[#3D5268] focus:border-[#00E575]/40"
                  />
                </>
              )}

              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                Note to buyer
              </p>
              <textarea
                value={sellerNote}
                onChange={(e) => setSellerNote(e.target.value.slice(0, 120))}
                placeholder="Optional note"
                rows={3}
                className="mb-1 w-full rounded-[14px] border border-white/[0.07] bg-[#0A121C] px-3.5 py-[13px] text-[15px] text-[#F5F7FA] outline-none placeholder:text-[#3D5268] focus:border-[#00E575]/40"
              />
              <p className="mb-2 text-right text-[11px] text-[#737A86]">
                {sellerNote.length}/120
              </p>

              <button
                type="button"
                onClick={handleShip}
                disabled={submitting}
                className="flex h-[50px] w-full items-center justify-center text-[15px] font-extrabold text-[#041412] disabled:opacity-60"
                style={{ backgroundImage: GRAD }}
              >
                {submitting ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#041412]/30 border-t-[#041412]" />
                ) : (
                  "Mark as shipped"
                )}
              </button>
            </section>
          </>
        )}

        {(isShipped || isDelivered) && order.shipping && (
          <section className="border border-white/[0.07] bg-[#11141A] p-4">
            <h2 className="mb-3 text-[17px] font-bold tracking-tight">Shipping info</h2>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
              Method
            </p>
            <p className="text-sm text-[#A7ADB8]">
              {order.shipping.shippingMethod === "self" ? "Self delivery" : "Courier"}
            </p>
            {!!order.shipping.deliveryCompany && (
              <>
                <p className="mb-1 mt-2.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                  Courier
                </p>
                <p className="text-sm text-[#A7ADB8]">{order.shipping.deliveryCompany}</p>
              </>
            )}
            {!!order.shipping.trackingNumber && (
              <>
                <p className="mb-1 mt-2.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                  Tracking
                </p>
                <p className="text-sm text-[#A7ADB8]">{order.shipping.trackingNumber}</p>
              </>
            )}
            {!!order.shipping.estimatedDelivery && (
              <>
                <p className="mb-1 mt-2.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                  Estimated delivery
                </p>
                <p className="text-sm text-[#A7ADB8]">
                  {new Date(order.shipping.estimatedDelivery).toLocaleDateString()}
                </p>
              </>
            )}
            {!!order.shipping.selfDeliveryNote && (
              <>
                <p className="mb-1 mt-2.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                  Note
                </p>
                <p className="text-sm text-[#A7ADB8]">{order.shipping.selfDeliveryNote}</p>
              </>
            )}
          </section>
        )}

        {isShipped && (
          <button
            type="button"
            onClick={requestDeliver}
            disabled={submitting}
            className="flex h-[50px] w-full items-center justify-center bg-gradient-to-r from-[#00E575] to-teal-500 text-[15px] font-extrabold text-[#041412] disabled:opacity-60"
          >
            {submitting ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#041412]/30 border-t-[#041412]" />
            ) : (
              "Mark as delivered"
            )}
          </button>
        )}

        {/* Totals */}
        <section className="border border-white/[0.07] bg-[#11141A] p-4">
          <div className="mb-1.5 flex justify-between text-xs text-[#737A86]">
            <span>Subtotal</span>
            <span className="text-sm text-[#A7ADB8]">
              {fmt(Number(order.subtotal) || 0, orderMoneyRegion)}
            </span>
          </div>
          <div className="mb-2 flex justify-between text-xs text-[#737A86]">
            <span>Delivery</span>
            <span className="text-sm text-[#A7ADB8]">
              {fmt(Number(order.shippingCost) || 0, orderMoneyRegion)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-[#737A86]">Total</span>
            <span className="text-lg font-extrabold">
              {fmt(Number(order.totalAmount) || 0, orderMoneyRegion)}
            </span>
          </div>
        </section>
      </div>

      {/* Cancel sheet */}
      {showCancel && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/65 sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => setShowCancel(false)}
          />
          <div className="relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto border-t border-white/[0.07] bg-[#11141A] px-[18px] pb-7 pt-2.5 sm:border">
            <div className="mx-auto mb-3 h-1 w-9 rounded-sm bg-white/10 sm:hidden" />
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[17px] font-bold">Cancel order</h2>
              <button type="button" onClick={() => setShowCancel(false)}>
                <X className="h-[22px] w-[22px] text-[#737A86]" />
              </button>
            </div>
            <p className="mb-3.5 text-xs text-[#737A86]">
              Choose a reason. The buyer will see this on their order.
            </p>
            {CANCEL_OPTIONS.map((opt) => {
              const selected = cancelCode === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => setCancelCode(opt.code)}
                  className={`mb-2 flex w-full items-center gap-3 border px-3 py-3 text-left ${
                    selected
                      ? "border-[#3B82F6]/45 bg-[#171B22]"
                      : "border-white/[0.07] bg-[#0A121C]"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected ? "border-[#3B82F6]" : "border-[#737A86]"
                    }`}
                  >
                    {selected && (
                      <span className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />
                    )}
                  </span>
                  <span
                    className={`text-sm ${
                      selected
                        ? "font-semibold text-[#F5F7FA]"
                        : "text-[#A7ADB8]"
                    }`}
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
            {cancelCode === "other" && (
              <textarea
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value.slice(0, 200))}
                placeholder="Short explanation…"
                rows={3}
                className="mt-2 w-full rounded-[14px] border border-white/[0.07] bg-[#0A121C] px-3.5 py-3 text-[15px] text-[#F5F7FA] outline-none placeholder:text-[#3D5268]"
              />
            )}
            <button
              type="button"
              onClick={handleConfirmCancel}
              disabled={cancelling}
              className="mt-3 flex h-[50px] w-full items-center justify-center bg-[#EF4444] text-[15px] font-extrabold text-[#1A0A0C] disabled:opacity-60"
            >
              {cancelling ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#1A0A0C]/30 border-t-[#1A0A0C]" />
              ) : (
                "Confirm cancellation"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}