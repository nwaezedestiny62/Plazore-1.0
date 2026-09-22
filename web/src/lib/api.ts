const BASE = process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com/api";

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || "Request failed");
  }
  return json as T;
}

export type ProductsResponse = {
  success: boolean;
  data: import("./types").Product[];
};

export async function searchSuggest(q: string) {
  return fetchMallProducts({ q, limit: 48, sort: "relevance" });
}

export async function fetchProduct(id: string) {
  try {
    const json = await apiGet<{
      success: boolean;
      data: import("./types").Product;
    }>(`/products/${id}`);
    return json.data || null;
  } catch {
    return null;
  }
}

export async function fetchProductAI(id: string) {
  try {
    const json = await apiGet<{
      success: boolean;
      data: import("./plazoreAI").PlazoreAIData;
    }>(`/ai/product/${id}`);
    return json.data || null;
  } catch {
    return null;
  }
}

export type StorePublic = {
  id?: string;
  _id?: string;
  storeName: string;
  storeDescription: string;
  businessGoal: string;
  storeLogo: string;
  storeBanner: string;
  isVerified?: boolean;
  location?: { state?: string; country?: string };
};

export async function fetchStore(id: string) {
  try {
    const json = await apiGet<{
      success: boolean;
      data: { store: StorePublic; products: import("./types").Product[] };
    }>(`/seller/store/${id}`);
    return {
      store: json.data?.store || null,
      products: json.data?.products || [],
    };
  } catch {
    return { store: null, products: [] };
  }
}

export type ShowroomRooms = {
  1: import("./types").Product[];
  2: import("./types").Product[];
  3: import("./types").Product[];
  4: import("./types").Product[];
};

export type ShowroomResponse = {
  success: boolean;
  sessionId?: string;
  data?: import("./types").Product[];
  rooms?: {
    1?: import("./types").Product[];
    2?: import("./types").Product[];
    3?: import("./types").Product[];
    4?: import("./types").Product[];
  };
};

export async function fetchMallProducts(opts?: {
  q?: string;
  category?: string;
  subCategory?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: boolean;
  region?: string;
  limit?: number;
  page?: number;
}) {
  try {
    const qs = new URLSearchParams();
    qs.set("limit", String(opts?.limit ?? 48));
    qs.set("page", String(opts?.page ?? 1));
    if (opts?.region) qs.set("region", opts.region);
    if (opts?.q) qs.set("q", opts.q);
    if (opts?.category) qs.set("category", opts.category);
    if (opts?.subCategory) qs.set("subCategory", opts.subCategory);
    if (opts?.sort) qs.set("sort", opts.sort);
    if (opts?.minPrice) qs.set("minPrice", opts.minPrice);
    if (opts?.maxPrice) qs.set("maxPrice", opts.maxPrice);
    if (opts?.inStock) qs.set("inStock", "true");

    const json = await apiGet<ProductsResponse>(`/products?${qs.toString()}`);
    return json.data || [];
  } catch {
    return [];
  }
}

export async function fetchShowroom(opts?: {
  region?: string;
  sessionId?: string;
}) {
  const params = new URLSearchParams();
  if (opts?.region) params.set("region", opts.region);
  if (opts?.sessionId) params.set("sessionId", opts.sessionId);
  const qs = params.toString();

  try {
    const json = await apiGet<ShowroomResponse>(
      `/products/showroom${qs ? `?${qs}` : ""}`
    );

    const rooms: ShowroomRooms = {
      1: json.rooms?.[1] || [],
      2: json.rooms?.[2] || [],
      3: json.rooms?.[3] || [],
      4: json.rooms?.[4] || [],
    };

    const products =
      Array.isArray(json.data) && json.data.length
        ? json.data
        : [...rooms[1], ...rooms[2], ...rooms[3], ...rooms[4]];

    return {
      products,
      rooms,
      sessionId: json.sessionId || "",
    };
  } catch {
    const products = await fetchMallProducts();
    return { products, rooms: null as ShowroomRooms | null, sessionId: "" };
  }
}

/** Public announcements (no auth) */
export type PublicAnnouncement = {
  _id: string;
  headline?: string;
  body?: string;
  mediaType?: "none" | "image" | "video";
  mediaUrl?: string;
  mediaPosterUrl?: string;
  audience?: string;
  actionLabel?: string;
  actionRoute?: string;
  design?: import("@/components/AnnouncementCard").AnnouncementDesign;
  publishedAt?: string;
};

export async function fetchPublicAnnouncements(opts?: {
  limit?: number;
  audience?: "all" | "buyers" | "sellers";
}): Promise<PublicAnnouncement[]> {
  try {
    const q = new URLSearchParams();
    if (opts?.limit) q.set("limit", String(opts.limit));
    if (opts?.audience) q.set("audience", opts.audience);
    const path = q.toString() ? `/announcements?${q}` : "/announcements";
    const json = await apiGet<{ success: boolean; data: PublicAnnouncement[] }>(
      path
    );
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

/** Optional detail route — returns null if not implemented on server */
export async function fetchAnnouncementById(
  id: string
): Promise<PublicAnnouncement | null> {
  try {
    const json = await apiGet<{ success: boolean; data: PublicAnnouncement }>(
      `/announcements/${id}`
    );
    return json.data || null;
  } catch {
    return null;
  }
}