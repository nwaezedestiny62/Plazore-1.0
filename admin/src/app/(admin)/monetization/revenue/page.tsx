"use client";

import { useAuth } from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDownUp,
  Banknote,
  Lock,
  RefreshCw,
  Search,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import {
  Button,
  EmptyState,
  ErrorBlock,
  Input,
  Panel,
  cn,
} from "@/components/ui";

const GATE_KEY = "plazore.admin.revenueGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_REVENUE_PASSWORD ||
  "plazore@reveune123456789012";

type MoneyBucket = { currency: string; amount: number; count?: number };

type SellerRow = {
  _id: string;
  name?: string;
  email?: string;
  storeName?: string;
  storeLogo?: string;
  region?: string;
  joinedAt?: string;
  verified?: boolean;
  suspended?: boolean;
  bankReady?: boolean;
  currency?: string;
  gmv: number;
  platformFees: number;
  orders: number;
  pendingPayout: number;
  pendingOrders: number;
  paidOut: number;
  paidOutOrders: number;
  subscriptionRevenue: number;
  planId?: string | null;
  planStatus?: string | null;
  sellerRevenue: number;
  byCurrency?: {
    currency: string;
    gmv: number;
    fees: number;
    sellerNet: number;
    orders: number;
  }[];
};

const SORTS = [
  { id: "gmv", label: "GMV" },
  { id: "revenue", label: "Seller net" },
  { id: "fees", label: "Platform fees" },
  { id: "pending", label: "Pending payout" },
  { id: "subs", label: "Subscriptions" },
  { id: "orders", label: "Orders" },
  { id: "joined", label: "Date joined" },
  { id: "name", label: "Name" },
] as const;

function fmtMoney(n?: number, currency = "NGN") {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: currency === "NGN" ? 0 : 2,
    }).format(v);
  } catch {
    return `${v.toLocaleString()} ${currency}`;
  }
}

function formatBuckets(buckets?: MoneyBucket[]) {
  if (!buckets?.length) return "—";
  return buckets
    .map((b) => fmtMoney(b.amount, b.currency))
    .join(" | ");
}

function shortDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function RevenueBoardPage() {
  const { getToken, isLoaded } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState("");

  const [sort, setSort] = useState("gmv");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active">("active");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState<any>(null);
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [pages, setPages] = useState(1);
  const [totalSellers, setTotalSellers] = useState(0);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(GATE_KEY) === "1") setUnlocked(true);
    } catch {
      /* */
    }
  }, []);

  const unlock = (e: FormEvent) => {
    e.preventDefault();
    if (pw === EXPECTED_PASSWORD) {
      setUnlocked(true);
      setPwErr("");
      try {
        sessionStorage.setItem(GATE_KEY, "1");
      } catch {
        /* */
      }
    } else {
      setPwErr("Incorrect password");
    }
  };

  const load = useCallback(async () => {
    if (!unlocked || !isLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const qs = new URLSearchParams({
        page: String(page),
        limit: "30",
        sort,
        order,
        filter,
        ...(q ? { q } : {}),
      });
      const json = await adminFetch<{ success: boolean; data: any }>(
        `/admin/monetization/revenue?${qs}`,
        token
      );
      setTotals(json.data?.totals || null);
      setSellers(json.data?.sellers || []);
      setPages(json.data?.pagination?.pages || 1);
      setTotalSellers(json.data?.pagination?.total || 0);
    } catch (e: any) {
      setError(e?.message || "Failed to load revenue");
    } finally {
      setLoading(false);
    }
  }, [unlocked, isLoaded, getToken, page, sort, order, filter, q]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!unlocked) {
    return (
      <div className="flex min-h-[70dvh] items-center justify-center px-4">
        <form
          onSubmit={unlock}
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#11141A]/95 p-6 shadow-2xl"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#00E575]/30 bg-[#00E575]/10">
            <Lock className="h-5 w-5 text-[#00E575]" />
          </div>
          <h1 className="text-lg font-bold">Revenue board</h1>
          <p className="mt-1 text-sm text-white/50">
            GMV, platform fees, subscriptions, and per-seller settlement.
          </p>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Revenue password"
            className="mt-4"
            autoFocus
          />
          {pwErr ? (
            <p className="mt-2 text-xs text-red-400">{pwErr}</p>
          ) : null}
          <Button type="submit" className="mt-4 w-full">
            Unlock
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
            Monetization
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Revenue</h1>
          <p className="mt-1 text-sm text-white/50">
            Platform totals and every seller’s GMV, fees, pending, and payout history.
          </p>
        </div>
        <Button
          type="button"
          tone="ghost"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {totals ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Panel className="p-4">
            <div className="flex items-center gap-2 text-white/45">
              <TrendingUp className="h-4 w-4 text-[#00E575]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                GMV (paid orders)
              </span>
            </div>
            <p className="mt-2 text-lg font-bold leading-snug">
              {formatBuckets(totals.gmv)}
            </p>
            <p className="mt-1 text-[11px] text-white/35">
              {totals.paidOrderCount || 0} paid orders
            </p>
          </Panel>
          <Panel className="p-4">
            <div className="flex items-center gap-2 text-white/45">
              <Banknote className="h-4 w-4 text-[#3B82F6]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                Revenue | transaction fees
              </span>
            </div>
            <p className="mt-2 text-lg font-bold leading-snug">
              {formatBuckets(totals.transactionFeeRevenue)}
            </p>
          </Panel>
          <Panel className="p-4">
            <div className="flex items-center gap-2 text-white/45">
              <Store className="h-4 w-4 text-[#14B8A6]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                Revenue | seller subscriptions
              </span>
            </div>
            <p className="mt-2 text-lg font-bold leading-snug">
              {formatBuckets(totals.subscriptionRevenue)}
            </p>
          </Panel>
          <Panel className="p-4">
            <div className="flex items-center gap-2 text-white/45">
              <Wallet className="h-4 w-4 text-amber-300" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                Pending seller payouts
              </span>
            </div>
            <p className="mt-2 text-lg font-bold leading-snug">
              {formatBuckets(totals.pendingSellerPayouts)}
            </p>
          </Panel>
          <Panel className="p-4">
            <div className="flex items-center gap-2 text-white/45">
              <Banknote className="h-4 w-4 text-white/50" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                Seller paid out
              </span>
            </div>
            <p className="mt-2 text-lg font-bold leading-snug">
              {formatBuckets(totals.sellerPaidOut)}
            </p>
          </Panel>
          <Panel className="p-4">
            <div className="flex items-center gap-2 text-white/45">
              <ArrowDownUp className="h-4 w-4 text-red-300/80" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                Refunded volume
              </span>
            </div>
            <p className="mt-2 text-lg font-bold leading-snug">
              {formatBuckets(totals.refunded)}
            </p>
          </Panel>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">
          Sort
        </span>
        {SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              if (sort === s.id) {
                setOrder((o) => (o === "desc" ? "asc" : "desc"));
              } else {
                setSort(s.id);
                setOrder("desc");
              }
              setPage(1);
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              sort === s.id
                ? "border-[#00E575]/50 bg-[#00E575]/15 text-[#00E575]"
                : "border-white/10 bg-white/5 text-white/55 hover:border-white/20"
            )}
          >
            {s.label}
            {sort === s.id ? (order === "desc" ? " ↓" : " ↑") : ""}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setFilter((f) => (f === "active" ? "all" : "active"));
            setPage(1);
          }}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold",
            filter === "active"
              ? "border-[#3B82F6]/45 bg-[#3B82F6]/15 text-[#93C5FD]"
              : "border-white/10 bg-white/5 text-white/55"
          )}
        >
          {filter === "active" ? "Active only" : "All sellers"}
        </button>
        <div className="ml-auto flex min-w-[180px] flex-1 items-center gap-2 sm:max-w-xs">
          <Search className="h-4 w-4 shrink-0 text-white/35" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search store / email"
            className="h-9"
          />
        </div>
      </div>

      {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
      {loading && !sellers.length ? (
        <div className="flex justify-center py-16">
          <OrbLoader />
        </div>
      ) : null}
      {!loading && !sellers.length && !error ? (
        <EmptyState
          title="No sellers match"
          body="Try clearing search or switch to All sellers."
        />
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="hidden grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,0.9fr))] gap-2 border-b border-white/8 bg-white/[0.03] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white/40 sm:grid">
          <span>Seller</span>
          <span className="text-right">GMV</span>
          <span className="text-right">Fees</span>
          <span className="text-right">Pending</span>
          <span className="text-right">Paid out</span>
          <span className="text-right">Joined</span>
        </div>
        <div className="divide-y divide-white/6">
          {sellers.map((s) => (
            <div
              key={s._id}
              className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,0.9fr))] sm:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                {s.storeLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.storeLogo}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    <Store className="h-4 w-4 text-white/40" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {s.storeName || s.name || "Seller"}
                  </p>
                  <p className="truncate text-[11px] text-white/40">
                    {s.email}
                    {s.region ? ` | ${s.region}` : ""}
                    {s.suspended ? " | suspended" : ""}
                    {!s.bankReady ? " | bank incomplete" : ""}
                  </p>
                  <p className="text-[10px] text-white/30 sm:hidden">
                    {s.orders} orders | sub {fmtMoney(s.subscriptionRevenue, s.currency)}
                  </p>
                </div>
              </div>
              <p className="text-sm font-semibold tabular-nums sm:text-right">
                <span className="mr-2 text-[10px] text-white/35 sm:hidden">GMV</span>
                {fmtMoney(s.gmv, s.currency)}
              </p>
              <p className="text-sm tabular-nums text-[#93C5FD] sm:text-right">
                <span className="mr-2 text-[10px] text-white/35 sm:hidden">Fees</span>
                {fmtMoney(s.platformFees, s.currency)}
              </p>
              <p className="text-sm tabular-nums text-amber-200/90 sm:text-right">
                <span className="mr-2 text-[10px] text-white/35 sm:hidden">
                  Pending
                </span>
                {fmtMoney(s.pendingPayout, s.currency)}
              </p>
              <p className="text-sm tabular-nums text-[#00E575]/90 sm:text-right">
                <span className="mr-2 text-[10px] text-white/35 sm:hidden">
                  Paid out
                </span>
                {fmtMoney(s.paidOut, s.currency)}
              </p>
              <p className="text-xs text-white/45 sm:text-right">
                {shortDate(s.joinedAt)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-[11px] text-white/35">
        {totalSellers} sellers | page {page} / {pages}
      </p>
      {pages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            tone="ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <Button
            type="button"
            tone="ghost"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
