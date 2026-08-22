export const TILE_COLORS: Record<
  string,
  { bg: string; accent: string; glow: string }
> = {
  home: { bg: "#0A1C14", accent: "#00E575", glow: "rgba(0,229,117,0.25)" },
  browse: { bg: "#0B1E28", accent: "#22D3EE", glow: "rgba(34,211,238,0.22)" },
  cart: { bg: "#0D172A", accent: "#3B82F6", glow: "rgba(59,130,246,0.28)" },
  wishlist: { bg: "#1A0F14", accent: "#F472B6", glow: "rgba(244,114,182,0.25)" },
  saved_stores: { bg: "#1A160E", accent: "#D4A853", glow: "rgba(212,168,83,0.25)" },
  profile: { bg: "#1A0E2A", accent: "#A78BFA", glow: "rgba(167,139,250,0.25)" },
  music: { bg: "#1E1030", accent: "#C084FC", glow: "rgba(192,132,252,0.28)" },
  categories: { bg: "#0B1E28", accent: "#22D3EE", glow: "rgba(34,211,238,0.22)" },
  new: { bg: "#251A0A", accent: "#FBBF24", glow: "rgba(251,191,36,0.25)" },
  trending: { bg: "#28120A", accent: "#FB923C", glow: "rgba(251,146,60,0.25)" },
  stores: { bg: "#121430", accent: "#6366F1", glow: "rgba(99,102,241,0.25)" },
  help: { bg: "#0D2623", accent: "#2DD4BF", glow: "rgba(45,212,191,0.22)" },
  contact: { bg: "#181230", accent: "#818CF8", glow: "rgba(129,140,248,0.22)" },
  about: { bg: "#0C1C18", accent: "#34D399", glow: "rgba(52,211,153,0.22)" },
  orders: { bg: "#0F1A24", accent: "#60A5FA", glow: "rgba(96,165,250,0.22)" },
};

export type LoungeItem = {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
};

export type LoungeSection = {
  id: string;
  title: string;
  items: LoungeItem[];
};

export const LOUNGE_SECTIONS: LoungeSection[] = [
  {
    id: "floors",
    title: "Main Hubs",
    items: [
      { id: "home", label: "Mall", subtitle: "Home showroom", href: "/" },
      { id: "browse", label: "Browse", subtitle: "Search the mall", href: "/browse" },
      { id: "cart", label: "Cart", subtitle: "Checkout bag", href: "/cart" },
      { id: "wishlist", label: "Wishlist", subtitle: "Saved products", href: "/wishlist" },
    ],
  },
  {
    id: "account",
    title: "Your space",
    items: [
      { id: "profile", label: "Profile", subtitle: "Account & prefs", href: "/profile" },
      { id: "orders", label: "Orders", subtitle: "Track deliveries", href: "/orders" },
      { id: "saved_stores", label: "Saved stores", subtitle: "Followed brands", href: "/saved-stores" },
      { id: "music", label: "Music", subtitle: "Ambient soundtrack", href: "/settings/music" },
    ],
  },
  {
    id: "explore",
    title: "Explore",
    items: [
      { id: "categories", label: "Categories", subtitle: "Shop by type", href: "/browse" },
      { id: "new", label: "New arrivals", subtitle: "Just listed", href: "/browse" },
      { id: "trending", label: "Trending", subtitle: "Popular now", href: "/browse" },
      { id: "stores", label: "Stores", subtitle: "Seller directories", href: "/browse" },
    ],
  },
  {
    id: "support",
    title: "Support",
    items: [
      { id: "help", label: "Help", subtitle: "Guides & FAQs", href: "/about" },
      { id: "contact", label: "Contact", subtitle: "Reach Plazore", href: "/about" },
      { id: "about", label: "About", subtitle: "The digital mall", href: "/about" },
    ],
  },
];