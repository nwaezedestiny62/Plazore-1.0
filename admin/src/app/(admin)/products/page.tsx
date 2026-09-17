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

function locLabel(p: ProductRow) {
  return (
    p.fulfillmentLocation?.displayLabel ||
    [p.fulfillmentLocation?.city, p.fulfillmentLocation?.state, p.region]
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
        className,
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
                  : "border-white/10 hover:border-[#00E575]/35",
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
  openId,
  busyId,
  showOffline,
  onToggleActive,
}: {
  open: boolean;
  onClose: () => void;
  selected: ProductRow | null;
  detailLoading: boolean;
  openId: string | null;
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
                  <Badge tone="neutral">
                    {selected.region || "No region"}
                  </Badge>
                  <Badge tone={(selected.stock ?? 0) > 0 ? "green" : "warn"}>
                    Stock {selected.stock ?? 0}
                  </Badge>
                </div>
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

              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                  Price
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {Number(selected.price || 0).toLocaleString()}
                </p>
              </div>

              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                <SectionLabel>Seller</SectionLabel>
                <Field label="Store">
                  {selected.seller?.storeName || selected.seller?.name || "—"}
                </Field>
                <Field label="Email">{selected.seller?.email || "—"}</Field>
                {selected.seller?.isSellerSuspended && (
                  <Badge tone="error">Seller suspended</Badge>
                )}
              </div>

              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                <SectionLabel>Fulfillment</SectionLabel>
                <Field label="Location">{locLabel(selected)}</Field>
                <Field label="City">
                  {selected.fulfillmentLocation?.city || "—"}
                </Field>
                <Field label="State">
                  {selected.fulfillmentLocation?.state || "—"}
                </Field>
                <Field label="Country">
                  {selected.fulfillmentLocation?.country || "—"}
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
                {(selected.wishlistCount ?? 0) > 0 && (
                  <p>Wishlist saves: {selected.wishlistCount}</p>
                )}
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
                  className="rounded-xl"
                  tone={selected.isActive ? "danger" : "primary"}
                  disabled={busyId === selected._id || showOffline}
                  onClick={() => onToggleActive(selected)}
                >
                  {selected.isActive
                    ? "Deactivate product"
                    : "Activate product"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center">
              <p className="text-sm text-white/50">
                Product not found in catalog.
              </p>
              <p className="mt-1 font-mono text-[11px] text-white/30">
                {openId}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ProductsDirectory() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

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

  const deepProductId = (searchParams.get("productId") || "").trim();
  const deepOpenedRef = useRef<string | null>(null);

  const [mounted, setMounted] = useState(false);
  const [offline, setOffline] = useState(false);

  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState<"list" | "grid">("list");

  const [items, setItems] = useState<ProductRow[]>([]);
  const [counts, setCounts] = useState<Counts>({
    all: 0,
    active: 0,
    inactive: 0,
  });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [busyId, setBusyId] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOverride, setDetailOverride] = useState<ProductRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const cacheRef = useRef<{
    items: ProductRow[];
    counts: Counts;
    total: number;
    pages: number;
    page: number;
  } | null>(null);

  const showOffline = mounted && offline;

  const cities = useMemo(() => {
    if (!country) {
      return FULFILLMENT_COUNTRIES.flatMap((c) =>
        c.states.flatMap((s: any) => s.cities || []),
      );
    }
    return getStatesForCountry(country).flatMap((s: any) => s.cities || []);
  }, [country]);

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

  const load = useCallback(
    async (p = 1) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setOffline(true);
        if (cacheRef.current) {
          setItems(cacheRef.current.items);
          setCounts(cacheRef.current.counts);
          setTotal(cacheRef.current.total);
          setPages(cacheRef.current.pages);
          setPage(cacheRef.current.page);
          setStale(true);
          setError(
            "You’re offline. Showing the last loaded catalog — reconnect to refresh.",
          );
          setLoading(false);
          return;
        }
        setError("You’re offline. Connect to load products.");
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
          sort,
        });
        if (q.trim()) params.set("q", q.trim());
        if (active) params.set("active", active);
        if (region) params.set("region", region);
        if (city) params.set("city", city);

        const json = await adminFetch<any>(`/admin/products?${params}`, token);
        const nextItems = json.data || [];
        const nextCounts = json.counts || {
          all: 0,
          active: 0,
          inactive: 0,
        };
        const nextTotal = json.pagination?.total || 0;
        const nextPages = json.pagination?.pages || 1;
        const nextPage = json.pagination?.page || p;

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
      } catch (e: any) {
        if (cacheRef.current) {
          setItems(cacheRef.current.items);
          setCounts(cacheRef.current.counts);
          setTotal(cacheRef.current.total);
          setPages(cacheRef.current.pages);
          setPage(cacheRef.current.page);
          setStale(true);
          setError(
            e?.message
              ? `${e.message} — showing last successful load.`
              : "Request failed — showing last successful load.",
          );
        } else {
          setError(e?.message || "Failed to load products");
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [getToken, q, active, region, city, sort],
  );

  useEffect(() => {
    if (!mounted) return;
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, active, region, city, sort]);

  const fetchProductById = useCallback(
    async (id: string) => {
      try {
        setDetailLoading(true);
        const token = await getToken();
        if (!token) return null;

        try {
          const one = await adminFetch<{ data?: ProductRow }>(
            `/admin/products/${id}`,
            token,
          );
          if (one?.data?._id) return one.data;
        } catch {
          /* fall through */
        }

        const params = new URLSearchParams({
          page: "1",
          limit: "5",
          q: id,
        });
        const json = await adminFetch<{ data?: ProductRow[] }>(
          `/admin/products?${params}`,
          token,
        );
        const hit = (json.data || []).find((p) => p._id === id);
        return hit || null;
      } catch {
        return null;
      } finally {
        setDetailLoading(false);
      }
    },
    [getToken],
  );

  const openModal = useCallback(
    async (id: string) => {
      setOpenId(id);
      setModalOpen(true);

      const inList =
        items.find((p) => p._id === id) ||
        cacheRef.current?.items.find((p) => p._id === id);

      if (inList) {
        setDetailOverride(null);
        return;
      }

      setDetailOverride(null);
      const fetched = await fetchProductById(id);
      if (fetched) setDetailOverride(fetched);
    },
    [items, fetchProductById],
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

  // Auto-open from Reports / other pages: /products?productId=xxx
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
    } catch (e: any) {
      setError(e.message || "Update failed");
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
              Search, filter, and inspect listings. Deep links from Reports open
              the product modal automatically.
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
          <Badge tone={envTone as any}>
            <Database className="mr-1 inline h-3 w-3" />
            {envLabel}
          </Badge>
          <Badge tone="blue">
            <Package className="mr-1 inline h-3 w-3" />
            Catalog
          </Badge>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              showOffline
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                : "border-[#00E575]/25 bg-[#00E575]/10 text-[#00E575]",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                showOffline ? "bg-amber-400" : "bg-[#00E575]",
              )}
            />
            {showOffline ? "Offline" : "Live"}
          </span>
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
                : "border-white/[0.08] bg-white/[0.03] hover:border-white/15",
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
                    : "text-white/50 hover:text-[#F5F7FA]",
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
                    : "text-white/50 hover:text-[#F5F7FA]",
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
              {REGION_LIST.map((r: any) => (
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
              {FULFILLMENT_COUNTRIES.map((c) => (
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
              <option value="viewsHigh">Views high → low</option>
              <option value="viewsLow">Views low → high</option>
              <option value="cartHigh">Cart adds high → low</option>
              <option value="cartLow">Cart adds low → high</option>
              <option value="checkoutHigh">Checkouts high → low</option>
              <option value="checkoutLow">Checkouts low → high</option>
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
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => void openModal(p._id)}
                className={cn(
                  "rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition hover:border-[#00E575]/35",
                  openId === p._id &&
                    modalOpen &&
                    "border-[#00E575]/45 bg-[#00E575]/[0.06]",
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
                    <p className="mt-1 text-sm font-semibold tabular-nums">
                      {Number(p.price || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={p.isActive ? "green" : "error"}>
                    {p.isActive ? "Active" : "Off"}
                  </Badge>
                  <Badge tone="neutral">{p.region || "—"}</Badge>
                  <Badge tone={(p.stock ?? 0) > 0 ? "green" : "warn"}>
                    Stock {p.stock ?? 0}
                  </Badge>
                </div>
                <p className="mt-3 text-[11px] tabular-nums text-white/35">
                  {m.views} views · {m.cart} carts · {m.checkout} checkouts
                  {(p.images?.length || 0) > 1
                    ? ` · ${p.images!.length} photos`
                    : ""}
                </p>
              </button>
            );
          })}
        </div>
      ) : items.length > 0 ? (
        <Panel className="overflow-x-auto rounded-2xl border-white/[0.08] bg-white/[0.03]">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.12em] text-white/40">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Seller</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Stock</th>
                <th className="px-4 py-3 font-semibold">Views</th>
                <th className="px-4 py-3 font-semibold">Carts</th>
                <th className="px-4 py-3 font-semibold">Checkouts</th>
                <th className="px-4 py-3 font-semibold">Price</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const m = metric(p);
                return (
                  <tr
                    key={p._id}
                    onClick={() => void openModal(p._id)}
                    className={cn(
                      "cursor-pointer border-b border-white/[0.05] transition-colors hover:bg-white/[0.03]",
                      openId === p._id &&
                        modalOpen &&
                        "bg-[#00E575]/[0.06]",
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
                            {p.brand ? ` · ${p.brand}` : ""}
                            {(p.images?.length || 0) > 1
                              ? ` · ${p.images!.length} imgs`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate">
                        {p.seller?.storeName || p.seller?.name || "—"}
                      </p>
                      <p className="truncate text-xs text-white/40">
                        {p.seller?.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-white/55">
                      <p className="truncate">{locLabel(p)}</p>
                      <p className="text-[11px] text-white/35">
                        {p.region || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={p.isActive ? "green" : "error"}>
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <Badge tone={(p.stock ?? 0) > 0 ? "green" : "warn"}>
                        {p.stock ?? 0}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-white/50">
                      {m.views.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-white/50">
                      {m.cart.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-white/50">
                      {m.checkout.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {Number(p.price || 0).toLocaleString()}
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
        openId={openId}
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