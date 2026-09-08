"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { AppFeaturePrompt, type AppFeature } from "@/components/app/AppFeaturePrompt";
import { ProductCard } from "@/components/mall/ProductCard";
import { ShowroomFlyCartProvider } from "@/components/mall/ShowroomFlyCart";
import { fetchMallProducts, searchSuggest } from "@/lib/api";
import { cartCount } from "@/lib/cart";
import { CATEGORY_TO_FLOOR, FLOORS } from "@/lib/floors";
import { CATEGORY_LIST } from "@/lib/productCatalog";
import type { Product } from "@/lib/types";

const RECENT_KEY = "plazore_recent_searches";
const MAX_RECENT = 8;
const MOVING_NOW_MAX = 14;
const PAGE_SIZE = 20;

type SellerInfo = {
  _id: string;
  name?: string;
  storeName?: string;
  storeLogo?: string;
};

type SortKey =
  | "relevance"
  | "newest"
  | "oldest"
  | "price_high"
  | "price_low"
  | "name_az"
  | "name_za"
  | "views";

type StructureOrder = "products_first" | "stores_first" | "categories_first";

type LocFilter = {
  region: string | null;
  state: string | null;
  city: string | null;
};

function categoryOf(p: Product) {
  return typeof p.category === "string"
    ? p.category
    : String((p.category as any)?.name || "");
}

function getSeller(p: Product): SellerInfo | null {
  const s = p.seller as any;
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

function viewScore(p: Product): number {
  const x = p as any;
  for (const c of [
    x.viewCount,
    x.views,
    x.viewsCount,
    x.impressionCount,
    x.impressions,
    x.openCount,
    x.stats?.views,
    x.stats?.impressions,
    x.analytics?.views,
    x.metrics?.views,
  ]) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

function productPrice(p: Product) {
  const n = Number((p as any).price);
  return Number.isFinite(n) ? n : 0;
}

function productCreated(p: Product) {
  const t = new Date((p as any).createdAt || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function locationBlob(p: Product) {
  const fl = (p as any).fulfillmentLocation || {};
  return [
    fl.displayLabel,
    fl.city,
    fl.state,
    fl.country,
    (p as any).region,
    (p as any).location,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())
    .join(" ");
}

function locParts(p: Product) {
  const fl = (p as any).fulfillmentLocation || {};
  return {
    region: String((p as any).region || fl.region || fl.country || "").trim(),
    state: String(fl.state || "").trim(),
    city: String(fl.city || "").trim(),
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

function textMatch(hay: string, q: string) {
  if (!q) return true;
  const h = hay.toLowerCase();
  if (h.includes(q)) return true;
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length <= 1) return false;
  return tokens.every((t) => h.includes(t));
}

function matchesSearch(p: Product, q: string) {
  if (!q) return true;
  const ql = q.toLowerCase().trim();
  const seller = getSeller(p);
  const store = (seller?.storeName || seller?.name || "").toLowerCase();
  return (
    textMatch((p.name || "").toLowerCase(), ql) ||
    textMatch(((p as any).brand || "").toLowerCase(), ql) ||
    textMatch(categoryOf(p).toLowerCase(), ql) ||
    textMatch(locationBlob(p), ql) ||
    textMatch(store, ql)
  );
}

function sortProducts(list: Product[], sort: SortKey): Product[] {
  const arr = [...list];
  switch (sort) {
    case "newest":
      return arr.sort((a, b) => productCreated(b) - productCreated(a));
    case "oldest":
      return arr.sort((a, b) => productCreated(a) - productCreated(b));
    case "price_high":
      return arr.sort((a, b) => productPrice(b) - productPrice(a));
    case "price_low":
      return arr.sort((a, b) => productPrice(a) - productPrice(b));
    case "name_az":
      return arr.sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, {
          sensitivity: "base",
        }),
      );
    case "name_za":
      return arr.sort((a, b) =>
        (b.name || "").localeCompare(a.name || "", undefined, {
          sensitivity: "base",
        }),
      );
    case "views":
      return arr.sort((a, b) => {
        const d = viewScore(b) - viewScore(a);
        return d !== 0 ? d : productCreated(b) - productCreated(a);
      });
    default:
      return arr;
  }
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "price_high", label: "Price: high → low" },
  { key: "price_low", label: "Price: low → high" },
  { key: "name_az", label: "Name: A → Z" },
  { key: "name_za", label: "Name: Z → A" },
  { key: "views", label: "Most viewed" },
];

const STRUCTURE_OPTIONS: { key: StructureOrder; label: string }[] = [
  { key: "products_first", label: "Products → Stores → Categories" },
  { key: "stores_first", label: "Stores → Products → Categories" },
  { key: "categories_first", label: "Categories → Products → Stores" },
];

function MenuLines() {
  return (
    <span className="inline-flex flex-col justify-center gap-[5px]" aria-hidden>
      <span className="block h-[1.5px] w-[18px] rounded-full bg-current" />
      <span className="block h-[1.5px] w-[18px] rounded-full bg-current" />
      <span className="block h-[1.5px] w-[18px] rounded-full bg-current" />
    </span>
  );
}

const PRODUCT_GRID =
  "grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5";

function BrowseInner() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [serverProducts, setServerProducts] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("relevance");
  const [structure, setStructure] =
    useState<StructureOrder>("products_first");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [loc, setLoc] = useState<LocFilter>({
    region: null,
    state: null,
    city: null,
  });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [bagCount, setBagCount] = useState(0);
  const [appFeature, setAppFeature] = useState<AppFeature | null>(null);

  const refreshBag = useCallback(() => {
    try {
      setBagCount(cartCount());
    } catch {
      setBagCount(0);
    }
  }, []);

  useEffect(() => {
    refreshBag();
    const onStorage = () => refreshBag();
    window.addEventListener("storage", onStorage);
    window.addEventListener("plazore-cart", onStorage as EventListener);
    window.addEventListener("plazore-cart-change", onStorage as EventListener);
    const t = setInterval(refreshBag, 1500);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("plazore-cart", onStorage as EventListener);
      window.removeEventListener(
        "plazore-cart-change",
        onStorage as EventListener,
      );
      clearInterval(t);
    };
  }, [refreshBag]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await fetchMallProducts();
      if (!alive) return;
      setAllProducts(list);
      try {
        const stored = localStorage.getItem(RECENT_KEY);
        if (stored) {
          const p = JSON.parse(stored);
          if (Array.isArray(p)) setRecent(p.slice(0, MAX_RECENT));
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debounced, activeCategory, sortKey, minPrice, maxPrice, inStockOnly, loc]);

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

  const locationIndex = useMemo(() => {
    const regions = new Map<string, number>();
    const states = new Map<string, number>();
    const cities = new Map<string, number>();
    allProducts.forEach((p) => {
      const { region, state, city } = locParts(p);
      if (region) regions.set(region, (regions.get(region) || 0) + 1);
      if (state) states.set(state, (states.get(state) || 0) + 1);
      if (city) cities.set(city, (cities.get(city) || 0) + 1);
    });
    const sortMap = (m: Map<string, number>) =>
      Array.from(m.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count }));
    return {
      regions: sortMap(regions),
      states: sortMap(states),
      cities: sortMap(cities),
    };
  }, [allProducts]);

  const movingNow = useMemo(
    () => sortProducts(allProducts, "views").slice(0, MOVING_NOW_MAX),
    [allProducts],
  );

  const applyLoc = useCallback(
    (list: Product[]) =>
      list.filter((p) => {
        const parts = locParts(p);
        if (
          loc.region &&
          parts.region.toLowerCase() !== loc.region.toLowerCase()
        )
          return false;
        if (loc.state && parts.state.toLowerCase() !== loc.state.toLowerCase())
          return false;
        if (loc.city && parts.city.toLowerCase() !== loc.city.toLowerCase())
          return false;
        return true;
      }),
    [loc],
  );

  const applyPriceStock = useCallback(
    (list: Product[]) => {
      let products = list;
      const min = Number(minPrice);
      const max = Number(maxPrice);
      if (Number.isFinite(min) && min > 0)
        products = products.filter((p) => productPrice(p) >= min);
      if (Number.isFinite(max) && max > 0)
        products = products.filter((p) => productPrice(p) <= max);
      if (inStockOnly)
        products = products.filter((p) => Number((p as any).stock ?? 0) > 0);
      return products;
    },
    [minPrice, maxPrice, inStockOnly],
  );

  const filteredProducts = useMemo(() => {
    const q = debounced.toLowerCase();
    if (!q && !activeCategory) return [] as Product[];
    let products =
      serverProducts.length > 0 && !activeCategory
        ? serverProducts
        : allProducts;
    if (activeCategory) {
      products = products.filter((p) => matchesFloor(p, activeCategory));
    } else if (q) {
      products = products.filter((p) => matchesSearch(p, q));
    }
    products = applyLoc(products);
    products = applyPriceStock(products);
    const effectiveSort =
      sortKey === "relevance" ? (q ? "views" : "newest") : sortKey;
    return sortProducts(products, effectiveSort);
  }, [
    debounced,
    activeCategory,
    serverProducts,
    allProducts,
    applyLoc,
    applyPriceStock,
    sortKey,
  ]);

  const live = useMemo(() => {
    const q = debounced.toLowerCase();
    const products = filteredProducts.slice(0, visibleCount);
    const storesMap = new Map<string, SellerInfo>();
    const brandSet = new Set<string>();
    if (q) {
      allProducts.forEach((p) => {
        const s = getSeller(p);
        if (s) {
          const name = (s.storeName || s.name || "").toLowerCase();
          if (name && textMatch(name, q)) storesMap.set(s._id, s);
        }
        const brand = ((p as any).brand || "").toLowerCase();
        if (brand && textMatch(brand, q)) brandSet.add((p as any).brand);
      });
    }
    const categories = CATEGORY_LIST.filter((c) => {
      if (!q) return false;
      return textMatch(c.toLowerCase(), q);
    }).slice(0, 12);
    return {
      products,
      totalProducts: filteredProducts.length,
      stores: Array.from(storesMap.values()).slice(0, 12),
      brands: Array.from(brandSet).slice(0, 12),
      categories,
    };
  }, [debounced, filteredProducts, visibleCount, allProducts]);

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
      const next = [
        clean,
        ...prev.filter((r) => r.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
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
    setLoc({ region: null, state: null, city: null });
    setSortKey("relevance");
    setVisibleCount(PAGE_SIZE);
  };

  const selectFloor = (id: string) => {
    setQuery("");
    setDebounced("");
    setCategoryLoading(true);
    setActiveCategory(id);
    setTimeout(() => setCategoryLoading(false), 400);
  };

  const locActive = !!(loc.region || loc.state || loc.city);
  const priceActive = !!(minPrice || maxPrice) || inStockOnly;
  const sortActive = sortKey !== "relevance";
  const showFilterBar = isSearching;

  const renderProductsBlock = (products: Product[]) =>
    products.length > 0 ? (
      <div>
        <p className="mb-4 text-[11px] font-bold tracking-[0.12em] text-muted">
          PRODUCTS
        </p>
        <div className={PRODUCT_GRID}>
          {products.map((p) => (
            <div key={p._id} className="min-w-0">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
        {live.totalProducts > visibleCount ? (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="border border-white/20 px-8 py-3 text-[11px] font-semibold tracking-[0.18em] uppercase text-white transition hover:border-white hover:bg-white/5"
            >
              Show more
            </button>
          </div>
        ) : null}
      </div>
    ) : null;

  const renderStoresBlock = () =>
    live.stores.length > 0 ? (
      <div className="mt-12 first:mt-0">
        <p className="mb-4 text-[11px] font-bold tracking-[0.12em] text-muted">
          STOREFRONTS
        </p>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {live.stores.map((s) => (
            <Link
              key={s._id}
              href={`/store/${s._id}`}
              className="w-28 shrink-0 border border-line bg-surface p-3 text-center"
            >
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center overflow-hidden bg-surface-2">
                {s.storeLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.storeLogo}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-muted">⌂</span>
                )}
              </div>
              <p className="truncate text-xs font-semibold">
                {s.storeName || s.name || "Store"}
              </p>
            </Link>
          ))}
        </div>
      </div>
    ) : null;

  const renderCategoriesBlock = () =>
    live.categories.length > 0 ? (
      <div className="mt-12 first:mt-0">
        <p className="mb-4 text-[11px] font-bold tracking-[0.12em] text-muted">
          CATEGORIES
        </p>
        <div className="flex flex-wrap gap-2">
          {live.categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => selectFloor(c)}
              className="border border-line bg-surface px-3.5 py-2 text-sm font-semibold"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    ) : null;

  const renderBrandsBlock = () =>
    live.brands.length > 0 ? (
      <div className="mt-12 first:mt-0">
        <p className="mb-4 text-[11px] font-bold tracking-[0.12em] text-muted">
          BRANDS
        </p>
        <div className="flex flex-wrap gap-2">
          {live.brands.map((b) => (
            <button
              key={b}
              type="button"
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
    ) : null;

  const structuredResults = () => {
    const products = renderProductsBlock(live.products);
    const stores = renderStoresBlock();
    const cats = renderCategoriesBlock();
    const brands = renderBrandsBlock();
    if (structure === "stores_first")
      return (
        <>
          {stores}
          {products}
          {cats}
          {brands}
        </>
      );
    if (structure === "categories_first")
      return (
        <>
          {cats}
          {products}
          {stores}
          {brands}
        </>
      );
    return (
      <>
        {products}
        {stores}
        {cats}
        {brands}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
          {/* Left cluster */}
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/lounge"
              className="flex h-10 w-10 items-center justify-center text-text md:hidden"
              aria-label="Open Lounge"
            >
              <MenuLines />
            </Link>

            <Link href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Plazore"
                className="h-7 w-7 object-contain"
              />
              <span className="hidden text-sm tracking-[0.2em] uppercase sm:inline">
                Plazore
              </span>
            </Link>
          </div>

          {/* Desktop nav — sits mid, does not steal the far-right edge */}
          <nav className="ml-6 hidden flex-1 items-center gap-6 md:flex lg:ml-10 lg:gap-8">
            <Link
              href="/"
              className="text-xs tracking-[0.16em] uppercase text-secondary transition hover:text-text"
            >
              Mall
            </Link>
            <Link
              href="/browse"
              className="text-xs tracking-[0.16em] uppercase text-text"
            >
              Browse
            </Link>

            <Link
              href="/lounge"
              className="relative inline-flex items-center gap-2.5 rounded-full border border-[#00E575]/40 bg-gradient-to-b from-[#00E575]/18 to-[#00E575]/06 px-4 py-2 text-[11px] font-bold tracking-[0.2em] uppercase text-[#00E575] shadow-[0_0_24px_rgba(0,229,117,0.12)] transition hover:border-[#00E575]/60 hover:from-[#00E575]/24 hover:to-[#00E575]/10 hover:shadow-[0_0_28px_rgba(0,229,117,0.2)]"
            >
              Lounge
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00E575] opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00E575]" />
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setAppFeature("wishlist")}
              className="text-xs tracking-[0.16em] uppercase text-secondary transition hover:text-text"
            >
              Wishlist
            </button>
          </nav>

          {/* Bag — far right on every breakpoint; big left margin on large canvas */}
          <Link
            href="/cart"
            className="relative ml-auto flex h-10 w-10 shrink-0 items-center justify-center text-text transition hover:opacity-80 md:ml-20 lg:ml-28 xl:ml-36"
            aria-label={`Bag${bagCount ? `, ${bagCount} items` : ""}`}
            data-plazore-cart-icon
          >
            <ShoppingBag className="h-[22px] w-[22px]" strokeWidth={1.75} />
            {bagCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#00E575] px-1 text-[10px] font-bold leading-none text-[#041412]">
                {bagCount > 99 ? "99+" : bagCount}
              </span>
            ) : null}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl md:text-5xl">
          Browse
        </h1>

        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
          <label className="flex h-14 min-w-0 flex-1 items-center gap-3 border border-line bg-surface px-4 sm:h-12">
            <span className="text-base text-muted sm:text-sm">⌕</span>
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
              placeholder="Name, brand, category, location…"
              className="w-full bg-transparent text-base text-text outline-none placeholder:text-muted sm:text-[15px]"
            />
            {(query || activeCategory || locActive || priceActive) && (
              <button
                type="button"
                onClick={clearAll}
                className="text-lg leading-none text-muted hover:text-text"
              >
                ×
              </button>
            )}
          </label>

          {showFilterBar ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSortOpen(true)}
                className={`h-12 shrink-0 border px-4 text-xs font-semibold tracking-wide ${
                  sortActive || structure !== "products_first"
                    ? "border-ai-green/40 bg-ai-green/10 text-ai-green"
                    : "border-line bg-surface-2 text-text"
                }`}
              >
                Sort
              </button>
              <button
                type="button"
                onClick={() => setPriceOpen(true)}
                className={`h-12 shrink-0 border px-4 text-xs font-semibold tracking-wide ${
                  priceActive
                    ? "border-ai-green/40 bg-ai-green/10 text-ai-green"
                    : "border-line bg-surface-2 text-text"
                }`}
              >
                Price
              </button>
              <button
                type="button"
                onClick={() => setLocOpen(true)}
                className={`h-12 shrink-0 border px-4 text-xs font-semibold tracking-wide ${
                  locActive
                    ? "border-ai-green/40 bg-ai-green/10 text-ai-green"
                    : "border-line bg-surface-2 text-text"
                }`}
              >
                Location
              </button>
            </div>
          ) : null}
        </div>

        {!isSearching ? (
          <div className="mt-10 sm:mt-12">
            <p className="text-[11px] font-bold tracking-[0.12em] text-muted">
              EXPLORE
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {FLOORS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => selectFloor(f.id)}
                  className="relative aspect-[3/4] overflow-hidden border border-line bg-surface text-left sm:aspect-auto sm:h-44"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.images[0]}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
                  <div className="absolute inset-x-3 bottom-3">
                    <p className="text-sm font-semibold">{f.short}</p>
                    <p className="truncate text-[10px] text-white/55">{f.hint}</p>
                  </div>
                </button>
              ))}
            </div>

            {recent.length > 0 ? (
              <div className="mt-12">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold tracking-[0.12em] text-muted">
                    RECENT SEARCHES
                  </p>
                  <button
                    type="button"
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
                      type="button"
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
            ) : null}

            <div className="mt-14">
              <p className="text-[11px] font-bold tracking-[0.12em] text-muted">
                MOVING NOW
              </p>
              <p className="mt-1 text-xs text-secondary">
                Highest viewed products on Plazore
              </p>
              {loading ? (
                <p className="mt-10 text-center text-muted">Loading the mall…</p>
              ) : movingNow.length === 0 ? (
                <p className="mt-10 text-center text-muted">Nothing moving yet.</p>
              ) : (
                <>
                  <div className={`mt-6 ${PRODUCT_GRID}`}>
                    {movingNow.map((p) => (
                      <div key={p._id} className="min-w-0">
                        <ProductCard product={p} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-10 flex justify-center">
                    <Link
                      href="/shop?mode=trending"
                      className="border border-white/20 px-8 py-3 text-[11px] font-semibold tracking-[0.18em] uppercase text-white transition hover:border-white hover:bg-white/5"
                    >
                      Show more
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : categoryLoading ||
          (searchLoading && live.products.length === 0) ? (
          <p className="mt-24 text-center text-muted">Looking through the mall…</p>
        ) : (
          <div className="mt-10">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold sm:text-xl">{activeLabel}</p>
                <p className="mt-1 text-xs text-muted">
                  {[
                    live.totalProducts
                      ? `${Math.min(visibleCount, live.totalProducts)} of ${live.totalProducts} products`
                      : null,
                    live.stores.length
                      ? `${live.stores.length} storefronts`
                      : null,
                    live.brands.length ? `${live.brands.length} brands` : null,
                    live.categories.length
                      ? `${live.categories.length} categories`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={clearAll}
                className="text-sm text-ai-green"
              >
                Clear
              </button>
            </div>
            {structuredResults()}
            {!hasResults && !searchLoading ? (
              <div className="pt-20 text-center">
                <p className="font-bold">Nothing found</p>
                <p className="mt-2 text-secondary">
                  Try another search, sort, price, or location.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {sortOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 md:items-center">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setSortOpen(false)}
            aria-label="Close sort"
          />
          <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto border-t border-line bg-surface p-6 md:border">
            <p className="text-lg font-bold">Sort & layout</p>
            <p className="mt-5 text-sm font-semibold text-secondary">Sort by</p>
            <div className="mt-2 space-y-1">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setSortKey(o.key)}
                  className={`flex w-full items-center justify-between border px-3 py-2.5 text-left text-sm ${
                    sortKey === o.key
                      ? "border-ai-green/40 bg-ai-green/10 font-semibold text-ai-green"
                      : "border-line bg-surface-2"
                  }`}
                >
                  {o.label}
                  {sortKey === o.key ? <span>✓</span> : null}
                </button>
              ))}
            </div>
            <p className="mt-6 text-sm font-semibold text-secondary">
              Result structure
            </p>
            <div className="mt-2 space-y-1">
              {STRUCTURE_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setStructure(o.key)}
                  className={`flex w-full items-center justify-between border px-3 py-2.5 text-left text-sm ${
                    structure === o.key
                      ? "border-ai-green/40 bg-ai-green/10 font-semibold text-ai-green"
                      : "border-line bg-surface-2"
                  }`}
                >
                  {o.label}
                  {structure === o.key ? <span>✓</span> : null}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSortOpen(false)}
              className="mt-8 h-12 w-full bg-text font-bold text-bg"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      {priceOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 md:items-center">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setPriceOpen(false)}
            aria-label="Close price"
          />
          <div className="relative w-full max-w-md border-t border-line bg-surface p-6 md:border">
            <p className="text-lg font-bold">Price filter</p>
            <p className="mt-5 text-sm font-semibold text-secondary">Price range</p>
            <div className="mt-2 flex gap-2">
              <input
                value={minPrice}
                onChange={(e) =>
                  setMinPrice(e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder="Min"
                inputMode="decimal"
                className="h-11 flex-1 border border-line bg-surface-2 px-3 text-sm outline-none"
              />
              <input
                value={maxPrice}
                onChange={(e) =>
                  setMaxPrice(e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder="Max"
                inputMode="decimal"
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
                type="button"
                onClick={() => {
                  setMinPrice("");
                  setMaxPrice("");
                  setInStockOnly(false);
                }}
                className="h-12 flex-1 border border-line bg-surface-2 font-semibold text-secondary"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setPriceOpen(false)}
                className="h-12 flex-1 bg-text font-bold text-bg"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {locOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 md:items-center">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setLocOpen(false)}
            aria-label="Close location"
          />
          <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto border-t border-line bg-surface p-6 md:border">
            <p className="text-lg font-bold">Location</p>
            <p className="mt-1 text-xs text-muted">
              From places already on Plazore products
            </p>
            {locationIndex.regions.length > 0 ? (
              <>
                <p className="mt-5 text-sm font-semibold text-secondary">Region</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {locationIndex.regions.map((r) => (
                    <button
                      key={r.name}
                      type="button"
                      onClick={() =>
                        setLoc((prev) => ({
                          ...prev,
                          region: prev.region === r.name ? null : r.name,
                        }))
                      }
                      className={`border px-3 py-1.5 text-xs font-semibold ${
                        loc.region === r.name
                          ? "border-ai-green/40 bg-ai-green/10 text-ai-green"
                          : "border-line bg-surface-2"
                      }`}
                    >
                      {r.name} · {r.count}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {locationIndex.states.length > 0 ? (
              <>
                <p className="mt-5 text-sm font-semibold text-secondary">State</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {locationIndex.states.map((r) => (
                    <button
                      key={r.name}
                      type="button"
                      onClick={() =>
                        setLoc((prev) => ({
                          ...prev,
                          state: prev.state === r.name ? null : r.name,
                        }))
                      }
                      className={`border px-3 py-1.5 text-xs font-semibold ${
                        loc.state === r.name
                          ? "border-ai-green/40 bg-ai-green/10 text-ai-green"
                          : "border-line bg-surface-2"
                      }`}
                    >
                      {r.name} · {r.count}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {locationIndex.cities.length > 0 ? (
              <>
                <p className="mt-5 text-sm font-semibold text-secondary">City</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {locationIndex.cities.slice(0, 40).map((r) => (
                    <button
                      key={r.name}
                      type="button"
                      onClick={() =>
                        setLoc((prev) => ({
                          ...prev,
                          city: prev.city === r.name ? null : r.name,
                        }))
                      }
                      className={`border px-3 py-1.5 text-xs font-semibold ${
                        loc.city === r.name
                          ? "border-ai-green/40 bg-ai-green/10 text-ai-green"
                          : "border-line bg-surface-2"
                      }`}
                    >
                      {r.name} · {r.count}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {locationIndex.regions.length === 0 &&
            locationIndex.states.length === 0 &&
            locationIndex.cities.length === 0 ? (
              <p className="mt-6 text-sm text-muted">
                No location data on products yet.
              </p>
            ) : null}
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setLoc({ region: null, state: null, city: null })
                }
                className="h-12 flex-1 border border-line bg-surface-2 font-semibold text-secondary"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setLocOpen(false)}
                className="h-12 flex-1 bg-text font-bold text-bg"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {appFeature ? (
        <AppFeaturePrompt
          feature={appFeature}
          onClose={() => setAppFeature(null)}
        />
      ) : null}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <ShowroomFlyCartProvider>
      <BrowseInner />
    </ShowroomFlyCartProvider>
  );
}