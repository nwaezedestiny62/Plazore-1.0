"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Database,
  LayoutGrid,
  Lock,
  RefreshCw,
  X,
} from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Panel,
  cn,
} from "@/components/ui";
import { REGION_LIST } from "@/lib/region";

const GATE_KEY = "plazore.admin.showroomGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_SHOWROOM_PASSWORD || "";
const Z_MODAL = 9999;

type EnvKind = "development" | "production" | "unknown";

type ProductCard = {
  _id: string;
  name: string;
  images?: string[];
  price: number;
  category?: string;
  region?: string;
  stock?: number;
  seller?: { _id?: string; storeName?: string; name?: string };
};

type Section = {
  capacity: number;
  populated: number;
  fillPct: number;
  reusedFromEarlier: number;
  unique: number;
  categories: { key: string; count: number }[];
  sellers: { key: string; count: number }[];
  regions: { key: string; count: number }[];
  products: ProductCard[];
};

const ROOM_META: Record<string, { title: string; body: string; accent: string }> = {
  "1": {
    title: "Section 1 · Discovery",
    body: "50 slots · two rows of 25 · primary unique set",
    accent: "#00E575",
  },
  "2": {
    title: "Section 2 · Preference pairs",
    body: "14 slots · side-by-side pairs · primary unique set",
    accent: "#3B82F6",
  },
  "3": {
    title: "Section 3 · Exploration",
    body: "16 slots · may reuse 1–2 when inventory is thin",
    accent: "#14B8A6",
  },
  "4": {
    title: "Section 4 · Broader surface",
    body: "33 slots · may reuse earlier rooms when inventory is thin",
    accent: "#A78BFA",
  },
};

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

function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
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

function FillBar({ pct, accent }: { pct: number; accent: string }) {
  const n = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <span>Fill</span>
        <span className="tabular-nums text-white/55">{n.toFixed(0)}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${n}%`, background: accent }}
        />
      </div>
    </div>
  );
}

function ShowroomGate({ children }: { children: ReactNode }) {
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
      setErr("Set NEXT_PUBLIC_ADMIN_SHOWROOM_PASSWORD in .env");
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
          <h1 className="mt-2 text-2xl font-semibold">Showroom</h1>
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

function ProductModal({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product: ProductCard | null;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !product) return null;

  return createPortal(
    <div
      className={cn(
        "flex items-end justify-center sm:items-center sm:p-5",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      style={{ position: "fixed", inset: 0, zIndex: Z_MODAL }}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/65 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex w-full max-w-[380px] flex-col overflow-hidden",
          "rounded-t-2xl border border-white/10 bg-[#0C0F14] shadow-[0_32px_80px_rgba(0,0,0,0.65)] sm:rounded-2xl",
          "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-8 scale-[0.98] opacity-0",
        )}
      >
        <div className="h-[2px] shrink-0 bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-[#00E575]">
            SHOWROOM LISTING
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/50 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="aspect-[4/3] overflow-hidden bg-white/[0.04]">
          {product.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.images[0]}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="space-y-3 px-4 py-4">
          <h2 className="text-[16px] font-semibold leading-snug">
            {product.name}
          </h2>
          <p className="text-[13px] text-white/50">
            {[product.category, product.region, `stock ${product.stock ?? "—"}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-xl font-semibold tabular-nums">
            {Number(product.price || 0).toLocaleString()}
          </p>
          <p className="text-[12px] text-white/40">
            {product.seller?.storeName || product.seller?.name || "—"}
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Link
              href={`/products?productId=${encodeURIComponent(product._id)}`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[#3B82F6]/35 bg-[#3B82F6]/10 text-[12px] font-semibold text-[#93C5FD]"
            >
              Products
            </Link>
            {product.seller?._id ? (
              <Link
                href={`/users?userId=${encodeURIComponent(product.seller._id)}&role=seller`}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#00E575]/35 bg-[#00E575]/10 text-[12px] font-semibold text-[#00E575]"
              >
                Seller
              </Link>
            ) : (
              <div />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ShowroomDirectory() {
  const { getToken } = useAuth();
  const clientEnv = useMemo(() => detectEnvFromApi(), []);
  const env: EnvKind = clientEnv;
  const envTone =
    env === "production" ? "error" : env === "development" ? "warn" : "neutral";
  const envLabel =
    env === "production"
      ? "Production data"
      : env === "development"
        ? "Development data"
        : "Environment unknown";

  const [region, setRegion] = useState("NG");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState<ProductCard | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const token = await getToken();
      const json = await adminFetch<any>(
        `/admin/showroom?region=${encodeURIComponent(region)}`,
        token,
      );
      setData(json.data);
    } catch (e: any) {
      setError(e.message || "Failed to load showroom");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, region]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    try {
      setRefreshing(true);
      setError("");
      const token = await getToken();
      await adminFetch(`/admin/showroom/refresh`, token, {
        method: "POST",
        body: JSON.stringify({ region }),
      });
      await load();
    } catch (e: any) {
      setError(e.message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const openModal = (p: ProductCard) => {
    setOpen(p);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    window.setTimeout(() => setOpen(null), 280);
  };

  const ov = data?.overview;
  const health = data?.health;
  const algo = data?.algorithm;
  const sections: Record<string, Section> = data?.sections || {};
  const totals = data?.totals;

  const fillOverall =
    totals?.capacity > 0
      ? Math.round((Number(totals.populated) / Number(totals.capacity)) * 100)
      : 0;

  return (
    <div className="relative mx-auto max-w-6xl pb-24 text-[#F5F7FA]">
      <header className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
              SHOWROOM
            </p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight sm:text-[32px]">
              Adaptive showroom
            </h1>
            <p className="mt-2 max-w-2xl text-[13.5px] text-white/50">
              What the ranker is showing, how rooms fill, and whether inventory
              can support the surface for this marketplace region.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DarkSelect
              value={region}
              onChange={setRegion}
              className="min-w-[140px]"
            >
              {REGION_LIST.map((r: any) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
            </DarkSelect>
            <Button
              tone="ghost"
              className="h-10 gap-1.5 rounded-full border border-white/12 bg-[#14181F] text-xs"
              disabled={loading || refreshing}
              onClick={() => load()}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", loading && "animate-spin")}
              />
              Reload
            </Button>
            <Button
              className="h-10 rounded-xl text-xs"
              disabled={loading || refreshing}
              onClick={refresh}
            >
              {refreshing ? "Refreshing…" : "Force refresh ranker"}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={envTone as any}>
            <Database className="mr-1 inline h-3 w-3" />
            {envLabel}
          </Badge>
          <Badge tone="blue">
            <LayoutGrid className="mr-1 inline h-3 w-3" />
            Showroom
          </Badge>
          {region ? (
            <Badge tone="neutral">Region {region}</Badge>
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
          <OrbLoader label="Loading showroom" />
        </div>
      ) : !data ? (
        <EmptyState title="No showroom data" body="Connect and retry." />
      ) : (
        <div className="space-y-6">
          {/* Status strip */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                health?.status === "healthy"
                  ? "green"
                  : health?.status === "issue"
                    ? "error"
                    : "warn"
              }
            >
              {health?.label || health?.status || "—"}
            </Badge>
            <Badge tone={algo?.status === "live" ? "green" : "warn"}>
              Ranker {algo?.status || "—"}
            </Badge>
            <span className="text-xs text-white/40">
              Last refresh {fmt(ov?.lastRefresh)} · populated{" "}
              {totals?.populated ?? 0}/{totals?.capacity ?? 0} ({fillOverall}%)
            </span>
          </div>

          {/* Overall fill visualization */}
          <Panel className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  Surface capacity
                </p>
                <p className="mt-1 text-sm text-white/60">
                  {totals?.populated ?? 0} of {totals?.capacity ?? 0} slots
                  filled across all rooms
                </p>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-[#00E575]">
                {fillOverall}%
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6] transition-all duration-700"
                style={{ width: `${fillOverall}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["1", "2", "3", "4"] as const).map((k) => {
                const sec = sections[k];
                const meta = ROOM_META[k];
                if (!sec || !meta) return null;
                return (
                  <div
                    key={k}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                  >
                    <p className="text-[10px] font-semibold text-white/40">
                      Room {k}
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">
                      {sec.populated}/{sec.capacity}
                    </p>
                    <FillBar pct={sec.fillPct} accent={meta.accent} />
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* KPI grid */}
          {ov ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              <Stat label="Active products" value={ov.totalActive ?? 0} />
              <Stat label="Eligible (in stock)" value={ov.eligible ?? 0} />
              <Stat
                label={`Eligible in ${region}`}
                value={ov.localEligible ?? 0}
              />
              <Stat label="Out of stock" value={ov.outOfStock ?? 0} />
              <Stat
                label="Sellers contributing"
                value={ov.sellersContributing ?? 0}
              />
              <Stat label="Categories" value={ov.categoriesRepresented ?? 0} />
              <Stat label="Added 7d" value={ov.recentlyAdded7d ?? 0} />
              <Stat label="Updated 7d" value={ov.recentlyUpdated7d ?? 0} />
              <Stat label="Sessions this region" value={ov.sessionCount ?? 0} />
              <Stat label="Inactive listings" value={ov.inactive ?? 0} />
            </div>
          ) : null}

          {/* Algorithm panel */}
          {algo ? (
            <Panel className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                Algorithm
              </p>
              <div className="mt-4 grid gap-5 lg:grid-cols-2">
                <div className="space-y-2 text-[13px] text-white/55">
                  <p>
                    <span className="font-medium text-[#F5F7FA]">
                      {algo.name}
                    </span>{" "}
                    · {algo.version} ·{" "}
                    {String(algo.type || "").replaceAll("_", " ")}
                  </p>
                  <p>Refresh interval: {algo.refreshIntervalLabel}</p>
                  <p>Last refresh: {fmt(algo.lastRefresh)}</p>
                  <p>Next session expiry: {fmt(algo.nextScheduledRefresh)}</p>
                  <p className="font-mono text-[11px] text-white/35">
                    {algo.sessionId || "no session"}
                  </p>
                  {algo.regionalFallback ? (
                    <p className="text-white/45">{algo.regionalFallback}</p>
                  ) : null}
                  {algo.reusePolicy ? (
                    <p className="text-white/45">{algo.reusePolicy}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    Ranking signals
                  </p>
                  <ul className="mt-2 space-y-2 text-[13px] text-white/55">
                    {(algo.rankingSignals || []).map((s: any) => (
                      <li key={s.name} className="flex gap-2">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00E575]"
                        />
                        <span>
                          <span className="text-[#F5F7FA]">{s.name}</span>
                          <span className="text-white/35"> · {s.weight}</span>
                          {s.notes ? (
                            <span className="text-white/45"> — {s.notes}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {Array.isArray(algo.eligibility) && algo.eligibility.length ? (
                    <p className="mt-3 text-[11px] text-white/35">
                      Eligibility: {algo.eligibility.join(" · ")}
                    </p>
                  ) : null}
                </div>
              </div>
            </Panel>
          ) : null}

          {/* Health issues */}
          {health?.issues?.length ? (
            <Panel className="rounded-2xl border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/80">
                Health signals
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {health.issues.map((i: any) => (
                  <Badge key={i.code} tone="warn">
                    {i.label}
                  </Badge>
                ))}
              </div>
            </Panel>
          ) : null}

          {/* Rooms */}
          {(["1", "2", "3", "4"] as const).map((k) => {
            const sec = sections[k];
            if (!sec) return null;
            const meta = ROOM_META[k];
            return (
              <Panel
                key={k}
                className="overflow-hidden rounded-2xl border-white/[0.08] bg-white/[0.03]"
              >
                <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: meta.accent }}
                      />
                      <p className="text-sm font-semibold">{meta.title}</p>
                    </div>
                    <p className="mt-0.5 text-[12px] text-white/40">
                      {meta.body}
                    </p>
                    <div className="mt-2 max-w-xs">
                      <FillBar pct={sec.fillPct} accent={meta.accent} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={sec.populated ? "green" : "warn"}>
                      {sec.populated}/{sec.capacity} filled
                    </Badge>
                    {sec.reusedFromEarlier > 0 ? (
                      <Badge tone="blue">
                        {sec.reusedFromEarlier} reused
                      </Badge>
                    ) : (
                      <Badge tone="neutral">No reuse</Badge>
                    )}
                    <Badge tone="neutral">{sec.unique} unique</Badge>
                  </div>
                </div>

                <div className="grid gap-3 border-b border-white/[0.05] px-4 py-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                      Categories
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/55">
                      {sec.categories
                        .slice(0, 6)
                        .map((c) => `${c.key} ${c.count}`)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                      Sellers
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/55">
                      {sec.sellers
                        .slice(0, 4)
                        .map((c) => `${c.key} ${c.count}`)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                      Regions
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/55">
                      {sec.regions
                        .map((c) => `${c.key} ${c.count}`)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                </div>

                {sec.products.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-white/35">
                    No products in this room for {region}. Ranker does not pad
                    empty slots.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                    {sec.products.map((p) => (
                      <button
                        key={`${k}-${p._id}`}
                        type="button"
                        onClick={() => openModal(p)}
                        className="group rounded-xl border border-white/[0.07] bg-white/[0.02] p-1.5 text-left transition hover:border-[#00E575]/40 hover:bg-white/[0.04]"
                      >
                        <div className="aspect-square overflow-hidden rounded-lg bg-white/[0.04]">
                          {p.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.images[0]}
                              alt=""
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                            />
                          ) : null}
                        </div>
                        <p className="mt-1.5 truncate text-[11px] font-medium">
                          {p.name}
                        </p>
                        <p className="truncate text-[10px] text-white/35">
                          {p.seller?.storeName || p.seller?.name || p.region}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      <ProductModal open={modalOpen} onClose={closeModal} product={open} />
    </div>
  );
}

export default function ShowroomPage() {
  return (
    <ShowroomGate>
      <ShowroomDirectory />
    </ShowroomGate>
  );
}