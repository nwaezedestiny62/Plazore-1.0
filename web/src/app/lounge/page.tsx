"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Building2,
  CreditCard,
  Flame,
  Heart,
  HelpCircle,
  Info,
  LayoutGrid,
  LogOut,
  MapPin,
  MessageCircle,
  Music,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  User,
} from "lucide-react";
import { fetchMallProducts, searchSuggest } from "@/lib/api";
import { LOUNGE_SECTIONS, TILE_COLORS, type LoungeItem } from "@/lib/lounge";
import { CATEGORY_LIST } from "@/lib/productCatalog";
import { formatProductPrice } from "@/lib/regions";
import type { Product } from "@/lib/types";

const NAV = [
  { href: "/", label: "Mall" },
  { href: "/browse", label: "Browse" },
  { href: "/shop", label: "Shop" },
  { href: "/lounge", label: "Lounge" },
  { href: "/cart", label: "Bag" },
  { href: "/profile", label: "Profile" },
];

const ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  home: Store,
  browse: Search,
  cart: ShoppingBag,
  wishlist: Heart,
  profile: User,
  orders: Package,
  messages: MessageCircle,
  addresses: MapPin,
  payments: CreditCard,
  saved_stores: Bookmark,
  music: Music,
  categories: LayoutGrid,
  new: Sparkles,
  trending: Flame,
  stores: Building2,
  help: HelpCircle,
  contact: MessageCircle,
  about: Info,
};

/** Canonical routes — overrides any stale href in LOUNGE_SECTIONS */
const TILE_HREF: Record<string, string> = {
  home: "/",
  browse: "/browse",
  cart: "/cart",
  wishlist: "/wishlist",
  profile: "/profile",
  orders: "/orders",
  messages: "/messages",
  addresses: "/addresses",
  payments: "/payment-methods",
  saved_stores: "/saved-stores",
  music: "/settings/music",
  categories: "/shop",
  new: "/shop?mode=new",
  trending: "/shop?mode=trending",
  stores: "/shop?mode=stores",
  help: "/about",
  contact: "/about#contact",
  about: "/about",
};

function resolveHref(item: LoungeItem) {
  return TILE_HREF[item.id] || item.href || "/";
}

function isTileActive(item: LoungeItem, pathname: string) {
  const href = resolveHref(item);
  const pathOnly = href.split("?")[0].split("#")[0];
  if (item.id === "home") return pathname === "/";
  if (item.id === "categories") return pathname === "/shop";
  if (item.id === "new") return pathname === "/shop"; // query handled visually elsewhere if needed
  if (item.id === "trending") return pathname === "/shop";
  if (item.id === "stores") return pathname === "/shop";
  if (pathOnly === "/") return pathname === "/";
  return pathname === pathOnly || pathname.startsWith(pathOnly + "/");
}

type Hit =
  | { type: "product"; id: string; label: string; image?: string; price: number; region?: string }
  | { type: "store"; id: string; label: string; logo?: string }
  | { type: "category"; label: string };

function Tile({
  item,
  active,
  index,
}: {
  item: LoungeItem;
  active: boolean;
  index: number;
}) {
  const palette = TILE_COLORS[item.id] || {
    bg: "#11131C",
    accent: "#00E575",
    glow: "rgba(0,229,117,0.2)",
  };
  const Icon = ICONS[item.id] || Store;
  const href = resolveHref(item);

  return (
    <Link
      href={href}
      className="relative flex min-h-[140px] flex-col justify-between overflow-hidden p-4 transition duration-300 hover:brightness-110"
      style={{
        background: palette.bg,
        border: `1px solid ${active ? palette.accent : "rgba(255,255,255,0.08)"}`,
        animation: `loungeIn 700ms cubic-bezier(0.22,1,0.36,1) ${160 + index * 48}ms both`,
      }}
    >
      <span
        className="pointer-events-none absolute -right-7 -top-7 h-22 w-22"
        style={{ background: palette.glow, opacity: active ? 0.55 : 0.2 }}
      />
      {active && (
        <span className="absolute bottom-0 left-0 top-0 w-[3px]" style={{ background: palette.accent }} />
      )}
      <span
        className="flex h-10 w-10 items-center justify-center"
        style={{
          background: `${palette.accent}18`,
          border: `1px solid ${palette.accent}35`,
        }}
      >
        <Icon className="h-5 w-5" style={{ color: active ? palette.accent : "#F5F7FA" }} />
      </span>
      <span>
        <span className="block text-[13px] font-bold" style={{ color: active ? palette.accent : "#F5F7FA" }}>
          {item.label}
        </span>
        {item.subtitle && (
          <span className="mt-1 block text-[11px] text-white/35">{item.subtitle}</span>
        )}
      </span>
    </Link>
  );
}

export default function LoungePage() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [serverProducts, setServerProducts] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    fetchMallProducts().then(setAllProducts);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 280);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debounced.length < 1) {
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
  }, [debounced]);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { products: [] as Hit[], stores: [] as Hit[], categories: [] as Hit[] };

    const products: Hit[] = (serverProducts || []).slice(0, 8).map((p) => ({
      type: "product",
      id: p._id,
      label: p.name,
      image: p.images?.[0],
      price: p.price,
      region: p.region,
    }));

    const storesMap = new Map<string, Hit>();
    allProducts.forEach((p) => {
      const s = p.seller;
      if (!s || typeof s === "string" || !s._id) return;
      const name = (s.storeName || s.name || "").toLowerCase();
      if (name && name.includes(q)) {
        storesMap.set(String(s._id), {
          type: "store",
          id: String(s._id),
          label: s.storeName || s.name || "Store",
          logo: s.storeLogo,
        });
      }
    });

    const categories: Hit[] = [];
    CATEGORY_LIST.forEach((c) => {
      if (c.toLowerCase().includes(q) && categories.length < 6) {
        categories.push({ type: "category", label: c });
      }
    });

    return {
      products,
      stores: Array.from(storesMap.values()).slice(0, 4),
      categories,
    };
  }, [query, serverProducts, allProducts]);

  const searching = query.trim().length >= 1;
  const totalHits = hits.products.length + hits.stores.length + hits.categories.length;

  let tileIndex = 0;

  const displayName =
    user?.fullName ||
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress ||
    "Guest";

  return (
    <div className="min-h-screen bg-[#050508] text-text">
      <style>{`
        @keyframes loungeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/5 bg-[#050508]/80 px-4 backdrop-blur-md sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Plazore" className="h-7 w-7 object-contain" />
          <span className="text-sm tracking-[0.2em] uppercase">Plazore</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex lg:gap-8">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-xs tracking-[0.18em] uppercase ${
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                  ? "text-text"
                  : "text-secondary hover:text-text"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
        <p className="text-[10px] font-extrabold tracking-[0.2em] text-white/35">NAVIGATION</p>

        <div className="relative mt-4 flex min-h-[80px] items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-2.png" alt="Plazore" className="h-20 w-[132px] object-contain" />
        </div>

        <label
          className="mt-4 flex h-12 items-center gap-3 border bg-[#0B0C12] px-4"
          style={{ borderColor: query ? "#00E575" : "rgba(255,255,255,0.08)" }}
        >
          <Search className="h-4 w-4" style={{ color: query ? "#00E575" : "rgba(245,247,250,0.35)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, stores, categories…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-white/35"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-white/35">
              ×
            </button>
          )}
        </label>

        {searching ? (
          <div className="mt-8">
            {searchLoading && totalHits === 0 ? (
              <p className="py-16 text-center text-secondary">Searching Plazore…</p>
            ) : totalHits === 0 ? (
              <p className="py-16 text-center text-secondary">No results for “{query.trim()}”</p>
            ) : (
              <>
                {hits.products.length > 0 && (
                  <div className="mb-8">
                    <p className="mb-4 text-[10px] font-extrabold tracking-[0.16em] text-white/35">PRODUCTS</p>
                    <div className="space-y-3">
                      {hits.products.map((h) =>
                        h.type === "product" ? (
                          <Link key={h.id} href={`/product/${h.id}`} className="flex items-center gap-3">
                            <div className="h-16 w-16 overflow-hidden bg-[#11131C]">
                              {h.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={h.image} alt="" className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div>
                              <p className="font-medium">{h.label}</p>
                              <p className="mt-1 text-sm font-semibold text-green">
                                {formatProductPrice(h.price, h.region, "NG")}
                              </p>
                            </div>
                          </Link>
                        ) : null,
                      )}
                    </div>
                  </div>
                )}

                {hits.stores.length > 0 && (
                  <div className="mb-8">
                    <p className="mb-4 text-[10px] font-extrabold tracking-[0.16em] text-white/35">STORES</p>
                    {hits.stores.map((h) =>
                      h.type === "store" ? (
                        <Link key={h.id} href={`/store/${h.id}`} className="mb-3 flex items-center gap-3">
                          <div className="flex h-16 w-16 items-center justify-center overflow-hidden bg-[#11131C]">
                            {h.logo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={h.logo} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Store className="h-5 w-5 text-blue" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{h.label}</p>
                            <p className="mt-1 text-xs font-semibold text-blue">Official storefront</p>
                          </div>
                        </Link>
                      ) : null,
                    )}
                  </div>
                )}

                {hits.categories.length > 0 && (
                  <div>
                    <p className="mb-4 text-[10px] font-extrabold tracking-[0.16em] text-white/35">CATEGORIES</p>
                    <div className="flex flex-wrap gap-2">
                      {hits.categories.map((h) =>
                        h.type === "category" ? (
                          <Link
                            key={h.label}
                            href={`/shop?mode=category&category=${encodeURIComponent(h.label)}`}
                            className="border border-white/10 bg-[#0B0C12] px-3 py-2 text-sm font-semibold"
                          >
                            {h.label}
                          </Link>
                        ) : null,
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => router.push("/seller-register")}
              className="mt-8 flex w-full items-center gap-3 border border-white/8 bg-[#0B0C12] p-3.5 text-left"
            >
              <span className="flex h-[42px] w-[42px] items-center justify-center bg-[#11131C]">
                <Store className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-bold">Open a store</span>
                <span className="mt-0.5 block text-xs text-white/65">Sell on Plazore’s digital mall</span>
              </span>
              <ArrowRight className="h-4 w-4 text-white/35" />
            </button>

            {LOUNGE_SECTIONS.map((section) => (
              <section key={section.id} className="mt-10">
                <p className="mb-3 text-[10px] font-extrabold tracking-[0.16em] uppercase text-white/35">
                  {section.title}
                </p>
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
                  {section.items.map((item) => {
                    const idx = tileIndex++;
                    const active = isTileActive(item, pathname);
                    return <Tile key={item.id} item={item} active={active} index={idx} />;
                  })}
                </div>
              </section>
            ))}

            <div className="mt-10 border border-white/8 bg-[#0B0C12] p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden border border-green/30 bg-[#11131C]">
                  {user?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-white/65" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{isLoaded && isSignedIn ? displayName : "Guest"}</p>
                  <p className="text-[11px] text-white/35">
                    {isLoaded && isSignedIn ? "Signed in on Plazore" : "Sign in to sync your account"}
                  </p>
                </div>
              </div>
              {isLoaded && isSignedIn ? (
                <button
                  type="button"
                  onClick={() => signOut({ redirectUrl: "/" })}
                  className="mt-3 inline-flex items-center gap-2 border border-white/8 px-3 py-1.5 text-xs text-white/65"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </button>
              ) : (
                <Link
                  href="/sign-in"
                  className="mt-3 inline-flex items-center gap-2 border border-white/8 px-3 py-1.5 text-xs font-semibold text-[#00E575]"
                >
                  Sign in
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}