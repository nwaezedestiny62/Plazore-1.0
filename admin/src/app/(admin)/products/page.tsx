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
  Database,
  LayoutGrid,
  List,
  Lock,
  Package,
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
import { REGION_LIST } from "@/lib/region";
import { FULFILLMENT_COUNTRIES, getStatesForCountry } from "@/lib/location";

const GATE_KEY = "plazore.admin.productsGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PRODUCTS_PASSWORD || "";
const Z_MODAL = 9999;

type EnvKind = "development" | "production" | "unknown";

type ProductRow = {
  _id: string;
  name: string;
  price: number;
  description?: string;
  images?: string[];
  category?: string;
  subCategory?: string;
  brand?: string;
  stock?: number;
  isActive?: boolean;
  region?: string;
  currency?: string;
  wishlistCount?: number;
  views?: number;
  cartAdds?: number;
  checkouts?: number;
  metrics?: {
    views: number;
    cartAdds: number;
    purchases: number;
    score: number;
  };
  createdAt?: string;
  updatedAt?: string;
  fulfillmentLocation?: {
    city?: string;
    state?: string;
    country?: string;
    countryCode?: string;
    displayLabel?: string;
  };
  seller?: {
    _id?: string;
    name?: string;
    storeName?: string;
    email?: string;
    marketplaceRegion?: string;
    isSellerSuspended?: boolean;
  };
};

type Counts = { all: number; active: number; inactive: number };

/** Exact match of server/config/payment.ts REGION_TO_CURRENCY */
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

/** Same rules as backend currencyForRegion */
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

/** Listing region the product was created in — never ship-to. */
function listingRegion(p?: ProductRow | null): string {
  if (!p) return "—";
  return (
    asRegionCode(p.region) ||
    asRegionCode(p.fulfillmentLocation?.countryCode) ||
    asRegionCode(p.seller?.marketplaceRegion) ||
    "—"
  );
}

/** ISO currency this listing is priced in. No live FX. */
function listingCurrency(p?: ProductRow | null): string {
  if (!p) return "NGN";
  const frozen = pickCurrency(p.currency);
  if (frozen) return frozen;
  const mapped = currencyForRegion(listingRegion(p));
  if (mapped) return mapped;
  return "NGN";
}

function regionName(code?: string): string {
  const k = asRegionCode(code) || norm(code);
  if (!k) return "—";
  const hit = (REGION_LIST as { code?: string; name?: string }[]).find(
    (r) => String(r.code).toUpperCase() === k
  );
  if (hit?.name) return hit.name;
  return REGION_NAME[k] || k;
}

function fmtListingPrice(price?: number, regionOrCurrency?: string) {
  const v = Number(price ?? 0);
  const currency =
    pickCurrency(regionOrCurrency) ||
    currencyForRegion(regionOrCurrency) ||
    "NGN";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v.toLocaleString()} ${currency}`;
  }
}

function locLabel(p: ProductRow) {
  return (
    p.fulfillmentLocation?.displayLabel ||
    [
      p.fulfillmentLocation?.city,
      p.fulfillmentLocation?.state,
      p.fulfillmentLocation?.country,
      listingRegion(p) !== "—" ? listingRegion(p) : p.region,
    ]
      .filter(Boolean)
      .join(", ") ||
    p.region ||
    "—"
  );
}

function fmtDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function parseProductsResponse(res: unknown): {
  list: ProductRow[];
  page: number;
  pages: number;
  total: number;
  counts: Counts;
} {
  const body =
    res && typeof res === "object" ? (res as Record<string, unknown>) : {};
  const rawData = body.data;
  const inner =
    rawData && typeof rawData === "object" && !Array.isArray(rawData)
      ? (rawData as Record<string, unknown>)
      : body;

  let list: ProductRow[] = [];
  if (Array.isArray(inner)) {
    list = inner as ProductRow[];
  } else if (Array.isArray(inner.products)) {
    list = inner.products as ProductRow[];
  } else if (Array.isArray(inner.data)) {
    list = inner.data as ProductRow[];
  } else if (Array.isArray(body.products)) {
    list = body.products as ProductRow[];
  } else if (Array.isArray(body.data)) {
    list = body.data as ProductRow[];
  }

  const pagination =
    (inner.pagination && typeof inner.pagination === "object"
      ? (inner.pagination as Record<string, unknown>)
      : null) ||
    (body.pagination && typeof body.pagination === "object"
      ? (body.pagination as Record<string, unknown>)
      : null) ||
    {};

  const total = Number(
    pagination.total ?? inner.total ?? body.total ?? list.length ?? 0
  );
  const page = Number(pagination.page ?? inner.page ?? body.page ?? 1);
  const pages = Number(
    pagination.pages ??
      inner.pages ??
      body.pages ??
      Math.max(1, Math.ceil(total / 24) || 1)
  );

  const rawCounts =
    (inner.counts as Counts | undefined) ||
    (body.counts as Counts | undefined) ||
    null;

  const counts: Counts = {
    all: Number(rawCounts?.all ?? total ?? list.length),
    active: Number(
      rawCounts?.active ??
        list.filter((x) => x && x.isActive !== false).length
    ),
    inactive: Number(
      rawCounts?.inactive ??
        list.filter((x) => x && x.isActive === false).length
    ),
  };

  return { list, page, pages, total, counts };
}

function parseProductDetail(res: unknown): ProductRow | null {
  if (!res || typeof res !== "object") return null;
  const body = res as Record<string, unknown>;

  if (typeof body._id === "string" && body.name != null) {
    return body as unknown as ProductRow;
  }

  const data = body.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    if (typeof d._id === "string") return d as unknown as ProductRow;
    const nested = d.product;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const p = nested as Record<string, unknown>;
      if (typeof p._id === "string") return p as unknown as ProductRow;
    }
  }

  if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    const first = data[0] as Record<string, unknown>;
    if (typeof first._id === "string") return first as unknown as ProductRow;
  }

  const product = body.product;
  if (product && typeof product === "object" && !Array.isArray(product)) {
    const p = product as Record<string, unknown>;
    if (typeof p._id === "string") return p as unknown as ProductRow;
  }

  return null;
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

function ProductImageGallery({
  images,
  name,
}: {
  images?: string[];
  name?: string;
}) {
  const list = (images || []).filter(Boolean);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
  }, [list.join("|")]);

  if (!list.length) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-xs text-white/35">
        No images
      </div>
    );
  }

  const hero = list[Math.min(active, list.length - 1)];

  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero}
          alt={name || "Product"}
          className="h-full w-full object-cover"
        />
        {list.length > 1 && (
          <span className="absolute bottom-2 right-2 rounded-md border border-white/10 bg-[#0C0F14]/85 px-2 py-0.5 text-[10px] tabular-nums text-white/55">
            {active + 1} / {list.length}
          </span>
        )}
      </div>
      {list.length > 1 && (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
          {list.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "aspect-square overflow-hidden rounded-lg border bg-white/[0.03] transition",
                i === active
                  ? "border-[#00E575] ring-1 ring-[#00E575]/40"
                  : "border-white/10 hover:border-[#00E575]/35"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductsGate({ children }: { children: ReactNode }) {
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
      setErr("Set NEXT_PUBLIC_ADMIN_PRODUCTS_PASSWORD in .env");
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
          <h1 className="mt-2 text-2xl font-semibold">Products</h1>
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
  selected,
  detailLoading,
  busyId,
  showOffline,
  onToggleActive,
}: {
  open: boolean;
  onClose: () => void;
  selected: ProductRow | null;
  detailLoading: boolean;
  busyId: string;
  showOffline: boolean;
  onToggleActive: (p: ProductRow) => void;
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

  const metric = (p: ProductRow) => ({
    views: p.views ?? p.metrics?.views ?? 0,
    cart: p.cartAdds ?? p.metrics?.cartAdds ?? 0,
    checkout: p.checkouts ?? p.metrics?.purchases ?? 0,
  });

  const region = listingRegion(selected);
  const currency = listingCurrency(selected);

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
              LISTING
            </p>
            <p className="text-sm font-medium text-white/80">Product detail</p>
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
            <OrbLoader label="Loading product" />
          ) : selected ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold leading-snug">
                  {selected.name}
                </h2>
                <p className="mt-1 text-sm text-white/50">
                  {selected.category}
                  {selected.subCategory ? ` · ${selected.subCategory}` : ""}
                  {selected.brand ? ` · ${selected.brand}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={selected.isActive ? "green" : "error"}>
                    {selected.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge tone="blue">Region {region}</Badge>
                  <Badge tone="neutral">{currency}</Badge>
                  <Badge tone={(selected.stock ?? 0) > 0 ? "green" : "warn"}>
                    Stock {selected.stock ?? 0}
                  </Badge>
                </div>
              </div>

              <div className="rounded-2xl border border-[#00E575]/25 bg-[#00E575]/[0.06] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  Listing price (as listed)
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-[#00E575]">
                  {fmtListingPrice(selected.price, currency)}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                  <div>
                    <p className="text-white/40">Listed in</p>
                    <p className="font-semibold text-white/85">
                      {region}
                      {region !== "—" ? ` · ${regionName(region)}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/40">Currency</p>
                    <p className="font-semibold text-white/85">{currency}</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-white/35">
                  Checkout charges this amount in {currency}. No conversion.
                </p>
              </div>

              <div>
                <SectionLabel>
                  Images
                  {(selected.images?.length || 0) > 0
                    ? ` · ${selected.images!.length}`
                    : ""}
                </SectionLabel>
                <div className="mt-2">
                  <ProductImageGallery
                    images={selected.images}
                    name={selected.name}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(() => {
                  const m = metric(selected);
                  return (
                    <>
                      <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                          Views
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {m.views.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                          Cart adds
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {m.cart.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                          Checkouts
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {m.checkout.toLocaleString()}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                <SectionLabel>Seller</SectionLabel>
                <Field label="Store">
                  {selected.seller?.storeName || selected.seller?.name || "—"}
                </Field>
                <Field label="Email">{selected.seller?.email || "—"}</Field>
                <Field label="Seller region">
                  {selected.seller?.marketplaceRegion
                    ? `${norm(selected.seller.marketplaceRegion)} · ${
                        currencyForRegion(selected.seller.marketplaceRegion) ||
                        "—"
                      }`
                    : "—"}
                </Field>
                {selected.seller?.isSellerSuspended && (
                  <Badge tone="error">Seller suspended</Badge>
                )}
              </div>

              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                <SectionLabel>Fulfillment</SectionLabel>
                <Field label="Location">{locLabel(selected)}</Field>
                <Field label="Listing region">
                  {region !== "—"
                    ? `${region} · ${regionName(region)} · ${currency}`
                    : "—"}
                </Field>
              </div>

              {selected.description && (
                <div className="space-y-2 border-t border-white/[0.06] pt-4">
                  <SectionLabel>Description</SectionLabel>
                  <p className="text-sm leading-relaxed text-white/55">
                    {selected.description}
                  </p>
                </div>
              )}

              <div className="space-y-2 border-t border-white/[0.06] pt-4 text-xs text-white/35">
                <p className="font-mono">ID {selected._id}</p>
                <p>Listed {fmtDate(selected.createdAt)}</p>
                <p>Updated {fmtDate(selected.updatedAt)}</p>
              </div>

              <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-4">
                {selected.seller?._id && (
                  <Link
                    href={`/users?userId=${encodeURIComponent(selected.seller._id)}&role=seller`}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-white/12 bg-white/[0.03] px-4 text-sm text-white/55 transition hover:text-[#00E575]"
                  >
                    Open seller on Users
                  </Link>
                )}
                <Button
                  className="h-11 rounded-xl"
                  disabled={busyId === selected._id || showOffline}
                  onClick={() => onToggleActive(selected)}
                >
                  {busyId === selected._id
                    ? "Updating…"
                    : selected.isActive
                      ? "Deactivate listing"
                      : "Activate listing"}
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Product not found"
              body="It may have been removed."
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ProductsDirectory() {
  const { getToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const deepProductId =
    searchParams.get("productId") || searchParams.get("id") || "";

  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<ProductRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>({
    all: 0,
    active: 0,
    inactive: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState<"list" | "grid">("list");
  const [openId, setOpenId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOverride, setDetailOverride] = useState<ProductRow | null>(
    null
  );
  const [busyId, setBusyId] = useState("");
  const [online, setOnline] = useState(true);
  const [stale, setStale] = useState(false);

  const cacheRef = useRef<{
    items: ProductRow[];
    total: number;
    pages: number;
    counts: Counts;
  } | null>(null);
  const deepOpenedRef = useRef<string | null>(null);

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

  const cities = useMemo(() => {
    if (!country) return [] as string[];
    try {
      const states = getStatesForCountry(country) || [];
      return states
        .flatMap((s: { cities?: string[]; cityNames?: string[] }) =>
          s.cities || s.cityNames || []
        )
        .filter(Boolean);
    } catch {
      return [];
    }
  }, [country]);

  const load = useCallback(
    async (p = 1) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (cacheRef.current) {
          setItems(cacheRef.current.items);
          setTotal(cacheRef.current.total);
          setPages(cacheRef.current.pages);
          setCounts(cacheRef.current.counts);
          setStale(true);
          setLoading(false);
        }
        setError("You’re offline.");
        return;
      }
      try {
        setLoading(true);
        setError("");
        const token = await getToken();
        const params = new URLSearchParams();
        params.set("page", String(p));
        params.set("limit", "24");
        if (q.trim()) params.set("q", q.trim());
        if (active) params.set("active", active);
        if (region) params.set("region", region);
        if (country) params.set("country", country);
        if (city) params.set("city", city);
        if (sort) params.set("sort", sort);

        const res = await adminFetch(
          `/admin/products?${params.toString()}`,
          token
        );

        const parsed = parseProductsResponse(res);
        setItems(parsed.list);
        setPage(parsed.page);
        setPages(parsed.pages);
        setTotal(parsed.total);
        setCounts(parsed.counts);
        cacheRef.current = {
          items: parsed.list,
          total: parsed.total,
          pages: parsed.pages,
          counts: parsed.counts,
        };
        setStale(false);
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "message" in e
            ? String((e as { message?: string }).message)
            : "Failed to load products";
        setError(msg);
        if (cacheRef.current) {
          setItems(cacheRef.current.items);
          setStale(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [getToken, q, active, region, country, city, sort]
  );

  useEffect(() => {
    if (!mounted) return;
    void load(1);
  }, [mounted, load]);

  const openModal = useCallback(
    async (id: string) => {
      setOpenId(id);
      setModalOpen(true);
      setDetailOverride(null);
      const inList = items.find((p) => p._id === id);
      if (inList) return;
      try {
        setDetailLoading(true);
        const token = await getToken();
        const res = await adminFetch(`/admin/products/${id}`, token);
        const row = parseProductDetail(res);
        if (row) setDetailOverride(row);
      } catch {
        /* keep null */
      } finally {
        setDetailLoading(false);
      }
    },
    [getToken, items]
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    deepOpenedRef.current = null;
    if (deepProductId) {
      router.replace(pathname);
    }
    window.setTimeout(() => {
      setOpenId(null);
      setDetailOverride(null);
    }, 280);
  }, [deepProductId, pathname, router]);

  useEffect(() => {
    if (!mounted || !deepProductId) return;
    if (deepOpenedRef.current === deepProductId) return;
    deepOpenedRef.current = deepProductId;
    void openModal(deepProductId);
  }, [mounted, deepProductId, openModal]);

  useEffect(() => {
    if (!openId || !modalOpen) return;
    const inList = items.find((p) => p._id === openId);
    if (inList) setDetailOverride(null);
  }, [items, openId, modalOpen]);

  const selected =
    items.find((p) => p._id === openId) || detailOverride || null;

  const toggleActive = async (product: ProductRow) => {
    if (showOffline) {
      setError("You’re offline. Reconnect to change product status.");
      return;
    }
    try {
      setBusyId(product._id);
      const token = await getToken();
      await adminFetch(`/admin/products/${product._id}/active`, token, {
        method: "PATCH",
        body: JSON.stringify({ active: !product.isActive }),
      });
      await load(page);
      if (detailOverride?._id === product._id) {
        setDetailOverride({
          ...detailOverride,
          isActive: !product.isActive,
        });
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : "Update failed";
      setError(msg);
    } finally {
      setBusyId("");
    }
  };

  const clearFilters = () => {
    setQ("");
    setActive("");
    setRegion("");
    setCountry("");
    setCity("");
    setSort("newest");
  };

  const filtersActive = !!(
    q.trim() ||
    active ||
    region ||
    country ||
    city ||
    sort !== "newest"
  );

  const metric = (p: ProductRow) => ({
    views: p.views ?? p.metrics?.views ?? 0,
    cart: p.cartAdds ?? p.metrics?.cartAdds ?? 0,
    checkout: p.checkouts ?? p.metrics?.purchases ?? 0,
  });

  return (
    <div className="relative mx-auto max-w-6xl pb-24 text-[#F5F7FA]">
      {showOffline && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">You’re offline</p>
            <p className="mt-0.5 text-xs text-amber-100/80">
              Catalog actions need a connection.
              {stale
                ? " Showing the last list we loaded."
                : " Reconnect to load products."}
            </p>
          </div>
        </div>
      )}

      <header className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
              CATALOG
            </p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight sm:text-[32px]">
              Products
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] text-white/50">
              Price is the listed amount in that product’s region currency (US
              → USD, DE → EUR, NG → NGN). No live conversion.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs tabular-nums text-white/40">
              <span className="text-[#F5F7FA]">{total.toLocaleString()}</span>{" "}
              in view ·{" "}
              <span className="text-[#F5F7FA]">
                {counts.all.toLocaleString()}
              </span>{" "}
              total
              {stale ? " · cached" : ""}
            </p>
            <Button
              tone="ghost"
              className="h-10 gap-1.5 rounded-full border border-white/12 bg-[#14181F] text-xs"
              disabled={loading || showOffline}
              onClick={() => load(page)}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", loading && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={envTone as "green" | "warn" | "neutral"}>
            <Database className="mr-1 inline h-3 w-3" />
            {envLabel}
          </Badge>
          <Badge tone="blue">
            <Package className="mr-1 inline h-3 w-3" />
            Catalog
          </Badge>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {(
          [
            ["All", "", counts.all],
            ["Active", "true", counts.active],
            ["Inactive", "false", counts.inactive],
          ] as const
        ).map(([label, value, n]) => (
          <button
            key={label}
            type="button"
            onClick={() => setActive(value)}
            className={cn(
              "rounded-2xl border px-3 py-3.5 text-left transition sm:px-4",
              active === value
                ? "border-[#00E575]/35 bg-[#00E575]/10"
                : "border-white/[0.08] bg-white/[0.03] hover:border-white/15"
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
              placeholder="Name, brand, category…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !showOffline && load(1)}
              className="rounded-xl border-white/12 bg-[#14181F] lg:max-w-md"
              disabled={showOffline && !cacheRef.current}
            />
            <Button
              className="rounded-xl"
              onClick={() => load(1)}
              disabled={loading || showOffline}
            >
              {loading ? "Searching…" : "Search"}
            </Button>
            <div className="flex gap-1 rounded-xl border border-white/10 lg:ml-auto">
              <button
                type="button"
                aria-label="List view"
                onClick={() => setView("list")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-l-xl transition",
                  view === "list"
                    ? "bg-[#00E575] text-[#041412]"
                    : "text-white/50 hover:text-[#F5F7FA]"
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
                    : "text-white/50 hover:text-[#F5F7FA]"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <DarkSelect
              value={region}
              onChange={setRegion}
              disabled={showOffline && !cacheRef.current}
            >
              <option value="">All regions</option>
              {(REGION_LIST || []).map((r: { code: string; name: string }) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
            </DarkSelect>

            <DarkSelect
              value={country}
              onChange={(v) => {
                setCountry(v);
                setCity("");
              }}
              disabled={showOffline && !cacheRef.current}
            >
              <option value="">All countries</option>
              {(FULFILLMENT_COUNTRIES || []).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </DarkSelect>

            <DarkSelect
              value={city}
              onChange={setCity}
              disabled={showOffline && !cacheRef.current}
            >
              <option value="">All cities</option>
              {[...new Set(cities)].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </DarkSelect>

            <DarkSelect
              value={sort}
              onChange={setSort}
              disabled={showOffline && !cacheRef.current}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="priceHigh">Price high → low</option>
              <option value="priceLow">Price low → high</option>
              <option value="stockHigh">Stock high → low</option>
              <option value="stockLow">Stock low → high</option>
              <option value="name">Name A–Z</option>
            </DarkSelect>

            <DarkSelect
              value={active}
              onChange={setActive}
              disabled={showOffline && !cacheRef.current}
            >
              <option value="">All status</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
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
          <OrbLoader label="Loading catalog" />
        </div>
      ) : items.length === 0 && !deepProductId ? (
        <EmptyState
          title="No products found"
          body={
            showOffline
              ? "Connect to the internet to load the catalog."
              : "Try another search or clear filters."
          }
        />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => {
            const m = metric(p);
            const reg = listingRegion(p);
            const cur = listingCurrency(p);
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => void openModal(p._id)}
                className={cn(
                  "rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition hover:border-[#00E575]/35",
                  openId === p._id &&
                    modalOpen &&
                    "border-[#00E575]/45 bg-[#00E575]/[0.06]"
                )}
              >
                <div className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="truncate text-xs text-white/40">
                      {p.seller?.storeName || p.seller?.name || "—"}
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-[#00E575]">
                      {fmtListingPrice(p.price, cur)}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                      {reg} · {cur}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={p.isActive ? "green" : "error"}>
                    {p.isActive ? "Active" : "Off"}
                  </Badge>
                  <Badge tone="blue">{reg}</Badge>
                </div>
                <p className="mt-3 text-[11px] tabular-nums text-white/35">
                  {m.views} views · {m.cart} carts · {m.checkout} checkouts
                </p>
              </button>
            );
          })}
        </div>
      ) : items.length > 0 ? (
        <Panel className="overflow-x-auto rounded-2xl border-white/[0.08] bg-white/[0.03]">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.12em] text-white/40">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Seller</th>
                <th className="px-4 py-3 font-semibold">Listed in</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Stock</th>
                <th className="px-4 py-3 font-semibold">Listing price</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const reg = listingRegion(p);
                const cur = listingCurrency(p);
                return (
                  <tr
                    key={p._id}
                    onClick={() => void openModal(p._id)}
                    className={cn(
                      "cursor-pointer border-b border-white/[0.05] transition-colors hover:bg-white/[0.03]",
                      openId === p._id &&
                        modalOpen &&
                        "bg-[#00E575]/[0.06]"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                          {p.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.images[0]}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.name}</p>
                          <p className="truncate text-xs text-white/40">
                            {p.category}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate">
                        {p.seller?.storeName || p.seller?.name || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="blue">{reg}</Badge>
                      <p className="mt-1 text-[10px] text-white/35">
                        {cur}
                        {reg !== "—" ? ` · ${regionName(reg)}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={p.isActive ? "green" : "error"}>
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{p.stock ?? 0}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold tabular-nums text-[#00E575]">
                        {fmtListingPrice(p.price, cur)}
                      </p>
                      <p className="text-[10px] text-white/35">
                        {reg} · {cur}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      ) : null}

      {pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            tone="ghost"
            className="rounded-xl"
            disabled={page <= 1 || loading || showOffline}
            onClick={() => load(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-white/40">
            Page {page} of {pages}
          </span>
          <Button
            tone="ghost"
            className="rounded-xl"
            disabled={page >= pages || loading || showOffline}
            onClick={() => load(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <ProductModal
        open={modalOpen}
        onClose={closeModal}
        selected={selected}
        detailLoading={detailLoading}
        busyId={busyId}
        showOffline={showOffline}
        onToggleActive={toggleActive}
      />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <ProductsGate>
      <ProductsDirectory />
    </ProductsGate>
  );
}