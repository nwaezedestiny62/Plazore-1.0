"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  Suspense,
  memo,
} from "react";
import {
  ShoppingBag,
  SlidersHorizontal,
  MapPin,
  Tag,
  Store,
  Package,
  Sparkles,
  Clock,
  Layers,
  Building2,
  Search,
  X,
} from "lucide-react";
import { AppFeaturePrompt, type AppFeature } from "@/components/app/AppFeaturePrompt";
import { ProductCard } from "@/components/mall/ProductCard";
import {
  ShowroomFlyCartProvider,
  useShowroomFlyCart,
} from "@/components/mall/ShowroomFlyCart";
import {
  fetchMallProducts,
  fetchSearchSuggest,
  type SearchSuggestItem,
} from "@/lib/api";
import { cartCount } from "@/lib/cart";
import { CATEGORY_TO_FLOOR, FLOORS } from "@/lib/floors";
import { CATEGORY_LIST } from "@/lib/productCatalog";
import type { Product } from "@/lib/types";
import { useMarketplace } from "@/context/MarketplaceContext";
import { DEFAULT_REGION } from "@/lib/regions";

const RECENT_KEY = "plazore_recent_searches";
const MAX_RECENT = 8;
const MOVING_NOW_MAX = 14;
const PAGE_SIZE = 20;
const SUGGEST_MS = 90;
const SEARCH_MS = 140;

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

type SpecFilter = Record<string, string[]>;
type SuggestionKind = SearchSuggestItem["kind"] | "recent";

type Suggestion = {
  id: string;
  kind: SuggestionKind;
  label: string;
  sub?: string;
  value: string;
  meta?: string;
  image?: string;
  score?: number;
};

/* ───────── helpers ───────── */

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
    x.stats?.views,
    x.analytics?.views,
  ]) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

function productPrice(p: Product) {
  const x = p as any;
  for (const c of [x.price, x.salePrice, x.displayPrice, x.amount]) {
    const n = typeof c === "string" ? parseFloat(c) : Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function productCreated(p: Product) {
  const t = new Date((p as any).createdAt || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function getSpecs(p: Product): Record<string, string> {
  const raw = (p as any).specifications;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  if (raw instanceof Map) {
    raw.forEach((v: any, k: any) => {
      const key = String(k || "").trim();
      const val = String(v ?? "").trim();
      if (key && val) out[key] = val;
    });
    return out;
  }
  Object.entries(raw).forEach(([k, v]) => {
    const key = String(k || "").trim();
    const val = String(v ?? "").trim();
    if (key && val) out[key] = val;
  });
  return out;
}

function locationBlob(p: Product) {
  const fl = (p as any).fulfillmentLocation || {};
  return [fl.displayLabel, fl.city, fl.state, fl.country, (p as any).region]
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
  const ql = q.toLowerCase().trim();
  if (h.includes(ql)) return true;
  const tokens = ql.split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length <= 1) return false;
  return tokens.every((t) => h.includes(t));
}

function matchScore(label: string, q: string): number {
  const h = (label || "").toLowerCase().trim();
  const ql = q.toLowerCase().trim();
  if (!ql || !h) return 0;
  if (h === ql) return 100;
  if (h.startsWith(ql)) return 80;
  if (h.includes(ql)) return 60;
  const tokens = ql.split(/\s+/).filter((t) => t.length > 1);
  if (!tokens.length) return 0;
  return (tokens.filter((t) => h.includes(t)).length / tokens.length) * 40;
}

function matchesSearch(p: Product, q: string) {
  if (!q) return true;
  const ql = q.toLowerCase().trim();
  const seller = getSeller(p);
  const store = (seller?.storeName || seller?.name || "").toLowerCase();
  const specs = getSpecs(p);
  const specBlob = Object.entries(specs)
    .map(([k, v]) => `${k} ${v}`)
    .join(" ")
    .toLowerCase();
  return (
    textMatch((p.name || "").toLowerCase(), ql) ||
    textMatch(String((p as any).brand || "").toLowerCase(), ql) ||
    textMatch(categoryOf(p).toLowerCase(), ql) ||
    textMatch(locationBlob(p), ql) ||
    textMatch(store, ql) ||
    textMatch(specBlob, ql) ||
    textMatch(String((p as any).description || "").toLowerCase(), ql)
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
        (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }),
      );
    case "name_za":
      return arr.sort((a, b) =>
        (b.name || "").localeCompare(a.name || "", undefined, { sensitivity: "base" }),
      );
    case "views":
    case "relevance":
      return arr.sort((a, b) => {
        const d = viewScore(b) - viewScore(a);
        return d !== 0 ? d : productCreated(b) - productCreated(a);
      });
    default:
      return arr;
  }
}

function toApiSort(sort: SortKey, hasQuery: boolean): string | undefined {
  switch (sort) {
    case "newest":
      return "newest";
    case "oldest":
      return "oldest";
    case "price_high":
      return "price_desc";
    case "price_low":
      return "price_asc";
    case "name_az":
      return "name";
    case "name_za":
      return "name_za";
    case "views":
      return "trending";
    case "relevance":
      return hasQuery ? "trending" : "newest";
    default:
      return undefined;
  }
}

function resolveCategoryParam(active: string | null): string | undefined {
  if (!active) return undefined;
  const floor = FLOORS.find((f) => f.id === active);
  if (floor) return floor.match.length === 1 ? floor.match[0] : undefined;
  return active;
}

function floorImageForCategory(name: string): string | undefined {
  const n = name.toLowerCase();
  const floor =
    FLOORS.find((f) => f.id === n || f.short.toLowerCase() === n) ||
    FLOORS.find((f) => f.match.some((m) => m.toLowerCase() === n));
  return floor?.images?.[0];
}

function parseSpecsFromParams(sp: URLSearchParams): SpecFilter {
  const out: SpecFilter = {};
  sp.forEach((val, key) => {
    if (!key.startsWith("spec.")) return;
    const specKey = key.slice(5);
    if (!specKey || !val) return;
    out[specKey] = val
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  });
  return out;
}

/* ───────── UI atoms ───────── */

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

const PRODUCT_GRID =
  "grid w-full grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 md:grid-cols-3 md:gap-x-6 md:gap-y-11 lg:grid-cols-4 lg:gap-y-12 xl:grid-cols-5 xl:gap-x-7";

function MenuLines() {
  return (
    <span className="inline-flex flex-col justify-center gap-[5px]" aria-hidden>
      <span className="block h-[1.5px] w-[18px] rounded-full bg-current" />
      <span className="block h-[1.5px] w-[18px] rounded-full bg-current" />
      <span className="block h-[1.5px] w-[18px] rounded-full bg-current" />
    </span>
  );
}

const ProductCell = memo(function ProductCell({ product }: { product: Product }) {
  return (
    <div className="plazore-product-cell min-w-0 w-full [&>*]:!block [&>*]:!h-full [&>*]:!w-full [&>*]:!max-w-none [&_a]:!block [&_a]:!w-full [&_img]:!w-full">
      <ProductCard product={product} />
    </div>
  );
});

function OrbLoader({ label, compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center ${
        compact ? "py-16" : "min-h-[45vh] py-20 sm:min-h-[55vh]"
      }`}
    >
      <div
        className={`relative flex items-center justify-center ${
          compact ? "h-16 w-16 sm:h-20 sm:w-20" : "h-[90px] w-[90px] sm:h-[110px] sm:w-[110px]"
        }`}
      >
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#00E575] border-r-[#3B82F6]" />
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00E575]/10 sm:h-12 sm:w-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-5 w-5 object-contain sm:h-6 sm:w-6" />
        </div>
      </div>
      {label ? <p className="mt-5 text-[13px] text-muted">{label}</p> : null}
    </div>
  );
}

function SuggestSpinner() {
  return (
    <div className="flex items-center justify-center py-7">
      <span className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-transparent border-t-[#00E575] border-r-[#3B82F6]" />
    </div>
  );
}

function kindIcon(kind: SuggestionKind) {
  const c = "h-4 w-4";
  switch (kind) {
    case "product":
      return <Package className={c} strokeWidth={1.75} />;
    case "store":
      return <Store className={c} strokeWidth={1.75} />;
    case "brand":
      return <Sparkles className={c} strokeWidth={1.75} />;
    case "category":
      return <Layers className={c} strokeWidth={1.75} />;
    case "spec":
      return <Tag className={c} strokeWidth={1.75} />;
    case "location":
      return <MapPin className={c} strokeWidth={1.75} />;
    case "recent":
      return <Clock className={c} strokeWidth={1.75} />;
    default:
      return <Building2 className={c} strokeWidth={1.75} />;
  }
}

function kindAccent(kind: SuggestionKind) {
  switch (kind) {
    case "product":
      return "bg-[#00E575]/12 text-[#00E575]";
    case "store":
      return "bg-[#3B82F6]/15 text-[#60A5FA]";
    case "brand":
      return "bg-[#00E575]/10 text-[#34D399]";
    case "category":
      return "bg-[#3B82F6]/12 text-[#93C5FD]";
    case "spec":
      return "bg-cyan-500/15 text-cyan-300";
    case "location":
      return "bg-violet-500/15 text-violet-300";
    default:
      return "bg-white/5 text-white/40";
  }
}

function kindLabel(kind: SuggestionKind) {
  switch (kind) {
    case "product":
      return "Product";
    case "store":
      return "Store";
    case "brand":
      return "Brand";
    case "category":
      return "Category";
    case "spec":
      return "Spec";
    case "location":
      return "Place";
    case "recent":
      return "Recent";
    default:
      return "";
  }
}

/** Product / store / category image first */
const SuggestThumb = memo(function SuggestThumb({ s }: { s: Suggestion }) {
  const [broken, setBroken] = useState(false);
  const img = !broken && s.image ? s.image : null;

  if (img) {
    return (
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5 sm:h-[52px] sm:w-[52px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          draggable={false}
        />
      </span>
    );
  }

  return (
    <span
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:h-[52px] sm:w-[52px] ${kindAccent(s.kind)}`}
    >
      {kindIcon(s.kind)}
    </span>
  );
});

function HighlightText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q || !text) return <>{text}</>;
  const tokens = q
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!tokens.length) return <>{text}</>;
  const re = new RegExp(`(${tokens.join("|")})`, "ig");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) => {
        const hit = tokens.some(
          (t) => part.toLowerCase() === t.replace(/\\/g, "").toLowerCase(),
        );
        return hit ? (
          <span key={i} className="font-semibold text-[#00E575]">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

/* ───────── page ───────── */

function BrowseInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const flyCart = useShowroomFlyCart();
  const bagRef = useRef<HTMLAnchorElement | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const skipUrlWrite = useRef(false);
  const suggestSeq = useRef(0);
  const marketplace = useMarketplace() as { region?: string } | null;
  const marketplaceRegion = marketplace?.region || DEFAULT_REGION;
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [suggestQ, setSuggestQ] = useState("");
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
  const [specOpen, setSpecOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("relevance");
  const [structure, setStructure] = useState<StructureOrder>("products_first");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [draftMin, setDraftMin] = useState("");
  const [draftMax, setDraftMax] = useState("");
  const [draftStock, setDraftStock] = useState(false);
  const [loc, setLoc] = useState<LocFilter>({ region: null, state: null, city: null });
  const [specs, setSpecs] = useState<SpecFilter>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [bagCount, setBagCount] = useState(0);
  const [appFeature, setAppFeature] = useState<AppFeature | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState(0);
  const [apiSuggestions, setApiSuggestions] = useState<Suggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const hydrated = useRef(false);

  /* hydrate URL once */
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const q = searchParams.get("q") || "";
    const cat = searchParams.get("category");
    const region = searchParams.get("region");
    const state = searchParams.get("state");
    const city = searchParams.get("city");
    const min = searchParams.get("min") || "";
    const max = searchParams.get("max") || "";
    const stock = searchParams.get("stock") === "1";
    const sort = (searchParams.get("sort") as SortKey) || "relevance";
    const parsedSpecs = parseSpecsFromParams(searchParams);

    skipUrlWrite.current = true;
    if (q) {
      setQuery(q);
      setDebounced(q);
      setSuggestQ(q);
    }
    if (cat) setActiveCategory(cat);
    setLoc({ region: region || null, state: state || null, city: city || null });
    setMinPrice(min);
    setMaxPrice(max);
    setInStockOnly(stock);
    if (SORT_OPTIONS.some((o) => o.key === sort)) setSortKey(sort);
    setSpecs(parsedSpecs);
    requestAnimationFrame(() => {
      skipUrlWrite.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* URL sync */
  useEffect(() => {
    if (skipUrlWrite.current) return;
    const params = new URLSearchParams();
    if (debounced) params.set("q", debounced);
    if (activeCategory) params.set("category", activeCategory);
    if (loc.region) params.set("region", loc.region);
    if (loc.state) params.set("state", loc.state);
    if (loc.city) params.set("city", loc.city);
    if (minPrice) params.set("min", minPrice);
    if (maxPrice) params.set("max", maxPrice);
    if (inStockOnly) params.set("stock", "1");
    if (sortKey !== "relevance") params.set("sort", sortKey);
    Object.entries(specs).forEach(([k, vals]) => {
      if (vals?.length) params.set(`spec.${k}`, vals.join(","));
    });
    const qs = params.toString();
    const next = qs ? `${pathname}?${qs}` : pathname;
    const current = `${pathname}${typeof window !== "undefined" ? window.location.search : ""}`;
    if (next !== current) router.replace(next, { scroll: false });
  }, [
    debounced,
    activeCategory,
    loc,
    minPrice,
    maxPrice,
    inStockOnly,
    sortKey,
    specs,
    pathname,
    router,
  ]);

  /* bag target */
  useEffect(() => {
    const el = bagRef.current;
    if (!el || !flyCart?.registerBagTarget) return;
    const update = () => flyCart.registerBagTarget(el);
    update();
    const t = window.setTimeout(update, 80);
    window.addEventListener("resize", update);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", update);
    };
  }, [flyCart, bagCount]);

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
    const t = setInterval(refreshBag, 2000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("plazore-cart", onStorage as EventListener);
      window.removeEventListener("plazore-cart-change", onStorage as EventListener);
      clearInterval(t);
    };
  }, [refreshBag]);

  /* initial products */
  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await fetchMallProducts({ limit: 80, sort: "trending" });
      if (!alive) return;
      setAllProducts(list);
      try {
        const stored = localStorage.getItem(RECENT_KEY);
        if (stored) {
          const p = JSON.parse(stored);
          if (Array.isArray(p)) setRecent(p.slice(0, MAX_RECENT));
        }
      } catch {
        /* */
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* dual debounce — fast suggest, slightly slower search */
  useEffect(() => {
    const t = setTimeout(() => setSuggestQ(query.trim()), SUGGEST_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => {
      startTransition(() => setDebounced(query.trim()));
    }, SEARCH_MS);
    return () => clearTimeout(t);
  }, [query, startTransition]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debounced, activeCategory, sortKey, minPrice, maxPrice, inStockOnly, loc, specs]);

  /* suggestions — seq guard = no race, always image-aware */
  useEffect(() => {
    if (!suggestQ) {
      setApiSuggestions(
        recent.slice(0, 6).map((r, i) => ({
          id: `recent-${i}`,
          kind: "recent" as const,
          label: r,
          value: r,
          score: 10,
        })),
      );
      setSuggestLoading(false);
      return;
    }

    const seq = ++suggestSeq.current;
    setSuggestLoading(true);

    const buildClient = (): Suggestion[] => {
      const ql = suggestQ.toLowerCase();
      const out: Suggestion[] = [];
      const seen = new Set<string>();
      const push = (s: Suggestion) => {
        const k = `${s.kind}:${s.value.toLowerCase()}`;
        if (seen.has(k)) return;
        seen.add(k);
        out.push(s);
      };

      allProducts
        .map((p) => ({
          p,
          score:
            matchScore(p.name || "", suggestQ) * 1.25 +
            matchScore(String((p as any).brand || ""), suggestQ) * 0.35,
        }))
        .filter((x) => x.score > 8)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .forEach(({ p, score }) =>
          push({
            id: `p-${p._id}`,
            kind: "product",
            label: p.name || "Product",
            sub: (p as any).brand || categoryOf(p) || undefined,
            value: p.name || "",
            meta: p._id,
            image: p.images?.[0],
            score,
          }),
        );

      const stores = new Map<string, SellerInfo>();
      allProducts.forEach((p) => {
        const s = getSeller(p);
        if (!s) return;
        const name = (s.storeName || s.name || "").trim();
        if (name && textMatch(name.toLowerCase(), ql)) stores.set(s._id, s);
      });
      Array.from(stores.values())
        .slice(0, 4)
        .forEach((s) =>
          push({
            id: `s-${s._id}`,
            kind: "store",
            label: s.storeName || s.name || "Store",
            sub: "Storefront",
            value: s.storeName || s.name || "",
            meta: s._id,
            image: s.storeLogo,
            score: matchScore(s.storeName || s.name || "", suggestQ) + 5,
          }),
        );

      const brands = new Set<string>();
      allProducts.forEach((p) => {
        const b = String((p as any).brand || "").trim();
        if (b && textMatch(b.toLowerCase(), ql)) brands.add(b);
      });
      Array.from(brands)
        .slice(0, 4)
        .forEach((b, i) => {
          const sample = allProducts.find(
            (p) =>
              String((p as any).brand || "").toLowerCase() === b.toLowerCase() &&
              p.images?.[0],
          );
          push({
            id: `b-${i}-${b}`,
            kind: "brand",
            label: b,
            sub: "Brand",
            value: b,
            image: sample?.images?.[0],
            score: matchScore(b, suggestQ) + 3,
          });
        });

      CATEGORY_LIST.filter((c) => textMatch(c.toLowerCase(), ql))
        .slice(0, 4)
        .forEach((c) =>
          push({
            id: `c-${c}`,
            kind: "category",
            label: c,
            sub: "Category",
            value: c,
            image: floorImageForCategory(c),
            score: matchScore(c, suggestQ) + 2,
          }),
        );

      return out;
    };

    fetchSearchSuggest(suggestQ, { region: marketplaceRegion })
      .then((data) => {
        if (seq !== suggestSeq.current) return;

        const items: Suggestion[] = (data.items || []).map((it) => {
          let image = it.image;
          if (it.kind === "category" && !image) {
            image = floorImageForCategory(it.label || it.value);
          }
          if (it.kind === "product" && !image && it.meta) {
            const hit = (data.products || []).find(
              (p: any) => String(p._id) === String(it.meta),
            );
            image = hit?.images?.[0];
          }
          if (it.kind === "store" && !image && it.meta) {
            const hit = (data.stores || []).find(
              (s: any) => String(s._id) === String(it.meta),
            );
            image = hit?.storeLogo;
          }
          return {
            id: it.id,
            kind: it.kind,
            label: it.label,
            sub: it.sub,
            value: it.value,
            meta: it.meta,
            image,
            score:
              matchScore(it.label, suggestQ) +
              (it.kind === "product" ? 12 : 0) +
              (it.kind === "store" ? 8 : 0) +
              (image ? 5 : 0),
          };
        });

        const client = buildClient();
        const seen = new Set(items.map((i) => `${i.kind}:${i.value.toLowerCase()}`));
        for (const c of client) {
          const k = `${c.kind}:${c.value.toLowerCase()}`;
          if (seen.has(k)) {
            const existing = items.find(
              (i) => `${i.kind}:${i.value.toLowerCase()}` === k,
            );
            if (existing && !existing.image && c.image) existing.image = c.image;
            continue;
          }
          seen.add(k);
          items.push(c);
        }

        items.sort((a, b) => (b.score || 0) - (a.score || 0));
        setApiSuggestions(items.slice(0, 12));
        setSuggestLoading(false);
      })
      .catch(() => {
        if (seq !== suggestSeq.current) return;
        setApiSuggestions(
          buildClient()
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 12),
        );
        setSuggestLoading(false);
      });
  }, [suggestQ, marketplaceRegion, recent, allProducts]);

  /* product search */
  useEffect(() => {
    if (debounced.length < 1 && !activeCategory) {
      setServerProducts([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const hasQuery = debounced.length > 0;
    fetchMallProducts({
      q: activeCategory ? undefined : debounced || undefined,
      category: resolveCategoryParam(activeCategory),
      limit: 60,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      inStock: inStockOnly || undefined,
      sort: toApiSort(sortKey, hasQuery),
      region: loc.region || undefined,
    }).then((products) => {
      if (cancelled) return;
      let list = products;
      if (hasQuery) {
        list = [...products].sort((a, b) => {
          const sa =
            matchScore(a.name || "", debounced) * 2 +
            matchScore(String((a as any).brand || ""), debounced);
          const sb =
            matchScore(b.name || "", debounced) * 2 +
            matchScore(String((b as any).brand || ""), debounced);
          return sb - sa || viewScore(b) - viewScore(a);
        });
      }
      setServerProducts(list);
      setSearchLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, activeCategory, minPrice, maxPrice, inStockOnly, sortKey, loc.region]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!searchWrapRef.current?.contains(e.target as Node)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

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

  const specIndex = useMemo(() => {
    const pool = serverProducts.length > 0 ? serverProducts : allProducts;
    const map = new Map<string, Map<string, number>>();
    pool.forEach((p) => {
      Object.entries(getSpecs(p)).forEach(([k, v]) => {
        if (!map.has(k)) map.set(k, new Map());
        const values = map.get(k)!;
        values.set(v, (values.get(v) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .map(([key, values]) => ({
        key,
        values: Array.from(values.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 24)
          .map(([name, count]) => ({ name, count })),
      }))
      .filter((g) => g.values.length > 0)
      .sort((a, b) => b.values.length - a.values.length || a.key.localeCompare(b.key))
      .slice(0, 12);
  }, [serverProducts, allProducts]);

  const suggestions = apiSuggestions;
  useEffect(() => {
    setActiveSuggest(0);
  }, [suggestions]);

  const movingNow = useMemo(
    () => sortProducts(allProducts, "views").slice(0, MOVING_NOW_MAX),
    [allProducts],
  );

  const applyLoc = useCallback(
    (list: Product[]) =>
      list.filter((p) => {
        const parts = locParts(p);
        if (loc.region && parts.region.toLowerCase() !== loc.region.toLowerCase())
          return false;
        if (loc.state && parts.state.toLowerCase() !== loc.state.toLowerCase())
          return false;
        if (loc.city && parts.city.toLowerCase() !== loc.city.toLowerCase())
          return false;
        return true;
      }),
    [loc],
  );

  const applySpecs = useCallback(
    (list: Product[]) => {
      const active = Object.entries(specs).filter(([, vals]) => vals?.length);
      if (!active.length) return list;
      return list.filter((p) => {
        const s = getSpecs(p);
        return active.every(([k, vals]) =>
          vals.some((v) => String(s[k] || "").toLowerCase() === v.toLowerCase()),
        );
      });
    },
    [specs],
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
        products = products.filter((p) => {
          if (Number((p as any).stock ?? 0) > 0) return true;
          const variants = (p as any).variants;
          return (
            Array.isArray(variants) &&
            variants.some(
              (v: any) => v && v.available !== false && Number(v.stock) > 0,
            )
          );
        });
      return products;
    },
    [minPrice, maxPrice, inStockOnly],
  );

  const filteredProducts = useMemo(() => {
    const q = debounced.toLowerCase();
    if (!q && !activeCategory) return [] as Product[];
    let products = serverProducts.length > 0 ? serverProducts : allProducts;
    if (activeCategory) products = products.filter((p) => matchesFloor(p, activeCategory));
    else if (q && serverProducts.length === 0)
      products = products.filter((p) => matchesSearch(p, q));
    products = applyPriceStock(applySpecs(applyLoc(products)));
    let effective: SortKey = sortKey;
    if (sortKey === "relevance") effective = q ? "views" : "newest";
    return sortProducts(products, effective);
  }, [
    debounced,
    activeCategory,
    serverProducts,
    allProducts,
    applyLoc,
    applySpecs,
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
        const brand = String((p as any).brand || "").toLowerCase();
        if (brand && textMatch(brand, q)) brandSet.add((p as any).brand);
      });
    }
    return {
      products,
      totalProducts: filteredProducts.length,
      stores: Array.from(storesMap.values()).slice(0, 12),
      brands: Array.from(brandSet).slice(0, 12),
      categories: CATEGORY_LIST.filter((c) => q && textMatch(c.toLowerCase(), q)).slice(
        0,
        12,
      ),
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
        /* */
      }
      return next;
    });
  }, []);

  const clearAll = () => {
    setQuery("");
    setDebounced("");
    setSuggestQ("");
    setActiveCategory(null);
    setServerProducts([]);
    setCategoryLoading(false);
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
    setDraftMin("");
    setDraftMax("");
    setDraftStock(false);
    setLoc({ region: null, state: null, city: null });
    setSpecs({});
    setSortKey("relevance");
    setVisibleCount(PAGE_SIZE);
    setSuggestOpen(false);
  };

  const selectFloor = (id: string) => {
    setQuery("");
    setDebounced("");
    setSuggestQ("");
    setSuggestOpen(false);
    setCategoryLoading(true);
    setActiveCategory(id);
    setTimeout(() => setCategoryLoading(false), 280);
  };

  const toggleSpecValue = (key: string, value: string) => {
    setSpecs((prev) => {
      const cur = prev[key] || [];
      const has = cur.some((v) => v.toLowerCase() === value.toLowerCase());
      const next = has
        ? cur.filter((v) => v.toLowerCase() !== value.toLowerCase())
        : [...cur, value];
      const out = { ...prev };
      if (next.length) out[key] = next;
      else delete out[key];
      return out;
    });
  };

  const applySuggestion = (s: Suggestion) => {
    if (s.kind === "category") {
      selectFloor(s.value);
      pushRecent(s.value);
      return;
    }
    if (s.kind === "store" && s.meta) {
      window.location.href = `/store/${s.meta}`;
      return;
    }
    if (s.kind === "product" && s.meta) {
      window.location.href = `/product/${s.meta}`;
      return;
    }
    if (s.kind === "location") {
      const kind = s.meta as "city" | "state" | "region" | undefined;
      if (kind === "city") setLoc((p) => ({ ...p, city: s.value }));
      else if (kind === "state") setLoc((p) => ({ ...p, state: s.value }));
      else if (kind === "region") setLoc((p) => ({ ...p, region: s.value }));
      else {
        const cityHit = locationIndex.cities.find(
          (c) => c.name.toLowerCase() === s.value.toLowerCase(),
        );
        const stateHit = locationIndex.states.find(
          (c) => c.name.toLowerCase() === s.value.toLowerCase(),
        );
        const regionHit = locationIndex.regions.find(
          (c) => c.name.toLowerCase() === s.value.toLowerCase(),
        );
        if (cityHit) setLoc((p) => ({ ...p, city: cityHit.name }));
        else if (stateHit) setLoc((p) => ({ ...p, state: stateHit.name }));
        else if (regionHit) setLoc((p) => ({ ...p, region: regionHit.name }));
      }
      setQuery(s.value);
      setDebounced(s.value);
      pushRecent(s.value);
      setSuggestOpen(false);
      return;
    }
    if (s.kind === "spec") {
      try {
        const parsed = s.meta ? JSON.parse(s.meta) : null;
        if (parsed?.key && parsed?.value) toggleSpecValue(parsed.key, parsed.value);
        else {
          const [key, ...rest] = s.value.split(":");
          const val = rest.join(":").trim();
          if (key && val) toggleSpecValue(key.trim(), val);
        }
      } catch {
        const [key, ...rest] = s.value.split(":");
        const val = rest.join(":").trim();
        if (key && val) toggleSpecValue(key.trim(), val);
      }
      setQuery(s.label);
      setDebounced(s.label);
      pushRecent(s.label);
      setSuggestOpen(false);
      return;
    }
    setQuery(s.value);
    setDebounced(s.value);
    pushRecent(s.value);
    setSuggestOpen(false);
    setActiveCategory(null);
  };

  const openPrice = () => {
    setDraftMin(minPrice);
    setDraftMax(maxPrice);
    setDraftStock(inStockOnly);
    setPriceOpen(true);
  };

  const applyPrice = () => {
    setMinPrice(draftMin.trim());
    setMaxPrice(draftMax.trim());
    setInStockOnly(!!draftStock);
    setPriceOpen(false);
  };

  const resetPrice = () => {
    setDraftMin("");
    setDraftMax("");
    setDraftStock(false);
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
    setPriceOpen(false);
  };

  const locActive = !!(loc.region || loc.state || loc.city);
  const priceActive = !!(minPrice || maxPrice) || inStockOnly;
  const sortActive = sortKey !== "relevance";
  const specActive = Object.values(specs).some((v) => v?.length);
  const showFilterBar = isSearching;
  const showSuggestPanel =
    suggestOpen && (suggestions.length > 0 || query.trim().length > 0 || suggestLoading);

  /* blocks */
  const renderProductsBlock = (products: Product[]) =>
    products.length > 0 ? (
      <div className="w-full">
        <p className="mb-5 text-[11px] font-bold tracking-[0.12em] text-muted">PRODUCTS</p>
        <div className={PRODUCT_GRID}>
          {products.map((p) => (
            <ProductCell key={p._id} product={p} />
          ))}
        </div>
        {live.totalProducts > visibleCount ? (
          <div className="mt-12 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="rounded-xl border border-white/15 px-6 py-3 text-[11px] font-semibold tracking-[0.16em] uppercase text-white/80 transition hover:border-white/40 hover:text-white"
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
        <p className="mb-4 text-[11px] font-bold tracking-[0.12em] text-muted">STOREFRONTS</p>
        <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-1 scrollbar-none sm:mx-0 sm:px-0">
          {live.stores.map((s) => (
            <Link
              key={s._id}
              href={`/store/${s._id}`}
              className="w-24 shrink-0 rounded-xl bg-white/[0.03] p-3 text-center transition hover:bg-white/[0.06] sm:w-28"
            >
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white/5 sm:h-14 sm:w-14">
                {s.storeLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.storeLogo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Store className="h-5 w-5 text-white/30" />
                )}
              </div>
              <p className="truncate text-[11px] font-semibold sm:text-xs">
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
        <p className="mb-4 text-[11px] font-bold tracking-[0.12em] text-muted">CATEGORIES</p>
        <div className="flex flex-wrap gap-2">
          {live.categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => selectFloor(c)}
              className="rounded-full bg-white/[0.04] px-3.5 py-2 text-[13px] font-semibold transition hover:bg-white/[0.08]"
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
        <p className="mb-4 text-[11px] font-bold tracking-[0.12em] text-muted">BRANDS</p>
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
              className="rounded-full bg-[#00E575]/10 px-3.5 py-2 text-[13px] font-semibold text-[#00E575] transition hover:bg-[#00E575]/15"
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

  const chip =
    "rounded-full px-2.5 py-1 text-[11px] font-medium transition active:scale-[0.97]";

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-bg text-text">
      <style jsx global>{`
        .plazore-product-cell,
        .plazore-product-cell > *,
        .plazore-product-cell a {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
        }
        .plazore-product-cell img {
          width: 100%;
        }
        @keyframes ps-in {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .plazore-suggest-panel {
          animation: ps-in 0.18s ease-out;
        }
      `}</style>

      {/* header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.04] bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-2 px-3 sm:h-14 sm:gap-3 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/lounge"
              className="flex h-9 w-9 items-center justify-center md:hidden"
              aria-label="Lounge"
            >
              <MenuLines />
            </Link>
            <Link href="/" className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-4.png"
                alt="Plazore"
                className="hidden h-8 w-auto object-contain sm:block lg:h-9"
                draggable={false}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Plazore" className="h-6 w-6 object-contain sm:hidden" />
            </Link>
          </div>

          <nav className="ml-4 hidden flex-1 items-center gap-5 md:flex lg:ml-10 lg:gap-8">
            <Link
              href="/"
              className="text-xs tracking-[0.16em] uppercase text-secondary transition hover:text-text"
            >
              Mall
            </Link>
            <Link href="/browse" className="text-xs tracking-[0.16em] uppercase text-text">
              Browse
            </Link>
            <Link
              href="/lounge"
              className="relative inline-flex items-center overflow-hidden rounded-lg border border-white/10 px-4 py-2 text-[11px] font-extrabold tracking-[0.2em] uppercase text-white"
              style={{
                background:
                  "linear-gradient(135deg, #00E575 0%, #0ECF7A 40%, #3B82F6 100%)",
              }}
            >
              Lounge
            </Link>
            <button
              type="button"
              onClick={() => setAppFeature("wishlist")}
              className="text-xs tracking-[0.16em] uppercase text-secondary transition hover:text-text"
            >
              Wishlist
            </button>
          </nav>

          <Link
            ref={bagRef}
            href="/cart"
            className="relative ml-auto flex h-9 w-9 items-center justify-center sm:h-10 sm:w-10"
            aria-label={`Bag${bagCount ? `, ${bagCount}` : ""}`}
            data-plazore-cart-icon
          >
            <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
            {bagCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00E575] px-1 text-[9px] font-bold text-[#041412]">
                {bagCount > 99 ? "99+" : bagCount}
              </span>
            ) : null}
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-3 pb-24 pt-5 sm:px-6 sm:pb-28 sm:pt-8 lg:px-8">
        <h1 className="font-display text-2xl tracking-tight sm:text-3xl md:text-4xl">
          Browse
        </h1>

        {/* search */}
        <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:items-start sm:gap-3">
          <div ref={searchWrapRef} className="relative min-w-0 flex-1">
            <div className="relative flex h-12 items-center gap-2.5 rounded-2xl bg-[#0A0E14] px-3.5 ring-1 ring-[#00E575]/20 sm:h-13 sm:px-4">
              <Search className="h-4 w-4 shrink-0 text-[#00E575]/80" strokeWidth={2} />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (activeCategory) setActiveCategory(null);
                  setCategoryLoading(false);
                  setSuggestOpen(true);
                }}
                onFocus={() => setSuggestOpen(true)}
                onKeyDown={(e) => {
                  if (!showSuggestPanel || !suggestions.length) {
                    if (e.key === "Enter" && query.trim()) {
                      pushRecent(query);
                      setSuggestOpen(false);
                    }
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveSuggest((i) => Math.min(i + 1, suggestions.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveSuggest((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const s = suggestions[activeSuggest];
                    if (s) applySuggestion(s);
                    else if (query.trim()) {
                      pushRecent(query);
                      setSuggestOpen(false);
                    }
                  } else if (e.key === "Escape") setSuggestOpen(false);
                }}
                placeholder="Search products, stores, brands…"
                className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/30"
                autoComplete="off"
                spellCheck={false}
              />
              {suggestLoading ? (
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-transparent border-t-[#00E575] border-r-[#3B82F6]" />
              ) : null}
              {(query || activeCategory || locActive || priceActive || specActive) && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/35 transition hover:bg-white/5 hover:text-white"
                  aria-label="Clear"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              )}
            </div>

            {/* suggest panel — clean */}
            {showSuggestPanel ? (
              <div className="plazore-suggest-panel absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl bg-[#0A0E14]/98 ring-1 ring-white/10 shadow-2xl shadow-black/50 backdrop-blur-xl">
                <div className="h-px w-full bg-gradient-to-r from-transparent via-[#00E575]/50 to-transparent" />

                {suggestLoading && suggestions.length === 0 ? (
                  <SuggestSpinner />
                ) : suggestions.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[13px] text-white/35">
                    No matches — try a product, brand, or city
                  </p>
                ) : (
                  <ul className="max-h-[min(65vh,420px)] overflow-y-auto overscroll-contain py-1.5">
                    {suggestions.map((s, i) => {
                      const active = i === activeSuggest;
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onMouseEnter={() => setActiveSuggest(i)}
                            onClick={() => applySuggestion(s)}
                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition sm:gap-3.5 sm:px-3.5 sm:py-2.5 ${
                              active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                            }`}
                          >
                            <SuggestThumb s={s} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-medium text-white/95">
                                <HighlightText text={s.label} query={suggestQ} />
                              </span>
                              {s.sub ? (
                                <span className="mt-0.5 block truncate text-[11px] text-white/35">
                                  {s.sub}
                                </span>
                              ) : null}
                            </span>
                            <span
                              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                active
                                  ? "bg-[#00E575]/15 text-[#00E575]"
                                  : "text-white/25"
                              }`}
                            >
                              {kindLabel(s.kind)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          {showFilterBar ? (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  {
                    label: "Sort",
                    on: sortActive || structure !== "products_first",
                    open: () => setSortOpen(true),
                    onCls: "bg-[#00E575]/12 text-[#00E575]",
                  },
                  {
                    label: "Price",
                    on: priceActive,
                    open: openPrice,
                    onCls: "bg-[#00E575]/12 text-[#00E575]",
                  },
                  {
                    label: "Location",
                    on: locActive,
                    open: () => setLocOpen(true),
                    onCls: "bg-[#3B82F6]/15 text-[#60A5FA]",
                  },
                ] as const
              ).map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={b.open}
                  className={`h-11 rounded-xl px-3.5 text-[11px] font-semibold transition sm:h-12 sm:text-xs ${
                    b.on ? b.onCls : "bg-white/[0.04] text-white/65 hover:bg-white/[0.07]"
                  }`}
                >
                  {b.label}
                </button>
              ))}
              {specIndex.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSpecOpen(true)}
                  className={`inline-flex h-11 items-center gap-1.5 rounded-xl px-3.5 text-[11px] font-semibold transition sm:h-12 sm:text-xs ${
                    specActive
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "bg-white/[0.04] text-white/65 hover:bg-white/[0.07]"
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
                  Specs
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* chips */}
        {(locActive || priceActive || specActive) && isSearching ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {loc.region ? (
              <button
                type="button"
                onClick={() => setLoc((p) => ({ ...p, region: null }))}
                className={`${chip} bg-[#3B82F6]/12 text-[#93C5FD]`}
              >
                {loc.region} ×
              </button>
            ) : null}
            {loc.state ? (
              <button
                type="button"
                onClick={() => setLoc((p) => ({ ...p, state: null }))}
                className={`${chip} bg-[#3B82F6]/12 text-[#93C5FD]`}
              >
                {loc.state} ×
              </button>
            ) : null}
            {loc.city ? (
              <button
                type="button"
                onClick={() => setLoc((p) => ({ ...p, city: null }))}
                className={`${chip} bg-[#3B82F6]/12 text-[#93C5FD]`}
              >
                {loc.city} ×
              </button>
            ) : null}
            {minPrice || maxPrice ? (
              <button
                type="button"
                onClick={() => {
                  setMinPrice("");
                  setMaxPrice("");
                }}
                className={`${chip} bg-[#00E575]/10 text-[#34D399]`}
              >
                {minPrice || "0"}–{maxPrice || "∞"} ×
              </button>
            ) : null}
            {inStockOnly ? (
              <button
                type="button"
                onClick={() => setInStockOnly(false)}
                className={`${chip} bg-[#00E575]/10 text-[#34D399]`}
              >
                In stock ×
              </button>
            ) : null}
            {Object.entries(specs).flatMap(([k, vals]) =>
              (vals || []).map((v) => (
                <button
                  key={`${k}-${v}`}
                  type="button"
                  onClick={() => toggleSpecValue(k, v)}
                  className={`${chip} bg-cyan-500/10 text-cyan-300`}
                >
                  {k}: {v} ×
                </button>
              )),
            )}
          </div>
        ) : null}

        {/* body */}
        {!isSearching ? (
          <div className="mt-8 sm:mt-10">
            <p className="text-[11px] font-bold tracking-[0.12em] text-muted">EXPLORE</p>
            <div className="-mx-3 mt-3.5 overflow-x-auto px-3 pb-2 scrollbar-none sm:mx-0 sm:px-0">
              <div className="flex w-max gap-3">
                {FLOORS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => selectFloor(f.id)}
                    className="relative h-36 w-24 shrink-0 overflow-hidden rounded-xl bg-surface text-left sm:h-40 sm:w-28"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.images[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/35 to-transparent" />
                    <div className="absolute inset-x-2 bottom-2">
                      <p className="text-[12px] font-semibold leading-tight">{f.short}</p>
                      <p className="mt-0.5 truncate text-[9px] text-white/50">{f.hint}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {recent.length > 0 ? (
              <div className="mt-10">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold tracking-[0.12em] text-muted">
                    RECENT
                  </p>
                  <button
                    type="button"
                    className="text-[13px] text-[#00E575]"
                    onClick={() => {
                      setRecent([]);
                      localStorage.removeItem(RECENT_KEY);
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setQuery(r);
                        setDebounced(r);
                        pushRecent(r);
                      }}
                      className="rounded-full bg-white/[0.04] px-3.5 py-2 text-[13px] transition hover:bg-white/[0.07]"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-12">
              <p className="text-[11px] font-bold tracking-[0.12em] text-muted">MOVING NOW</p>
              <p className="mt-1 text-[12px] text-secondary">Highest viewed on Plazore</p>
              {loading ? (
                <OrbLoader compact label="Loading…" />
              ) : movingNow.length === 0 ? (
                <p className="mt-10 text-center text-muted">Nothing moving yet.</p>
              ) : (
                <>
                  <div className={`mt-6 ${PRODUCT_GRID}`}>
                    {movingNow.map((p) => (
                      <ProductCell key={p._id} product={p} />
                    ))}
                  </div>
                  <div className="mt-12 flex justify-center">
                    <Link
                      href="/shop?mode=trending"
                      className="rounded-xl border border-white/15 px-6 py-3 text-[11px] font-semibold tracking-[0.16em] uppercase text-white/80 transition hover:border-white/40"
                    >
                      Show more
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : categoryLoading || (searchLoading && live.products.length === 0) ? (
          <OrbLoader label="Looking through the mall…" />
        ) : (
          <div className="mt-8 sm:mt-10">
            <div className="mb-7 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-bold sm:text-lg">{activeLabel}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {[
                    live.totalProducts
                      ? `${Math.min(visibleCount, live.totalProducts)} of ${live.totalProducts} products`
                      : null,
                    live.stores.length ? `${live.stores.length} stores` : null,
                    live.brands.length ? `${live.brands.length} brands` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button type="button" onClick={clearAll} className="text-[13px] text-[#00E575]">
                Clear
              </button>
            </div>
            {structuredResults()}
            {!hasResults && !searchLoading ? (
              <div className="pt-16 text-center">
                <p className="font-bold">Nothing found</p>
                <p className="mt-2 text-sm text-secondary">
                  Try another search, price, location, or spec.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* sheets — simplified surfaces */}
      {sortOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
          <button type="button" className="absolute inset-0" onClick={() => setSortOpen(false)} />
          <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[#12151c] p-5 md:rounded-2xl md:ring-1 md:ring-white/10">
            <p className="text-lg font-bold">Sort & layout</p>
            <p className="mt-4 text-sm font-semibold text-white/50">Sort by</p>
            <div className="mt-2 space-y-1">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setSortKey(o.key)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${
                    sortKey === o.key
                      ? "bg-[#00E575]/12 font-semibold text-[#00E575]"
                      : "bg-white/[0.03] text-white/80"
                  }`}
                >
                  {o.label}
                  {sortKey === o.key ? "✓" : null}
                </button>
              ))}
            </div>
            <p className="mt-5 text-sm font-semibold text-white/50">Structure</p>
            <div className="mt-2 space-y-1">
              {STRUCTURE_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setStructure(o.key)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${
                    structure === o.key
                      ? "bg-[#00E575]/12 font-semibold text-[#00E575]"
                      : "bg-white/[0.03] text-white/80"
                  }`}
                >
                  {o.label}
                  {structure === o.key ? "✓" : null}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSortOpen(false)}
              className="mt-6 h-12 w-full rounded-xl bg-white font-bold text-black"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      {priceOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
          <button type="button" className="absolute inset-0" onClick={() => setPriceOpen(false)} />
          <div className="relative w-full max-w-md rounded-t-2xl bg-[#12151c] p-5 md:rounded-2xl md:ring-1 md:ring-white/10">
            <p className="text-lg font-bold">Price</p>
            <div className="mt-5 flex gap-2">
              <input
                value={draftMin}
                onChange={(e) => setDraftMin(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="Min"
                inputMode="decimal"
                className="h-11 flex-1 rounded-xl bg-white/[0.04] px-3 text-sm outline-none ring-1 ring-white/10"
              />
              <input
                value={draftMax}
                onChange={(e) => setDraftMax(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="Max"
                inputMode="decimal"
                className="h-11 flex-1 rounded-xl bg-white/[0.04] px-3 text-sm outline-none ring-1 ring-white/10"
              />
            </div>
            <label className="mt-5 flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={draftStock}
                onChange={(e) => setDraftStock(e.target.checked)}
              />
              In stock only
            </label>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={resetPrice}
                className="h-12 flex-1 rounded-xl bg-white/[0.04] font-semibold text-white/60"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={applyPrice}
                className="h-12 flex-1 rounded-xl bg-white font-bold text-black"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {locOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
          <button type="button" className="absolute inset-0" onClick={() => setLocOpen(false)} />
          <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[#12151c] p-5 md:rounded-2xl md:ring-1 md:ring-white/10">
            <p className="text-lg font-bold">Location</p>
            <p className="mt-1 text-xs text-white/40">From inventory</p>
            {(["regions", "states", "cities"] as const).map((bucket) => {
              const list =
                bucket === "regions"
                  ? locationIndex.regions
                  : bucket === "states"
                    ? locationIndex.states
                    : locationIndex.cities.slice(0, 48);
              const field =
                bucket === "regions" ? "region" : bucket === "states" ? "state" : "city";
              if (!list.length) return null;
              return (
                <div key={bucket}>
                  <p className="mt-5 text-sm font-semibold capitalize text-white/50">{field}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {list.map((r) => {
                      const on = (loc as any)[field] === r.name;
                      return (
                        <button
                          key={r.name}
                          type="button"
                          onClick={() =>
                            setLoc((prev) => ({
                              ...prev,
                              [field]: on ? null : r.name,
                            }))
                          }
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            on
                              ? "bg-[#3B82F6]/2 text-[#60A5FA]"
                              : "bg-white/[0.04] text-white/65"
                          }`}
                        >
                          {r.name} · {r.count}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setLoc({ region: null, state: null, city: null })}
                className="h-12 flex-1 rounded-xl bg-white/[0.04] font-semibold text-white/60"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setLocOpen(false)}
                className="h-12 flex-1 rounded-xl bg-white font-bold text-black"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {specOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
          <button type="button" className="absolute inset-0" onClick={() => setSpecOpen(false)} />
          <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[#12151c] p-5 md:rounded-2xl md:ring-1 md:ring-white/10">
            <p className="text-lg font-bold">Specs</p>
            <p className="mt-1 text-xs text-white/40">Multi-select from inventory</p>
            {specIndex.length === 0 ? (
              <p className="mt-6 text-sm text-white/40">No specs yet.</p>
            ) : (
              specIndex.map((group) => (
                <div key={group.key} className="mt-5">
                  <p className="text-sm font-semibold text-white/50">{group.key}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.values.map((v) => {
                      const on = (specs[group.key] || []).some(
                        (x) => x.toLowerCase() === v.name.toLowerCase(),
                      );
                      return (
                        <button
                          key={v.name}
                          type="button"
                          onClick={() => toggleSpecValue(group.key, v.name)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            on
                              ? "bg-cyan-500/20 text-cyan-300"
                              : "bg-white/[0.04] text-white/65"
                          }`}
                        >
                          {v.name} · {v.count}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setSpecs({})}
                className="h-12 flex-1 rounded-xl bg-white/[0.04] font-semibold text-white/60"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setSpecOpen(false)}
                className="h-12 flex-1 rounded-xl bg-white font-bold text-black"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {appFeature ? (
        <AppFeaturePrompt feature={appFeature} onClose={() => setAppFeature(null)} />
      ) : null}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <ShowroomFlyCartProvider>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-bg">
            <OrbLoader compact />
          </div>
        }
      >
        <BrowseInner />
      </Suspense>
    </ShowroomFlyCartProvider>
  );
}