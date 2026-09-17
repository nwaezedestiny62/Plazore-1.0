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
  ExternalLink,
  Flag,
  Lock,
  Package,
  RefreshCw,
  Store,
  User,
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

const GATE_KEY = "plazore.admin.reportsGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_REPORTS_PASSWORD || "";
const Z_MODAL = 9999;

type EnvKind = "development" | "production" | "unknown";

type ReportRow = {
  _id: string;
  targetType?: "product" | "store" | string;
  status?: string;
  priority?: string;
  reason?: string;
  description?: string;
  resolutionNote?: string;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  reporter?: {
    _id?: string;
    name?: string;
    email?: string;
    image?: string;
  };
  product?: {
    _id?: string;
    name?: string;
    isActive?: boolean;
    images?: string[];
    price?: number;
    region?: string;
  };
  seller?: {
    _id?: string;
    name?: string;
    storeName?: string;
    email?: string;
    isSellerSuspended?: boolean;
    storeLogo?: string;
  };
  assignedAdmin?: { _id?: string; name?: string; email?: string };
};

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "under_review", label: "Under review" },
  { value: "action_required", label: "Action required" },
  { value: "no_action", label: "No action" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
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
  )
    return "development";
  if (lower.includes("plazore") || lower.startsWith("https://"))
    return "production";
  if (process.env.NODE_ENV === "development") return "development";
  if (process.env.NODE_ENV === "production") return "production";
  return "unknown";
}

function fmtDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function statusTone(
  s?: string,
): "green" | "warn" | "error" | "blue" | "neutral" {
  const v = String(s || "").toLowerCase();
  if (v === "resolved" || v === "no_action") return "green";
  if (v === "under_review" || v === "action_required") return "warn";
  if (v === "closed") return "neutral";
  if (v === "new") return "blue";
  return "neutral";
}

function priorityTone(p?: string): "green" | "warn" | "error" | "neutral" {
  const v = String(p || "").toLowerCase();
  if (v === "critical") return "error";
  if (v === "high") return "warn";
  return "neutral";
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
        "h-10 w-full rounded-xl border border-white/12 bg-[#14181F] px-3 text-[13px] text-[#F5F7FA] outline-none focus:border-[#00E575]/40",
        className,
      )}
    >
      {children}
    </select>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
      {children}
    </p>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
        {label}
      </p>
      <div className="mt-1 break-words text-sm text-[#F5F7FA]">
        {children ?? "—"}
      </div>
    </div>
  );
}

function ReportsGate({ children }: { children: ReactNode }) {
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
      setErr("Set NEXT_PUBLIC_ADMIN_REPORTS_PASSWORD in .env");
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
          <h1 className="mt-2 text-2xl font-semibold">Reports</h1>
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

function ReportModal({
  open,
  onClose,
  selected,
  note,
  setNote,
  busyId,
  patchReport,
}: {
  open: boolean;
  onClose: () => void;
  selected: ReportRow | null;
  note: string;
  setNote: (v: string) => void;
  busyId: string;
  patchReport: (
    id: string,
    body: { status?: string; priority?: string; resolutionNote?: string },
  ) => Promise<void>;
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
  }, [open, selected?._id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const productId =
    selected?.product?._id ||
    (selected?.targetType === "product"
      ? (selected as any).productId
      : null);
  const sellerId =
    selected?.seller?._id ||
    (selected?.targetType === "store"
      ? (selected as any).sellerId
      : null);

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
              REPORT
            </p>
            <p className="text-sm font-medium text-white/80">Review case</p>
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
          {!selected ? (
            <OrbLoader label="Loading case" />
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    tone={
                      selected.targetType === "product" ? "blue" : "green"
                    }
                  >
                    {selected.targetType}
                  </Badge>
                  <Badge tone={priorityTone(selected.priority)}>
                    {selected.priority || "normal"}
                  </Badge>
                  <Badge tone={statusTone(selected.status)}>
                    {selected.status || "new"}
                  </Badge>
                </div>
                <h2 className="mt-3 text-lg font-semibold leading-snug">
                  {selected.targetType === "product"
                    ? selected.product?.name || "Product report"
                    : selected.seller?.storeName ||
                      selected.seller?.name ||
                      "Store report"}
                </h2>
                {selected.reason ? (
                  <p className="mt-1 text-sm text-white/50">
                    Reason: {selected.reason}
                  </p>
                ) : null}
              </div>

              {selected.description ? (
                <div className="space-y-2 border-t border-white/[0.06] pt-4">
                  <SectionLabel>Description</SectionLabel>
                  <p className="text-sm leading-relaxed text-white/55">
                    {selected.description}
                  </p>
                </div>
              ) : null}

              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                <SectionLabel>Reporter</SectionLabel>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                    <User className="h-4 w-4 text-white/50" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {selected.reporter?.name || "—"}
                    </p>
                    <p className="truncate text-xs text-white/40">
                      {selected.reporter?.email || "—"}
                    </p>
                  </div>
                </div>
                {selected.reporter?._id ? (
                  <Link
                    href={`/users?userId=${encodeURIComponent(selected.reporter._id)}`}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-3 text-xs text-white/55 transition hover:text-[#00E575]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open reporter on Users
                  </Link>
                ) : null}
              </div>

              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                <SectionLabel>Target</SectionLabel>
                {selected.targetType === "product" ? (
                  <>
                    <Field label="Product">
                      {selected.product?.name || "—"}
                      {selected.product?.isActive === false
                        ? " (inactive)"
                        : ""}
                    </Field>
                    <Field label="Region">
                      {selected.product?.region || "—"}
                    </Field>
                    {productId ? (
                      <Link
                        href={`/products?productId=${encodeURIComponent(String(productId))}`}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#3B82F6]/35 bg-[#3B82F6]/10 px-4 text-sm font-semibold text-[#93C5FD] transition hover:border-[#3B82F6]/55"
                      >
                        <Package className="h-4 w-4" />
                        Open product on Products
                      </Link>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Field label="Store">
                      {selected.seller?.storeName ||
                        selected.seller?.name ||
                        "—"}
                      {selected.seller?.isSellerSuspended
                        ? " (suspended)"
                        : ""}
                    </Field>
                    <Field label="Email">
                      {selected.seller?.email || "—"}
                    </Field>
                    {sellerId ? (
                      <Link
                        href={`/users?userId=${encodeURIComponent(String(sellerId))}&role=seller`}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#00E575]/35 bg-[#00E575]/10 px-4 text-sm font-semibold text-[#00E575] transition hover:border-[#00E575]/55"
                      >
                        <Store className="h-4 w-4" />
                        Open seller on Users
                      </Link>
                    ) : null}
                  </>
                )}
              </div>

              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                <SectionLabel>Timeline</SectionLabel>
                <Field label="Filed">{fmtDate(selected.createdAt)}</Field>
                <Field label="Updated">{fmtDate(selected.updatedAt)}</Field>
                {selected.resolvedAt ? (
                  <Field label="Resolved">
                    {fmtDate(selected.resolvedAt)}
                  </Field>
                ) : null}
                {selected.closedAt ? (
                  <Field label="Closed">{fmtDate(selected.closedAt)}</Field>
                ) : null}
              </div>

              <div className="space-y-2 border-t border-white/[0.06] pt-4">
                <SectionLabel>Resolution note</SectionLabel>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Internal note for this case…"
                  className="w-full resize-none rounded-xl border border-white/12 bg-[#14181F] px-3 py-2 text-sm text-[#F5F7FA] outline-none placeholder:text-white/30 focus:border-[#00E575]/40"
                />
                <Button
                  tone="ghost"
                  className="h-9 rounded-xl text-xs"
                  disabled={busyId === selected._id}
                  onClick={() =>
                    void patchReport(selected._id, {
                      resolutionNote: note.trim(),
                    })
                  }
                >
                  Save note
                </Button>
              </div>

              <div className="space-y-2 border-t border-white/[0.06] pt-4">
                <SectionLabel>Actions</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    tone="ghost"
                    className="h-10 rounded-xl text-xs"
                    disabled={busyId === selected._id}
                    onClick={() =>
                      void patchReport(selected._id, {
                        status: "under_review",
                      })
                    }
                  >
                    Under review
                  </Button>
                  <Button
                    tone="ghost"
                    className="h-10 rounded-xl text-xs"
                    disabled={busyId === selected._id}
                    onClick={() =>
                      void patchReport(selected._id, {
                        status: "action_required",
                      })
                    }
                  >
                    Action required
                  </Button>
                  <Button
                    tone="ghost"
                    className="h-10 rounded-xl text-xs"
                    disabled={busyId === selected._id}
                    onClick={() =>
                      void patchReport(selected._id, { status: "resolved" })
                    }
                  >
                    Resolve
                  </Button>
                  <Button
                    tone="ghost"
                    className="h-10 rounded-xl text-xs"
                    disabled={busyId === selected._id}
                    onClick={() =>
                      void patchReport(selected._id, { status: "closed" })
                    }
                  >
                    Close
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    tone="ghost"
                    className="h-9 rounded-xl text-xs"
                    disabled={busyId === selected._id}
                    onClick={() =>
                      void patchReport(selected._id, { priority: "high" })
                    }
                  >
                    Mark high
                  </Button>
                  <Button
                    tone="ghost"
                    className="h-9 rounded-xl text-xs"
                    disabled={busyId === selected._id}
                    onClick={() =>
                      void patchReport(selected._id, {
                        priority: "critical",
                      })
                    }
                  >
                    Mark critical
                  </Button>
                </div>
              </div>

              <p className="font-mono text-[11px] text-white/30">
                ID {selected._id}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ReportsDirectory() {
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

  const [items, setItems] = useState<ReportRow[]>([]);
  const [status, setStatus] = useState("");
  const [targetType, setTargetType] = useState("");
  const [priority, setPriority] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [note, setNote] = useState("");

  const selected = useMemo(
    () => items.find((r) => r._id === openId) || null,
    [items, openId],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const token = await getToken();
      if (!token) {
        setError("Session expired. Sign in again.");
        setLoading(false);
        return;
      }
      const params = new URLSearchParams({ limit: "50" });
      if (status) params.set("status", status);
      if (targetType) params.set("targetType", targetType);
      if (priority) params.set("priority", priority);

      const json = await adminFetch<{ data?: ReportRow[] }>(
        `/admin/reports?${params}`,
        token,
      );
      setItems(json.data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [getToken, status, targetType, priority]);

  useEffect(() => {
    void load();
  }, [load]);

  const openModal = (id: string) => {
    setOpenId(id);
    setModalOpen(true);
    const row = items.find((r) => r._id === id);
    setNote(row?.resolutionNote || "");
  };

  const closeModal = () => {
    setModalOpen(false);
    window.setTimeout(() => {
      setOpenId(null);
      setNote("");
    }, 280);
  };

  const patchReport = async (
    id: string,
    body: { status?: string; priority?: string; resolutionNote?: string },
  ) => {
    try {
      setBusyId(id);
      setError("");
      const token = await getToken();
      if (!token) {
        setError("Session expired. Sign in again.");
        return;
      }
      await adminFetch(`/admin/reports/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await load();
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setBusyId("");
    }
  };

  const filtersActive = !!(status || targetType || priority);

  return (
    <div className="relative mx-auto max-w-6xl pb-24 text-[#F5F7FA]">
      <header className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
              MODERATION
            </p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight sm:text-[32px]">
              Reports
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] text-white/50">
              Product and storefront flags — separate from Contact. Open a row
              to review, act, and jump to the listing or seller account.
            </p>
          </div>
          <Button
            tone="ghost"
            className="h-10 shrink-0 gap-2 rounded-full border border-white/12 bg-[#14181F] text-xs"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={envTone as any}>
            <Database className="mr-1 inline h-3 w-3" />
            {envLabel}
          </Badge>
          <Badge tone="blue">
            <Flag className="mr-1 inline h-3 w-3" />
            Flags
          </Badge>
          <span className="text-xs text-white/35">
            {items.length} report{items.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <Panel className="mb-4 flex flex-col gap-3 rounded-2xl border-white/[0.08] bg-white/[0.03] p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <DarkSelect
          value={status}
          onChange={setStatus}
          className="w-full sm:w-44"
        >
          {STATUSES.map((s) => (
            <option key={s.value || "all"} value={s.value}>
              {s.label}
            </option>
          ))}
        </DarkSelect>
        <DarkSelect
          value={targetType}
          onChange={setTargetType}
          className="w-full sm:w-40"
        >
          <option value="">All targets</option>
          <option value="product">Product</option>
          <option value="store">Store</option>
        </DarkSelect>
        <DarkSelect
          value={priority}
          onChange={setPriority}
          className="w-full sm:w-36"
        >
          <option value="">All priority</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </DarkSelect>
        {filtersActive && (
          <Button
            tone="ghost"
            className="h-9 rounded-xl text-xs"
            onClick={() => {
              setStatus("");
              setTargetType("");
              setPriority("");
            }}
          >
            Clear filters
          </Button>
        )}
      </Panel>

      {error && (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
          <OrbLoader label="Loading reports" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No reports yet"
          body="Reports appear when users flag products or stores."
        />
      ) : (
        <div className="space-y-2">
          {items.map((r) => {
            const active = openId === r._id && modalOpen;
            const isProduct = r.targetType === "product";
            return (
              <button
                key={r._id}
                type="button"
                onClick={() => openModal(r._id)}
                className={cn(
                  "w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition hover:border-[#00E575]/35",
                  active && "border-[#00E575]/45 bg-[#00E575]/[0.06]",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={isProduct ? "blue" : "green"}>
                        {r.targetType || "—"}
                      </Badge>
                      <Badge tone={priorityTone(r.priority)}>
                        {r.priority || "normal"}
                      </Badge>
                      <Badge tone={statusTone(r.status)}>
                        {r.status || "new"}
                      </Badge>
                      {r.reason ? (
                        <Badge tone="neutral">{r.reason}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 truncate text-sm font-medium">
                      {isProduct
                        ? r.product?.name || "Product report"
                        : r.seller?.storeName ||
                          r.seller?.name ||
                          "Store report"}
                    </p>
                    <p className="mt-1 truncate text-xs text-white/40">
                      Reporter: {r.reporter?.name || "—"}
                      {r.reporter?.email ? ` · ${r.reporter.email}` : ""}
                    </p>
                    {r.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-white/50">
                        {r.description}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-white/30">
                      {fmtDate(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                    {isProduct ? (
                      <Package className="h-4 w-4 text-[#3B82F6]" />
                    ) : (
                      <Store className="h-4 w-4 text-[#00E575]" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <ReportModal
        open={modalOpen}
        onClose={closeModal}
        selected={selected}
        note={note}
        setNote={setNote}
        busyId={busyId}
        patchReport={patchReport}
      />
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ReportsGate>
      <ReportsDirectory />
    </ReportsGate>
  );
}