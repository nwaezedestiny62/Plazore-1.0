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
import { useSearchParams } from "next/navigation";
import {
  Banknote,
  LayoutGrid,
  List,
  Lock,
  Package,
  RefreshCw,
  Scale,
  Shield,
  Store,
  User,
  WifiOff,
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

const GATE_KEY = "plazore.admin.ordersGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_ORDERS_PASSWORD || "plazore@order1999";
const Z_MODAL = 9999;
const FEE_RATE = 0.08;

/**
 * Exact match of server/config/payment.ts REGION_TO_CURRENCY.
 * Do not invent FX. Admin only formats frozen checkout amounts.
 */
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

const REGION_NAME: Record<string, string> = {
  NG: "Nigeria",
  GH: "Ghana",
  BJ: "Benin",
  TG: "Togo",
  CI: "Côte d'Ivoire",
  SN: "Senegal",
  CM: "Cameroon",
  KE: "Kenya",
  ZA: "South Africa",
  EG: "Egypt",
  UG: "Uganda",
  TZ: "Tanzania",
  RW: "Rwanda",
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  UK: "United Kingdom",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  IT: "Italy",
  ES: "Spain",
  EU: "Europe",
  AU: "Australia",
};

type OrderItem = {
  product?:
    | string
    | {
        _id?: string;
        name?: string;
        images?: string[];
        price?: number;
        region?: string;
      };
  name?: string;
  quantity?: number;
  price?: number;
  region?: string;
  currency?: string;
  image?: string;
  note?: string;
};

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
  updatedAt?: string;
  deliveredAt?: string;
  buyerNote?: string;
  feeBreakdown?: FeeBreakdown;
  buyerConfirmation?: {
    status?: string;
    confirmedAt?: string;
    issueReportedAt?: string;
    confirmationDeadline?: string;
  };
  payout?: {
    status?: string;
    eligibleAt?: string;
    blockedReason?: string;
    amount?: number;
    platformFee?: number;
    reference?: string;
  };
  buyer?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
    marketplaceRegion?: string;
  };
  seller?: {
    _id?: string;
    name?: string;
    storeName?: string;
    email?: string;
    phone?: string;
    marketplaceRegion?: string;
    isSellerSuspended?: boolean;
  };
  buyerContact?: { name?: string; phone?: string };
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  items?: OrderItem[];
  productShipping?: {
    method?: string;
    courierCompany?: string;
    deliveryFee?: number;
  };
  shipping?: {
    shippingMethod?: string;
    deliveryCompany?: string;
    trackingNumber?: string;
    estimatedDelivery?: string;
    selfDeliveryNote?: string;
    shippedAt?: string;
  };
  cancellation?: {
    cancelledBy?: string;
    reasonCode?: string;
    reasonLabel?: string;
    note?: string;
    cancelledAt?: string;
    refundStatus?: string;
  };
};

type Counts = {
  all: number;
  Preparing: number;
  Shipped: number;
  Delivered: number;
  Cancelled: number;
};

function norm(s?: string | null) {
  return String(s || "")
    .trim()
    .toUpperCase();
}

function isIsoCurrency(s?: string | null) {
  const v = norm(s);
  return v.length === 3 && /^[A-Z]{3}$/.test(v);
}

/** Same rules as backend currencyForRegion — never treat NG as NGN field mix-up. */
function currencyForRegion(region?: string | null): string {
  const key = norm(region);
  if (!key) return "";
  if (REGION_TO_CURRENCY[key]) return REGION_TO_CURRENCY[key];
  if (KNOWN_CURRENCIES.has(key)) return key;
  const base = key.split(/[-_]/)[0];
  if (REGION_TO_CURRENCY[base]) return REGION_TO_CURRENCY[base];
  if (KNOWN_CURRENCIES.has(base)) return base;
  return "";
}

function asRegionCode(raw?: string | null): string {
  const key = norm(raw);
  if (!key) return "";
  if (REGION_TO_CURRENCY[key]) return key;
  const base = key.split(/[-_]/)[0];
  if (REGION_TO_CURRENCY[base]) return base;
  if (key.length === 2) return key;
  return "";
}

function pickCurrency(...cands: Array<string | undefined | null>): string {
  for (const c of cands) {
    const v = norm(c);
    if (!v) continue;
    if (REGION_TO_CURRENCY[v]) return REGION_TO_CURRENCY[v];
    if (isIsoCurrency(v)) return v;
  }
  return "";
}

function firstItem(o?: OrderRow | null): OrderItem | undefined {
  return o?.items?.[0];
}

function productRegion(it?: OrderItem) {
  if (!it) return "";
  if (typeof it.product === "object") return asRegionCode(it.product?.region);
  return "";
}

/** Listing region frozen at checkout (matches Order.region / item.region). */
function orderRegion(o?: OrderRow | null): string {
  if (!o) return "—";
  const it = firstItem(o);
  return (
    asRegionCode(o.feeBreakdown?.region) ||
    asRegionCode(o.region) ||
    asRegionCode(it?.region) ||
    productRegion(it) ||
    asRegionCode(o.seller?.marketplaceRegion) ||
    "—"
  );
}

/**
 * Currency the buyer was charged in.
 * Prefer frozen feeBreakdown.currency → order.currency → item.currency
 * then map listing region. Never live-convert.
 */
function orderCurrency(o?: OrderRow | null): string {
  if (!o) return "NGN";
  const frozen = pickCurrency(
    o.feeBreakdown?.currency,
    o.currency,
    firstItem(o)?.currency
  );
  if (frozen) return frozen;
  const mapped = currencyForRegion(orderRegion(o));
  if (mapped) return mapped;
  const sellerCur = currencyForRegion(o.seller?.marketplaceRegion);
  if (sellerCur) return sellerCur;
  return "NGN";
}

function itemRegion(it: OrderItem, order?: OrderRow | null) {
  return (
    asRegionCode(it.region) ||
    productRegion(it) ||
    (order ? orderRegion(order) : "") ||
    "—"
  );
}

function itemCurrency(it: OrderItem, order?: OrderRow | null) {
  const frozen = pickCurrency(it.currency);
  if (frozen) return frozen;
  const fromLine = currencyForRegion(itemRegion(it, order));
  if (fromLine) return fromLine;
  return orderCurrency(order);
}

function regionLabel(code?: string) {
  const k = asRegionCode(code) || norm(code);
  if (!k || k === "—") return "—";
  return REGION_NAME[k] || k;
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

function fmtDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

/** Format frozen major units in the given ISO currency. No FX. */
function fmtMoney(n?: number, currency = "NGN") {
  const v = Number(n || 0);
  const cur =
    pickCurrency(currency) ||
    currencyForRegion(currency) ||
    "NGN";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v.toLocaleString()} ${cur}`;
  }
}

function itemUnitPrice(it: OrderItem) {
  return Number(it.price || 0);
}

function itemLineTotal(it: OrderItem) {
  const qty = Math.max(1, Number(it.quantity) || 1);
  return itemUnitPrice(it) * qty;
}

/** Matches backend calculatePlatformFee */
function platformFeeOf(subtotal?: number) {
  const s = Number(subtotal || 0);
  if (!Number.isFinite(s) || s < 0) return 0;
  return Math.round(s * FEE_RATE * 100) / 100;
}

/** Matches backend calculateSellerPayout */
function sellerPayoutOf(subtotal?: number, shipping?: number) {
  const sub = Number(subtotal || 0);
  const ship = Number(shipping || 0);
  const gross = Math.round((sub + ship) * 100) / 100;
  const fee = platformFeeOf(sub);
  return Math.round((gross - fee) * 100) / 100;
}

function chargedTotal(o?: OrderRow | null) {
  if (!o) return 0;
  const g = Number(o.feeBreakdown?.grossAmount);
  if (Number.isFinite(g) && g > 0) return g;
  return Number(o.totalAmount || 0);
}

function parseOrdersList(json: any): OrderRow[] {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.orders)) return json.orders;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json)) return json;
  return [];
}

function parseOrderDetail(json: any): OrderRow | null {
  if (!json || typeof json !== "object") return null;
  const row =
    json.data && typeof json.data === "object" && json.data._id
      ? json.data
      : json.order && typeof json.order === "object" && json.order._id
        ? json.order
        : json._id
          ? json
          : null;
  return row as OrderRow | null;
}

function statusTone(
  s?: string
): "green" | "error" | "blue" | "warn" | "neutral" {
  if (s === "Delivered") return "green";
  if (s === "Cancelled") return "error";
  if (s === "Shipped") return "blue";
  if (s === "Preparing") return "warn";
  return "neutral";
}

function payTone(s?: string): "green" | "error" | "blue" | "warn" | "neutral" {
  const v = String(s || "").toLowerCase();
  if (v === "paid") return "green";
  if (v === "failed") return "error";
  if (v === "refunded") return "blue";
  if (v === "pending") return "warn";
  return "neutral";
}

function lifecycleTone(
  s?: string
): "green" | "error" | "blue" | "warn" | "neutral" {
  const v = String(s || "").toUpperCase();
  if (
    [
      "SELLER_PAID",
      "DELIVERY_CONFIRMED",
      "PAYMENT_PROTECTED",
      "PAYMENT_VERIFIED",
    ].includes(v)
  )
    return "green";
  if (["REFUNDED", "PAYMENT_FAILED", "CANCELLED"].includes(v)) return "error";
  if (["DISPUTED", "REFUND_PENDING"].includes(v)) return "warn";
  if (["SETTLED_SELLER_FAVOUR", "SHIPPED", "DELIVERED"].includes(v))
    return "blue";
  if (["PENDING_PAYMENT", "PAYMENT_PROCESSING"].includes(v)) return "warn";
  return "neutral";
}

function lifecycleLabel(s?: string) {
  if (!s) return "—";
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
        className
      )}
    >
      {children}
    </select>
  );
}

function DarkInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        "h-10 w-full rounded-xl border border-white/12 bg-[#14181F] px-3 text-[13px] text-[#F5F7FA] outline-none placeholder:text-white/30 focus:border-[#00E575]/40 disabled:opacity-50",
        className
      )}
    />
  );
}

function OrdersGate({ children }: { children: ReactNode }) {
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
            shake && "animate-[plazore-shake_0.4s_ease-in-out]"
          )}
        >
          <div className="h-px bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />
          <div className="mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
            <Lock className="h-4 w-4 text-[#00E575]" />
          </div>
          <p className="mt-4 text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
            RESTRICTED
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Orders</h1>
          <p className="mt-2 text-[13px] text-white/45">
            Enter access password to view commerce orders, fees and payouts.
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

function OrderFlow({ order }: { order: OrderRow }) {
  const status = order.orderStatus || "Preparing";
  const cancelled = status === "Cancelled";
  const lifecycle = String(order.paymentLifecycle || "").toUpperCase();
  const paid =
    order.paymentStatus === "paid" ||
    [
      "PAYMENT_VERIFIED",
      "PAYMENT_PROTECTED",
      "PROCESSING_ORDER",
      "SHIPPED",
      "DELIVERED",
      "DELIVERY_CONFIRMED",
      "SELLER_PAYOUT_PENDING",
      "SELLER_PAID",
    ].includes(lifecycle);

  const steps = [
    {
      key: "paid",
      label: "Payment",
      at: paid ? order.createdAt : undefined,
      done: paid,
    },
    {
      key: "Preparing",
      label: "Preparing",
      at: order.createdAt,
      done: ["Preparing", "Shipped", "Delivered"].includes(status) || cancelled,
    },
    {
      key: "Shipped",
      label: "Shipped",
      at: order.shipping?.shippedAt,
      done: ["Shipped", "Delivered"].includes(status),
    },
    {
      key: "Delivered",
      label: "Delivered",
      at: order.deliveredAt,
      done: status === "Delivered",
    },
    {
      key: "confirmed",
      label: "Buyer confirm",
      at: order.buyerConfirmation?.confirmedAt,
      done: ["confirmed", "auto_confirmed"].includes(
        String(order.buyerConfirmation?.status || "")
      ),
    },
    {
      key: "payout",
      label: "Seller payout",
      at: order.payout?.eligibleAt,
      done: ["completed", "initiated", "queued"].includes(
        String(order.payout?.status || "")
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {cancelled && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          Cancelled
          {order.cancellation?.cancelledAt
            ? ` · ${fmtDate(order.cancellation.cancelledAt)}`
            : ""}
          {order.cancellation?.cancelledBy
            ? ` · by ${order.cancellation.cancelledBy}`
            : ""}
        </div>
      )}
      {lifecycle === "DISPUTED" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Dispute open — payout blocked
          {order.payout?.blockedReason
            ? ` · ${order.payout.blockedReason}`
            : ""}
        </div>
      )}
      <ol className="space-y-0">
        {steps.map((step, i) => {
          const isCurrent =
            step.key === status ||
            (step.key === "paid" && !paid && status === "Preparing");
          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                    step.done
                      ? "border-[#00E575]/50 bg-[#00E575]/15 text-[#00E575]"
                      : "border-white/10 bg-white/[0.04] text-white/40",
                    isCurrent && !cancelled && "ring-2 ring-[#00E575]/40"
                  )}
                >
                  {step.done ? "✓" : i + 1}
                </span>
                {i < steps.length - 1 && (
                  <span
                    className={cn(
                      "my-0.5 min-h-[16px] w-px flex-1",
                      step.done ? "bg-[#00E575]/40" : "bg-white/10"
                    )}
                  />
                )}
              </div>
              <div className="pb-4">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.done ? "text-[#F5F7FA]" : "text-white/40"
                  )}
                >
                  {step.label}
                </p>
                <p className="text-[11px] text-white/35">
                  {step.at ? fmtDate(step.at) : step.done ? "—" : "Pending"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function OrderModal({
  open,
  onClose,
  selected,
  detailLoading,
  actionBusy,
  actionMsg,
  onRefund,
  onSellerFavour,
}: {
  open: boolean;
  onClose: () => void;
  selected: OrderRow | null;
  detailLoading: boolean;
  actionBusy: boolean;
  actionMsg: string;
  onRefund: () => void;
  onSellerFavour: () => void;
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

  const fee = selected?.feeBreakdown;
  const currency = orderCurrency(selected);
  const listingRegion = orderRegion(selected);
  const subtotal = fee?.subtotal ?? selected?.subtotal ?? 0;
  const shipping = fee?.shippingCost ?? selected?.shippingCost ?? 0;
  const platformFee = fee?.platformFee ?? platformFeeOf(subtotal);
  const sellerPayout =
    fee?.sellerPayoutAmount ??
    selected?.payout?.amount ??
    sellerPayoutOf(subtotal, shipping);

  return createPortal(
    <div
      className={cn(
        "flex items-end justify-center sm:items-center sm:p-6",
        open ? "pointer-events-auto" : "pointer-events-none"
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
          open ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex max-h-[min(92dvh,900px)] w-full max-w-lg flex-col",
          "rounded-t-3xl border border-white/10 bg-[#0A0D12] shadow-[0_40px_100px_rgba(0,0,0,0.7)] sm:rounded-3xl",
          "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-10 scale-[0.97] opacity-0"
        )}
      >
        <div className="h-[2px] shrink-0 bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />
        <div className="flex h-12 shrink-0 items-center justify-between px-4 sm:px-5">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[#00E575]">
              ORDER
            </p>
            <p className="font-mono text-sm font-semibold tracking-wide text-[#00E575]">
              {formatPlz(selected)}
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
          {detailLoading && !selected ? (
            <OrbLoader label="Loading order" />
          ) : !selected ? null : (
            <div className="space-y-6">
              {detailLoading && (
                <p className="text-xs text-white/35">Refreshing detail…</p>
              )}

              <div className="flex flex-wrap gap-1.5">
                <Badge tone={statusTone(selected.orderStatus)}>
                  {selected.orderStatus || "—"}
                </Badge>
                <Badge tone={payTone(selected.paymentStatus)}>
                  {selected.paymentStatus || "—"}
                </Badge>
                {selected.paymentLifecycle ? (
                  <Badge tone={lifecycleTone(selected.paymentLifecycle)}>
                    {lifecycleLabel(selected.paymentLifecycle)}
                  </Badge>
                ) : null}
                <Badge tone="blue">{listingRegion}</Badge>
                <Badge tone="neutral">{currency}</Badge>
                {selected.paymentMethod ? (
                  <Badge tone="neutral">{selected.paymentMethod}</Badge>
                ) : null}
              </div>

              <div className="rounded-2xl border border-[#00E575]/25 bg-[#00E575]/[0.06] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  Amount charged (frozen at checkout)
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-[#00E575]">
                  {fmtMoney(chargedTotal(selected), currency)}
                </p>
                <p className="mt-1.5 text-[12px] text-white/50">
                  Listed in{" "}
                  <span className="font-semibold text-white/80">
                    {listingRegion}
                  </span>
                  {listingRegion !== "—" ? ` · ${regionLabel(listingRegion)}` : ""}
                  {" · paid as "}
                  <span className="font-semibold text-white/80">{currency}</span>
                </p>
                <p className="mt-1 text-[11px] text-white/35">
                  No live conversion. These are the listing amounts locked when
                  the order was created.
                </p>
              </div>

              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                <SectionLabel>
                  <span className="inline-flex items-center gap-1.5">
                    <Banknote className="h-3 w-3" /> Payment & fees (8%)
                  </span>
                </SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                      Subtotal
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">
                      {fmtMoney(subtotal, currency)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                      Shipping
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">
                      {fmtMoney(shipping, currency)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                      Platform fee 8%
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-[#00E575]">
                      {fmtMoney(platformFee, currency)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                      Seller payout
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">
                      {fmtMoney(sellerPayout, currency)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                <SectionLabel>
                  <span className="inline-flex items-center gap-1.5">
                    <Package className="h-3 w-3" /> Items (listed & paid)
                  </span>
                </SectionLabel>
                <div className="space-y-2">
                  {(selected.items || []).map((it, idx) => {
                    const reg = itemRegion(it, selected);
                    const cur = itemCurrency(it, selected);
                    const unit = itemUnitPrice(it);
                    const line = itemLineTotal(it);
                    const qty = Math.max(1, Number(it.quantity) || 1);
                    const live =
                      typeof it.product === "object"
                        ? Number(it.product?.price)
                        : NaN;
                    const liveReg =
                      typeof it.product === "object"
                        ? asRegionCode(it.product?.region)
                        : "";
                    const img =
                      it.image ||
                      (typeof it.product === "object"
                        ? it.product?.images?.[0]
                        : undefined);
                    return (
                      <div
                        key={idx}
                        className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={img}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {it.name ||
                              (typeof it.product === "object"
                                ? it.product?.name
                                : "Item")}
                          </p>
                          <p className="mt-0.5 text-[11px] text-white/40">
                            Qty {qty} · listed unit{" "}
                            <span className="tabular-nums text-white/70">
                              {fmtMoney(unit, cur)}
                            </span>
                          </p>
                          {Number.isFinite(live) &&
                            live > 0 &&
                            Math.abs(live - unit) > 0.009 && (
                              <p className="mt-0.5 text-[11px] text-white/30">
                                Current listing{" "}
                                {fmtMoney(
                                  live,
                                  currencyForRegion(liveReg) || cur
                                )}
                                {liveReg ? ` · ${liveReg}` : ""}
                              </p>
                            )}
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <span className="rounded border border-white/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/55">
                              {reg}
                            </span>
                            <span className="rounded border border-white/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/55">
                              {cur}
                            </span>
                            {reg !== "—" && (
                              <span className="rounded border border-white/12 px-1.5 py-0.5 text-[10px] text-white/40">
                                {regionLabel(reg)}
                              </span>
                            )}
                          </div>
                          {it.note ? (
                            <p className="mt-1 text-[11px] text-white/35">
                              Note: {it.note}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums text-[#00E575]">
                            {fmtMoney(line, cur)}
                          </p>
                          <p className="text-[10px] text-white/35">paid</p>
                        </div>
                      </div>
                    );
                  })}
                  {!(selected.items || []).length && (
                    <p className="text-sm text-white/40">No line items</p>
                  )}
                </div>
              </div>

              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                <SectionLabel>Order flow</SectionLabel>
                <OrderFlow order={selected} />
              </div>

              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                <SectionLabel>
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-3 w-3" /> Buyer
                  </span>
                </SectionLabel>
                <Field label="Name">
                  {selected.buyer?.name ||
                    selected.buyerContact?.name ||
                    "—"}
                </Field>
                <Field label="Email">{selected.buyer?.email || "—"}</Field>
                <Field label="Phone">
                  {selected.buyer?.phone ||
                    selected.buyerContact?.phone ||
                    "—"}
                </Field>
                {selected.buyer?._id && (
                  <Link
                    href={`/users?userId=${encodeURIComponent(selected.buyer._id)}`}
                    className="text-xs text-[#00E575] hover:underline"
                  >
                    Open buyer
                  </Link>
                )}
              </div>

              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                <SectionLabel>
                  <span className="inline-flex items-center gap-1.5">
                    <Store className="h-3 w-3" /> Seller
                  </span>
                </SectionLabel>
                <Field label="Store">
                  {selected.seller?.storeName || selected.seller?.name || "—"}
                </Field>
                <Field label="Email">{selected.seller?.email || "—"}</Field>
                {selected.seller?.isSellerSuspended && (
                  <Badge tone="error">Seller suspended</Badge>
                )}
                {selected.seller?._id && (
                  <Link
                    href={`/users?userId=${encodeURIComponent(selected.seller._id)}&role=seller`}
                    className="text-xs text-[#00E575] hover:underline"
                  >
                    Open seller
                  </Link>
                )}
              </div>

              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                <SectionLabel>Ship to</SectionLabel>
                <Field label="Address">
                  {[
                    selected.shippingAddress?.street,
                    selected.shippingAddress?.city,
                    selected.shippingAddress?.state,
                    selected.shippingAddress?.zipCode,
                    selected.shippingAddress?.country,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </Field>
              </div>

              {selected.cancellation && (
                <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                  <p className="font-semibold">Cancellation</p>
                  <p className="text-xs opacity-90">
                    By {selected.cancellation.cancelledBy || "—"}
                    {selected.cancellation.reasonLabel
                      ? ` · ${selected.cancellation.reasonLabel}`
                      : ""}
                  </p>
                  {selected.cancellation.refundStatus &&
                    selected.cancellation.refundStatus !==
                      "not_applicable" && (
                      <p className="text-xs">
                        Refund: {selected.cancellation.refundStatus}
                      </p>
                    )}
                </div>
              )}

              <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-4">
                <SectionLabel>
                  <span className="inline-flex items-center gap-1.5">
                    <Shield className="h-3 w-3" /> Admin actions
                  </span>
                </SectionLabel>
                {actionMsg && (
                  <p className="text-xs text-white/50">{actionMsg}</p>
                )}
                <Button
                  className="h-11 rounded-xl"
                  disabled={actionBusy}
                  onClick={onRefund}
                >
                  <Scale className="mr-2 h-3.5 w-3.5" />
                  {actionBusy ? "Working…" : "Refund buyer"}
                </Button>
                <Button
                  tone="ghost"
                  className="h-11 rounded-xl border border-white/12"
                  disabled={actionBusy}
                  onClick={onSellerFavour}
                >
                  Settle seller favour
                </Button>
              </div>

              <div className="space-y-1 border-t border-white/[0.06] pt-4 text-[11px] text-white/35">
                <p className="font-mono">ID {selected._id}</p>
                <p>Placed {fmtDate(selected.createdAt)}</p>
                <p>Updated {fmtDate(selected.updatedAt)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function OrdersDirectory() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const deepOrderId =
    searchParams.get("orderId") || searchParams.get("id") || "";

  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<OrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>({
    all: 0,
    Preparing: 0,
    Shipped: 0,
    Delivered: 0,
    Cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [lifecycle, setLifecycle] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState<"list" | "grid">("list");
  const [openId, setOpenId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [online, setOnline] = useState(true);
  const [stale, setStale] = useState(false);

  const cacheRef = useRef<{
    items: OrderRow[];
    counts: Counts;
    total: number;
    pages: number;
    page: number;
  } | null>(null);
  const deepOpened = useRef(false);

  const showOffline = !online;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const load = useCallback(
    async (p = 1) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (cacheRef.current) {
          setItems(cacheRef.current.items);
          setCounts(cacheRef.current.counts);
          setTotal(cacheRef.current.total);
          setPages(cacheRef.current.pages);
          setPage(cacheRef.current.page);
          setStale(true);
          setError(
            "You’re offline — showing last successful load. Reconnect to refresh."
          );
          setLoading(false);
          return;
        }
        setError("You’re offline. Connect to load orders.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        setStale(false);
        const token = await getToken();
        if (!token) {
          setError("Session expired. Sign in again.");
          setLoading(false);
          return;
        }

        const params = new URLSearchParams({
          page: String(p),
          limit: "20",
        });
        if (status) params.set("status", status);
        if (payment) params.set("payment", payment);
        if (lifecycle) params.set("lifecycle", lifecycle);
        if (city.trim()) params.set("city", city.trim());
        if (q.trim()) params.set("q", q.trim());

        const json = await adminFetch<any>(`/admin/orders?${params}`, token);
        const nextItems: OrderRow[] = parseOrdersList(json);
        const nextTotal = Number(
          json?.pagination?.total ?? json?.total ?? nextItems.length
        );
        const nextPages = Number(json?.pagination?.pages || 1);
        const nextPage = Number(json?.pagination?.page || p);

        const nextCounts: Counts = json?.counts || {
          all: nextTotal,
          Preparing: nextItems.filter((o) => o.orderStatus === "Preparing")
            .length,
          Shipped: nextItems.filter((o) => o.orderStatus === "Shipped")
            .length,
          Delivered: nextItems.filter((o) => o.orderStatus === "Delivered")
            .length,
          Cancelled: nextItems.filter((o) => o.orderStatus === "Cancelled")
            .length,
        };
        if (!json?.counts) nextCounts.all = nextTotal;

        setItems(nextItems);
        setCounts(nextCounts);
        setTotal(nextTotal);
        setPages(nextPages);
        setPage(nextPage);

        cacheRef.current = {
          items: nextItems,
          counts: nextCounts,
          total: nextTotal,
          pages: nextPages,
          page: nextPage,
        };
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "message" in e
            ? String((e as { message?: string }).message)
            : "Failed to load orders";
        if (cacheRef.current) {
          setItems(cacheRef.current.items);
          setCounts(cacheRef.current.counts);
          setTotal(cacheRef.current.total);
          setPages(cacheRef.current.pages);
          setPage(cacheRef.current.page);
          setStale(true);
          setError(`${msg} — showing last successful load.`);
        } else {
          setError(msg);
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [getToken, status, payment, lifecycle, city, q]
  );

  useEffect(() => {
    if (!mounted) return;
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, status, payment, lifecycle]);

  const openModal = useCallback(
    async (row: OrderRow | { _id: string }) => {
      setOpenId(row._id);
      if ("orderNumber" in row || "items" in row) {
        setSelected(row as OrderRow);
      }
      setModalOpen(true);
      setActionMsg("");
      if (showOffline) return;
      try {
        setDetailLoading(true);
        const token = await getToken();
        const json = await adminFetch<any>(
          `/admin/orders/${row._id}`,
          token
        );
        const detail = parseOrderDetail(json);
        if (detail && detail._id) setSelected(detail);
      } catch {
        /* keep list row */
      } finally {
        setDetailLoading(false);
      }
    },
    [getToken, showOffline]
  );

  useEffect(() => {
    if (!mounted || !deepOrderId || deepOpened.current) return;
    deepOpened.current = true;
    void openModal({ _id: deepOrderId });
  }, [mounted, deepOrderId, openModal]);

  const closeModal = () => {
    setModalOpen(false);
    window.setTimeout(() => {
      setOpenId(null);
      setSelected(null);
      setActionMsg("");
    }, 280);
  };

  const runAdminAction = async (
    path: string,
    body?: Record<string, unknown>
  ) => {
    if (!selected?._id) return;
    try {
      setActionBusy(true);
      setActionMsg("");
      const token = await getToken();
      try {
        await adminFetch(path, token, {
          method: "POST",
          body: JSON.stringify(body || {}),
        });
      } catch {
        const alt =
          path.includes("/refund")
            ? `/payments/admin/disputes/${selected._id}/refund-buyer`
            : `/payments/admin/disputes/${selected._id}/settle-seller`;
        await adminFetch(alt, token, {
          method: "POST",
          body: JSON.stringify(body || {}),
        });
      }
      setActionMsg("Action completed");
      await openModal(selected);
      await load(page);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : "Action failed";
      setActionMsg(msg);
    } finally {
      setActionBusy(false);
    }
  };

  const filtersActive = !!(
    status ||
    payment ||
    lifecycle ||
    city.trim() ||
    q.trim()
  );

  const sortedItems = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      if (sort === "oldest") {
        return (
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime()
        );
      }
      if (sort === "totalHigh") {
        return chargedTotal(b) - chargedTotal(a);
      }
      if (sort === "totalLow") {
        return chargedTotal(a) - chargedTotal(b);
      }
      return (
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
      );
    });
    return list;
  }, [items, sort]);

  return (
    <div className="relative mx-auto max-w-6xl pb-24 text-[#F5F7FA]">
      {showOffline && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">You’re offline</p>
            <p className="mt-0.5 text-xs text-amber-100/80">
              Order search needs a connection.
              {stale
                ? " Showing the last list we loaded."
                : " Reconnect to load orders."}
            </p>
          </div>
        </div>
      )}

      <header className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
              COMMERCE
            </p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight sm:text-[32px]">
              Orders
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] text-white/50">
              Amounts are frozen at checkout in the listing region currency
              (US → USD, DE → EUR, NG → NGN). Nothing is live-converted.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/35">
              {total.toLocaleString()} order{total === 1 ? "" : "s"}
              {stale ? " · cached" : ""}
            </span>
            <Button
              tone="ghost"
              className="h-10 shrink-0 gap-2 rounded-full border border-white/12 bg-[#14181F] text-xs"
              onClick={() => void load(page)}
              disabled={loading || showOffline}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", loading && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(
          [
            ["All", "", counts.all],
            ["Preparing", "Preparing", counts.Preparing],
            ["Shipped", "Shipped", counts.Shipped],
            ["Delivered", "Delivered", counts.Delivered],
            ["Cancelled", "Cancelled", counts.Cancelled],
          ] as const
        ).map(([label, value, n]) => (
          <button
            key={label}
            type="button"
            onClick={() => setStatus(value)}
            className={cn(
              "rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3.5 text-left transition sm:px-4",
              status === value &&
                "border-[#00E575]/40 bg-[#00E575]/[0.08] ring-1 ring-[#00E575]/25"
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              {label}
            </p>
            <p className="mt-1.5 text-[22px] font-semibold tabular-nums leading-none">
              {Number(n).toLocaleString()}
            </p>
          </button>
        ))}
      </div>

      <Panel className="mb-4 flex flex-col gap-3 rounded-2xl border-white/[0.08] bg-white/[0.03] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <DarkInput
            placeholder="Search PLZ#48291, buyer, seller, city…"
            value={q}
            onChange={setQ}
            onKeyDown={(e) =>
              e.key === "Enter" && !showOffline && void load(1)
            }
            className="sm:max-w-md"
            disabled={showOffline && !cacheRef.current}
          />
          <Button
            onClick={() => void load(1)}
            disabled={loading || showOffline}
            className="h-10 rounded-xl text-xs"
          >
            {loading ? "Searching…" : "Search"}
          </Button>
          <div className="flex gap-1 rounded-xl border border-white/12 sm:ml-auto">
            <button
              type="button"
              aria-label="List view"
              onClick={() => setView("list")}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-l-xl transition",
                view === "list"
                  ? "bg-[#00E575] text-[#041412]"
                  : "text-white/50 hover:text-white"
              )}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => setView("grid")}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-r-xl transition",
                view === "grid"
                  ? "bg-[#00E575] text-[#041412]"
                  : "text-white/50 hover:text-white"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <DarkSelect value={status} onChange={setStatus}>
            <option value="">All statuses</option>
            <option value="Preparing">Preparing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </DarkSelect>
          <DarkSelect value={payment} onChange={setPayment}>
            <option value="">All payments</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </DarkSelect>
          <DarkSelect value={lifecycle} onChange={setLifecycle}>
            <option value="">All lifecycles</option>
            <option value="PENDING_PAYMENT">Pending payment</option>
            <option value="PAYMENT_PROTECTED">Protected</option>
            <option value="DISPUTED">Disputed</option>
            <option value="DELIVERY_CONFIRMED">Delivery confirmed</option>
            <option value="SELLER_PAID">Seller paid</option>
            <option value="REFUNDED">Refunded</option>
            <option value="SETTLED_SELLER_FAVOUR">Seller favour</option>
          </DarkSelect>
          <DarkInput
            placeholder="Ship-to city…"
            value={city}
            onChange={setCity}
            onKeyDown={(e) => e.key === "Enter" && void load(1)}
          />
          <DarkSelect value={sort} onChange={setSort}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="totalHigh">Total high → low</option>
            <option value="totalLow">Total low → high</option>
          </DarkSelect>
        </div>
        {filtersActive && (
          <Button
            tone="ghost"
            className="h-9 self-start rounded-xl text-xs"
            onClick={() => {
              setStatus("");
              setPayment("");
              setLifecycle("");
              setCity("");
              setQ("");
              setSort("newest");
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
          <OrbLoader label="Loading orders" />
        </div>
      ) : sortedItems.length === 0 ? (
        <EmptyState
          title="No orders found"
          body={
            showOffline
              ? "Connect to the internet to load orders."
              : "Try another PLZ# code or clear filters."
          }
        />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedItems.map((o) => {
            const plz = formatPlz(o);
            const active = openId === o._id && modalOpen;
            const cur = orderCurrency(o);
            const reg = orderRegion(o);
            return (
              <button
                key={o._id}
                type="button"
                onClick={() => void openModal(o)}
                className={cn(
                  "rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition hover:border-[#00E575]/35",
                  active && "border-[#00E575]/45 bg-[#00E575]/[0.06]"
                )}
              >
                <p className="font-mono text-sm font-semibold tracking-wide text-[#00E575]">
                  {plz}
                </p>
                <p className="mt-2 truncate text-sm font-medium">
                  {o.buyer?.name || o.buyerContact?.name || "Buyer"}
                </p>
                <p className="truncate text-xs text-white/40">
                  {o.seller?.storeName || o.seller?.name || "Seller"}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={statusTone(o.orderStatus)}>
                    {o.orderStatus || "—"}
                  </Badge>
                  <Badge tone={payTone(o.paymentStatus)}>
                    {o.paymentStatus || "—"}
                  </Badge>
                  {o.paymentLifecycle ? (
                    <Badge tone={lifecycleTone(o.paymentLifecycle)}>
                      {lifecycleLabel(o.paymentLifecycle)}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-white/40">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 rounded border border-white/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/55">
                      {reg}
                    </span>
                    <span className="truncate">
                      {o.shippingAddress?.city || "—"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums text-[#F5F7FA]">
                      {fmtMoney(chargedTotal(o), cur)}
                    </span>
                    <span className="text-[10px] text-white/35">{cur}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.03]">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.12em] text-white/40">
              <tr>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Buyer</th>
                <th className="px-4 py-3 font-semibold">Seller</th>
                <th className="px-4 py-3 font-semibold">Ship to</th>
                <th className="px-4 py-3 font-semibold">Listed / paid</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Lifecycle</th>
                <th className="px-4 py-3 font-semibold">Total paid</th>
                <th className="px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((o) => {
                const plz = formatPlz(o);
                const active = openId === o._id && modalOpen;
                const cur = orderCurrency(o);
                const reg = orderRegion(o);
                return (
                  <tr
                    key={o._id}
                    onClick={() => void openModal(o)}
                    className={cn(
                      "cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.04]",
                      active && "bg-[#00E575]/[0.06]"
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono text-[13px] font-semibold tracking-wide text-[#00E575]">
                        {plz}
                      </p>
                      <p className="text-[10px] text-white/35">
                        {o.items?.length || 0} item
                        {(o.items?.length || 0) === 1 ? "" : "s"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate">
                        {o.buyer?.name || o.buyerContact?.name || "—"}
                      </p>
                      <p className="truncate text-xs text-white/35">
                        {o.buyer?.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate">
                        {o.seller?.storeName || o.seller?.name || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-white/50">
                      {o.shippingAddress?.city || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md border border-white/12 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/55">
                        {reg}
                      </span>
                      <p className="mt-1 text-[10px] text-white/35">
                        {cur}
                        {reg !== "—" ? ` · ${regionLabel(reg)}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(o.orderStatus)}>
                        {o.orderStatus || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={payTone(o.paymentStatus)}>
                        {o.paymentStatus || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={lifecycleTone(o.paymentLifecycle)}>
                        {lifecycleLabel(o.paymentLifecycle)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold tabular-nums">
                        {fmtMoney(chargedTotal(o), cur)}
                      </p>
                      <p className="text-[10px] text-white/35">{cur}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/45">
                      {fmtDate(o.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            tone="ghost"
            className="h-9 rounded-xl text-xs"
            disabled={page <= 1 || loading || showOffline}
            onClick={() => void load(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-white/40">
            Page {page} of {pages}
          </span>
          <Button
            tone="ghost"
            className="h-9 rounded-xl text-xs"
            disabled={page >= pages || loading || showOffline}
            onClick={() => void load(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <OrderModal
        open={modalOpen}
        onClose={closeModal}
        selected={selected}
        detailLoading={detailLoading}
        actionBusy={actionBusy}
        actionMsg={actionMsg}
        onRefund={() =>
          void runAdminAction(`/admin/orders/${selected?._id}/refund`, {
            reason: "admin_buyer_refund",
          })
        }
        onSellerFavour={() =>
          void runAdminAction(
            `/admin/orders/${selected?._id}/settle-seller`,
            { reason: "admin_seller_favour" }
          )
        }
      />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <OrdersGate>
      <OrdersDirectory />
    </OrdersGate>
  );
}