"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMarketplace } from "@/context/MarketplaceContext";
import { DEFAULT_REGION, formatMoney as formatMoneyRegion, formatProductPrice } from "@/lib/regions";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  Layers,
  Receipt,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const HIDDEN_KEY = "@plazore_hidden_completed_orders";

const statusColor: Record<string, string> = {
  Preparing: "#F0C070",
  Shipped: "#3B82F6",
  Delivered: "#00E575",
  Cancelled: "#EF4444",
};

const STATUS_ORDER = ["Preparing", "Shipped", "Delivered", "Cancelled"];

type SortMode = "newest" | "oldest" | "status";

type Order = {
  _id: string;
  orderNumber?: string;
  orderStatus?: string;
  totalAmount?: number;
  createdAt?: string;
  items?: unknown[];
  seller?: { storeName?: string; name?: string };
};


function OrbLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090B0F]">
      <div className="relative flex h-[110px] w-[110px] items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-[2.4px] border-transparent border-t-[#00E575] border-r-[#3B82F6] border-l-[#00E575]" />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00E575]/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortMode>("newest");
  const [configOpen, setConfigOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadHidden = useCallback(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setHiddenIds(parsed.map(String));
    } catch {
      /* ignore */
    }
  }, []);

  const { region: marketplaceRegion } = useMarketplace();
const displayRegion = marketplaceRegion || DEFAULT_REGION;

const formatOrderTotal = (amount: number, order?: Order & { region?: string; seller?: { marketplaceRegion?: string } }) => {
  const from =
    order?.region ||
    (order?.seller as { marketplaceRegion?: string } | undefined)?.marketplaceRegion ||
    displayRegion;
  if (from && from !== displayRegion) {
    return formatProductPrice(Number(amount) || 0, from, displayRegion);
  }
  return formatMoneyRegion(Number(amount) || 0, displayRegion);
};

  const fetchOrders = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.success) setOrders(json.data || []);
    } catch {
      /* keep list */
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    loadHidden();
    fetchOrders();
  }, [isLoaded, isSignedIn, loadHidden, fetchOrders, router]);

  const visibleOrders = useMemo(() => {
    const hidden = new Set(hiddenIds);
    return orders.filter((o) => !hidden.has(String(o._id)));
  }, [orders, hiddenIds]);

  const sorted = useMemo(() => {
    const list = [...visibleOrders];
    if (sort === "newest") {
      list.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
    } else if (sort === "oldest") {
      list.sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
      );
    } else {
      list.sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.orderStatus || "") -
          STATUS_ORDER.indexOf(b.orderStatus || ""),
      );
    }
    return list;
  }, [visibleOrders, sort]);

  const completed = orders.filter(
    (o) => o.orderStatus === "Delivered" || o.orderStatus === "Cancelled",
  );

  const clearCompleted = () => {
    if (completed.length === 0) {
      setNotice("No Delivered or Cancelled orders to hide.");
      setConfirmClear(false);
      setConfigOpen(false);
      return;
    }
    try {
      const idsToHide = completed.map((o) => String(o._id));
      const next = Array.from(new Set([...hiddenIds, ...idsToHide]));
      setHiddenIds(next);
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      setConfirmClear(false);
      setConfigOpen(false);
    } catch {
      setNotice("Could not save preference. Try again.");
    }
  };

  if (!isLoaded || (loading && isSignedIn)) return <OrbLoader />;

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.07] bg-[#090B0F]/95 px-2 py-2.5 backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 shrink-0 items-center justify-center"
            aria-label="Back"
          >
            <ChevronLeft className="h-[22px] w-[22px]" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight">My Orders</h1>
            <p className="text-[11px] text-[#6B7280]">
              {sorted.length} order{sorted.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfigOpen(true)}
          className="mr-1.5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-[#11141A]"
          aria-label="Order options"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
        {notice ? (
          <p className="mb-4 border border-white/10 bg-[#11141A] px-3 py-2 text-[13px] text-[#A7ADB8]">
            {notice}
          </p>
        ) : null}

        {sorted.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center px-7 pt-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.07] bg-[#11141A]">
              <Receipt className="h-9 w-9 text-[#6B7280]" />
            </div>
            <h2 className="text-[17px] font-bold">No orders yet</h2>
            <p className="mt-1.5 text-[13px] leading-5 text-[#A7ADB8]">
              When you place an order, it will show up here.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {sorted.map((item) => {
              const count = item.items?.length || 0;
              const color = statusColor[item.orderStatus || ""] || "#6B7280";
              return (
                <li key={item._id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/orders/${item._id}`)}
                    className="w-full rounded-2xl border border-white/[0.07] bg-[#11141A] p-4 text-left"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2.5">
                      <p className="min-w-0 flex-1 truncate text-[15px] font-bold">
                        {item.orderNumber}
                      </p>
                      <span
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1"
                        style={{ backgroundColor: `${color}18` }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                        <span
                          className="text-[11px] font-bold uppercase tracking-wide"
                          style={{ color }}
                        >
                          {item.orderStatus}
                        </span>
                      </span>
                    </div>
                    <p className="mb-2.5 truncate text-[13px] text-[#A7ADB8]">
                      {item.seller?.storeName || item.seller?.name || "Seller"}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold">
                       {count} item{count !== 1 ? "s" : ""} · {formatOrderTotal(Number(item.totalAmount) || 0, item)}
                      </p>
                      <p className="text-[11px] text-[#6B7280]">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {configOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/72 sm:items-center sm:p-6">
          <div className="w-full max-w-sm overflow-hidden border-t border-white/[0.07] bg-[#11141A] sm:border">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-base font-bold">Order options</h2>
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="flex h-8 w-8 items-center justify-center border border-white/[0.07] bg-[#171B22]"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-[#A7ADB8]" />
              </button>
            </div>
            {(
              [
                { id: "newest" as const, label: "Sort by Newest", Icon: ArrowDown },
                { id: "oldest" as const, label: "Sort by Oldest", Icon: ArrowUp },
                { id: "status" as const, label: "Sort by Status", Icon: Layers },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSort(opt.id);
                  setConfigOpen(false);
                }}
                className="flex w-full items-center gap-3 border-t border-white/[0.07] px-5 py-3.5 text-left"
              >
                <opt.Icon className="h-4 w-4 text-[#A7ADB8]" />
                <span className="flex-1 text-sm font-semibold">{opt.label}</span>
                {sort === opt.id ? <Check className="h-4 w-4 text-[#00E575]" /> : null}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setConfigOpen(false);
                if (completed.length === 0) {
                  setNotice("No Delivered or Cancelled orders to hide.");
                  return;
                }
                setConfirmClear(true);
              }}
              className="flex w-full items-center gap-3 border-t border-white/[0.07] px-5 py-3.5 text-left text-[#EF4444]"
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-sm font-semibold">Clear Completed Orders</span>
            </button>
          </div>
        </div>
      ) : null}

      {confirmClear ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-5">
          <div className="w-full max-w-sm border border-white/[0.07] bg-[#11141A] p-5">
            <h3 className="text-base font-bold">Clear completed</h3>
            <p className="mt-2 text-sm leading-5 text-[#A7ADB8]">
              Hide {completed.length} completed order{completed.length !== 1 ? "s" : ""} from this
              list permanently? They remain in your history on the server.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="flex-1 border border-white/[0.07] bg-[#171B22] py-3 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={clearCompleted}
                className="flex-1 bg-[#EF4444] py-3 text-sm font-extrabold text-white"
              >
                Hide permanently
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}