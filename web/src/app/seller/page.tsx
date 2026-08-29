"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCheck,
  CheckCircle2,
  Clock,
  Lightbulb,
  Package,
  Palette,
  Plane,
  PlusCircle,
  Receipt,
  Settings,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useMarketplace } from "@/context/MarketplaceContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

const PLAN_FEES: Record<string, number> = {
  free: 8,
  starter: 6,
  growth: 4,
  pro: 3,
};

const SELLER_TIPS = [
  "Products with high-quality images usually attract more buyers.",
  "Keep your shipping information updated so buyers know what to expect.",
  "Complete your storefront to improve buyer trust.",
  "Update your inventory regularly to avoid cancelled orders.",
  "Clear product titles help shoppers find you faster in the mall.",
];

type Overview = {
  totalProducts: number;
  pendingOrders: number;
  completedOrders: number;
  storeName: string;
  isVerified: boolean;
  plan: string;
  revenue?: number;
};

type ActivityItem = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  at: string;
};

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type SeriesPoint = {
  label?: string;
  value?: number;
  views?: number;
  cartAdds?: number;
  cart?: number;
  purchases?: number;
  sales?: number;
  date?: string;
};

function normalizeDashboardSeries(raw: SeriesPoint[]) {
  return raw.map((d, i) => {
    let label = d.label || "";
    if (!label && d.date) {
      const dt = new Date(d.date);
      label = Number.isNaN(dt.getTime())
        ? `D${i + 1}`
        : dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    if (!label) label = `${i + 1}`;

    // Prefer multi-metric if API sends it; else fall back to single `value` as engagement
    const views = Number(d.views) || 0;
    const cart = Number(d.cartAdds ?? d.cart) || 0;
    const purchases = Number(d.purchases ?? d.sales) || 0;
    const value = Number(d.value) || views + cart * 5 + purchases * 15;

    return { label, value, views, cart, purchases };
  });
}

function PerformanceBars({ data }: { data: SeriesPoint[] }) {
  const points = useMemo(() => {
    const normalized = normalizeDashboardSeries(Array.isArray(data) ? data : []);
    return normalized.slice(-14);
  }, [data]);

  const [hover, setHover] = useState<number | null>(null);

  const max = useMemo(() => {
    const m = Math.max(1, ...points.map((p) => p.value));
    const pow = Math.pow(10, Math.floor(Math.log10(m)) || 0);
    return Math.ceil(m / pow) * pow || 1;
  }, [points]);

  if (!points.length) {
    return (
      <div className="relative h-36 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0A121C]">
        <div className="absolute inset-0 flex items-end justify-between gap-1 px-3 pb-6 pt-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-white/[0.04]"
              style={{ height: `${18 + ((i * 17) % 55)}%` }}
            />
          ))}
        </div>
        <p className="absolute inset-x-0 bottom-2 text-center text-[11px] text-[#4A6078]">
          Engagement will show here as buyers interact
        </p>
      </div>
    );
  }

  const active = hover != null ? points[hover] : null;
  const labelEvery = Math.max(1, Math.ceil(points.length / 5));

  return (
    <div>
      {/* Y scale + bars */}
      <div className="flex gap-2">
        {/* Y labels */}
        <div className="flex w-7 flex-col justify-between pb-5 pt-1 text-right text-[9px] tabular-nums text-[#4A6078]">
          <span>{max}</span>
          <span>{Math.round(max / 2)}</span>
          <span>0</span>
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Grid lines */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-5 pt-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="border-t border-white/[0.05]" />
            ))}
          </div>

          <div className="relative flex h-36 items-end gap-[3px] sm:gap-1.5">
            {points.map((d, i) => {
              const h = Math.max(4, Math.round((d.value / max) * 100));
              const isOn = hover === i;
              return (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="group relative flex min-w-0 flex-1 flex-col items-center justify-end"
                  style={{ height: "100%" }}
                  title={`${d.label}: ${d.value}`}
                >
                  <span
                    className={`w-full max-w-[28px] rounded-sm transition-all duration-150 ${
                      isOn ? "opacity-100 ring-1 ring-white/20" : "opacity-90"
                    }`}
                    style={{
                      height: `${h}%`,
                      backgroundImage:
                        "linear-gradient(180deg, #00E575 0%, #14B8A6 45%, #3B82F6 100%)",
                      boxShadow: isOn ? "0 0 12px rgba(0,229,117,0.25)" : undefined,
                    }}
                  />
                  {i % labelEvery === 0 && (
                    <span className="mt-1.5 max-w-full truncate text-[9px] text-[#4A6078]">
                      {d.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tooltip / summary */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-white/[0.06] bg-[#0A121C] px-3 py-2 text-[12px]">
        {active ? (
          <>
            <span className="font-semibold text-[#F5F7FA]">{active.label}</span>
            <span className="font-bold text-[#00E575]">{active.value} pts</span>
            {(active.views > 0 || active.cart > 0 || active.purchases > 0) && (
              <>
                <span className="text-[#3B82F6]">Views {active.views}</span>
                <span className="text-[#14B8A6]">Cart {active.cart}</span>
                <span className="text-[#00E575]">Buys {active.purchases}</span>
              </>
            )}
          </>
        ) : (
          <span className="text-[#6B8299]">
            Hover a day · score = views×1 + cart×5 + purchases×15
          </span>
        )}
      </div>
    </div>
  );
}

function OrbLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
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

export default function SellerDashboardPage() {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { format } = useMarketplace();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<Overview>({
    totalProducts: 0,
    pendingOrders: 0,
    completedOrders: 0,
    storeName: "",
    isVerified: false,
    plan: "free",
    revenue: 0,
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [analytics, setAnalytics] = useState<{
    rangeDays?: number;
    totals?: { score?: number; revenue?: number };
    topProducts?: {
      productId?: string;
      name?: string;
      score?: number;
      milestone200?: boolean;
    }[];
    series?: { label?: string; value?: number }[];
  } | null>(null);
  const [tipIndex, setTipIndex] = useState(0);

  const firstName =
    user?.firstName || user?.fullName?.split(" ")[0] || user?.username || "Seller";
  const greeting = useMemo(() => getGreeting(new Date().getHours()), []);

  const feePct = PLAN_FEES[overview.plan] ?? PLAN_FEES.free ?? 8;

  const loadDashboard = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };

      const [dashRes, ordersRes, productsRes, analyticsRes] = await Promise.all([
        fetch(`${API}/seller/dashboard`, { headers }).then((r) => r.json()).catch(() => null),
        fetch(`${API}/orders/seller/my`, { headers }).then((r) => r.json()).catch(() => null),
        fetch(`${API}/seller/products`, { headers }).then((r) => r.json()).catch(() => null),
        fetch(`${API}/analytics/seller?range=30`, { headers }).then((r) => r.json()).catch(() => null),
      ]);

      const dash = dashRes?.success ? dashRes.data : null;
      const orders: Record<string, unknown>[] = Array.isArray(ordersRes?.data) ? ordersRes.data : [];
      const products: unknown[] = Array.isArray(productsRes?.data) ? productsRes.data : [];
      const analyticsData = analyticsRes?.success && analyticsRes.data ? analyticsRes.data : null;
      setAnalytics(analyticsData);

      const pending = orders.filter(
        (o) => o?.orderStatus === "Preparing" || o?.orderStatus === "Shipped",
      ).length;
      const completed = orders.filter((o) => o?.orderStatus === "Delivered").length;

      const revenue =
        Number(
          dash?.revenue ?? dash?.totalRevenue ?? analyticsData?.totals?.revenue,
        ) || 0;

      setOverview({
        totalProducts: dash?.totalProducts ?? products.length ?? 0,
        pendingOrders: pending,
        completedOrders: completed,
        storeName: dash?.storeName || "",
        isVerified: !!dash?.isVerified,
        plan: dash?.plan || "free",
        revenue,
      });

      setActivity(
        orders.slice(0, 5).map((o) => ({
          id: String(o?._id || Math.random()),
          type:
            o?.orderStatus === "Shipped"
              ? "order_shipped"
              : o?.orderStatus === "Delivered"
                ? "order_delivered"
                : "order_received",
          title:
            o?.orderStatus === "Shipped"
              ? "Order shipped"
              : o?.orderStatus === "Delivered"
                ? "Order delivered"
                : "New order",
          subtitle: String(o?.orderNumber || "Order"),
          at: String(o?.createdAt || ""),
        })),
      );
    } catch (e) {
      console.error("Seller dashboard error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    loadDashboard();
  }, [isSignedIn, loadDashboard]);

  useEffect(() => {
    if (loading) return;
    const t = setInterval(() => setTipIndex((i) => (i + 1) % SELLER_TIPS.length), 8000);
    return () => clearInterval(t);
  }, [loading]);

  const safeTop = Array.isArray(analytics?.topProducts) ? analytics!.topProducts! : [];
  const safeSeries = Array.isArray(analytics?.series) ? analytics!.series! : [];

  const revenueLabel =
    overview.revenue && overview.revenue > 0 ? format(overview.revenue) : "—";

  if (loading) return <OrbLoader />;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-[#090B0F]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[1.6px] text-[#737A86]">
            Seller Lounge
          </p>
          <h1 className="truncate text-lg font-extrabold tracking-tight sm:text-xl">
            {overview.storeName || "Your Store"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!overview.isVerified ? (
            <span className="border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-[#F0C070]">
              Pending
            </span>
          ) : null}
          <Link
            href="/seller/store"
            className="flex h-10 w-10 items-center justify-center border border-white/[0.07] bg-[#11141A]"
            aria-label="Storefront"
          >
            <Palette className="h-5 w-5" />
          </Link>
          <Link
            href="/seller/settings"
            className="flex h-10 w-10 items-center justify-center border border-white/[0.07] bg-[#11141A]"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <Link
            href="/"
            className="hidden h-10 items-center gap-1.5 border border-white/[0.07] bg-[#11141A] px-3 text-xs font-bold text-[#3B82F6] sm:inline-flex"
          >
            Exit
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">
              {greeting}, {firstName}
            </h2>
            <p className="mt-1 text-sm text-[#A7ADB8]">Your store at a glance.</p>
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              loadDashboard();
            }}
            className="border border-white/[0.08] bg-[#11141A] px-3 py-2 text-xs font-semibold text-[#A7ADB8]"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* Desktop: 2-col business layout */}
        <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
          {/* Revenue + stats */}
          <section className="space-y-4 lg:col-span-8">
            <div className="border border-[#00E575]/22 bg-gradient-to-br from-[#00E575]/[0.14] to-[#3B82F6]/10 p-[18px]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-[#737A86]">
                  Revenue
                </p>
                <span className="bg-white/[0.06] px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-[#A7ADB8]">
                  {(overview.plan || "free").toUpperCase()}
                </span>
              </div>
              <p className="mt-2.5 text-4xl font-extrabold tracking-tight sm:text-5xl">
                {revenueLabel}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-[18px] text-[#A7ADB8]">
                {overview.revenue && overview.revenue > 0
                  ? "Revenue from completed orders on Plazore."
                  : "Payouts and live totals appear here when payments are enabled."}
              </p>
              <div className="mt-3.5 flex items-center justify-between text-xs">
                <span className="text-[#737A86]">Fee · {feePct}% of product price</span>
                <Link href="/seller/subscription" className="font-bold text-[#00E575]">
                  Plan
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: "Products", value: overview.totalProducts, icon: Package },
                { label: "Pending", value: overview.pendingOrders, icon: Clock },
                { label: "Completed", value: overview.completedOrders, icon: CheckCheck },
              ].map((s) => (
                <div
                  key={s.label}
                  className="border border-white/[0.07] bg-[#11141A] p-3 sm:p-4"
                >
                  <div className="mb-2 flex h-7 w-7 items-center justify-center bg-[#171B22]">
                    <s.icon className="h-4 w-4 text-[#A7ADB8]" />
                  </div>
                  <p className="text-xl font-extrabold sm:text-2xl">{s.value}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#737A86]">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[1.4px] text-[#737A86]">
                Performance
              </p>
              <div className="border border-white/[0.07] bg-[#11141A] p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[15px] font-bold">Engagement</p>
                    <p className="text-[11px] text-[#737A86]">
                      Last {analytics?.rangeDays || 30} days
                    </p>
                  </div>
                  <span
                    className="px-2.5 py-1 text-xs font-extrabold text-[#041412]"
                    style={{
                      backgroundImage: "linear-gradient(90deg,#00E575,#3B82F6)",
                    }}
                  >
                    {analytics?.totals?.score ?? 0} pts
                  </span>
                </div>
                <div className="mt-3">
  <PerformanceBars data={safeSeries} />
</div>
                <p className="mb-2 mt-4 text-[15px] font-bold">Top products</p>
                {safeTop.length === 0 ? (
                  <p className="text-[12.5px] text-[#737A86]">
                    Rankings appear as buyers view, cart, and purchase your items.
                  </p>
                ) : (
                  safeTop.slice(0, 5).map((p, i) => (
                    <button
                      key={String(p?.productId || i)}
                      type="button"
                      onClick={() => {
                        if (p?.productId)
                          router.push(`/seller/products/performance/${p.productId}`);
                      }}
                      className="flex w-full items-center border-b border-white/[0.07] py-2.5 text-left last:border-0"
                    >
                      <span className="w-5 text-xs text-[#737A86]">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">{p?.name || "Product"}</span>
                      {p?.milestone200 ? (
                        <span className="mr-2 bg-[#00E575]/12 px-1.5 py-0.5 text-[9px] font-extrabold text-[#00E575]">
                          200+
                        </span>
                      ) : null}
                      <span className="text-[13px] font-bold text-[#00E575]">{p?.score ?? 0}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Right column — actions + activity */}
          <aside className="space-y-4 lg:col-span-4">
            <div>
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[1.4px] text-[#737A86]">
                Actions
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: "/seller/products/add", label: "Add product", icon: PlusCircle },
                  { href: "/seller/products", label: "Products", icon: Package },
                  { href: "/seller/orders", label: "Orders", icon: Receipt },
                  { href: "/seller/store", label: "Storefront", icon: Store },
                ].map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="flex flex-col items-center border border-white/[0.07] bg-[#11141A] px-3 py-4"
                  >
                    <span className="mb-2 flex h-10 w-10 items-center justify-center bg-[#171B22]">
                      <a.icon className="h-5 w-5" />
                    </span>
                    <span className="text-center text-xs font-semibold text-[#A7ADB8]">{a.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[1.4px] text-[#737A86]">
                  Recent activity
                </p>
                {activity.length > 0 ? (
                  <Link href="/seller/orders" className="text-[13px] font-semibold text-[#00E575]">
                    View all
                  </Link>
                ) : null}
              </div>
              {activity.length === 0 ? (
                <div className="flex flex-col items-center border border-white/[0.07] bg-[#11141A] px-6 py-8 text-center">
                  <ShoppingBag className="h-6 w-6 text-[#737A86]" />
                  <p className="mt-2.5 text-[15px] font-bold">No activity yet</p>
                  <p className="mt-1.5 text-[12.5px] text-[#737A86]">
                    Orders and shipments will show up here.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {activity.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center border border-white/[0.07] bg-[#11141A] p-3"
                    >
                      <span className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center bg-[#00E575]/10">
                        {item.type === "order_shipped" ? (
                          <Plane className="h-[18px] w-[18px] text-[#00E575]" />
                        ) : item.type === "order_delivered" ? (
                          <CheckCircle2 className="h-[18px] w-[18px] text-[#00E575]" />
                        ) : (
                          <ShoppingBag className="h-[18px] w-[18px] text-[#00E575]" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{item.title}</span>
                        <span className="mt-0.5 block text-xs text-[#737A86]">
                          {item.subtitle}
                          {item.at ? ` · ${new Date(item.at).toLocaleDateString()}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border border-white/[0.07] bg-[#11141A] p-4">
              <div className="mb-2.5 flex h-8 w-8 items-center justify-center bg-[#00E575]/10">
                <Lightbulb className="h-[18px] w-[18px] text-[#00E575]" />
              </div>
              <p className="min-h-[42px] text-sm leading-[21px] text-[#A7ADB8]">
                {SELLER_TIPS[tipIndex]}
              </p>
              <div className="mt-3.5 flex gap-1.5">
                {SELLER_TIPS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full ${
                      i === tipIndex ? "w-3.5 bg-[#00E575]" : "w-1.5 bg-white/10"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center border border-white/[0.07] bg-[#11141A] p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#737A86]">
                  Subscription
                </p>
                <p className="mt-1 text-lg font-extrabold capitalize">{overview.plan || "free"}</p>
                <p className="mt-0.5 text-xs text-[#A7ADB8]">{feePct}% product fee</p>
              </div>
              <Link
                href="/seller/subscription"
                className="px-4 py-2.5 text-[13px] font-extrabold text-[#041412]"
                style={{ backgroundImage: "linear-gradient(90deg,#00E575,#3B82F6)" }}
              >
                Manage
              </Link>
            </div>
          </aside>
        </div>

        <p className="mt-8 text-center text-[11px] tracking-wide text-[#737A86]">
          Plazore · Seller Lounge
        </p>
      </div>
    </div>
  );
}