"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  Search,
  ShoppingBag,
  ShoppingCart,
} from "lucide-react";
import { AppFeaturePrompt, type AppFeature } from "@/components/app/AppFeaturePrompt";
import { useAuth, useUser } from "@clerk/nextjs";
import { HERO_SLIDES, type HeroSlide } from "@/lib/heroCampaigns";
import { fetchHeroBanners, prefetchHeroImages } from "@/lib/fetchHeroBanners";
import { cartCount } from "@/lib/cart";
import { useMarketplace } from "@/context/MarketplaceContext";
import { DEFAULT_REGION, formatProductPrice } from "@/lib/regions";
import type { Product } from "@/lib/types";
import { fetchShowroom, type ShowroomRooms } from "@/lib/api";
import {
  getShowroomSessionId,
  saveShowroomSessionId,
} from "@/lib/showroomEvents";
import { ProductCard } from "./ProductCard";
import { ShowroomFlyCartProvider, useShowroomFlyCart } from "./ShowroomFlyCart";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const PENDING_KEY = "plazore_pending_action";

/** Must match server/services/showroomRanker.ts */
const ROOM_CAPACITY = {
  1: 50,
  2: 14,
  3: 16,
  4: 30,
} as const;

const RAIL_CAP = 25;

type RoomTitlePair = readonly [string, string];

type RoomTitles = {
  one: RoomTitlePair;
  two: RoomTitlePair;
  three: RoomTitlePair;
  four: RoomTitlePair;
};

const ROOM_TITLES: RoomTitles = {
  one: ["THE HORIZON", "Expanded View"],
  two: ["THE CHAMBER", "Private Selection"],
  three: ["THE SIGNAL", "Worth Your Attention"],
  four: ["THE LOCALE", "From Your Region"],
};

type SplitRooms = {
  one: Product[];
  two: Product[];
  three: Product[];
  four: Product[];
  titles: RoomTitles;
};

function heroHeadlineSize(text: string): string {
  const n = (text || "").trim().length;
  if (n > 52) return "clamp(1.25rem, 2.8vw, 2.15rem)";
  if (n > 40) return "clamp(1.4rem, 3.2vw, 2.55rem)";
  if (n > 28) return "clamp(1.55rem, 3.8vw, 3.1rem)";
  if (n > 18) return "clamp(1.7rem, 4.2vw, 3.65rem)";
  return "clamp(1.85rem, 4.6vw, 4.25rem)";
}

function heroSubSize(text: string): string {
  const n = (text || "").trim().length;
  if (n > 90) return "text-[13px] sm:text-[14px]";
  if (n > 60) return "text-[13px] sm:text-[15px]";
  return "text-[14px] sm:text-[16px]";
}

function takeUnique(
  list: Product[] | undefined,
  cap: number,
  seen?: Set<string>
): Product[] {
  const used = seen ?? new Set<string>();
  const out: Product[] = [];
  for (const p of list || []) {
    if (out.length >= cap) break;
    const id = String(p?._id || "");
    if (!id || used.has(id)) continue;
    used.add(id);
    out.push(p);
  }
  return out;
}

function buildRooms(
  products: Product[],
  serverRooms?: ShowroomRooms | null
): SplitRooms {
  const hasServerRooms =
    !!serverRooms &&
    ((serverRooms[1]?.length || 0) > 0 ||
      (serverRooms[2]?.length || 0) > 0 ||
      (serverRooms[3]?.length || 0) > 0 ||
      (serverRooms[4]?.length || 0) > 0);

  if (hasServerRooms && serverRooms) {
    const seen12 = new Set<string>();
    const one = takeUnique(serverRooms[1], ROOM_CAPACITY[1], seen12);
    const two = takeUnique(serverRooms[2], ROOM_CAPACITY[2], seen12);
    const three = takeUnique(serverRooms[3], ROOM_CAPACITY[3]);
    const four = takeUnique(serverRooms[4], ROOM_CAPACITY[4]);
    return { one, two, three, four, titles: ROOM_TITLES };
  }

  const seen = new Set<string>();
  return {
    one: takeUnique(products, ROOM_CAPACITY[1], seen),
    two: takeUnique(products, ROOM_CAPACITY[2], seen),
    three: takeUnique(products, ROOM_CAPACITY[3], seen),
    four: takeUnique(products, ROOM_CAPACITY[4], seen),
    titles: ROOM_TITLES,
  };
}

function CustomBarIcon({ className = "" }: { className?: string }) {
  return (
    <span
      className={`flex w-[22px] flex-col items-start gap-[5.5px] ${className}`}
    >
      <span className="block h-[2.6px] w-[22px] bg-current" />
      <span className="block h-[2.6px] w-[15px] bg-current" />
      <span className="block h-[2.6px] w-[22px] bg-current" />
    </span>
  );
}

function MallChrome({
  progress,
  bagN,
  notifN,
}: {
  progress: number;
  bagN: number;
  notifN: number;
}) {
  const fly = useShowroomFlyCart();
  const bagRefDesktop = useRef<HTMLAnchorElement>(null);
  const bagRefMobile = useRef<HTMLAnchorElement>(null);
  const atTop = progress < 0.06;
  const solid = progress >= 0.06;
  const [prompt, setPrompt] = useState<AppFeature | null>(null);
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  const avatarUrl = user?.imageUrl || null;
  const avatarAlt =
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    "Account";

  useEffect(() => {
    const el = bagRefDesktop.current || bagRefMobile.current;
    if (el && fly) fly.registerBagTarget(el);
  }, [fly, bagN, progress]);

  useEffect(() => {
    if (!fly?.bagPulse) return;
    const el = bagRefDesktop.current || bagRefMobile.current;
    if (!el) return;
    el.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.22)" },
        { transform: "scale(1)" },
      ],
      { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    );
  }, [fly?.bagPulse]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 hidden h-16 items-center justify-between px-6 transition-all duration-500 md:flex lg:px-10 ${
          solid ? "bg-[#090B0F]/80 backdrop-blur-xl" : "bg-transparent"
        }`}
        style={{
          borderBottom: solid
            ? "1px solid rgba(255,255,255,0.06)"
            : "1px solid transparent",
        }}
      >
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Plazore" className="h-8 w-8 object-contain" />
          <span
            className={`text-[13px] font-semibold tracking-[0.22em] uppercase ${
              atTop ? "text-white/90" : "text-text"
            }`}
          >
            Plazore
          </span>
        </Link>

        <nav className="flex items-center gap-6 lg:gap-8">
          <Link
            href="/"
            className="text-[11px] font-semibold tracking-[0.2em] uppercase text-text"
          >
            Mall
          </Link>
          <Link
            href="/browse"
            className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/55 transition hover:text-text"
          >
            Browse
          </Link>

          <Link
            href="/lounge"
            className="group relative inline-flex items-center gap-2.5 overflow-hidden border border-white/15 px-4 py-2 text-[11px] font-extrabold tracking-[0.22em] uppercase text-white transition duration-200 hover:brightness-110 active:translate-y-[1px]"
            style={{
              background:
                "linear-gradient(135deg, #00E575 0%, #0ECF7A 38%, #2B6DE8 72%, #3B82F6 100%)",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.35) inset, 0 -2px 0 rgba(0,0,0,0.28) inset, 0 6px 18px rgba(59,130,246,0.28), 0 2px 0 rgba(0,0,0,0.35)",
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/25 to-transparent"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-[#00E575]"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-0 top-0 h-full w-[3px] bg-[#3B82F6]"
            />
            <span className="relative">Lounge</span>
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping bg-white/80 opacity-45" />
              <span className="relative inline-flex h-1.5 w-1.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setPrompt("wishlist")}
            className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/55 transition hover:text-text"
          >
            Wishlist
          </button>
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/notifications"
            className="relative flex h-10 w-10 items-center justify-center text-white/80 transition hover:text-text"
            aria-label={
              notifN > 0
                ? `Notifications, ${notifN} unread`
                : "Notifications"
            }
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
            {notifN > 0 ? (
              <span className="absolute right-1 top-1.5 flex min-w-[16px] items-center justify-center rounded-full bg-[#00E575] px-1 text-center text-[9px] font-extrabold leading-none text-[#041412]">
                {notifN > 99 ? "99+" : notifN}
              </span>
            ) : null}
          </Link>

          <Link
            ref={bagRefDesktop}
            href="/cart"
            className="relative flex h-10 w-10 items-center justify-center text-white/80 transition hover:text-text"
            aria-label="Cart"
            data-plazore-cart-icon
          >
            <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.75} />
            {bagN > 0 ? (
              <span className="absolute right-1.5 top-1.5 min-w-[16px] rounded-full bg-[#00E575] px-1 text-center text-[9px] font-extrabold text-[#041412]">
                {bagN > 9 ? "9+" : bagN}
              </span>
            ) : null}
          </Link>

          {isSignedIn && avatarUrl ? (
            <div
              className="ml-1.5 h-8 w-8 overflow-hidden rounded-full ring-1 ring-white/15"
              aria-hidden
              title={avatarAlt}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
          ) : isSignedIn ? (
            <div
              className="ml-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white/70 ring-1 ring-white/15"
              aria-hidden
            >
              {(avatarAlt || "U").charAt(0).toUpperCase()}
            </div>
          ) : null}
        </div>
      </header>

      <header
        className={`fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between px-3.5 transition-all duration-400 md:hidden ${
          solid ? "bg-[#090B0F]/88 backdrop-blur-xl" : "bg-transparent"
        }`}
      >
        <Link
          href="/lounge"
          className="flex h-10 w-10 items-center justify-center text-white/90"
          aria-label="Open Lounge"
        >
          <CustomBarIcon />
        </Link>

        <Link
          href="/"
          className="absolute left-1/2 flex -translate-x-1/2 items-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Plazore" className="h-7 w-7 object-contain" />
        </Link>

        <div className="flex items-center gap-0.5">
          <Link
            href="/browse"
            className="flex h-10 w-10 items-center justify-center text-white/90"
            aria-label="Search"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </Link>
          <Link
            href="/notifications"
            className="relative flex h-10 w-10 items-center justify-center text-white/90"
            aria-label={
              notifN > 0
                ? `Notifications, ${notifN} unread`
                : "Notifications"
            }
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
            {notifN > 0 ? (
              <span className="absolute right-1 top-1.5 flex min-w-[15px] items-center justify-center rounded-full bg-[#00E575] px-0.5 text-center text-[8.5px] font-extrabold leading-none text-[#041412]">
                {notifN > 99 ? "99+" : notifN}
              </span>
            ) : null}
          </Link>
          <Link
            ref={bagRefMobile}
            href="/cart"
            className="relative flex h-10 w-10 items-center justify-center text-white/90"
            aria-label="Cart"
            data-plazore-cart-icon
          >
            <ShoppingCart className="h-[18px] w-[18px]" strokeWidth={1.75} />
            {bagN > 0 ? (
              <span className="absolute right-1 top-1.5 min-w-[15px] rounded-full bg-[#00E575] px-0.5 text-center text-[8.5px] font-extrabold text-[#041412]">
                {bagN > 9 ? "9+" : bagN}
              </span>
            ) : null}
          </Link>

          {isSignedIn && avatarUrl ? (
            <div
              className="ml-0.5 h-7 w-7 overflow-hidden rounded-full ring-1 ring-white/15"
              aria-hidden
              title={avatarAlt}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
          ) : isSignedIn ? (
            <div
              className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/70 ring-1 ring-white/15"
              aria-hidden
            >
              {(avatarAlt || "U").charAt(0).toUpperCase()}
            </div>
          ) : null}
        </div>
      </header>

      <AppFeaturePrompt feature={prompt} onClose={() => setPrompt(null)} />
    </>
  );
}

function RoomThreeStage({ products }: { products: Product[] }) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const fly = useShowroomFlyCart();
  const marketplace = useMarketplace() as { region?: string } | null;
  const displayRegion = marketplace?.region || DEFAULT_REGION;

  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  const busy = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const scheduleHold = useCallback(() => {
    clearHold();
    if (products.length < 2) return;
    holdTimer.current = setTimeout(() => {
      goTo(currentRef.current + 1);
    }, 5200);
  }, [products.length, clearHold]);

  const goTo = useCallback(
    (raw: number) => {
      if (busy.current || products.length < 2) return;
      const from = currentRef.current;
      const target =
        ((raw % products.length) + products.length) % products.length;
      if (target === from) return;
      busy.current = true;
      clearHold();
      setCurrent(target);
      window.setTimeout(() => {
        busy.current = false;
        currentRef.current = target;
        scheduleHold();
      }, 1800);
    },
    [products.length, clearHold, scheduleHold]
  );

  useEffect(() => {
    if (products.length < 2) return;
    scheduleHold();
    return () => clearHold();
  }, [products.length, scheduleHold, clearHold]);

  const handleAddToCart = () => {
    const product = products[currentRef.current];
    if (!product) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      try {
        sessionStorage.setItem(
          PENDING_KEY,
          JSON.stringify({
            type: "add_to_cart",
            productId: product._id,
            at: Date.now(),
          })
        );
        sessionStorage.setItem("plazore_return_to", window.location.pathname);
      } catch {
        /* ignore */
      }
      router.push(
        `/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`
      );
      return;
    }
    const el = cartBtnRef.current;
    if (el && fly) {
      const r = el.getBoundingClientRect();
      fly.flyAdd(product, {
        x: r.left,
        y: r.top,
        width: r.width,
        height: r.height,
      });
    } else if (fly) {
      fly.flyAdd(product, { x: 0, y: 0, width: 34, height: 34 });
    }
  };

  if (!products.length) return null;
  const active = products[current] || products[0];

  return (
    <div className="w-full">
      <div className="relative mx-auto w-full max-w-[560px] lg:max-w-[640px]">
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#111] sm:aspect-[5/6]">
          {products.map((p, i) => (
            <div
              key={p._id}
              className="absolute inset-0 transition-opacity duration-[1800ms] ease-in-out"
              style={{
                opacity: i === current ? 1 : 0,
                pointerEvents: i === current ? "auto" : "none",
              }}
            >
              <Link href={`/product/${p._id}`} className="block h-full w-full">
                {p.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.images[0]}
                    alt={p.name}
                    className="h-full w-full object-cover will-change-transform"
                    style={{
                      transform: i === current ? "scale(1.04)" : "scale(1)",
                      transition:
                        i === current ? "transform 5.2s linear" : "transform 0s",
                    }}
                  />
                ) : (
                  <div className="h-full w-full bg-surface-2" />
                )}
              </Link>
            </div>
          ))}

          <button
            ref={cartBtnRef}
            type="button"
            onClick={handleAddToCart}
            aria-label="Add to cart"
            className="absolute bottom-3 right-3 z-20 flex h-[34px] w-[34px] items-center justify-center bg-white text-[#111] shadow-[0_1px_6px_rgba(0,0,0,0.18)] transition hover:scale-105 active:scale-95"
          >
            <ShoppingCart className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="mt-5 px-0">
          <Link href={`/product/${active._id}`}>
            <p className="text-[17px] font-medium leading-snug text-white">
              {active.name}
            </p>
            <p className="mt-1.5 text-[13px] text-white/55">
              <span>{(active.brand || "plazore").toLowerCase()}</span>
              <span className="text-white/35"> | </span>
              <span className="font-medium text-white">
                {formatProductPrice(
                  Number(active.price),
                  active.region,
                  displayRegion
                )}
              </span>
            </p>
          </Link>
        </div>

        {products.length > 1 ? (
          <div className="mt-7 flex justify-center gap-2">
            {products.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === current ? "w-[18px] bg-white/85" : "w-1.5 bg-white/22"
                }`}
                aria-label={`Product ${i + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MallInner({
  products: initialProducts,
  rooms: initialRooms,
  loading: initialLoading,
}: {
  products: Product[];
  rooms?: ShowroomRooms | null;
  loading: boolean;
}) {
  const { getToken, isSignedIn } = useAuth();
  const marketplace = useMarketplace() as { region?: string } | null;
  const region = marketplace?.region || DEFAULT_REGION;

  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [serverRooms, setServerRooms] = useState<ShowroomRooms | null>(
    initialRooms || null
  );
  const [loading, setLoading] = useState(initialLoading);

  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(HERO_SLIDES);
  const [slide, setSlide] = useState(0);

  const [progress, setProgress] = useState(0);
  const [activeRoom, setActiveRoom] = useState(1);
  const [bagN, setBagN] = useState(0);
  const [notifN, setNotifN] = useState(0);
  const showroomRef = useRef<HTMLElement>(null);
  const roomRefs = useRef<Record<number, HTMLElement | null>>({});
  const fetchedRef = useRef(false);
  const heroFetchedRef = useRef(false);

  useEffect(() => {
    if (heroFetchedRef.current) return;
    heroFetchedRef.current = true;

    (async () => {
      try {
        let token: string | null = null;
        try {
          if (isSignedIn) token = (await getToken()) || null;
        } catch {
          token = null;
        }
        const slides = await fetchHeroBanners({
          region,
          token,
          forceRefresh: false,
        });
        if (slides?.length) {
          setHeroSlides(slides);
          setSlide(0);
          prefetchHeroImages(slides);
        }
      } catch {
        /* keep HERO_SLIDES */
      }
    })();
  }, [region, isSignedIn, getToken]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const sessionId = getShowroomSessionId();
        const result = await fetchShowroom({ region, sessionId });
        if (result.sessionId) saveShowroomSessionId(result.sessionId);
        if (result.products?.length) setProducts(result.products);
        if (result.rooms) setServerRooms(result.rooms);
      } catch {
        /* keep SSR data */
      } finally {
        setLoading(false);
      }
    })();
  }, [region]);

  const rooms = useMemo(
    () => buildRooms(products, serverRooms),
    [products, serverRooms]
  );

  const railA = useMemo(() => rooms.one.slice(0, RAIL_CAP), [rooms.one]);
  const railB = useMemo(
    () => rooms.one.slice(RAIL_CAP, ROOM_CAPACITY[1]),
    [rooms.one]
  );

  const showroomHasItems =
    rooms.one.length +
      rooms.two.length +
      rooms.three.length +
      rooms.four.length >
    0;

  const roomCount = useMemo(() => {
    let n = 0;
    if (rooms.one.length) n++;
    if (rooms.two.length) n++;
    if (rooms.three.length) n++;
    if (rooms.four.length) n++;
    return Math.max(n, 1);
  }, [rooms]);

  useEffect(() => {
    const sync = () => setBagN(cartCount());
    sync();
    window.addEventListener("plazore-cart", sync);
    window.addEventListener("plazore-cart-change", sync);
    return () => {
      window.removeEventListener("plazore-cart", sync);
      window.removeEventListener("plazore-cart-change", sync);
    };
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      setNotifN(0);
      return;
    }

    let cancelled = false;

    const parseCount = (json: any): number => {
      const direct = Number(
        json?.data?.count ??
          json?.data?.unreadCount ??
          json?.data?.unread ??
          json?.unreadCount ??
          json?.count ??
          json?.data?.totalUnread ??
          NaN
      );
      if (Number.isFinite(direct) && direct >= 0) return Math.floor(direct);

      const list = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.data?.notifications)
          ? json.data.notifications
          : Array.isArray(json?.notifications)
            ? json.notifications
            : Array.isArray(json?.data?.items)
              ? json.data.items
              : [];

      if (!list.length) return 0;
      return list.filter(
        (n: any) =>
          n &&
          (n.read === false ||
            n.isRead === false ||
            n.unread === true ||
            (!n.readAt && n.read !== true && n.isRead !== true))
      ).length;
    };

    const loadUnread = async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        };

        try {
          const res = await fetch(`${API}/notifications/unread-count`, {
            headers,
            cache: "no-store",
          });
          if (res.ok) {
            const json = await res.json();
            if (!cancelled) setNotifN(parseCount(json));
            return;
          }
        } catch {
          /* fall through */
        }

        try {
          const res2 = await fetch(`${API}/notifications?limit=50`, {
            headers,
            cache: "no-store",
          });
          if (res2.ok) {
            const json2 = await res2.json();
            if (!cancelled) setNotifN(parseCount(json2));
            return;
          }
        } catch {
          /* silent */
        }
      } catch {
        /* silent */
      }
    };

    void loadUnread();

    const onFocus = () => void loadUnread();
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadUnread();
    };
    const onNotif = () => void loadUnread();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("plazore-notifications", onNotif);
    const interval = window.setInterval(() => void loadUnread(), 30000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("plazore-notifications", onNotif);
      window.clearInterval(interval);
    };
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (heroSlides.length < 2) return;
    const id = setInterval(() => {
      setSlide((s) => (s + 1) % heroSlides.length);
    }, 12000);
    return () => clearInterval(id);
  }, [heroSlides.length]);

  useEffect(() => {
    const onScroll = () => {
      const heroH = window.innerHeight;
      const y = window.scrollY;
      setProgress(Math.min(1, Math.max(0, y / (heroH * 0.75))));
      const probe = y + window.innerHeight * 0.3;
      let current = 1;
      for (const n of [1, 2, 3, 4]) {
        const el = roomRefs.current[n];
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY;
          if (top <= probe) current = n;
        }
      }
      setActiveRoom(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const enterShowroom = () => {
    showroomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const goRoom = (n: number) => {
    roomRefs.current[n]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const current =
    heroSlides[slide % Math.max(heroSlides.length, 1)] || HERO_SLIDES[0];
  const roomNavOn = progress > 0.42;
  const headlineFs = heroHeadlineSize(current?.headline || "");
  const subClass = heroSubSize(current?.subheadline || "");

  return (
    <div className="min-h-dvh bg-bg text-text">
      <MallChrome progress={progress} bagN={bagN} notifN={notifN} />

      <section className="relative h-dvh min-h-[560px] overflow-hidden bg-[#090B0F]">
        {heroSlides.map((s, i) => {
          const active = i === slide;
          return (
            <div
              key={s.id}
              className="absolute inset-0"
              style={{
                opacity: active ? 1 : 0,
                transition: "opacity 2800ms cubic-bezier(0.4, 0, 0.2, 1)",
                pointerEvents: active ? "auto" : "none",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.image}
                alt=""
                className="h-full w-full origin-center object-cover will-change-transform"
                style={{
                  transform: active ? "scale(1.06)" : "scale(1)",
                  transition: active
                    ? "transform 12s linear"
                    : "transform 0ms linear",
                }}
              />
            </div>
          );
        })}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#090B0F] via-[#090B0F]/55 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#090B0F]/55 via-[#090B0F]/15 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/40 to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-end px-5 pb-28 pt-24 sm:px-8 md:px-16 md:pb-32 lg:px-24">
          <div className="max-w-[min(100%,26rem)] md:max-w-[min(100%,32rem)]">
            <p className="text-[10px] font-semibold tracking-[0.36em] text-[#00E575]/90 sm:text-[11px]">
              {current.kicker}
            </p>
            <h1
              className="mt-3 font-display font-medium leading-[1.12] tracking-tight text-white"
              style={{ fontSize: headlineFs }}
            >
              <span className="line-clamp-3">{current.headline}</span>
            </h1>
            <p
              className={`mt-3 max-w-lg leading-relaxed text-white/65 line-clamp-3 ${subClass}`}
            >
              {current.subheadline}
            </p>
            <button
              type="button"
              onClick={enterShowroom}
              className="mt-7 w-fit border border-white/35 px-6 py-2.5 text-[11px] font-semibold tracking-[0.2em] uppercase text-white transition duration-300 hover:border-white hover:bg-white/5"
            >
              {current.ctaLabel}
            </button>
          </div>

          {heroSlides.length > 1 ? (
            <div className="mt-8 flex items-center gap-1.5">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => setSlide(i)}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    i === slide
                      ? "w-5 bg-white/90"
                      : "w-1.5 bg-white/25 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={enterShowroom}
          className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 text-white/50 transition hover:text-white/90"
          aria-label="Enter showroom"
        >
          <span className="text-[9px] font-semibold tracking-[0.28em] uppercase">
            Showroom
          </span>
          <ChevronDown className="h-5 w-5 animate-bounce" strokeWidth={1.5} />
        </button>
      </section>

      <div
        className={`fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-2.5 md:flex ${
          roomNavOn ? "opacity-100" : "pointer-events-none opacity-0"
        } transition-opacity duration-400`}
      >
        {Array.from({ length: roomCount }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => goRoom(n)}
            className={`h-2 rounded-full transition-all ${
              activeRoom === n
                ? "w-7 bg-[#00E575]"
                : "w-2 bg-white/30 hover:bg-white/50"
            }`}
            aria-label={`Room ${n}`}
          />
        ))}
      </div>

      <div
        className={`fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 md:hidden ${
          roomNavOn ? "opacity-100" : "pointer-events-none opacity-0"
        } transition-opacity duration-400`}
      >
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#11141A]/90 px-2 py-1.5 backdrop-blur-xl">
          {Array.from({ length: roomCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => goRoom(n)}
              className={`min-w-[36px] rounded-full px-2.5 py-1.5 text-[10px] font-bold tracking-wide ${
                activeRoom === n ? "bg-white text-[#090B0F]" : "text-white/50"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <section ref={showroomRef}>
        {loading ? (
          <div className="flex h-[50vh] items-center justify-center text-muted">
            Loading the mall…
          </div>
        ) : !showroomHasItems ? (
          <div className="flex h-[40vh] items-center justify-center text-secondary">
            The showroom is quiet right now.
          </div>
        ) : (
          <>
            {rooms.one.length > 0 ? (
              <section
                ref={(el) => {
                  roomRefs.current[1] = el;
                }}
                className="bg-[#0C0F14] pb-16"
              >
                <div className="relative h-[38vh] min-h-[240px] max-h-[420px] overflow-hidden sm:h-[42vh]">
                  {rooms.one[0]?.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={rooms.one[0].images[0]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-[rgba(6,8,12,0.58)]" />
                  <div className="absolute bottom-8 left-5 right-5 sm:left-8 md:left-16">
                    <p className="text-[11px] font-semibold tracking-[0.28em] text-white/50">
                      {rooms.titles.one[0]}
                    </p>
                    <p className="mt-2 font-display text-[1.75rem] font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
                      {rooms.titles.one[1]}
                    </p>
                  </div>
                </div>

                {railA.length > 0 ? (
                  <div className="pt-8">
                    <p className="mb-4 px-5 text-[11px] font-semibold tracking-[0.22em] text-white/38 sm:px-8">
                      NOW SHOWING
                    </p>
                    <div className="flex gap-2 overflow-x-auto px-5 pb-2 sm:gap-3 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {railA.map((p) => (
                        <ProductCard
                          key={`r1a-${p._id}`}
                          product={p}
                          compact
                          room={1}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {railB.length > 0 ? (
                  <div className="pt-7">
                    <div className="flex gap-2 overflow-x-auto px-5 pb-2 sm:gap-3 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {railB.map((p) => (
                        <ProductCard
                          key={`r1b-${p._id}`}
                          product={p}
                          compact
                          room={1}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {rooms.two.length > 0 ? (
              <section
                ref={(el) => {
                  roomRefs.current[2] = el;
                }}
                className="bg-chamber px-4 py-14 text-chamber-ink sm:px-8 md:px-16 md:py-20"
              >
                <p className="text-[11px] font-semibold tracking-[0.28em] text-[#8C7B6B]">
                  {rooms.titles.two[0]}
                </p>
                <p className="mt-2 font-display text-[1.75rem] font-bold tracking-tight sm:text-4xl">
                  {rooms.titles.two[1]}
                </p>
                <div className="mt-4 h-[1.5px] w-12 bg-chamber-ink/20" />

                <div className="mx-auto mt-10 grid max-w-[720px] grid-cols-2 gap-3 sm:gap-5 md:gap-6 lg:max-w-[800px]">
                  {rooms.two.slice(0, 2).map((p) => (
                    <div
                      key={p._id}
                      className="mx-auto w-full max-w-[340px] min-w-0 [&_.group]:!max-w-none [&_.group]:!w-full [&_.group]:!min-w-0"
                    >
                      <ProductCard product={p} tone="light" room={2} />
                    </div>
                  ))}
                </div>

                {rooms.two.length > 2 ? (
                  <div className="mx-auto mt-8 grid max-w-[720px] grid-cols-2 gap-3 sm:gap-5 lg:max-w-[800px]">
                    {rooms.two.slice(2, ROOM_CAPACITY[2]).map((p) => (
                      <div
                        key={p._id}
                        className="mx-auto w-full max-w-[340px] min-w-0 [&_.group]:!max-w-none [&_.group]:!w-full [&_.group]:!min-w-0"
                      >
                        <ProductCard product={p} tone="light" room={2} />
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {rooms.three.length > 0 ? (
              <section
                ref={(el) => {
                  roomRefs.current[3] = el;
                }}
                className="bg-[#07080C] px-5 py-14 sm:px-8 md:px-16 md:py-20"
              >
                <p className="text-[11px] font-semibold tracking-[0.28em] text-white/40">
                  {rooms.titles.three[0]}
                </p>
                <p className="mt-2 font-display text-[1.75rem] font-bold text-white sm:text-4xl md:text-5xl">
                  {rooms.titles.three[1]}
                </p>
                <div className="mt-10">
                  <RoomThreeStage products={rooms.three} />
                </div>
              </section>
            ) : null}

            {rooms.four.length > 0 ? (
              <section
                ref={(el) => {
                  roomRefs.current[4] = el;
                }}
                className="bg-[#F7F1E9] px-0 py-14 md:py-20"
              >
                <div className="px-5 sm:px-8 md:px-16">
                  <p className="text-[11px] font-semibold tracking-[0.28em] text-[#9C8B7A]">
                    {rooms.titles.four[0]}
                  </p>
                  <p className="mt-2 font-display text-[1.75rem] font-bold tracking-tight text-[#2C241B] sm:text-4xl">
                    {rooms.titles.four[1]}
                  </p>
                  <p className="mt-2 text-sm text-[#8C7B6B]">
                    A closer look at what&apos;s moving around you.
                  </p>
                </div>
                <div className="mt-10 flex gap-1 overflow-x-auto px-5 pb-4 sm:px-8 md:px-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {rooms.four.map((p) => (
                    <ProductCard
                      key={`r4-${p._id}`}
                      product={p}
                      compact
                      tone="light"
                      room={4}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </section>

      <p className="pb-10 pt-6 text-center text-[11px] tracking-wide text-muted">
        Plazore · Digital Mall
      </p>
    </div>
  );
}

export function Mall({
  products,
  rooms = null,
  loading,
}: {
  products: Product[];
  rooms?: ShowroomRooms | null;
  loading: boolean;
}) {
  return (
    <ShowroomFlyCartProvider>
      <MallInner products={products} rooms={rooms} loading={loading} />
    </ShowroomFlyCartProvider>
  );
}