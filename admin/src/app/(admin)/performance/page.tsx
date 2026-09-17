"use client";

import { useAuth } from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  Database,
  Lock,
  RefreshCw,
  Server,
} from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import {
  Badge,
  Button,
  ErrorBlock,
  Panel,
  cn,
} from "@/components/ui";

const GATE_KEY = "plazore.admin.performanceGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PERFORMANCE_PASSWORD || "";
const POLL_MS = 15_000;

type HealthState =
  | "operational"
  | "degraded"
  | "warning"
  | "critical"
  | "no_data";

type EnvKind = "development" | "production" | "unknown";

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
  )
    return "development";
  if (lower.includes("plazore") || lower.startsWith("https://"))
    return "production";
  if (process.env.NODE_ENV === "development") return "development";
  if (process.env.NODE_ENV === "production") return "production";
  return "unknown";
}

function stateTone(
  s: HealthState,
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

function DarkSelect({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ colorScheme: "dark" }}
      className={cn(
        "h-10 rounded-xl border border-white/12 bg-[#14181F] px-3 text-[13px] text-[#F5F7FA] outline-none focus:border-[#00E575]/40",
        className,
      )}
    >
      {children}
    </select>
  );
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
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3.5">
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

function Bars({
  values,
  color = "#00E575",
  label,
}: {
  values: number[];
  color?: string;
  label?: string;
}) {
  if (!values.length) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] text-[11px] text-white/35">
        No series data in range
      </div>
    );
  }
  const max = Math.max(1, ...values);
  const latest = values[values.length - 1] ?? 0;
  return (
    <div>
      {label ? (
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] text-white/40">{label}</p>
          <p className="text-[12px] font-semibold tabular-nums text-white/70">
            {typeof latest === "number" ? latest.toLocaleString(undefined, { maximumFractionDigits: 2 }) : latest}
          </p>
        </div>
      ) : null}
      <div className="flex h-24 items-end gap-px rounded-xl border border-white/[0.06] bg-white/[0.02] px-1.5 pb-1.5 pt-2">
        {values.map((v, i) => (
          <div
            key={i}
            className="min-w-0 flex-1 rounded-sm transition-all duration-300"
            title={String(v)}
            style={{
              height: `${Math.max(v ? 4 : 0, (v / max) * 100)}%`,
              background: color,
              opacity: 0.35 + (0.65 * (i + 1)) / values.length,
            }}
          />
        ))}
      </div>
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
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3.5 transition hover:border-white/[0.12]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
          {label}
        </p>
        <Badge tone={stateTone(state)}>{stateLabel(state)}</Badge>
      </div>
      {meta ? (
        <p className="mt-2 text-[13px] tabular-nums text-[#F5F7FA]">{meta}</p>
      ) : null}
      {note ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">{note}</p>
      ) : null}
    </div>
  );
}

function PerformanceGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(GATE_KEY) === "1") setUnlocked(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EXPECTED_PASSWORD) {
      setErr("Set NEXT_PUBLIC_ADMIN_PERFORMANCE_PASSWORD in .env");
      return;
    }
    if (password === EXPECTED_PASSWORD) {
      try {
        sessionStorage.setItem(GATE_KEY, "1");
      } catch {
        /* ignore */
      }
      setUnlocked(true);
      setErr("");
      return;
    }
    setErr("Incorrect password.");
    setShake(true);
    window.setTimeout(() => setShake(false), 420);
  };

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-white/35">
        …
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 text-[#F5F7FA]">
        <div
          className={cn(
            "rounded-2xl border border-white/10 bg-[#0E1116]/95 p-6 sm:p-8",
            shake && "animate-[plazore-shake_0.4s_ease-in-out]",
          )}
        >
          <div className="h-px bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />
          <div className="mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
            <Lock className="h-4 w-4 text-[#00E575]" />
          </div>
          <p className="mt-4 text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
            RESTRICTED
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Data &amp; Performance</h1>
          <p className="mt-2 text-[13px] text-white/45">
            Enter access password to continue.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access password"
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-white/12 bg-[#14181F] px-4 text-sm text-[#F5F7FA] outline-none focus:border-[#00E575]/45"
            />
            {err && <p className="text-xs text-red-400">{err}</p>}
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6] text-sm font-extrabold text-[#041412]"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function PerformanceDirectory() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const clientEnv = useMemo(() => detectEnvFromApi(), []);
  const envTone =
    clientEnv === "production"
      ? "error"
      : clientEnv === "development"
        ? "warn"
        : "neutral";
  const envLabel =
    clientEnv === "production"
      ? "Production data"
      : clientEnv === "development"
        ? "Development data"
        : "Environment unknown";

  const [environment, setEnvironment] = useState(
    clientEnv === "development" ? "development" : "production",
  );
  const [range, setRange] = useState("1h");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);
  const [lastLiveAt, setLastLiveAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      setLoading(true);
      setError("");
      const token = await getToken();
      const json = await adminFetch<any>(
        `/admin/performance?environment=${environment}&range=${range}`,
        token,
      );
      setData(json.data);
      setLastLiveAt(new Date());
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
    const id = setInterval(() => load(), POLL_MS);
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
      {
        key: "authentication",
        label: "Authentication",
        s: services.authentication,
      },
      { key: "payments", label: "Payments", s: services.payments },
      { key: "storage", label: "Storage", s: services.storage },
      {
        key: "backgroundJobs",
        label: "Background jobs",
        s: services.backgroundJobs,
      },
    ];
  }, [services]);

  return (
    <div className="relative mx-auto max-w-6xl pb-24 text-[#F5F7FA]">
      <header className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
              PLATFORM
            </p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight sm:text-[32px]">
              Data &amp; app performance
            </h1>
            <p className="mt-2 max-w-2xl text-[13.5px] text-white/50">
              Live health, latency, errors, and system activity. Real telemetry
              only — nothing invented. Auto-refreshes every {POLL_MS / 1000}s.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DarkSelect
              value={environment}
              onChange={setEnvironment}
              className="min-w-[130px]"
            >
              <option value="production">Production</option>
              <option value="development">Development</option>
              <option value="test">Test</option>
            </DarkSelect>
            <DarkSelect
              value={range}
              onChange={setRange}
              className="min-w-[140px]"
            >
              <option value="5m">Last 5 minutes</option>
              <option value="1h">Last hour</option>
              <option value="6h">Last 6 hours</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </DarkSelect>
            <Button
              tone="ghost"
              className="h-10 gap-1.5 rounded-full border border-white/12 bg-[#14181F] text-xs"
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
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={envTone as any}>
            <Database className="mr-1 inline h-3 w-3" />
            {envLabel}
          </Badge>
          <Badge tone="blue">
            <Activity className="mr-1 inline h-3 w-3" />
            Live · {POLL_MS / 1000}s
          </Badge>
          <Badge tone="neutral">Query env: {environment}</Badge>
          {lastLiveAt ? (
            <span className="text-[11px] text-white/35">
              Updated {lastLiveAt.toLocaleTimeString()}
            </span>
          ) : null}
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
        <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
          <OrbLoader label="Loading performance" />
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* Platform health */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Platform health
            </p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge
                tone={stateTone((health?.overall as HealthState) || "no_data")}
              >
                {stateLabel((health?.overall as HealthState) || "no_data")}
              </Badge>
              <span className="text-xs text-white/40">
                Active incidents — {health?.activeIncidents ?? 0}
              </span>
              <span className="text-xs text-white/40">
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
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              App vs web
            </p>
            {data.appVsWeb?.note ? (
              <p className="mb-3 text-xs text-white/40">{data.appVsWeb.note}</p>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              {(["app", "web"] as const).map((side) => {
                const s =
                  data.appVsWeb?.[side] || data.health?.services?.[side] || {};
                return (
                  <Panel
                    key={side}
                    className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold uppercase tracking-wide">
                        {side}
                      </p>
                      <Badge
                        tone={stateTone((s.state as HealthState) || "no_data")}
                      >
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
                      <p className="mt-3 text-[11px] text-white/40">{s.note}</p>
                    ) : null}
                  </Panel>
                );
              })}
            </div>
          </section>

          {/* Charts */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Performance series
            </p>
            <Panel className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
              <div className="space-y-5">
                <Bars
                  label="Request volume"
                  values={(data.series?.requests || []).map(
                    (p: any) => p.v || 0,
                  )}
                />
                <Bars
                  label="Avg API latency (ms)"
                  values={(data.series?.avgLatency || []).map(
                    (p: any) => p.v || 0,
                  )}
                  color="#3B82F6"
                />
                <Bars
                  label="Error rate (%)"
                  values={(data.series?.errorRate || []).map(
                    (p: any) => (p.v || 0) * 100,
                  )}
                  color="#F87171"
                />
              </div>
              <p className="mt-4 text-[11px] text-white/35">
                1-minute buckets · latency warn{" "}
                {health?.thresholds?.latencyWarnMs ?? 800}ms / crit{" "}
                {health?.thresholds?.latencyCritMs ?? 2000}ms · error warn{" "}
                {(
                  (health?.thresholds?.errorRateWarn ?? 0.02) * 100
                ).toFixed(0)}
                % / crit{" "}
                {(
                  (health?.thresholds?.errorRateCrit ?? 0.08) * 100
                ).toFixed(0)}
                %
              </p>
            </Panel>
          </section>

          {/* Issues */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Issues &amp; anomalies
            </p>
            {(data.anomalies || []).length === 0 &&
            (data.incidents || []).length === 0 ? (
              <Panel className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-6 text-sm text-white/50">
                No active anomalies or incidents in the detection window.
              </Panel>
            ) : (
              <div className="space-y-2">
                {(data.anomalies || []).map((a: any, i: number) => (
                  <Panel
                    key={`a-${i}`}
                    className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-3.5"
                  >
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
                    <p className="mt-1 text-xs text-white/50">{a.description}</p>
                    <p className="mt-1 text-[11px] text-white/35">
                      Source: {a.source}
                    </p>
                  </Panel>
                ))}
                {(data.incidents || []).map((inc: any) => (
                  <Panel
                    key={inc._id}
                    className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-3.5"
                  >
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
                      <p className="mt-1 text-xs text-white/50">
                        {inc.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] tabular-nums text-white/35">
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
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Database
            </p>
            <Panel className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={stateTone(
                    (data.database?.state as HealthState) || "no_data",
                  )}
                >
                  {stateLabel(
                    (data.database?.state as HealthState) || "no_data",
                  )}
                </Badge>
                <span className="text-xs text-white/50">
                  {data.database?.note}
                </span>
              </div>
              {data.database?.detail ? (
                <p className="mt-3 text-sm text-white/50">
                  {data.database.detail}
                </p>
              ) : null}
            </Panel>
          </section>

          {/* Slow operations */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Slow operations
            </p>
            <Panel className="overflow-x-auto rounded-2xl border-white/[0.08] bg-white/[0.03] p-0">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-white/[0.06] text-[10px] uppercase tracking-wide text-white/40">
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
                      <td
                        colSpan={6}
                        className="px-3 py-6 text-white/35"
                      >
                        No slow API requests in this range.
                      </td>
                    </tr>
                  ) : (
                    (data.slowOperations?.api || []).map(
                      (r: any, i: number) => (
                        <tr
                          key={i}
                          className="border-b border-white/[0.05]"
                        >
                          <td className="px-3 py-2 font-mono text-[12px]">
                            {r.route}
                          </td>
                          <td className="px-3 py-2">{r.surface}</td>
                          <td className="px-3 py-2 tabular-nums">{r.count}</td>
                          <td className="px-3 py-2 tabular-nums">
                            {r.avgMs} ms
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {r.maxMs} ms
                          </td>
                          <td className="px-3 py-2 tabular-nums">{r.errors}</td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </Panel>
          </section>

          {/* Recent errors */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Recent server errors
            </p>
            <Panel className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-0">
              {(data.recentErrors || []).length === 0 ? (
                <p className="p-6 text-sm text-white/35">
                  No 5xx / error events in range.
                </p>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {(data.recentErrors || []).slice(0, 20).map(
                    (e: any, i: number) => (
                      <li key={i} className="px-3 py-2.5 text-sm">
                        <div className="flex flex-wrap gap-2 text-[12px]">
                          <Badge tone="error">{e.statusCode || "err"}</Badge>
                          <span className="font-mono text-white/55">
                            {e.route}
                          </span>
                          <span className="text-white/35">{e.surface}</span>
                          <span className="tabular-nums text-white/35">
                            {e.createdAt
                              ? new Date(e.createdAt).toLocaleString()
                              : ""}
                          </span>
                        </div>
                        {e.message ? (
                          <p className="mt-1 text-[12px] text-white/50">
                            {e.message}
                          </p>
                        ) : null}
                      </li>
                    ),
                  )}
                </ul>
              )}
            </Panel>
          </section>

          {/* Commerce activity */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Commerce activity
            </p>
            <p className="mb-2 text-xs text-white/40">
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
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Service overview
            </p>
            <Panel className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-4">
              <div className="flex items-start gap-3">
                <Server className="mt-0.5 h-4 w-4 shrink-0 text-[#00E575]" />
                <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-white/50">{`APP   →  API / BACKEND  →  DATABASE
WEB   →  API / BACKEND  →  DATABASE
ADMIN →  API / BACKEND  →  DATABASE

Auth (Clerk) · Storage · Jobs
Payments — not instrumented`}</pre>
              </div>
            </Panel>
          </section>

          {/* Instrumentation */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Instrumentation
            </p>
            <Panel className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-4">
              <div className="grid gap-1.5 sm:grid-cols-2">
                {Object.entries(data.instrumentation || {}).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px]"
                  >
                    <span className="text-white/40">{k}</span>
                    <span className="tabular-nums text-white/60">
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-white/35">
                Payments remain unmonitored by design. Client crash reporting
                and Web Vitals still need separate pipelines.
              </p>
            </Panel>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default function PerformancePage() {
  return (
    <PerformanceGate>
      <PerformanceDirectory />
    </PerformanceGate>
  );
}