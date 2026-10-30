"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HeroStage } from "@/components/mall/HeroStage";
import { Bell, Search, ShoppingCart } from "lucide-react";
import {
  AppFeaturePrompt,
  type AppFeature,
} from "@/components/app/AppFeaturePrompt";
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
import {
  ShowroomFlyCartProvider,
  useShowroomFlyCart,
} from "./ShowroomFlyCart";

const API =
  process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com/api";
const PENDING_KEY = "plazore_pending_action";

/** Global hard lock: same product cannot be added twice within this window */
const ADD_COOLDOWN_MS = 900;
const recentAdds = new Map<string, number>();

function canAddOnce(productId: string): boolean {
  const now = Date.now();
  const last = recentAdds.get(productId) || 0;
  if (now - last < ADD_COOLDOWN_MS) return false;
  recentAdds.set(productId, now);
  if (recentAdds.size > 40) {
    for (const [k, t] of recentAdds) {
      if (now - t > ADD_COOLDOWN_MS * 2) recentAdds.delete(k);
    }
  }
  return true;
}

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
  two: ["THE CHAMBER", "Natural Selection"],
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

const RAIL_CLASS =
  "flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:gap-3 sm:px-6 md:px-10 lg:px-16 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden";

function takeUnique(
  list: Product[] | undefined,
  cap: number,
  seen?: Set<string>,
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
  serverRooms?: ShowroomRooms | null,
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

function isBagVisible(el: HTMLElement | null): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    r.width > 0 &&
    r.height > 0
  );
}

function smoothScrollToEl(el: HTMLElement | null) {
  if (!el || typeof window === "undefined") return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
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

function productHasVariants(product: Product): boolean {
  const p = product as Product & {
    hasVariants?: boolean;
    variants?: unknown[];
    options?: unknown[];
  };
  if (p.hasVariants === true) return true;
  return (
    (Array.isArray(p.variants) && p.variants.length > 0) ||
    (Array.isArray(p.options) && p.options.length > 0)
  );
}

function stashPendingAdd(productId: string) {
  try {
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        type: "add_to_cart",
        productId,
        at: Date.now(),
      }),
    );
    sessionStorage.setItem(
      "plazore_return_to",
      typeof window !== "undefined" ? window.location.pathname : "/",
    );
  } catch {
    /* ignore */
  }
}

/* ─────────────────────────────────────────────────────────────
   Soft twinkling stars for Room 4 — CSS only, zero lag
───────────────────────────────────────────────────────────── */
function Starfield() {
  const stars = useMemo(() => {
    const out: {
      left: string;
      top: string;
      size: number;
      delay: number;
      dur: number;
    }[] = [];
    for (let i = 0; i < 56; i++) {
      const seed = (i * 97) % 1000;
      out.push({
        left: `${(seed * 0.137) % 100}%`,
        top: `${(seed * 0.271) % 100}%`,
        size: 1 + (seed % 3) * 0.55,
        delay: (seed % 40) / 10,
        dur: 2.6 + (seed % 28) / 10,
      });
    }
    return out;
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute bg-white"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            opacity: 0.3,
            animation: `plazore-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes plazore-twinkle {
          0%,
          100% {
            opacity: 0.12;
            transform: scale(0.85);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.12);
          }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Mall Chrome (header)
───────────────────────────────────────────────────────────── */
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
    if (!fly) return;

    const registerVisible = () => {
      const desktop = bagRefDesktop.current;
      const mobile = bagRefMobile.current;

      if (window.innerWidth < 768 && isBagVisible(mobile)) {
        fly.registerBagTarget(mobile);
        return;
      }
      if (isBagVisible(desktop)) {
        fly.registerBagTarget(desktop);
        return;
      }
      if (isBagVisible(mobile)) {
        fly.registerBagTarget(mobile);
      }
    };

    registerVisible();
    window.addEventListener("resize", registerVisible);
    window.addEventListener("orientationchange", registerVisible);
    return () => {
      window.removeEventListener("resize", registerVisible);
      window.removeEventListener("orientationchange", registerVisible);
    };
  }, [fly, bagN, progress]);

  useEffect(() => {
    if (!fly?.bagPulse) return;
    const desktop = bagRefDesktop.current;
    const mobile = bagRefMobile.current;
    const el =
      (isBagVisible(mobile) && window.innerWidth < 768
        ? mobile
        : isBagVisible(desktop)
          ? desktop
          : isBagVisible(mobile)
            ? mobile
            : null) || null;
    if (!el) return;
    el.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.22)" },
        { transform: "scale(1)" },
      ],
      { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [fly?.bagPulse]);

  return (
    <>
      {/* Desktop header */}
      <header
        className={`fixed inset-x-0 top-0 z-50 hidden h-14 items-center justify-between px-5 transition-colors duration-300 md:flex lg:h-16 lg:px-10 ${
          solid ? "bg-[#090B0F]/85 backdrop-blur-xl" : "bg-transparent"
        }`}
        style={{
          borderBottom: solid
            ? "1px solid rgba(255,255,255,0.06)"
            : "1px solid transparent",
        }}
      >
        <Link href="/" className="flex shrink-0 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-4.png"
            alt="Plazore"
            className="h-8 w-auto object-contain lg:h-9"
            draggable={false}
          />
        </Link>

        <nav className="flex items-center gap-4 lg:gap-8">
          <Link
            href="/"
            className="text-[10px] font-semibold tracking-[0.2em] uppercase text-text lg:text-[11px]"
          >
            Mall
          </Link>
          <Link
            href="/browse"
            className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/55 transition hover:text-text lg:text-[11px]"
          >
            Browse
          </Link>

          <Link
            href="/lounge"
            className="group relative inline-flex items-center gap-2 overflow-hidden border border-white/15 px-3 py-1.5 text-[10px] font-extrabold tracking-[0.22em] uppercase text-white transition duration-200 hover:brightness-110 active:translate-y-[1px] lg:gap-2.5 lg:px-4 lg:py-2 lg:text-[11px]"
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
            className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/55 transition hover:text-text lg:text-[11px]"
          >
            Wishlist
          </button>
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/notifications"
            className="relative flex h-9 w-9 items-center justify-center text-white/80 transition hover:text-text lg:h-10 lg:w-10"
            aria-label={
              notifN > 0 ? `Notifications, ${notifN} unread` : "Notifications"
            }
          >
            <Bell
              className="h-[17px] w-[17px] lg:h-[18px] lg:w-[18px]"
              strokeWidth={1.75}
            />
            {notifN > 0 ? (
              <span className="absolute right-0.5 top-1 flex min-w-[15px] items-center justify-center rounded-full bg-[#00E575] px-1 text-center text-[9px] font-extrabold leading-none text-[#041412]">
                {notifN > 99 ? "99+" : notifN}
              </span>
            ) : null}
          </Link>

          <Link
            ref={bagRefDesktop}
            href="/cart"
            className="relative flex h-9 w-9 items-center justify-center text-white/80 transition hover:text-text lg:h-10 lg:w-10"
            aria-label="Shopping cart"
            data-plazore-cart-icon
          >
            <ShoppingCart
              className="h-[17px] w-[17px] lg:h-[18px] lg:w-[18px]"
              strokeWidth={1.75}
            />
            {bagN > 0 ? (
              <span className="absolute right-1 top-1 min-w-[15px] rounded-full bg-[#00E575] px-1 text-center text-[9px] font-extrabold text-[#041412]">
                {bagN > 9 ? "9+" : bagN}
              </span>
            ) : null}
          </Link>

          {isSignedIn ? (
            <Link
              href="/profile"
              className="ml-1 flex h-7 w-7 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/15 transition hover:ring-white/35 lg:h-8 lg:w-8"
              aria-label="Profile"
              title={avatarAlt}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-white/10 text-[11px] font-bold text-white/70">
                  {(avatarAlt || "U").charAt(0).toUpperCase()}
                </span>
              )}
            </Link>
          ) : null}
        </div>
      </header>

      {/* Mobile header */}
      <header
        className={`fixed inset-x-0 top-0 z-50 flex h-12 items-center justify-between px-2.5 transition-colors duration-300 sm:h-14 sm:px-3.5 md:hidden ${
          solid ? "bg-[#090B0F]/90 backdrop-blur-xl" : "bg-transparent"
        }`}
      >
        <Link
          href="/lounge"
          className="flex h-9 w-9 items-center justify-center text-white/90 sm:h-10 sm:w-10"
          aria-label="Open Lounge"
        >
          <CustomBarIcon />
        </Link>

        <Link
          href="/"
          className="absolute left-1/2 flex -translate-x-1/2 items-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Plazore"
            className="h-6 w-6 object-contain sm:h-7 sm:w-7"
          />
        </Link>

        <div className="flex items-center">
          <Link
            href="/browse"
            className="flex h-9 w-9 items-center justify-center text-white/90 sm:h-10 sm:w-10"
            aria-label="Search"
          >
            <Search className="h-[17px] w-[17px]" strokeWidth={1.75} />
          </Link>
          <Link
            href="/notifications"
            className="relative flex h-9 w-9 items-center justify-center text-white/90 sm:h-10 sm:w-10"
            aria-label={
              notifN > 0 ? `Notifications, ${notifN} unread` : "Notifications"
            }
          >
            <Bell className="h-[17px] w-[17px]" strokeWidth={1.75} />
            {notifN > 0 ? (
              <span className="absolute right-0.5 top-1 flex min-w-[14px] items-center justify-center rounded-full bg-[#00E575] px-0.5 text-center text-[8px] font-extrabold leading-none text-[#041412]">
                {notifN > 99 ? "99+" : notifN}
              </span>
            ) : null}
          </Link>

          <Link
            ref={bagRefMobile}
            href="/cart"
            className="relative flex h-9 w-9 items-center justify-center text-white/90 sm:h-10 sm:w-10"
            aria-label="Shopping cart"
            data-plazore-cart-icon
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-1 bg-[#00E575]/12 blur-[5px]"
            />
            <ShoppingCart
              className="relative h-[17px] w-[17px]"
              strokeWidth={1.75}
            />
            {bagN > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-[15px] items-center justify-center bg-gradient-to-r from-[#00E575] to-[#3B82F6] px-1 text-[8px] font-extrabold text-[#041412] shadow-[0_0_10px_rgba(0,229,117,0.45)]">
                {bagN > 9 ? "9+" : bagN}
              </span>
            ) : null}
          </Link>

          {isSignedIn ? (
            <Link
              href="/profile"
              className="ml-0.5 flex h-6 w-6 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/15 transition hover:ring-white/35 sm:h-7 sm:w-7"
              aria-label="Profile"
              title={avatarAlt}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-white/10 text-[10px] font-bold text-white/70">
                  {(avatarAlt || "U").charAt(0).toUpperCase()}
                </span>
              )}
            </Link>
          ) : null}
        </div>
      </header>

      <AppFeaturePrompt feature={prompt} onClose={() => setPrompt(null)} />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   ROOM 3 — THE SIGNAL
   Strict +1 add, fly, badge update. No border radius.
───────────────────────────────────────────────────────────── */
function RoomThreeStage({ products }: { products: Product[] }) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const fly = useShowroomFlyCart();
  const marketplace = useMarketplace() as { region?: string } | null;
  const displayRegion = marketplace?.region || DEFAULT_REGION;

  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  const busy = useRef(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartBtnRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.loop = true;
    v.preload = "auto";

    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          setTimeout(() => v.play().catch(() => {}), 400);
        });
      }
    };

    tryPlay();

    const onVis = () => {
      if (document.visibilityState === "visible") tryPlay();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const clearAuto = useCallback(() => {
    if (autoTimer.current) {
      clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
  }, []);

  const goTo = useCallback(
    (raw: number) => {
      if (busy.current || products.length < 2) return;
      const from = currentRef.current;
      const target =
        ((raw % products.length) + products.length) % products.length;
      if (target === from) return;
      busy.current = true;
      clearAuto();
      setCurrent(target);
      window.setTimeout(() => {
        busy.current = false;
        currentRef.current = target;
        if (products.length >= 2) {
          autoTimer.current = setTimeout(() => {
            goTo(currentRef.current + 1);
          }, 5400);
        }
      }, 900);
    },
    [products.length, clearAuto],
  );

  const scheduleAuto = useCallback(() => {
    clearAuto();
    if (products.length < 2) return;
    autoTimer.current = setTimeout(() => {
      goTo(currentRef.current + 1);
    }, 5400);
  }, [products.length, clearAuto, goTo]);

  useEffect(() => {
    if (products.length < 2) return;
    scheduleAuto();
    return () => clearAuto();
  }, [products.length, scheduleAuto, clearAuto]);

  const handleAddToCart = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoaded || adding) return;

    const product = products[currentRef.current];
    if (!product?._id) return;

    const pid = String(product._id);
    if (!canAddOnce(pid)) return;

    setAdding(true);
    window.setTimeout(() => setAdding(false), ADD_COOLDOWN_MS);

    if (!isSignedIn) {
      stashPendingAdd(pid);
      router.push(
        `/sign-in?redirect_url=${encodeURIComponent(
          typeof window !== "undefined" ? window.location.pathname : "/",
        )}`,
      );
      return;
    }

    if (productHasVariants(product)) {
      router.push(`/product/${pid}`);
      return;
    }

    const el = cartBtnRef.current;
    const origin =
      el != null
        ? (() => {
            const r = el.getBoundingClientRect();
            return {
              x: r.left,
              y: r.top,
              width: r.width,
              height: r.height,
            };
          })()
        : { x: 0, y: 0, width: 40, height: 40 };

    // ONLY flyAdd — never call addToCart here
    if (fly) {
      fly.flyAdd(product, origin);
    }
  };

  if (!products.length) return null;
  const active = products[current] || products[0];

  return (
    <div className="relative w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          src="/room3.mp4"
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
          style={{
            transform: "translateZ(0)",
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05060A]/55 via-[#05060A]/35 to-[#05060A]/75" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(5,6,10,0.55)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1100px] flex-col items-center px-4 py-12 sm:px-6 sm:py-16 md:py-20 lg:px-10">
        <div className="mb-8 text-center sm:mb-10">
          <p className="text-[10px] font-semibold tracking-[0.32em] text-white/50 sm:text-[11px]">
            THE SIGNAL
          </p>
          <p className="mt-2 font-display text-[1.65rem] font-bold tracking-tight text-white sm:text-[2rem] md:text-4xl lg:text-5xl">
            Worth Your Attention
          </p>
        </div>

        <div className="relative w-full max-w-[min(100%,380px)] sm:max-w-[460px] lg:max-w-[520px]">
          {/* NO border radius */}
          <div className="relative aspect-[4/5] w-full overflow-hidden border border-white/10 bg-black/40 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:aspect-[5/6]">
            {products.map((p, i) => (
              <div
                key={p._id}
                className="absolute inset-0 transition-opacity duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
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
                      className="h-full w-full object-cover"
                      style={{
                        transform: i === current ? "scale(1.045)" : "scale(1)",
                        transition:
                          i === current
                            ? "transform 5.4s linear"
                            : "transform 0s",
                        willChange: "transform",
                      }}
                      draggable={false}
                    />
                  ) : (
                    <div className="h-full w-full bg-[#1a1c22]" />
                  )}
                </Link>
              </div>
            ))}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-4 pt-8 sm:px-5 sm:pb-5">
              <Link href={`/product/${active._id}`} className="block">
                <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-white drop-shadow-sm sm:text-[17px]">
                  {active.name}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-white/70 sm:text-[13px]">
                  <span className="capitalize">
                    {(active.brand || "plazore").toLowerCase()}
                  </span>
                  <span className="text-white/30">·</span>
                  <span className="font-semibold text-white">
                    {formatProductPrice(
                      Number(active.price),
                      active.region,
                      displayRegion,
                    )}
                  </span>
                </p>
              </Link>
            </div>

            <button
              ref={cartBtnRef}
              type="button"
              onClick={handleAddToCart}
              disabled={adding}
              aria-label="Add to cart"
              className={`absolute bottom-3 right-3 z-20 flex h-10 w-10 items-center justify-center bg-white text-[#0a0c10] shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition active:scale-95 sm:bottom-4 sm:right-4 sm:h-11 sm:w-11 ${
                adding
                  ? "pointer-events-none scale-95 opacity-70"
                  : "hover:scale-105"
              }`}
            >
              <ShoppingCart
                className="h-[18px] w-[18px] sm:h-5 sm:w-5"
                strokeWidth={2.1}
              />
            </button>
          </div>

          {products.length > 1 ? (
            <div className="mt-5 flex justify-center gap-2 sm:mt-6">
              {products.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  className={`h-1.5 transition-all duration-300 ${
                    i === current
                      ? "w-[20px] bg-white/90"
                      : "w-1.5 bg-white/25 hover:bg-white/40"
                  }`}
                  aria-label={`Product ${i + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Mall
───────────────────────────────────────────────────────────── */
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
    initialRooms || null,
  );
  const [loading, setLoading] = useState(initialLoading);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(HERO_SLIDES);

  const [progress, setProgress] = useState(0);
  const [activeRoom, setActiveRoom] = useState(1);
  const [bagN, setBagN] = useState(0);
  const [notifN, setNotifN] = useState(0);
  const showroomRef = useRef<HTMLElement>(null);
  const roomRefs = useRef<Record<number, HTMLElement | null>>({});
  const fetchedRef = useRef(false);
  const heroFetchedRef = useRef(false);
  const lastRoomRef = useRef(1);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.scrollBehavior;
    const prevBody = body.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    body.style.scrollBehavior = "auto";
    html.style.overflowX = "hidden";
    body.style.overflowX = "hidden";
    return () => {
      html.style.scrollBehavior = prevHtml;
      body.style.scrollBehavior = prevBody;
      html.style.overflowX = "";
      body.style.overflowX = "";
    };
  }, []);

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
    [products, serverRooms],
  );

  const railA = useMemo(() => rooms.one.slice(0, RAIL_CAP), [rooms.one]);
  const railB = useMemo(
    () => rooms.one.slice(RAIL_CAP, ROOM_CAPACITY[1]),
    [rooms.one],
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
          NaN,
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
            (!n.readAt && n.read !== true && n.isRead !== true)),
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
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const heroH = window.innerHeight || 1;
        const y = window.scrollY || window.pageYOffset || 0;
        setProgress(Math.min(1, Math.max(0, y / (heroH * 0.75))));

        const probe = y + window.innerHeight * 0.3;
        let current = 1;
        for (const n of [1, 2, 3, 4] as const) {
          const el = roomRefs.current[n];
          if (el) {
            const top = el.getBoundingClientRect().top + y;
            if (top <= probe) current = n;
          }
        }
        if (current !== lastRoomRef.current) {
          lastRoomRef.current = current;
          setActiveRoom(current);
        }
        ticking = false;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const enterShowroom = () => {
    smoothScrollToEl(showroomRef.current);
  };

  const goRoom = (n: number) => {
    smoothScrollToEl(roomRefs.current[n] ?? null);
  };

  const roomNavOn = progress > 0.42;

  return (
    <div className="min-h-dvh w-full max-w-[100vw] overflow-x-hidden bg-bg text-text">
      <MallChrome progress={progress} bagN={bagN} notifN={notifN} />

      <HeroStage slides={heroSlides} onEnterShowroom={enterShowroom} />

      {/* Desktop room dots */}
      <div
        className={`fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-2.5 md:flex lg:right-4 ${
          roomNavOn ? "opacity-100" : "pointer-events-none opacity-0"
        } transition-opacity duration-300`}
      >
        {Array.from({ length: roomCount }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => goRoom(n)}
            className={`h-2 transition-all ${
              activeRoom === n
                ? "w-7 bg-[#00E575]"
                : "w-2 bg-white/30 hover:bg-white/50"
            }`}
            aria-label={`Room ${n}`}
          />
        ))}
      </div>

      {/* Mobile room pills */}
      <div
        className={`fixed inset-x-0 z-40 flex justify-center px-4 md:hidden ${
          roomNavOn ? "opacity-100" : "pointer-events-none opacity-0"
        } transition-opacity duration-300`}
        style={{
          bottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-center gap-1 border border-white/10 bg-[#11141A]/92 px-2 py-1.5 backdrop-blur-xl">
          {Array.from({ length: roomCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => goRoom(n)}
              className={`min-w-[32px] px-2 py-1.5 text-[10px] font-bold tracking-wide sm:min-w-[36px] sm:px-2.5 ${
                activeRoom === n ? "bg-white text-[#090B0F]" : "text-white/50"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <section ref={showroomRef} className="w-full overflow-x-hidden">
        {loading ? (
          <div className="flex h-[40vh] items-center justify-center text-muted sm:h-[50vh]">
            Loading the mall…
          </div>
        ) : !showroomHasItems ? (
          <div className="flex h-[36vh] items-center justify-center px-4 text-center text-secondary sm:h-[40vh]">
            The showroom is quiet right now.
          </div>
        ) : (
          <>
            {/* ──────────── ROOM 1 — THE HORIZON ──────────── */}
            {rooms.one.length > 0 ? (
              <section
                ref={(el) => {
                  roomRefs.current[1] = el;
                }}
                className="bg-[#0C0F14] pb-12 sm:pb-16"
              >
                <div className="relative h-[28vh] min-h-[180px] max-h-[280px] overflow-hidden sm:h-[34vh] sm:min-h-[220px] sm:max-h-[360px] md:h-[38vh]">
                  {rooms.one[0]?.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={rooms.one[0].images[0]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-[rgba(6,8,12,0.58)]" />
                  <div className="absolute bottom-6 left-4 right-4 sm:bottom-8 sm:left-6 md:left-10 lg:left-16">
                    <p className="text-[10px] font-semibold tracking-[0.28em] text-white/50 sm:text-[11px]">
                      {rooms.titles.one[0]}
                    </p>
                    <p className="mt-1.5 font-display text-[1.5rem] font-bold tracking-tight text-white sm:mt-2 sm:text-[1.75rem] md:text-4xl lg:text-5xl">
                      {rooms.titles.one[1]}
                    </p>
                  </div>
                </div>

                {railA.length > 0 ? (
                  <div className="pt-6 sm:pt-8">
                    <p className="mb-3 px-4 text-[10px] font-semibold tracking-[0.22em] text-white/38 sm:mb-4 sm:px-6 sm:text-[11px] md:px-10 lg:px-16">
                      NOW SHOWING
                    </p>
                    <div className={RAIL_CLASS}>
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
                  <div className="pt-5 sm:pt-7">
                    <div className={RAIL_CLASS}>
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

            {/* ──────────── ROOM 2 — THE CHAMBER ──────────── */}
            {rooms.two.length > 0 ? (
              <section
                ref={(el) => {
                  roomRefs.current[2] = el;
                }}
                className="bg-chamber px-3 py-10 text-chamber-ink sm:px-6 sm:py-14 md:px-10 md:py-20 lg:px-16"
              >
                <p className="text-[10px] font-semibold tracking-[0.28em] text-[#8C7B6B] sm:text-[11px]">
                  {rooms.titles.two[0]}
                </p>
                <p className="mt-1.5 font-display text-[1.5rem] font-bold tracking-tight sm:mt-2 sm:text-[1.75rem] md:text-4xl">
                  {rooms.titles.two[1]}
                </p>
                <div className="mt-3 h-[1.5px] w-12 bg-chamber-ink/20 sm:mt-4" />

                <div className="mx-auto mt-8 grid max-w-[720px] grid-cols-2 gap-2.5 sm:mt-10 sm:gap-4 md:gap-6 lg:max-w-[800px]">
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
                  <div className="mx-auto mt-6 grid max-w-[720px] grid-cols-2 gap-2.5 sm:mt-8 sm:gap-4 lg:max-w-[800px]">
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

            {/* ──────────── ROOM 3 — THE SIGNAL ──────────── */}
            {rooms.three.length > 0 ? (
              <section
                ref={(el) => {
                  roomRefs.current[3] = el;
                }}
                className="relative min-h-[85vh] overflow-hidden bg-[#05060A]"
              >
                <RoomThreeStage products={rooms.three} />
              </section>
            ) : null}

            {/* ──────────── ROOM 4 — THE LOCALE (no border radius) ──────────── */}
            {rooms.four.length > 0 ? (
              <section
                ref={(el) => {
                  roomRefs.current[4] = el;
                }}
                className="relative overflow-hidden bg-[#07090F] px-0 py-12 sm:py-16 md:py-20"
              >
                <Starfield />

                {/* soft top edge line — sharp, no radius */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/[0.06]" />

                <div className="relative z-10 px-4 sm:px-6 md:px-10 lg:px-16">
                  <p className="text-[10px] font-semibold tracking-[0.28em] text-white/40 sm:text-[11px]">
                    {rooms.titles.four[0]}
                  </p>
                  <p className="mt-1.5 font-display text-[1.55rem] font-bold tracking-tight text-white sm:mt-2 sm:text-[1.85rem] md:text-4xl">
                    {rooms.titles.four[1]}
                  </p>
                  <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/50 sm:text-sm">
                    A closer look at what&apos;s moving around you.
                  </p>
                </div>

                {/* Sharp-edge product rail — force no radius on cards in this room */}
                <div
                  className={`relative z-10 mt-8 sm:mt-10 ${RAIL_CLASS} pb-4 [&_.group]:!rounded-none [&_img]:!rounded-none [&_button]:!rounded-none`}
                >
                  {rooms.four.map((p) => (
                    <ProductCard
                      key={`r4-${p._id}`}
                      product={p}
                      compact
                      room={4}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </section>

      <p className="pb-8 pt-5 text-center text-[10px] tracking-wide text-muted sm:pb-10 sm:pt-6 sm:text-[11px]">
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