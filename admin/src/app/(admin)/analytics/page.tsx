"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  RefreshCw,
  Users,
  Store,
  Eye,
  Sparkles,
  Database,
  Calendar,
} from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import { Badge, Button, ErrorBlock, Panel, cn } from "@/components/ui";

type EnvKind = "development" | "production" | "unknown";
type RangeKey = "day" | "week" | "month" | "year" | "overall";

const RANGE_PRESETS: {
  key: RangeKey;
  label: string;
  days: number;
  hint: string;
}[] = [
  { key: "day", label: "Day", days: 1, hint: "Last 24 hours" },
  { key: "week", label: "Week", days: 7, hint: "Last 7 days" },
  { key: "month", label: "Month", days: 30, hint: "Last 30 days" },
  { key: "year", label: "Year", days: 365, hint: "Last 12 months" },
  { key: "overall", label: "Overall", days: 3650, hint: "All time (~10y)" },
];

function detectEnvFromApi(): EnvKind {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_URL ||
    "";
  const lower = base.toLowerCase();
  if (
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes(":3000")
  ) {
    return "development";
  }
  if (lower.includes("plazore") || lower.startsWith("https://")) {
    return "production";
  }
  if (process.env.NODE_ENV === "development") return "development";
  if (process.env.NODE_ENV === "production") return "production";
  return "unknown";
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3.5 backdrop-blur-sm transition duration-300 hover:border-white/[0.14] hover:bg-white/[0.05]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>
      <p className="mt-2 text-[22px] font-semibold tabular-nums leading-none tracking-tight text-[#F5F7FA]">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-[11px] leading-snug text-white/35">{hint}</p>
      ) : null}
    </div>
  );
}

/** Tall visual chart with gradient bars + peak highlight */
function VizChart({
  title,
  series,
  valueKey,
  color = "#3B82F6",
  color2 = "#00E575",
}: {
  title: string;
  series: any[];
  valueKey: string;
  color?: string;
  color2?: string;
}) {
  const values = series.map((r) => Number(r[valueKey] ?? 0));
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const peak = Math.max(0, ...values);
  const peakIdx = values.indexOf(peak);

  if (!series.length) {
    return (
      <Panel className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-5">
        <p className="text-[11px] font-medium text-white/40">{title}</p>
        <p className="mt-6 text-center text-sm text-white/30">No series data</p>
      </Panel>
    );
  }

  return (
    <Panel className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium text-white/40">{title}</p>
          <p className="mt-1 text-[20px] font-semibold tabular-nums">
            {total.toLocaleString()}
            <span className="ml-2 text-[12px] font-normal text-white/35">
              total in range
            </span>
          </p>
        </div>
        <p className="text-[11px] text-white/35">
          Peak {peak.toLocaleString()}
          {series[peakIdx]?.date ? ` · ${series[peakIdx].date}` : ""}
        </p>
      </div>

      <div className="relative h-40 sm:h-48">
        {/* grid lines */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-white/[0.04]" />
          ))}
        </div>
        <div className="absolute inset-0 flex items-end gap-[2px] sm:gap-1">
          {values.map((v, i) => {
            const h = Math.max(v ? 4 : 0, (v / max) * 100);
            const isPeak = i === peakIdx && v > 0;
            return (
              <div
                key={i}
                className="group relative min-w-0 flex-1"
                style={{ height: "100%" }}
              >
                <div className="absolute inset-x-0 bottom-0 flex h-full items-end">
                  <div
                    className="w-full rounded-t-sm transition-all duration-500 ease-out group-hover:brightness-125"
                    style={{
                      height: `${h}%`,
                      background: isPeak
                        ? `linear-gradient(180deg, ${color2}, ${color})`
                        : `linear-gradient(180deg, ${color}cc, ${color}55)`,
                      boxShadow: isPeak
                        ? `0 0 16px ${color2}55`
                        : undefined,
                    }}
                  />
                </div>
                <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#0E1116] px-2 py-1 text-[10px] text-white group-hover:block">
                  {v.toLocaleString()}
                  {series[i]?.date ? (
                    <span className="text-white/40"> · {series[i].date}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex justify-between text-[10px] text-white/30">
        <span>{series[0]?.date || "—"}</span>
        <span>{series[series.length - 1]?.date || "—"}</span>
      </div>
    </Panel>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Activity;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[#00E575]" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {title}
        </p>
      </div>
      {children}
    </section>
  );
}

export default function AnalyticsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [range, setRange] = useState<RangeKey>("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const days =
    RANGE_PRESETS.find((r) => r.key === range)?.days ?? 30;
  const rangeMeta = RANGE_PRESETS.find((r) => r.key === range);

  const clientEnv = useMemo(() => detectEnvFromApi(), []);
  const env: EnvKind =
    (data?.environment as EnvKind) ||
    (data?.meta?.environment as EnvKind) ||
    clientEnv;

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      setLoading(true);
      setError("");
      const token = await getToken();
      const json = await adminFetch<any>(
        `/admin/analytics?days=${days}`,
        token,
      );
      setData(json.data);
      setFetchedAt(new Date().toISOString());
    } catch (e: any) {
      setError(e.message || "Failed to load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, days, isLoaded, isSignedIn]);

  useEffect(() => {
    load();
  }, [load]);

  const c = data?.commerce;
  const series = c?.series || [];
  const rangeLabel =
    data?.rangeDays != null ? `${data.rangeDays}d` : `${days}d`;

  const envTone =
    env === "production" ? "error" : env === "development" ? "warn" : "neutral";
  const envLabel =
    env === "production"
      ? "Production data"
      : env === "development"
        ? "Development data"
        : "Environment unknown";

  return (
    <div className="relative mx-auto max-w-6xl pb-10 text-[#F5F7FA]">
      <header className="mb-6 sm:mb-8">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
          INTELLIGENCE
        </p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold tracking-tight sm:text-[32px]">
              Analytics
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-white/50">
              Marketplace and discovery health from the live database. No GMV
              or payment totals on this screen.
            </p>
          </div>
          <Button
            tone="ghost"
            className="h-10 gap-1.5 rounded-full border border-white/15 bg-[#14181F] px-4 text-xs text-[#F5F7FA]"
            disabled={loading}
            onClick={load}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>

        {/* Range filter */}
        <div className="mt-5">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            <Calendar className="h-3 w-3" /> Time range
          </p>
          <div className="flex flex-wrap gap-2">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setRange(p.key)}
                className={cn(
                  "rounded-full border px-4 py-2 text-[13px] font-semibold transition",
                  range === p.key
                    ? "border-transparent text-[#041412]"
                    : "border-white/12 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white",
                )}
                style={
                  range === p.key
                    ? {
                        backgroundImage:
                          "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)",
                      }
                    : undefined
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-white/35">
            {rangeMeta?.hint} · API window {rangeLabel}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={envTone as any}>
            <span className="inline-flex items-center gap-1.5">
              <Database className="h-3 w-3" />
              {envLabel}
            </span>
          </Badge>
          <Badge tone="blue">
            {rangeMeta?.label} · {rangeLabel}
          </Badge>
          {fetchedAt ? (
            <span className="text-[11px] text-white/35">
              Updated{" "}
              {new Date(fetchedAt).toLocaleString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      ) : null}

      {loading && !data ? (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
          <OrbLoader label="Loading analytics…" />
        </div>
      ) : data ? (
        <div className="space-y-8 sm:space-y-10">
          <Section title="Marketplace activity" icon={Activity}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              <Stat label="Orders" value={c?.orders ?? 0} />
              <Stat label="Delivered" value={c?.completedDelivered ?? 0} />
              <Stat label="Cancelled" value={c?.cancelled ?? 0} />
              <Stat label="Carts with items" value={c?.cartsWithItems ?? 0} />
              <Stat label="Catalog views" value={c?.catalogViews ?? 0} />
              <Stat
                label="View → purchase"
                value={
                  c?.conversionRatePct == null || c?.conversionRatePct === ""
                    ? "—"
                    : `${c.conversionRatePct}%`
                }
                hint="From ProductPerformance"
              />
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <VizChart
                title="Orders over time"
                series={series}
                valueKey="orders"
                color="#3B82F6"
                color2="#00E575"
              />
              <VizChart
                title="Delivered over time"
                series={series}
                valueKey="delivered"
                color="#14B8A6"
                color2="#00E575"
              />
            </div>
          </Section>

          <Section title="App vs web" icon={Eye}>
            <Panel className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-4">
              <p className="text-[13px] leading-relaxed text-white/50">
                {data.appVsWeb?.note ||
                  "Orders do not store app vs web source. Showing last-seen presence only."}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Stat
                  label="Last seen web"
                  value={data.appVsWeb?.presence?.web ?? 0}
                />
                <Stat
                  label="Last seen app"
                  value={data.appVsWeb?.presence?.app ?? 0}
                />
                <Stat
                  label="Last seen admin"
                  value={data.appVsWeb?.presence?.admin ?? 0}
                />
                <Stat
                  label="Unknown / unset"
                  value={data.appVsWeb?.presence?.unknown ?? 0}
                />
              </div>
            </Panel>
          </Section>

          <Section title="Sellers" icon={Store}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="Sellers" value={data.sellers?.total ?? 0} />
              <Stat label="New sellers 7d" value={data.sellers?.new7d ?? 0} />
              <Stat
                label="Active listings"
                value={data.sellers?.productsListed ?? 0}
              />
              <Stat
                label="Campaign remaining"
                value={data.sellers?.campaign?.remaining ?? 0}
                hint={`${data.sellers?.campaign?.recruited ?? 0} / ${data.sellers?.campaign?.cap ?? 0}`}
              />
            </div>
          </Section>

          <Section title="Buyers & users" icon={Users}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
              <Stat label="Registered" value={data.buyers?.registered ?? 0} />
              <Stat label="Buyer-only" value={data.buyers?.buyerOnly ?? 0} />
              <Stat
                label="Seller accounts"
                value={data.buyers?.sellerAccounts ?? 0}
              />
              <Stat label="New 7d" value={data.buyers?.new7d ?? 0} />
              <Stat label="Active 7d" value={data.buyers?.active7d ?? 0} />
              <Stat
                label="Repeat shoppers"
                value={data.buyers?.repeatShoppers ?? 0}
              />
            </div>
          </Section>

          <Section title="Discovery funnel" icon={Eye}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
              <Stat
                label="Impressions"
                value={data.discovery?.funnel?.impression ?? 0}
              />
              <Stat label="Opens" value={data.discovery?.funnel?.open ?? 0} />
              <Stat
                label="Showroom carts"
                value={data.discovery?.funnel?.cart ?? 0}
              />
              <Stat
                label="Wishlist"
                value={data.discovery?.funnel?.wishlist ?? 0}
              />
              <Stat
                label="Showroom purchase"
                value={data.discovery?.funnel?.purchase ?? 0}
              />
              <Stat label="Skips" value={data.discovery?.funnel?.skip ?? 0} />
            </div>
          </Section>

          <Section title="Product intelligence" icon={Sparkles}>
            <div className="grid grid-cols-3 gap-2.5">
              <Stat
                label="Ready"
                value={data.intelligence?.productsReady ?? 0}
              />
              <Stat label="Pending" value={data.intelligence?.pending ?? 0} />
              <Stat label="Failed" value={data.intelligence?.failed ?? 0} />
            </div>
          </Section>

          <Section title="Platform signals" icon={Activity}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label="Cancelled orders"
                value={data.platformHealth?.cancelledOrders ?? 0}
              />
              <Stat
                label="AI failures"
                value={data.platformHealth?.intelligenceFailures ?? 0}
              />
              <Stat
                label="AI pending"
                value={data.platformHealth?.intelligencePending ?? 0}
              />
            </div>
          </Section>
        </div>
      ) : null}
    </div>
  );
}