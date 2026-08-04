import { ImageSourcePropType } from 'react-native'

export type HeroMedia =
  | {
      kind: 'image'
      source: ImageSourcePropType
    }
  | {
      kind: 'video'
      source: number | { uri: string }
      poster?: ImageSourcePropType
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
 * Local files: client/assets/hero/
 * Paths are relative from client/constants/ (no @ alias)
 */
export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'welcome',
    campaignKey: 'entrance_welcome',
    media: {
      kind: 'image',
      source: require('../assets/hero/welcome.jpg'),
    },
    headline: 'Welcome to Plazore',
    subheadline:
      'Discover products through a calmer, more personal shopping experience.',
    ctaLabel: 'Start Exploring',
    ctaAction: 'scroll_showroom',
  },
  {
    id: 'summer',
    campaignKey: 'campaign_summer',
    season: 'summer',
    media: {
      kind: 'video',
      source: require('../assets/hero/summer.mp4'),
      poster: require('../assets/hero/summer-poster.jpg'),
    },
    headline: 'Summer Collection',
    subheadline:
      'Light layers, warm tones, and pieces made for slower afternoons.',
    ctaLabel: 'Explore Summer',
    ctaAction: 'scroll_showroom',
  },
  {
    id: 'featured-seller',
    campaignKey: 'featured_seller',
    media: {
      kind: 'image',
      source: require('../assets/hero/featured-seller.jpg'),
    },
    headline: 'Featured Seller',
    subheadline:
      'Step into a carefully built storefront — craft, detail, and quiet confidence.',
    ctaLabel: 'Visit Store',
    ctaAction: 'storefront',
  },
  {
    id: 'christmas',
    campaignKey: 'campaign_christmas',
    season: 'winter',
    media: {
      kind: 'video',
      source: require('../assets/hero/christmas-poster.jpg'),
      poster: require('../assets/hero/christmas-poster.jpg'),
    },
    headline: 'Christmas Campaign',
    subheadline:
      'Thoughtful gifts and warm finds for the season of gathering.',
    ctaLabel: 'Discover Gifts',
    ctaAction: 'scroll_showroom',
  },
  {
    id: 'new-arrivals',
    campaignKey: 'entrance_new_arrivals',
    media: {
      kind: 'image',
      source: require('../assets/hero/new-arrivals.jpg'),
    },
    headline: 'New Arrivals',
    subheadline:
      'Fresh pieces just entered the showroom — take a quiet look around.',
    ctaLabel: 'See What’s New',
    ctaAction: 'scroll_showroom',
  },
]

export function resolveHeroSlides(
  slides: HeroSlide[] = HERO_SLIDES
): HeroSlide[] {
  return slides.filter((s) => s && s.id && s.media)
}