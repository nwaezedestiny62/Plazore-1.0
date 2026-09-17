"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { adminFetch } from "@/lib/api";
import {
  TV_QUOTE_SLIDES,
  TV_ROWS,
  countsFromStats,
  type ActivityCounts,
  type TvTile,
} from "@/lib/tvCatalog";
import { markCountSeen, unreadCount } from "@/lib/tvSeen";

const SLIDE_MS = 6500;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function TileFace({ tile, badge }: { tile: TvTile; badge: number }) {
  return (
    <div className="relative h-full overflow-hidden">
      {tile.kind === "logo" ? (
        <div className="flex h-full items-center justify-center bg-[#0b0d11]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tile.image} alt="" className="h-[70%] w-[70%] object-contain" />
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tile.image}
            alt=""
            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.08]"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        </>
      )}
      {badge > 0 && (
        <span className="absolute right-2.5 top-2.5 z-10 min-w-6 rounded-full bg-[#00E575] px-1.5 py-0.5 text-center text-[10px] font-extrabold text-[#041412] shadow-[0_0_18px_rgba(0,229,117,0.55)]">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <div className="absolute bottom-3 left-3 right-3">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-white/55">
          {tile.kicker}
        </p>
        <p className="text-[15px] font-semibold tracking-tight">{tile.label}</p>
      </div>
    </div>
  );
}

function QuoteCarousel() {
  const n = TV_QUOTE_SLIDES.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (next: number) => {
      setIndex(((next % n) + n) % n);
    },
    [n],
  );

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => go(index + 1), SLIDE_MS);
    return () => window.clearInterval(id);
  }, [index, paused, go]);

  // Preload neighbors
  useEffect(() => {
    [index, (index + 1) % n, (index - 1 + n) % n].forEach((i) => {
      const img = new Image();
      img.src = TV_QUOTE_SLIDES[i].image;
    });
  }, [index, n]);

  return (
    <div
      className="relative overflow-hidden rounded-[22px] border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.5)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) < 40) return;
        go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="relative h-[210px] sm:h-[280px] lg:h-[360px]">
        {TV_QUOTE_SLIDES.map((slide, i) => {
          const active = i === index;
          return (
            <div
              key={slide.title}
              className="absolute inset-0"
              style={{
                opacity: active ? 1 : 0,
                transform: active ? "scale(1)" : "scale(1.04)",
                transition: `opacity 900ms ${EASE}, transform 6.5s ${EASE}`,
                pointerEvents: active ? "auto" : "none",
                zIndex: active ? 2 : 1,
              }}
              aria-hidden={!active}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.image}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />
              <div
                className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10"
                style={{
                  opacity: active ? 1 : 0,
                  transform: active ? "translateY(0)" : "translateY(12px)",
                  transition: `opacity 700ms ${EASE} 120ms, transform 700ms ${EASE} 120ms`,
                }}
              >
                <p className="text-[11px] font-semibold tracking-[0.22em] text-[#00E575]">
                  {slide.kicker}
                </p>
                <h1 className="mt-3 max-w-[18ch] text-[26px] font-semibold leading-[1.12] tracking-tight sm:text-[40px] lg:text-[46px]">
                  {slide.title}
                </h1>
                <p className="mt-3 text-[13px] text-white/55">{slide.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-4 right-5 z-10 flex items-center gap-1.5 sm:bottom-6 sm:right-8">
        {TV_QUOTE_SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Slide ${i + 1}`}
            onClick={() => go(i)}
            className="h-1.5 overflow-hidden rounded-full bg-white/25 transition-all duration-500"
            style={{
              width: i === index ? 28 : 8,
              background:
                i === index
                  ? "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)"
                  : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [raw, setRaw] = useState<ActivityCounts | null>(null);
  const [, bump] = useState(0);
  const [fly, setFly] = useState<{
    href: string;
    top: number;
    left: number;
    width: number;
    height: number;
    tile: TvTile;
    badge: number;
  } | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        const token = await getToken();
        const json = await adminFetch<any>("/admin/stats", token);
        const next = countsFromStats(json.data);
        setRaw(next);
        sessionStorage.setItem("plazore.admin.liveCounts", JSON.stringify(next));
      } catch {
        setRaw(countsFromStats(null));
      }
    })();
  }, [isLoaded, isSignedIn, getToken]);

  const badges = useMemo(() => {
    if (!raw) return {} as Record<string, number>;
    return {
      usersNew: unreadCount("usersNew", raw.usersNew),
      productsNew: unreadCount("productsNew", raw.productsNew),
      ordersActive: unreadCount("ordersActive", raw.ordersActive),
      reportsNew: unreadCount("reportsNew", raw.reportsNew),
      contactsNew: unreadCount("contactsNew", raw.contactsNew),
      moderationOpen: unreadCount("moderationOpen", raw.moderationOpen),
    };
  }, [raw]);

  const openTile = (el: HTMLElement, tile: TvTile) => {
    if (lock.current) return;
    lock.current = true;
    const badge = tile.countKey ? badges[tile.countKey] ?? 0 : 0;
    if (tile.countKey && raw) {
      markCountSeen(tile.countKey, raw[tile.countKey as keyof ActivityCounts]);
    }
    bump((n) => n + 1);
    const r = el.getBoundingClientRect();
    setFly({
      href: tile.href,
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      tile,
      badge,
    });
    window.setTimeout(() => router.push(tile.href), 560);
  };

  return (
    <div className="relative min-h-dvh pb-20">
      <section className="px-4 pt-6 sm:px-8 sm:pt-8 lg:px-12">
        <QuoteCarousel />
      </section>

      <div className="mt-9 space-y-9">
        {TV_ROWS.map((row) => (
          <section key={row.id}>
            <h2 className="mb-3 px-4 text-[13px] font-semibold text-white/75 sm:px-8 lg:px-12">
              {row.title}
            </h2>
            <div className="tv-hide-scroll flex gap-3 overflow-x-auto px-4 pb-1 sm:gap-4 sm:px-8 lg:px-12">
              {row.tiles.map((tile) => {
                const badge = tile.countKey ? badges[tile.countKey] ?? 0 : 0;
                return (
                  <button
                    key={tile.href}
                    type="button"
                    onClick={(e) => openTile(e.currentTarget, tile)}
                    className="group h-[138px] w-[176px] shrink-0 overflow-hidden rounded-[18px] border border-white/10 bg-[#11141A] text-left shadow-[0_16px_40px_rgba(0,0,0,0.35)] transition duration-500 ease-out hover:-translate-y-1.5 hover:border-white/30 hover:shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:h-[158px] sm:w-[210px] lg:h-[176px] lg:w-[240px]"
                  >
                    <TileFace tile={tile} badge={badge} />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {fly && (
        <div
          className="pointer-events-none fixed z-[90] overflow-hidden rounded-[18px]"
          style={{
            top: fly.top,
            left: fly.left,
            width: fly.width,
            height: fly.height,
            animation: "tv-fly 540ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
          }}
        >
          <TileFace tile={fly.tile} badge={fly.badge} />
        </div>
      )}
    </div>
  );
}