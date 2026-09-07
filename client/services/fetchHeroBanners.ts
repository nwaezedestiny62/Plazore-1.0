import AsyncStorage from "@react-native-async-storage/async-storage";
import { HERO_SLIDES, type HeroSlide } from "@/constants/heroCampaigns";

const BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

type ApiHeroBanner = {
  position: number;
  controlType: "system" | "admin";
  isActive?: boolean;
  imageUrl?: string;
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
  ctaAction?: string;
  ctaTarget?: string;
  kicker?: string;
};

async function sessionId(): Promise<string> {
  const key = "plazore_session_id";
  let id = await AsyncStorage.getItem(key);
  if (!id) {
    id = `app_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    await AsyncStorage.setItem(key, id);
  }
  return id;
}

/** Keep media as remote URI when API returns URL; else fall back to static require */
export function mapApiToMobileSlides(banners: ApiHeroBanner[]): HeroSlide[] {
  const active = (banners || [])
    .filter((b) => b.isActive !== false)
    .sort((a, b) => a.position - b.position);

  if (!active.length) return HERO_SLIDES;

  return active.map((b, i) => {
    const fallback = HERO_SLIDES[i % HERO_SLIDES.length];
    const url = b.imageUrl || "";
    const isRemote =
      url.startsWith("http://") || url.startsWith("https://");

    return {
      id: `slot-${b.position}`,
      media: {
        kind: "image" as const,
        source: isRemote
          ? ({ uri: url } as any)
          : fallback.media.source,
      },
      headline: b.headline || fallback.headline,
      subheadline: b.subheadline || fallback.subheadline,
      ctaLabel: b.ctaLabel || fallback.ctaLabel,
      ctaAction: (b.ctaAction as any) || fallback.ctaAction || "scroll_showroom",
      campaignKey: `slot_${b.position}`,
    };
  });
}

export async function fetchHeroBanners(opts?: {
  token?: string | null;
  region?: string;
  forceRefresh?: boolean;
}): Promise<HeroSlide[]> {
  try {
    const sid = await sessionId();
    const q = new URLSearchParams();
    q.set("sessionId", sid);
    q.set("region", opts?.region || "NG");
    if (opts?.forceRefresh) q.set("forceRefresh", "1");

    const path = opts?.token
      ? `/content/hero?${q}`
      : `/content/hero/public?${q}`;

    const res = await fetch(`${BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
    });
    const json = await res.json();
    if (!res.ok || json?.success === false) throw new Error(json?.message);
    return mapApiToMobileSlides(json.data?.banners || []);
  } catch {
    return HERO_SLIDES;
  }
}