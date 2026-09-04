"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGrid, List, RefreshCw, WifiOff, X } from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Input,
  Panel,
  Select,
  cn,
} from "@/components/ui";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type OrderItem = {
  product?: string | { _id?: string; name?: string; images?: string[]; price?: number };
  name?: string;
  quantity?: number;
  price?: number;
  image?: string;
  note?: string;
};

type OrderRow = {
  _id: string;
  orderNumber?: string;
  orderStatus?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  totalAmount?: number;
  subtotal?: number;
  shippingCost?: number;
  createdAt?: string;
  updatedAt?: string;
  deliveredAt?: string;
  buyerNote?: string;
  buyer?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
    marketplaceRegion?: string;
  };
  seller?: {
    _id?: string;
    name?: string;
    storeName?: string;
    email?: string;
    phone?: string;
    marketplaceRegion?: string;
    isSellerSuspended?: boolean;
  };
  buyerContact?: { name?: string; phone?: string };
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  items?: OrderItem[];
  productShipping?: {
    method?: string;
    courierCompany?: string;
    deliveryFee?: number;
  };
  shipping?: {
    shippingMethod?: string;
    deliveryCompany?: string;
    trackingNumber?: string;
    estimatedDelivery?: string;
    selfDeliveryNote?: string;
    shippedAt?: string;
  };
  cancellation?: {
    cancelledBy?: string;
    reasonCode?: string;
    reasonLabel?: string;
    note?: string;
    cancelledAt?: string;
    refundStatus?: string;
  };
};

type Counts = {
  all: number;
  Preparing: number;
  Shipped: number;
  Delivered: number;
  Cancelled: number;
};

/** Always show Plazore order code: PLZ#48291 */
function formatPlz(order: OrderRow | null | undefined) {
  if (!order) return "PLZ#—";
  const raw = (order.orderNumber || "").trim();
  if (raw) {
    if (raw.toUpperCase().startsWith("PLZ#")) return raw.toUpperCase();
    if (raw.toUpperCase().startsWith("PLZ"))
      return raw.replace(/^PLZ/i, "PLZ#").toUpperCase();
    return `PLZ#${raw.replace(/^#/, "")}`;
  }
  return `PLZ#${String(order._id).slice(-5).toUpperCase()}`;
}

function fmtDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function statusTone(s?: string): "green" | "error" | "blue" | "warn" | "neutral" {
  if (s === "Delivered") return "green";
  if (s === "Cancelled") return "error";
  if (s === "Shipped") return "blue";
  if (s === "Preparing") return "warn";
  return "neutral";
}

function payTone(s?: string): "green" | "error" | "blue" | "warn" | "neutral" {
  if (s === "paid") return "green";
  if (s === "failed") return "error";
  if (s === "refunded") return "blue";
  if (s === "pending") return "warn";
  return "neutral";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737A86]">
        {label}
      </p>
      <div className="mt-1 break-words text-sm text-[#F5F7FA]">
        {children ?? "—"}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#737A86]">
      {children}
    </p>
  );
}

/** Visual order flow: Preparing → Shipped → Delivered (or Cancelled branch) */
function OrderFlow({ order }: { order: OrderRow }) {
  const status = order.orderStatus || "Preparing";
  const cancelled = status === "Cancelled";
  const steps = [
    {
      key: "placed",
      label: "Placed",
      at: order.createdAt,
      done: true,
    },
    {
      key: "Preparing",
      label: "Preparing",
      at: order.createdAt,
      done: ["Preparing", "Shipped", "Delivered"].includes(status) || cancelled,
    },
    {
      key: "Shipped",
      label: "Shipped",
      at: order.shipping?.shippedAt,
      done: ["Shipped", "Delivered"].includes(status),
    },
    {
      key: "Delivered",
      label: "Delivered",
      at: order.deliveredAt,
      done: status === "Delivered",
    },
  ];

  return (
    <div className="space-y-3">
      {cancelled && (
        <div className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          Cancelled
          {order.cancellation?.cancelledAt
            ? ` · ${fmtDate(order.cancellation.cancelledAt)}`
            : ""}
          {order.cancellation?.cancelledBy
            ? ` · by ${order.cancellation.cancelledBy}`
            : ""}
        </div>
      )}
      <ol className="space-y-0">
        {steps.map((step, i) => {
          const active = step.key === status || (step.key === "placed" && true);
          const isCurrent = step.key === status;
          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                    step.done
                      ? "border-[#00E575]/50 bg-[#00E575]/15 text-[#00E575]"
                      : "border-[#252A33] bg-[#171B22] text-[#737A86]",
                    isCurrent && !cancelled && "ring-2 ring-[#00E575]/40"
                  )}
                >
                  {step.done ? "✓" : i + 1}
                </span>
                {i < steps.length - 1 && (
                  <span
                    className={cn(
                      "my-0.5 w-px flex-1 min-h-[16px]",
                      step.done ? "bg-[#00E575]/40" : "bg-[#252A33]"
                    )}
                  />
                )}
              </div>
              <div className="pb-4">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.done ? "text-[#F5F7FA]" : "text-[#737A86]"
                  )}
                >
                  {step.label}
                  {isCurrent && !cancelled ? (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-[#00E575]">
                      Current
                    </span>
                  ) : null}
                </p>
                <p className="text-[11px] text-[#737A86]">
                  {step.at ? fmtDate(step.at) : step.done ? "—" : "Pending"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function OrdersPage() {
  const { getToken } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [offline, setOffline] = useState(false);

  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState("newest");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");

  const [items, setItems] = useState<OrderRow[]>([]);
  const [counts, setCounts] = useState<Counts>({
    all: 0,
    Preparing: 0,
    Shipped: 0,
    Delivered: 0,
    Cancelled: 0,
  });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);

  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paneOpen, setPaneOpen] = useState(false);

  const cacheRef = useRef<{
    items: OrderRow[];
    counts: Counts;
    total: number;
    pages: number;
    page: number;
  } | null>(null);

  const showOffline = mounted && offline;

  useEffect(() => {
    setMounted(true);
    const sync = () =>
      setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const load = useCallback(
    async (p = 1) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setOffline(true);
        if (cacheRef.current) {
          setItems(cacheRef.current.items);
          setCounts(cacheRef.current.counts);
          setTotal(cacheRef.current.total);
          setPages(cacheRef.current.pages);
          setPage(cacheRef.current.page);
          setStale(true);
          setError(
            "You’re offline. Showing the last loaded orders — reconnect to refresh."
          );
          setLoading(false);
          return;
        }
        setError("You’re offline. Connect to load orders.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        setStale(false);
        const token = await getToken();
        if (!token) {
          setError("Session expired. Sign in again.");
          setLoading(false);
          return;
        }

        const params = new URLSearchParams({
          page: String(p),
          limit: "20",
        });
        if (status) params.set("status", status);
        if (payment) params.set("payment", payment);
        if (city.trim()) params.set("city", city.trim());
        if (q.trim()) params.set("q", q.trim());

        const json = await adminFetch<any>(`/admin/orders?${params}`, token);
        const nextItems: OrderRow[] = json.data || [];
        const nextTotal = json.pagination?.total || 0;
        const nextPages = json.pagination?.pages || 1;
        const nextPage = json.pagination?.page || p;

        // Local status tallies for the current result set + prefer API counts if present
        const nextCounts: Counts = json.counts || {
          all: nextTotal,
          Preparing: nextItems.filter((o) => o.orderStatus === "Preparing")
            .length,
          Shipped: nextItems.filter((o) => o.orderStatus === "Shipped").length,
          Delivered: nextItems.filter((o) => o.orderStatus === "Delivered")
            .length,
          Cancelled: nextItems.filter((o) => o.orderStatus === "Cancelled")
            .length,
        };
        if (!json.counts) nextCounts.all = nextTotal;

        setItems(nextItems);
        setCounts(nextCounts);
        setTotal(nextTotal);
        setPages(nextPages);
        setPage(nextPage);

        cacheRef.current = {
          items: nextItems,
          counts: nextCounts,
          total: nextTotal,
          pages: nextPages,
          page: nextPage,
        };
      } catch (e: any) {
        if (cacheRef.current) {
          setItems(cacheRef.current.items);
          setCounts(cacheRef.current.counts);
          setTotal(cacheRef.current.total);
          setPages(cacheRef.current.pages);
          setPage(cacheRef.current.page);
          setStale(true);
          setError(
            e?.message
              ? `${e.message} — showing last successful load.`
              : "Request failed — showing last successful load."
          );
        } else {
          setError(e?.message || "Failed to load orders");
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [getToken, status, payment, city, q]
  );

  useEffect(() => {
    if (!mounted) return;
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, status, payment]);

  const openPane = async (row: OrderRow) => {
    setOpenId(row._id);
    setSelected(row);
    setPaneOpen(true);
    if (showOffline) return;
    try {
      setDetailLoading(true);
      const token = await getToken();
      const json = await adminFetch<{ data: OrderRow }>(
        `/admin/orders/${row._id}`,
        token
      );
      setSelected(json.data);
    } catch {
      // keep list row data
    } finally {
      setDetailLoading(false);
    }
  };

  const closePane = () => {
    setPaneOpen(false);
    window.setTimeout(() => {
      setOpenId(null);
      setSelected(null);
    }, 280);
  };

  const clearFilters = () => {
    setStatus("");
    setPayment("");
    setCity("");
    setQ("");
    setSort("newest");
  };

  const filtersActive = !!(status || payment || city.trim() || q.trim());

  const sortedItems = [...items].sort((a, b) => {
    if (sort === "oldest") {
      return (
        new Date(a.createdAt || 0).getTime() -
        new Date(b.createdAt || 0).getTime()
      );
    }
    if (sort === "totalHigh") {
      return Number(b.totalAmount || 0) - Number(a.totalAmount || 0);
    }
    if (sort === "totalLow") {
      return Number(a.totalAmount || 0) - Number(b.totalAmount || 0);
    }
    return (
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime()
    );
  });

  return (
    <div
      className={cn(
        poppins.className,
        "relative min-h-[70vh] pb-28 text-[#F5F7FA]"
      )}
    >
      {showOffline && (
        <div className="mb-4 flex items-start gap-3 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">You’re offline</p>
            <p className="mt-0.5 text-xs text-amber-100/80">
              Order search needs a connection.
              {stale
                ? " Showing the last list we loaded."
                : " Reconnect to load orders."}
            </p>
          </div>
        </div>
      )}

      <header className="mb-6 border-b border-[#252A33] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
            Commerce
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-medium",
              showOffline
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                : "border-[#00E575]/25 bg-[#00E575]/10 text-[#00E575]"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                showOffline ? "bg-amber-400" : "bg-[#00E575]"
              )}
            />
            {showOffline ? "Offline" : "Live"}
          </span>
        </div>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-semibold leading-none tracking-tight sm:text-[28px]">
              Orders
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#A7ADB8]">
              PLZ# codes, buyers, sellers, ship-to, payment, and fulfillment
              flow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs tabular-nums text-[#737A86]">
              <span className="text-[#F5F7FA]">{total.toLocaleString()}</span>{" "}
              orders
              {stale ? " · cached" : ""}
            </p>
            <Button
              tone="ghost"
              className="h-9 gap-1.5 text-xs"
              disabled={loading || showOffline}
              onClick={() => load(page)}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", loading && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden border border-[#252A33] bg-[#252A33] sm:grid-cols-5">
        {(
          [
            ["All", "", counts.all],
            ["Preparing", "Preparing", counts.Preparing],
            ["Shipped", "Shipped", counts.Shipped],
            ["Delivered", "Delivered", counts.Delivered],
            ["Cancelled", "Cancelled", counts.Cancelled],
          ] as const
        ).map(([label, value, n]) => (
          <button
            key={label}
            type="button"
            onClick={() => setStatus(value)}
            className={cn(
              "bg-[#11141A] px-3 py-3.5 text-left transition sm:px-4",
              status === value &&
                "bg-[#041412] ring-1 ring-inset ring-[#00E575]/30"
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              {label}
            </p>
            <p className="mt-1.5 text-[22px] font-semibold tabular-nums leading-none">
              {Number(n).toLocaleString()}
            </p>
          </button>
        ))}
      </div>

      <Panel className="mb-4 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#252A33] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
            Filters
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-[#A7ADB8] hover:text-[#00E575]"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              placeholder="Search PLZ#48291, buyer, seller, city…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !showOffline && load(1)}
              className="lg:max-w-md"
              disabled={showOffline && !cacheRef.current}
            />
            <Button onClick={() => load(1)} disabled={loading || showOffline}>
              {loading ? "Searching…" : "Search"}
            </Button>
            <div className="flex gap-1 border border-[#252A33] lg:ml-auto">
              <button
                type="button"
                aria-label="List view"
                onClick={() => setView("list")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center transition",
                  view === "list"
                    ? "bg-[#00E575] text-[#041412]"
                    : "text-[#A7ADB8] hover:text-[#F5F7FA]"
                )}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setView("grid")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center transition",
                  view === "grid"
                    ? "bg-[#00E575] text-[#041412]"
                    : "text-[#A7ADB8] hover:text-[#F5F7FA]"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={showOffline && !cacheRef.current}
            >
              <option value="">All statuses</option>
              <option value="Preparing">Preparing</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </Select>
            <Select
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
              disabled={showOffline && !cacheRef.current}
            >
              <option value="">All payments</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </Select>
            <Input
              placeholder="Ship-to city…"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(1)}
              disabled={showOffline && !cacheRef.current}
            />
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              disabled={showOffline && !cacheRef.current}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="totalHigh">Total high → low</option>
              <option value="totalLow">Total low → high</option>
            </Select>
          </div>
        </div>
      </Panel>

      {error && (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="border border-[#252A33] bg-[#11141A]">
          <OrbLoader label="Loading orders" />
        </div>
      ) : sortedItems.length === 0 ? (
        <EmptyState
          title="No orders found"
          body={
            showOffline
              ? "Connect to the internet to load orders."
              : "Try another PLZ# code or clear filters."
          }
        />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedItems.map((o) => {
            const plz = formatPlz(o);
            return (
              <button
                key={o._id}
                type="button"
                onClick={() => openPane(o)}
                className={cn(
                  "border border-[#252A33] bg-[#11141A] p-4 text-left transition hover:border-[#00E575]/35",
                  openId === o._id &&
                    paneOpen &&
                    "border-[#00E575]/45 bg-[#00E575]/5"
                )}
              >
                <p className="font-mono text-sm font-semibold tracking-wide text-[#00E575]">
                  {plz}
                </p>
                <p className="mt-2 truncate text-sm font-medium">
                  {o.buyer?.name || o.buyerContact?.name || "Buyer"}
                </p>
                <p className="truncate text-xs text-[#737A86]">
                  {o.seller?.storeName || o.seller?.name || "Seller"}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={statusTone(o.orderStatus)}>
                    {o.orderStatus || "—"}
                  </Badge>
                  <Badge tone={payTone(o.paymentStatus)}>
                    {o.paymentStatus || "—"}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-[#737A86]">
                  <span>{o.shippingAddress?.city || "—"}</span>
                  <span className="font-semibold tabular-nums text-[#F5F7FA]">
                    {Number(o.totalAmount || 0).toLocaleString()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-[#252A33] text-[11px] uppercase tracking-[0.12em] text-[#737A86]">
              <tr>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Buyer</th>
                <th className="px-4 py-3 font-semibold">Seller</th>
                <th className="px-4 py-3 font-semibold">Ship to</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((o) => {
                const plz = formatPlz(o);
                return (
                  <tr
                    key={o._id}
                    onClick={() => openPane(o)}
                    className={cn(
                      "cursor-pointer border-b border-[#252A33]/70 transition-colors hover:bg-[#171B22]/80",
                      openId === o._id &&
                        paneOpen &&
                        "bg-[#00E575]/[0.06]"
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono text-[13px] font-semibold tracking-wide text-[#00E575]">
                        {plz}
                      </p>
                      <p className="text-[10px] text-[#737A86]">
                        {o.items?.length || 0} item
                        {(o.items?.length || 0) === 1 ? "" : "s"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate">
                        {o.buyer?.name || o.buyerContact?.name || "—"}
                      </p>
                      <p className="truncate text-xs text-[#737A86]">
                        {o.buyer?.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate">
                        {o.seller?.storeName || o.seller?.name || "—"}
                      </p>
                      <p className="truncate text-xs text-[#737A86]">
                        {o.seller?.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[#A7ADB8]">
                      {o.shippingAddress?.city || "—"}
                      {o.shippingAddress?.state ? (
                        <span className="text-[#737A86]">
                          {" "}
                          · {o.shippingAddress.state}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(o.orderStatus)}>
                        {o.orderStatus || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={payTone(o.paymentStatus)}>
                        {o.paymentStatus || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {Number(o.totalAmount || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#A7ADB8]">
                      {fmtDate(o.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}

      {pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            tone="ghost"
            disabled={page <= 1 || loading || showOffline}
            onClick={() => load(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-[#737A86]">
            Page {page} of {pages}
          </span>
          <Button
            tone="ghost"
            disabled={page >= pages || loading || showOffline}
            onClick={() => load(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
          paneOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
        onClick={closePane}
        aria-hidden
      />

      <aside
        className={cn(
          poppins.className,
          "fixed top-0 right-0 z-50 flex h-full w-full max-w-[460px] flex-col border-l border-[#252A33] bg-[#0C0F14] shadow-2xl transition-transform duration-300 ease-out",
          paneOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#252A33] px-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00E575]">
              Order
            </p>
            <p className="font-mono text-sm font-semibold tracking-wide text-[#00E575]">
              {formatPlz(selected)}
            </p>
          </div>
          <button
            type="button"
            onClick={closePane}
            className="flex h-9 w-9 items-center justify-center border border-[#252A33] bg-[#171B22] text-[#A7ADB8] transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {detailLoading && !selected && (
            <OrbLoader label="Loading order" />
          )}
          {selected && (
            <div className="space-y-6">
              {detailLoading && (
                <p className="text-xs text-[#737A86]">Refreshing detail…</p>
              )}

              <div className="flex flex-wrap gap-1.5">
                <Badge tone={statusTone(selected.orderStatus)}>
                  {selected.orderStatus || "—"}
                </Badge>
                <Badge tone={payTone(selected.paymentStatus)}>
                  {selected.paymentStatus || "—"}
                </Badge>
                {selected.paymentMethod ? (
                  <Badge tone="neutral">{selected.paymentMethod}</Badge>
                ) : null}
              </div>

              <div>
                <SectionLabel>Fulfillment flow</SectionLabel>
                <div className="mt-3">
                  <OrderFlow order={selected} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-[#252A33] pt-4">
                <div className="border border-[#252A33] bg-[#11141A] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                    Total
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {Number(selected.totalAmount || 0).toLocaleString()}
                  </p>
                </div>
                <div className="border border-[#252A33] bg-[#11141A] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                    Items
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {selected.items?.length || 0}
                  </p>
                </div>
              </div>

              <div className="space-y-3 border-t border-[#252A33] pt-4">
                <SectionLabel>Buyer</SectionLabel>
                <Field label="Name">
                  {selected.buyer?.name ||
                    selected.buyerContact?.name ||
                    "—"}
                </Field>
                <Field label="Email">{selected.buyer?.email || "—"}</Field>
                <Field label="Phone">
                  {selected.buyerContact?.phone ||
                    selected.buyer?.phone ||
                    "—"}
                </Field>
                <Field label="Region">
                  {selected.buyer?.marketplaceRegion || "—"}
                </Field>
               {/* Buyer section — replace the Open buyer profile Link */}
{selected.buyer?._id && (
  <Link
    href={`/users?userId=${encodeURIComponent(selected.buyer._id)}&role=buyer`}
    className="inline-flex h-9 items-center justify-center border border-[#252A33] bg-[#171B22] px-3 text-xs font-medium text-[#A7ADB8] transition hover:border-[#00E575]/40 hover:text-[#00E575]"
  >
    Open buyer on Users
  </Link>
)}

{/* Seller section — replace the Open seller profile Link */}
{selected.seller?._id && (
  <Link
    href={`/users?userId=${encodeURIComponent(selected.seller._id)}&role=seller`}
    className="inline-flex h-9 items-center justify-center border border-[#252A33] bg-[#171B22] px-3 text-xs font-medium text-[#A7ADB8] transition hover:border-[#00E575]/40 hover:text-[#00E575]"
  >
    Open seller on Users
  </Link>
)}
              </div>

              <div className="space-y-3 border-t border-[#252A33] pt-4">
                <SectionLabel>Seller</SectionLabel>
                <Field label="Store">
                  {selected.seller?.storeName || selected.seller?.name || "—"}
                </Field>
                <Field label="Email">{selected.seller?.email || "—"}</Field>
                <Field label="Phone">{selected.seller?.phone || "—"}</Field>
                <Field label="Region">
                  {selected.seller?.marketplaceRegion || "—"}
                </Field>
                {selected.seller?.isSellerSuspended && (
                  <Badge tone="error">Seller suspended</Badge>
                )}
                {selected.seller?._id && (
                  <Link
                    href={`/users?role=seller&q=${encodeURIComponent(
                      selected.seller.storeName ||
                        selected.seller.email ||
                        selected.seller._id
                    )}`}
                    className="inline-flex text-xs font-medium text-[#00E575] hover:underline"
                  >
                    Open seller profile
                  </Link>
                )}
              </div>

              <div className="space-y-3 border-t border-[#252A33] pt-4">
                <SectionLabel>Ship to</SectionLabel>
                <Field label="Street">
                  {selected.shippingAddress?.street || "—"}
                </Field>
                <Field label="City">
                  {selected.shippingAddress?.city || "—"}
                </Field>
                <Field label="State">
                  {selected.shippingAddress?.state || "—"}
                </Field>
                <Field label="ZIP">
                  {selected.shippingAddress?.zipCode || "—"}
                </Field>
                <Field label="Country">
                  {selected.shippingAddress?.country || "—"}
                </Field>
              </div>

              <div className="space-y-3 border-t border-[#252A33] pt-4">
                <SectionLabel>Shipping method</SectionLabel>
                <Field label="Method">
                  {selected.shipping?.shippingMethod ||
                    selected.productShipping?.method ||
                    "—"}
                </Field>
                <Field label="Courier">
                  {selected.shipping?.deliveryCompany ||
                    selected.productShipping?.courierCompany ||
                    "—"}
                </Field>
                <Field label="Tracking">
                  {selected.shipping?.trackingNumber ? (
                    <span className="font-mono">
                      {selected.shipping.trackingNumber}
                    </span>
                  ) : (
                    "—"
                  )}
                </Field>
                <Field label="Shipped at">
                  {fmtDate(selected.shipping?.shippedAt)}
                </Field>
                <Field label="ETA">
                  {fmtDate(selected.shipping?.estimatedDelivery)}
                </Field>
                {selected.shipping?.selfDeliveryNote ? (
                  <Field label="Self-delivery note">
                    {selected.shipping.selfDeliveryNote}
                  </Field>
                ) : null}
              </div>

              <div className="space-y-2 border-t border-[#252A33] pt-4">
                <SectionLabel>Line items</SectionLabel>
                {(selected.items || []).map((it, i) => {
                  const img =
                    it.image ||
                    (typeof it.product === "object"
                      ? it.product?.images?.[0]
                      : undefined);
                  const title =
                    it.name ||
                    (typeof it.product === "object"
                      ? it.product?.name
                      : undefined) ||
                    "Item";
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 border border-[#252A33] bg-[#11141A] px-3 py-2"
                    >
                      <div className="h-11 w-11 shrink-0 overflow-hidden border border-[#252A33] bg-[#171B22]">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{title}</p>
                        <p className="text-[11px] text-[#737A86]">
                          Qty {it.quantity ?? 1}
                          {it.note ? ` · ${it.note}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        {Number(it.price || 0).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
                {!selected.items?.length && (
                  <p className="text-xs text-[#737A86]">No line items.</p>
                )}
              </div>

              <div className="space-y-1.5 border-t border-[#252A33] pt-4 text-sm">
                <div className="flex justify-between text-[#A7ADB8]">
                  <span>Subtotal</span>
                  <span className="tabular-nums">
                    {Number(selected.subtotal || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-[#A7ADB8]">
                  <span>Shipping</span>
                  <span className="tabular-nums">
                    {Number(selected.shippingCost || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-[#F5F7FA]">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {Number(selected.totalAmount || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {selected.buyerNote ? (
                <div className="border-t border-[#252A33] pt-4">
                  <SectionLabel>Buyer note</SectionLabel>
                  <p className="mt-2 text-sm text-[#A7ADB8]">
                    {selected.buyerNote}
                  </p>
                </div>
              ) : null}

              {selected.orderStatus === "Cancelled" &&
                selected.cancellation && (
                  <div className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                    <p className="font-semibold">Cancellation</p>
                    <p className="mt-1 text-xs opacity-90">
                      By {selected.cancellation.cancelledBy || "—"}
                      {selected.cancellation.reasonLabel
                        ? ` · ${selected.cancellation.reasonLabel}`
                        : ""}
                      {selected.cancellation.cancelledAt
                        ? ` · ${fmtDate(selected.cancellation.cancelledAt)}`
                        : ""}
                    </p>
                    {selected.cancellation.note ? (
                      <p className="mt-1 text-xs opacity-80">
                        {selected.cancellation.note}
                      </p>
                    ) : null}
                    {selected.cancellation.refundStatus &&
                      selected.cancellation.refundStatus !==
                        "not_applicable" && (
                        <p className="mt-1 text-xs">
                          Refund: {selected.cancellation.refundStatus}
                        </p>
                      )}
                  </div>
                )}

              <div className="space-y-1 border-t border-[#252A33] pt-4 text-[11px] text-[#737A86]">
                <p className="font-mono">ID {selected._id}</p>
                <p>Placed {fmtDate(selected.createdAt)}</p>
                <p>Updated {fmtDate(selected.updatedAt)}</p>
                {selected.deliveredAt && (
                  <p>Delivered {fmtDate(selected.deliveredAt)}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}