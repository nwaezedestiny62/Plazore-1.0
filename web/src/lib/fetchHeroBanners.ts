/**
 * Fetches the resolved 5-slot hero from the backend.
 * Falls back to static HERO_SLIDES if the API is down / not mounted.
 */

import { HERO_SLIDES, type HeroSlide } from "@/lib/heroCampaigns";
import {
  getShowroomSessionId,
  saveShowroomSessionId,
} from "@/lib/showroomEvents";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export type ApiHeroBanner = {
  position: number;
  controlType?: "system" | "admin";
  isActive?: boolean;
  imageUrl?: string;
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
  ctaAction?: string;
  ctaTarget?: string;
  kicker?: string;
};

function mapBanner(b: ApiHeroBanner, index: number): HeroSlide | null {
  if (b.isActive === false) return null;
  const image = String(b.imageUrl || "").trim();
  const headline = String(b.headline || "").trim();
  if (!image && !headline) return null;

  return {
    id: `slot-${b.position || index + 1}`,
    image: image || HERO_SLIDES[index % HERO_SLIDES.length]?.image || "/hero/welcome.jpg",
    kicker: String(b.kicker || "PLAZORE").toUpperCase(),
    headline: headline || HERO_SLIDES[index % HERO_SLIDES.length]?.headline || "Plazore",
    subheadline:
      String(b.subheadline || "").trim() ||
      HERO_SLIDES[index % HERO_SLIDES.length]?.subheadline ||
      "",
    ctaLabel:
      String(b.ctaLabel || "").trim() ||
      HERO_SLIDES[index % HERO_SLIDES.length]?.ctaLabel ||
      "Explore",
  };
}

export async function fetchHeroBanners(opts?: {
  region?: string;
  token?: string | null;
  forceRefresh?: boolean;
}): Promise<HeroSlide[]> {
  try {
    let sessionId = "";
    try {
      sessionId = getShowroomSessionId() || "";
    } catch {
      sessionId = "";
    }

    const params = new URLSearchParams();
    if (sessionId) params.set("sessionId", sessionId);
    if (opts?.region) params.set("region", opts.region);
    if (opts?.forceRefresh) params.set("forceRefresh", "1");

    // Auth → personalized slots 1 & 4; public still returns admin slots + cold-start
    const path = opts?.token
      ? `/content/hero?${params.toString()}`
      : `/content/hero/public?${params.toString()}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;

    const res = await fetch(`${API}${path}`, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`hero ${res.status}`);

    const json = await res.json();
    const list: ApiHeroBanner[] = Array.isArray(json?.data?.banners)
      ? json.data.banners
      : Array.isArray(json?.banners)
        ? json.banners
        : Array.isArray(json?.data)
          ? json.data
          : [];

    const mapped = list
      .map((b, i) => mapBanner(b, i))
      .filter(Boolean) as HeroSlide[];

    if (mapped.length > 0) return mapped;
  } catch (e) {
    console.warn("[fetchHeroBanners] fallback to static", e);
  }

  return HERO_SLIDES;
}

/** Prefetch images so crossfade never flashes empty */
export function prefetchHeroImages(slides: HeroSlide[]) {
  if (typeof window === "undefined") return;
  slides.forEach((s) => {
    if (!s.image) return;
    const img = new window.Image();
    img.src = s.image;
  });
}