const SESSION_KEY = "plazore_showroom_session";
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export function getShowroomSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `s_${Date.now()}`;
  }
}

export function saveShowroomSessionId(id: string) {
  if (typeof window === "undefined" || !id) return;
  try {
    window.localStorage.setItem(SESSION_KEY, id);
  } catch {
    /* ignore */
  }
}

export async function trackShowroomEvent(opts: {
  productId: string;
  type: "impression" | "open" | "cart" | "wishlist" | "purchase" | "skip";
  room?: number;
  position?: number;
  region?: string;
}) {
  try {
    if (!opts.productId || !opts.type) return;
    const sessionId = getShowroomSessionId();
    await fetch(`${BASE}/products/showroom/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        productId: opts.productId,
        type: opts.type,
        room: opts.room,
        position: opts.position ?? 0,
        region: opts.region || "NG",
      }),
    });
  } catch {
    /* never block UI */
  }
}