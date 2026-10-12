"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Banknote,
  CheckCircle2,
  CreditCard,
  LayoutGrid,
  List,
  Lock,
  Package,
  RefreshCw,
  Scale,
  Search,
  Shield,
  Store,
  User,
  WifiOff,
  X,
  XCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Wallet,
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

const GATE_KEY = "plazore.admin.paymentsGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PAYMENTS_PASSWORD ||
  "plazoremoney@098765432123456";
const PAGE_SIZE = 25;
const Z_FLOAT = 90;
const Z_MODAL = 9999;

const API = process.env.NEXT_PUBLIC_API_URL || "";

/** Matches server REGION_TO_CURRENCY — no live FX */
const REGION_TO_CURRENCY: Record<string, string> = {
  NG: "NGN",
  GH: "GHS",
  BJ: "XOF",
  TG: "XOF",
  CI: "XOF",
  SN: "XOF",
  CM: "XAF",
  KE: "KES",
  ZA: "ZAR",
  EG: "EGP",
  UG: "UGX",
  TZ: "TZS",
  RW: "RWF",
  US: "USD",
  CA: "CAD",
  GB: "GBP",
  UK: "GBP",
  DE: "EUR",
  FR: "EUR",
  NL: "EUR",
  IT: "EUR",
  ES: "EUR",
  EU: "EUR",
  AU: "AUD",
};
const KNOWN_CURRENCIES = new Set(Object.values(REGION_TO_CURRENCY));
const ZERO_DECIMAL = new Set(["NGN", "XOF", "XAF", "KES", "JPY"]);

type ProviderHealth = {
  configured: boolean;
  publicKey?: string | null;
};

type MoneyBucket = { currency: string; amount: number };

type FeeBreakdown = {
  subtotal?: number;
  shippingCost?: number;
  grossAmount?: number;
  platformFeeRate?: number;
  platformFee?: number;
  sellerPayoutAmount?: number;
  currency?: string;
  region?: string;
};

type OrderRow = {
  _id: string;
  orderNumber?: string;
  orderStatus?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  paymentLifecycle?: string;
  totalAmount?: number;
  subtotal?: number;
  shippingCost?: number;
  region?: string;
  currency?: string;
  createdAt?: string;
  deliveredAt?: string;
  feeBreakdown?: FeeBreakdown;
  buyerConfirmation?: {
    status?: string;
    confirmedAt?: string;
    issueReportedAt?: string;
  };
  payout?: {
    status?: string;
    eligibleAt?: string;
    blockedReason?: string;
    amount?: number;
    platformFee?: number;
    reference?: string;
    paidAt?: string;
  };
  buyer?: {
    _id?: string;
    name?: string;
    email?: string;
  };
  seller?: {
    _id?: string;
    name?: string;
    storeName?: string;
    email?: string;
  };
  items?: {
    name?: string;
    title?: string;
    quantity?: number;
    price?: number;
    image?: string;
  }[];
  cancellation?: {
    cancelledBy?: string;
    reasonLabel?: string;
    refundStatus?: string;
  };
};

type PaymentsOverview = {
  feePercent: number;
  gmv: number | null;
  feeRevenue: number | null;
  subRevenue: MoneyBucket[];
  providers: {
    paystack: ProviderHealth;
    stripe: ProviderHealth;
  };
  available: string[];
  counts: {
    paidOrders: number;
    pendingPayment: number;
    refunded: number;
    payoutEligible: number;
    payoutCompleted: number;
    payoutFailed: number;
    disputed: number;
  };
};

type TabKey =
  | "overview"
  | "paid"
  | "pending"
  | "payouts"
  | "refunds"
  | "disputes";

function norm(s?: string | null) {
  return String(s || "")
    .trim()
    .toUpperCase();
}

function pickCurrency(...cands: Array<string | undefined | null>): string {
  for (const c of cands) {
    const v = norm(c);
    if (!v) continue;
    if (KNOWN_CURRENCIES.has(v)) return v;
    if (REGION_TO_CURRENCY[v]) return REGION_TO_CURRENCY[v];
    const base = v.split(/[-_]/)[0];
    if (REGION_TO_CURRENCY[base]) return REGION_TO_CURRENCY[base];
    if (KNOWN_CURRENCIES.has(base)) return base;
  }
  return "NGN";
}

function orderCurrency(o?: OrderRow | null): string {
  if (!o) return "NGN";
  return pickCurrency(
    o.feeBreakdown?.currency,
    o.currency,
    o.region ? REGION_TO_CURRENCY[norm(o.region)] : null,
  );
}

function roundMoney(amount: number, currency?: string): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  const cur = pickCurrency(currency) || "NGN";
  if (ZERO_DECIMAL.has(cur)) return Math.round(n);
  return Math.round(n * 100) / 100;
}

function fmtMoney(n?: number, currency = "NGN") {
  const cur = pickCurrency(currency) || "NGN";
  const v = roundMoney(Number(n || 0), cur);
  const fd = ZERO_DECIMAL.has(cur) ? 0 : 2;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      minimumFractionDigits: fd,
      maximumFractionDigits: fd,
    }).format(v);
  } catch {
    return `${v.toLocaleString()} ${cur}`;
  }
}

function shortDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function formatPlz(order: OrderRow | null | undefined) {
  if (!order) return "PLZ#—";
  const raw = (order.orderNumber || "").trim();
  if (raw) {
    if (raw.toUpperCase().startsWith("PLZ#")) return raw.toUpperCase();
    if (raw.toUpperCase().startsWith("PLZ"))
      return raw.replace(/^PLZ/i, "PLZ#").toUpperCase();
    return `PLZ#${raw.replace(/^#/, "")}`;
  }
  return `PLZ#${String(order._id).slice(-5).toUpperCase()}`;
}

function chargedTotal(o?: OrderRow | null) {
  if (!o) return 0;
  const g = Number(o.feeBreakdown?.grossAmount);
  if (Number.isFinite(g) && g >= 0) return g;
  const t = Number(o.totalAmount);
  if (Number.isFinite(t) && t >= 0) return t;
  return 0;
}

function platformFeeOf(o?: OrderRow | null) {
  if (!o) return 0;
  const f = Number(o.feeBreakdown?.platformFee ?? o.payout?.platformFee);
  if (Number.isFinite(f) && f >= 0) return f;
  const sub = Number(o.feeBreakdown?.subtotal ?? o.subtotal ?? 0);
  const rate = Number(o.feeBreakdown?.platformFeeRate ?? 0.08);
  return roundMoney(sub * rate, orderCurrency(o));
}

function sellerPayoutOf(o?: OrderRow | null) {
  if (!o) return 0;
  const p = Number(o.feeBreakdown?.sellerPayoutAmount ?? o.payout?.amount);
  if (Number.isFinite(p) && p >= 0) return p;
  const gross = chargedTotal(o);
  const fee = platformFeeOf(o);
  return roundMoney(gross - fee, orderCurrency(o));
}

function sumSubs(rows: any[]): MoneyBucket[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const provider = String(row?.provider || "").toLowerCase();
    if (provider !== "paystack" && provider !== "stripe") continue;
    const amount = Number(row?.amountPaid) || 0;
    if (amount <= 0) continue;
    const currency = String(row?.currency || "NGN").toUpperCase();
    map.set(currency, (map.get(currency) || 0) + amount);
  }
  return Array.from(map.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        ok
          ? "border-[#00E575]/35 bg-[#00E575]/10 text-[#00E575]"
          : "border-red-500/30 bg-red-500/10 text-red-300",
      )}
    >
      {ok ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3" />
      )}
      {label}
    </span>
  );
}

function payTone(status?: string) {
  const s = String(status || "").toLowerCase();
  if (s === "paid" || s === "success" || s === "completed") return "green" as const;
  if (s === "pending" || s === "processing" || s === "queued" || s === "eligible")
    return "warn" as const;
  if (s === "failed" || s === "refunded" || s === "cancelled") return "error" as const;
  return "neutral" as const;
}

function PaymentsGate({ children }: { children: ReactNode }) {
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!EXPECTED_PASSWORD) {
      setErr("Set NEXT_PUBLIC_ADMIN_PAYMENTS_PASSWORD");
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
          <h1 className="mt-2 text-2xl font-semibold">Payments</h1>
          <p className="mt-2 text-[13px] text-white/45">
            GMV, fees, subscriptions, payouts, refunds, and dispute settlement.
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

function RevenueFloat({
  overview,
  hidden,
}: {
  overview: PaymentsOverview;
  hidden?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || hidden) return null;

  const fee = overview.feeRevenue ?? 0;
  const gmv = overview.gmv ?? 0;

  return createPortal(
    <div
      className="pointer-events-none"
      style={{ position: "fixed", left: 16, bottom: 20, zIndex: Z_FLOAT }}
    >
      <div className="pointer-events-auto flex flex-col items-start gap-2 sm:ml-[72px]">
        {open && (
          <div className="w-[min(calc(100vw-5rem),300px)] overflow-hidden rounded-2xl border border-white/12 bg-[#0A0D12]/96 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <div className="h-[2px] w-full bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />
            <div className="p-3.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">
                Live take
              </p>
              <p className="mt-1 text-[14px] font-semibold text-[#F5F7FA]">
                Platform fee revenue
              </p>
              <p className="mt-1 text-[20px] font-bold tabular-nums text-[#00E575]">
                {fmtMoney(fee, "NGN")}
              </p>
              <p className="mt-2 text-[10px] text-white/35">
                GMV {fmtMoney(gmv, "NGN")} · default {overview.feePercent}% ·
                actual = per-seller plan
              </p>
              <p className="mt-1 text-[10px] text-white/30">
                Eligible payouts {overview.counts.payoutEligible} · failed{" "}
                {overview.counts.payoutFailed}
              </p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Revenue pulse"
          className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/14 bg-[#0A0D12]/96 backdrop-blur-md transition hover:border-white/25"
          style={{ boxShadow: "0 0 24px rgba(0,229,117,0.35)" }}
        >
          <Wallet className="h-5 w-5 text-[#00E575]" />
        </button>
      </div>
    </div>,
    document.body,
  );
}

function OrderMoneyModal({
  open,
  onClose,
  order,
  loading,
  busy,
  actionError,
  actionOk,
  onRefundBuyer,
  onSettleSeller,
}: {
  open: boolean;
  onClose: () => void;
  order: OrderRow | null;
  loading: boolean;
  busy: boolean;
  actionError: string;
  actionOk: string;
  onRefundBuyer: (note: string) => void;
  onSettleSeller: (note: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [note, setNote] = useState("");
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
    if (!open) return;
    setNote("");
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
  }, [open, order?._id]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const cur = orderCurrency(order);
  const paid = String(order?.paymentStatus || "").toLowerCase() === "paid";
  const alreadyRefunded =
    String(order?.paymentStatus || "").toLowerCase() === "refunded" ||
    String(order?.payout?.status || "").toLowerCase() === "refunded";

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
          <p className="text-[10px] font-semibold tracking-[0.2em] text-[#00E575]">
            MONEY · ORDER
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/50 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 sm:px-5"
        >
          {loading && !order && <OrbLoader label="Loading order…" />}

          {order && (
            <div className="space-y-4">
              <div>
                <p className="font-mono text-[15px] font-semibold text-[#00E575]">
                  {formatPlz(order)}
                </p>
                <p className="mt-1 text-[12px] text-white/45">
                  {shortDate(order.createdAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={payTone(order.paymentStatus)}>
                    pay · {order.paymentStatus || "—"}
                  </Badge>
                  <Badge tone="neutral">{order.orderStatus || "—"}</Badge>
                  {order.paymentLifecycle ? (
                    <Badge tone="blue">{order.paymentLifecycle}</Badge>
                  ) : null}
                  {order.payout?.status ? (
                    <Badge tone={payTone(order.payout.status)}>
                      payout · {order.payout.status}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["Buyer paid", chargedTotal(order)],
                    ["Platform fee", platformFeeOf(order)],
                    ["Seller payout", sellerPayoutOf(order)],
                    [
                      "Shipping",
                      Number(
                        order.feeBreakdown?.shippingCost ??
                          order.shippingCost ??
                          0,
                      ),
                    ],
                  ] as const
                ).map(([label, val]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-2.5"
                  >
                    <p className="text-[9px] font-semibold uppercase text-white/35">
                      {label}
                    </p>
                    <p className="mt-1 text-[14px] font-semibold tabular-nums">
                      {fmtMoney(val, cur)}
                    </p>
                  </div>
                ))}
              </div>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Parties
                </p>
                <div className="space-y-2 text-[13px]">
                  <p className="flex items-center gap-2 text-white/70">
                    <User className="h-3.5 w-3.5 text-[#00E575]" />
                    {order.buyer?.name || "—"} · {order.buyer?.email || "—"}
                  </p>
                  <p className="flex items-center gap-2 text-white/70">
                    <Store className="h-3.5 w-3.5 text-[#00E575]" />
                    {order.seller?.storeName || order.seller?.name || "—"} ·{" "}
                    {order.seller?.email || "—"}
                  </p>
                </div>
              </section>

              {order.payout?.blockedReason ? (
                <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
                  Payout block: {order.payout.blockedReason}
                </p>
              ) : null}

              {order.payout?.reference ? (
                <p className="font-mono text-[11px] text-white/40">
                  Payout ref · {order.payout.reference}
                </p>
              ) : null}

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Admin actions
                </p>
                <p className="mb-2 text-[11px] text-white/40">
                  Uses{" "}
                  <code className="text-white/55">
                    POST /payments/admin/disputes/:orderId/…
                  </code>
                  . Refund hits Paystack/Stripe; settle marks seller favour and
                  triggers payout job.
                </p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Note for audit / dispute resolution…"
                  className="mb-2 w-full rounded-xl border border-white/12 bg-[#14181F] px-3 py-2 text-sm outline-none focus:border-[#00E575]/40"
                />
                {actionError && (
                  <p className="mb-2 text-xs text-red-400">{actionError}</p>
                )}
                {actionOk && (
                  <p className="mb-2 text-xs text-[#00E575]">{actionOk}</p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="flex-1 gap-2 rounded-xl"
                    disabled={busy || !paid || alreadyRefunded}
                    onClick={() => onRefundBuyer(note)}
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    Refund buyer
                  </Button>
                  <Button
                    tone="ghost"
                    className="flex-1 gap-2 rounded-xl border border-white/12"
                    disabled={busy || !paid || alreadyRefunded}
                    onClick={() => onSettleSeller(note)}
                  >
                    <ArrowUpFromLine className="h-4 w-4" />
                    Settle seller
                  </Button>
                </div>
              </section>

              <div className="flex gap-2">
                <Link
                  href={`/orders?q=${encodeURIComponent(formatPlz(order))}`}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-white/12 text-sm text-white/55"
                >
                  Open in Orders
                </Link>
                {order.buyer?._id ? (
                  <Link
                    href={`/users?userId=${order.buyer._id}`}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-white/12 text-sm text-white/55"
                  >
                    Buyer profile
                  </Link>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PaymentsBody() {
  const { getToken } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<TabKey>("overview");
  const [view, setView] = useState<"list" | "grid">("list");
  const [q, setQ] = useState("");

  const [overview, setOverview] = useState<PaymentsOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState("");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionOk, setActionOk] = useState("");

  useEffect(() => {
    setMounted(true);
    const sync = () =>
      setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      setLoadingOverview(true);
      setOverviewError("");
      const token = await getToken();
      if (!token) {
        setOverviewError("Session expired.");
        setLoadingOverview(false);
        return;
      }

      const [statsRes, subRes, configRes, ordersSnap] = await Promise.all([
        adminFetch<any>("/admin/stats", token).catch(() => null),
        adminFetch<any>("/admin/subscriptions/overview", token).catch(
          () => null,
        ),
        adminFetch<any>("/payments/config", token).catch(() => null),
        adminFetch<any>("/admin/orders?limit=1&page=1", token).catch(
          () => null,
        ),
      ]);

      const stats = statsRes?.data || {};
      const config = configRes?.data || configRes || {};
      const subs = subRes?.data?.subscriptions || [];
      const countsFromOrders = ordersSnap?.counts || {};

      const gmvRaw = stats?.commerce?.gmv ?? stats?.totalRevenue;
      const feeRaw =
        stats?.commerce?.platformFeeRevenue ??
        stats?.revenue?.transactionFees ??
        null;

      setOverview({
        feePercent:
          config.feePercent ??
          (config.feeRate ? Math.round(Number(config.feeRate) * 100) : 8),
        gmv: gmvRaw == null ? null : Number(gmvRaw) || 0,
        feeRevenue: feeRaw == null ? null : Number(feeRaw) || 0,
        subRevenue: sumSubs(subs),
        providers: {
          paystack: {
            configured:
              !!config.providers?.paystack?.configured ||
              config.provider === "paystack",
            publicKey: config.providers?.paystack?.publicKey || null,
          },
          stripe: {
            configured: !!config.providers?.stripe?.configured,
            publicKey: config.providers?.stripe?.publicKey || null,
          },
        },
        available: config.available || [],
        counts: {
          paidOrders:
            Number(stats?.payments?.paid ?? countsFromOrders.paid ?? 0) || 0,
          pendingPayment:
            Number(
              stats?.payments?.pending ?? countsFromOrders.pending ?? 0,
            ) || 0,
          refunded:
            Number(
              stats?.payments?.refunded ?? countsFromOrders.refunded ?? 0,
            ) || 0,
          payoutEligible:
            Number(stats?.payouts?.eligible ?? countsFromOrders.payoutEligible ?? 0) ||
            0,
          payoutCompleted:
            Number(
              stats?.payouts?.completed ?? countsFromOrders.payoutCompleted ?? 0,
            ) || 0,
          payoutFailed:
            Number(
              stats?.payouts?.failed ?? countsFromOrders.payoutFailed ?? 0,
            ) || 0,
          disputed:
            Number(stats?.disputes?.open ?? countsFromOrders.disputed ?? 0) || 0,
        },
      });
    } catch (e: any) {
      setOverviewError(e?.message || "Failed to load payments overview");
    } finally {
      setLoadingOverview(false);
    }
  }, [getToken]);

  const orderQueryForTab = useCallback(
    (p: number) => {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(PAGE_SIZE),
        sort: "newest",
      });
      if (q.trim()) params.set("q", q.trim());
      // Backend may accept paymentStatus / payoutStatus; if not, client filters
      if (tab === "paid") params.set("paymentStatus", "paid");
      if (tab === "pending") params.set("paymentStatus", "pending");
      if (tab === "refunds") params.set("paymentStatus", "refunded");
      if (tab === "payouts") params.set("payoutStatus", "eligible,queued,failed,completed");
      if (tab === "disputes") params.set("hasDispute", "1");
      return params;
    },
    [tab, q],
  );

  const loadOrders = useCallback(
    async (p = 1) => {
      if (tab === "overview") return;
      try {
        setOrdersLoading(true);
        setOrdersError("");
        const token = await getToken();
        if (!token) {
          setOrdersError("Session expired.");
          setOrdersLoading(false);
          return;
        }
        const json = await adminFetch<any>(
          `/admin/orders?${orderQueryForTab(p)}`,
          token,
        );
        let rows: OrderRow[] = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.orders)
            ? json.orders
            : [];

        // Soft client filter if API ignores paymentStatus
        if (tab === "paid") {
          rows = rows.filter(
            (o) => String(o.paymentStatus || "").toLowerCase() === "paid",
          );
        } else if (tab === "pending") {
          rows = rows.filter((o) =>
            ["pending", "processing", "initiated"].includes(
              String(o.paymentStatus || "").toLowerCase(),
            ),
          );
        } else if (tab === "refunds") {
          rows = rows.filter(
            (o) =>
              String(o.paymentStatus || "").toLowerCase() === "refunded" ||
              String(o.payout?.status || "").toLowerCase() === "refunded",
          );
        } else if (tab === "payouts") {
          rows = rows.filter((o) =>
            ["eligible", "queued", "failed", "completed", "processing"].includes(
              String(o.payout?.status || "").toLowerCase(),
            ),
          );
        }

        setOrders(rows);
        setTotal(json.pagination?.total ?? rows.length);
        setPages(json.pagination?.pages || 1);
        setPage(json.pagination?.page || p);
      } catch (e: any) {
        setOrdersError(e?.message || "Failed to load payment orders");
      } finally {
        setOrdersLoading(false);
      }
    },
    [getToken, orderQueryForTab, tab],
  );

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || page >= pages || offline || tab === "overview")
      return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const token = await getToken();
      if (!token) return;
      const json = await adminFetch<any>(
        `/admin/orders?${orderQueryForTab(next)}`,
        token,
      );
      const batch: OrderRow[] = Array.isArray(json?.data) ? json.data : [];
      setOrders((prev) => {
        const seen = new Set(prev.map((o) => o._id));
        return [...prev, ...batch.filter((o) => !seen.has(o._id))];
      });
      setPages(json.pagination?.pages || pages);
      setPage(json.pagination?.page || next);
    } catch {
      /* keep */
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [getToken, orderQueryForTab, page, pages, offline, tab]);

  const openOrder = useCallback(
    async (id: string) => {
      setOpenId(id);
      setDetail(null);
      setModalOpen(true);
      setActionError("");
      setActionOk("");
      setDetailLoading(true);
      try {
        const token = await getToken();
        if (!token) return;
        const json = await adminFetch<any>(`/admin/orders/${id}`, token);
        const row =
          json?.data?.order || json?.data || json?.order || json || null;
        setDetail(row);
      } catch (e: any) {
        setActionError(e?.message || "Could not load order");
      } finally {
        setDetailLoading(false);
      }
    },
    [getToken],
  );

  const closeOrder = useCallback(() => {
    setModalOpen(false);
    window.setTimeout(() => {
      setOpenId(null);
      setDetail(null);
    }, 280);
  }, []);

  const runRefund = useCallback(
    async (note: string) => {
      if (!detail?._id || actionBusy) return;
      try {
        setActionBusy(true);
        setActionError("");
        setActionOk("");
        const token = await getToken();
        if (!token) return;
        // adminFetch base is usually /api — payment routes live under /payments
        const base = API.replace(/\/$/, "");
        const res = await fetch(
          `${base}/payments/admin/disputes/${detail._id}/refund-buyer`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              reason: note || "Admin resolution — buyer favour",
              note: note || "",
            }),
          },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.message || "Refund failed");
        }
        setActionOk("Refund initiated via provider.");
        setDetail(json?.data?.order || detail);
        void loadOrders(1);
        void loadOverview();
      } catch (e: any) {
        setActionError(e?.message || "Refund failed");
      } finally {
        setActionBusy(false);
      }
    },
    [detail, actionBusy, getToken, loadOrders, loadOverview],
  );

  const runSettle = useCallback(
    async (note: string) => {
      if (!detail?._id || actionBusy) return;
      try {
        setActionBusy(true);
        setActionError("");
        setActionOk("");
        const token = await getToken();
        if (!token) return;
        const base = API.replace(/\/$/, "");
        const res = await fetch(
          `${base}/payments/admin/disputes/${detail._id}/settle-seller`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ note: note || "" }),
          },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.message || "Settle failed");
        }
        setActionOk(
          json?.message || "Settled in seller favour; payout triggered.",
        );
        setDetail(json?.data?.order || detail);
        void loadOrders(1);
        void loadOverview();
      } catch (e: any) {
        setActionError(e?.message || "Settle failed");
      } finally {
        setActionBusy(false);
      }
    },
    [detail, actionBusy, getToken, loadOrders, loadOverview],
  );

  useEffect(() => {
    if (!mounted) return;
    void loadOverview();
  }, [mounted, loadOverview]);

  useEffect(() => {
    if (!mounted || tab === "overview") return;
    void loadOrders(1);
  }, [mounted, tab, loadOrders]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || tab === "overview") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, orders.length, tab]);

  const subPrimary = overview?.subRevenue[0];
  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "paid", label: "Paid" },
    { key: "pending", label: "Pending" },
    { key: "payouts", label: "Payouts" },
    { key: "refunds", label: "Refunds" },
    { key: "disputes", label: "Disputes" },
  ];

  return (
    <div className="relative mx-auto max-w-6xl pb-28 text-[#F5F7FA]">
      {mounted && offline && (
        <div className="mb-4 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          Offline — reconnect to refresh money data.
        </div>
      )}

      <header className="mb-6">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
          MONETIZATION
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">
              Payments
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] text-white/50">
              GMV, platform fees, seller plan revenue, provider health, payouts,
              refunds, and dispute settlement — Plazore money desk.
            </p>
          </div>
          <Button
            tone="ghost"
            className="h-10 gap-1.5 rounded-full border border-white/12 bg-[#14181F] text-xs"
            disabled={loadingOverview || offline}
            onClick={() => {
              void loadOverview();
              if (tab !== "overview") void loadOrders(1);
            }}
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5",
                loadingOverview && "animate-spin",
              )}
            />
            Refresh
          </Button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[11px] font-semibold tracking-wide transition",
              tab === t.key
                ? "border-[#00E575]/40 bg-[#00E575]/15 text-[#00E575]"
                : "border-white/10 text-white/45 hover:border-white/20 hover:text-white/70",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {overviewError && (
        <div className="mb-4">
          <ErrorBlock message={overviewError} />
        </div>
      )}

      {tab === "overview" && (
        <>
          {loadingOverview && !overview ? (
            <OrbLoader label="Loading money desk…" />
          ) : overview ? (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-white/40">
                    <Banknote className="h-3.5 w-3.5" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                      GMV
                    </p>
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {overview.gmv == null
                      ? "—"
                      : fmtMoney(overview.gmv, "NGN")}
                  </p>
                  <p className="mt-1 text-[11px] text-white/35">
                    Non-cancelled order totals · not FX-converted
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-white/40">
                    <CreditCard className="h-3.5 w-3.5" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                      Fee revenue
                    </p>
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {overview.feeRevenue == null
                      ? "—"
                      : fmtMoney(overview.feeRevenue, "NGN")}
                  </p>
                  <p className="mt-1 text-[11px] text-white/35">
                    Default {overview.feePercent}% · per seller plan on product
                    subtotal only
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-white/40">
                    <Shield className="h-3.5 w-3.5" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                      Subscriptions
                    </p>
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {subPrimary
                      ? fmtMoney(subPrimary.amount, subPrimary.currency)
                      : fmtMoney(0, "NGN")}
                  </p>
                  <p className="mt-1 text-[11px] text-white/35">
                    Paid Paystack/Stripe plans · promo/free excluded
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-white/40">
                    <Activity className="h-3.5 w-3.5" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                      Flow
                    </p>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/70">
                    Paid {overview.counts.paidOrders} · pending{" "}
                    {overview.counts.pendingPayment} · refunded{" "}
                    {overview.counts.refunded}
                  </p>
                  <p className="mt-1 text-[11px] text-white/35">
                    Payouts eligible {overview.counts.payoutEligible} · done{" "}
                    {overview.counts.payoutCompleted} · failed{" "}
                    {overview.counts.payoutFailed}
                  </p>
                </div>
              </div>

              <section className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <h2 className="text-sm font-semibold">Payment providers</h2>
                <p className="mt-1 text-[12px] text-white/45">
                  Secrets stay on the server. Public keys + configured flags
                  only.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-[#0E1116] p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Paystack</p>
                      <StatusPill
                        ok={!!overview.providers.paystack.configured}
                        label={
                          overview.providers.paystack.configured
                            ? "Connected"
                            : "Not configured"
                        }
                      />
                    </div>
                    <p className="mt-2 text-[12px] text-white/45">
                      Nigeria &amp; Africa · charges, refunds, NUBAN transfers
                    </p>
                    {overview.providers.paystack.publicKey && (
                      <p className="mt-3 truncate font-mono text-[10px] text-white/30">
                        pk ·{" "}
                        {String(overview.providers.paystack.publicKey).slice(
                          0,
                          20,
                        )}
                        …
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#0E1116] p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Stripe</p>
                      <StatusPill
                        ok={!!overview.providers.stripe.configured}
                        label={
                          overview.providers.stripe.configured
                            ? "Connected"
                            : "Not configured"
                        }
                      />
                    </div>
                    <p className="mt-2 text-[12px] text-white/45">
                      International cards · PaymentIntents, refunds, Connect
                      transfers
                    </p>
                    {overview.providers.stripe.publicKey && (
                      <p className="mt-3 truncate font-mono text-[10px] text-white/30">
                        pk ·{" "}
                        {String(overview.providers.stripe.publicKey).slice(
                          0,
                          20,
                        )}
                        …
                      </p>
                    )}
                  </div>
                </div>
                {overview.available.length > 0 && (
                  <p className="mt-3 text-[11px] text-white/35">
                    Available rails: {overview.available.join(" · ")}
                  </p>
                )}
              </section>

              {overview.subRevenue.length > 1 && (
                <Panel className="mb-6 rounded-2xl border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                    Subscription revenue by currency
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {overview.subRevenue.map((b) => (
                      <li
                        key={b.currency}
                        className="flex justify-between text-[13px] text-white/65"
                      >
                        <span>{b.currency}</span>
                        <span className="tabular-nums font-medium text-[#F5F7FA]">
                          {fmtMoney(b.amount, b.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <h2 className="text-sm font-semibold">How money moves</h2>
                <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-white/50">
                  <li>
                    · Buyer pays full gross (products + shipping) via Paystack
                    or Stripe.
                  </li>
                  <li>
                    · Platform fee = plan rate × product subtotal only (shipping
                    excluded).
                  </li>
                  <li>
                    · Seller payout becomes eligible after delivery confirm /
                    auto-confirm or admin settle-seller.
                  </li>
                  <li>
                    · Nightly payout job transfers eligible balances; failed
                    rows retry.
                  </li>
                  <li>
                    · Admin refund-buyer reverses charge and blocks seller
                    payout.
                  </li>
                </ul>
              </section>
            </>
          ) : null}
        </>
      )}

      {tab !== "overview" && (
        <>
          <Panel className="mb-4 overflow-hidden rounded-2xl border-white/[0.08] bg-white/[0.03]">
            <div className="flex flex-col gap-2 p-4 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input
                  className="rounded-xl border-white/12 bg-[#14181F] pl-10"
                  placeholder="Order number, buyer, seller, email…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !offline && loadOrders(1)
                  }
                />
              </div>
              <Button
                className="h-10 rounded-xl"
                onClick={() => loadOrders(1)}
                disabled={ordersLoading || offline}
              >
                Search
              </Button>
              <div className="flex overflow-hidden rounded-xl border border-white/12">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center",
                    view === "list"
                      ? "bg-[#00E575] text-[#041412]"
                      : "text-white/50",
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center",
                    view === "grid"
                      ? "bg-[#00E575] text-[#041412]"
                      : "text-white/50",
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Panel>

          {ordersError && (
            <div className="mb-4">
              <ErrorBlock message={ordersError} />
            </div>
          )}

          {ordersLoading && orders.length === 0 ? (
            <OrbLoader label="Loading…" />
          ) : orders.length === 0 ? (
            <EmptyState
              title="No rows"
              body="Nothing in this payment slice yet."
            />
          ) : view === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {orders.map((row) => {
                const cur = orderCurrency(row);
                return (
                  <button
                    key={row._id}
                    type="button"
                    onClick={() => openOrder(row._id)}
                    className={cn(
                      "rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition hover:border-white/20",
                      openId === row._id &&
                        modalOpen &&
                        "border-[#00E575]/40",
                    )}
                  >
                    <p className="font-mono text-[13px] font-semibold text-[#00E575]">
                      {formatPlz(row)}
                    </p>
                    <p className="mt-1 truncate text-[12px] text-white/45">
                      {row.buyer?.name || "—"} →{" "}
                      {row.seller?.storeName || row.seller?.name || "—"}
                    </p>
                    <p className="mt-2 text-[16px] font-semibold tabular-nums">
                      {fmtMoney(chargedTotal(row), cur)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone={payTone(row.paymentStatus)}>
                        {row.paymentStatus || "—"}
                      </Badge>
                      {row.payout?.status ? (
                        <Badge tone={payTone(row.payout.status)}>
                          {row.payout.status}
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <Panel className="overflow-x-auto rounded-2xl border-white/[0.08] bg-white/[0.03]">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.12em] text-white/40">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Buyer → Seller</th>
                    <th className="px-4 py-3">Charged</th>
                    <th className="px-4 py-3">Fee</th>
                    <th className="px-4 py-3">Payout</th>
                    <th className="px-4 py-3">Pay</th>
                    <th className="px-4 py-3">Payout st</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((row) => {
                    const cur = orderCurrency(row);
                    return (
                      <tr
                        key={row._id}
                        onClick={() => openOrder(row._id)}
                        className={cn(
                          "cursor-pointer border-b border-white/[0.05] hover:bg-white/[0.04]",
                          openId === row._id &&
                            modalOpen &&
                            "bg-[#00E575]/[0.06]",
                        )}
                      >
                        <td className="px-4 py-3 font-mono text-[12px] font-semibold text-[#00E575]">
                          {formatPlz(row)}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-white/55">
                          <span className="block truncate max-w-[180px]">
                            {row.buyer?.name || "—"}
                          </span>
                          <span className="block truncate max-w-[180px] text-white/35">
                            {row.seller?.storeName || row.seller?.name || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums font-medium">
                          {fmtMoney(chargedTotal(row), cur)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-white/55">
                          {fmtMoney(platformFeeOf(row), cur)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-white/55">
                          {fmtMoney(sellerPayoutOf(row), cur)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={payTone(row.paymentStatus)}>
                            {row.paymentStatus || "—"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {row.payout?.status ? (
                            <Badge tone={payTone(row.payout.status)}>
                              {row.payout.status}
                            </Badge>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-white/45">
                          {shortDate(row.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Panel>
          )}

          <div ref={sentinelRef} className="h-8 w-full" />
          {loadingMore && (
            <p className="py-3 text-center text-xs text-white/40">
              Loading more…
            </p>
          )}
          {page >= pages && orders.length > 0 && (
            <p className="py-3 text-center text-[11px] text-white/30">
              End · {orders.length.toLocaleString()} shown
              {total ? ` / ${total.toLocaleString()}` : ""}
            </p>
          )}
        </>
      )}

      {overview ? (
        <RevenueFloat health={undefined as any} /* type shim */ {...({ overview, hidden: modalOpen } as any)} />
      ) : null}
      {/* fix: pass overview correctly */}
      {overview ? (
        <RevenueFloat overview={overview} hidden={modalOpen} />
      ) : null}

      <OrderMoneyModal
        open={modalOpen}
        onClose={closeOrder}
        order={detail}
        loading={detailLoading}
        busy={actionBusy}
        actionError={actionError}
        actionOk={actionOk}
        onRefundBuyer={runRefund}
        onSettleSeller={runSettle}
      />
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <PaymentsGate>
      <PaymentsBody />
    </PaymentsGate>
  );
}