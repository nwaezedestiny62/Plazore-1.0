"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Database,
  LayoutGrid,
  List,
  Lock,
  MessageCircle,
  RefreshCw,
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
  Input,
  Panel,
  cn,
} from "@/components/ui";

const GATE_KEY = "plazore.admin.contactsGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_CONTACTS_PASSWORD || "";
const Z_MODAL = 9999;

type EnvKind = "development" | "production" | "unknown";

type RelatedOrder = {
  _id?: string;
  orderNumber?: string;
  orderStatus?: string;
  totalAmount?: number;
  subtotal?: number;
  shippingCost?: number;
  paymentStatus?: string;
  paymentLifecycle?: string;
  region?: string;
  currency?: string;
  feeBreakdown?: {
    currency?: string;
    region?: string;
    platformFee?: number;
    sellerPayoutAmount?: number;
    grossAmount?: number;
    subtotal?: number;
    shippingCost?: number;
  };
  items?: Array<{ region?: string; currency?: string; price?: number }>;
  deliveredAt?: string;
  buyerConfirmation?: {
    status?: "none" | "pending" | "confirmed" | "issue_reported";
    confirmedAt?: string;
    issueReportedAt?: string;
  };
  payout?: {
    status?: string;
    eligibleAt?: string;
    blockedReason?: string;
    amount?: number;
  };
};

type ContactRow = {
  _id: string;
  contactAs?: string;
  contextType?: string;
  category?: string;
  subject?: string;
  email?: string;
  message?: string;
  status?: string;
  priority?: string;
  allowsReply?: boolean;
  unreadByAdmin?: boolean;
  lastMessageAt?: string;
  createdAt?: string;
  location?: {
    country?: string;
    state?: string;
    city?: string;
    street?: string;
  };
  user?: {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
    storeName?: string;
    marketplaceRegion?: string;
    phone?: string;
  };
  relatedProduct?: { _id?: string; name?: string; images?: string[] };
  relatedSeller?: {
    _id?: string;
    name?: string;
    storeName?: string;
    email?: string;
    marketplaceRegion?: string;
  };
  relatedOrder?: RelatedOrder;
  assignedAdmin?: { _id?: string; name?: string; email?: string };
  messages?: Array<{
    _id?: string;
    senderType?: string;
    body?: string;
    createdAt?: string;
    sender?: { name?: string };
  }>;
  responses?: Array<{
    body?: string;
    createdAt?: string;
    admin?: { name?: string };
  }>;
  internalNotes?: Array<{
    body?: string;
    createdAt?: string;
    admin?: { name?: string };
  }>;
};

type Counts = {
  all: number;
  new: number;
  open: number;
  awaiting_user: number;
  awaiting_plazore: number;
  resolved: number;
  closed: number;
  unread: number;
  high: number;
};

type ThreadMsg = {
  who: string;
  body: string;
  at?: string;
  side: "user" | "admin";
};

/** Exact match of server/config/payment.ts */
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
  US: "United States",
  GB: "United Kingdom",
  UK: "United Kingdom",
  DE: "Germany",
  FR: "France",
  CA: "Canada",
  KE: "Kenya",
  ZA: "South Africa",
  EU: "Europe",
  AU: "Australia",
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

function norm(s?: string | null) {
  return String(s || "")
    .trim()
    .toUpperCase();
}

function isIsoCurrency(s?: string | null) {
  const v = norm(s);
  return v.length === 3 && /^[A-Z]{3}$/.test(v);
}

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

function orderRegion(o?: RelatedOrder | null): string {
  if (!o) return "—";
  return (
    asRegionCode(o.feeBreakdown?.region) ||
    asRegionCode(o.region) ||
    asRegionCode(o.items?.[0]?.region) ||
    "—"
  );
}

/** Frozen checkout currency — never live FX. */
function orderCurrency(o?: RelatedOrder | null): string {
  if (!o) return "NGN";
  const frozen = pickCurrency(
    o.feeBreakdown?.currency,
    o.currency,
    o.items?.[0]?.currency
  );
  if (frozen) return frozen;
  const mapped = currencyForRegion(orderRegion(o));
  if (mapped) return mapped;
  return "NGN";
}

function regionLabel(code?: string) {
  const k = asRegionCode(code) || norm(code);
  if (!k || k === "—") return "";
  return REGION_NAME[k] || "";
}

function fmtMoney(n?: number, currency = "NGN") {
  const v = Number(n || 0);
  const cur =
    pickCurrency(currency) || currencyForRegion(currency) || "NGN";
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

function chargedTotal(o?: RelatedOrder | null) {
  if (!o) return 0;
  const g = Number(o.feeBreakdown?.grossAmount);
  if (Number.isFinite(g) && g > 0) return g;
  return Number(o.totalAmount || 0);
}

function fmt(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function parseContactDetail(json: unknown): ContactRow | null {
  if (!json || typeof json !== "object") return null;
  const body = json as Record<string, unknown>;
  if (typeof body._id === "string") return body as unknown as ContactRow;
  const data = body.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    if (typeof d._id === "string") return d as unknown as ContactRow;
  }
  return null;
}

function parseContactsList(json: any): ContactRow[] {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.contacts)) return json.contacts;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json)) return json;
  return [];
}

function statusTone(
  s?: string
): "green" | "error" | "blue" | "warn" | "neutral" {
  if (s === "resolved") return "green";
  if (s === "closed") return "neutral";
  if (s === "new") return "blue";
  if (s === "awaiting_user") return "warn";
  if (s === "awaiting_plazore") return "blue";
  if (s === "open" || s === "in_progress") return "warn";
  return "neutral";
}

function isDeliveryIssue(row: ContactRow) {
  return (
    row.contextType === "order" ||
    row.category === "delivery" ||
    row.category === "order_payment" ||
    !!row.relatedOrder
  );
}

function DarkSelect({
  value,
  onChange,
  children,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{ colorScheme: "dark" }}
      className={cn(
        "h-10 w-full rounded-xl border border-white/12 bg-[#14181F] px-3 text-[13px] text-[#F5F7FA] outline-none focus:border-[#00E575]/40 disabled:opacity-50",
        className
      )}
    >
      {children}
    </select>
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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
      {children}
    </p>
  );
}

function ContactsGate({ children }: { children: ReactNode }) {
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
      setErr("Set NEXT_PUBLIC_ADMIN_CONTACTS_PASSWORD in .env");
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
          <h1 className="mt-2 text-2xl font-semibold">Contact</h1>
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

function ContactModal({
  open,
  onClose,
  selected,
  detailLoading,
  reply,
  setReply,
  note,
  setNote,
  busy,
  resolveBusy,
  showOffline,
  canReply,
  thread,
  order,
  confStatus,
  payoutStatus,
  isIssueOpen,
  actionMsg,
  onPatch,
  onResolveDelivery,
}: {
  open: boolean;
  onClose: () => void;
  selected: ContactRow | null;
  detailLoading: boolean;
  reply: string;
  setReply: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  busy: boolean;
  resolveBusy: boolean;
  showOffline: boolean;
  canReply: boolean;
  thread: ThreadMsg[];
  order: RelatedOrder | undefined;
  confStatus?: string;
  payoutStatus?: string;
  isIssueOpen: boolean;
  actionMsg: string;
  onPatch: (body: Record<string, unknown>) => void;
  onResolveDelivery: (
    action: "refund_buyer" | "seller_favour" | "authorize_payout"
  ) => void;
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

  const cur = orderCurrency(order);
  const listingReg = orderRegion(order);
  const country = regionLabel(listingReg);

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
          "relative z-10 flex max-h-[min(92dvh,920px)] w-full max-w-lg flex-col",
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
              CONVERSATION
            </p>
            <p className="text-sm font-medium text-white/80">
              Support workspace
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
          {detailLoading && !selected && (
            <OrbLoader label="Loading conversation" />
          )}
          {selected && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={statusTone(selected.status)}>
                  {selected.status}
                </Badge>
                <Badge tone="neutral">{selected.contactAs}</Badge>
                <Badge tone="neutral">
                  {selected.contextType || "general"}
                </Badge>
                {selected.allowsReply === false && (
                  <Badge tone="neutral">No reply</Badge>
                )}
                {isDeliveryIssue(selected) && (
                  <Badge tone="warn">Delivery issue</Badge>
                )}
                {selected.priority && (
                  <Badge
                    tone={
                      selected.priority === "critical"
                        ? "error"
                        : selected.priority === "high"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {selected.priority}
                  </Badge>
                )}
              </div>

              {!canReply && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/50">
                  One-way message from Plazore. The user can read this thread
                  but cannot text back.
                </div>
              )}

              <div className="space-y-2">
                <SectionLabel>User</SectionLabel>
                <Field label="Name">{selected.user?.name || "—"}</Field>
                <Field label="Email">
                  {selected.email || selected.user?.email || "—"}
                </Field>
                {selected.user?._id && (
                  <Link
                    href={`/users?userId=${selected.user._id}&role=${selected.contactAs || "buyer"}`}
                    className="inline-flex text-xs font-medium text-[#00E575] hover:underline"
                  >
                    Open on Users
                  </Link>
                )}
              </div>

              {(selected.relatedProduct ||
                selected.relatedSeller ||
                selected.relatedOrder) && (
                <div className="space-y-2 border-t border-white/[0.06] pt-4">
                  <SectionLabel>Context</SectionLabel>
                  {selected.relatedProduct && (
                    <Field label="Product">
                      {selected.relatedProduct.name || "—"}
                      {selected.relatedProduct._id && (
                        <div>
                          <Link
                            href={`/products?productId=${encodeURIComponent(selected.relatedProduct._id)}`}
                            className="text-xs text-[#00E575] hover:underline"
                          >
                            View product
                          </Link>
                        </div>
                      )}
                    </Field>
                  )}
                  {selected.relatedSeller && (
                    <Field label="Store">
                      {selected.relatedSeller.storeName ||
                        selected.relatedSeller.name ||
                        "—"}
                      {selected.relatedSeller._id && (
                        <div>
                          <Link
                            href={`/users?userId=${selected.relatedSeller._id}&role=seller`}
                            className="text-xs text-[#00E575] hover:underline"
                          >
                            Open seller
                          </Link>
                        </div>
                      )}
                    </Field>
                  )}
                  {selected.relatedOrder && (
                    <Field label="Order">
                      <span className="font-mono text-[#00E575]">
                        {selected.relatedOrder.orderNumber ||
                          selected.relatedOrder._id ||
                          "—"}
                      </span>
                      {selected.relatedOrder._id && (
                        <div>
                          <Link
                            href={`/orders?orderId=${encodeURIComponent(selected.relatedOrder._id)}`}
                            className="text-xs text-[#00E575] hover:underline"
                          >
                            Open order
                          </Link>
                        </div>
                      )}
                    </Field>
                  )}
                </div>
              )}

              {isDeliveryIssue(selected) && (
                <div className="space-y-3 border-t border-white/[0.06] pt-4">
                  <SectionLabel>Delivery confirmation & payout</SectionLabel>

                  {order ? (
                    <div className="space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="neutral">
                          Status: {order.orderStatus || "—"}
                        </Badge>
                        <Badge
                          tone={
                            confStatus === "confirmed"
                              ? "green"
                              : confStatus === "issue_reported"
                                ? "error"
                                : confStatus === "pending"
                                  ? "warn"
                                  : "neutral"
                          }
                        >
                          Confirm: {confStatus || "none"}
                        </Badge>
                        <Badge
                          tone={
                            payoutStatus === "eligible" ||
                            payoutStatus === "completed"
                              ? "green"
                              : payoutStatus === "blocked_issue"
                                ? "error"
                                : "warn"
                          }
                        >
                          Payout: {payoutStatus || "—"}
                        </Badge>
                        <Badge tone="blue">{listingReg}</Badge>
                        <Badge tone="neutral">{cur}</Badge>
                      </div>

                      <div className="rounded-xl border border-[#00E575]/25 bg-[#00E575]/[0.06] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                          Order total (as charged)
                        </p>
                        <p className="mt-1 text-xl font-semibold tabular-nums text-[#00E575]">
                          {fmtMoney(chargedTotal(order), cur)}
                        </p>
                        <p className="mt-1 text-[11px] text-white/40">
                          Listed {listingReg}
                          {country ? ` · ${country}` : ""} · paid as {cur}
                          {order.feeBreakdown?.platformFee != null && (
                            <>
                              {" · Fee 8% "}
                              {fmtMoney(order.feeBreakdown.platformFee, cur)}
                            </>
                          )}
                          {order.feeBreakdown?.sellerPayoutAmount != null && (
                            <>
                              {" · Seller "}
                              {fmtMoney(
                                order.feeBreakdown.sellerPayoutAmount,
                                cur
                              )}
                            </>
                          )}
                        </p>
                      </div>

                      <p className="text-xs text-white/50">
                        Delivered: {fmt(order.deliveredAt)} · Payment:{" "}
                        {order.paymentStatus || "—"}
                      </p>
                      {order.payout?.blockedReason && (
                        <p className="text-xs text-amber-200/90">
                          {order.payout.blockedReason}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-white/35">
                      Order context is linked. Open the order for full details.
                    </p>
                  )}

                  {isIssueOpen && selected.status !== "resolved" && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Seller payout is blocked while this issue is open.
                      </span>
                    </div>
                  )}

                  {actionMsg && (
                    <p className="text-xs text-white/55">{actionMsg}</p>
                  )}

                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      tone="ghost"
                      className="justify-start rounded-xl border border-amber-500/30 text-amber-200"
                      disabled={
                        resolveBusy ||
                        showOffline ||
                        selected.status === "resolved" ||
                        !order?._id
                      }
                      onClick={() => onResolveDelivery("seller_favour")}
                    >
                      {resolveBusy
                        ? "Working…"
                        : "Resolve in seller’s favour"}
                    </Button>
                    <Button
                      tone="ghost"
                      className="justify-start rounded-xl border border-[#00E575]/30 text-[#00E575]"
                      disabled={
                        resolveBusy ||
                        showOffline ||
                        selected.status === "resolved" ||
                        !order?._id
                      }
                      onClick={() => onResolveDelivery("authorize_payout")}
                    >
                      {resolveBusy ? "Working…" : "Authorize seller payout"}
                    </Button>
                    <Button
                      tone="ghost"
                      className="justify-start rounded-xl border border-red-500/30 text-red-300"
                      disabled={
                        resolveBusy ||
                        showOffline ||
                        selected.status === "resolved" ||
                        !order?._id
                      }
                      onClick={() => onResolveDelivery("refund_buyer")}
                    >
                      {resolveBusy ? "Working…" : "Refund buyer"}
                    </Button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-white/30">
                    Refund / seller favour call the payment APIs
                    (`/admin/orders/…` then `/payments/admin/disputes/…`), then
                    mark this ticket resolved. Amounts stay in the charged
                    currency.
                  </p>
                </div>
              )}

              {selected.location && (
                <div className="space-y-2 border-t border-white/[0.06] pt-4">
                  <SectionLabel>Location</SectionLabel>
                  <Field label="Country">
                    {selected.location.country || "—"}
                  </Field>
                  <Field label="State">
                    {selected.location.state || "—"}
                  </Field>
                  <Field label="City">{selected.location.city || "—"}</Field>
                </div>
              )}

              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                <SectionLabel>Thread</SectionLabel>
                <div className="space-y-2">
                  {thread.length === 0 ? (
                    <p className="text-sm text-white/40">No messages yet.</p>
                  ) : (
                    thread.map((m, i) => (
                      <div
                        key={i}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-sm",
                          m.side === "admin"
                            ? "ml-4 border-[#00E575]/25 bg-[#00E575]/[0.06]"
                            : "mr-4 border-white/10 bg-white/[0.03]"
                        )}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                          {m.who}
                          {m.at ? ` · ${fmt(m.at)}` : ""}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-white/80">
                          {m.body}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {canReply && (
                <div className="space-y-2 border-t border-white/[0.06] pt-4">
                  <SectionLabel>Reply to user</SectionLabel>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    placeholder="Write a reply…"
                    disabled={busy || showOffline}
                    className="w-full rounded-xl border border-white/12 bg-[#14181F] px-3 py-2 text-sm text-[#F5F7FA] outline-none placeholder:text-white/30 focus:border-[#00E575]/40 disabled:opacity-50"
                  />
                  <Button
                    className="h-10 rounded-xl"
                    disabled={busy || showOffline || !reply.trim()}
                    onClick={() =>
                      onPatch({
                        response: reply.trim(),
                        status: "awaiting_user",
                      })
                    }
                  >
                    {busy ? "Sending…" : "Send reply"}
                  </Button>
                </div>
              )}

              <div className="space-y-2 border-t border-white/[0.06] pt-4">
                <SectionLabel>Internal note</SectionLabel>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Note for team only…"
                  disabled={busy || showOffline}
                  className="w-full rounded-xl border border-white/12 bg-[#14181F] px-3 py-2 text-sm text-[#F5F7FA] outline-none placeholder:text-white/30 focus:border-[#00E575]/40 disabled:opacity-50"
                />
                <Button
                  tone="ghost"
                  className="h-10 rounded-xl border border-white/12"
                  disabled={busy || showOffline || !note.trim()}
                  onClick={() => onPatch({ internalNote: note.trim() })}
                >
                  Save note
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                <Button
                  tone="ghost"
                  className="h-9 rounded-xl border border-white/12 text-xs"
                  disabled={busy || showOffline}
                  onClick={() => onPatch({ status: "resolved" })}
                >
                  Mark resolved
                </Button>
                <Button
                  tone="ghost"
                  className="h-9 rounded-xl border border-white/12 text-xs"
                  disabled={busy || showOffline}
                  onClick={() => onPatch({ status: "closed" })}
                >
                  Close
                </Button>
                <Button
                  tone="ghost"
                  className="h-9 rounded-xl border border-white/12 text-xs"
                  disabled={busy || showOffline}
                  onClick={() => onPatch({ status: "open" })}
                >
                  Reopen
                </Button>
              </div>

              {(selected.internalNotes || []).length > 0 && (
                <div className="space-y-2 border-t border-white/[0.06] pt-4">
                  <SectionLabel>Internal notes</SectionLabel>
                  {selected.internalNotes!.map((n, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-white/55"
                    >
                      <p className="text-white/35">
                        {n.admin?.name || "Admin"} · {fmt(n.createdAt)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1 border-t border-white/[0.06] pt-4 text-[11px] text-white/35">
                <p className="font-mono">ID {selected._id}</p>
                <p>Created {fmt(selected.createdAt)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ContactsDirectory() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const deepUserId = searchParams.get("userId") || "";
  const deepContactId =
    searchParams.get("contactId") || searchParams.get("id") || "";

  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<ContactRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>({
    all: 0,
    new: 0,
    open: 0,
    awaiting_user: 0,
    awaiting_plazore: 0,
    resolved: 0,
    closed: 0,
    unread: 0,
    high: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [contactAs, setContactAs] = useState("");
  const [category, setCategory] = useState("");
  const [contextType, setContextType] = useState("");
  const [priority, setPriority] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");
  const [openId, setOpenId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<ContactRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolveBusy, setResolveBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [online, setOnline] = useState(true);
  const [stale, setStale] = useState(false);

  const cacheRef = useRef<{
    items: ContactRow[];
    counts: Counts;
    total: number;
    pages: number;
    page: number;
  } | null>(null);
  const deepOpened = useRef(false);

  const env = detectEnvFromApi();
  const envLabel =
    env === "development"
      ? "Dev API"
      : env === "production"
        ? "Prod API"
        : "API";
  const envTone =
    env === "production"
      ? "green"
      : env === "development"
        ? "warn"
        : "neutral";
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
        }
        setError("You’re offline. Connect to load contacts.");
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
        if (contactAs) params.set("contactAs", contactAs);
        if (category) params.set("category", category);
        if (contextType) params.set("contextType", contextType);
        if (priority) params.set("priority", priority);
        if (unreadOnly) params.set("unread", "1");
        if (q.trim()) params.set("q", q.trim());
        if (deepUserId) params.set("userId", deepUserId);

        const json = await adminFetch<any>(`/admin/contacts?${params}`, token);
        const nextItems: ContactRow[] = parseContactsList(json);
        const nextCounts = (json?.counts || {
          all: Number(json?.pagination?.total || nextItems.length),
          new: 0,
          open: 0,
          awaiting_user: 0,
          awaiting_plazore: 0,
          resolved: 0,
          closed: 0,
          unread: 0,
          high: 0,
        }) as Counts;
        const nextTotal = Number(
          json?.pagination?.total ?? json?.total ?? nextItems.length
        );
        const nextPages = Number(json?.pagination?.pages || 1);
        const nextPage = Number(json?.pagination?.page || p);

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
            : "Failed to load contacts";
        if (cacheRef.current) {
          setItems(cacheRef.current.items);
          setCounts(cacheRef.current.counts);
          setTotal(cacheRef.current.total);
          setPages(cacheRef.current.pages);
          setPage(cacheRef.current.page);
          setStale(true);
          setError(`${msg} — showing last load.`);
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    },
    [
      getToken,
      status,
      contactAs,
      category,
      contextType,
      priority,
      unreadOnly,
      q,
      deepUserId,
    ]
  );

  useEffect(() => {
    if (!mounted) return;
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mounted,
    status,
    contactAs,
    category,
    contextType,
    priority,
    unreadOnly,
    deepUserId,
  ]);

  const mergeOrderSnapshot = async (
    row: ContactRow,
    token: string | null
  ): Promise<ContactRow> => {
    const orderId = row.relatedOrder?._id;
    if (!orderId || !token) return row;
    const thin =
      !row.relatedOrder?.currency &&
      !row.relatedOrder?.feeBreakdown?.currency &&
      !row.relatedOrder?.region;
    if (!thin && row.relatedOrder?.feeBreakdown) return row;
    try {
      const json = await adminFetch<any>(`/admin/orders/${orderId}`, token);
      const order =
        json?.data && typeof json.data === "object" && json.data._id
          ? json.data
          : json?.order && json.order._id
            ? json.order
            : json?._id
              ? json
              : null;
      if (!order?._id) return row;
      return { ...row, relatedOrder: { ...row.relatedOrder, ...order } };
    } catch {
      return row;
    }
  };

  const openModal = async (row: ContactRow | { _id: string }) => {
    setOpenId(row._id);
    if ("status" in row || "email" in row) setSelected(row as ContactRow);
    setModalOpen(true);
    setReply("");
    setNote("");
    setActionMsg("");
    if (showOffline) return;
    try {
      setDetailLoading(true);
      const token = await getToken();
      const json = await adminFetch<any>(`/admin/contacts/${row._id}`, token);
      let detail = parseContactDetail(json) || (row as ContactRow);
      if (detail._id) {
        detail = await mergeOrderSnapshot(detail, token);
        setSelected(detail);
      }
      await adminFetch(`/admin/contacts/${row._id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ markRead: true }),
      }).catch(() => {});
    } catch {
      /* keep list row */
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!mounted || !deepContactId || deepOpened.current) return;
    deepOpened.current = true;
    void openModal({ _id: deepContactId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, deepContactId]);

  const closeModal = () => {
    setModalOpen(false);
    window.setTimeout(() => {
      setOpenId(null);
      setSelected(null);
      setActionMsg("");
    }, 280);
  };

  const patch = async (body: Record<string, unknown>) => {
    if (!selected || showOffline) return;
    try {
      setBusy(true);
      const token = await getToken();
      const json = await adminFetch<any>(
        `/admin/contacts/${selected._id}`,
        token,
        { method: "PATCH", body: JSON.stringify(body) }
      );
      const detail = parseContactDetail(json);
      if (detail && detail._id) setSelected(detail);
      setReply("");
      setNote("");
      await load(page);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : "Update failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Real payment resolution:
   * 1) POST /admin/orders/:id/refund or /settle-seller
   * 2) If that 404s, POST /payments/admin/disputes/:id/refund-buyer | settle-seller
   * 3) PATCH contact ticket resolved
   */
  const resolveDeliveryIssue = async (
    action: "refund_buyer" | "seller_favour" | "authorize_payout"
  ) => {
    if (!selected || showOffline || resolveBusy) return;
    const orderId = selected.relatedOrder?._id;
    if (!orderId) {
      setActionMsg("No linked order — cannot run payment action.");
      return;
    }

    try {
      setResolveBusy(true);
      setError("");
      setActionMsg("");
      const token = await getToken();

      const body = {
        reason:
          action === "refund_buyer"
            ? "admin_buyer_refund"
            : action === "seller_favour"
              ? "admin_seller_favour"
              : "admin_authorize_payout",
        contactId: selected._id,
        note: note.trim() || undefined,
      };

      const primary =
        action === "refund_buyer"
          ? `/admin/orders/${orderId}/refund`
          : `/admin/orders/${orderId}/settle-seller`;
      const fallback =
        action === "refund_buyer"
          ? `/payments/admin/disputes/${orderId}/refund-buyer`
          : `/payments/admin/disputes/${orderId}/settle-seller`;

      try {
        await adminFetch(primary, token, {
          method: "POST",
          body: JSON.stringify(body),
        });
      } catch {
        await adminFetch(fallback, token, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      setActionMsg(
        action === "refund_buyer"
          ? "Buyer refund initiated on order."
          : action === "seller_favour"
            ? "Settled in seller’s favour; payout queued."
            : "Seller payout authorized."
      );

      const json = await adminFetch<any>(
        `/admin/contacts/${selected._id}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({
            resolveDeliveryIssue: action,
            status: "resolved",
          }),
        }
      );
      let detail = parseContactDetail(json);
      if (detail?._id) {
        detail = await mergeOrderSnapshot(detail, token);
        setSelected(detail);
      }

      await load(page);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : "Resolution failed";
      setError(msg);
      setActionMsg(msg);
    } finally {
      setResolveBusy(false);
    }
  };

  const clearFilters = () => {
    setStatus("");
    setContactAs("");
    setCategory("");
    setContextType("");
    setPriority("");
    setUnreadOnly(false);
    setQ("");
  };

  const filtersActive = !!(
    status ||
    contactAs ||
    category ||
    contextType ||
    priority ||
    unreadOnly ||
    q.trim()
  );

  const thread: ThreadMsg[] = (() => {
    if (!selected) return [];
    if (selected.messages?.length) {
      return selected.messages.map((m) => ({
        who:
          m.senderType === "admin"
            ? m.sender?.name || "Plazore"
            : selected.user?.name || "User",
        body: m.body || "",
        at: m.createdAt,
        side: (m.senderType === "admin" ? "admin" : "user") as
          | "user"
          | "admin",
      }));
    }
    const out: ThreadMsg[] = [];
    if (selected.message) {
      out.push({
        who: selected.user?.name || "User",
        body: selected.message,
        at: selected.createdAt,
        side: "user",
      });
    }
    for (const r of selected.responses || []) {
      out.push({
        who: r.admin?.name || "Plazore",
        body: r.body || "",
        at: r.createdAt,
        side: "admin",
      });
    }
    return out;
  })();

  const order = selected?.relatedOrder;
  const confStatus = order?.buyerConfirmation?.status;
  const payoutStatus = order?.payout?.status;
  const isIssueOpen =
    confStatus === "issue_reported" || payoutStatus === "blocked_issue";
  const canReply = selected?.allowsReply !== false;

  return (
    <div className="relative mx-auto max-w-6xl pb-24 text-[#F5F7FA]">
      {showOffline && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">You’re offline</p>
            <p className="mt-0.5 text-xs text-amber-100/80">
              Inbox actions need a connection.
              {stale ? " Showing last load." : ""}
            </p>
          </div>
        </div>
      )}

      <header className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
              SUPPORT
            </p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight sm:text-[32px]">
              Contact
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] text-white/50">
              Delivery issues show the order total in the currency charged at
              checkout. Refund and seller-favour call the real payment APIs.
            </p>
          </div>
          <Button
            tone="ghost"
            className="h-10 gap-1.5 rounded-full border border-white/12 bg-[#14181F] text-xs"
            disabled={loading || showOffline}
            onClick={() => void load(page)}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={envTone as "green" | "warn" | "neutral"}>
            <Database className="mr-1 inline h-3 w-3" />
            {envLabel}
          </Badge>
          <Badge tone="blue">
            <MessageCircle className="mr-1 inline h-3 w-3" />
            Inbox
          </Badge>
          {deepUserId ? (
            <Badge tone="neutral">Filtered by user</Badge>
          ) : null}
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {(
          [
            ["All", "", counts.all],
            ["New", "new", counts.new],
            ["Open", "open", counts.open],
            ["Await user", "awaiting_user", counts.awaiting_user],
            ["Await us", "awaiting_plazore", counts.awaiting_plazore],
            ["Resolved", "resolved", counts.resolved],
            ["Closed", "closed", counts.closed],
            ["Unread", "__unread", counts.unread],
          ] as const
        ).map(([label, value, n]) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (value === "__unread") {
                setUnreadOnly(true);
                setStatus("");
              } else {
                setUnreadOnly(false);
                setStatus(value);
              }
            }}
            className={cn(
              "rounded-2xl border px-2 py-3 text-left transition sm:px-3",
              ((value === "__unread" && unreadOnly) ||
                (value !== "__unread" && status === value && !unreadOnly)) &&
                "border-[#00E575]/35 bg-[#00E575]/10",
              !(
                (value === "__unread" && unreadOnly) ||
                (value !== "__unread" && status === value && !unreadOnly)
              ) &&
                "border-white/[0.08] bg-white/[0.03] hover:border-white/15"
            )}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
              {label}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums leading-none">
              {Number(n || 0).toLocaleString()}
            </p>
          </button>
        ))}
      </div>

      <Panel className="mb-4 overflow-hidden rounded-2xl border-white/[0.08] bg-white/[0.03]">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            Filters
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-white/50 hover:text-[#00E575]"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              placeholder="Search email, subject, message…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !showOffline && void load(1)
              }
              className="rounded-xl border-white/12 bg-[#14181F] lg:max-w-md"
            />
            <Button
              className="rounded-xl"
              onClick={() => void load(1)}
              disabled={loading || showOffline}
            >
              Search
            </Button>
            <div className="flex gap-1 rounded-xl border border-white/10 lg:ml-auto">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-l-xl",
                  view === "list"
                    ? "bg-[#00E575] text-[#041412]"
                    : "text-white/50"
                )}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView("grid")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-r-xl",
                  view === "grid"
                    ? "bg-[#00E575] text-[#041412]"
                    : "text-white/50"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <DarkSelect value={contactAs} onChange={setContactAs}>
              <option value="">All roles</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
            </DarkSelect>
            <DarkSelect value={contextType} onChange={setContextType}>
              <option value="">All context</option>
              <option value="general">General</option>
              <option value="store">Store</option>
              <option value="product">Product</option>
              <option value="order">Order</option>
              <option value="seller">Seller</option>
              <option value="buyer">Buyer</option>
            </DarkSelect>
            <DarkSelect value={category} onChange={setCategory}>
              <option value="">All categories</option>
              <option value="buying">Buying</option>
              <option value="selling">Selling</option>
              <option value="order_payment">Order / payment</option>
              <option value="delivery">Delivery</option>
              <option value="feedback">Feedback</option>
              <option value="technical">Technical</option>
              <option value="account">Account</option>
              <option value="other">Other</option>
            </DarkSelect>
            <DarkSelect value={priority} onChange={setPriority}>
              <option value="">All priority</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </DarkSelect>
          </div>
        </div>
      </Panel>

      {error && (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
          <OrbLoader label="Loading conversations" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No conversations"
          body="When users contact Plazore, they appear here."
        />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((row) => (
            <button
              key={row._id}
              type="button"
              onClick={() => void openModal(row)}
              className={cn(
                "rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition hover:border-[#00E575]/35",
                openId === row._id &&
                  modalOpen &&
                  "border-[#00E575]/45 bg-[#00E575]/[0.06]"
              )}
            >
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={statusTone(row.status)}>
                  {row.status || "—"}
                </Badge>
                {row.unreadByAdmin && <Badge tone="blue">Unread</Badge>}
                {row.allowsReply === false && (
                  <Badge tone="neutral">No reply</Badge>
                )}
                {isDeliveryIssue(row) && (
                  <Badge tone="warn">Delivery issue</Badge>
                )}
                <Badge tone="neutral">{row.contactAs || "—"}</Badge>
              </div>
              <p className="mt-2 truncate font-medium">
                {row.user?.name || row.email || "User"}
              </p>
              <p className="truncate text-xs text-white/40">
                {row.subject || row.category || row.contextType || "—"}
              </p>
              <p className="mt-2 line-clamp-2 text-xs text-white/50">
                {row.message || "—"}
              </p>
              {row.relatedOrder && (
                <p className="mt-2 text-[11px] tabular-nums text-white/35">
                  {row.relatedOrder.orderNumber || "Order"} ·{" "}
                  {fmtMoney(
                    chargedTotal(row.relatedOrder),
                    orderCurrency(row.relatedOrder)
                  )}{" "}
                  · {orderRegion(row.relatedOrder)}
                </p>
              )}
              <p className="mt-2 text-[11px] text-white/30">
                {fmt(row.lastMessageAt || row.createdAt)}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <Panel className="overflow-x-auto rounded-2xl border-white/[0.08] bg-white/[0.03]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.12em] text-white/40">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Context</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row._id}
                  onClick={() => void openModal(row)}
                  className={cn(
                    "cursor-pointer border-b border-white/[0.05] transition hover:bg-white/[0.03]",
                    openId === row._id &&
                      modalOpen &&
                      "bg-[#00E575]/[0.06]"
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {row.user?.name || "—"}
                      {row.unreadByAdmin && (
                        <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-[#00E575]" />
                      )}
                    </p>
                    <p className="text-xs text-white/40">
                      {row.email || row.user?.email}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-white/55">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{row.contextType || "general"}</span>
                      {row.allowsReply === false && (
                        <Badge tone="neutral">No reply</Badge>
                      )}
                      {isDeliveryIssue(row) && (
                        <Badge tone="warn">Delivery</Badge>
                      )}
                      {row.relatedProduct?.name
                        ? ` · ${row.relatedProduct.name}`
                        : ""}
                      {row.relatedSeller?.storeName
                        ? ` · ${row.relatedSeller.storeName}`
                        : ""}
                      {row.relatedOrder
                        ? ` · ${fmtMoney(
                            chargedTotal(row.relatedOrder),
                            orderCurrency(row.relatedOrder)
                          )}`
                        : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/50">
                    {row.category || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(row.status)}>
                      {row.status || "—"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        row.priority === "critical"
                          ? "error"
                          : row.priority === "high"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {row.priority || "normal"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/45">
                    {fmt(row.lastMessageAt || row.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            tone="ghost"
            className="rounded-xl"
            disabled={page <= 1 || loading || showOffline}
            onClick={() => void load(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-white/40">
            Page {page} of {pages} · {total} total
          </span>
          <Button
            tone="ghost"
            className="rounded-xl"
            disabled={page >= pages || loading || showOffline}
            onClick={() => void load(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <ContactModal
        open={modalOpen}
        onClose={closeModal}
        selected={selected}
        detailLoading={detailLoading}
        reply={reply}
        setReply={setReply}
        note={note}
        setNote={setNote}
        busy={busy}
        resolveBusy={resolveBusy}
        showOffline={showOffline}
        canReply={canReply}
        thread={thread}
        order={order}
        confStatus={confStatus}
        payoutStatus={payoutStatus}
        isIssueOpen={isIssueOpen}
        actionMsg={actionMsg}
        onPatch={patch}
        onResolveDelivery={resolveDeliveryIssue}
      />
    </div>
  );
}

export default function ContactsPage() {
  return (
    <ContactsGate>
      <ContactsDirectory />
    </ContactsGate>
  );
}