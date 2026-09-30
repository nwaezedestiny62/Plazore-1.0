const KEY = "plazore.admin.tileSeen.v1";

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
 *
 * - First visit (no baseline): show full current count
 * - After markCountSeen(key, baseline): badge stays 0 until current > baseline
 * - Never returns a negative
 */
export function unreadCount(key: string, current: number): number {
  if (typeof window === "undefined") return 0;
  if (!key) return 0;
  const n = Number(current);
  if (!Number.isFinite(n) || n <= 0) return 0;

  const map = read();
  if (!(key in map)) {
    // Never opened this tile yet → show the live total as a notification
    return Math.floor(n);
  }

  const last = Number(map[key]);
  if (!Number.isFinite(last)) return Math.floor(n);
  return Math.max(0, Math.floor(n - last));
}

/**
 * Lock the baseline for a count key to `current`.
 * Call when the related screen is entered (or tile is opened).
 * Do NOT call with a fake 0 when stats are missing — that resets the badge loop.
 */
export function markCountSeen(key: string, current: number) {
  if (typeof window === "undefined") return;
  if (!key) return;
  const n = Number(current);
  if (!Number.isFinite(n)) return;
  const map = read();
  map[key] = Math.max(0, Math.floor(n));
  write(map);
}

/** Optional: clear one key (debug). */
export function clearCountSeen(key: string) {
  if (typeof window === "undefined") return;
  const map = read();
  delete map[key];
  write(map);
}
