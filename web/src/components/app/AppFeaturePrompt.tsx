"use client";

import { Heart, Bookmark, Music, Sparkles } from "lucide-react";

export type AppFeature = "wishlist" | "saved_store" | "music" | "ai_deeper";

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

export function AppFeaturePrompt({
  feature,
  onClose,
}: {
  feature: AppFeature | null;
  onClose: () => void;
}) {
  if (!feature) return null;
  const copy = COPY[feature];
  const Icon = copy.icon;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-4 md:items-center">
      <button className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-md border border-line bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-8">
        <div className="flex h-11 w-11 items-center justify-center border border-ai-green/25 bg-ai-green/10">
          <Icon className="h-5 w-5 text-ai-green" />
        </div>
        <p className="mt-5 font-display text-2xl tracking-tight">{copy.title}</p>
        <p className="mt-3 text-sm leading-relaxed text-secondary">{copy.body}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {appUrl ? (
            <a
              href={appUrl}
              className="flex h-12 flex-1 items-center justify-center bg-text text-sm font-extrabold text-bg"
            >
              Get the Plazore App
            </a>
          ) : (
            <span className="flex h-12 flex-1 items-center justify-center bg-text text-sm font-extrabold text-bg">
              Available in the Plazore App
            </span>
          )}
          <button
            onClick={onClose}
            className="h-12 flex-1 border border-line bg-surface-2 text-sm font-semibold text-secondary"
          >
            Continue on web
          </button>
        </div>
      </div>
    </div>
  );
}