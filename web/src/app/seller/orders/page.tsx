"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Receipt, SlidersHorizontal, X } from "lucide-react";
import { useMarketplace } from "@/context/MarketplaceContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  Preparing: { color: "#F0C070", bg: "rgba(240,192,112,0.12)", label: "Preparing" },
  Shipped: { color: "#3B82F6", bg: "rgba(59,130,246,0.12)", label: "Shipped" },
  Delivered: { color: "#00E575", bg: "rgba(0,229,117,0.12)", label: "Delivered" },
  Cancelled: { color: "#EF4444", bg: "rgba(239,68,68,0.12)", label: "Cancelled" },
};

const STATUS_ORDER = ["Preparing", "Shipped", "Delivered", "Cancelled"];
type OrderSort = "newest" | "oldest" | "status" | "delivery";
const SORT_LABEL: Record<OrderSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  status: "Status",
  delivery: "Delivery date",
};

type OverlayState = {
  title: string;
  message?: string;
  tone?: "info" | "success" | "danger";
  actions?: { label: string; onPress: () => void; primary?: boolean }[];
  durationMs?: number;
} | null;

type SellerOrder = {
  _id: string;
  orderNumber?: string;
  orderStatus?: string;
  totalAmount?: number;
  createdAt?: string;
  buyer?: { name?: string };
  user?: { name?: string };
  items?: unknown[];
  shipping?: { estimatedDelivery?: string };
};

function OrbLoader() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div className="relative h-[110px] w-[110px]">
        <div className="absolute inset-0 animate-spin rounded-full border-[2.4px] border-transparent border-t-[#00E575] border-r-[#3B82F6] border-l-[#00E575]" />
      </div>
      <p className="text-[13px] text-[#737A86]">Loading orders…</p>
    </div>
  );
}

function TopOverlay({ state, onDismiss }: { state: OverlayState; onDismiss: () => void }) {
  useEffect(() => {
    if (!state || state.actions?.length) return;
    const t = setTimeout(onDismiss, state.durationMs ?? 5000);
    return () => clearTimeout(t);
  }, [state, onDismiss]);
  if (!state) return null;
  const accent =
    state.tone === "danger" ? "bg-[#EF4444]" : state.tone === "success" ? "bg-[#00E575]" : "bg-[#3B82F6]";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3.5 pt-3">
      <div className="pointer-events-auto flex w-full max-w-lg overflow-hidden border border-white/10 bg-[#11141A]">
        <span className={`w-[3px] shrink-0 ${accent}`} />
        <div className="flex-1 p-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{state.title}</p>
              {state.message ? <p className="mt-1 text-[12.5px] text-[#A7ADB8]">{state.message}</p> : null}
            </div>
            {!state.actions?.length ? (
              <button type="button" onClick={onDismiss} aria-label="Dismiss">
                <X className="h-4 w-4 text-[#737A86]" />
              </button>
            ) : null}
          </div>
          {state.actions?.length ? (
            <div className="mt-3 flex justify-end gap-2">
              {state.actions.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onDismiss();
                    requestAnimationFrame(() => a.onPress());
                  }}
                  className={`min-w-[72px] px-3.5 py-2 text-[13px] font-bold ${
                    a.primary ? "bg-[#F5F7FA] text-[#090B0F]" : "border border-white/[0.07] bg-[#171B22]"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function SellerOrdersPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { format } = useMarketplace();

  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<OrderSort>("newest");
  const [configOpen, setConfigOpen] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [overlay, setOverlay] = useState<OverlayState>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API}/orders/seller/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.success) setOrders(json.data || []);
    } catch {
      /* keep */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const visible = useMemo(() => {
    if (!hideCompleted) return orders;
    return orders.filter((o) => o.orderStatus !== "Delivered" && o.orderStatus !== "Cancelled");
  }, [orders, hideCompleted]);

  const sorted = useMemo(() => {
    const list = [...visible];
    switch (sort) {
      case "oldest":
        list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        break;
      case "status":
        list.sort(
          (a, b) =>
            STATUS_ORDER.indexOf(String(a.orderStatus)) - STATUS_ORDER.indexOf(String(b.orderStatus)),
        );
        break;
      case "delivery":
        list.sort((a, b) => {
          const da = a.shipping?.estimatedDelivery
            ? new Date(a.shipping.estimatedDelivery).getTime()
            : Number.MAX_SAFE_INTEGER;
          const db = b.shipping?.estimatedDelivery
            ? new Date(b.shipping.estimatedDelivery).getTime()
            : Number.MAX_SAFE_INTEGER;
          return da - db;
        });
        break;
      default:
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }
    return list;
  }, [visible, sort]);

  const counts = useMemo(() => {
    const c = { Preparing: 0, Shipped: 0, Delivered: 0, Cancelled: 0 };
    for (const o of orders) {
      const k = o.orderStatus as keyof typeof c;
      if (c[k] !== undefined) c[k]++;
    }
    return c;
  }, [orders]);

  const applySort = (key: OrderSort) => {
    setSort(key);
    setConfigOpen(false);
    setOverlay({ title: `Sorted by ${SORT_LABEL[key]}`, tone: "success", durationMs: 2200 });
  };

  const confirmArchive = () => {
    setConfigOpen(false);
    setOverlay({
      title: hideCompleted ? "Show all orders?" : "Hide completed orders?",
      message: hideCompleted
        ? "Delivered and Cancelled orders will appear again."
        : "Delivered and Cancelled orders will be hidden on this device.",
      tone: "info",
      actions: [
        { label: "Cancel", onPress: () => {} },
        {
          label: hideCompleted ? "Show all" : "Hide them",
          primary: true,
          onPress: () => {
            setHideCompleted((v) => !v);
            setOverlay({
              title: hideCompleted ? "Showing all orders" : "Completed orders hidden",
              tone: "success",
              durationMs: 2500,
            });
          },
        },
      ],
    });
  };

  if (loading) return <OrbLoader />;

  return (
    <div className="min-h-screen">
      <TopOverlay state={overlay} onDismiss={() => setOverlay(null)} />

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.07] bg-[#090B0F]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight">Incoming Orders</h1>
          <p className="mt-0.5 text-xs text-[#737A86]">
            {sorted.length} shown
            {hideCompleted ? " · completed hidden" : ""} · {SORT_LABEL[sort]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              fetchOrders();
            }}
            className="hidden border border-white/[0.07] bg-[#11141A] px-3 py-2 text-xs font-semibold text-[#A7ADB8] sm:inline-flex"
          >
            {refreshing ? "…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            className="flex h-10 w-10 items-center justify-center border border-white/[0.07] bg-[#11141A]"
            aria-label="Options"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-wrap gap-2">
          {(["Preparing", "Shipped", "Delivered"] as const).map((s) => (
            <span
              key={s}
              className="px-2.5 py-1.5 text-[11px] font-bold"
              style={{ backgroundColor: STATUS_META[s].bg, color: STATUS_META[s].color }}
            >
              {counts[s]} {STATUS_META[s].label}
            </span>
          ))}
        </div>

        {sorted.length === 0 ? (
          <div className="mx-auto flex max-w-sm flex-col items-center px-6 pt-16 text-center">
            <div className="mb-3.5 flex h-16 w-16 items-center justify-center border border-white/[0.07] bg-[#11141A]">
              <Receipt className="h-8 w-8 text-[#737A86]" />
            </div>
            <h2 className="text-[17px] font-bold">No orders yet</h2>
            <p className="mt-1.5 text-[13px] text-[#737A86]">When buyers place orders, they land here.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden border border-white/[0.07] bg-[#11141A] lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/[0.07] text-[11px] font-bold uppercase tracking-wide text-[#737A86]">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Buyer</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => {
                    const meta = STATUS_META[item.orderStatus || ""] || {
                      color: "#737A86",
                      bg: "#171B22",
                      label: item.orderStatus || "Order",
                    };
                    return (
                      <tr
                        key={item._id}
                        onClick={() => router.push(`/seller/orders/${item._id}`)}
                        className="cursor-pointer border-b border-white/[0.07] last:border-0 hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-3.5 font-bold">{item.orderNumber || "Order"}</td>
                        <td className="px-4 py-3.5 text-[#A7ADB8]">
                          {item.buyer?.name || item.user?.name || "Buyer"} · {item.items?.length || 0} item
                          {(item.items?.length || 0) !== 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide"
                            style={{ backgroundColor: meta.bg, color: meta.color }}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-[#00E575]">
                          {format(Number(item.totalAmount) || 0)}
                        </td>
                        <td className="px-4 py-3.5 text-[#737A86]">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="space-y-2.5 lg:hidden">
              {sorted.map((item) => {
                const meta = STATUS_META[item.orderStatus || ""] || {
                  color: "#737A86",
                  bg: "#171B22",
                  label: item.orderStatus || "Order",
                };
                return (
                  <li key={item._id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/seller/orders/${item._id}`)}
                      className="w-full border border-white/[0.07] bg-[#11141A] p-3.5 text-left"
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <span className="min-w-0 truncate text-[15px] font-bold">
                          {item.orderNumber || "Order"}
                        </span>
                        <span
                          className="shrink-0 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide"
                          style={{ backgroundColor: meta.bg, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-2 text-[13px] text-[#A7ADB8]">
                        {item.buyer?.name || item.user?.name || "Buyer"} · {item.items?.length || 0} item
                        {(item.items?.length || 0) !== 1 ? "s" : ""}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="text-[15px] font-bold text-[#00E575]">
                          {format(Number(item.totalAmount) || 0)}
                        </span>
                        <span className="text-xs text-[#737A86]">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {configOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/72 sm:items-center sm:p-6">
          <div className="w-full max-w-sm border-t border-white/[0.07] bg-[#11141A] sm:border">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-base font-bold">Order options</h2>
              <button type="button" onClick={() => setConfigOpen(false)} aria-label="Close">
                <X className="h-4 w-4 text-[#A7ADB8]" />
              </button>
            </div>
            {(Object.keys(SORT_LABEL) as OrderSort[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => applySort(key)}
                className="flex w-full items-center justify-between border-t border-white/[0.07] px-5 py-3.5 text-left text-sm font-semibold"
              >
                Sort by {SORT_LABEL[key]}
                {sort === key ? <Check className="h-4 w-4 text-[#00E575]" /> : null}
              </button>
            ))}
            <button
              type="button"
              onClick={confirmArchive}
              className="flex w-full border-t border-white/[0.07] px-5 py-3.5 text-left text-sm font-semibold"
            >
              {hideCompleted ? "Show completed orders" : "Hide completed orders"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}