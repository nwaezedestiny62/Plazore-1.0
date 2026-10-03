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
 * Plazore Hero Campaigns — "The Digital Mall" Edition
 *
 * Each campaign introduces a different part of the Plazore experience:
 * discovery, products, sellers, seasons, and what is happening across the mall.
 *
 * The language should feel:
 * - futuristic, but human
 * - premium, but accessible
 * - confident, but never desperate
 * - discovery-led rather than sales-heavy
 *
 * Think: walking into a remarkable mall and seeing something worth exploring,
 * not being shouted at by an advertisement.
 *
 * Image recommendations:
 * - welcome.jpg          → Futuristic digital-mall atmosphere, premium and immersive
 * - summer-poster.jpg    → Seasonal products with bright, natural summer energy
 * - featured-seller.jpg → Strong storefront/product presentation with a premium feel
 * - christmas-poster.jpg → Rich seasonal shopping atmosphere, warm but modern
 * - new-arrivals.jpg    → Fresh products presented like a curated new section
 */

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'welcome',
    campaignKey: 'entrance_welcome',
    media: {
      kind: 'image',
      source: require('../assets/hero/welcome.jpg'),
    },
    headline: 'Commerce, Reimagined.',
    subheadline:
      'Discover products, explore sellers, and experience a new way to shop.',
    ctaLabel: 'Enter Showroom',
    ctaAction: 'scroll_showroom',
  },

  {
    id: 'discover',
    campaignKey: 'showroom_discovery',
    media: {
      kind: 'image',
      source: require('../assets/hero/summer-poster.jpg'),
    },
    headline: 'Don’t Just Search. Discover.',
    subheadline:
      'Explore products worth seeing, even before you know what you’re looking for.',
    ctaLabel: 'Explore',
    ctaAction: 'scroll_showroom',
  },

  {
    id: 'featured-seller',
    campaignKey: 'featured_seller',
    media: {
      kind: 'image',
      source: require('../assets/hero/featured-seller.jpg'),
    },
    headline: 'Meet the Businesses Behind the Products.',
    subheadline:
      'Explore stores, discover what they offer, and shop directly through Plazore.',
    ctaLabel: 'Visit Store',
    ctaAction: 'storefront',
  },

  {
    id: 'commerce',
    campaignKey: 'commerce_evolved',
    media: {
      kind: 'image',
      source: require('../assets/hero/christmas-poster.jpg'),
    },
    headline: 'More Than a Marketplace.',
    subheadline:
      'A digital mall built around discovery, intelligent commerce, and confident buying.',
    ctaLabel: 'Explore Plazore',
    ctaAction: 'scroll_showroom',
  },

  {
    id: 'new-arrivals',
    campaignKey: 'new_arrivals',
    media: {
      kind: 'image',
      source: require('../assets/hero/new-arrivals.jpg'),
    },
    headline: 'There’s Always More to Discover.',
    subheadline:
      'New products, new businesses, and new reasons to keep exploring.',
    ctaLabel: 'See What’s New',
    ctaAction: 'scroll_showroom',
  },
]

export function resolveHeroSlides(
  slides: HeroSlide[] = HERO_SLIDES
): HeroSlide[] {
  return slides.filter((s) => s && s.id && s.media)
}