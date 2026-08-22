export type HeroSlide = {
  id: string;
  image: string;
  headline: string;
  subheadline: string;
  ctaLabel: string;
};

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "welcome",
    image: "/hero/welcome.jpg",
    headline: "Plazore",
    subheadline: "A quieter way to discover what matters.",
    ctaLabel: "Enter",
  },
  {
    id: "summer",
    image: "/hero/summer-poster.jpg",
    headline: "Summer, gently",
    subheadline: "Pieces that feel like warm light and slow afternoons.",
    ctaLabel: "Browse",
  },
  {
    id: "featured-seller",
    image: "/hero/featured-seller.jpg",
    headline: "Featured Maker",
    subheadline: "Craft meets confidence. A storefront worth lingering in.",
    ctaLabel: "Visit",
  },
  {
    id: "christmas",
    image: "/hero/christmas-poster.jpg",
    headline: "Thoughtful Season",
    subheadline: "Gifts that say something, for the people who mean it.",
    ctaLabel: "Explore",
  },
  {
    id: "new-arrivals",
    image: "/hero/new-arrivals.jpg",
    headline: "Just Arrived",
    subheadline: "New pieces, same calm. Take your time.",
    ctaLabel: "See More",
  },
];