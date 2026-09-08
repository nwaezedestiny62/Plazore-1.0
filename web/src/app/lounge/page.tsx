"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
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
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  User,
  X,
} from "lucide-react";
import { AppFeaturePrompt, type AppFeature } from "@/components/app/AppFeaturePrompt";
import { fetchMallProducts, searchSuggest } from "@/lib/api";
import { LOUNGE_SECTIONS, TILE_COLORS, type LoungeItem } from "@/lib/lounge";
import { CATEGORY_LIST } from "@/lib/productCatalog";
import { formatProductPrice } from "@/lib/regions";
import type { Product } from "@/lib/types";
import { cartCount } from "@/lib/cart";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const GRAD = "linear-gradient(90deg,#00E575,#3B82F6)";

const ICONS: Record<
  string,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
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

const APP_ONLY = new Set(["wishlist", "saved_stores"]);

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
  categories: "/shop?mode=categories",
  new: "/shop?mode=new",
  trending: "/shop?mode=trending",
  stores: "/shop?mode=stores",
  help: "/about",
  contact: "/contact",
  about: "/about",
};

const TOP_TABS = [
  { id: "search", label: "Search", href: "/browse" },
  { id: "for-you", label: "For you", href: "/lounge" },
  { id: "shop", label: "Shop", href: "/shop" },
  { id: "stores", label: "Stores", href: "/shop?mode=stores" },
  { id: "orders", label: "Orders", href: "/orders" },
  { id: "profile", label: "Profile", href: "/profile" },
];

const EXPLORE_CHIPS = [
  {
    id: "categories",
    label: "Categories",
    href: "/shop?mode=categories",
    bg: "linear-gradient(90deg,#06B6D4,#22D3EE)",
  },
  {
    id: "new",
    label: "New arrivals",
    href: "/shop?mode=new",
    bg: "linear-gradient(90deg,#16A34A,#4ADE80)",
  },
  {
    id: "trending",
    label: "Trending",
    href: "/shop?mode=trending",
    bg: "linear-gradient(90deg,#DB2777,#FB7185)",
  },
  {
    id: "stores",
    label: "Stores",
    href: "/shop?mode=stores",
    bg: "linear-gradient(90deg,#4F46E5,#818CF8)",
  },
  {
    id: "shop",
    label: "Shop",
    href: "/shop",
    bg: "linear-gradient(90deg,#7C3AED,#C084FC)",
  },
];

function resolveHref(item: LoungeItem) {
  return TILE_HREF[item.id] || item.href || "/";
}

function isTileActive(item: LoungeItem, pathname: string) {
  const href = resolveHref(item);
  const pathOnly = href.split("?")[0].split("#")[0];
  if (item.id === "home") return pathname === "/";
  if (["categories", "new", "trending", "stores"].includes(item.id)) {
    return pathname === "/shop" || pathname.startsWith("/shop");
  }
  if (pathOnly === "/") return pathname === "/";
  return pathname === pathOnly || pathname.startsWith(pathOnly + "/");
}

type Hit =
  | { type: "product"; id: string; label: string; image?: string; price: number; region?: string }
  | { type: "store"; id: string; label: string; logo?: string }
  | { type: "category"; label: string };

type StorePick = { id: string; name: string; logo?: string; cover?: string };

function Tile({
  item,
  active,
  index,
  bagCount,
  onAppOnly,
}: {
  item: LoungeItem;
  active: boolean;
  index: number;
  bagCount?: number;
  onAppOnly?: (id: string) => void;
}) {
  const palette = TILE_COLORS[item.id] || {
    bg: "#11131C",
    accent: "#00E575",
    glow: "rgba(0,229,117,0.2)",
  };
  const Icon = ICONS[item.id] || Store;
  const href = resolveHref(item);
  const isAppOnly = APP_ONLY.has(item.id);

  const body = (
    <>
      <span
        className="pointer-events-none absolute -right-7 -top-7 h-[88px] w-[88px]"
        style={{ background: palette.glow, opacity: active ? 0.55 : 0.2 }}
      />
      {active && (
        <span
          className="absolute bottom-0 left-0 top-0 w-[3px]"
          style={{ background: palette.accent }}
        />
      )}
      <span className="flex items-start gap-2">
        <span
          className="flex h-10 w-10 items-center justify-center"
          style={{
            background: `${palette.accent}18`,
            border: `1px solid ${palette.accent}35`,
          }}
        >
          <Icon
            className="h-5 w-5"
            style={{ color: active ? palette.accent : "#F5F7FA" }}
          />
        </span>
        {item.id === "cart" && (bagCount ?? 0) > 0 && (
          <span className="min-w-[20px] bg-[#00E575] px-1.5 py-0.5 text-center text-[10px] font-extrabold text-[#041412]">
            {(bagCount ?? 0) > 99 ? "99+" : bagCount}
          </span>
        )}
      </span>
      <span>
        <span
          className="block text-[13px] font-bold tracking-[-0.2px]"
          style={{ color: active ? palette.accent : "#F5F7FA" }}
        >
          {item.label}
        </span>
        {item.subtitle && (
          <span className="mt-1 block text-[11px] text-white/35">{item.subtitle}</span>
        )}
      </span>
    </>
  );

  const className =
    "relative flex min-h-[132px] flex-col justify-between overflow-hidden p-3.5 transition duration-300 hover:brightness-110 sm:min-h-[140px] sm:p-4";

  const style: React.CSSProperties = {
    background: palette.bg,
    border: `1px solid ${active ? palette.accent : "rgba(255,255,255,0.08)"}`,
    animation: `loungeIn 700ms cubic-bezier(0.22,1,0.36,1) ${160 + index * 48}ms both`,
  };

  if (isAppOnly) {
    return (
      <button
        type="button"
        onClick={() => onAppOnly?.(item.id)}
        className={`${className} w-full text-left`}
        style={style}
      >
        {body}
      </button>
    );
  }

  return (
    <Link href={href} className={className} style={style}>
      {body}
    </Link>
  );
}

function TvAppIcon({
  item,
  index,
  bagCount,
  onAppOnly,
}: {
  item: LoungeItem;
  index: number;
  bagCount?: number;
  onAppOnly?: (id: string) => void;
}) {
  const palette = TILE_COLORS[item.id] || {
    bg: "#1C1F2A",
    accent: "#00E575",
    glow: "rgba(0,229,117,0.2)",
  };
  const Icon = ICONS[item.id] || Store;
  const href = resolveHref(item);
  const isAppOnly = APP_ONLY.has(item.id);

  const inner = (
    <>
      <span
        className="relative flex h-[72px] w-[118px] items-center justify-center overflow-hidden rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition duration-300 group-hover:scale-[1.04] group-hover:brightness-110 group-focus-visible:ring-2 group-focus-visible:ring-white"
        style={{
          background: `linear-gradient(160deg, ${palette.bg} 0%, #0A0B10 100%)`,
          boxShadow: `inset 0 1px 0 ${palette.accent}40, 0 8px 24px ${palette.glow}`,
        }}
      >
        <span
          className="pointer-events-none absolute -right-4 -top-4 h-14 w-14 rounded-full opacity-50"
          style={{ background: palette.accent }}
        />
        <Icon className="relative h-8 w-8" style={{ color: palette.accent }} />
        {item.id === "cart" && (bagCount ?? 0) > 0 && (
          <span className="absolute right-2 top-2 min-w-[18px] rounded-full bg-[#00E575] px-1 text-center text-[10px] font-extrabold text-[#041412]">
            {(bagCount ?? 0) > 99 ? "99+" : bagCount}
          </span>
        )}
      </span>
      <span className="mt-2 max-w-[118px] truncate text-center text-[12px] font-medium text-white/80">
        {item.label}
      </span>
    </>
  );

  const wrap =
    "group flex w-[118px] shrink-0 flex-col items-center outline-none";
  const anim = {
    animation: `loungeIn 600ms cubic-bezier(0.22,1,0.36,1) ${100 + index * 35}ms both`,
  } as React.CSSProperties;

  if (isAppOnly) {
    return (
      <button type="button" onClick={() => onAppOnly?.(item.id)} className={wrap} style={anim}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={href} className={wrap} style={anim}>
      {inner}
    </Link>
  );
}

function PosterCard({
  href,
  image,
  kicker,
  title,
  body,
  cta,
  onClick,
}: {
  href?: string;
  image?: string | null;
  kicker: string;
  title: string;
  body?: string;
  cta?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(115deg,#0B1220 0%,#0C1A16 45%,#0A1018 100%)",
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
      <div className="relative z-[1] flex h-full flex-col justify-end p-6 lg:p-8">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-white/55">{kicker}</p>
        <h2 className="mt-1 max-w-lg text-[1.65rem] font-semibold leading-tight tracking-tight text-white lg:text-[2rem]">
          {title}
        </h2>
        {body && <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/65">{body}</p>}
        {cta && (
          <span className="mt-4 inline-flex h-9 w-fit items-center rounded-full bg-white px-4 text-[12px] font-semibold text-[#0A0B10]">
            {cta}
          </span>
        )}
      </div>
    </>
  );

  const cls =
    "group relative block min-h-[240px] overflow-hidden rounded-2xl bg-[#12141C] transition duration-300 hover:brightness-110 lg:min-h-[280px]";

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} w-full text-left`}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={href || "/"} className={cls}>
      {inner}
    </Link>
  );
}

export default function LoungePage() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [serverProducts, setServerProducts] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [bag, setBag] = useState(0);
  const [prompt, setPrompt] = useState<AppFeature | null>(null);
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);

  const role = (user?.publicMetadata?.role as string) || "buyer";
  const isSeller = role === "seller" || role === "admin";

  useEffect(() => {
    const sync = () => setBag(cartCount());
    sync();
    window.addEventListener("plazore-cart", sync);
    return () => window.removeEventListener("plazore-cart", sync);
  }, []);

  useEffect(() => {
    fetchMallProducts().then(setAllProducts);
  }, []);

  useEffect(() => {
    if (!isSignedIn || !isSeller) {
      setStoreLogo(null);
      setStoreName(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        for (const ep of ["/seller/store", "/seller/me", "/users/me"]) {
          try {
            const res = await fetch(`${API}${ep}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) continue;
            const json = await res.json();
            const data = json?.data || json;
            const logo =
              data?.storeLogo || data?.store?.storeLogo || data?.logo || null;
            const name =
              data?.storeName || data?.store?.storeName || data?.name || null;
            if (alive && (logo || name)) {
              if (logo) setStoreLogo(String(logo));
              if (name) setStoreName(String(name));
              return;
            }
          } catch {
            /* next */
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [isSignedIn, isSeller, getToken]);

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
    if (!q)
      return { products: [] as Hit[], stores: [] as Hit[], categories: [] as Hit[] };

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
  const totalHits =
    hits.products.length + hits.stores.length + hits.categories.length;

  const displayName =
    user?.fullName ||
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress ||
    "Guest";

  const onAppOnly = useCallback((id: string) => {
    if (id === "wishlist") setPrompt("wishlist" as AppFeature);
    else if (id === "saved_stores") setPrompt("saved_stores" as AppFeature);
    else setPrompt(id as AppFeature);
  }, []);

  const handleSellerCta = () => {
    if (isSeller) router.push("/seller");
    else router.push("/seller-register");
  };

  const allLoungeItems = useMemo(
    () => LOUNGE_SECTIONS.flatMap((s) => s.items),
    []
  );

  const topPicks = useMemo(
    () =>
      [...(allProducts || [])]
        .filter((p) => p.images?.[0])
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        )
        .slice(0, 20),
    [allProducts]
  );

  const trendingPicks = useMemo(
    () =>
      [...(allProducts || [])]
        .filter((p) => p.images?.[0])
        .sort((a, b) => Number((b as any).views || 0) - Number((a as any).views || 0))
        .slice(0, 16),
    [allProducts]
  );

  const storePicks = useMemo(() => {
    const map = new Map<string, StorePick>();
    (allProducts || []).forEach((p) => {
      const s = p.seller as any;
      if (!s || typeof s === "string" || !s._id) return;
      const id = String(s._id);
      if (map.has(id)) return;
      map.set(id, {
        id,
        name: s.storeName || s.name || "Store",
        logo: s.storeLogo,
        cover: p.images?.[0],
      });
    });
    return Array.from(map.values()).slice(0, 14);
  }, [allProducts]);

  let mobileTileIndex = 0;
  const heroPoster = topPicks[0]?.images?.[0] || trendingPicks[0]?.images?.[0];

  return (
    <div className="min-h-dvh bg-[#050508] text-[#F5F7FA]">
      <style>{`
        @keyframes loungeIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tv-row::-webkit-scrollbar { display: none; }
        .tv-row { scrollbar-width: none; }
      `}</style>

      {/* ════════════ MOBILE — unchanged hub ════════════ */}
      <div className="md:hidden">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/5 bg-[#050508]/90 px-4 backdrop-blur-md">
          <p className="text-[10px] font-extrabold tracking-[0.2em] text-white/35">
            NAVIGATION
          </p>
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center border border-white/10 bg-[#11131C]"
            aria-label="Close lounge"
          >
            <X className="h-4 w-4" />
          </Link>
        </header>

        <div className="px-4 pb-20 pt-5">
          <div className="relative flex min-h-[72px] items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-2.png"
              alt="Plazore"
              className="h-[72px] w-[120px] object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>

          <label
            className="mx-auto mt-4 flex h-12 max-w-2xl items-center gap-3 border bg-[#0B0C12] px-4"
            style={{ borderColor: query ? "#00E575" : "rgba(255,255,255,0.08)" }}
          >
            <Search
              className="h-4 w-4 shrink-0"
              style={{ color: query ? "#00E575" : "rgba(245,247,250,0.35)" }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, stores, categories…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-white/35"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-lg leading-none text-white/35"
              >
                ×
              </button>
            )}
          </label>

          {searching ? (
            <SearchResults
              query={query}
              searchLoading={searchLoading}
              totalHits={totalHits}
              hits={hits}
            />
          ) : (
            <>
              <button
                type="button"
                onClick={handleSellerCta}
                className="mt-7 w-full overflow-hidden text-left"
              >
                {isSeller ? (
                  <div
                    className="flex items-center gap-3 px-3.5 py-3.5"
                    style={{ backgroundImage: GRAD }}
                  >
                    <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden bg-black/15">
                      {storeLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={storeLogo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Store className="h-[18px] w-[18px] text-[#050508]" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#050508]">
                        {storeName || "Seller Storefront"}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#050508]/65">
                        Products, orders & messages
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[#050508]" />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 border border-white/8 bg-[#0B0C12] px-3.5 py-3.5">
                    <span className="flex h-[42px] w-[42px] items-center justify-center bg-[#11131C]">
                      <Store className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">Open a store</span>
                      <span className="mt-0.5 block text-xs text-white/65">
                        Sell on Plazore’s digital mall
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-white/35" />
                  </div>
                )}
              </button>

              {LOUNGE_SECTIONS.map((section) => (
                <section key={section.id} className="mt-9">
                  <p className="mb-3 text-[10px] font-extrabold tracking-[0.16em] uppercase text-white/35">
                    {section.title}
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    {section.items.map((item) => {
                      const idx = mobileTileIndex++;
                      return (
                        <Tile
                          key={item.id}
                          item={item}
                          active={isTileActive(item, pathname)}
                          index={idx}
                          bagCount={item.id === "cart" ? bag : undefined}
                          onAppOnly={onAppOnly}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}

              <ProfileCard
                isLoaded={isLoaded}
                isSignedIn={!!isSignedIn}
                displayName={displayName}
                imageUrl={user?.imageUrl}
                onSignOut={() => signOut({ redirectUrl: "/sign-in" })}
              />
            </>
          )}
        </div>
      </div>

      {/* ════════════ DESKTOP — Smart TV / LG home ════════════ */}
      <div className="relative hidden min-h-dvh md:flex">
        <aside className="sticky top-0 z-20 flex h-dvh w-[72px] shrink-0 flex-col items-center gap-3 border-r border-white/6 bg-black/50 py-6 backdrop-blur-md">
          <Link href="/profile" className="mb-2" aria-label="Profile">
            {user?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.imageUrl}
                alt=""
                className="h-10 w-10 rounded-full object-cover ring-2 ring-white/20"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <User className="h-4 w-4 text-white/70" />
              </span>
            )}
          </Link>
          <Link
            href="/notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
          </Link>
          <button
            type="button"
            onClick={() => searchRef.current?.focus()}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
            aria-label="Search"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          {isSeller && (
            <button
              type="button"
              onClick={handleSellerCta}
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#00E575]/15 text-[#00E575] transition hover:bg-[#00E575]/25"
              aria-label="Seller dashboard"
            >
              {storeLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={storeLogo} alt="" className="h-full w-full object-cover" />
              ) : (
                <Store className="h-[18px] w-[18px]" />
              )}
            </button>
          )}
          <Link
            href={isSeller ? "/seller/settings" : "/profile"}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
            aria-label="Settings"
          >
            <Settings className="h-[18px] w-[18px]" />
          </Link>
          <div className="mt-auto" />
          {isLoaded && isSignedIn ? (
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <Link
              href="/sign-in"
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#00E575]"
              aria-label="Sign in"
            >
              <User className="h-4 w-4" />
            </Link>
          )}
        </aside>

        <div className="relative min-w-0 flex-1">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(0,229,117,0.07), transparent 50%), radial-gradient(ellipse 60% 40% at 90% 30%, rgba(59,130,246,0.05), transparent 45%)",
            }}
          />

          <div className="relative z-[1] mx-auto flex min-h-dvh max-w-[1600px] flex-col px-8 pb-12 pt-5 lg:px-10">
            <header className="mb-6 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-1">
                <Link href="/" className="mr-3 flex shrink-0 items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
                  <span className="text-[13px] font-semibold tracking-wide text-white/50">
                    Plazore
                  </span>
                </Link>
                <nav className="hidden items-center gap-1 lg:flex">
                  {TOP_TABS.map((tab) => {
                    const active =
                      tab.id === "for-you"
                        ? pathname === "/lounge"
                        : pathname === tab.href ||
                          (tab.href !== "/" &&
                            !tab.href.includes("?") &&
                            pathname.startsWith(tab.href));
                    return (
                      <Link
                        key={tab.id}
                        href={tab.href}
                        className={`rounded-full px-4 py-2 text-[13px] font-medium transition duration-300 ${
                          active
                            ? "bg-white text-[#0A0B10]"
                            : "text-white/55 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        {tab.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <label className="flex h-9 w-56 shrink-0 items-center gap-2 rounded-full bg-white/[0.06] px-3.5">
                <Search className="h-3.5 w-3.5 text-white/40" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full bg-transparent text-[13px] outline-none placeholder:text-white/35"
                />
              </label>
            </header>

            {searching ? (
              <div className="mx-auto w-full max-w-3xl flex-1 pt-8">
                <SearchResults
                  query={query}
                  searchLoading={searchLoading}
                  totalHits={totalHits}
                  hits={hits}
                />
              </div>
            ) : (
              <>
                {/* Dual featured posters */}
                <section className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-[1.35fr_1fr]">
                  <PosterCard
                    href="/shop"
                    image={heroPoster}
                    kicker="FOR YOU"
                    title="Your digital mall, reimagined"
                    body="Shop, manage orders, and explore stores from one lounge."
                    cta="Go to Shop"
                  />
                  {isSeller ? (
                    <PosterCard
                      href="/seller"
                      image={storeLogo}
                      kicker="SELLER DASHBOARD"
                      title={storeName || "Your storefront"}
                      body="Products, orders, messages and payouts — in one place."
                      cta="Open dashboard"
                    />
                  ) : (
                    <PosterCard
                      onClick={handleSellerCta}
                      kicker="SELL ON PLAZORE"
                      title="Open a store"
                      body="List products and reach buyers across the digital mall."
                      cta="Start selling"
                    />
                  )}
                </section>

                {/* Colored explore chips — LG Radio+ / Sports / Gaming row */}
                <section className="mb-7">
                  <div className="tv-row flex gap-2.5 overflow-x-auto pb-1">
                    {EXPLORE_CHIPS.map((chip) => (
                      <Link
                        key={chip.id}
                        href={chip.href}
                        className="flex h-12 shrink-0 items-center rounded-xl px-6 text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(0,0,0,0.25)] transition hover:brightness-110"
                        style={{ background: chip.bg }}
                      >
                        {chip.label}
                      </Link>
                    ))}
                    <Link
                      href="/cart"
                      className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-white/10 px-5 text-[14px] font-semibold text-white/90 transition hover:bg-white/15"
                    >
                      Bag
                      {bag > 0 && (
                        <span className="rounded-full bg-[#00E575] px-1.5 text-[10px] font-extrabold text-[#041412]">
                          {bag > 99 ? "99+" : bag}
                        </span>
                      )}
                    </Link>
                  </div>
                </section>

                {/* App icon row */}
                <section className="mb-9">
                  <p className="mb-3 text-[14px] font-medium text-white/70">Your apps</p>
                  <div className="tv-row flex gap-3 overflow-x-auto pb-2">
                    {allLoungeItems.map((item, index) => (
                      <TvAppIcon
                        key={item.id}
                        item={item}
                        index={index}
                        bagCount={item.id === "cart" ? bag : undefined}
                        onAppOnly={onAppOnly}
                      />
                    ))}
                  </div>
                </section>

                {topPicks.length > 0 && (
                  <section className="mb-9">
                    <div className="mb-3 flex items-end justify-between">
                      <p className="text-[14px] font-medium text-white/70">New arrivals</p>
                      <Link
                        href="/shop?mode=new"
                        className="text-[12px] font-semibold text-white/40 hover:text-white/70"
                      >
                        Show more
                      </Link>
                    </div>
                    <div className="tv-row flex gap-3 overflow-x-auto pb-1">
                      {topPicks.map((p, i) => (
                        <Link
                          key={p._id}
                          href={`/product/${p._id}`}
                          className="group shrink-0"
                          style={{
                            animation: `loungeIn 600ms cubic-bezier(0.22,1,0.36,1) ${80 + i * 40}ms both`,
                          }}
                        >
                          <div className="relative h-[148px] w-[240px] overflow-hidden rounded-xl bg-[#12141C] transition duration-300 group-hover:brightness-110">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.images![0]} alt="" className="h-full w-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-3 pb-2.5 pt-10">
                              <p className="truncate text-[13px] font-medium text-white">{p.name}</p>
                              <p className="text-[12px] text-[#00E575]">
                                {formatProductPrice(p.price, p.region, "NG")}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {trendingPicks.length > 0 && (
                  <section className="mb-9">
                    <div className="mb-3 flex items-end justify-between">
                      <p className="text-[14px] font-medium text-white/70">Trending</p>
                      <Link
                        href="/shop?mode=trending"
                        className="text-[12px] font-semibold text-white/40 hover:text-white/70"
                      >
                        Show more
                      </Link>
                    </div>
                    <div className="tv-row flex gap-3 overflow-x-auto pb-1">
                      {trendingPicks.map((p) => (
                        <Link key={`tr-${p._id}`} href={`/product/${p._id}`} className="group shrink-0">
                          <div className="relative h-[148px] w-[240px] overflow-hidden rounded-xl bg-[#12141C] transition duration-300 group-hover:brightness-110">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.images![0]} alt="" className="h-full w-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-3 pb-2.5 pt-10">
                              <p className="truncate text-[13px] font-medium text-white">{p.name}</p>
                              <p className="text-[12px] text-[#FB7185]">
                                {formatProductPrice(p.price, p.region, "NG")}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                <section className="mb-9">
                  <div className="mb-3 flex items-end justify-between">
                    <p className="text-[14px] font-medium text-white/70">Categories</p>
                    <Link
                      href="/shop?mode=categories"
                      className="text-[12px] font-semibold text-white/40 hover:text-white/70"
                    >
                      Show more
                    </Link>
                  </div>
                  <div className="tv-row flex gap-2.5 overflow-x-auto pb-1">
                    {CATEGORY_LIST.slice(0, 16).map((c, i) => (
                      <Link
                        key={c}
                        href={`/shop?mode=category&category=${encodeURIComponent(c)}`}
                        className="flex h-[88px] w-[160px] shrink-0 items-end rounded-xl px-3.5 py-3 text-[13px] font-bold text-white transition hover:brightness-110"
                        style={{
                          background: `linear-gradient(160deg, ${
                            ["#0B3A4A", "#1A2A4A", "#2A1848", "#123628", "#3A1A28", "#1C2840"][
                              i % 6
                            ]
                          } 0%, #0A0B10 100%)`,
                        }}
                      >
                        {c}
                      </Link>
                    ))}
                  </div>
                </section>

                {storePicks.length > 0 && (
                  <section className="mb-6">
                    <div className="mb-3 flex items-end justify-between">
                      <p className="text-[14px] font-medium text-white/70">Stores</p>
                      <Link
                        href="/shop?mode=stores"
                        className="text-[12px] font-semibold text-white/40 hover:text-white/70"
                      >
                        Show more
                      </Link>
                    </div>
                    <div className="tv-row flex gap-3 overflow-x-auto pb-1">
                      {storePicks.map((s) => (
                        <Link key={s.id} href={`/store/${s.id}`} className="group shrink-0">
                          <div className="relative h-[148px] w-[220px] overflow-hidden rounded-xl bg-[#12141C] transition duration-300 group-hover:brightness-110">
                            {s.cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.cover} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full bg-[#161822]" />
                            )}
                            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2.5 pt-10">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
                                {s.logo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={s.logo} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <Store className="h-3.5 w-3.5 text-white/70" />
                                )}
                              </span>
                              <p className="truncate text-[13px] font-medium text-white">{s.name}</p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                <div className="mt-auto flex items-center justify-between pt-6">
                  <p className="text-[12px] text-white/30">
                    {isLoaded && isSignedIn
                      ? `Signed in as ${displayName}`
                      : "Browsing as guest"}
                  </p>
                  {isLoaded && isSignedIn ? (
                    <button
                      type="button"
                      onClick={() => signOut({ redirectUrl: "/sign-in" })}
                      className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white/70"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Log out
                    </button>
                  ) : (
                    <Link href="/sign-in" className="text-[12px] font-medium text-[#00E575]">
                      Sign in
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <AppFeaturePrompt feature={prompt} onClose={() => setPrompt(null)} />
    </div>
  );
}

function SearchResults({
  query,
  searchLoading,
  totalHits,
  hits,
}: {
  query: string;
  searchLoading: boolean;
  totalHits: number;
  hits: { products: Hit[]; stores: Hit[]; categories: Hit[] };
}) {
  if (searchLoading && totalHits === 0) {
    return (
      <p className="py-16 text-center text-sm text-white/55">Searching Plazore…</p>
    );
  }
  if (totalHits === 0) {
    return (
      <p className="py-16 text-center text-sm text-white/55">
        No results for “{query.trim()}”
      </p>
    );
  }
  return (
    <div className="mt-4">
      {hits.products.length > 0 && (
        <div className="mb-8">
          <p className="mb-4 text-[10px] font-extrabold tracking-[0.16em] text-white/35">
            PRODUCTS
          </p>
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
                    <p className="mt-1 text-sm font-semibold text-[#00E575]">
                      {formatProductPrice(h.price, h.region, "NG")}
                    </p>
                  </div>
                </Link>
              ) : null
            )}
          </div>
        </div>
      )}
      {hits.stores.length > 0 && (
        <div className="mb-8">
          <p className="mb-4 text-[10px] font-extrabold tracking-[0.16em] text-white/35">
            STORES
          </p>
          {hits.stores.map((h) =>
            h.type === "store" ? (
              <Link key={h.id} href={`/store/${h.id}`} className="mb-3 flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden bg-[#11131C]">
                  {h.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.logo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-5 w-5 text-[#3B82F6]" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{h.label}</p>
                  <p className="mt-1 text-xs font-semibold text-[#3B82F6]">Official storefront</p>
                </div>
              </Link>
            ) : null
          )}
        </div>
      )}
      {hits.categories.length > 0 && (
        <div>
          <p className="mb-4 text-[10px] font-extrabold tracking-[0.16em] text-white/35">
            CATEGORIES
          </p>
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
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileCard({
  isLoaded,
  isSignedIn,
  displayName,
  imageUrl,
  onSignOut,
}: {
  isLoaded: boolean;
  isSignedIn: boolean;
  displayName: string;
  imageUrl?: string;
  onSignOut: () => void;
}) {
  return (
    <div className="mt-10 border border-white/8 bg-[#0B0C12] p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden border border-[#00E575]/30 bg-[#11131C]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <User className="h-4 w-4 text-white/65" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {isLoaded && isSignedIn ? displayName : "Guest"}
          </p>
          <p className="text-[11px] text-white/35">
            {isLoaded && isSignedIn
              ? "This profile is currently active"
              : "Sign in to sync your account"}
          </p>
        </div>
      </div>
      {isLoaded && isSignedIn ? (
        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 inline-flex items-center gap-2 border border-white/8 px-3 py-1.5 text-xs text-red/65"
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
  );
}