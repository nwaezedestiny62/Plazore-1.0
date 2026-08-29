"use client";

import { useAuth } from "@clerk/nextjs";
import { ChevronLeft, Package } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

type DayPoint = {
  date?: string;
  day?: string;
  label?: string;
  views?: number;
  cartAdds?: number;
  cart?: number;
  purchases?: number;
  sales?: number;
  score?: number;
};

type PerfData = {
  product?: { name?: string; image?: string };
  score?: number;
  views?: number;
  cartAdds?: number;
  purchases?: number;
  milestones?: { p200?: boolean };
  series?: DayPoint[];
};

async function readJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const t = await res.text();
    throw new Error(`Bad response ${res.status}: ${t.slice(0, 80)}`);
  }
  return res.json();
}

/** Normalize API series into consistent points */
function normalizeSeries(raw: DayPoint[] = []): {
  label: string;
  views: number;
  cart: number;
  purchases: number;
}[] {
  return raw.map((d, i) => {
    let label = d.label || d.day || "";
    if (!label && d.date) {
      const dt = new Date(d.date);
      label = Number.isNaN(dt.getTime())
        ? `D${i + 1}`
        : dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    if (!label) label = `${i + 1}`;
    return {
      label,
      views: Number(d.views) || 0,
      cart: Number(d.cartAdds ?? d.cart) || 0,
      purchases: Number(d.purchases ?? d.sales) || 0,
    };
  });
}

/**
 * Multi-metric area + line chart
 * - Soft filled areas for hierarchy (views → cart → purchases)
 * - Clear Y grid + max labels
 * - Hoverable points with tooltips
 */
function PerformanceChart({ series }: { series: DayPoint[] }) {
  const points = useMemo(() => normalizeSeries(series), [series]);
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = 240;
  const PAD = { t: 20, r: 16, b: 36, l: 40 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const maxY = useMemo(() => {
    const m = Math.max(
      1,
      ...points.map((p) => Math.max(p.views, p.cart, p.purchases))
    );
    // nice ceiling
    const pow = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / pow) * pow;
  }, [points]);

  const yTicks = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) =>
      Math.round((maxY * i) / steps)
    );
  }, [maxY]);

  const xAt = (i: number) =>
    PAD.l + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yAt = (v: number) => PAD.t + innerH - (v / maxY) * innerH;

  const pathFor = (key: "views" | "cart" | "purchases", close = false) => {
    if (!points.length) return "";
    const line = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p[key])}`)
      .join(" ");
    if (!close) return line;
    const last = points.length - 1;
    return `${line} L ${xAt(last)} ${yAt(0)} L ${xAt(0)} ${yAt(0)} Z`;
  };

  // Label density: show ~6 labels max
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  if (!points.length) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-2xl border border-white/[0.07] bg-[#0C1520]">
        <p className="text-sm text-[#6B8299]">No activity in the last 30 days</p>
      </div>
    );
  }

  const active = hover != null ? points[hover] : null;

  return (
    <div className="relative">
      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] font-semibold uppercase tracking-wide text-[#6B8299]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#3B82F6]" /> Views
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#14B8A6]" /> Cart adds
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#00E575]" /> Purchases
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[240px] w-full min-w-[320px]"
          role="img"
          aria-label="Product performance last 30 days"
        >
          <defs>
            <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gCart" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#14B8A6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gBuy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00E575" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#00E575" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid */}
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
              <text
                x={PAD.l - 8}
                y={yAt(t) + 3}
                textAnchor="end"
                fill="#4A6078"
                fontSize={10}
                fontFamily="system-ui, sans-serif"
              >
                {t}
              </text>
            </g>
          ))}

          {/* Areas (back → front) */}
          <path d={pathFor("views", true)} fill="url(#gViews)" />
          <path d={pathFor("cart", true)} fill="url(#gCart)" />
          <path d={pathFor("purchases", true)} fill="url(#gBuy)" />

          {/* Lines */}
          <path
            d={pathFor("views")}
            fill="none"
            stroke="#3B82F6"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={pathFor("cart")}
            fill="none"
            stroke="#14B8A6"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={pathFor("purchases")}
            fill="none"
            stroke="#00E575"
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* X labels + hit targets */}
          {points.map((p, i) => (
            <g key={i}>
              {i % labelEvery === 0 && (
                <text
                  x={xAt(i)}
                  y={H - 10}
                  textAnchor="middle"
                  fill="#4A6078"
                  fontSize={10}
                  fontFamily="system-ui, sans-serif"
                >
                  {p.label}
                </text>
              )}
              {/* Hover column */}
              <rect
                x={xAt(i) - innerW / points.length / 2}
                y={PAD.t}
                width={Math.max(innerW / points.length, 8)}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className="cursor-crosshair"
              />
              {hover === i && (
                <>
                  <line
                    x1={xAt(i)}
                    x2={xAt(i)}
                    y1={PAD.t}
                    y2={PAD.t + innerH}
                    stroke="rgba(255,255,255,0.15)"
                    strokeDasharray="3 3"
                  />
                  <circle cx={xAt(i)} cy={yAt(p.views)} r={3.5} fill="#3B82F6" />
                  <circle cx={xAt(i)} cy={yAt(p.cart)} r={3.5} fill="#14B8A6" />
                  <circle
                    cx={xAt(i)}
                    cy={yAt(p.purchases)}
                    r={4}
                    fill="#00E575"
                  />
                </>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Tooltip */}
      {active && hover != null && (
        <div className="pointer-events-none mt-2 flex flex-wrap gap-3 rounded-xl border border-white/[0.08] bg-[#0A121C] px-3 py-2 text-[12px]">
          <span className="font-semibold text-[#F5F7FA]">{active.label}</span>
          <span className="text-[#3B82F6]">Views {active.views}</span>
          <span className="text-[#14B8A6]">Cart {active.cart}</span>
          <span className="text-[#00E575]">Purchases {active.purchases}</span>
        </div>
      )}

      <p className="mt-2 text-[11px] leading-4 text-[#4A6078]">
        Funnel view: how many people saw this product, added it to cart, and
        completed a purchase over the last 30 days.
      </p>
    </div>
  );
}

function OrbLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-[#090B0F]">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#00E575]/30 border-t-[#00E575]" />
    </div>
  );
}

export default function ProductPerformancePage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API}/analytics/seller/product/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await readJson(res);
      if (json?.success) setData(json.data);
      else setError(json?.message || "Could not load analytics");
    } catch (e: any) {
      setError(e?.message || "Could not load analytics");
    } finally {
      setLoading(false);
    }
  }, [id, getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      if (isLoaded && !isSignedIn) setLoading(false);
      return;
    }
    load();
  }, [isLoaded, isSignedIn, load]);

  if (!isLoaded || loading) return <OrbLoader />;

  if (!isSignedIn) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center bg-[#090B0F] px-6 text-center">
        <p className="font-semibold text-[#F5F7FA]">Sign in to view performance</p>
        <Link
          href="/sign-in"
          className="mt-4 rounded-full bg-[#F5F7FA] px-6 py-2.5 text-sm font-bold text-[#090B0F]"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center bg-[#090B0F] px-6 text-center">
        <p className="text-[#7F93A8]">{error || "Could not load analytics"}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 font-semibold text-[#9EC5FF]"
        >
          Go back
        </button>
      </div>
    );
  }

  const score = Number(data.score) || 0;
  const views = Number(data.views) || 0;
  const cartAdds = Number(data.cartAdds) || 0;
  const purchases = Number(data.purchases) || 0;

  // Conversion rates for clarity
  const viewToCart = views > 0 ? ((cartAdds / views) * 100).toFixed(1) : "—";
  const cartToBuy = cartAdds > 0 ? ((purchases / cartAdds) * 100).toFixed(1) : "—";
  const viewToBuy = views > 0 ? ((purchases / views) * 100).toFixed(1) : "—";

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#090B0F]/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center border border-white/[0.07] bg-[#11141A] text-[#A7ADB8] hover:text-white"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.6px] text-[#737A86]">
              Analytics
            </p>
            <h1 className="text-lg font-extrabold tracking-tight">Performance</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-6">
        {/* Product */}
        <div className="flex items-center gap-3">
          {data.product?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.product.image}
              alt=""
              className="h-14 w-14 rounded-2xl bg-[#13263B] object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13263B]">
              <Package className="h-5 w-5 text-[#4A6078]" />
            </div>
          )}
          <p className="line-clamp-2 flex-1 text-base font-bold">
            {data.product?.name || "Product"}
          </p>
        </div>

        {/* Score */}
        <section className="rounded-3xl border border-[#1A2A3A] bg-[#0C1520] p-5">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6B8299]">
            Performance score
          </p>
          <p className="text-[32px] font-extrabold tracking-tight">{score}</p>
          <p className="mt-1 text-xs text-[#4A6078]">
            Views ×1 · Cart ×5 · Purchases ×15
          </p>
          {data.milestones?.p200 ? (
            <span className="mt-2 inline-block rounded-full bg-[#1A2F28] px-2.5 py-1 text-[11px] font-bold text-[#8FE3B0]">
              Milestone · 200 pts
            </span>
          ) : null}
        </section>

        {/* KPI tiles */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Views", value: views, pts: "×1", color: "#3B82F6" },
            { label: "Cart adds", value: cartAdds, pts: "×5", color: "#14B8A6" },
            { label: "Purchases", value: purchases, pts: "×15", color: "#00E575" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-[20px] border border-[#1A2A3A] bg-[#0C1520] p-3"
            >
              <p className="text-[10px] font-semibold uppercase text-[#6B8299]">
                {s.label}
              </p>
              <p className="mt-1 text-[18px] font-bold" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="mt-0.5 text-[10px] text-[#4A6078]">{s.pts} pts</p>
            </div>
          ))}
        </div>

        {/* Conversion strip */}
        <section className="rounded-2xl border border-[#1A2A3A] bg-[#0C1520] px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B8299]">
            Conversion
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-extrabold text-[#F5F7FA]">{viewToCart}%</p>
              <p className="text-[10px] text-[#4A6078]">View → Cart</p>
            </div>
            <div>
              <p className="text-lg font-extrabold text-[#F5F7FA]">{cartToBuy}%</p>
              <p className="text-[10px] text-[#4A6078]">Cart → Buy</p>
            </div>
            <div>
              <p className="text-lg font-extrabold text-[#00E575]">{viewToBuy}%</p>
              <p className="text-[10px] text-[#4A6078]">View → Buy</p>
            </div>
          </div>
        </section>

        {/* Chart */}
        <section className="rounded-3xl border border-[#1A2A3A] bg-[#0C1520] p-5">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">Last 30 days</h2>
            <span className="text-[11px] text-[#4A6078]">Hover a day for detail</span>
          </div>
          <PerformanceChart series={data.series || []} />
        </section>
      </div>
    </div>
  );
}