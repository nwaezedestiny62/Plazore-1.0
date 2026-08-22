"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { HERO_SLIDES } from "@/lib/heroCampaigns";
import type { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";

const NAV = [
  { href: "/", label: "Mall" },
  { href: "/browse", label: "Browse" },
  { href: "/lounge", label: "Lounge" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/cart", label: "Bag" },
];

function splitRooms(products: Product[]) {
  if (products.length > 0 && products.length <= 4) {
    return {
      one: products,
      two: products,
      three: products,
      four: products,
      titles: {
        one: ["THE SHOWROOM", "Take a look around"],
        two: ["THE EDIT", "Side by Side"],
        three: ["THE SIGNAL", "Worth Your Attention"],
        four: ["THE LOCALE", "From Around You"],
      },
    };
  }
  return {
    one: products.slice(0, 4),
    two: products.slice(4, 8),
    three: products.slice(8, 12),
    four: products.slice(12),
    titles: {
      one: ["THE HORIZON", "Expanded View"],
      two: ["THE CHAMBER", "Private Selection"],
      three: ["THE SIGNAL", "Worth Your Attention"],
      four: ["THE LOCALE", "From Your Region"],
    },
  };
}

export function Mall({ products, loading }: { products: Product[]; loading: boolean }) {
  const [slide, setSlide] = useState(0);
  const [progress, setProgress] = useState(0);
  const [activeRoom, setActiveRoom] = useState(1);
  const showroomRef = useRef<HTMLElement>(null);
  const roomRefs = useRef<Record<number, HTMLElement | null>>({});

  const rooms = useMemo(() => splitRooms(products), [products]);

  useEffect(() => {
    const id = setInterval(() => {
      setSlide((s) => (s + 1) % HERO_SLIDES.length);
    }, 11000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const heroH = window.innerHeight;
      const y = window.scrollY;
      const p = Math.min(1, Math.max(0, y / (heroH * 0.85)));
      setProgress(p);

      const probe = y + window.innerHeight * 0.28;
      let current = 1;
      for (const n of [1, 2, 3, 4]) {
        const el = roomRefs.current[n];
        if (el && el.offsetTop <= probe) current = n;
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

  const current = HERO_SLIDES[slide];
  const chromeOn = progress > 0.08;
  const roomNavOn = progress > 0.55;

  return (
    <div className="min-h-screen bg-bg text-text">
      <header
        className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between px-6 transition duration-500"
        style={{
          opacity: chromeOn ? 1 : 0,
          transform: `translateY(${chromeOn ? 0 : -8}px)`,
          background: chromeOn ? "rgba(9,11,15,0.72)" : "transparent",
          backdropFilter: chromeOn ? "blur(16px)" : "none",
          pointerEvents: chromeOn ? "auto" : "none",
        }}
      >
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Plazore" className="h-7 w-7 object-contain" />
          <span className="text-sm tracking-[0.2em] uppercase">Plazore</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-xs tracking-[0.18em] uppercase ${
                item.href === "/" ? "text-text" : "text-secondary hover:text-text"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <section className="relative h-screen overflow-hidden">
        {HERO_SLIDES.map((s, i) => (
          <div
            key={s.id}
            className="absolute inset-0 transition-opacity duration-[3200ms]"
            style={{ opacity: i === slide ? 1 : 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.image}
              alt=""
              className="h-full w-full origin-center object-cover"
              style={{
                transform: i === slide ? "scale(1.04)" : "scale(1)",
                transition: "transform 11s linear",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-black/20" />
          </div>
        ))}

        <div className="relative z-10 flex h-full flex-col justify-end px-8 pb-24 md:px-16 lg:px-24">
          <p className="font-display text-5xl font-medium tracking-tight md:text-7xl">
            {current.headline}
          </p>
          <p className="mt-4 max-w-xl text-lg text-secondary">{current.subheadline}</p>
          <button
            onClick={enterShowroom}
            className="mt-8 w-fit text-xs tracking-[0.22em] uppercase text-text"
          >
            {current.ctaLabel}
          </button>
        </div>
      </section>

      <div
        className="fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 md:flex"
        style={{
          opacity: roomNavOn ? 1 : 0,
          pointerEvents: roomNavOn ? "auto" : "none",
          transition: "opacity 400ms ease",
        }}
      >
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => goRoom(n)}
            className={`h-2 rounded-full transition-all ${
              activeRoom === n ? "w-8 bg-green" : "w-2 bg-muted"
            }`}
            aria-label={`Room ${n}`}
          />
        ))}
      </div>

      <section ref={showroomRef}>
        {loading ? (
          <div className="flex h-[50vh] items-center justify-center text-muted">Loading the mall…</div>
        ) : products.length === 0 ? (
          <div className="flex h-[40vh] items-center justify-center text-secondary">
            The showroom is quiet right now.
          </div>
        ) : (
          <>
            <section
              ref={(el) => {
                roomRefs.current[1] = el;
              }}
              className="bg-bg"
            >
              <div className="relative h-[46vh] min-h-[320px] overflow-hidden">
                {rooms.one[0]?.images?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rooms.one[0].images[0]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-bg to-transparent" />
                <div className="absolute bottom-10 left-8 md:left-16">
                  <p className="text-[11px] tracking-[0.28em] text-green">{rooms.titles.one[0]}</p>
                  <p className="mt-2 font-display text-3xl md:text-5xl">{rooms.titles.one[1]}</p>
                </div>
              </div>
              <div className="px-8 py-12 md:px-16">
                <p className="mb-6 text-[11px] tracking-[0.22em] text-muted">NOW SHOWING</p>
                <div className="flex gap-3 overflow-x-auto pb-4">
                  {rooms.one.map((p) => (
                    <ProductCard key={p._id} product={p} />
                  ))}
                </div>
              </div>
            </section>

            <section
              ref={(el) => {
                roomRefs.current[2] = el;
              }}
              className="bg-chamber px-8 py-20 text-chamber-ink md:px-16"
            >
              <p className="text-[11px] tracking-[0.28em] text-muted">{rooms.titles.two[0]}</p>
              <p className="mt-2 font-display text-4xl">{rooms.titles.two[1]}</p>
              <div className="mt-4 h-px w-16 bg-chamber-ink/20" />
              <div className="mt-12 grid gap-8 md:grid-cols-2">
                {rooms.two.slice(0, 2).map((p) => (
                  <ProductCard key={p._id} product={p} tone="light" />
                ))}
              </div>
              {rooms.two.length > 2 && (
                <div className="mt-10 flex gap-3 overflow-x-auto">
                  {rooms.two.slice(2).map((p) => (
                    <ProductCard key={p._id} product={p} tone="light" />
                  ))}
                </div>
              )}
            </section>

            <section
              ref={(el) => {
                roomRefs.current[3] = el;
              }}
              className="bg-bg px-8 py-24 md:px-16"
            >
              <p className="text-[11px] tracking-[0.28em] text-green">{rooms.titles.three[0]}</p>
              <p className="mt-2 font-display text-4xl md:text-6xl">{rooms.titles.three[1]}</p>
              {rooms.three[0] && (
                <div className="mt-14 grid items-center gap-12 lg:grid-cols-2">
                  <div className="aspect-[4/5] overflow-hidden bg-surface-2">
                    {rooms.three[0].images?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={rooms.three[0].images[0]}
                        alt={rooms.three[0].name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted">
                      {typeof rooms.three[0].seller === "object"
                        ? rooms.three[0].seller?.storeName
                        : "plazore"}
                    </p>
                    <h2 className="mt-3 font-display text-4xl">{rooms.three[0].name}</h2>
                    <Link
                      href={`/product/${rooms.three[0]._id}`}
                      className="mt-8 inline-block text-xs tracking-[0.2em] uppercase text-green"
                    >
                      View piece
                    </Link>
                  </div>
                </div>
              )}
            </section>

            <section
              ref={(el) => {
                roomRefs.current[4] = el;
              }}
              className="bg-bg px-8 py-20 md:px-16"
            >
              <p className="text-[11px] tracking-[0.28em] text-muted">{rooms.titles.four[0]}</p>
              <p className="mt-2 font-display text-4xl">{rooms.titles.four[1]}</p>
              <p className="mt-3 text-sm text-secondary">A look at what’s around you.</p>
              <div className="mt-12 flex gap-3 overflow-x-auto pb-6">
                {rooms.four.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </div>
  );
}