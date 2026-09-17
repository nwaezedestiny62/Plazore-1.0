/**
 * Activity from real platform actions — not browser presence.
 * Prefer lastActivityAt from API (orders, cart, listings, showroom events).
 */
export const ACTIVITY_CONFIG = {
  ACTIVE_HOURS: 24,
  QUIET_HOURS: 24 * 7,
  IDLE_HOURS: 24 * 30,
  /** Never treat lastSeenAt as commerce activity */
  USE_PRESENCE_FALLBACK: false,
  labels: {
    active: "Active",
    quiet: "Quiet",
    idle: "Idle",
    dormant: "Dormant",
    unknown: "No activity",
  } as const,
} as const;

export type ActivityKey = "active" | "quiet" | "idle" | "dormant" | "unknown";
export type ActivityTone = "green" | "warn" | "neutral" | "error";

export type ActivityState = {
  key: ActivityKey;
  label: string;
  tone: ActivityTone;
  hoursAgo: number | null;
  relative: string;
  source: "lastActivityAt" | "none";
  kind?: string | null;
};

export const ACTIVITY_SPOT_OPTIONS = [
  { value: "", label: "All activity" },
  { value: "active", label: "Active (24h)" },
  { value: "quiet", label: "Quiet (7d)" },
  { value: "idle", label: "Idle (30d)" },
  { value: "dormant", label: "Dormant (30d+)" },
  { value: "new", label: "Joined 7d" },
  { value: "unverified", label: "Sellers unverified" },
  { value: "suspended", label: "Suspended sellers" },
  { value: "no-region", label: "No marketplace region" },
] as const;

function hoursBetween(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / 3_600_000;
}

function formatRelative(hours: number): string {
  if (hours < 0) return "just now";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function getActivityState(opts: {
  lastActivityAt?: string | Date | null;
  lastActivityKind?: string | null;
  now?: Date;
}): ActivityState {
  const now = opts.now ?? new Date();
  const cfg = ACTIVITY_CONFIG;
  const raw = opts.lastActivityAt;

  if (!raw) {
    return {
      key: "unknown",
      label: cfg.labels.unknown,
      tone: "neutral",
      hoursAgo: null,
      relative: "—",
      source: "none",
      kind: null,
    };
  }

  const t = new Date(raw);
  if (Number.isNaN(t.getTime())) {
    return {
      key: "unknown",
      label: cfg.labels.unknown,
      tone: "neutral",
      hoursAgo: null,
      relative: "—",
      source: "none",
      kind: null,
    };
  }

  const hours = hoursBetween(t, now);
  let key: ActivityKey = "dormant";
  if (hours < cfg.ACTIVE_HOURS) key = "active";
  else if (hours < cfg.QUIET_HOURS) key = "quiet";
  else if (hours < cfg.IDLE_HOURS) key = "idle";

  const tone: ActivityTone =
    key === "active"
      ? "green"
      : key === "quiet"
        ? "warn"
        : key === "idle"
          ? "neutral"
          : "error";

  return {
    key,
    label: cfg.labels[key],
    tone,
    hoursAgo: hours,
    relative: formatRelative(hours),
    source: "lastActivityAt",
    kind: opts.lastActivityKind || null,
  };
}