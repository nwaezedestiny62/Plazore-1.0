const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

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
  try {
    const json = await apiGet<{
      success: boolean;
      data?: { products?: import("./types").Product[] };
    }>(`/ai/search-suggest?q=${encodeURIComponent(q)}`);
    return Array.isArray(json.data?.products) ? json.data.products : [];
  } catch {
    return [];
  }
}

export async function fetchProduct(id: string) {
  try {
    const json = await apiGet<{ success: boolean; data: import("./types").Product }>(
      `/products/${id}`
    );
    return json.data || null;
  } catch {
    return null;
  }
}

export async function fetchProductAI(id: string) {
  try {
    const json = await apiGet<{ success: boolean; data: import("./plazoreAI").PlazoreAIData }>(
      `/ai/product/${id}`
    );
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

export async function fetchMallProducts() {
  try {
    const json = await apiGet<ProductsResponse>("/products?limit=140");
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