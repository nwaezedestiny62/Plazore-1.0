const KEY = "plazore.admin.tileSeen.v1";
const LATEST_AT = "plazore.admin.latestSeenAt.v1";

function read(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<
      string,
      number
    >;
  } catch {
    return {};
  }
}

function write(map: Record<string, number>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/**
 * Unread badge = how much the metric has grown since this tile/screen
 * was last opened.
 */
export function unreadCount(key: string, current: number): number {
  if (typeof window === "undefined") return 0;
  if (!key) return 0;
  const n = Number(current);
  if (!Number.isFinite(n) || n <= 0) return 0;

  const map = read();
  if (!(key in map)) return Math.floor(n);

  const last = Number(map[key]);
  if (!Number.isFinite(last)) return Math.floor(n);
  return Math.max(0, Math.floor(n - last));
}

export function markCountSeen(key: string, current: number) {
  if (typeof window === "undefined") return;
  if (!key) return;
  const n = Number(current);
  if (!Number.isFinite(n)) return;
  const map = read();
  map[key] = Math.max(0, Math.floor(n));
  write(map);
}

export function clearCountSeen(key: string) {
  if (typeof window === "undefined") return;
  const map = read();
  delete map[key];
  write(map);
}

export function readLatestSeenAt(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(LATEST_AT);
  if (!raw) return 0;
  const n = Date.parse(raw);
  return Number.isFinite(n) ? n : 0;
}

export function markLatestSeenNow(iso?: string | null) {
  if (typeof window === "undefined") return;
  const parsed = iso ? Date.parse(iso) : NaN;
  const stamp = Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : new Date().toISOString();
  try {
    localStorage.setItem(LATEST_AT, stamp);
  } catch {
    /* ignore */
  }
}

export function countUncheckedLatest(
  items: Array<{ at?: string; id?: string }>,
  seenAtMs: number,
): number {
  const seen = new Set<string>();
  let n = 0;
  for (const ev of items || []) {
    const id = String(ev?.id || "");
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    const t = Date.parse(String(ev?.at || ""));
    if (!Number.isFinite(t)) continue;
    if (!seenAtMs || t > seenAtMs) n += 1;
  }
  return n;
}