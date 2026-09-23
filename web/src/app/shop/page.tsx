"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Menu,
  Search,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import { useMarketplace } from "@/context/MarketplaceContext";
const { DEFAULT_REGION, formatProductPrice } = require("@/lib/regions") as typeof import("@/lib/regions");
import { CATEGORY_LIST, PRODUCT_CATEGORIES } from "@/lib/productCatalog";
import type { Product } from "@/lib/types";

const API =
  process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com/api";

const CATEGORY_IMAGES: Record<string, [string, string, string]> = {
  Electronics: [
    "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&q=80",
    "https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=600&q=80",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80",
  ],
  "Phones & Accessories": [
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80",
    "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&q=80",
    "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&q=80",
  ],
  Computers: [
    "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80",
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80",
    "https://images.unsplash.com/photo-1525547719571-a2d4ac882e75?w=600&q=80",
  ],
  Fashion: [
    "https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&q=80",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80",
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80",
  ],
  "Beauty & Personal Care": [
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80",
    "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&q=80",
    "https://images.unsplash.com/photo-1571781926291-c77df8097c1f?w=600&q=80",
  ],
  "Home & Living": [
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80",
    "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&q=80",
    "https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=600&q=80",
  ],
  Furniture: [
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80",
    "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600&q=80",
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80",
  ],
  "Kitchen & Dining": [
    "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=600&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80",
    "https://images.unsplash.com/photo-1585515320310-4726b6f1f3d4?w=600&q=80",
  ],
  Groceries: [
    "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80",
    "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=600&q=80",
    "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&q=80",
  ],
  Health: [
    "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&w=800&q=80",
  ],
  "Sports & Outdoors": [
    "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?w=600&q=80",
    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80",
    "https://images.unsplash.com/photo-1517649763962-0c623066027b?w=600&q=80",
  ],
  Automotive: [
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&q=80",
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&q=80",
    "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600&q=80",
  ],
  Books: [
    "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=600&q=80",
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80",
    "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80",
  ],
  "Office Supplies": [
    "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=600&q=80",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&q=80",
    "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&q=80",
  ],
  "Toys & Games": [
    "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600&q=80",
    "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&q=80",
    "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&q=80",
  ],
  "Baby Products": [
    "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&q=80",
    "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&q=80",
    "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=600&q=80",
  ],
  "Pet Supplies": [
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&q=80",
    "https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=600&q=80",
    "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600&q=80",
  ],
  "Jewelry & Watches": [
    "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600&q=80",
    "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600&q=80",
    "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&q=80",
  ],
  "Musical Instruments": [
    "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&q=80",
    "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=600&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
  ],
  "Art & Crafts": [
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&q=80",
    "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&q=80",
    "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=600&q=80",
  ],
  "Industrial Equipment": [
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&q=80",
    "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&q=80",
    "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=600&q=80",
  ],
  Agriculture: [
    "https://images.unsplash.com/photo-1500937386664-56d1dfef3855?w=600&q=80",
    "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600&q=80",
    "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=600&q=80",
  ],
  "Building Materials": [
    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&q=80",
    "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&q=80",
    "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600&q=80",
  ],
  Collectibles: [
    "https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=600&q=80",
    "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
  ],
  "Luxury Goods": [
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80",
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80",
    "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80",
  ],
  Others: [
    "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&q=80",
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80",
    "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=600&q=80",
  ],
};

type Mode = "categories" | "new" | "trending" | "stores" | "category";
type SortKey =
  | "default"
  | "newest"
  | "trending"
  | "price_low"
  | "price_high"
  | "name_az";

type StoreItem = {
  _id: string;
  storeName?: string;
  name?: string;
  storeLogo?: string;
  isSellerVerified?: boolean;
};

function viewScore(p: Product) {
  const any = p as Product & { views?: number; viewCount?: number };
  return Number(any.views ?? any.viewCount ?? p.wishlistCount ?? 0) || 0;
}

/** Orb preloader (profile-page style) */
function OrbLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24">
      <div className="relative h-14 w-14">
        <div
          className="absolute inset-0 animate-[orbSpin_1.4s_linear_infinite] rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0%, #00E575 35%, #14B8A6 55%, #3B82F6 75%, transparent 100%)",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
            WebkitMask:
              "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
          }}
        />
        <div
          className="absolute inset-[5px] animate-[orbPulse_1.8s_ease-in-out_infinite] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, rgba(0,229,117,0.45), rgba(59,130,246,0.2) 55%, transparent 70%)",
            boxShadow: "0 0 28px rgba(0,229,117,0.25)",
          }}
        />
      </div>
      <p className="text-[12px] font-medium tracking-wide text-[#737A86]">
        {label}
      </p>
    </div>
  );
}

function SafeImg({
  src,
  alt = "",
  className = "h-full w-full object-cover",
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const [ok, setOk] = useState(!!src);
  useEffect(() => setOk(!!src), [src]);
  if (!src || !ok) {
    return (
      <div
        className={`flex items-center justify-center bg-[#171B22] ${
          className.includes("absolute") ? "absolute inset-0" : "h-full w-full"
        }`}
      >
        <span className="text-[10px] font-extrabold tracking-[0.2em] text-white/20">
          PLAZORE
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setOk(false)}
    />
  );
}

function CategoryImage({ category }: { category: string }) {
  const urls = CATEGORY_IMAGES[category] || CATEGORY_IMAGES.Others;
  const [idx, setIdx] = useState(0);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={urls[idx]}
      alt=""
      className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
      loading="lazy"
      decoding="async"
      onError={() => {
        if (idx < 2) setIdx((i) => i + 1);
      }}
    />
  );
}

function ProductCard({
  product,
  displayRegion,
  index,
}: {
  product: Product;
  displayRegion: string;
  index: number;
}) {
  const img = product.images?.[0];
  const price = formatProductPrice(
    Number(product.price) || 0,
    product.region,
    displayRegion
  );
  const inStock = Number(product.stock ?? 0) > 0;

  return (
    <Link
      href={`/product/${product._id}`}
      className="group block overflow-hidden border border-white/[0.08] bg-[#11141A] transition duration-300 ease-out hover:border-white/[0.14] hover:brightness-110"
      style={{
        animation: `shopIn 520ms cubic-bezier(0.22,1,0.36,1) ${Math.min(index, 14) * 32}ms both`,
      }}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[#171B22]">
        <SafeImg
          src={img}
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
        />
        {!inStock && (
          <span className="absolute left-2 top-2 bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white/80">
            Out of stock
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-snug text-[#F5F7FA]">
          {product.name}
        </p>
        <p className="mt-1.5 text-sm font-bold text-[#00E575]">{price}</p>
      </div>
    </Link>
  );
}

function ShopInner() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = ((params.get("mode") as Mode) || "categories") as Mode;
  const selectedCategory = params.get("category") || "";
  const selectedSub = params.get("sub") || "";
  const { region: marketplaceRegion } = useMarketplace();
  const region = marketplaceRegion || DEFAULT_REGION;

  const isCategories = mode === "categories" && !selectedCategory;
  const isStores = mode === "stores";
  const isCategoryBrowse = mode === "category" && !!selectedCategory;
  /** Sort + filter only for category product lists and stores — NOT new / trending */
  const showSortFilter = isCategoryBrowse || isStores;

  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("default");

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const storeMapRef = useRef<Map<string, StoreItem>>(new Map());

  useEffect(() => {
    // Fixed sorts for new / trending; reset user sort when leaving category
    if (mode === "new") setSortKey("newest");
    else if (mode === "trending") setSortKey("trending");
    else if (!isCategoryBrowse) setSortKey("default");
  }, [mode, selectedCategory, selectedSub, isCategoryBrowse]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 280);
    return () => clearTimeout(t);
  }, [search]);

  const setShopParams = (next: Record<string, string>) => {
    const q = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v) q.set(k, v);
    });
    const s = q.toString();
    router.push(s ? `/shop?${s}` : "/shop");
  };

  const apiSort = useMemo(() => {
    if (mode === "new") return "newest";
    if (mode === "trending") return "trending";
    // Category / stores only — honor user sort
    if (showSortFilter) {
      if (sortKey === "newest") return "newest";
      if (sortKey === "trending") return "trending";
      if (sortKey === "price_low") return "price_low";
      if (sortKey === "price_high") return "price_high";
      if (sortKey === "name_az") return "name_az";
    }
    return "";
  }, [mode, sortKey, showSortFilter]);

  const mergeStoresFromProducts = useCallback((list: Product[]) => {
    const map = storeMapRef.current;
    list.forEach((p) => {
      const s = p.seller as StoreItem | string | undefined;
      if (!s || typeof s === "string" || !s._id) return;
      const id = String(s._id);
      if (map.has(id)) return;
      map.set(id, {
        _id: id,
        storeName: s.storeName,
        name: s.name,
        storeLogo: s.storeLogo,
        isSellerVerified: s.isSellerVerified,
      });
    });
    setStores(Array.from(map.values()));
  }, []);

  const fetchProductsPage = useCallback(
    async (pageNum: number, append: boolean) => {
      const qs = new URLSearchParams();
      qs.set("page", String(pageNum));
      qs.set("limit", "48");
      qs.set("region", region);
      if (debouncedQ) qs.set("q", debouncedQ);
      if (apiSort) qs.set("sort", apiSort);
      if (mode === "category" && selectedCategory) {
        qs.set("category", selectedCategory);
        if (selectedSub) qs.set("subCategory", selectedSub);
      }
      if (showSortFilter) {
        if (minPrice.trim()) qs.set("minPrice", minPrice.trim());
        if (maxPrice.trim()) qs.set("maxPrice", maxPrice.trim());
        if (inStockOnly) qs.set("inStock", "true");
      }

      const res = await fetch(`${API}/products?${qs.toString()}`);
      const json = await res.json();
      const data: Product[] = Array.isArray(json?.data) ? json.data : [];
      const pages = Number(json?.pagination?.pages) || 1;

      setHasMore(pageNum < pages);
      setPage(pageNum);

      if (append) {
        setProducts((prev) => {
          const seen = new Set(prev.map((p) => String(p._id)));
          const next = data.filter((p) => !seen.has(String(p._id)));
          return [...prev, ...next];
        });
      } else {
        setProducts(data);
      }
      return data;
    },
    [
      region,
      debouncedQ,
      apiSort,
      mode,
      selectedCategory,
      selectedSub,
      minPrice,
      maxPrice,
      inStockOnly,
      showSortFilter,
    ]
  );

  const load = useCallback(async () => {
    if (isCategories) {
      setLoading(false);
      setProducts([]);
      setStores([]);
      setHasMore(false);
      return;
    }

    setLoading(true);
    storeMapRef.current = new Map();

    try {
      if (isStores) {
        const first = await fetchProductsPage(1, false);
        mergeStoresFromProducts(first);
        setProducts([]);
      } else {
        await fetchProductsPage(1, false);
        setStores([]);
      }
    } catch {
      setProducts([]);
      setStores([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [isCategories, isStores, fetchProductsPage, mergeStoresFromProducts]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data = await fetchProductsPage(next, !isStores);
      if (isStores) mergeStoresFromProducts(data);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }, [
    hasMore,
    loadingMore,
    loading,
    page,
    fetchProductsPage,
    isStores,
    mergeStoresFromProducts,
  ]);

  useEffect(() => {
    if (isCategories) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) void loadMore();
      },
      { rootMargin: "240px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, isCategories, isStores, products.length, stores.length]);

  const displayedProducts = useMemo(() => {
    let list = [...products];

    if (debouncedQ) {
      const q = debouncedQ.toLowerCase();
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.brand || "").toLowerCase().includes(q)
      );
    }

    if (showSortFilter) {
      const min = Number(minPrice);
      const max = Number(maxPrice);
      if (Number.isFinite(min) && min > 0)
        list = list.filter((p) => Number(p.price) >= min);
      if (Number.isFinite(max) && max > 0)
        list = list.filter((p) => Number(p.price) <= max);
      if (inStockOnly) list = list.filter((p) => Number(p.stock ?? 0) > 0);
    }

    if (mode === "trending") {
      list.sort((a, b) => {
        const dv = viewScore(b) - viewScore(a);
        if (dv !== 0) return dv;
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      });
    } else if (mode === "new") {
      list.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );
    } else if (showSortFilter) {
      if (sortKey === "trending") {
        list.sort((a, b) => viewScore(b) - viewScore(a));
      } else if (sortKey === "newest") {
        list.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        );
      } else if (sortKey === "price_low") {
        list.sort((a, b) => Number(a.price) - Number(b.price));
      } else if (sortKey === "price_high") {
        list.sort((a, b) => Number(b.price) - Number(a.price));
      } else if (sortKey === "name_az") {
        list.sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""))
        );
      }
    }

    return list;
  }, [
    products,
    debouncedQ,
    minPrice,
    maxPrice,
    inStockOnly,
    mode,
    sortKey,
    showSortFilter,
  ]);

  const displayedStores = useMemo(() => {
    if (!debouncedQ) return stores;
    const q = debouncedQ.toLowerCase();
    return stores.filter(
      (s) =>
        (s.storeName || "").toLowerCase().includes(q) ||
        (s.name || "").toLowerCase().includes(q)
    );
  }, [stores, debouncedQ]);

  const filteredCategories = useMemo(
    () =>
      CATEGORY_LIST.filter((c) =>
        c.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  const title =
    mode === "new"
      ? "New Arrivals"
      : mode === "trending"
        ? "Trending"
        : mode === "stores"
          ? "Stores"
          : mode === "category" && selectedCategory
            ? selectedSub
              ? `${selectedCategory} · ${selectedSub}`
              : selectedCategory
            : "Categories";

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "default", label: "Recommended" },
    { key: "newest", label: "Newest" },
    { key: "trending", label: "Most viewed" },
    { key: "price_low", label: "Price: low → high" },
    { key: "price_high", label: "Price: high → low" },
    { key: "name_az", label: "Name: A → Z" },
  ];

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <style jsx global>{`
        @keyframes shopIn {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes orbSpin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes orbPulse {
          0%,
          100% {
            opacity: 0.55;
            transform: scale(0.92);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>

      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/[0.08] bg-[#090B0F]/95 px-3 py-2.5 backdrop-blur-md sm:px-5">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-bold">
          {title}
        </h1>
        <div className="w-10" />
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6">
        <div className="flex gap-2">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 border border-white/[0.08] bg-[#11141A] px-3 transition focus-within:border-white/20">
            <Search className="h-4 w-4 shrink-0 text-[#737A86]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isCategories
                  ? "Search categories…"
                  : isStores
                    ? "Search stores…"
                    : "Search products…"
              }
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#737A86]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear"
              >
                <X className="h-4 w-4 text-[#737A86]" />
              </button>
            ) : null}
          </label>

          {/* Sort + filter ONLY on category product lists (and stores uses filter if needed) */}
          {isCategoryBrowse ? (
            <>
              <button
                type="button"
                onClick={() => setSortOpen(true)}
                className="flex h-11 shrink-0 items-center gap-1.5 border border-white/[0.08] bg-[#11141A] px-3 text-[12px] font-semibold text-[#A7ADB8] transition hover:text-white"
              >
                Sort
              </button>
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#F5F7FA] text-[#090B0F] transition hover:opacity-90"
                aria-label="Filters"
              >
                <SlidersHorizontal className="h-5 w-5" />
              </button>
            </>
          ) : null}

          {isStores ? (
            <button
              type="button"
              onClick={() => setSortOpen(true)}
              className="flex h-11 shrink-0 items-center gap-1.5 border border-white/[0.08] bg-[#11141A] px-3 text-[12px] font-semibold text-[#A7ADB8] transition hover:text-white"
            >
              Sort
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              { label: "Categories", q: { mode: "categories" } },
              { label: "New", q: { mode: "new" } },
              { label: "Trending", q: { mode: "trending" } },
              { label: "Stores", q: { mode: "stores" } },
            ] as const
          ).map((chip) => {
            const active =
              chip.q.mode === "categories"
                ? isCategories
                : mode === chip.q.mode;
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => setShopParams(chip.q as Record<string, string>)}
                className={`shrink-0 px-3.5 py-1.5 text-xs font-semibold transition duration-200 ${
                  active
                    ? "bg-white text-[#090B0F]"
                    : "border border-white/[0.08] bg-[#11141A] text-[#A7ADB8] hover:text-white"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {mode === "category" && selectedCategory ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setShopParams({
                  mode: "category",
                  category: selectedCategory,
                  sub: "",
                })
              }
              className={`px-3.5 py-1.5 text-xs font-semibold transition ${
                !selectedSub
                  ? "bg-[#F5F7FA] text-[#090B0F]"
                  : "border border-white/[0.08] bg-[#11141A] text-[#F5F7FA]"
              }`}
            >
              All
            </button>
            {(PRODUCT_CATEGORIES[selectedCategory] || []).map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() =>
                  setShopParams({
                    mode: "category",
                    category: selectedCategory,
                    sub,
                  })
                }
                className={`px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedSub === sub
                    ? "bg-[#F5F7FA] text-[#090B0F]"
                    : "border border-white/[0.08] bg-[#11141A] text-[#F5F7FA]"
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 sm:px-6">
        {isCategories ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredCategories.map((item, i) => (
              <button
                key={item}
                type="button"
                onClick={() =>
                  setShopParams({ mode: "category", category: item })
                }
                className="group overflow-hidden border border-white/[0.08] bg-[#11141A] text-left transition duration-300 ease-out hover:border-white/[0.16] hover:brightness-110"
                style={{
                  animation: `shopIn 480ms cubic-bezier(0.22,1,0.36,1) ${Math.min(i, 12) * 28}ms both`,
                }}
              >
                <div className="relative aspect-[16/11] overflow-hidden bg-[#171B22]">
                  <CategoryImage category={item} />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-[13px] font-semibold leading-snug">
                    {item}
                  </p>
                  <p className="mt-1 text-[11px] text-[#737A86]">
                    {PRODUCT_CATEGORIES[item]?.length || 0} sub-categories
                  </p>
                </div>
              </button>
            ))}
            {filteredCategories.length === 0 && (
              <p className="col-span-full py-16 text-center text-sm text-[#737A86]">
                No categories match “{search}”
              </p>
            )}
          </div>
        ) : null}

        {isStores ? (
          loading ? (
            <OrbLoader label="Loading stores…" />
          ) : displayedStores.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#737A86]">
              {stores.length === 0
                ? "No stores found"
                : "No stores match your search"}
            </p>
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {displayedStores.map((item, i) => (
                  <li
                    key={item._id}
                    style={{
                      animation: `shopIn 480ms cubic-bezier(0.22,1,0.36,1) ${Math.min(i, 12) * 28}ms both`,
                    }}
                  >
                    <Link
                      href={`/store/${item._id}`}
                      className="flex items-center border border-white/[0.08] bg-[#11141A] p-3.5 transition duration-300 ease-out hover:border-white/[0.14] hover:brightness-110"
                    >
                      <div className="mr-3.5 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden bg-[#171B22]">
                        {item.storeLogo ? (
                          <SafeImg
                            src={item.storeLogo}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Store className="h-5 w-5 text-[#737A86]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">
                          {item.storeName || item.name || "Store"}
                        </p>
                        {item.isSellerVerified ? (
                          <p className="mt-0.5 text-[11px] font-semibold text-[#00E575]">
                            Verified Seller
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-[#737A86]">
                            Visit storefront
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#737A86]" />
                    </Link>
                  </li>
                ))}
              </ul>
              <div ref={sentinelRef} className="h-8" />
              {loadingMore && (
                <div className="py-6">
                  <OrbLoader label="Loading more…" />
                </div>
              )}
            </>
          )
        ) : null}

        {!isCategories && !isStores ? (
          loading ? (
            <OrbLoader
              label={
                mode === "new"
                  ? "Loading new arrivals…"
                  : mode === "trending"
                    ? "Loading trending…"
                    : "Loading products…"
              }
            />
          ) : displayedProducts.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#737A86]">
              {products.length === 0
                ? "No products found"
                : "No products match your filters"}
            </p>
          ) : (
            <>
              {mode === "trending" && (
                <p className="mb-3 text-[12px] text-[#A7ADB8]">
                  Most viewed on Plazore
                </p>
              )}
              {mode === "new" && (
                <p className="mb-3 text-[12px] text-[#A7ADB8]">
                  Newest listings first
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {displayedProducts.map((p, i) => (
                  <ProductCard
                    key={String(p._id)}
                    product={p}
                    displayRegion={region}
                    index={i}
                  />
                ))}
              </div>
              <div ref={sentinelRef} className="h-8" />
              {loadingMore && (
                <div className="py-6">
                  <OrbLoader label="Loading more…" />
                </div>
              )}
            </>
          )
        ) : null}
      </main>

      {sortOpen && showSortFilter ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center sm:p-6">
          <div className="w-full max-w-md border-t border-white/[0.08] bg-[#11141A] p-5 sm:border">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[17px] font-bold">Sort</h2>
              <button type="button" onClick={() => setSortOpen(false)}>
                <X className="h-5 w-5 text-[#737A86]" />
              </button>
            </div>
            <div className="space-y-1">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => {
                    setSortKey(o.key);
                    setSortOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-3 text-left text-sm transition ${
                    sortKey === o.key
                      ? "bg-white/[0.06] font-semibold text-[#00E575]"
                      : "text-[#F5F7FA]"
                  }`}
                >
                  {o.label}
                  {sortKey === o.key ? (
                    <Check className="h-4 w-4 text-[#00E575]" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {filterOpen && isCategoryBrowse ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center sm:p-6">
          <div className="w-full max-w-md border-t border-white/[0.08] bg-[#11141A] p-5 sm:border">
            <h2 className="mb-5 text-[17px] font-bold">Filters</h2>
            <p className="mb-2 text-[13px] font-semibold text-[#A7ADB8]">
              Price
            </p>
            <div className="mb-4 flex gap-2.5">
              <input
                value={minPrice}
                onChange={(e) =>
                  setMinPrice(e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder="Min"
                inputMode="numeric"
                className="h-11 flex-1 border border-white/[0.08] bg-[#171B22] px-3 text-sm outline-none placeholder:text-[#737A86]"
              />
              <input
                value={maxPrice}
                onChange={(e) =>
                  setMaxPrice(e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder="Max"
                inputMode="numeric"
                className="h-11 flex-1 border border-white/[0.08] bg-[#171B22] px-3 text-sm outline-none placeholder:text-[#737A86]"
              />
            </div>
            <button
              type="button"
              onClick={() => setInStockOnly((v) => !v)}
              className="mb-6 flex w-full items-center gap-2.5 text-left text-sm"
            >
              <span
                className={`flex h-[22px] w-[22px] items-center justify-center border-2 ${
                  inStockOnly
                    ? "border-[#00E575] bg-[#00E575]"
                    : "border-[#737A86]"
                }`}
              >
                {inStockOnly ? (
                  <Check className="h-3.5 w-3.5 text-[#090B0F]" />
                ) : null}
              </span>
              In stock only
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setMinPrice("");
                  setMaxPrice("");
                  setInStockOnly(false);
                  setFilterOpen(false);
                }}
                className="h-12 flex-1 border border-white/[0.08] text-sm font-semibold text-[#A7ADB8]"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="h-12 flex-1 bg-[#F5F7FA] text-sm font-bold text-[#090B0F]"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {menuOpen ? (
        <div className="fixed inset-0 z-50 flex bg-black/70">
          <div className="flex h-full w-[min(100%,320px)] flex-col border-r border-white/[0.08] bg-[#090B0F]">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <p className="font-bold">Shop</p>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col p-2">
              {(
                [
                  { label: "Categories", q: { mode: "categories" } },
                  { label: "New Arrivals", q: { mode: "new" } },
                  { label: "Trending", q: { mode: "trending" } },
                  { label: "Stores", q: { mode: "stores" } },
                ] as const
              ).map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setShopParams(item.q as Record<string, string>);
                    setMenuOpen(false);
                  }}
                  className="px-3 py-3 text-left text-sm font-semibold transition hover:bg-white/5"
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  router.push("/");
                  setMenuOpen(false);
                }}
                className="mt-2 flex items-center gap-2 px-3 py-3 text-left text-sm font-semibold text-[#A7ADB8]"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Mall
              </button>
            </nav>
          </div>
          <button
            type="button"
            className="flex-1"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          />
        </div>
      ) : null}
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#090B0F]">
          <OrbLoader label="Loading shop…" />
        </div>
      }
    >
      <ShopInner />
    </Suspense>
  );
}