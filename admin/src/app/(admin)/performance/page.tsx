"use client";

import { useAuth } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import { Badge, Button, ErrorBlock, Panel, Select, cn } from "@/components/ui";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type HealthState =
  | "operational"
  | "degraded"
  | "warning"
  | "critical"
  | "no_data";

function stateTone(
  s: HealthState
): "green" | "warn" | "error" | "neutral" | "blue" {
  if (s === "operational") return "green";
  if (s === "degraded" || s === "warning") return "warn";
  if (s === "critical") return "error";
  return "neutral";
}

function stateLabel(s: HealthState) {
  switch (s) {
    case "operational":
      return "Operational";
    case "degraded":
      return "Degraded";
    case "warning":
      return "Warning";
    case "critical":
      return "Critical";
    default:
      return "No data";
  }
}

function fmtMs(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${Math.round(v)} ms`;
}

function fmtRate(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(2)}%`;
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
    <div className="border border-[#252A33] bg-[#11141A] px-3 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
        {label}
      </p>
      <p className="mt-1.5 text-[22px] font-semibold tabular-nums leading-none">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint ? <p className="mt-1.5 text-[11px] text-[#737A86]">{hint}</p> : null}
    </div>
  );
}

function Bars({
  values,
  color = "#00E575",
}: {
  values: number[];
  color?: string;
}) {
  if (!values.length) {
    return (
      <div className="flex h-20 items-center justify-center text-[11px] text-[#737A86]">
        No series data in range
      </div>
    );
  }
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-20 items-end gap-px">
      {values.map((v, i) => (
        <div
          key={i}
          className="min-w-0 flex-1"
          title={String(v)}
          style={{
            height: `${Math.max(v ? 6 : 0, (v / max) * 100)}%`,
            background: color,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

function ServiceCard({
  label,
  state,
  note,
  meta,
}: {
  label: string;
  state: HealthState;
  note?: string;
  meta?: string;
}) {
  return (
    <div className="border border-[#252A33] bg-[#11141A] px-3 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
          {label}
        </p>
        <Badge tone={stateTone(state)}>{stateLabel(state)}</Badge>
      </div>
      {meta ? (
        <p className="mt-2 text-[13px] tabular-nums text-[#F5F7FA]">{meta}</p>
      ) : null}
      {note ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#737A86]">{note}</p>
      ) : null}
    </div>
  );
}

export default function PerformancePage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [environment, setEnvironment] = useState("production");
  const [range, setRange] = useState("1h");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      setLoading(true);
      setError("");
      const token = await getToken();
      const json = await adminFetch<any>(
        `/admin/performance?environment=${environment}&range=${range}`,
        token
      );
      setData(json.data);
    } catch (e: any) {
      setError(e.message || "Failed to load performance data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, isLoaded, isSignedIn, environment, range]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const health = data?.health;
  const services = health?.services;

  const serviceCards = useMemo(() => {
    if (!services) return [];
    return [
      { key: "overall", label: "Overall", s: services.overall },
      { key: "app", label: "App", s: services.app },
      { key: "web", label: "Web", s: services.web },
      { key: "api", label: "API / Backend", s: services.api },
      { key: "database", label: "Database", s: services.database },
      { key: "authentication", label: "Authentication", s: services.authentication },
      { key: "payments", label: "Payments", s: services.payments },
      { key: "storage", label: "Storage", s: services.storage },
      { key: "backgroundJobs", label: "Background jobs", s: services.backgroundJobs },
    ];
  }, [services]);

  return (
    <div
      className={cn(
        poppins.className,
        "relative min-h-[70vh] pb-24 text-[#F5F7FA]"
      )}
    >
      <header className="mb-6 border-b border-[#252A33] pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
          Platform
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight sm:text-[28px]">
              Data & App Performance
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#A7ADB8]">
              Live platform health, latency, errors, and system activity. Real
              telemetry only — nothing invented.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
            >
              <option value="production">Production</option>
              <option value="development">Development</option>
              <option value="test">Test</option>
            </Select>
            <Select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="5m">Last 5 minutes</option>
              <option value="1h">Last hour</option>
              <option value="6h">Last 6 hours</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </Select>
            <Button
              tone="ghost"
              className="h-9 gap-1.5 text-xs"
              disabled={loading}
              onClick={load}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", loading && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {environment === "production" ? (
            <Badge tone="error">Production</Badge>
          ) : (
            <Badge tone="neutral">{environment}</Badge>
          )}
          <Badge tone="blue">Live · 30s</Badge>
          {health?.environmentNote ? (
            <Badge tone="warn">{health.environmentNote}</Badge>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      ) : null}

      {loading && !data ? (
        <div className="border border-[#252A33] bg-[#11141A]">
          <OrbLoader label="Loading performance" />
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* Platform health */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Platform health
            </p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge
                tone={stateTone((health?.overall as HealthState) || "no_data")}
              >
                {stateLabel((health?.overall as HealthState) || "no_data")}
              </Badge>
              <span className="text-xs text-[#737A86]">
                Active incidents — {health?.activeIncidents ?? 0}
              </span>
              <span className="text-xs text-[#737A86]">
                Window {health?.window || "15m"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {serviceCards.map((c) => {
                const st = (c.s?.state as HealthState) || "no_data";
                const meta =
                  c.s?.avgMs != null
                    ? `avg ${fmtMs(c.s.avgMs)} · err ${fmtRate(c.s.errorRate)} · ${c.s.requests ?? 0} req`
                    : undefined;
                return (
                  <ServiceCard
                    key={c.key}
                    label={c.label}
                    state={st}
                    note={c.s?.note}
                    meta={meta}
                  />
                );
              })}
            </div>
          </section>

          {/* App vs Web */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              App vs web
            </p>
            {data.appVsWeb?.note ? (
              <p className="mb-3 text-xs text-[#737A86]">{data.appVsWeb.note}</p>
            ) : null}
            <div className="grid gap-2 md:grid-cols-2">
              {(["app", "web"] as const).map((side) => {
                const s = data.appVsWeb?.[side] || data.health?.services?.[side] || {};
                return (
                  <Panel key={side} className="p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold uppercase tracking-wide">
                        {side}
                      </p>
                      <Badge tone={stateTone((s.state as HealthState) || "no_data")}>
                        {stateLabel((s.state as HealthState) || "no_data")}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Stat label="Requests" value={s.requests ?? "—"} />
                      <Stat label="Avg latency" value={fmtMs(s.avgMs)} />
                      <Stat label="Error rate" value={fmtRate(s.errorRate)} />
                      <Stat
                        label="Active 24h"
                        value={s.activeUsers24h ?? "—"}
                        hint="lastSeenPlatform"
                      />
                    </div>
                    {s.note ? (
                      <p className="mt-3 text-[11px] text-[#737A86]">{s.note}</p>
                    ) : null}
                  </Panel>
                );
              })}
            </div>
          </section>

          {/* Charts */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Performance series
            </p>
            <Panel className="p-4">
              <p className="mb-2 text-[11px] text-[#737A86]">Request volume</p>
              <Bars
                values={(data.series?.requests || []).map((p: any) => p.v || 0)}
              />
              <p className="mb-2 mt-4 text-[11px] text-[#737A86]">
                Avg API latency (ms)
              </p>
              <Bars
                values={(data.series?.avgLatency || []).map((p: any) => p.v || 0)}
                color="#3B82F6"
              />
              <p className="mb-2 mt-4 text-[11px] text-[#737A86]">Error rate</p>
              <Bars
                values={(data.series?.errorRate || []).map(
                  (p: any) => (p.v || 0) * 100
                )}
                color="#F87171"
              />
              <p className="mt-3 text-[11px] text-[#737A86]">
                1-minute buckets · latency warn{" "}
                {health?.thresholds?.latencyWarnMs ?? 800}ms / crit{" "}
                {health?.thresholds?.latencyCritMs ?? 2000}ms · error warn{" "}
                {((health?.thresholds?.errorRateWarn ?? 0.02) * 100).toFixed(0)}%
                / crit{" "}
                {((health?.thresholds?.errorRateCrit ?? 0.08) * 100).toFixed(0)}%
              </p>
            </Panel>
          </section>

          {/* Issues */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Issues & anomalies
            </p>
            {(data.anomalies || []).length === 0 &&
            (data.incidents || []).length === 0 ? (
              <Panel className="p-6 text-sm text-[#A7ADB8]">
                No active anomalies or incidents in the detection window.
              </Panel>
            ) : (
              <div className="space-y-2">
                {(data.anomalies || []).map((a: any, i: number) => (
                  <Panel key={`a-${i}`} className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          a.severity === "critical" || a.severity === "high"
                            ? "error"
                            : a.severity === "observation"
                              ? "blue"
                              : "warn"
                        }
                      >
                        {a.severity}
                      </Badge>
                      <span className="text-sm font-medium">{a.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#A7ADB8]">{a.description}</p>
                    <p className="mt-1 text-[11px] text-[#737A86]">
                      Source: {a.source}
                    </p>
                  </Panel>
                ))}
                {(data.incidents || []).map((inc: any) => (
                  <Panel key={inc._id} className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          inc.severity === "critical" || inc.severity === "high"
                            ? "error"
                            : "warn"
                        }
                      >
                        {inc.severity}
                      </Badge>
                      <Badge tone="neutral">{inc.status}</Badge>
                      <span className="text-sm font-medium">{inc.title}</span>
                    </div>
                    {inc.description ? (
                      <p className="mt-1 text-xs text-[#A7ADB8]">
                        {inc.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] tabular-nums text-[#737A86]">
                      Occurrences {inc.occurrences} · First{" "}
                      {inc.firstDetected
                        ? new Date(inc.firstDetected).toLocaleString()
                        : "—"}{" "}
                      · Last{" "}
                      {inc.lastDetected
                        ? new Date(inc.lastDetected).toLocaleString()
                        : "—"}
                    </p>
                  </Panel>
                ))}
              </div>
            )}
          </section>

          {/* Database */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Database
            </p>
            <Panel className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={stateTone((data.database?.state as HealthState) || "no_data")}>
                  {stateLabel((data.database?.state as HealthState) || "no_data")}
                </Badge>
                <span className="text-xs text-[#A7ADB8]">{data.database?.note}</span>
              </div>
              {data.database?.detail ? (
                <p className="mt-3 text-sm text-[#A7ADB8]">{data.database.detail}</p>
              ) : null}
            </Panel>
          </section>

          {/* Slow operations */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Slow operations
            </p>
            <Panel className="overflow-x-auto p-0">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-[#252A33] text-[10px] uppercase tracking-wide text-[#737A86]">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Route</th>
                    <th className="px-3 py-2.5 font-medium">Surface</th>
                    <th className="px-3 py-2.5 font-medium">Count</th>
                    <th className="px-3 py-2.5 font-medium">Avg</th>
                    <th className="px-3 py-2.5 font-medium">Max</th>
                    <th className="px-3 py-2.5 font-medium">5xx</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.slowOperations?.api || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-[#737A86]">
                        No slow API requests in this range.
                      </td>
                    </tr>
                  ) : (
                    (data.slowOperations?.api || []).map((r: any, i: number) => (
                      <tr key={i} className="border-b border-[#252A33]/80">
                        <td className="px-3 py-2 font-mono text-[12px]">
                          {r.route}
                        </td>
                        <td className="px-3 py-2">{r.surface}</td>
                        <td className="px-3 py-2 tabular-nums">{r.count}</td>
                        <td className="px-3 py-2 tabular-nums">{r.avgMs} ms</td>
                        <td className="px-3 py-2 tabular-nums">{r.maxMs} ms</td>
                        <td className="px-3 py-2 tabular-nums">{r.errors}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>
          </section>

          {/* Recent errors */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Recent server errors
            </p>
            <Panel className="p-0">
              {(data.recentErrors || []).length === 0 ? (
                <p className="p-6 text-sm text-[#737A86]">
                  No 5xx / error events in range.
                </p>
              ) : (
                <ul className="divide-y divide-[#252A33]">
                  {(data.recentErrors || []).slice(0, 20).map((e: any, i: number) => (
                    <li key={i} className="px-3 py-2.5 text-sm">
                      <div className="flex flex-wrap gap-2 text-[12px]">
                        <Badge tone="error">{e.statusCode || "err"}</Badge>
                        <span className="font-mono text-[#A7ADB8]">{e.route}</span>
                        <span className="text-[#737A86]">{e.surface}</span>
                        <span className="tabular-nums text-[#737A86]">
                          {e.createdAt
                            ? new Date(e.createdAt).toLocaleString()
                            : ""}
                        </span>
                      </div>
                      {e.message ? (
                        <p className="mt-1 text-[12px] text-[#A7ADB8]">
                          {e.message}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>

          {/* Commerce activity */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Commerce activity
            </p>
            <p className="mb-2 text-xs text-[#737A86]">
              {data.commerceActivity?.note ||
                "Marketplace signals — separate from system health."}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label="Orders (7d)"
                value={data.commerceActivity?.ordersLast7d ?? "—"}
              />
              <Stat
                label="Product views"
                value={data.commerceActivity?.productViewsAllTime ?? "—"}
              />
              <Stat
                label="Cart adds"
                value={data.commerceActivity?.cartAddsAllTime ?? "—"}
              />
              <Stat
                label="Purchases tracked"
                value={data.commerceActivity?.purchasesAllTime ?? "—"}
              />
            </div>
          </section>

          {/* Service map */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Service overview
            </p>
            <Panel className="p-4">
              <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-[#A7ADB8]">{`APP   →  API / BACKEND  →  DATABASE
WEB   →  API / BACKEND  →  DATABASE
ADMIN →  API / BACKEND  →  DATABASE

Auth (Clerk) · Storage · Jobs
Payments — not instrumented`}</pre>
            </Panel>
          </section>

          {/* Instrumentation */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Instrumentation
            </p>
            <Panel className="p-4">
              <div className="grid gap-1.5 sm:grid-cols-2">
                {Object.entries(data.instrumentation || {}).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between gap-3 border border-[#252A33] bg-[#171B22] px-3 py-2 text-[12px]"
                  >
                    <span className="text-[#737A86]">{k}</span>
                    <span className="tabular-nums text-[#A7ADB8]">
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[#737A86]">
                Payments remain unmonitored by design. Client crash reporting and
                Web Vitals still need separate pipelines.
              </p>
            </Panel>
          </section>
        </div>
      ) : null}
    </div>
  );
}