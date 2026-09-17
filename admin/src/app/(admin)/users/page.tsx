"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  LayoutGrid,
  List,
  MessageSquare,
  RefreshCw,
  Search,
  WifiOff,
  X,
  MapPin,
  Lock,
  Database,
  Activity,
  Store,
  User as UserIcon,
  Heart,
  Package,
  ShoppingBag,
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
import { REGION_LIST } from "@/lib/region";
import { FULFILLMENT_COUNTRIES, getStatesForCountry } from "@/lib/location";
import {
  ACTIVITY_SPOT_OPTIONS,
  getActivityState,
} from "@/lib/activityConfig";

const GATE_KEY = "plazore.admin.usersGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_USERS_PASSWORD || "";
const PAGE_SIZE = 25;

/** Stacking: page content < floats < profile modal */
const Z_FLOAT = 90;
const Z_MODAL = 9999;

type EnvKind = "development" | "production" | "unknown";

type UserRow = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  role: string;
  image?: string;
  clerkId?: string;
  marketplaceRegion?: string;
  storeName?: string;
  storeDescription?: string;
  businessGoal?: string;
  isSellerVerified?: boolean;
  isSellerSuspended?: boolean;
  lastActivityAt?: string | null;
  lastActivityKind?: string | null;
  shippingDefaults?: {
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  };
  createdAt?: string;
  productStats?: { total: number; active: number };
};

type OrderLite = {
  _id?: string;
  orderNumber?: string;
  orderStatus?: string;
  paymentStatus?: string;
  totalAmount?: number;
  total?: number;
  currency?: string;
  createdAt?: string;
  items?: { title?: string; name?: string; quantity?: number; image?: string }[];
  seller?: { name?: string; storeName?: string };
  buyer?: { name?: string; email?: string };
};

type WishlistLite = {
  _id?: string;
  productId?: string;
  title?: string;
  name?: string;
  price?: number;
  image?: string;
  addedAt?: string;
  createdAt?: string;
};

type ProductLite = {
  _id?: string;
  title?: string;
  name?: string;
  status?: string;
  price?: number;
  currency?: string;
  createdAt?: string;
};

type UserDetail = {
  user: UserRow;
  products?: ProductLite[];
  stats: {
    productCount: number;
    activeProductCount: number;
    orderCountAsBuyer: number;
    orderCountAsSeller: number;
    orderCount: number;
    wishlistCount?: number;
  };
  recentOrdersAsBuyer?: OrderLite[];
  recentOrdersAsSeller?: OrderLite[];
  ordersAsBuyer?: OrderLite[];
  ordersAsSeller?: OrderLite[];
  wishlist?: WishlistLite[];
  wishlists?: WishlistLite[];
};

type Counts = { all: number; buyer: number; seller: number; admin: number };

type ActivityHealth = {
  score: number;
  label: string;
  tone: "green" | "warn" | "error";
  active24h: number;
  quiet7d: number;
  idle30d: number;
  dormant: number;
  unknown: number;
  total: number;
  basis?: string;
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

function kindLabel(kind?: string | null) {
  if (kind === "order_buyer") return "Placed an order";
  if (kind === "order_seller") return "Received an order";
  if (kind === "cart") return "Updated cart";
  if (kind === "listing") return "Updated listing";
  if (kind === "showroom") return "Showroom action";
  return kind || "No commerce action yet";
}

function money(n?: number, currency?: string) {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: currency ? "currency" : "decimal",
      currency: currency || undefined,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return String(n);
  }
}

function shortDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "—";
  }
}

function DarkSelect({
  value,
  onChange,
  children,
  disabled,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{ colorScheme: "dark" }}
      className={cn(
        "h-10 w-full rounded-xl border border-white/12 bg-[#14181F] px-3 text-[13px] text-[#F5F7FA] outline-none focus:border-[#00E575]/40 disabled:opacity-40",
        className,
      )}
    >
      {children}
    </select>
  );
}

function Avatar({
  name,
  image,
  size = "md",
}: {
  name?: string;
  image?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const dim =
    size === "xl"
      ? "h-16 w-16 text-xl"
      : size === "lg"
        ? "h-14 w-14 text-lg"
        : size === "sm"
          ? "h-8 w-8 text-[11px]"
          : "h-10 w-10 text-sm";
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        className={cn(
          dim,
          "shrink-0 rounded-full object-cover ring-1 ring-white/10",
        )}
      />
    );
  }
  return (
    <div
      className={cn(
        dim,
        "flex shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-semibold text-[#00E575] ring-1 ring-white/10",
      )}
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

/**
 * Portaled to body → always sticks to viewport bottom-left.
 * Never scrolls with the page. Below modal, above page chrome.
 * Clear of PerformanceFloat (bottom-right).
 */
function ActivityFloat({
  health,
  hidden,
}: {
  health: ActivityHealth;
  hidden?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const pct = Math.max(0, Math.min(100, health.score));
  const accent =
    health.tone === "green"
      ? "#00E575"
      : health.tone === "warn"
        ? "#FBBF24"
        : "#F87171";

  useEffect(() => setMounted(true), []);

  if (!mounted || hidden) return null;

  return createPortal(
    <div
      className="pointer-events-none"
      style={{
        position: "fixed",
        left: 16,
        bottom: 20,
        zIndex: Z_FLOAT,
      }}
    >
      <div className="pointer-events-auto flex flex-col items-start gap-2 sm:ml-[72px]">
        {open && (
          <div
            className="w-[min(calc(100vw-5rem),280px)] overflow-hidden rounded-2xl border border-white/12 bg-[#0A0D12]/96 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            style={{ boxShadow: `0 0 0 1px ${accent}22, 0 16px 48px rgba(0,0,0,0.55)` }}
          >
            <div
              className="h-[2px] w-full"
              style={{
                background: `linear-gradient(90deg, ${accent}, #14B8A6, #3B82F6)`,
              }}
            />
            <div className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">
                    Commerce activity
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold text-[#F5F7FA]">
                    {health.label}
                  </p>
                </div>
                <span
                  className="text-[18px] font-bold tabular-nums"
                  style={{ color: accent }}
                >
                  {pct}
                </span>
              </div>
              <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${accent}, #3B82F6)`,
                  }}
                />
              </div>
              <p className="mt-2.5 text-[10px] leading-snug text-white/35">
                {health.active24h} active · {health.quiet7d} quiet ·{" "}
                {health.dormant} dormant · {health.total} total
              </p>
              <p className="mt-1 text-[9px] text-white/25">
                Orders / cart / listings — not last seen
              </p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Platform activity"
          className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/14 bg-[#0A0D12]/96 backdrop-blur-md transition hover:border-white/25"
          style={{ boxShadow: `0 0 24px ${accent}40` }}
        >
          <Activity className="h-5 w-5" style={{ color: accent }} />
          <span
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-[#041412]"
            style={{ background: accent }}
          >
            {pct}
          </span>
        </button>
      </div>
    </div>,
    document.body,
  );
}

function UsersGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

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
      setErr("Set NEXT_PUBLIC_ADMIN_USERS_PASSWORD");
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
  };

  if (!ready)
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-white/35">
        …
      </div>
    );

  if (!unlocked) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 text-[#F5F7FA]">
        <div className="rounded-2xl border border-white/10 bg-[#0E1116]/95 p-6 sm:p-8">
          <div className="h-px bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />
          <Lock className="mt-5 h-5 w-5 text-[#00E575]" />
          <h1 className="mt-3 text-2xl font-semibold">Users directory</h1>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access password"
              className="h-12 w-full rounded-xl border border-white/12 bg-[#14181F] px-4 text-sm outline-none focus:border-[#00E575]/45"
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

function DossierBlock({
  icon: Icon,
  title,
  children,
  count,
}: {
  icon: typeof UserIcon;
  title: string;
  children: ReactNode;
  count?: number;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05] text-[#00E575]">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {title}
        </p>
        {typeof count === "number" && (
          <span className="ml-auto text-[11px] tabular-nums text-white/35">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="border-b border-white/[0.04] py-2 last:border-0">
      <span className="text-[10px] uppercase tracking-wide text-white/35">
        {label}
      </span>
      <p
        className={cn(
          "mt-0.5 text-[13px] text-[#F5F7FA]",
          mono && "break-all font-mono text-[11px] text-white/55",
        )}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

function OrderLine({ o, hrefBase = "/orders" }: { o: OrderLite; hrefBase?: string }) {
  const plzId = o.orderNumber || o._id || "—";
  const status = o.orderStatus || "—";
  const pay = o.paymentStatus || "";
  const amount = o.totalAmount ?? o.total;
  const itemLabel =
    o.items?.[0]?.name ||
    o.items?.[0]?.title ||
    (o.items?.length ? `${o.items.length} items` : null);
  const party = o.seller?.storeName || o.seller?.name || o.buyer?.name;

  return (
    <Link
      href={o._id ? `${hrefBase}?q=${encodeURIComponent(String(plzId))}` : hrefBase}
      className="block border-b border-white/[0.04] py-2.5 last:border-0 transition hover:bg-white/[0.03]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[12px] font-semibold tracking-wide text-[#00E575]">
            {plzId}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-white/55">
            {shortDate(o.createdAt)}
            {" · "}
            <span className="text-white/70">{status}</span>
            {pay ? ` · ${pay}` : ""}
            {party ? ` · ${party}` : ""}
          </p>
          {itemLabel ? (
            <p className="mt-0.5 truncate text-[11px] text-white/35">{itemLabel}</p>
          ) : null}
        </div>
        <p className="shrink-0 text-[13px] font-semibold tabular-nums text-[#F5F7FA]">
          {money(amount, o.currency)}
        </p>
      </div>
    </Link>
  );
}

function WishlistLine({ w }: { w: WishlistLite }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.04] py-2 last:border-0">
      {w.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={w.image}
          alt=""
          className="h-9 w-9 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05]">
          <Heart className="h-3.5 w-3.5 text-white/30" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px]">{w.title || w.name || "Item"}</p>
        <p className="text-[11px] text-white/40">
          {shortDate(w.addedAt || w.createdAt)}
        </p>
      </div>
      {w.price != null && (
        <span className="text-[12px] tabular-nums text-white/55">
          {money(w.price)}
        </span>
      )}
    </div>
  );
}

function ProductLine({ p }: { p: ProductLite }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.04] py-2 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium">
          {p.title || p.name || "Listing"}
        </p>
        <p className="mt-0.5 text-[11px] text-white/40">
          {shortDate(p.createdAt)}
          {p.status ? ` · ${p.status}` : ""}
        </p>
      </div>
      <p className="shrink-0 text-[12px] tabular-nums text-white/60">
        {money(p.price, p.currency)}
      </p>
    </div>
  );
}

function UserProfileModal({
  open,
  onClose,
  detail,
  loading,
  contactOpen,
  setContactOpen,
  contactSubject,
  setContactSubject,
  contactMessage,
  setContactMessage,
  contactAllowsReply,
  setContactAllowsReply,
  contactBusy,
  contactError,
  contactSuccess,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  detail: UserDetail | null;
  loading: boolean;
  contactOpen: boolean;
  setContactOpen: (v: boolean) => void;
  contactSubject: string;
  setContactSubject: (v: string) => void;
  contactMessage: string;
  setContactMessage: (v: string) => void;
  contactAllowsReply: boolean;
  setContactAllowsReply: (v: boolean) => void;
  contactBusy: boolean;
  contactError: string;
  contactSuccess: boolean;
  onSend: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const u = detail?.user;
  const act = u
    ? getActivityState({
        lastActivityAt: u.lastActivityAt,
        lastActivityKind: u.lastActivityKind,
      })
    : null;

  const buyerOrders =
    detail?.ordersAsBuyer || detail?.recentOrdersAsBuyer || [];
  const sellerOrders =
    detail?.ordersAsSeller || detail?.recentOrdersAsSeller || [];
  const wishlist = detail?.wishlist || detail?.wishlists || [];
  const products = detail?.products || [];

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
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0 });
    });
  }, [open, detail?.user?._id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "flex items-end justify-center sm:items-center sm:p-6",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_MODAL,
      }}
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
            PROFILE
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
          {loading && !detail && <OrbLoader label="Loading profile…" />}

          {detail && u && act && (
            <div className="space-y-4">
              <div className="flex items-start gap-3.5 pt-1">
                <Avatar name={u.name} image={u.image} size="xl" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[18px] font-semibold sm:text-[20px]">
                    {u.name || "—"}
                  </h2>
                  <p className="truncate text-[13px] text-white/45">{u.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge
                      tone={
                        u.role === "seller"
                          ? "green"
                          : u.role === "admin"
                            ? "blue"
                            : "neutral"
                      }
                    >
                      {u.role}
                    </Badge>
                    <Badge tone="neutral">
                      {u.marketplaceRegion || "No region"}
                    </Badge>
                    <Badge tone={act.tone}>{act.label}</Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    {
                      label: "Last action",
                      value: act.relative,
                      sub: kindLabel(act.kind),
                    },
                    {
                      label: "Joined",
                      value: shortDate(u.createdAt),
                      sub: "",
                    },
                    {
                      label: "Bought",
                      value: String(detail.stats.orderCountAsBuyer ?? 0),
                      sub: "orders",
                    },
                    {
                      label: "Sold",
                      value: String(detail.stats.orderCountAsSeller ?? 0),
                      sub: "orders",
                    },
                  ] as const
                ).map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-2.5"
                  >
                    <p className="text-[9px] font-semibold uppercase text-white/35">
                      {m.label}
                    </p>
                    <p className="mt-1 truncate text-[13px] font-semibold tabular-nums">
                      {m.value}
                    </p>
                    {m.sub ? (
                      <p className="mt-0.5 truncate text-[10px] text-white/30">
                        {m.sub}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              <DossierBlock icon={UserIcon} title="Identity">
                <Row label="Phone" value={u.phone || "—"} />
                <Row label="User ID" value={u._id} mono />
                <Row label="Clerk" value={u.clerkId || "—"} mono />
              </DossierBlock>

              <DossierBlock icon={MapPin} title="Address">
                <p className="text-[13px] leading-relaxed text-white/75">
                  {[
                    u.shippingDefaults?.address?.street,
                    u.shippingDefaults?.address?.city,
                    u.shippingDefaults?.address?.state,
                    u.shippingDefaults?.address?.zipCode,
                    u.shippingDefaults?.address?.country,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
              </DossierBlock>

              {(u.role === "seller" || u.storeName) && (
                <DossierBlock icon={Store} title="Storefront">
                  <Row label="Store" value={u.storeName || "—"} />
                  <Row label="Description" value={u.storeDescription || "—"} />
                </DossierBlock>
              )}

              <DossierBlock
                icon={ShoppingBag}
                title="Orders as buyer"
                count={buyerOrders.length}
              >
                {buyerOrders.length === 0 ? (
                  <p className="text-[12px] text-white/40">No purchases yet.</p>
                ) : (
                  buyerOrders.map((o, i) => (
                    <OrderLine key={o._id || `b-${i}`} o={o} />
                  ))
                )}
              </DossierBlock>

              <DossierBlock
                icon={Package}
                title="Orders as seller"
                count={sellerOrders.length}
              >
                {sellerOrders.length === 0 ? (
                  <p className="text-[12px] text-white/40">No sales yet.</p>
                ) : (
                  sellerOrders.map((o, i) => (
                    <OrderLine key={o._id || `s-${i}`} o={o} />
                  ))
                )}
              </DossierBlock>

              <DossierBlock
                icon={Heart}
                title="Wishlist"
                count={wishlist.length}
              >
                {wishlist.length === 0 ? (
                  <p className="text-[12px] text-white/40">Empty wishlist.</p>
                ) : (
                  wishlist.map((w, i) => (
                    <WishlistLine key={w._id || w.productId || `w-${i}`} w={w} />
                  ))
                )}
              </DossierBlock>

              {(u.role === "seller" || products.length > 0) && (
                <DossierBlock
                  icon={Store}
                  title="Listings"
                  count={products.length}
                >
                  {products.length === 0 ? (
                    <p className="text-[12px] text-white/40">No listings.</p>
                  ) : (
                    products.map((p, i) => (
                      <ProductLine key={p._id || `p-${i}`} p={p} />
                    ))
                  )}
                </DossierBlock>
              )}

              <DossierBlock icon={Activity} title="Commerce signal">
                <Row label="State" value={act.label} />
                <Row label="When" value={act.relative} />
                <Row label="Kind" value={kindLabel(act.kind)} />
              </DossierBlock>

              <DossierBlock icon={MessageSquare} title="Reach out">
                {contactSuccess ? (
                  <p className="text-sm text-[#00E575]">Sent via Plazore.</p>
                ) : !contactOpen ? (
                  <Button
                    className="w-full gap-2 rounded-xl"
                    onClick={() => {
                      setContactOpen(true);
                      setContactSubject(
                        `Message from Plazore · ${u.storeName || u.name || "Account"}`,
                      );
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Contact user
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Input
                      className="rounded-xl border-white/12 bg-[#14181F]"
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      placeholder="Subject"
                    />
                    <textarea
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-white/12 bg-[#14181F] px-3 py-2 text-sm outline-none focus:border-[#00E575]/40"
                      placeholder="Message…"
                    />
                    <label className="flex items-center gap-2 text-xs text-white/50">
                      <input
                        type="checkbox"
                        checked={contactAllowsReply}
                        onChange={(e) =>
                          setContactAllowsReply(e.target.checked)
                        }
                      />
                      Allow reply
                    </label>
                    {contactError && (
                      <p className="text-xs text-red-400">{contactError}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 rounded-xl"
                        disabled={contactBusy}
                        onClick={onSend}
                      >
                        {contactBusy ? "…" : "Send"}
                      </Button>
                      <Button
                        tone="ghost"
                        className="rounded-xl"
                        onClick={() => setContactOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </DossierBlock>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href={`/moderation?userId=${u._id}`}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#00E575] text-sm font-semibold text-[#041412]"
                >
                  Moderation
                </Link>
                <Link
                  href={`/contact?userId=${u._id}`}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-white/12 text-sm text-white/55"
                >
                  Contact threads
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function UsersDirectory() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const deepUserId = (searchParams.get("userId") || "").trim();
  const deepRole = (searchParams.get("role") || "").trim();
  const deepOpenedRef = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const clientEnv = useMemo(() => detectEnvFromApi(), []);

  const [mounted, setMounted] = useState(false);
  const [offline, setOffline] = useState(false);

  const [role, setRole] = useState(
    deepRole === "buyer" || deepRole === "seller" || deepRole === "admin"
      ? deepRole
      : "",
  );
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [street, setStreet] = useState("");
  const [sort, setSort] = useState("newest");
  const [spot, setSpot] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [q, setQ] = useState("");

  const [items, setItems] = useState<UserRow[]>([]);
  const [counts, setCounts] = useState<Counts>({
    all: 0,
    buyer: 0,
    seller: 0,
    admin: 0,
  });
  const [health, setHealth] = useState<ActivityHealth | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [apiEnv, setApiEnv] = useState<EnvKind | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactAllowsReply, setContactAllowsReply] = useState(true);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState("");
  const [contactSuccess, setContactSuccess] = useState(false);

  const states = useMemo(() => getStatesForCountry(country), [country]);
  const showOffline = mounted && offline;
  const env: EnvKind = apiEnv || clientEnv;
  const envTone =
    env === "production" ? "error" : env === "development" ? "warn" : "neutral";
  const envLabel =
    env === "production"
      ? "Production data"
      : env === "development"
        ? "Development data"
        : "Environment unknown";

  const hasMore = page < pages;

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

  const buildParams = useCallback(
    (p: number) => {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(PAGE_SIZE),
        sort,
      });
      if (role) params.set("role", role);
      if (region) params.set("region", region);
      if (country) params.set("country", country);
      if (state) params.set("state", state);
      if (city.trim()) params.set("city", city.trim());
      if (zip.trim()) params.set("zip", zip.trim());
      if (street.trim()) params.set("street", street.trim());
      if (spot) params.set("spot", spot);
      if (q.trim()) params.set("q", q.trim());
      return params;
    },
    [role, region, country, state, city, zip, street, sort, spot, q],
  );

  const load = useCallback(
    async (p = 1) => {
      try {
        setLoading(true);
        setError("");
        const token = await getToken();
        if (!token) {
          setError("Session expired.");
          setLoading(false);
          return;
        }
        const json = await adminFetch<any>(
          `/admin/users?${buildParams(p)}`,
          token,
        );
        setItems(json.data || []);
        setCounts(json.counts || { all: 0, buyer: 0, seller: 0, admin: 0 });
        setHealth(json.activityHealth || null);
        setTotal(json.pagination?.total || 0);
        setPages(json.pagination?.pages || 1);
        setPage(json.pagination?.page || p);
        if (json.environment || json.meta?.environment) {
          setApiEnv((json.environment || json.meta.environment) as EnvKind);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    },
    [getToken, buildParams],
  );

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || offline) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const token = await getToken();
      if (!token) return;
      const json = await adminFetch<any>(
        `/admin/users?${buildParams(next)}`,
        token,
      );
      const batch: UserRow[] = json.data || [];
      setItems((prev) => {
        const seen = new Set(prev.map((u) => u._id));
        return [...prev, ...batch.filter((u) => !seen.has(u._id))];
      });
      setPages(json.pagination?.pages || pages);
      setPage(json.pagination?.page || next);
      setTotal(json.pagination?.total || total);
    } catch {
      /* keep */
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [getToken, buildParams, hasMore, offline, page, pages, total]);

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        setDetailLoading(true);
        const token = await getToken();
        if (!token) return;
        const json = await adminFetch<{ data: UserDetail }>(
          `/admin/users/${id}`,
          token,
        );
        setDetail(json.data);
      } catch (e: any) {
        setError(e?.message || "Could not load account");
      } finally {
        setDetailLoading(false);
      }
    },
    [getToken],
  );

  const openProfile = useCallback(
    async (id: string) => {
      setOpenId(id);
      setDetail(null);
      setModalOpen(true);
      setContactOpen(false);
      setContactSuccess(false);
      setContactError("");
      const params = new URLSearchParams(searchParams.toString());
      params.set("userId", id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      await loadDetail(id);
    },
    [loadDetail, pathname, router, searchParams],
  );

  const closeProfile = useCallback(() => {
    setModalOpen(false);
    deepOpenedRef.current = null;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("userId");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    window.setTimeout(() => {
      setOpenId(null);
      setDetail(null);
    }, 280);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!mounted || !deepUserId) return;
    if (deepOpenedRef.current === deepUserId) return;
    deepOpenedRef.current = deepUserId;
    void openProfile(deepUserId);
  }, [mounted, deepUserId, openProfile]);

  useEffect(() => {
    if (!mounted) return;
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, role, region, country, state, city, zip, street, sort, spot]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, items.length]);

  const clearFilters = () => {
    setRole("");
    setRegion("");
    setCountry("");
    setState("");
    setCity("");
    setZip("");
    setStreet("");
    setSort("newest");
    setSpot("");
    setQ("");
  };

  const startContactThroughPlazore = async () => {
    if (!detail?.user || contactBusy) return;
    const user = detail.user;
    const msg = contactMessage.trim();
    if (!msg) {
      setContactError("Write a short message.");
      return;
    }
    try {
      setContactBusy(true);
      setContactError("");
      const token = await getToken();
      if (!token) return;
      await adminFetch(`/admin/contacts/reach-out`, token, {
        method: "POST",
        body: JSON.stringify({
          targetUserId: user._id,
          contactAs: user.role === "seller" ? "seller" : "buyer",
          contextType: user.role === "seller" ? "seller" : "buyer",
          category: "account",
          subject:
            contactSubject.trim() ||
            `Message from Plazore · ${user.storeName || user.name || "Account"}`,
          message: msg,
          storeId: user.role === "seller" ? user._id : undefined,
          allowsReply: contactAllowsReply,
        }),
      });
      setContactSuccess(true);
      setContactMessage("");
    } catch (e: any) {
      setContactError(e?.message || "Could not start conversation");
    } finally {
      setContactBusy(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-6xl pb-28 text-[#F5F7FA]">
      {showOffline && (
        <div className="mb-4 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          Offline — reconnect to load more.
        </div>
      )}

      <header className="mb-6">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
          DIRECTORY
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">
              Users & sellers
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] text-white/50">
              Scroll loads more. Profile is a viewport popup. Activity float
              stays pinned bottom-left.
            </p>
          </div>
          <Button
            tone="ghost"
            className="h-10 gap-1.5 rounded-full border border-white/12 bg-[#14181F] text-xs"
            disabled={loading || showOffline}
            onClick={() => load(1)}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh · {total.toLocaleString()}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={envTone as any}>
            <Database className="mr-1 inline h-3 w-3" />
            {envLabel}
          </Badge>
          <Badge tone="blue">
            Loaded {items.length.toLocaleString()} / {total.toLocaleString()}
          </Badge>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["All", "", counts.all],
            ["Buyers", "buyer", counts.buyer],
            ["Sellers", "seller", counts.seller],
            ["Admins", "admin", counts.admin],
          ] as const
        ).map(([label, value, n]) => (
          <button
            key={label}
            type="button"
            onClick={() => setRole(value)}
            className={cn(
              "rounded-2xl border px-3 py-3.5 text-left transition",
              role === value
                ? "border-[#00E575]/35 bg-[#00E575]/10"
                : "border-white/[0.08] bg-white/[0.03] hover:border-white/15",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              {label}
            </p>
            <p className="mt-1.5 text-[22px] font-semibold tabular-nums">
              {Number(n).toLocaleString()}
            </p>
          </button>
        ))}
      </div>

      <Panel className="mb-4 overflow-hidden rounded-2xl border-white/[0.08] bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            Search & location
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-white/45 hover:text-[#00E575]"
          >
            Clear all
          </button>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                className="rounded-xl border-white/12 bg-[#14181F] pl-10"
                placeholder="Name, email, store, phone, city, zip, street, ID…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !showOffline && load(1)}
              />
            </div>
            <Button
              className="h-10 rounded-xl"
              onClick={() => load(1)}
              disabled={loading || showOffline}
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <DarkSelect value={region} onChange={setRegion}>
              <option value="">All regions</option>
              {REGION_LIST.map((r: any) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </DarkSelect>
            <DarkSelect
              value={country}
              onChange={(v) => {
                setCountry(v);
                setState("");
              }}
            >
              <option value="">All countries</option>
              {FULFILLMENT_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </DarkSelect>
            <DarkSelect value={state} onChange={setState} disabled={!country}>
              <option value="">
                {country ? "All states" : "Country first"}
              </option>
              {states.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.name}
                </option>
              ))}
            </DarkSelect>
            <DarkSelect value={spot} onChange={setSpot}>
              {ACTIVITY_SPOT_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </DarkSelect>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              className="rounded-xl border-white/12 bg-[#14181F]"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <Input
              className="rounded-xl border-white/12 bg-[#14181F]"
              placeholder="Zip"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
            <Input
              className="rounded-xl border-white/12 bg-[#14181F]"
              placeholder="Street"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />
            <DarkSelect value={sort} onChange={setSort}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name A–Z</option>
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
        <OrbLoader label="Loading…" />
      ) : items.length === 0 ? (
        <EmptyState title="No users found" body="Clear filters or search again." />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((row) => {
            const a = getActivityState({
              lastActivityAt: row.lastActivityAt,
              lastActivityKind: row.lastActivityKind,
            });
            return (
              <button
                key={row._id}
                type="button"
                onClick={() => openProfile(row._id)}
                className={cn(
                  "rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition hover:border-white/20",
                  openId === row._id && modalOpen && "border-[#00E575]/40",
                )}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={row.name} image={row.image} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name || "—"}</p>
                    <p className="truncate text-xs text-white/40">{row.email}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge
                    tone={
                      row.role === "seller"
                        ? "green"
                        : row.role === "admin"
                          ? "blue"
                          : "neutral"
                    }
                  >
                    {row.role}
                  </Badge>
                  <Badge tone={a.tone}>{a.label}</Badge>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Panel className="overflow-x-auto rounded-2xl border-white/[0.08] bg-white/[0.03]">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.12em] text-white/40">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const a = getActivityState({
                  lastActivityAt: row.lastActivityAt,
                  lastActivityKind: row.lastActivityKind,
                });
                const loc = [
                  row.shippingDefaults?.address?.city,
                  row.shippingDefaults?.address?.state,
                  row.shippingDefaults?.address?.country,
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <tr
                    key={row._id}
                    onClick={() => openProfile(row._id)}
                    className={cn(
                      "cursor-pointer border-b border-white/[0.05] hover:bg-white/[0.04]",
                      openId === row._id &&
                        modalOpen &&
                        "bg-[#00E575]/[0.06]",
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.name} image={row.image} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {row.name || "—"}
                          </p>
                          <p className="truncate text-xs text-white/40">
                            {row.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          row.role === "seller"
                            ? "green"
                            : row.role === "admin"
                              ? "blue"
                              : "neutral"
                        }
                      >
                        {row.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-white/55">
                      {row.marketplaceRegion || "—"}
                    </td>
                    <td className="px-4 py-3 text-white/55">{loc || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={a.tone}>{a.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-white/50">
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
        <p className="py-3 text-center text-xs text-white/40">Loading more…</p>
      )}
      {!hasMore && items.length > 0 && (
        <p className="py-3 text-center text-[11px] text-white/30">
          End · {items.length.toLocaleString()} shown
        </p>
      )}

      {health ? <ActivityFloat health={health} hidden={modalOpen} /> : null}

      <UserProfileModal
        open={modalOpen}
        onClose={closeProfile}
        detail={detail}
        loading={detailLoading}
        contactOpen={contactOpen}
        setContactOpen={setContactOpen}
        contactSubject={contactSubject}
        setContactSubject={setContactSubject}
        contactMessage={contactMessage}
        setContactMessage={setContactMessage}
        contactAllowsReply={contactAllowsReply}
        setContactAllowsReply={setContactAllowsReply}
        contactBusy={contactBusy}
        contactError={contactError}
        contactSuccess={contactSuccess}
        onSend={startContactThroughPlazore}
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <UsersGate>
      <UsersDirectory />
    </UsersGate>
  );
}