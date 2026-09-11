/**
 * User activity classification (based on lastSeenAt).
 * Thresholds are in hours from "now".
 *
 * Active  → seen within ACTIVE_HOURS
 * Quiet   → after active, within QUIET_HOURS
 * Idle    → after quiet, within IDLE_HOURS
 * Dormant → older than IDLE_HOURS
 * Unknown → no lastSeenAt (and no usable fallback)
 */
export const ACTIVITY_CONFIG = {
  /** Seen within this many hours → Active */
  ACTIVE_HOURS: 24,

  /** After active, up to this many hours → Quiet */
  QUIET_HOURS: 24 * 7, // 7 days

  /** After quiet, up to this many hours → Idle */
  IDLE_HOURS: 24 * 30, // 30 days

  /**
   * If lastSeenAt is missing, optionally use updatedAt as weak signal.
   * Set false to only trust lastSeenAt.
   */
  FALLBACK_TO_UPDATED_AT: true,

  labels: {
    active: "Active",
    quiet: "Quiet",
    idle: "Idle",
    dormant: "Dormant",
    unknown: "Unknown",
  } as const,
} as const;

export type ActivityKey = "active" | "quiet" | "idle" | "dormant" | "unknown";

export type ActivityTone = "green" | "warn" | "neutral" | "error";

export type ActivityState = {
  key: ActivityKey;
  label: string;
  tone: ActivityTone;
  /** Hours since last activity; null if unknown */
  hoursAgo: number | null;
  /** Human relative string e.g. "2h ago", "3d ago" */
  relative: string;
  /** Source field used */
  source: "lastSeenAt" | "updatedAt" | "none";
};

function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 3_600_000;
}

function formatRelative(hours: number): string {
  if (hours < 0) return "just now";
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `${mins}m ago`;
  }
  if (hours < 24) {
    const h = Math.round(hours);
    return `${h}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * Classify a user from last activity timestamp.
 * Prefer lastSeenAt; optionally fall back to updatedAt.
 */
export function getActivityState(opts: {
  lastSeenAt?: string | Date | null;
  updatedAt?: string | Date | null;
  now?: Date;
}): ActivityState {
  const now = opts.now ?? new Date();
  const cfg = ACTIVITY_CONFIG;

  let source: ActivityState["source"] = "none";
  let raw: string | Date | null | undefined = opts.lastSeenAt;

  if (raw) {
    source = "lastSeenAt";
  } else if (cfg.FALLBACK_TO_UPDATED_AT && opts.updatedAt) {
    raw = opts.updatedAt;
    source = "updatedAt";
  }

  if (!raw) {
    return {
      key: "unknown",
      label: cfg.labels.unknown,
      tone: "neutral",
      hoursAgo: null,
      relative: "Never seen",
      source: "none",
    };
  }

  const seen = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(seen.getTime())) {
    return {
      key: "unknown",
      label: cfg.labels.unknown,
      tone: "neutral",
      hoursAgo: null,
      relative: "Invalid date",
      source,
    };
  }

  const hours = hoursBetween(seen, now);
  const relative = formatRelative(hours);

  if (hours < cfg.ACTIVE_HOURS) {
    return {
      key: "active",
      label: cfg.labels.active,
      tone: "green",
      hoursAgo: hours,
      relative,
      source,
    };
  }
  if (hours < cfg.QUIET_HOURS) {
    return {
      key: "quiet",
      label: cfg.labels.quiet,
      tone: "warn",
      hoursAgo: hours,
      relative,
      source,
    };
  }
  if (hours < cfg.IDLE_HOURS) {
    return {
      key: "idle",
      label: cfg.labels.idle,
      tone: "neutral",
      hoursAgo: hours,
      relative,
      source,
    };
  }
  return {
    key: "dormant",
    label: cfg.labels.dormant,
    tone: "error",
    hoursAgo: hours,
    relative,
    source,
  };
}

/** Filter option values that match spot query on the API */
export const ACTIVITY_SPOT_OPTIONS = [
  { value: "", label: "All accounts" },
  { value: "active", label: `Active (${ACTIVITY_CONFIG.ACTIVE_HOURS}h)` },
  { value: "quiet", label: "Quiet (to 7d)" },
  { value: "idle", label: "Idle (to 30d)" },
  { value: "dormant", label: "Dormant (30d+)" },
  { value: "unverified", label: "Unverified sellers" },
  { value: "suspended", label: "Suspended sellers" },
  { value: "new", label: "Joined last 7 days" },
  { value: "no-region", label: "Missing region" },
] as const;