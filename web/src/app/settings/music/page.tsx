"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Music } from "lucide-react";
import { AppFeaturePrompt, type AppFeature } from "@/components/app/AppFeaturePrompt";

export default function MusicSettingsPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<AppFeature | null>("music");

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-white/[0.07] bg-[#090B0F]/95 px-2 py-2.5 backdrop-blur sm:px-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">Music</h1>
          <p className="text-[11px] text-[#6B7280]">Ambient soundtrack</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-col items-center px-6 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center border border-white/[0.08] bg-[#11141A]">
          <Music className="h-7 w-7 text-[#C084FC]" />
        </span>
        <h2 className="mt-5 text-lg font-bold">Immersive soundtrack</h2>
        <p className="mt-2 text-sm leading-6 text-[#A7ADB8]">
          Background music and ambient rooms are part of the full Plazore app experience.
        </p>
        <button
          type="button"
          onClick={() => setPrompt("music")}
          className="mt-8 bg-[#F5F7FA] px-6 py-3 text-sm font-extrabold text-[#090B0F]"
        >
          Open on Plazore app
        </button>
      </main>

      <AppFeaturePrompt feature={prompt} onClose={() => setPrompt(null)} />
    </div>
  );
}