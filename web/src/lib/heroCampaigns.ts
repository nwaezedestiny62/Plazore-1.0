export type HeroSlide = {
  id: string;
  image: string;
  kicker: string;
  headline: string;
  subheadline: string;
  ctaLabel: string;
};

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "welcome",
    image: "/hero/welcome.jpg",
    kicker: "PLAZORE",
    headline: "Discover with intention",
    subheadline: "A quieter digital mall — curated pieces, trusted sellers, no noise.",
    ctaLabel: "Enter the mall",
  },
  {
    id: "summer",
    image: "/hero/summer-poster.jpg",
    kicker: "SEASON",
    headline: "Light, considered",
    subheadline: "Warm tones and calm silhouettes for unhurried days.",
    ctaLabel: "Browse the edit",
  },
  {
    id: "featured-seller",
    image: "/hero/featured-seller.jpg",
    kicker: "MAKERS",
    headline: "Stores worth lingering in",
    subheadline: "Independent storefronts built with care — open them, stay a while.",
    ctaLabel: "Visit makers",
  },
  {
    id: "christmas",
    image: "/hero/christmas-poster.jpg",
    kicker: "GIFTS",
    headline: "Chosen, not rushed",
    subheadline: "Thoughtful pieces for the people who matter.",
    ctaLabel: "Explore gifts",
  },
  {
    id: "new-arrivals",
    image: "/hero/new-arrivals.jpg",
    kicker: "ARRIVALS",
    headline: "Just placed",
    subheadline: "New work on the floor. Same calm pace.",
    ctaLabel: "See what's new",
  },
];