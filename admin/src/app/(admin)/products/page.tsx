"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, List, RefreshCw, WifiOff, X } from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Input,
  Panel,
  Select,
  cn,
} from "@/components/ui";
import { REGION_LIST } from "@/lib/region";
import { FULFILLMENT_COUNTRIES, getStatesForCountry } from "@/lib/location";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

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

/** All product images — hero + responsive thumb grid */
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
      <div className="flex aspect-[4/3] w-full items-center justify-center border border-[#252A33] bg-[#171B22] text-xs text-[#737A86]">
        No images
      </div>
    );
  }

  const hero = list[Math.min(active, list.length - 1)];

  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/3] w-full overflow-hidden border border-[#252A33] bg-[#171B22]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero}
          alt={name || "Product"}
          className="h-full w-full object-cover"
        />
        {list.length > 1 && (
          <span className="absolute bottom-2 right-2 border border-[#252A33]/80 bg-[#0C0F14]/85 px-2 py-0.5 text-[10px] tabular-nums text-[#A7ADB8]">
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
                "aspect-square overflow-hidden border bg-[#171B22] transition",
                i === active
                  ? "border-[#00E575] ring-1 ring-[#00E575]/40"
                  : "border-[#252A33] hover:border-[#00E575]/35"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  const { getToken } = useAuth();

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
  const [paneOpen, setPaneOpen] = useState(false);

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
        c.states.flatMap((s: any) => s.cities || [])
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
            "You’re offline. Showing the last loaded catalog — reconnect to refresh."
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
              : "Request failed — showing last successful load."
          );
        } else {
          setError(e?.message || "Failed to load products");
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [getToken, q, active, region, city, sort]
  );

  useEffect(() => {
    if (!mounted) return;
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, active, region, city, sort]);

  const openPane = (id: string) => {
    setOpenId(id);
    setPaneOpen(true);
  };

  const closePane = () => {
    setPaneOpen(false);
    window.setTimeout(() => setOpenId(null), 280);
  };

  const selected = items.find((p) => p._id === openId) || null;

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
    <div
      className={cn(
        poppins.className,
        "relative min-h-[70vh] pb-28 text-[#F5F7FA]"
      )}
    >
      {showOffline && (
        <div className="mb-4 flex items-start gap-3 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
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

      <header className="mb-6 border-b border-[#252A33] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
            Catalog
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-medium",
              showOffline
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                : "border-[#00E575]/25 bg-[#00E575]/10 text-[#00E575]"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                showOffline ? "bg-amber-400" : "bg-[#00E575]"
              )}
            />
            {showOffline ? "Offline" : "Live"}
          </span>
        </div>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-semibold leading-none tracking-tight sm:text-[28px]">
              Products
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#A7ADB8]">
              Search, filter, and inspect listings. All images show in the
              detail pane.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs tabular-nums text-[#737A86]">
              <span className="text-[#F5F7FA]">{total.toLocaleString()}</span> in
              view ·{" "}
              <span className="text-[#F5F7FA]">
                {counts.all.toLocaleString()}
              </span>{" "}
              total
              {stale ? " · cached" : ""}
            </p>
            <Button
              tone="ghost"
              className="h-9 gap-1.5 text-xs"
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
      </header>

      <div className="mb-4 grid grid-cols-3 gap-px overflow-hidden border border-[#252A33] bg-[#252A33]">
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
              "bg-[#11141A] px-3 py-3.5 text-left transition sm:px-4",
              active === value &&
                "bg-[#041412] ring-1 ring-inset ring-[#00E575]/30"
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              {label}
            </p>
            <p className="mt-1.5 text-[22px] font-semibold tabular-nums leading-none">
              {Number(n).toLocaleString()}
            </p>
          </button>
        ))}
      </div>

      <Panel className="mb-4 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#252A33] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
            Filters
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-[#A7ADB8] hover:text-[#00E575]"
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
              className="lg:max-w-md"
              disabled={showOffline && !cacheRef.current}
            />
            <Button onClick={() => load(1)} disabled={loading || showOffline}>
              {loading ? "Searching…" : "Search"}
            </Button>
            <div className="flex gap-1 border border-[#252A33] lg:ml-auto">
              <button
                type="button"
                aria-label="List view"
                onClick={() => setView("list")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center transition",
                  view === "list"
                    ? "bg-[#00E575] text-[#041412]"
                    : "text-[#A7ADB8] hover:text-[#F5F7FA]"
                )}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setView("grid")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center transition",
                  view === "grid"
                    ? "bg-[#00E575] text-[#041412]"
                    : "text-[#A7ADB8] hover:text-[#F5F7FA]"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={showOffline && !cacheRef.current}
            >
              <option value="">All regions</option>
              {REGION_LIST.map((r: any) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
            </Select>

            <Select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
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
            </Select>

            <Select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={showOffline && !cacheRef.current}
            >
              <option value="">All cities</option>
              {[...new Set(cities)].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>

            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
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
            </Select>

            <Select
              value={active}
              onChange={(e) => setActive(e.target.value)}
              disabled={showOffline && !cacheRef.current}
            >
              <option value="">All status</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </Select>
          </div>
        </div>
      </Panel>

      {error && (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="border border-[#252A33] bg-[#11141A]">
          <OrbLoader label="Loading catalog" />
        </div>
      ) : items.length === 0 ? (
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
                onClick={() => openPane(p._id)}
                className={cn(
                  "border border-[#252A33] bg-[#11141A] p-4 text-left transition hover:border-[#00E575]/35",
                  openId === p._id &&
                    paneOpen &&
                    "border-[#00E575]/45 bg-[#00E575]/5"
                )}
              >
                <div className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden border border-[#252A33] bg-[#171B22]">
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
                    <p className="truncate text-xs text-[#737A86]">
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
                <p className="mt-3 text-[11px] tabular-nums text-[#737A86]">
                  {m.views} views · {m.cart} carts · {m.checkout} checkouts
                  {(p.images?.length || 0) > 1
                    ? ` · ${p.images!.length} photos`
                    : ""}
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-[#252A33] text-[11px] uppercase tracking-[0.12em] text-[#737A86]">
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
                    onClick={() => openPane(p._id)}
                    className={cn(
                      "cursor-pointer border-b border-[#252A33]/70 transition-colors hover:bg-[#171B22]/80",
                      openId === p._id && paneOpen && "bg-[#00E575]/[0.06]"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden border border-[#252A33] bg-[#171B22]">
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
                          <p className="truncate text-xs text-[#737A86]">
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
                      <p className="truncate text-xs text-[#737A86]">
                        {p.seller?.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[#A7ADB8]">
                      <p className="truncate">{locLabel(p)}</p>
                      <p className="text-[11px] text-[#737A86]">
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
                    <td className="px-4 py-3 tabular-nums text-[#A7ADB8]">
                      {m.views.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[#A7ADB8]">
                      {m.cart.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[#A7ADB8]">
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
      )}

      {pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            tone="ghost"
            disabled={page <= 1 || loading || showOffline}
            onClick={() => load(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-[#737A86]">
            Page {page} of {pages}
          </span>
          <Button
            tone="ghost"
            disabled={page >= pages || loading || showOffline}
            onClick={() => load(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
          paneOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
        onClick={closePane}
        aria-hidden
      />

      <aside
        className={cn(
          poppins.className,
          "fixed top-0 right-0 z-50 flex h-full w-full max-w-[440px] flex-col border-l border-[#252A33] bg-[#0C0F14] shadow-2xl transition-transform duration-300 ease-out",
          paneOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#252A33] px-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00E575]">
              Listing
            </p>
            <p className="text-sm font-medium">Product detail</p>
          </div>
          <button
            type="button"
            onClick={closePane}
            className="flex h-9 w-9 items-center justify-center border border-[#252A33] bg-[#171B22] text-[#A7ADB8] transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {selected && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold leading-snug">
                  {selected.name}
                </h2>
                <p className="mt-1 text-sm text-[#A7ADB8]">
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
                  <Badge
                    tone={(selected.stock ?? 0) > 0 ? "green" : "warn"}
                  >
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
                      <div className="border border-[#252A33] bg-[#11141A] p-3">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                          Views
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {m.views.toLocaleString()}
                        </p>
                      </div>
                      <div className="border border-[#252A33] bg-[#11141A] p-3">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                          Cart adds
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {m.cart.toLocaleString()}
                        </p>
                      </div>
                      <div className="border border-[#252A33] bg-[#11141A] p-3">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
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

              <div className="border border-[#252A33] bg-[#11141A] p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                  Price
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {Number(selected.price || 0).toLocaleString()}
                </p>
              </div>

              <div className="space-y-3 border-t border-[#252A33] pt-4">
                <SectionLabel>Seller</SectionLabel>
                <Field label="Store">
                  {selected.seller?.storeName || selected.seller?.name || "—"}
                </Field>
                <Field label="Email">{selected.seller?.email || "—"}</Field>
                {selected.seller?.isSellerSuspended && (
                  <Badge tone="error">Seller suspended</Badge>
                )}
              </div>

              <div className="space-y-3 border-t border-[#252A33] pt-4">
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
                <div className="space-y-2 border-t border-[#252A33] pt-4">
                  <SectionLabel>Description</SectionLabel>
                  <p className="text-sm leading-relaxed text-[#A7ADB8]">
                    {selected.description}
                  </p>
                </div>
              )}

              <div className="space-y-2 border-t border-[#252A33] pt-4 text-xs text-[#737A86]">
                <p className="font-mono">ID {selected._id}</p>
                <p>Listed {fmtDate(selected.createdAt)}</p>
                <p>Updated {fmtDate(selected.updatedAt)}</p>
                {(selected.wishlistCount ?? 0) > 0 && (
                  <p>Wishlist saves: {selected.wishlistCount}</p>
                )}
              </div>

              <div className="flex flex-col gap-2 border-t border-[#252A33] pt-4">
                {selected.seller?._id && (
                  <Link
                    href={`/users?userId=${encodeURIComponent(selected.seller._id)}&role=seller`}
                    className="inline-flex h-10 items-center justify-center border border-[#252A33] bg-[#171B22] px-4 text-sm text-[#A7ADB8] transition hover:text-[#00E575]"
                  >
                    Open seller on Users
                  </Link>
                )}
                <Button
                  tone={selected.isActive ? "danger" : "primary"}
                  disabled={busyId === selected._id || showOffline}
                  onClick={() => toggleActive(selected)}
                >
                  {selected.isActive
                    ? "Deactivate product"
                    : "Activate product"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}