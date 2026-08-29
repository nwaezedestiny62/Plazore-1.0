"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useMarketplace } from "@/context/MarketplaceContext";
import { DEFAULT_REGION, formatProductPrice } from "@/lib/regions";
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
import { CATEGORY_LIST, PRODUCT_CATEGORIES } from "@/lib/productCatalog";
import type { Product } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const BG = "#090B0F";
const SURFACE = "#11141A";
const SURFACE_2 = "#171B22";
const LINE = "rgba(255,255,255,0.08)";
const TEXT = "#F5F7FA";
const SECONDARY = "#A7ADB8";
const MUTED = "#737A86";
const GREEN = "#00E575";

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
    "https://images.unsplash.com/photo-1556911220-bff31c812dce?w=600&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80",
    "https://images.unsplash.com/photo-1585515320310-4726b6f1f3d4?w=600&q=80",
  ],
  Groceries: [
    "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80",
    "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=600&q=80",
    "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&q=80",
  ],
  Health: [
    "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&q=80",
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80",
    "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80",
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

type StoreItem = {
  _id: string;
  storeName?: string;
  name?: string;
  storeLogo?: string;
  isSellerVerified?: boolean;
};

function CategoryImage({ category }: { category: string }) {
  const urls = CATEGORY_IMAGES[category] || CATEGORY_IMAGES.Others;
  const [idx, setIdx] = useState(0);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={urls[idx]}
      alt=""
      className="h-[110px] w-full object-cover sm:h-[130px]"
      onError={() => {
        if (idx < 2) setIdx((i) => i + 1);
      }}
    />
  );
}

function ProductTile({
  product,
  displayRegion,
}: {
  product: Product;
  displayRegion: string;
}) {
  const img = product.images?.[0];
  const price = formatProductPrice(
    Number(product.price) || 0,
    (product as Product & { region?: string }).region,
    displayRegion,
  );

  return (
    <Link
      href={`/product/${product._id}`}
      className="block overflow-hidden border border-white/[0.08] bg-[#11141A]"
    >
      <div className="aspect-[4/5] bg-[#171B22]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={product.name} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-[13px] font-semibold text-[#F5F7FA]">
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

  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);

  const setShopParams = (next: Record<string, string>) => {
    const q = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v) q.set(k, v);
    });
    const s = q.toString();
    router.push(s ? `/shop?${s}` : "/shop");
  };

  const load = useCallback(async () => {
    if (isCategories) {
      setLoading(false);
      setProducts([]);
      setStores([]);
      return;
    }
    setLoading(true);
    try {
      if (isStores) {
        const res = await fetch(`${API}/products?limit=100&region=${region}`);
        const json = await res.json();
        const map = new Map<string, StoreItem>();
        (json?.data || []).forEach((p: Product & { seller?: StoreItem & { _id?: string } }) => {
          const s = p.seller as StoreItem | undefined;
          if (!s?._id) return;
          const id = String(s._id);
          if (!map.has(id)) {
            map.set(id, {
              _id: id,
              storeName: s.storeName,
              name: s.name,
              storeLogo: s.storeLogo,
              isSellerVerified: s.isSellerVerified,
            });
          }
        });
        setStores(Array.from(map.values()));
        setProducts([]);
      } else {
        const qs = new URLSearchParams();
        qs.set("page", "1");
        qs.set("limit", "24");
        qs.set("region", region);
        if (mode === "new") qs.set("sort", "newest");
        if (mode === "trending") qs.set("sort", "trending");
        if (mode === "category" && selectedCategory) {
          qs.set("category", selectedCategory);
          if (selectedSub) qs.set("subCategory", selectedSub);
        }
        const res = await fetch(`${API}/products?${qs.toString()}`);
        const json = await res.json();
        setProducts(Array.isArray(json?.data) ? json.data : []);
        setStores([]);
      }
    } catch {
      setProducts([]);
      setStores([]);
    } finally {
      setLoading(false);
    }
   }, [mode, selectedCategory, selectedSub, isCategories, isStores, region]);

  useEffect(() => {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
    load();
  }, [load]);

  const displayedProducts = useMemo(() => {
    let list = [...products];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.brand || "").toLowerCase().includes(q),
      );
    }
    const min = Number(minPrice);
    const max = Number(maxPrice);
    if (Number.isFinite(min) && min > 0) list = list.filter((p) => Number(p.price) >= min);
    if (Number.isFinite(max) && max > 0) list = list.filter((p) => Number(p.price) <= max);
    if (inStockOnly) list = list.filter((p) => Number(p.stock ?? 0) > 0);
    return list;
  }, [products, search, minPrice, maxPrice, inStockOnly]);

  const displayedStores = useMemo(() => {
    if (!search.trim()) return stores;
    const q = search.toLowerCase();
    return stores.filter(
      (s) =>
        (s.storeName || "").toLowerCase().includes(q) ||
        (s.name || "").toLowerCase().includes(q),
    );
  }, [stores, search]);

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

  const filteredCategories = CATEGORY_LIST.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/[0.08] bg-[#090B0F]/95 px-3 py-2.5 backdrop-blur sm:px-5">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-bold">{title}</h1>
        <div className="w-10" />
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6">
        <div className="flex gap-2">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 border border-white/[0.08] bg-[#11141A] px-3">
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
              <button type="button" onClick={() => setSearch("")} aria-label="Clear">
                <X className="h-4 w-4 text-[#737A86]" />
              </button>
            ) : null}
          </label>
          {!isCategories && !isStores ? (
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#F5F7FA] text-[#090B0F]"
              aria-label="Filters"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        {mode === "category" && selectedCategory ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setShopParams({ mode: "category", category: selectedCategory, sub: "" })
              }
              className={`px-3.5 py-1.5 text-xs font-semibold ${
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
                  setShopParams({ mode: "category", category: selectedCategory, sub })
                }
                className={`px-3.5 py-1.5 text-xs font-semibold ${
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

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        {isCategories ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredCategories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setShopParams({ mode: "category", category: item })}
                className="overflow-hidden border border-white/[0.08] bg-[#11141A] text-left"
              >
                <CategoryImage category={item} />
                <div className="p-3">
                  <p className="line-clamp-2 text-[13px] font-semibold">{item}</p>
                  <p className="mt-1 text-[11px] text-[#737A86]">
                    {PRODUCT_CATEGORIES[item]?.length || 0} sub-categories
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : null}

        {isStores ? (
          loading ? (
            <p className="py-16 text-center text-sm text-[#737A86]">Loading stores…</p>
          ) : displayedStores.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#737A86]">
              {stores.length === 0 ? "No stores found" : "No stores match your search"}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {displayedStores.map((item) => (
                <li key={item._id}>
                  <Link
                    href={`/store/${item._id}`}
                    className="flex items-center border border-white/[0.08] bg-[#11141A] p-3.5"
                  >
                    <div className="mr-3.5 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden bg-[#171B22]">
                      {item.storeLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.storeLogo} alt="" className="h-full w-full object-cover" />
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
                      ) : null}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#737A86]" />
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {!isCategories && !isStores ? (
          loading ? (
            <p className="py-16 text-center text-sm text-[#737A86]">Loading products…</p>
          ) : displayedProducts.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#737A86]">
              {products.length === 0
                ? "No products found"
                : "No products match your filters"}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {displayedProducts.map((p) => (
  <ProductTile
    key={String(p._id)}
    product={p}
    displayRegion={region}
  />
))}
            </div>
          )
        ) : null}
      </main>

      {filterOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center sm:p-6">
          <div className="w-full max-w-md border-t border-white/[0.08] bg-[#11141A] p-5 sm:border">
            <h2 className="mb-5 text-[17px] font-bold">Filters</h2>
            <p className="mb-2 text-[13px] font-semibold text-[#A7ADB8]">Price</p>
            <div className="mb-4 flex gap-2.5">
              <input
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="Min"
                inputMode="numeric"
                className="h-11 flex-1 border border-white/[0.08] bg-[#171B22] px-3 text-sm outline-none placeholder:text-[#737A86]"
              />
              <input
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d.]/g, ""))}
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
                  inStockOnly ? "border-[#00E575] bg-[#00E575]" : "border-[#737A86]"
                }`}
              >
                {inStockOnly ? <Check className="h-3.5 w-3.5 text-[#090B0F]" /> : null}
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
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close">
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
                  className="px-3 py-3 text-left text-sm font-semibold hover:bg-white/5"
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
          <button type="button" className="flex-1" onClick={() => setMenuOpen(false)} aria-label="Close menu" />
        </div>
      ) : null}
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#090B0F] text-sm text-[#737A86]">
          Loading shop…
        </div>
      }
    >
      <ShopInner />
    </Suspense>
  );
}