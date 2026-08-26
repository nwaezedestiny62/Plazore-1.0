"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Receipt, SlidersHorizontal } from "lucide-react";
import { DEFAULT_REGION, formatMoney } from "@/lib/regions";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const HIDDEN_KEY = "plazore_hidden_completed_orders";

const statusColor: Record<string, string> = {
  Preparing: "#F0C070",
  Shipped: "#3B82F6",
  Delivered: "#00E575",
  Cancelled: "#EF4444",
};
const STATUS_ORDER = ["Preparing", "Shipped", "Delivered", "Cancelled"];
type SortMode = "newest" | "oldest" | "status";

type OrderRow = {
  _id: string;
  orderNumber?: string;
  orderStatus?: string;
  createdAt?: string;
  totalAmount?: number;
  items?: unknown[];
  seller?: { storeName?: string; name?: string };
};

export default function OrdersPage() {
  const router = useRouter();
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortMode>("newest");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p)) setHiddenIds(p.map(String));
      }
    } catch {}
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setOrders(json.data || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    fetchOrders();
  }, [isLoaded, isSignedIn, fetchOrders, router]);

  const sorted = useMemo(() => {
    const hidden = new Set(hiddenIds);
    const list = orders.filter((o) => !hidden.has(String(o._id)));
    if (sort === "newest") list.sort((a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0));
    else if (sort === "oldest") list.sort((a, b) => +new Date(a.createdAt || 0) - +new Date(b.createdAt || 0));
    else list.sort((a, b) => STATUS_ORDER.indexOf(a.orderStatus || "") - STATUS_ORDER.indexOf(b.orderStatus || ""));
    return list;
  }, [orders, hiddenIds, sort]);

  const clearCompleted = () => {
    const completed = orders.filter((o) => o.orderStatus === "Delivered" || o.orderStatus === "Cancelled");
    if (!completed.length) {
      window.alert("No Delivered or Cancelled orders to hide.");
      return;
    }
    if (!window.confirm(`Hide ${completed.length} completed order(s) from this list? They remain in your history.`)) return;
    const next = Array.from(new Set([...hiddenIds, ...completed.map((o) => String(o._id))]));
    setHiddenIds(next);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    setMenu(false);
  };

  if (!isLoaded || (loading && isSignedIn)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-[110px] w-[110px] animate-spin rounded-full border-[2.4px] border-transparent border-l-green border-r-blue border-t-green" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="flex items-center justify-between border-b border-white/7 px-2.5 py-2.5">
        <div className="flex items-center gap-1">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center">
            <ChevronLeft className="h-[22px] w-[22px]" />
          </button>
          <div>
            <p className="text-xl font-extrabold tracking-tight">My Orders</p>
            <p className="text-[11px] text-[#6B7280]">
              {sorted.length} order{sorted.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="relative mr-1.5">
          <button
            onClick={() => setMenu((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/7 bg-surface"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
          {menu && (
            <div className="absolute right-0 z-20 mt-2 w-56 border border-white/7 bg-surface py-1">
              {([
                ["newest", "Sort by Newest"],
                ["oldest", "Sort by Oldest"],
                ["status", "Sort by Status"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => { setSort(id); setMenu(false); }}
                  className={`block w-full px-4 py-2.5 text-left text-sm ${sort === id ? "text-green" : "text-secondary"}`}
                >
                  {label}
                </button>
              ))}
              <button onClick={clearCompleted} className="block w-full px-4 py-2.5 text-left text-sm text-red-500">
                Clear Completed Orders
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-4">
        {sorted.length === 0 ? (
          <div className="mt-20 px-7 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-white/7 bg-surface">
              <Receipt className="h-9 w-9 text-[#6B7280]" />
            </div>
            <p className="text-[17px] font-bold">No orders yet</p>
            <p className="mt-1.5 text-[13px] leading-5 text-secondary">When you place an order, it will show up here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((item) => {
              const count = item.items?.length || 0;
              const color = statusColor[item.orderStatus || ""] || "#6B7280";
              return (
                <Link key={item._id} href={`/orders/${item._id}`} className="block rounded-2xl border border-white/7 bg-surface p-4">
                  <div className="mb-2 flex items-center justify-between gap-2.5">
                    <p className="truncate text-[15px] font-bold">{item.orderNumber}</p>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: color + "18" }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
                        {item.orderStatus}
                      </span>
                    </span>
                  </div>
                  <p className="mb-2.5 text-[13px] text-secondary">
                    {item.seller?.storeName || item.seller?.name || "Seller"}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold">
                      {count} item{count !== 1 ? "s" : ""} · {formatMoney(Number(item.totalAmount) || 0, DEFAULT_REGION)}
                    </p>
                    <p className="text-[11px] text-[#6B7280]">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}