export type TileKind = "image" | "logo";

export type TvTile = {
  href: string;
  label: string;
  kicker: string;
  kind: TileKind;
  image: string;
  countKey?: string;
};

export type TvRow = { id: string; title: string; tiles: TvTile[] };

export type QuoteSlide = {
  image: string;
  kicker: string;
  title: string;
  body: string;
};

export const TV_ROOM_BG =
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2400&q=80";

/** 7 cinematic slides — commerce, discovery, Plazore */
export const TV_QUOTE_SLIDES: QuoteSlide[] = [
  {
    image:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=2000&q=80",
    kicker: "CONTROL",
    title: "The future of commerce is quiet, exact, and already here.",
    body: "Plazore · Discovery-led systems",
  },
  {
    image:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=2000&q=80",
    kicker: "DISCOVERY",
    title: "A mall that thinks before it shouts.",
    body: "Signal over noise. Surface only what matters.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=2000&q=80",
    kicker: "PRECISION",
    title: "Every rate, route, and receipt should feel inevitable.",
    body: "Operations without theatre.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2000&q=80",
    kicker: "SCALE",
    title: "Build for 2040. Ship what works today.",
    body: "Infrastructure is the product.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=2000&q=80",
    kicker: "INTELLIGENCE",
    title: "Data is not decoration. It is direction.",
    body: "See the system. Then improve it.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=2000&q=80",
    kicker: "TRUST",
    title: "Commerce earns trust the same way it earns revenue: repeatedly.",
    body: "Safety is a feature, not a footnote.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=2000&q=80",
    kicker: "PLAZORE",
    title: "Do commerce like it is 2040.",
    body: "The control centre for discovery-led trade.",
  },
];

export const TV_ROWS: TvRow[] = [
  {
    id: "marketplace",
    title: "Marketplace",
    tiles: [
      {
        href: "/users",
        label: "People",
        kicker: "Users & sellers",
        kind: "image",
        image:
          "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80",
        countKey: "usersNew",
      },
      {
        href: "/products",
        label: "Catalog",
        kicker: "Live listings",
        kind: "image",
        image:
          "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=900&q=80",
        countKey: "productsNew",
      },
      {
        href: "/orders",
        label: "Orders",
        kicker: "Fulfilment",
        kind: "image",
        image:
          "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=900&q=80",
        countKey: "ordersActive",
      },
      {
        href: "/showroom",
        label: "Showroom",
        kicker: "Discovery",
        kind: "image",
        image:
          "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80",
      },
      {
        href: "/currency",
        label: "Rates",
        kicker: "Currency",
        kind: "image",
        // Reliable finance visual (no broken CDN path)
        image:
          "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=900&q=80",
        countKey: undefined,
      },
    ],
  },
  {
    id: "trust",
    title: "Trust & safety",
    tiles: [
      {
        href: "/moderation",
        label: "Moderation",
        kicker: "Review queue",
        kind: "logo",
        image: "/moderation-logo.png",
        countKey: "moderationOpen",
      },
      {
        href: "/reports",
        label: "Reports",
        kicker: "Trust signals",
        kind: "image",
        image:
          "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=80",
        countKey: "reportsNew",
      },
      {
        href: "/contact",
        label: "Inbox",
        kicker: "Contact",
        kind: "image",
        image:
          "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?auto=format&fit=crop&w=900&q=80",
        countKey: "contactsNew",
      },
    ],
  },
  {
    id: "intelligence",
    title: "Intelligence",
    tiles: [
      {
        href: "/intelligence",
        label: "Insights",
        kicker: "Product intelligence",
        kind: "image",
        image:
          "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80",
      },
      {
        href: "/analytics",
        label: "Analytics",
        kicker: "Performance",
        kind: "image",
        image:
          "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80",
      },
      {
        href: "/performance",
        label: "Health",
        kicker: "Runtime",
        kind: "image",
        image:
          "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
  {
    id: "monetization",
    title: "Monetization",
    tiles: [
      {
        href: "/monetization/payments",
        label: "Payments",
        kicker: "Settlement",
        kind: "image",
        image:
          "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=900&q=80",
      },
      {
        href: "/monetization/subscriptions",
        label: "Subscriptions",
        kicker: "On-platform",
        kind: "image",
        image:
          "https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&w=900&q=80",
      },
      {
        href: "/monetization/transmission",
        label: "Transmission",
        kicker: "Platform fee",
        kind: "image",
        image:
          "https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
  {
    id: "platform",
    title: "Platform",
    tiles: [
      {
        href: "/content",
        label: "Content",
        kicker: "Editorial",
        kind: "image",
        image:
          "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=900&q=80",
      },
      {
        href: "/announcements",
        label: "Announcements",
        kicker: "Broadcast",
        kind: "image",
        image:
          "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
];

export type ActivityCounts = {
  usersNew: number;
  productsNew: number;
  ordersActive: number;
  reportsNew: number;
  contactsNew: number;
  moderationOpen: number;
};

export function countsFromStats(data: any): ActivityCounts {
  const s = data ?? {};
  return {
    usersNew: Number(s.users?.new7d ?? 0),
    productsNew: Number(s.products?.new7d ?? 0),
    ordersActive:
      Number(s.orders?.preparing ?? 0) + Number(s.orders?.shipped ?? 0),
    reportsNew: Number(s.support?.reportsNew ?? 0),
    contactsNew: Number(s.support?.contactNew ?? 0),
    moderationOpen: Number(s.support?.reportsUnresolved ?? 0),
  };
}

export function countKeyForPath(pathname: string): string | null {
  for (const row of TV_ROWS) {
    for (const t of row.tiles) {
      if (
        t.countKey &&
        (pathname === t.href || pathname.startsWith(t.href + "/"))
      ) {
        return t.countKey;
      }
    }
  }
  return null;
}