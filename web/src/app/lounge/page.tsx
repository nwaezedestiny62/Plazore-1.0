"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Bookmark,
  Building2,
  CreditCard,
  Flame,
  Heart,
  HelpCircle,
  Home,
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
import { AppFeaturePrompt, type AppFeature } from "@/components/app/AppFeaturePrompt";
import { fetchMallProducts, searchSuggest } from "@/lib/api";
import { LOUNGE_SECTIONS, TILE_COLORS, type LoungeItem } from "@/lib/lounge";
import { CATEGORY_LIST } from "@/lib/productCatalog";
import { useMarketplace } from "@/context/MarketplaceContext";
import type { Product } from "@/lib/types";
import { cartCount } from "@/lib/cart";

const API =
  process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com/api";

const SELL_POSTER_LOCAL = "/auth-logo.jpg";
const SELL_POSTER_LOCAL_2 = "/hero/welcome.jpg";
const SELL_POSTER_REMOTE =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80";
const SELL_POSTER_CACHE_KEY = "plazore_lounge_sell_poster_v1";

const CATEGORY_IMAGES: Record<string, string> = {
  Electronics:
    "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=300&fit=crop",
  "Phones & Accessories":
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=300&fit=crop",
  Computers:
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop",
  Fashion:
    "https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=300&fit=crop",
  "Beauty & Personal Care":
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=300&fit=crop",
  "Home & Living":
    "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400&h=300&fit=crop",
  Furniture:
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop",
  "Kitchen & Dining":
    "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400&h=300&fit=crop",
  Groceries:
    "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=300&fit=crop",
  Health:
    "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400&h=300&fit=crop",
  "Sports & Outdoors":
    "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?w=400&h=300&fit=crop",
  Automotive:
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&h=300&fit=crop",
  Books:
    "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&h=300&fit=crop",
  "Office Supplies":
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop",
  "Toys & Games":
    "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=400&h=300&fit=crop",
  "Baby Products":
    "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&h=300&fit=crop",
  "Pet Supplies":
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop",
  "Jewelry & Watches":
    "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=300&fit=crop",
  "Musical Instruments":
    "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=300&fit=crop",
  "Art & Crafts":
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=300&fit=crop",
  "Industrial Equipment":
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&h=300&fit=crop",
  Agriculture:
    "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&h=300&fit=crop",
  "Building Materials":
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop",
  Collectibles:
    "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=400&h=300&fit=crop",
  "Luxury Goods":
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop",
  Others:
    "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=300&fit=crop",
};

const FALLBACK_CATEGORY_IMAGE =
  "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=300&fit=crop";

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
  help: "/help",
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
    label: "Shop by category",
    href: "/shop?mode=categories",
    bg: "linear-gradient(90deg,#06B6D4,#22D3EE)",
  },
  {
    id: "new",
    label: "Just in",
    href: "/shop?mode=new",
    bg: "linear-gradient(90deg,#16A34A,#4ADE80)",
  },
  {
    id: "trending",
    label: "What's popular",
    href: "/shop?mode=trending",
    bg: "linear-gradient(90deg,#DB2777,#FB7185)",
  },
  {
    id: "stores",
    label: "Browse stores",
    href: "/shop?mode=stores",
    bg: "linear-gradient(90deg,#4F46E5,#818CF8)",
  },
  {
    id: "shop",
    label: "Start shopping",
    href: "/shop",
    bg: "linear-gradient(90deg,#7C3AED,#C084FC)",
  },
];

const RAIL_LIMIT = 14;

/* ── product helpers ─────────────────────────────────────────── */

function productCreated(p: Product) {
  const t = new Date((p as any).createdAt || 0).getTime();
  return Number.isFinite(t) ? t : 0;
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
    x.wishlistCount,
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

function getSellerId(p: Product): string | null {
  const s = (p as any).seller;
  if (!s) return null;
  if (typeof s === "string") return s;
  return s._id ? String(s._id) : null;
}

function getSellerName(p: Product): string {
  const s = (p as any).seller;
  if (!s || typeof s === "string") return "";
  return String(s.storeName || s.name || "").trim();
}

function getSellerLogo(p: Product): string | undefined {
  const s = (p as any).seller;
  if (!s || typeof s === "string") return undefined;
  return s.storeLogo || undefined;
}

/** Newest products on Plazore */
function sortNewest(list: Product[]): Product[] {
  return [...list].sort((a, b) => productCreated(b) - productCreated(a));
}

/** Most viewed products on Plazore */
function sortMostViewed(list: Product[]): Product[] {
  return [...list].sort((a, b) => {
    const d = viewScore(b) - viewScore(a);
    return d !== 0 ? d : productCreated(b) - productCreated(a);
  });
}

/* ── sell poster prefetch ────────────────────────────────────── */

function usePrefetchedSellPoster() {
  const [src, setSrc] = useState(SELL_POSTER_LOCAL);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const apply = (url: string) => {
      if (!cancelled) setSrc(url);
    };

    apply(SELL_POSTER_LOCAL);

    const probe = (url: string, onOk: () => void, onFail?: () => void) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = onOk;
      img.onerror = () => onFail?.();
      img.src = url;
    };

    probe(
      SELL_POSTER_LOCAL,
      () => apply(SELL_POSTER_LOCAL),
      () => {
        probe(SELL_POSTER_LOCAL_2, () => apply(SELL_POSTER_LOCAL_2));
      },
    );

    try {
      const cached = localStorage.getItem(SELL_POSTER_CACHE_KEY);
      if (cached && /^https?:\/\//i.test(cached)) {
        probe(cached, () => apply(cached));
      }
    } catch {
      /* private mode */
    }

    probe(
      SELL_POSTER_REMOTE,
      () => {
        apply(SELL_POSTER_REMOTE);
        try {
          localStorage.setItem(SELL_POSTER_CACHE_KEY, SELL_POSTER_REMOTE);
        } catch {
          /* ignore */
        }
      },
      () => {
        /* keep local */
      },
    );

    (async () => {
      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false)
          return;
        const res = await fetch(SELL_POSTER_REMOTE, {
          mode: "cors",
          cache: "force-cache",
          credentials: "omit",
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled || !blob.type.startsWith("image/")) return;
        objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          if (!cancelled && objectUrl) apply(objectUrl);
        };
        img.onerror = () => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
        img.src = objectUrl;
      } catch {
        /* offline / CORS */
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return src;
}

/* ── shared UI ───────────────────────────────────────────────── */

function LoungeImg({
  src,
  alt = "",
  className = "h-full w-full object-cover",
  loading = "lazy" as "lazy" | "eager",
  fallbackSrc,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
  fallbackSrc?: string;
}) {
  const [current, setCurrent] = useState(src || fallbackSrc || "");
  const [failed, setFailed] = useState(!src && !fallbackSrc);

  useEffect(() => {
    setCurrent(src || fallbackSrc || "");
    setFailed(!src && !fallbackSrc);
  }, [src, fallbackSrc]);

  if (!current || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-[#12141C] ${
          className.includes("absolute") ? "absolute inset-0" : "h-full w-full"
        }`}
        aria-hidden
      >
        <span className="select-none text-[11px] font-extrabold tracking-[0.28em] text-white/25">
          LOUNGE
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      onError={() => {
        if (fallbackSrc && current !== fallbackSrc) {
          setCurrent(fallbackSrc);
          return;
        }
        setFailed(true);
      }}
    />
  );
}

function resolveHref(item: LoungeItem) {
  if (item.id === "help") return "/help";
  if (item.id === "contact") return "/contact";
  if (item.id === "about") return "/about";
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
  | {
      type: "product";
      id: string;
      label: string;
      image?: string;
      price: number;
      region?: string;
    }
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
          <span className="mt-1 block text-[11px] text-white/35">
            {item.subtitle}
          </span>
        )}
      </span>
    </>
  );

  const className =
    "relative flex min-h-[132px] flex-col justify-between overflow-hidden p-3.5 transition duration-200 hover:brightness-110 sm:min-h-[140px] sm:p-4";

  const style: React.CSSProperties = {
    background: palette.bg,
    border: `1px solid ${active ? palette.accent : "rgba(255,255,255,0.08)"}`,
    animation: `loungeIn 500ms ease-out ${Math.min(index, 12) * 30}ms both`,
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
        className="relative flex h-[72px] w-[118px] items-center justify-center overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition duration-200 group-hover:brightness-110 group-focus-visible:ring-2 group-focus-visible:ring-white"
        style={{
          background: `linear-gradient(160deg, ${palette.bg} 0%, #0A0B10 100%)`,
          boxShadow: `inset 0 1px 0 ${palette.accent}40, 0 8px 24px ${palette.glow}`,
        }}
      >
        <span
          className="pointer-events-none absolute -right-4 -top-4 h-14 w-14 opacity-50"
          style={{ background: palette.accent }}
        />
        <Icon className="relative h-8 w-8" style={{ color: palette.accent }} />
        {item.id === "cart" && (bagCount ?? 0) > 0 && (
          <span className="absolute right-2 top-2 min-w-[18px] bg-[#00E575] px-1 text-center text-[10px] font-extrabold text-[#041412]">
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
    animation: `loungeIn 450ms ease-out ${Math.min(index, 14) * 25}ms both`,
  } as React.CSSProperties;

  if (isAppOnly) {
    return (
      <button
        type="button"
        onClick={() => onAppOnly?.(item.id)}
        className={wrap}
        style={anim}
      >
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
  imageFallback,
  kicker,
  title,
  body,
  cta,
  onClick,
}: {
  href?: string;
  image?: string | null;
  imageFallback?: string;
  kicker: string;
  title: string;
  body?: string;
  cta?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <LoungeImg
        src={image}
        fallbackSrc={imageFallback}
        loading="eager"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/30 to-black/10" />
      <div className="relative z-[1] flex h-full flex-col justify-end p-6 lg:p-8">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-white/55">
          {kicker}
        </p>
        <h2 className="mt-1 max-w-lg text-[1.65rem] font-semibold leading-tight tracking-tight text-white lg:text-[2rem]">
          {title}
        </h2>
        {body && (
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/65">
            {body}
          </p>
        )}
        {cta && (
          <span className="mt-4 inline-flex h-9 w-fit items-center bg-white px-4 text-[12px] font-semibold text-[#0A0B10]">
            {cta}
          </span>
        )}
      </div>
    </>
  );

  const cls =
    "group relative block min-h-[240px] overflow-hidden bg-[#12141C] transition duration-200 hover:brightness-110 lg:min-h-[280px]";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${cls} w-full text-left`}
      >
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

function HomeToMall({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`flex h-10 w-10 shrink-0 items-center justify-center border border-white/10 bg-white/[0.06] text-white/85 transition hover:border-white/20 hover:bg-white/10 hover:text-white ${className}`}
      aria-label="Back to mall"
      title="Mall"
    >
      <Home className="h-[18px] w-[18px]" strokeWidth={1.75} />
    </Link>
  );
}

/** Horizontal product rail — same look on mobile + desktop */
function ProductRail({
  title,
  href,
  products,
  formatProduct,
  priceClass = "text-[#00E575]",
}: {
  title: string;
  href: string;
  products: Product[];
  formatProduct: (amount: number, productRegion?: string | null) => string;
  priceClass?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section className="mb-8 sm:mb-9">
      <div className="mb-3 flex items-end justify-between gap-3">
        <p className="text-[14px] font-medium text-white/70">{title}</p>
        <Link
          href={href}
          className="shrink-0 text-[12px] font-semibold text-white/40 hover:text-white/70"
        >
          See all
        </Link>
      </div>
      <div className="tv-row -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((p) => (
          <Link
            key={p._id}
            href={`/product/${p._id}`}
            className="group shrink-0"
          >
            <div className="relative h-[132px] w-[200px] overflow-hidden bg-[#12141C] transition duration-200 group-hover:brightness-110 sm:h-[148px] sm:w-[240px]">
              <LoungeImg
                src={p.images?.[0]}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-3 pb-2.5 pt-10">
                <p className="truncate text-[13px] font-medium text-white">
                  {p.name}
                </p>
                <p className={`text-[12px] ${priceClass}`}>
                  {formatProduct(Number(p.price) || 0, (p as any).region)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── page ────────────────────────────────────────────────────── */

export default function LoungePage() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { formatProduct } = useMarketplace();
  const searchRef = useRef<HTMLInputElement>(null);
  const sellPosterSrc = usePrefetchedSellPoster();

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

  const displayName =
    user?.fullName ||
    user?.firstName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    "You";

  useEffect(() => {
    const sync = () => setBag(cartCount());
    sync();
    window.addEventListener("plazore-cart", sync);
    window.addEventListener("plazore-cart-change", sync);
    return () => {
      window.removeEventListener("plazore-cart", sync);
      window.removeEventListener("plazore-cart-change", sync);
    };
  }, []);

  /** Load a solid product pool for rails + search */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [trending, newest] = await Promise.all([
          fetchMallProducts({ limit: 40, sort: "trending" }),
          fetchMallProducts({ limit: 40, sort: "newest" }),
        ]);
        if (cancelled) return;
        const map = new Map<string, Product>();
        for (const p of [...(newest || []), ...(trending || [])]) {
          if (p?._id) map.set(String(p._id), p);
        }
        setAllProducts(Array.from(map.values()));
      } catch {
        try {
          const list = await fetchMallProducts({ limit: 50 });
          if (!cancelled) setAllProducts(list || []);
        } catch {
          if (!cancelled) setAllProducts([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
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
    const t = setTimeout(() => setDebounced(query.trim()), 220);
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
    (async () => {
      try {
        const list = await fetchMallProducts({
          q: debounced,
          limit: 30,
          sort: "trending",
        });
        if (!cancelled) setServerProducts(list || []);
      } catch {
        if (!cancelled) setServerProducts([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const searching = debounced.length > 0;

  /** NEW TO PLAZORE — newest by createdAt */
  const newArrivals = useMemo(
    () => sortNewest(allProducts).slice(0, RAIL_LIMIT),
    [allProducts],
  );

  /** SHOPPERS ARE LOOKING AT — most viewed */
  const trendingPicks = useMemo(
    () => sortMostViewed(allProducts).slice(0, RAIL_LIMIT),
    [allProducts],
  );

  const heroPoster = useMemo(() => {
    const first = newArrivals[0] || trendingPicks[0];
    return first?.images?.[0] || sellPosterSrc;
  }, [newArrivals, trendingPicks, sellPosterSrc]);

  const storePicks = useMemo(() => {
    const map = new Map<string, StorePick>();
    for (const p of allProducts) {
      const id = getSellerId(p);
      if (!id || map.has(id)) continue;
      const name = getSellerName(p);
      if (!name) continue;
      map.set(id, {
        id,
        name,
        logo: getSellerLogo(p),
        cover: p.images?.[0],
      });
      if (map.size >= 12) break;
    }
    return Array.from(map.values());
  }, [allProducts]);

  const allLoungeItems = useMemo(() => {
    const items: LoungeItem[] = [];
    for (const section of LOUNGE_SECTIONS) {
      for (const item of section.items) items.push(item);
    }
    return items;
  }, []);

  const hits = useMemo(() => {
    const q = debounced.toLowerCase();
    const pool =
      serverProducts.length > 0 ? serverProducts : allProducts;

    const products: Hit[] = pool
      .filter((p) => (p.name || "").toLowerCase().includes(q))
      .slice(0, 16)
      .map((p) => ({
        type: "product" as const,
        id: String(p._id),
        label: p.name || "Product",
        image: p.images?.[0],
        price: Number(p.price) || 0,
        region: (p as any).region,
      }));

    const storesMap = new Map<string, Hit>();
    for (const p of allProducts) {
      const id = getSellerId(p);
      const name = getSellerName(p);
      if (!id || !name) continue;
      if (!name.toLowerCase().includes(q)) continue;
      if (!storesMap.has(id)) {
        storesMap.set(id, {
          type: "store",
          id,
          label: name,
          logo: getSellerLogo(p),
        });
      }
    }

    const categories: Hit[] = CATEGORY_LIST.filter((c) =>
      c.toLowerCase().includes(q),
    )
      .slice(0, 10)
      .map((label) => ({ type: "category" as const, label }));

    return {
      products,
      stores: Array.from(storesMap.values()).slice(0, 10),
      categories,
    };
  }, [debounced, serverProducts, allProducts]);

  const totalHits =
    hits.products.length + hits.stores.length + hits.categories.length;

  const handleSellerCta = useCallback(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in?redirect_url=/seller-register");
      return;
    }
    router.push(isSeller ? "/seller" : "/seller-register");
  }, [isLoaded, isSignedIn, isSeller, router]);

  const onAppOnly = useCallback((id: string) => {
    if (id === "wishlist") setPrompt("wishlist");
    else if (id === "saved_stores") setPrompt("saved_stores");
  }, []);

  return (
    <div className="min-h-dvh bg-[#07080C] text-white">
      <style jsx global>{`
        @keyframes loungeIn {
          from {
            opacity: 0;
            transform: translate3d(0, 10px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
          }
        }
      `}</style>

      {/* ═══════ MOBILE ═══════ */}
      <div className="lg:hidden">
        <header className="sticky top-0 z-30 border-b border-white/5 bg-[#07080C]/92 backdrop-blur-md">
          <div className="flex h-12 items-center gap-2 px-3 sm:h-14 sm:px-4">
            <HomeToMall />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-white/40">
                PLAZORE
              </p>
              <p className="truncate text-[15px] font-bold tracking-tight">
                Lounge
              </p>
            </div>
            <Link
              href="/cart"
              className="relative flex h-10 w-10 items-center justify-center text-white/85"
              aria-label="Bag"
            >
              <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {bag > 0 && (
                <span className="absolute -right-0.5 -top-0.5 min-w-[16px] bg-[#00E575] px-1 text-center text-[9px] font-extrabold text-[#041412]">
                  {bag > 99 ? "99+" : bag}
                </span>
              )}
            </Link>
          </div>

          <div className="px-3 pb-3 sm:px-4">
            <label className="flex h-11 items-center gap-2 border border-white/10 bg-white/[0.06] px-3">
              <Search className="h-4 w-4 shrink-0 text-white/40" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the mall"
                className="w-full bg-transparent text-[14px] outline-none placeholder:text-white/35"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setDebounced("");
                  }}
                  className="text-white/40"
                >
                  ×
                </button>
              ) : null}
            </label>
          </div>
        </header>

        <div className="px-3 pb-20 pt-4 sm:px-4">
          {searching ? (
            <SearchResults
              query={query}
              searchLoading={searchLoading}
              totalHits={totalHits}
              hits={hits}
              formatProduct={formatProduct}
            />
          ) : (
            <>
              <section className="mb-5 grid grid-cols-1 gap-3">
                <PosterCard
                  href="/shop"
                  image={heroPoster}
                  imageFallback={sellPosterSrc}
                  kicker="FOR YOU"
                  title="Find something you actually want"
                  body="Browse the mall, save what you like, and check out when you're ready."
                  cta="Start shopping"
                />
                {isSeller ? (
                  <PosterCard
                    href="/seller"
                    image={storeLogo}
                    imageFallback={sellPosterSrc}
                    kicker="YOUR STORE"
                    title={storeName || "Seller dashboard"}
                    body="Listings, orders, messages, and payouts — all in one place."
                    cta="Open your store"
                  />
                ) : (
                  <PosterCard
                    onClick={handleSellerCta}
                    image={sellPosterSrc}
                    imageFallback={SELL_POSTER_LOCAL}
                    kicker="SECURE A STORE"
                    title="Turn what you sell into a store"
                    body="List products and meet buyers already shopping the mall."
                    cta="Secure a store today"
                  />
                )}
              </section>

              <section className="mb-6">
                <div className="tv-row flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {EXPLORE_CHIPS.map((chip) => (
                    <Link
                      key={chip.id}
                      href={chip.href}
                      className="flex h-11 shrink-0 items-center px-4 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
                      style={{ background: chip.bg }}
                    >
                      {chip.label}
                    </Link>
                  ))}
                </div>
              </section>

              <section className="mb-7">
                <p className="mb-3 text-[14px] font-medium text-white/70">
                  Jump in
                </p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {allLoungeItems.map((item, index) => (
                    <Tile
                      key={item.id}
                      item={item}
                      active={isTileActive(item, pathname)}
                      index={index}
                      bagCount={item.id === "cart" ? bag : undefined}
                      onAppOnly={onAppOnly}
                    />
                  ))}
                </div>
              </section>

              <ProductRail
                title="New to Plazore"
                href="/shop?mode=new"
                products={newArrivals}
                formatProduct={formatProduct}
                priceClass="text-[#00E575]"
              />

              <ProductRail
                title="Shoppers are looking at"
                href="/shop?mode=trending"
                products={trendingPicks}
                formatProduct={formatProduct}
                priceClass="text-[#FB7185]"
              />

              <section className="mb-8">
                <div className="mb-3 flex items-end justify-between">
                  <p className="text-[14px] font-medium text-white/70">
                    Shop by category
                  </p>
                  <Link
                    href="/shop?mode=categories"
                    className="text-[12px] font-semibold text-white/40"
                  >
                    See all
                  </Link>
                </div>
                <div className="tv-row flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {CATEGORY_LIST.slice(0, 16).map((c) => (
                    <Link
                      key={c}
                      href={`/shop?mode=category&category=${encodeURIComponent(c)}`}
                      className="group relative h-[88px] w-[160px] shrink-0 overflow-hidden"
                    >
                      <LoungeImg
                        src={CATEGORY_IMAGES[c] || FALLBACK_CATEGORY_IMAGE}
                        alt={c}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
                      <span className="relative z-[1] flex h-full items-end px-3.5 py-3 text-[13px] font-bold text-white">
                        {c}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>

              {storePicks.length > 0 && (
                <section className="mb-6">
                  <div className="mb-3 flex items-end justify-between">
                    <p className="text-[14px] font-medium text-white/70">
                      Stores to visit
                    </p>
                    <Link
                      href="/shop?mode=stores"
                      className="text-[12px] font-semibold text-white/40"
                    >
                      See all
                    </Link>
                  </div>
                  <div className="tv-row flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {storePicks.map((s) => (
                      <Link
                        key={s.id}
                        href={`/store/${s.id}`}
                        className="group shrink-0"
                      >
                        <div className="relative h-[132px] w-[200px] overflow-hidden bg-[#12141C] sm:h-[148px] sm:w-[220px]">
                          <LoungeImg
                            src={s.cover}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2.5 pt-10">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden bg-white/10">
                              {s.logo ? (
                                <LoungeImg
                                  src={s.logo}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Store className="h-3.5 w-3.5 text-white/70" />
                              )}
                            </span>
                            <p className="truncate text-[12px] font-medium">
                              {s.name}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

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

      {/* ═══════ DESKTOP ═══════ */}
      <div className="hidden min-h-dvh lg:flex">
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 py-6 xl:px-10">
          <header className="mb-6 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <HomeToMall />
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-white/40">
                  PLAZORE
                </p>
                <p className="text-[18px] font-bold tracking-tight">Lounge</p>
              </div>
              <nav className="flex items-center gap-1">
                {TOP_TABS.map((tab) => {
                  const pathOnly = tab.href.split("?")[0];
                  const active =
                    pathOnly === "/lounge"
                      ? pathname === "/lounge"
                      : pathname === pathOnly ||
                        pathname.startsWith(pathOnly + "/");
                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      className={`px-4 py-2 text-[13px] font-medium transition duration-200 ${
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

            <label className="flex h-9 w-56 shrink-0 items-center gap-2 border border-white/10 bg-white/[0.06] px-3.5">
              <Search className="h-3.5 w-3.5 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the mall"
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
                formatProduct={formatProduct}
              />
            </div>
          ) : (
            <>
              <section className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-[1.35fr_1fr]">
                <PosterCard
                  href="/shop"
                  image={heroPoster}
                  imageFallback={sellPosterSrc}
                  kicker="FOR YOU"
                  title="Find something you actually want"
                  body="Browse the mall, save what you like, and check out when you're ready."
                  cta="Start shopping"
                />
                {isSeller ? (
                  <PosterCard
                    href="/seller"
                    image={storeLogo}
                    imageFallback={sellPosterSrc}
                    kicker="YOUR STORE"
                    title={storeName || "Seller dashboard"}
                    body="Listings, orders, messages, and payouts — all in one place."
                    cta="Open your store"
                  />
                ) : (
                  <PosterCard
                    onClick={handleSellerCta}
                    image={sellPosterSrc}
                    imageFallback={SELL_POSTER_LOCAL}
                    kicker="SECURE A STORE"
                    title="Turn what you sell into a store"
                    body="List products and meet buyers already shopping the mall."
                    cta="Secure a store today"
                  />
                )}
              </section>

              <section className="mb-7">
                <div className="tv-row flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {EXPLORE_CHIPS.map((chip) => (
                    <Link
                      key={chip.id}
                      href={chip.href}
                      className="flex h-12 shrink-0 items-center px-6 text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(0,0,0,0.25)] transition hover:brightness-110"
                      style={{ background: chip.bg }}
                    >
                      {chip.label}
                    </Link>
                  ))}
                  <Link
                    href="/cart"
                    className="flex h-12 shrink-0 items-center gap-2 bg-white/10 px-5 text-[14px] font-semibold text-white/90 transition hover:bg-white/15"
                  >
                    Your bag
                    {bag > 0 && (
                      <span className="bg-[#00E575] px-1.5 text-[10px] font-extrabold text-[#041412]">
                        {bag > 99 ? "99+" : bag}
                      </span>
                    )}
                  </Link>
                </div>
              </section>

              <section className="mb-9">
                <p className="mb-3 text-[14px] font-medium text-white/70">
                  Jump in
                </p>
                <div className="tv-row flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

              <ProductRail
                title="New to Plazore"
                href="/shop?mode=new"
                products={newArrivals}
                formatProduct={formatProduct}
                priceClass="text-[#00E575]"
              />

              <ProductRail
                title="Shoppers are looking at"
                href="/shop?mode=trending"
                products={trendingPicks}
                formatProduct={formatProduct}
                priceClass="text-[#FB7185]"
              />

              <section className="mb-9">
                <div className="mb-3 flex items-end justify-between">
                  <p className="text-[14px] font-medium text-white/70">
                    Shop by category
                  </p>
                  <Link
                    href="/shop?mode=categories"
                    className="text-[12px] font-semibold text-white/40 hover:text-white/70"
                  >
                    See all
                  </Link>
                </div>
                <div className="tv-row flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {CATEGORY_LIST.slice(0, 16).map((c) => (
                    <Link
                      key={c}
                      href={`/shop?mode=category&category=${encodeURIComponent(c)}`}
                      className="group relative h-[88px] w-[160px] shrink-0 overflow-hidden transition hover:brightness-110"
                    >
                      <LoungeImg
                        src={CATEGORY_IMAGES[c] || FALLBACK_CATEGORY_IMAGE}
                        alt={c}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
                      <span className="relative z-[1] flex h-full items-end px-3.5 py-3 text-[13px] font-bold text-white">
                        {c}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>

              {storePicks.length > 0 && (
                <section className="mb-6">
                  <div className="mb-3 flex items-end justify-between">
                    <p className="text-[14px] font-medium text-white/70">
                      Stores to visit
                    </p>
                    <Link
                      href="/shop?mode=stores"
                      className="text-[12px] font-semibold text-white/40 hover:text-white/70"
                    >
                      See all
                    </Link>
                  </div>
                  <div className="tv-row flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {storePicks.map((s) => (
                      <Link
                        key={s.id}
                        href={`/store/${s.id}`}
                        className="group shrink-0"
                      >
                        <div className="relative h-[148px] w-[220px] overflow-hidden bg-[#12141C] transition duration-200 group-hover:brightness-110">
                          <LoungeImg
                            src={s.cover}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2.5 pt-10">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden bg-white/10">
                              {s.logo ? (
                                <LoungeImg
                                  src={s.logo}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Store className="h-3.5 w-3.5 text-white/70" />
                              )}
                            </span>
                            <p className="truncate text-[13px] font-medium text-white">
                              {s.name}
                            </p>
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
                  <Link
                    href="/sign-in"
                    className="text-[12px] font-medium text-[#00E575]"
                  >
                    Sign in
                  </Link>
                )}
              </div>
            </>
          )}
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
  formatProduct,
}: {
  query: string;
  searchLoading: boolean;
  totalHits: number;
  hits: { products: Hit[]; stores: Hit[]; categories: Hit[] };
  formatProduct: (amount: number, productRegion?: string | null) => string;
}) {
  if (searchLoading && totalHits === 0) {
    return (
      <p className="py-16 text-center text-sm text-white/55">
        Searching the mall…
      </p>
    );
  }
  if (totalHits === 0) {
    return (
      <p className="py-16 text-center text-sm text-white/55">
        Nothing matches “{query.trim()}” yet. Try another word.
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
                <Link
                  key={h.id}
                  href={`/product/${h.id}`}
                  className="flex items-center gap-3"
                >
                  <div className="h-16 w-16 overflow-hidden bg-[#11131C]">
                    <LoungeImg
                      src={h.image}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-medium">{h.label}</p>
                    <p className="mt-1 text-sm font-semibold text-[#00E575]">
                      {formatProduct(h.price, h.region)}
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
          <p className="mb-4 text-[10px] font-extrabold tracking-[0.16em] text-white/35">
            STORES
          </p>
          {hits.stores.map((h) =>
            h.type === "store" ? (
              <Link
                key={h.id}
                href={`/store/${h.id}`}
                className="mb-3 flex items-center gap-3"
              >
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden bg-[#11131C]">
                  {h.logo ? (
                    <LoungeImg
                      src={h.logo}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Store className="h-5 w-5 text-[#3B82F6]" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{h.label}</p>
                  <p className="mt-1 text-xs font-semibold text-[#3B82F6]">
                    Visit store
                  </p>
                </div>
              </Link>
            ) : null,
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
                  href={`/shop?mode=category&category=${encodeURIComponent(
                    h.label,
                  )}`}
                  className="border border-white/10 bg-[#0B0C12] px-3 py-2 text-sm font-semibold"
                >
                  {h.label}
                </Link>
              ) : null,
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
            <LoungeImg
              src={imageUrl}
              className="h-full w-full object-cover"
              loading="eager"
            />
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
              ? "You're signed in"
              : "Sign in to save your bag and orders"}
          </p>
        </div>
      </div>
      {isLoaded && isSignedIn ? (
        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 inline-flex items-center gap-2 border border-white/8 px-3 py-1.5 text-xs text-red-400/70"
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