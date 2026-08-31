"use client";

import { Bookmark, Heart, Music, Sparkles, X } from "lucide-react";

export type AppFeature =
  | "wishlist"
  | "saved_store"
  | "saved_stores"
  | "music"
  | "ai_deeper";

const COPY: Record<
  AppFeature,
  { title: string; body: string; icon: typeof Heart }
> = {
  wishlist: {
    title: "Saved pieces live in the app",
    body: "Wishlist stays with you across sessions in the Plazore App — the fuller, personal side of the mall.",
    icon: Heart,
  },
  saved_store: {
    title: "Followed storefronts live in the app",
    body: "Saving a store is part of the Plazore App, so the makers you care about stay close.",
    icon: Bookmark,
  },
  saved_stores: {
    title: "Followed storefronts live in the app",
    body: "Saving a store is part of the Plazore App, so the makers you care about stay close.",
    icon: Bookmark,
  },
  music: {
    title: "The soundtrack is an app experience",
    body: "Plazore’s ambient music is designed for the app. The web stays quiet so shopping stays clear.",
    icon: Music,
  },
  ai_deeper: {
    title: "The deeper reading is in the app",
    body: "Quick AI Insights stay here. The full Plazore AI Product Intelligence experience continues in the app.",
    icon: Sparkles,
  },
};

const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";

export function AppFeaturePrompt({
  feature,
  onClose,
}: {
  feature: AppFeature | null;
  onClose: () => void;
}) {
  if (!feature) return null;
  const copy = COPY[feature];
  if (!copy) return null;

  const Icon = copy.icon;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close"
      />

      <div
        className="
          relative w-full max-w-md overflow-hidden
          border border-white/[0.08] bg-[#0B0C12]
          shadow-[0_32px_100px_rgba(0,0,0,0.55)]
          sm:border-white/[0.1]
        "
      >
        {/* Top gradient rule */}
        <div className="h-[2px] w-full" style={{ backgroundImage: GRAD }} />

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center border border-white/10 bg-[#11131C] text-white/55 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pb-7 pt-8 sm:px-8 sm:pb-8 sm:pt-10">
          {/* Plazore logo */}
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Plazore"
              className="h-14 w-14 object-contain drop-shadow-[0_0_24px_rgba(0,229,117,0.25)]"
            />
          </div>

          {/* Feature mark */}
          <div className="mt-7 flex justify-center">
            <div
              className="flex h-12 w-12 items-center justify-center border"
              style={{
                borderColor: "rgba(0,229,117,0.28)",
                background:
                  "linear-gradient(135deg, rgba(0,229,117,0.12), rgba(59,130,246,0.1))",
              }}
            >
              <Icon className="h-5 w-5 text-[#00E575]" />
            </div>
          </div>

          <p className="mt-5 text-center font-display text-[22px] font-bold leading-snug tracking-tight text-[#F5F7FA] sm:text-2xl">
            {copy.title}
          </p>
          <p className="mx-auto mt-3 max-w-[34ch] text-center text-[13.5px] leading-relaxed text-white/55">
            {copy.body}
          </p>

          <div className="mt-8 flex flex-col gap-2.5">
            {appUrl ? (
              <a
                href={appUrl}
                className="flex h-12 w-full items-center justify-center text-[14px] font-extrabold text-[#041412]"
                style={{ backgroundImage: GRAD }}
              >
                Get the Plazore App
              </a>
            ) : (
              <span
                className="flex h-12 w-full items-center justify-center text-[14px] font-extrabold text-[#041412]"
                style={{ backgroundImage: GRAD }}
              >
                Available in the Plazore App
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-12 w-full border border-white/10 bg-[#11131C] text-[13px] font-semibold text-white/65 hover:text-white"
            >
              Continue on web
            </button>
          </div>

          <p className="mt-5 text-center text-[10px] font-semibold tracking-[0.18em] uppercase text-white/25">
            Digital Mall · App Experience
          </p>
        </div>
      </div>
    </div>
  );
}