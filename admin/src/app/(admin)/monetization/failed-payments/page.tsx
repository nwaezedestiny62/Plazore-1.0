"use client";

import { useAuth } from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Wallet,
  XCircle,
} from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import { Badge, Button, EmptyState, ErrorBlock, Input, Panel, cn } from "@/components/ui";

const GATE_KEY = "plazore.admin.failpayGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_FAILPAY_PASSWORD || "plazorefailpay@12345";

type Problem = {
  code: string;
  label: string;
  severity: "critical" | "high" | "medium" | "low";
  detail: string;
};

type IssueRow = {
  _id: string;
  orderNumber?: string;
  paymentStatus?: string;
  paymentLifecycle?: string;
  totalAmount?: number;
  currency?: string;
  region?: string;
  createdAt?: string;
  updatedAt?: string;
  feeBreakdown?: {
    grossAmount?: number;
    platformFee?: number;
    sellerPayoutAmount?: number;
    currency?: string;
  };
  payout?: { status?: string; blockedReason?: string; amount?: number };
  buyerConfirmation?: { status?: string };
  buyer?: { name?: string; email?: string };
  seller?: { name?: string; storeName?: string; email?: string };
  payment?: { failureReason?: string; lastError?: string; provider?: string };
  refunds?: { status?: string; failureReason?: string; amount?: number }[];
  problem?: Problem;
  tools?: string[];
};

const KINDS = [
  { id: "all", label: "All issues" },
  { id: "failed", label: "Failed charge" },
  { id: "payout_blocked", label: "Payout blocked" },
  { id: "dispute", label: "Disputes" },
  { id: "refund_pending", label: "Refunds" },
] as const;

const ACTION_LABEL: Record<string, string> = {
  refund_buyer: "Refund buyer",
  seller_favour: "Seller favour",
  authorize_payout: "Authorize payout",
  retry_payout: "Retry payout",
  force_seller_eligible: "Force seller eligible",
  notify_buyer_retry: "Notify buyer to retry",
  cancel_order: "Cancel order",
  mark_paid_manual: "Mark paid (manual)",
  mark_refund_processed: "Mark refund processed",
  mark_reviewed: "Mark reviewed",
  add_note: "Add note",
};

function fmtMoney(n?: number, currency = "NGN") {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v.toLocaleString()} ${currency}`;
  }
}

function severityColor(s?: string) {
  if (s === "critical") return "text-red-400 border-red-500/40 bg-red-500/10";
  if (s === "high") return "text-amber-300 border-amber-500/35 bg-amber-500/10";
  if (s === "medium") return "text-sky-300 border-sky-500/30 bg-sky-500/10";
  return "text-white/50 border-white/15 bg-white/5";
}

export default function FailedPaymentsPage() {
  const { getToken, isLoaded } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState("");

  const [kind, setKind] = useState<string>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<IssueRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [pages, setPages] = useState(1);
  const [selected, setSelected] = useState<IssueRow | null>(null);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

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
        limit: "25",
        kind,
        ...(q ? { q } : {}),
      });
      const json = await adminFetch<{ success: boolean; data: any }>(
        `/admin/monetization/failed-payments?${qs}`,
        token
      );
      setItems(json.data?.items || []);
      setSummary(json.data?.summary || null);
      setPages(json.data?.pagination?.pages || 1);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [unlocked, isLoaded, getToken, page, kind, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (action: string) => {
    if (!selected) return;
    setActing(true);
    setActionMsg(null);
    try {
      const token = await getToken();
      await adminFetch(
        `/admin/monetization/failed-payments/${selected._id}/action`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ action, note }),
        }
      );
      setActionMsg(`Done: ${ACTION_LABEL[action] || action}`);
      setNote("");
      await load();
      setSelected(null);
    } catch (e: any) {
      setActionMsg(e?.message || "Action failed");
    } finally {
      setActing(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="flex min-h-[70dvh] items-center justify-center px-4">
        <form
          onSubmit={unlock}
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#11141A]/95 p-6 shadow-2xl"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10">
            <Lock className="h-5 w-5 text-red-400" />
          </div>
          <h1 className="text-lg font-bold">Failed payments desk</h1>
          <p className="mt-1 text-sm text-white/50">
            Restricted operator tools for charge failures, blocked payouts, and refunds.
          </p>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Desk password"
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
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Failed payments
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Diagnose and resolve charge failures, blocked seller payouts, disputes, and refunds.
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

      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "failedCount", label: "Failed charges", icon: XCircle },
            { k: "payoutBlocked", label: "Payout blocked", icon: Wallet },
            { k: "disputed", label: "Disputes", icon: AlertTriangle },
            { k: "refundPending", label: "Refunds", icon: RotateCcw },
          ].map((c) => (
            <Panel key={c.k} className="p-4">
              <div className="flex items-center gap-2 text-white/45">
                <c.icon className="h-4 w-4" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {c.label}
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {Number(summary[c.k]) || 0}
              </p>
            </Panel>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => {
              setKind(k.id);
              setPage(1);
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              kind === k.id
                ? "border-[#00E575]/50 bg-[#00E575]/15 text-[#00E575]"
                : "border-white/10 bg-white/5 text-white/55 hover:border-white/20"
            )}
          >
            {k.label}
          </button>
        ))}
        <div className="ml-auto flex min-w-[200px] flex-1 items-center gap-2 sm:max-w-xs">
          <Search className="h-4 w-4 shrink-0 text-white/35" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search order #"
            className="h-9"
          />
        </div>
      </div>

      {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
      {loading && !items.length ? (
        <div className="flex justify-center py-16">
          <OrbLoader />
        </div>
      ) : null}
      {!loading && !items.length && !error ? (
        <EmptyState
          title="No open payment issues"
          body="Failed charges, blocked payouts, and disputes will appear here."
        />
      ) : null}

      <div className="space-y-2">
        {items.map((row) => (
          <button
            key={row._id}
            type="button"
            onClick={() => {
              setSelected(row);
              setActionMsg(null);
              setNote("");
            }}
            className="flex w-full flex-col gap-2 rounded-2xl border border-white/10 bg-[#11141A]/80 p-4 text-left transition hover:border-white/20 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">
                  {row.orderNumber || row._id.slice(-8)}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                    severityColor(row.problem?.severity)
                  )}
                >
                  {row.problem?.label || "Issue"}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-white/45">
                {row.problem?.detail}
              </p>
              <p className="mt-1 text-[11px] text-white/35">
                Buyer: {row.buyer?.name || row.buyer?.email || "—"} · Seller:{" "}
                {row.seller?.storeName || row.seller?.name || "—"}
              </p>
            </div>
            <div className="text-right text-sm font-semibold tabular-nums">
              {fmtMoney(
                row.feeBreakdown?.grossAmount ?? row.totalAmount,
                row.feeBreakdown?.currency || row.currency || "NGN"
              )}
              <p className="text-[10px] font-normal text-white/40">
                {row.paymentStatus} · {row.paymentLifecycle || "—"}
              </p>
            </div>
          </button>
        ))}
      </div>

      {pages > 1 ? (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            type="button"
            tone="ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <span className="text-xs text-white/45">
            {page} / {pages}
          </span>
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

      {selected ? (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/12 bg-[#0E1218] shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/8 px-5 py-4">
              <div>
                <p className="text-sm font-bold">
                  {selected.orderNumber || selected._id}
                </p>
                <p className="mt-0.5 text-xs text-white/45">
                  {selected.problem?.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full bg-white/6 p-2"
              >
                <XCircle className="h-4 w-4 text-white/50" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <p className="text-white/60">{selected.problem?.detail}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-white/35">Buyer</p>
                  <p className="mt-1 font-semibold">
                    {selected.buyer?.name || "—"}
                  </p>
                  <p className="text-white/40">{selected.buyer?.email}</p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-white/35">Seller</p>
                  <p className="mt-1 font-semibold">
                    {selected.seller?.storeName || selected.seller?.name || "—"}
                  </p>
                  <p className="text-white/40">{selected.seller?.email}</p>
                </div>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-xs">
                <p>
                  Status: <strong>{selected.paymentStatus}</strong> · Lifecycle:{" "}
                  <strong>{selected.paymentLifecycle || "—"}</strong>
                </p>
                <p className="mt-1">
                  Payout: {selected.payout?.status || "—"}
                  {selected.payout?.blockedReason
                    ? ` — ${selected.payout.blockedReason}`
                    : ""}
                </p>
                {selected.payment?.failureReason || selected.payment?.lastError ? (
                  <p className="mt-1 text-red-300/90">
                    Gateway:{" "}
                    {selected.payment.failureReason || selected.payment.lastError}
                  </p>
                ) : null}
              </div>

              <label className="block text-xs text-white/45">
                Operator note (optional)
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#11141A] px-3 py-2 text-sm text-white outline-none focus:border-[#00E575]/40"
                  placeholder="Internal note for audit trail"
                />
              </label>

              {actionMsg ? (
                <p className="text-xs text-[#00E575]">{actionMsg}</p>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                {(selected.tools || []).map((tool) => (
                  <Button
                    key={tool}
                    type="button"
                    disabled={acting}
                    onClick={() => void runAction(tool)}
                    className={cn(
                      "text-xs",
                      tool === "refund_buyer" && "border-red-500/40 text-red-300",
                      tool === "cancel_order" && "border-red-500/40"
                    )}
                    variant={
                      tool === "refund_buyer" || tool === "cancel_order"
                        ? "ghost"
                        : "default"
                    }
                  >
                    {ACTION_LABEL[tool] || tool}
                  </Button>
                ))}
              </div>
              <p className="flex items-center gap-1.5 pt-2 text-[10px] text-white/30">
                <Shield className="h-3 w-3" />
                Actions write audit notes and may notify buyer/seller.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
