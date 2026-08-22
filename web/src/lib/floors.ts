export const FLOORS: {
  id: string;
  short: string;
  hint: string;
  match: string[];
  images: [string, string, string];
}[] = [
  {
    id: "Fashion",
    short: "Fashion",
    hint: "Clothing, shoes, bags",
    match: ["Fashion", "Luxury Goods"],
    images: [
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&q=80",
      "https://images.unsplash.com/photo-1445205170230-053b83016050?w=500&q=80",
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=500&q=80",
    ],
  },
  {
    id: "Tech",
    short: "Tech",
    hint: "Phones, computers, gadgets",
    match: ["Electronics", "Phones & Accessories", "Computers"],
    images: [
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=500&q=80",
      "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500&q=80",
      "https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=500&q=80",
    ],
  },
  {
    id: "Beauty",
    short: "Beauty",
    hint: "Skincare, makeup, fragrance",
    match: ["Beauty & Personal Care"],
    images: [
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&q=80",
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&q=80",
      "https://images.unsplash.com/photo-1571781926291-c77df8097c1f?w=500&q=80",
    ],
  },
  {
    id: "Home",
    short: "Home",
    hint: "Living, furniture, kitchen",
    match: ["Home & Living", "Furniture", "Kitchen & Dining"],
    images: [
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=500&q=80",
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&q=80",
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=500&q=80",
    ],
  },
  {
    id: "Sport",
    short: "Sport",
    hint: "Fitness, outdoor, cycling",
    match: ["Sports & Outdoors"],
    images: [
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500&q=80",
      "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?w=500&q=80",
      "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500&q=80",
    ],
  },
  {
    id: "Jewelry",
    short: "Jewelry",
    hint: "Jewelry & watches",
    match: ["Jewelry & Watches"],
    images: [
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&q=80",
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=500&q=80",
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500&q=80",
    ],
  },
  {
    id: "Health",
    short: "Health",
    hint: "Wellness & medical",
    match: ["Health"],
    images: [
      "https://images.unsplash.com/photo-1505751172876-fa206803aee1?w=500&q=80",
      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=500&q=80",
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&q=80",
    ],
  },
  {
    id: "Kids",
    short: "Kids",
    hint: "Toys, baby, play",
    match: ["Toys & Games", "Baby Products"],
    images: [
      "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=500&q=80",
      "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=500&q=80",
      "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=500&q=80",
    ],
  },
  {
    id: "Pets",
    short: "Pets",
    hint: "Pet supplies",
    match: ["Pet Supplies"],
    images: [
      "https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=500&q=80",
      "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500&q=80",
      "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=500&q=80",
    ],
  },
  {
    id: "Auto",
    short: "Auto",
    hint: "Parts & tools",
    match: ["Automotive"],
    images: [
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=500&q=80",
      "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=500&q=80",
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=500&q=80",
    ],
  },
  {
    id: "Food",
    short: "Food",
    hint: "Groceries & pantry",
    match: ["Groceries"],
    images: [
      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&q=80",
      "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=500&q=80",
      "https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&q=80",
    ],
  },
  {
    id: "Work",
    short: "Work",
    hint: "Office, books, craft",
    match: ["Books", "Office Supplies", "Art & Crafts", "Musical Instruments"],
    images: [
      "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=500&q=80",
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&q=80",
      "https://images.unsplash.com/photo-14565130808af5207b36797abb?w=500&q=80",
    ],
  },
  {
    id: "Build",
    short: "Build",
    hint: "Tools, industrial, farm",
    match: ["Industrial Equipment", "Agriculture", "Building Materials"],
    images: [
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=500&q=80",
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=500&q=80",
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=500&q=80",
    ],
  },
  {
    id: "Collect",
    short: "Collect",
    hint: "Collectibles & more",
    match: ["Collectibles", "Others"],
    images: [
      "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500&q=80",
      "https://images.unsplash.com/photo-1607083206869-4c797ed044a?w=500&q=80",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80",
    ],
  },
];

export const CATEGORY_TO_FLOOR: Record<string, string> = {};
FLOORS.forEach((f) => {
  f.match.forEach((c) => {
    CATEGORY_TO_FLOOR[c.toLowerCase()] = f.id;
  });
});