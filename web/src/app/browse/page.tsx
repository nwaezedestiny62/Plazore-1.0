"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/mall/ProductCard";
import { fetchMallProducts, searchSuggest } from "@/lib/api";
import { CATEGORY_TO_FLOOR, FLOORS } from "@/lib/floors";
import { CATEGORY_LIST } from "@/lib/productCatalog";
import type { Product } from "@/lib/types";

const RECENT_KEY = "plazore_recent_searches";
const MAX_RECENT = 8;
const NAV = [
  { href: "/", label: "Mall" },
  { href: "/browse", label: "Browse" },
  { href: "/lounge", label: "Lounge" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/cart", label: "Bag" },
];

type SellerInfo = {
  _id: string;
  name?: string;
  storeName?: string;
  storeLogo?: string;
};

function categoryOf(p: Product) {
  return typeof p.category === "string" ? p.category : String(p.category?.name || "");
}

function getSeller(p: Product): SellerInfo | null {
  const s = p.seller;
  if (!s) return null;
  if (typeof s === "string") return { _id: s };
  if (!s._id) return null;
  return {
    _id: String(s._id),
    name: s.name,
    storeName: s.storeName,
    storeLogo: s.storeLogo,
  };
}

function matchesFloor(p: Product, active: string) {
  const catL = categoryOf(p).toLowerCase();
  if (catL === active.toLowerCase()) return true;
  const floor = FLOORS.find((f) => f.id === active);
  if (floor) return floor.match.some((m) => m.toLowerCase() === catL);
  const floorId = CATEGORY_TO_FLOOR[active.toLowerCase()];
  if (floorId) {
    const f = FLOORS.find((x) => x.id === floorId);
    return !!f?.match.some((m) => m.toLowerCase() === catL);
  }
  return false;
}

export default function BrowsePage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [serverProducts, setServerProducts] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await fetchMallProducts();
      if (!alive) return;
      setAllProducts(list);
      setTrending(list.slice(0, 8));
      try {
        const stored = localStorage.getItem(RECENT_KEY);
        if (stored) {
          const p = JSON.parse(stored);
          if (Array.isArray(p)) setRecent(p.slice(0, MAX_RECENT));
        }
      } catch {}
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 240);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debounced.length < 1 || activeCategory) {
      setServerProducts([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    searchSuggest(debounced).then((products) => {
      if (!cancelled) {
        setServerProducts(products);
        setSearchLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, activeCategory]);

  const live = useMemo(() => {
    const q = debounced.toLowerCase();
    if (!q && !activeCategory) {
      return { products: [] as Product[], stores: [] as SellerInfo[], brands: [] as string[], categories: [] as string[] };
    }

    let products = serverProducts.length > 0 ? serverProducts : allProducts;
    if (activeCategory) products = products.filter((p) => matchesFloor(p, activeCategory));
    else if (q) {
      products = products.filter((p) => {
        const name = (p.name || "").toLowerCase();
        const brand = (p.brand || "").toLowerCase();
        const cat = categoryOf(p).toLowerCase();
        return name.includes(q) || brand.includes(q) || cat.includes(q);
      });
    }

    const min = Number(minPrice);
    const max = Number(maxPrice);
    if (Number.isFinite(min) && min > 0) products = products.filter((p) => Number(p.price) >= min);
    if (Number.isFinite(max) && max > 0) products = products.filter((p) => Number(p.price) <= max);
    if (inStockOnly) products = products.filter((p) => Number(p.stock ?? 0) > 0);

    const storesMap = new Map<string, SellerInfo>();
    if (q) {
      allProducts.forEach((p) => {
        const s = getSeller(p);
        if (!s) return;
        const name = (s.storeName || s.name || "").toLowerCase();
        if (name && name.includes(q)) storesMap.set(s._id, s);
      });
    }

    const brandSet = new Set<string>();
    if (q) {
      allProducts.forEach((p) => {
        if (p.brand && p.brand.toLowerCase().includes(q)) brandSet.add(p.brand);
      });
    }

    const categories = CATEGORY_LIST.filter((c) => {
      if (!q) return false;
      const lower = c.toLowerCase();
      return lower.includes(q) || q.split(" ").some((w) => w.length > 2 && lower.includes(w));
    }).slice(0, 10);

    return {
      products: products.slice(0, 24),
      stores: Array.from(storesMap.values()).slice(0, 8),
      brands: Array.from(brandSet).slice(0, 10),
      categories,
    };
  }, [debounced, activeCategory, serverProducts, allProducts, minPrice, maxPrice, inStockOnly]);

  const isSearching = debounced.length > 0 || !!activeCategory;
  const hasResults =
    live.products.length > 0 ||
    live.stores.length > 0 ||
    live.brands.length > 0 ||
    live.categories.length > 0;

  const activeLabel = useMemo(() => {
    if (!activeCategory) return debounced;
    return FLOORS.find((f) => f.id === activeCategory)?.short || activeCategory;
  }, [activeCategory, debounced]);

  const pushRecent = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;
    setRecent((prev) => {
      const next = [clean, ...prev.filter((r) => r.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearAll = () => {
    setQuery("");
    setDebounced("");
    setActiveCategory(null);
    setServerProducts([]);
    setCategoryLoading(false);
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
  };

  const selectFloor = (id: string) => {
    setQuery("");
    setDebounced("");
    setCategoryLoading(true);
    setActiveCategory(id);
    setTimeout(() => setCategoryLoading(false), 650);
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/5 bg-bg/80 px-6 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Plazore" className="h-7 w-7 object-contain" />
          <span className="text-sm tracking-[0.2em] uppercase">Plazore</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-xs tracking-[0.18em] uppercase ${
                item.href === "/browse" ? "text-text" : "text-secondary hover:text-text"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-6xl px-6 pb-24 pt-10">
        <h1 className="font-display text-4xl tracking:text-5xl">Browse</h1>

        <div className="mt-8 flex gap-3">
          <label className="flex h-12 flex-1 items-center gap-3 border border-line bg-surface px-4">
            <span className="text-muted">⌕</span>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (activeCategory) setActiveCategory(null);
                setCategoryLoading(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) pushRecent(query);
              }}
              placeholder="Products, stores, brands…"
              className="w-full bg-transparent text-[15px] text-text outline-none placeholder:text-muted"
            />
            {(query || activeCategory) && (
              <button onClick={clearAll} className="text-muted hover:text-text">
                ×
              </button>
            )}
          </label>
          {isSearching && (
            <button
              onClick={() => setFilterOpen(true)}
              className="h-12 w-12 border border-line bg-surface-2 text-text"
              aria-label="Filters"
            >
              ☰
            </button>
          )}
        </div>

        {!isSearching ? (
          <div className="mt-12">
            <p className="text-[11px] font-bold tracking-[0.12em] text-muted">EXPLORE</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {FLOORS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => selectFloor(f.id)}
                  className="relative h-40 overflow-hidden border border-line bg-surface text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.images[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
                  <div className="absolute inset-x-3 bottom-3">
                    <p className="font-semibold">{f.short}</p>
                    <p className="truncate text-[10px] text-white/55">{f.hint}</p>
                  </div>
                </button>
              ))}
            </div>

            {recent.length > 0 && (
              <div className="mt-12">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold tracking-[0.12em] text-muted">RECENT SEARCHES</p>
                  <button
                    className="text-sm text-ai-green"
                    onClick={() => {
                      setRecent([]);
                      localStorage.removeItem(RECENT_KEY);
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setQuery(r);
                        setDebounced(r);
                        pushRecent(r);
                      }}
                      className="border border-line bg-surface px-3.5 py-2 text-sm"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-12">
              <p className="text-[11px] font-bold tracking-[0.12em] text-muted">MOVING NOW</p>
              {loading ? (
                <p className="mt-10 text-center text-muted">Loading the mall…</p>
              ) : (
                <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {trending.map((p) => (
                    <ProductCard key={p._id} product={p} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : categoryLoading || (searchLoading && live.products.length === 0) ? (
          <p className="mt-24 text-center text-muted">Looking through the mall…</p>
        ) : (
          <div className="mt-10">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold">{activeLabel}</p>
                <p className="mt-1 text-xs text-muted">
                  {[
                    live.products.length ? `${live.products.length} products` : null,
                    live.stores.length ? `${live.stores.length} storefronts` : null,
                    live.brands.length ? `${live.brands.length} brands` : null,
                    live.categories.length ? `${live.categories.length} categories` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button onClick={clearAll} className="text-sm text-ai-green">
                Clear
              </button>
            </div>

            {live.products.length > 0 && (
              <div>
                <p className="mb-4 text-[11px] font-bold tracking-[0.12em] text-muted">PRODUCTS</p>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {live.products.map((p) => (
                    <ProductCard key={p._id} product={p} />
                  ))}
                </div>
              </div>
            )}

            {live.stores.length > 0 && (
              <div className="mt-12">
                <p className="mb-4 text-[11px] font-bold tracking-[0.12em] text-muted">STOREFRONTS</p>
                <div className="flex gap-3 overflow-x-auto">
                  {live.stores.map((s) => (
                    <Link
                      key={s._id}
                      href={`/store/${s._id}`}
                      className="w-28 shrink-0 border border-line bg-surface p-3 text-center"
                    >
                      <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center overflow-hidden bg-surface-2">
                        {s.storeLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.storeLogo} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-muted">⌂</span>
                        )}
                      </div>
                      <p className="truncate text-xs font-semibold">{s.storeName || s.name || "Store"}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {live.brands.length > 0 && (
              <div className="mt-12">
                <p className="mb-4 text-[11px] font-bold tracking-[0.12em] text-muted">BRANDS</p>
                <div className="flex flex-wrap gap-2">
                  {live.brands.map((b) => (
                    <button
                      key={b}
                      onClick={() => {
                        setQuery(b);
                        setDebounced(b);
                        pushRecent(b);
                      }}
                      className="border border-ai-green/25 bg-ai-green/10 px-3.5 py-2 text-sm font-semibold text-ai-green"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {live.categories.length > 0 && (
              <div className="mt-12">
                <p className="mb-4 text-[11px] font-bold tracking-[0.12em] text-muted">CATEGORIES</p>
                <div className="flex flex-wrap gap-2">
                  {live.categories.map((c) => (
                    <button
                      key={c}
                      onClick={() => selectFloor(c)}
                      className="border border-line bg-surface px-3.5 py-2 text-sm font-semibold"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!hasResults && !searchLoading && (
              <div className="pt-20 text-center">
                <p className="font-bold">Nothing found</p>
                <p className="mt-2 text-secondary">Try another search or browse by category.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {filterOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 md:items-center">
          <button className="absolute inset-0" onClick={() => setFilterOpen(false)} aria-label="Close filters" />
          <div className="relative w-full max-w-md border-t border-line bg-surface p-6 md:border">
            <p className="text-lg font-bold">Filters</p>
            <p className="mt-5 text-sm font-semibold text-secondary">Price range</p>
            <div className="mt-2 flex gap-2">
              <input
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Min"
                className="h-11 flex-1 border border-line bg-surface-2 px-3 text-sm outline-none"
              />
              <input
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max"
                className="h-11 flex-1 border border-line bg-surface-2 px-3 text-sm outline-none"
              />
            </div>
            <label className="mt-6 flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
              />
              In stock only
            </label>
            <div className="mt-8 flex gap-3">
              <button
                onClick={() => {
                  setMinPrice("");
                  setMaxPrice("");
                  setInStockOnly(false);
                  setFilterOpen(false);
                }}
                className="h-12 flex-1 border border-line bg-surface-2 font-semibold text-secondary"
              >
                Reset
              </button>
              <button
                onClick={() => setFilterOpen(false)}
                className="h-12 flex-1 bg-text font-bold text-bg"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}