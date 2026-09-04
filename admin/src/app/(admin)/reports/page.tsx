"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Flag,
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
  Select,
  cn,
} from "@/components/ui";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

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

function fmtDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function statusTone(s?: string): "green" | "warn" | "error" | "blue" | "neutral" {
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

export default function ReportsPage() {
  const { getToken } = useAuth();

  const [items, setItems] = useState<ReportRow[]>([]);
  const [status, setStatus] = useState("");
  const [targetType, setTargetType] = useState("");
  const [priority, setPriority] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [paneOpen, setPaneOpen] = useState(false);
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

  const openPane = (id: string) => {
    setOpenId(id);
    setPaneOpen(true);
    const row = items.find((r) => r._id === id);
    setNote(row?.resolutionNote || "");
  };

  const closePane = () => {
    setPaneOpen(false);
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

  const productId =
    selected?.product?._id ||
    (selected?.targetType === "product"
      ? (selected as any).productId
      : null);
  const sellerId =
    selected?.seller?._id ||
    (selected?.targetType === "store" ? (selected as any).sellerId : null);

  return (
    <div
      className={cn(
        poppins.className,
        "relative min-h-[70vh] pb-28 text-[#F5F7FA]",
      )}
    >
      <header className="mb-6 border-b border-[#252A33] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
            Moderation
          </p>
          <span className="inline-flex items-center gap-1.5 border border-[#00E575]/25 bg-[#00E575]/10 px-2 py-0.5 text-[10px] font-medium text-[#00E575]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00E575]" />
            Live
          </span>
        </div>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
            <p className="mt-1 max-w-xl text-sm text-[#A7ADB8]">
              Product and storefront flags — separate from Contact. Open a row
              to review, act, and jump to the listing or seller account.
            </p>
          </div>
          <Button
            tone="ghost"
            className="h-9 shrink-0 gap-2 text-xs"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </header>

      <Panel className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full sm:w-44"
        >
          {STATUSES.map((s) => (
            <option key={s.value || "all"} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select
          value={targetType}
          onChange={(e) => setTargetType(e.target.value)}
          className="w-full sm:w-40"
        >
          <option value="">All targets</option>
          <option value="product">Product</option>
          <option value="store">Store</option>
        </Select>
        <Select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full sm:w-36"
        >
          <option value="">All priority</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </Select>
        {filtersActive && (
          <Button
            tone="ghost"
            className="h-9 text-xs"
            onClick={() => {
              setStatus("");
              setTargetType("");
              setPriority("");
            }}
          >
            Clear filters
          </Button>
        )}
        <span className="ml-auto text-xs text-[#737A86]">
          {items.length} report{items.length === 1 ? "" : "s"}
        </span>
      </Panel>

      {error && (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="border border-[#252A33] bg-[#11141A]">
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
            const active = openId === r._id && paneOpen;
            const isProduct = r.targetType === "product";
            return (
              <button
                key={r._id}
                type="button"
                onClick={() => openPane(r._id)}
                className={cn(
                  "w-full border border-[#252A33] bg-[#11141A] p-4 text-left transition hover:border-[#00E575]/35",
                  active && "border-[#00E575]/45 bg-[#00E575]/[0.05]",
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
                    <p className="mt-1 truncate text-xs text-[#737A86]">
                      Reporter: {r.reporter?.name || "—"}
                      {r.reporter?.email ? ` · ${r.reporter.email}` : ""}
                    </p>
                    {r.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-[#A7ADB8]">
                        {r.description}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-[#737A86]">
                      {fmtDate(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#252A33] bg-[#171B22]">
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

      {/* Scrim */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
          paneOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={closePane}
        aria-hidden
      />

      {/* Right pane */}
      <aside
        className={cn(
          poppins.className,
          "fixed top-0 right-0 z-50 flex h-full w-full max-w-[440px] flex-col border-l border-[#252A33] bg-[#0C0F14] shadow-2xl transition-transform duration-300 ease-out",
          paneOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#252A33] px-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00E575]">
              Report
            </p>
            <p className="text-sm font-medium">Review case</p>
          </div>
          <button
            type="button"
            onClick={closePane}
            className="flex h-9 w-9 items-center justify-center border border-[#252A33] bg-[#171B22] text-[#A7ADB8] transition hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
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
                  <p className="mt-1 text-sm text-[#A7ADB8]">
                    Reason: {selected.reason}
                  </p>
                ) : null}
              </div>

              {selected.description ? (
                <div className="space-y-2 border-t border-[#252A33] pt-4">
                  <SectionLabel>Description</SectionLabel>
                  <p className="text-sm leading-relaxed text-[#A7ADB8]">
                    {selected.description}
                  </p>
                </div>
              ) : null}

              <div className="space-y-3 border-t border-[#252A33] pt-4">
                <SectionLabel>Reporter</SectionLabel>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#252A33] bg-[#171B22]">
                    <User className="h-4 w-4 text-[#A7ADB8]" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {selected.reporter?.name || "—"}
                    </p>
                    <p className="truncate text-xs text-[#737A86]">
                      {selected.reporter?.email || "—"}
                    </p>
                  </div>
                </div>
                {selected.reporter?._id ? (
                  <Link
                    href={`/users?userId=${encodeURIComponent(selected.reporter._id)}`}
                    className="inline-flex h-9 items-center gap-2 border border-[#252A33] bg-[#171B22] px-3 text-xs text-[#A7ADB8] transition hover:text-[#00E575]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open reporter on Users
                  </Link>
                ) : null}
              </div>

              <div className="space-y-3 border-t border-[#252A33] pt-4">
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
                        className="inline-flex h-10 w-full items-center justify-center gap-2 border border-[#3B82F6]/35 bg-[#3B82F6]/10 px-4 text-sm font-semibold text-[#93C5FD] transition hover:border-[#3B82F6]/55"
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
                        className="inline-flex h-10 w-full items-center justify-center gap-2 border border-[#00E575]/35 bg-[#00E575]/10 px-4 text-sm font-semibold text-[#00E575] transition hover:border-[#00E575]/55"
                      >
                        <Store className="h-4 w-4" />
                        Open seller on Users
                      </Link>
                    ) : null}
                  </>
                )}
              </div>

              <div className="space-y-3 border-t border-[#252A33] pt-4">
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

              <div className="space-y-2 border-t border-[#252A33] pt-4">
                <SectionLabel>Resolution note</SectionLabel>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Internal note for this case…"
                  className="w-full resize-none border border-[#252A33] bg-[#11141A] px-3 py-2 text-sm text-[#F5F7FA] outline-none placeholder:text-[#737A86] focus:border-[#00E575]/40"
                />
                <Button
                  tone="ghost"
                  className="h-9 text-xs"
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

              <div className="space-y-2 border-t border-[#252A33] pt-4">
                <SectionLabel>Actions</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    tone="ghost"
                    className="h-10 text-xs"
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
                    className="h-10 text-xs"
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
                    className="h-10 text-xs"
                    disabled={busyId === selected._id}
                    onClick={() =>
                      void patchReport(selected._id, { status: "resolved" })
                    }
                  >
                    Resolve
                  </Button>
                  <Button
                    tone="ghost"
                    className="h-10 text-xs"
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
                    className="h-9 text-xs"
                    disabled={busyId === selected._id}
                    onClick={() =>
                      void patchReport(selected._id, { priority: "high" })
                    }
                  >
                    Mark high
                  </Button>
                  <Button
                    tone="ghost"
                    className="h-9 text-xs"
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

              <p className="font-mono text-[11px] text-[#737A86]">
                ID {selected._id}
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}