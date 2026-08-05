import { ImageSourcePropType } from 'react-native'

export type HeroMedia = {
  kind: 'image'
  source: ImageSourcePropType
}

export type HeroSlide = {
  id: string
  media: HeroMedia
  headline: string
  subheadline: string
  ctaLabel: string
  ctaAction?: 'scroll_showroom' | 'campaign' | 'storefront' | string
  campaignKey?: string
  regionCodes?: string[]
  season?: string
}

/**
 * Plazore Hero Campaigns — "Calm Signage" Edition
 *
 * Copy has been rewritten for a psychologically soothing tone.
 * Each slide speaks softly — no urgency, no loud CTAs.
 * The language is quiet, inviting, and premium.
 * Think: a curated gallery wall, not a billboard.
 *
 * Image recommendations (for the actual files):
 *  - welcome.jpg          → Dark moody editorial photo, soft bokeh, warm tones
 *  - summer-poster.jpg    → Sun-dappled still life, linen textures, golden hour
 *  - featured-seller.jpg  → Minimal product flat-lay, muted palette, shallow DOF
 *  - christmas-poster.jpg → Warm candlelight, gift textures, deep shadows
 *  - new-arrivals.jpg     → Clean shelf or rack, soft lighting, neutral tones
 */
export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'welcome',
    campaignKey: 'entrance_welcome',
    media: {
      kind: 'image',
      source: require('../assets/hero/welcome.jpg'),
    },
    headline: 'Plazore',
    subheadline:
      'A quieter way to discover what matters.',
    ctaLabel: 'Enter',
    ctaAction: 'scroll_showroom',
  },
  {
    id: 'summer',
    campaignKey: 'campaign_summer',
    season: 'summer',
    media: {
      kind: 'image',
      source: require('../assets/hero/summer-poster.jpg'),
    },
    headline: 'Summer, gently',
    subheadline:
      'Pieces that feel like warm light and slow afternoons.',
    ctaLabel: 'Browse',
    ctaAction: 'scroll_showroom',
  },
  {
    id: 'featured-seller',
    campaignKey: 'featured_seller',
    media: {
      kind: 'image',
      source: require('../assets/hero/featured-seller.jpg'),
    },
    headline: 'Featured Maker',
    subheadline:
      'Craft meets confidence. A storefront worth lingering in.',
    ctaLabel: 'Visit',
    ctaAction: 'storefront',
  },
  {
    id: 'christmas',
    campaignKey: 'campaign_christmas',
    season: 'winter',
    media: {
      kind: 'image',
      source: require('../assets/hero/christmas-poster.jpg'),
    },
    headline: 'Thoughtful Season',
    subheadline:
      'Gifts that say something, for the people who mean it.',
    ctaLabel: 'Explore',
    ctaAction: 'scroll_showroom',
  },
  {
    id: 'new-arrivals',
    campaignKey: 'entrance_new_arrivals',
    media: {
      kind: 'image',
      source: require('../assets/hero/new-arrivals.jpg'),
    },
    headline: 'Just Arrived',
    subheadline:
      'New pieces, same calm. Take your time.',
    ctaLabel: 'See More',
    ctaAction: 'scroll_showroom',
  },
]

export function resolveHeroSlides(
  slides: HeroSlide[] = HERO_SLIDES
): HeroSlide[] {
  return slides.filter((s) => s && s.id && s.media)
}
