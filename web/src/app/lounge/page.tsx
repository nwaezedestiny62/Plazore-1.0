"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
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

const NAV = [
  { href: "/", label: "Mall" },
  { href: "/browse", label: "Browse" },
  { href: "/shop", label: "Shop" },
  { href: "/lounge", label: "Lounge" },
  { href: "/cart", label: "Bag" },
  { href: "/profile", label: "Profile" },
];

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

/** App-only tiles → show AppFeaturePrompt instead of navigating */
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

export default function LoungePage() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  const [query, setQuery] = useState("");
  const [hubOpen, setHubOpen] = useState(false);
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

  // Seller store branding (matches mobile hub)
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

  const onAppOnly = useCallback((id: string) => {
    if (id === "wishlist") setPrompt("wishlist" as AppFeature);
    else if (id === "saved_stores") setPrompt("saved_stores" as AppFeature);
    else setPrompt(id as AppFeature);
  }, []);

  const handleSellerCta = () => {
    if (isSeller) router.push("/seller");
    else router.push("/seller-register");
  };

  return (
    <div className="min-h-dvh bg-[#050508] text-[#F5F7FA]">
      <style>{`
        @keyframes loungeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tvGlow {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.55; }
        }
      `}</style>

      {/* ── Mobile header (hub-like) ── */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/5 bg-[#050508]/90 px-4 backdrop-blur-md md:hidden">
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

      {/* ── Desktop: smart-TV shell ── */}
      <div className="hidden md:block">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/5 bg-[#050508]/85 px-8 backdrop-blur-xl">
        {hubOpen && (
  <div className="fixed inset-0 z-[70]">
    <button
      type="button"
      className="absolute inset-0 bg-black/55"
      onClick={() => setHubOpen(false)}
      aria-label="Close"
    />
    <div className="relative z-10 flex h-full w-[min(100%,360px)] flex-col border-r border-white/8 bg-[#0B0C12] p-5">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-8 w-8" />
          <span className="text-sm font-bold tracking-[0.18em] uppercase">Plazore</span>
        </div>
        <button
          type="button"
          onClick={() => setHubOpen(false)}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center border border-white/10 text-white/70"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* tiles / links … */}
    </div>
  </div>
)}
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Plazore" className="h-7 w-7 object-contain" />
            <span className="text-sm tracking-[0.2em] uppercase">Plazore</span>
          </Link>
          <nav className="flex items-center gap-8">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-xs tracking-[0.18em] uppercase transition ${
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href))
                    ? "text-white"
                    : "text-white/45 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
      </div>

      {/* TV bezel on large canvas */}
      <div className="mx-auto w-full max-w-[1400px] px-0 pb-20 pt-0 md:px-8 md:pb-16 md:pt-8">
        <div
          className="
            relative overflow-hidden
            md:rounded-[28px] md:border md:border-white/10
            md:bg-gradient-to-b md:from-[#0A0C12] md:to-[#050508]
            md:p-8 md:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_40px_120px_rgba(0,0,0,0.65)]
            lg:p-10
          "
        >
          {/* Ambient edge glow (TV) */}
          <div
            className="pointer-events-none absolute inset-0 hidden md:block"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,229,117,0.08), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(59,130,246,0.06), transparent 50%)",
              animation: "tvGlow 8s ease-in-out infinite",
            }}
          />

          <div className="relative z-[1] px-4 sm:px-6 md:px-0">
            {/* Logo / LOUNGE */}
            <div className="relative mt-5 flex min-h-[72px] items-center justify-center md:mt-0 md:min-h-[96px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-2.png"
                alt="Plazore"
                className="h-[72px] w-[120px] object-contain md:h-24 md:w-[160px]"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <p className="pointer-events-none absolute text-xl font-extrabold tracking-[0.35em] text-white/90 md:text-2xl">
                {/* fallback text if logo-2 missing — usually hidden under logo */}
              </p>
            </div>

            {/* Search */}
            <label
              className="mx-auto mt-4 flex h-12 max-w-2xl items-center gap-3 border bg-[#0B0C12] px-4 md:mt-6 md:h-14"
              style={{
                borderColor: query ? "#00E575" : "rgba(255,255,255,0.08)",
              }}
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
              <div className="mx-auto mt-8 max-w-2xl">
                {searchLoading && totalHits === 0 ? (
                  <p className="py-16 text-center text-sm text-white/55">
                    Searching Plazore…
                  </p>
                ) : totalHits === 0 ? (
                  <p className="py-16 text-center text-sm text-white/55">
                    No results for “{query.trim()}”
                  </p>
                ) : (
                  <>
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
                                  {h.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={h.image}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
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
                            <Link
                              key={h.id}
                              href={`/store/${h.id}`}
                              className="mb-3 flex items-center gap-3"
                            >
                              <div className="flex h-16 w-16 items-center justify-center overflow-hidden bg-[#11131C]">
                                {h.logo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={h.logo}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Store className="h-5 w-5 text-[#3B82F6]" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{h.label}</p>
                                <p className="mt-1 text-xs font-semibold text-[#3B82F6]">
                                  Official storefront
                                </p>
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
                  </>
                )}
              </div>
            ) : (
              <>
                {/* Seller CTA — status-aware like mobile */}
                <button
                  type="button"
                  onClick={handleSellerCta}
                  className="mt-7 w-full overflow-hidden text-left md:mt-9 md:max-w-xl"
                >
                  {isSeller ? (
                    <div
                      className="flex items-center gap-3 px-3.5 py-3.5"
                      style={{ backgroundImage: GRAD }}
                    >
                      <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden bg-black/15">
                        {storeLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={storeLogo}
                            alt=""
                            className="h-full w-full object-cover"
                          />
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

                {/* Tile grid — mobile 2-col hub, desktop TV grid */}
                {LOUNGE_SECTIONS.map((section) => (
                  <section key={section.id} className="mt-9 md:mt-11">
                    <p className="mb-3 text-[10px] font-extrabold tracking-[0.16em] uppercase text-white/35">
                      {section.title}
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
                      {section.items.map((item) => {
                        const idx = tileIndex++;
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

                {/* Footer profile */}
                <div className="mt-10 border border-white/8 bg-[#0B0C12] p-3.5 md:max-w-md">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden border border-[#00E575]/30 bg-[#11131C]">
                      {user?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
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
                          ? "This profile is currently active"
                          : "Sign in to sync your account"}
                      </p>
                    </div>
                  </div>
                  {isLoaded && isSignedIn ? (
  <button
    type="button"
    onClick={() => signOut({ redirectUrl: "/sign-in" })}
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

        {/* TV stand accent (desktop only) */}
        <div className="mx-auto mt-3 hidden h-1.5 w-28 rounded-full bg-white/10 md:block" />
        <div className="mx-auto mt-1 hidden h-8 w-16 rounded-b-md border border-t-0 border-white/8 bg-[#0A0C12] md:block" />
      </div>

      <AppFeaturePrompt feature={prompt} onClose={() => setPrompt(null)} />
    </div>
  );
}