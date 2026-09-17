"use client";

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
  AlertTriangle,
  Database,
  History,
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
  Input,
  Panel,
  cn,
} from "@/components/ui";

const GATE_KEY = "plazore.admin.currencyGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_CURRENCY_PASSWORD || "";
const Z_MODAL = 9999;

type EnvKind = "development" | "production" | "unknown";

type RateRow = {
  currencyCode: string;
  name?: string;
  symbol?: string;
  rateToNgn: string | null;
  isActive: boolean;
  version: number;
  lastUpdated?: string | null;
  changedByName?: string | null;
  reason?: string | null;
  percentChange?: number | null;
};

type HistoryRow = {
  _id: string;
  version: number;
  rateToNgn: string;
  previousRateToNgn?: string;
  percentChange?: number;
  reason?: string;
  changedByName?: string;
  effectiveFrom?: string;
  isActive?: boolean;
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

function CurrencyGate({ children }: { children: ReactNode }) {
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
      setErr("Set NEXT_PUBLIC_ADMIN_CURRENCY_PASSWORD in .env");
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
          <h1 className="mt-2 text-2xl font-semibold">Currency rates</h1>
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

function RateEditorModal({
  open,
  onClose,
  selected,
  sel,
  draft,
  setDraft,
  reason,
  setReason,
  sourceNote,
  setSourceNote,
  history,
  busy,
  msg,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  selected: string | null;
  sel?: RateRow;
  draft: string;
  setDraft: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  sourceNote: string;
  setSourceNote: (v: string) => void;
  history: HistoryRow[];
  busy: boolean;
  msg: string;
  onSave: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    if (open) {
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
    }
  }, [open, selected]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !selected) return null;

  return createPortal(
    <div
      className={cn(
        "flex items-end justify-center sm:items-center sm:p-6",
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
          "absolute inset-0 bg-black/70 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex w-full max-w-lg flex-col max-h-[min(92dvh,900px)]",
          "rounded-t-3xl border border-white/10 bg-[#0A0D12] shadow-[0_40px_100px_rgba(0,0,0,0.7)] sm:rounded-3xl",
          "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-10 scale-[0.97] opacity-0",
        )}
      >
        <div className="h-[2px] shrink-0 bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />
        <div className="flex h-12 shrink-0 items-center justify-between px-4 sm:px-5">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[#00E575]">
              RATE
            </p>
            <p className="text-sm font-medium text-white/80">
              {sel?.name || selected}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/50 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 sm:px-5"
        >
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{selected}</h2>
              <p className="mt-1 text-sm text-white/50">
                Current:{" "}
                {selected === "NGN"
                  ? "1 (locked base)"
                  : sel?.rateToNgn
                    ? `1 ${selected} = ₦${sel.rateToNgn}`
                    : "—"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={sel?.isActive ? "green" : "warn"}>
                  {sel?.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge tone="neutral">v{sel?.version ?? 0}</Badge>
              </div>
            </div>

            {selected !== "NGN" ? (
              <>
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    New rate — 1 {selected} = ₦ ?
                  </label>
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    inputMode="decimal"
                    placeholder="e.g. 1326.68"
                    className="rounded-xl border-white/12 bg-[#14181F]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    Reason
                  </label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Verified reference rate materially changed"
                    className="rounded-xl border-white/12 bg-[#14181F]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    Source note (optional)
                  </label>
                  <Input
                    value={sourceNote}
                    onChange={(e) => setSourceNote(e.target.value)}
                    placeholder="Reference source used"
                    className="rounded-xl border-white/12 bg-[#14181F]"
                  />
                </div>
                <p className="text-[12px] leading-relaxed text-white/45">
                  This rate change affects{" "}
                  <strong className="text-[#F5F7FA]">future</strong> conversions
                  only. Historical orders, payments, and payouts will not be
                  recalculated. Seller canonical prices are not rewritten.
                </p>
                <Button
                  className="w-full rounded-xl"
                  disabled={busy}
                  onClick={onSave}
                >
                  {busy ? "Publishing…" : "Publish rate"}
                </Button>
              </>
            ) : (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-sm text-white/50">
                NGN is the locked base currency (1 NGN = ₦1). It cannot be
                edited.
              </div>
            )}

            {msg && (
              <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/55">
                {msg}
              </p>
            )}

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                <History className="h-3 w-3" /> Rate history
              </p>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-xs text-white/35">No history yet.</p>
                ) : (
                  history.map((h) => (
                    <div
                      key={h._id}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="text-[#F5F7FA]">
                          v{h.version} · ₦{h.rateToNgn}
                          {h.isActive ? " · active" : ""}
                        </span>
                        <span className="text-white/35">
                          {fmt(h.effectiveFrom)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-white/40">
                        {h.changedByName || "—"}
                        {h.percentChange != null
                          ? ` · ${h.percentChange.toFixed(2)}%`
                          : ""}
                        {h.reason ? ` · ${h.reason}` : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CurrencyDirectory() {
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

  const [rates, setRates] = useState<RateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [reason, setReason] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setOffline(false);
      const token = await getToken();
      const res = await adminFetch<{
        success: boolean;
        data: { rates: RateRow[]; baseCurrency: string };
      }>("/admin/currency/rates", token);
      setRates(res.data?.rates || []);
    } catch (e: any) {
      setError(e.message || "Failed to load rates");
      if (/network|fetch|offline/i.test(String(e.message))) setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  const openRow = async (code: string) => {
    setSelected(code);
    setModalOpen(true);
    setMsg("");
    const row = rates.find((r) => r.currencyCode === code);
    setDraft(row?.rateToNgn ? String(row.rateToNgn) : "");
    setReason("");
    setSourceNote("");
    try {
      const token = await getToken();
      const res = await adminFetch<{ success: boolean; data: HistoryRow[] }>(
        `/admin/currency/rates/${code}/history`,
        token,
      );
      setHistory(res.data || []);
    } catch {
      setHistory([]);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    window.setTimeout(() => setSelected(null), 280);
  };

  const save = async () => {
    if (!selected || selected === "NGN") return;
    const n = Number(draft);
    if (!(n > 0)) {
      setMsg("Enter a positive rate (1 unit = X NGN)");
      return;
    }
    try {
      setBusy(true);
      setMsg("");
      const token = await getToken();
      const res = await adminFetch<{
        success: boolean;
        warning?: string;
        note?: string;
        percentChange?: number;
      }>(`/admin/currency/rates/${selected}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          rateToNgn: draft,
          reason: reason || "Admin update",
          sourceNote,
        }),
      });
      setMsg(
        [
          res.note || "Rate published for future conversions only.",
          res.warning || "",
          res.percentChange != null
            ? `Change: ${res.percentChange.toFixed(2)}%`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      await load();
      await openRow(selected);
    } catch (e: any) {
      setMsg(e.message || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rates;
    return rates.filter(
      (r) =>
        r.currencyCode.toLowerCase().includes(s) ||
        (r.name || "").toLowerCase().includes(s),
    );
  }, [rates, q]);

  const sel = rates.find((r) => r.currencyCode === selected);

  if (loading && rates.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <OrbLoader label="Loading rates" />
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-6xl pb-24 text-[#F5F7FA]">
      <header className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
              OPERATIONS
            </p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight sm:text-[32px]">
              Currency &amp; rates
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] text-white/50">
              Base currency{" "}
              <span className="text-[#00E575]">NGN</span>. Rates are internal.
              Customers only see final amounts. Changes affect future
              conversions only; history is preserved.
            </p>
          </div>
          <Button
            tone="ghost"
            className="h-10 gap-1.5 rounded-full border border-white/12 bg-[#14181F] text-xs"
            onClick={load}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={envTone as any}>
            <Database className="mr-1 inline h-3 w-3" />
            {envLabel}
          </Badge>
          <Badge tone="green">Base · NGN</Badge>
        </div>
      </header>

      {offline && (
        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Offline or API unreachable. Showing last loaded state if any.
        </div>
      )}
      {error && (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      )}

      <Panel className="mb-5 rounded-2xl border-white/[0.08] bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="green">Base: NGN — Nigerian Naira</Badge>
          <span className="text-xs text-white/40">
            1 unit of each currency = X NGN · Cross-rates derived automatically
          </span>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-white/50">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          Do not chase every market tick. Update only when a verified reference
          has materially diverged and an authorized admin has reviewed it.
        </p>
      </Panel>

      <Panel className="overflow-hidden rounded-2xl border-white/[0.08] bg-white/[0.03]">
        <div className="border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search currency…"
            className="max-w-xs rounded-xl border-white/12 bg-[#14181F]"
          />
        </div>
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No currencies" body="Nothing matched this search." />
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {filtered.map((r) => (
              <button
                key={r.currencyCode}
                type="button"
                onClick={() => openRow(r.currencyCode)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03] sm:px-5",
                  selected === r.currencyCode &&
                    modalOpen &&
                    "bg-[#00E575]/[0.06]",
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium text-[#F5F7FA]">
                    {r.currencyCode}{" "}
                    <span className="text-white/40">{r.name}</span>
                  </p>
                  <p className="truncate text-sm text-white/50">
                    {r.currencyCode === "NGN"
                      ? "1 NGN = ₦1 (base)"
                      : r.rateToNgn
                        ? `1 ${r.currencyCode} = ₦${r.rateToNgn}`
                        : "No active rate"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge tone={r.isActive ? "green" : "warn"}>
                    {r.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <p className="mt-1 text-[10px] text-white/30">
                    v{r.version} · {fmt(r.lastUpdated)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <RateEditorModal
        open={modalOpen}
        onClose={closeModal}
        selected={selected}
        sel={sel}
        draft={draft}
        setDraft={setDraft}
        reason={reason}
        setReason={setReason}
        sourceNote={sourceNote}
        setSourceNote={setSourceNote}
        history={history}
        busy={busy}
        msg={msg}
        onSave={save}
      />
    </div>
  );
}

export default function CurrencyRatesPage() {
  return (
    <CurrencyGate>
      <CurrencyDirectory />
    </CurrencyGate>
  );
}