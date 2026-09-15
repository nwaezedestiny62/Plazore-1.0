"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bookmark, Heart, Music, Sparkles, X } from "lucide-react";

export type AppFeature =
  | "wishlist"
  | "saved_store"
  | "saved_stores"
  | "music"
  | "ai_deeper";

type FeatureCopy = {
  title: string;
  body: string;
  icon: typeof Heart;
  iconColor: string;
  chipBorder: string;
  chipBg: string;
};

const COPY: Record<AppFeature, FeatureCopy> = {
  wishlist: {
    title: "Saved pieces live in the app",
    body: "Wishlist stays with you across sessions in the Plazore App — the fuller, personal side of the mall.",
    icon: Heart,
    iconColor: "#F472B6",
    chipBorder: "rgba(244,114,182,0.35)",
    chipBg: "linear-gradient(145deg, rgba(244,114,182,0.16), rgba(239,98,98,0.1))",
  },
  saved_store: {
    title: "Followed storefronts live in the app",
    body: "Saving a store is part of the Plazore App, so the makers you care about stay close.",
    icon: Bookmark,
    iconColor: "#3B82F6",
    chipBorder: "rgba(59,130,246,0.35)",
    chipBg: "linear-gradient(145deg, rgba(59,130,246,0.16), rgba(0,229,117,0.08))",
  },
  saved_stores: {
    title: "Followed storefronts live in the app",
    body: "Saving a store is part of the Plazore App, so the makers you care about stay close.",
    icon: Bookmark,
    iconColor: "#3B82F6",
    chipBorder: "rgba(59,130,246,0.35)",
    chipBg: "linear-gradient(145deg, rgba(59,130,246,0.16), rgba(0,229,117,0.08))",
  },
  music: {
    title: "The soundtrack is an app experience",
    body: "Plazore’s ambient music is designed for the app. The web stays quiet so shopping stays clear.",
    icon: Music,
    iconColor: "#14B8A6",
    chipBorder: "rgba(20,184,166,0.35)",
    chipBg: "linear-gradient(145deg, rgba(20,184,166,0.16), rgba(59,130,246,0.1))",
  },
  ai_deeper: {
    title: "The deeper reading is in the app",
    body: "Quick AI Insights stay here. The full Plazore AI Product Intelligence experience continues in the app.",
    icon: Sparkles,
    iconColor: "#10B981",
    chipBorder: "rgba(16,185,129,0.38)",
    chipBg: "linear-gradient(145deg, rgba(16,185,129,0.16), rgba(59,130,246,0.12))",
  },
};

const VIDEO_SRC = "/plazore-popup.mp4";
const FALLBACK_SRC = "/logo.png";
const EXIT_MS = 280;

function PortraitVideo({
  className = "",
  /** Desktop badge sits a bit lower + further left to cover watermark cleanly */
  badgeClassName = "bottom-2 right-2",
}: {
  className?: string;
  badgeClassName?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || failed) return;
    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute("muted", "");
    el.playsInline = true;
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    const tryPlay = () => {
      el.play().catch(() => {});
    };
    tryPlay();
    el.addEventListener("loadeddata", tryPlay);
    return () => el.removeEventListener("loadeddata", tryPlay);
  }, [failed]);

  return (
    <div className={`relative bg-[#090B0F] ${className}`}>
      {!failed ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={VIDEO_SRC}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          controls={false}
          disablePictureInPicture
          onError={() => setFailed(true)}
          aria-label="Plazore app preview"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={FALLBACK_SRC}
          alt="Plazore"
          className="absolute inset-0 h-full w-full object-contain p-10 opacity-90"
        />
      )}
    </div>
  );
}

function TextBlock({
  copy,
  requestClose,
  mobile,
}: {
  copy: FeatureCopy;
  requestClose: () => void;
  mobile?: boolean;
}) {
  const Icon = copy.icon;

  return (
    <div className="relative z-10 flex flex-col">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center border backdrop-blur-md"
          style={{
            borderColor: copy.chipBorder,
            background: copy.chipBg,
          }}
        >
          <Icon className="h-5 w-5" style={{ color: copy.iconColor }} />
        </div>
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #00E575 0%, #14B8A6 45%, #3B82F6 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Plazore App
          </p>
          <p
            className={`mt-0.5 text-[11px] ${
              mobile ? "text-white/60" : "text-white/30"
            }`}
          >
            Fuller experience on phone
          </p>
        </div>
      </div>

      <h2
        id="app-feature-title"
        className={`
          mt-5 font-display font-bold leading-[1.25] tracking-tight
          ${
            mobile
              ? "text-[22px] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)]"
              : "text-[22px] text-[#F5F7FA] sm:text-[24px]"
          }
        `}
      >
        {copy.title}
      </h2>

      <p
        className={`
          mt-2.5 max-w-[38ch] text-[14px] leading-[1.65]
          ${
            mobile
              ? "text-white/85 drop-shadow-[0_1px_10px_rgba(0,0,0,0.6)]"
              : "text-white/50"
          }
        `}
      >
        {copy.body}
      </p>

      <div className="mt-7 flex flex-col gap-2.5">
        <Link
          href="/download"
          onClick={requestClose}
          className="
            flex h-12 w-full items-center justify-center
            border border-white/20 bg-black/90
            text-[14px] font-extrabold tracking-wide text-white
            backdrop-blur-sm
            transition hover:border-white/35 hover:bg-black
          "
        >
          Get the Plazore App
        </Link>
        <button
          type="button"
          onClick={requestClose}
          className="
            h-12 w-full border border-white/15 bg-white/[0.06]
            text-[13px] font-semibold text-white/75
            backdrop-blur-sm
            transition hover:border-white/25 hover:bg-white/[0.1] hover:text-white
          "
        >
          Continue on web
        </button>
      </div>

      <p
        className={`
          mt-5 text-[10px] font-semibold uppercase tracking-[0.2em]
          ${mobile ? "text-white/45" : "text-white/20"}
        `}
      >
        Discovery-Led Commerce
      </p>
    </div>
  );
}

export function AppFeaturePrompt({
  feature,
  onClose,
}: {
  feature: AppFeature | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (feature) {
      if (exitTimer.current) {
        clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }
      setMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpen(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setOpen(false);
    exitTimer.current = setTimeout(() => {
      setMounted(false);
      exitTimer.current = null;
    }, EXIT_MS);
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [feature]);

  const requestClose = () => {
    setOpen(false);
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => {
      exitTimer.current = null;
      setMounted(false);
      onClose();
    }, EXIT_MS);
  };

  if (!mounted || !feature) return null;
  const copy = COPY[feature];
  if (!copy) return null;

  return (
    <div
      className={`
        fixed inset-0 z-[80] flex items-end justify-center p-0
        sm:items-center sm:p-6
        transition-opacity duration-300 ease-out
        ${open ? "opacity-100" : "opacity-0"}
      `}
    >
      <button
        type="button"
        className={`
          absolute inset-0 cursor-default bg-black/70
          transition-opacity duration-300 ease-out
          ${open ? "opacity-100" : "opacity-0"}
        `}
        onClick={requestClose}
        aria-label="Close"
      />

      <div
        className={`
          relative w-full max-w-md overflow-hidden
          border border-white/[0.08] bg-[#0B0C12]
          shadow-[0_32px_100px_rgba(0,0,0,0.55)]
          sm:max-w-2xl sm:border-white/[0.1]
          transition-all duration-300 ease-out
          ${
            open
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-4 scale-[0.98] opacity-0 sm:translate-y-3"
          }
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-feature-title"
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />

        <button
          type="button"
          onClick={requestClose}
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center border border-white/15 bg-black/50 text-white/70 backdrop-blur-md transition hover:border-white/25 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ═══ MOBILE — video is the sheet background ═══ */}
        <div className="relative block sm:hidden">
          {/*
            Explicit height so absolute video always has a box to fill.
            Content sits on top with a bottom gradient for readability.
          */}
          <div className="relative h-[min(82dvh,680px)] w-full">
            <PortraitVideo
              className="absolute inset-0 h-full w-full"
              badgeClassName="bottom-3 right-3"
            />

            {/* Scrim: keep upper video visible, darken lower for type */}
            <div
              className="pointer-events-none absolute inset-0 z-[1]"
              style={{
                background:
                  "linear-gradient(180deg, rgba(9,11,15,0.35) 0%, rgba(9,11,15,0.15) 30%, rgba(9,11,15,0.55) 55%, rgba(9,11,15,0.94) 78%, #090B0F 100%)",
              }}
            />

            <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-7 pt-24">
              <TextBlock copy={copy} requestClose={requestClose} mobile />
            </div>
          </div>
        </div>

        {/* ═══ DESKTOP — text left · portrait video right ═══ */}
        <div className="hidden sm:flex sm:flex-row sm:items-stretch">
          <div className="flex flex-1 flex-col justify-center px-9 py-11 pr-7">
            <TextBlock copy={copy} requestClose={requestClose} />
          </div>
          <div className="w-[248px] shrink-0 self-stretch px-7 py-9 pl-0">
            <PortraitVideo
              className="h-full min-h-[420px] w-full border border-white/[0.08]"
              /* down + left a bit vs tight corner */
              badgeClassName="bottom-1 right-4"
            />
          </div>
        </div>
      </div>
    </div>
  );
}