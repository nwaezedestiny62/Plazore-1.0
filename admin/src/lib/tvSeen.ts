const KEY = "plazore.admin.tileSeen.v1";

function read(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, number>;
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

/** Unread = new activity since this screen was last opened. */
export function unreadCount(key: string, current: number): number {
  if (typeof window === "undefined") return 0;
  const last = Number(read()[key] ?? 0);
  return Math.max(0, Number(current || 0) - last);
}

export function markCountSeen(key: string, current: number) {
  if (typeof window === "undefined") return;
  const map = read();
  map[key] = Number(current || 0);
  write(map);
}