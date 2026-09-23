"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { HeroSlide } from "@/lib/heroCampaigns";
import { HERO_SLIDES } from "@/lib/heroCampaigns";

const HOLD_MS = 12_000;
const IMG_FADE_MS = 3200;
const TEXT_OUT_MS = 720;
const TEXT_IN_MS = 1150;
const TEXT_GAP_MS = 60;

const EASE_IMG = "cubic-bezier(0.33, 0, 0.2, 1)";
const EASE_TEXT = "cubic-bezier(0.22, 1, 0.36, 1)";
const FALLBACK_IMG = "/hero/welcome.png";

function heroHeadlineSize(text: string): string {
  const n = (text || "").trim().length;
  if (n > 52) return "clamp(1.25rem, 2.8vw, 2.15rem)";
  if (n > 40) return "clamp(1.4rem, 3.2vw, 2.55rem)";
  if (n > 28) return "clamp(1.6rem, 3.8vw, 3.2rem)";
  return "clamp(1.85rem, 4.6vw, 4.25rem)";
}

function heroSubSize(text: string): string {
  const n = (text || "").trim().length;
  if (n > 90) return "text-[13px] sm:text-[14px]";
  if (n > 60) return "text-[13px] sm:text-[15px]";
  return "text-[14px] sm:text-[16px]";
}

function SafeHeroImg({
  src,
  active,
  animate,
}: {
  src: string;
  active: boolean;
  animate: boolean;
}) {
  const [url, setUrl] = useState(src || FALLBACK_IMG);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUrl(src || FALLBACK_IMG);
    setFailed(false);
  }, [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={failed ? FALLBACK_IMG : url}
      alt=""
      decoding="async"
      loading={active ? "eager" : "lazy"}
      draggable={false}
      className="absolute inset-0 h-full w-full object-cover"
      style={
        animate
          ? {
              transform: active
                ? "scale(1.07) translateZ(0)"
                : "scale(1) translateZ(0)",
              transition: active
                ? `transform ${HOLD_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1)`
                : "none",
            }
          : undefined
      }
      onError={() => {
        if (!failed) setFailed(true);
      }}
    />
  );
}

type Phase = "idle" | "out" | "in" | "hidden";

function CopyBlock({
  slide,
  phase,
  onCta,
  animate,
}: {
  slide: HeroSlide;
  phase: Phase;
  onCta: () => void;
  animate: boolean;
}) {
  const headlineFs = heroHeadlineSize(slide?.headline || "");
  const subClass = heroSubSize(slide?.subheadline || "");
  const visible = !animate || phase === "idle" || phase === "in";
  const entering = animate && phase === "in";

  const lineStyle = (delayIn: number): React.CSSProperties | undefined => {
    if (!animate) return undefined;
    return {
      opacity: visible ? 1 : 0,
      transform: visible ? "translate3d(0,0,0)" : "translate3d(0,12px,0)",
      transition:
        phase === "hidden"
          ? "none"
          : visible
            ? `opacity ${TEXT_IN_MS}ms ${EASE_TEXT} ${delayIn}ms, transform ${TEXT_IN_MS}ms ${EASE_TEXT} ${delayIn}ms`
            : `opacity ${TEXT_OUT_MS}ms ${EASE_TEXT}, transform ${TEXT_OUT_MS}ms ${EASE_TEXT}`,
    };
  };

  return (
    <div
      className="absolute inset-x-0 bottom-0 max-w-[min(100%,26rem)] md:max-w-[min(100%,32rem)]"
      style={
        animate
          ? {
              pointerEvents: visible ? "auto" : "none",
              visibility: phase === "hidden" ? "hidden" : "visible",
            }
          : undefined
      }
    >
      <p
        className="text-[10px] font-semibold tracking-[0.36em] text-[#00E575]/90 sm:text-[11px]"
        style={lineStyle(entering ? 0 : 0)}
      >
        {slide.kicker}
      </p>
      <h1
        className="mt-3 font-display font-medium leading-[1.12] tracking-tight text-white"
        style={{
          fontSize: headlineFs,
          ...lineStyle(entering ? 100 : 0),
        }}
      >
        <span className="line-clamp-3">{slide.headline}</span>
      </h1>
      <p
        className={`mt-3 max-w-lg leading-relaxed text-white/65 line-clamp-3 ${subClass}`}
        style={lineStyle(entering ? 180 : 0)}
      >
        {slide.subheadline}
      </p>
      <button
        type="button"
        onClick={onCta}
        className="mt-7 w-fit border border-white/35 px-6 py-2.5 text-[11px] font-semibold tracking-[0.2em] uppercase text-white transition duration-500 hover:border-white hover:bg-white/5"
        style={lineStyle(entering ? 260 : 0)}
      >
        {slide.ctaLabel}
      </button>
    </div>
  );
}

type Props = {
  slides: HeroSlide[];
  onEnterShowroom: () => void;
};

export function HeroStage({ slides: rawSlides, onEnterShowroom }: Props) {
  const slides = rawSlides?.length > 0 ? rawSlides : HERO_SLIDES;

  /** false on server + first client paint → identical HTML → no hydration mismatch */
  const [ready, setReady] = useState(false);

  const [index, setIndex] = useState(0);
  const [front, setFront] = useState<"A" | "B">("A");
  const [slideA, setSlideA] = useState(0);
  const [slideB, setSlideB] = useState(0);
  const [phaseA, setPhaseA] = useState<Phase>("idle");
  const [phaseB, setPhaseB] = useState<Phase>("hidden");

  const busy = useRef(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeouts = useRef<number[]>([]);

  const clearTimeouts = () => {
    timeouts.current.forEach((id) => window.clearTimeout(id));
    timeouts.current = [];
  };

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timeouts.current.push(id);
  };

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    slides.forEach((s) => {
      if (!s.image) return;
      const img = new window.Image();
      img.src = s.image;
    });
  }, [ready, slides]);

  const goTo = useCallback(
    (nextRaw: number) => {
      if (!ready || busy.current || slides.length < 2) return;
      const next = ((nextRaw % slides.length) + slides.length) % slides.length;
      if (next === indexRef.current) return;

      busy.current = true;
      clearTimeouts();

      const fromFront = front;

      if (fromFront === "A") setPhaseA("out");
      else setPhaseB("out");

      later(() => {
        indexRef.current = next;
        setIndex(next);

        if (fromFront === "A") {
          setSlideB(next);
          setPhaseB("in");
          setFront("B");
          setPhaseA("hidden");
        } else {
          setSlideA(next);
          setPhaseA("in");
          setFront("A");
          setPhaseB("hidden");
        }

        later(() => {
          if (fromFront === "A") setPhaseB("idle");
          else setPhaseA("idle");
          busy.current = false;
        }, TEXT_IN_MS + 50);
      }, TEXT_OUT_MS + TEXT_GAP_MS);
    },
    [front, ready, slides.length]
  );

  const goToRef = useRef(goTo);
  goToRef.current = goTo;

  useEffect(() => {
    if (!ready || slides.length < 2) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      goToRef.current(indexRef.current + 1);
    }, HOLD_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearTimeouts();
    };
  }, [ready, slides.length]);

  const dataA = slides[slideA % slides.length] || HERO_SLIDES[0];
  const dataB = slides[slideB % slides.length] || HERO_SLIDES[0];
  const first = slides[0] || HERO_SLIDES[0];

  return (
    <section className="relative h-dvh min-h-[560px] overflow-hidden bg-[#090B0F]">
      {/* Images: only first slide until ready (SSR match) */}
      {(ready ? slides : [first]).map((s, i) => {
        const active = ready ? i === index : i === 0;
        return (
          <div
            key={s.id}
            className="absolute inset-0"
            style={
              ready
                ? {
                    opacity: active ? 1 : 0,
                    transition: `opacity ${IMG_FADE_MS}ms ${EASE_IMG}`,
                    pointerEvents: active ? "auto" : "none",
                    zIndex: active ? 1 : 0,
                  }
                : { opacity: 1, zIndex: 1 }
            }
            aria-hidden={!active}
          >
            <SafeHeroImg src={s.image} active={active} animate={ready} />
          </div>
        );
      })}

      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-[#090B0F] via-[#090B0F]/55 to-transparent" />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-r from-[#090B0F]/55 via-[#090B0F]/15 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-28 bg-gradient-to-b from-black/40 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-end px-5 pb-28 pt-24 sm:px-8 md:px-16 md:pb-32 lg:px-24">
        <div className="relative min-h-[240px] w-full max-w-[min(100%,32rem)]">
          {!ready ? (
            <CopyBlock
              slide={first}
              phase="idle"
              onCta={onEnterShowroom}
              animate={false}
            />
          ) : (
            <>
              <CopyBlock
                slide={dataA}
                phase={phaseA}
                onCta={onEnterShowroom}
                animate
              />
              <CopyBlock
                slide={dataB}
                phase={phaseB}
                onCta={onEnterShowroom}
                animate
              />
            </>
          )}
        </div>

        {ready && slides.length > 1 ? (
          <div className="mt-8 flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-1 rounded-full transition-all duration-700 ease-out ${
                  i === index
                    ? "w-5 bg-white/90"
                    : "w-1.5 bg-white/25 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 h-1" aria-hidden />
        )}
      </div>

      <button
        type="button"
        onClick={onEnterShowroom}
        className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 text-white/50 transition hover:text-white/90"
        aria-label="Enter showroom"
      >
        <span className="text-[9px] font-semibold tracking-[0.28em] uppercase">
          Showroom
        </span>
        <ChevronDown className="h-5 w-5 animate-bounce" strokeWidth={1.5} />
      </button>
    </section>
  );
}