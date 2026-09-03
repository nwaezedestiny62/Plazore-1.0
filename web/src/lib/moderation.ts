const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export type ModContext = "buyer" | "seller";

export type ModSide = {
  status: string;
  reason?: string;
  publicReason?: string;
  startedAt?: string | null;
  endsAt?: string | null;
  caseId?: string | null;
  lastOutcome?: "PARDONED" | "RESTORED" | null;
};

export type MyModeration = {
  buyer: ModSide;
  seller: ModSide;
};

const BLOCKED = new Set([
  "SUSPENDED",
  "BLOCKED",
  "ACTIVITY_CHECK",
  "UNDER_REVIEW",
]);

export function isContextBlocked(status?: string) {
  return BLOCKED.has(String(status || "NORMAL"));
}

export function resolveScreenKind(
  side: ModSide | null | undefined
): "review" | "suspended" | "blocked" | "pardoned" | "restored" | "clear" {
  if (!side) return "clear";
  if (side.lastOutcome === "PARDONED") return "pardoned";
  if (side.lastOutcome === "RESTORED") return "restored";
  const s = String(side.status || "NORMAL");
  if (s === "UNDER_REVIEW" || s === "ACTIVITY_CHECK") return "review";
  if (s === "SUSPENDED") return "suspended";
  if (s === "BLOCKED") return "blocked";
  return "clear";
}

export async function fetchMyModeration(
  token: string
): Promise<MyModeration | null> {
  try {
    const res = await fetch(`${BASE}/moderation/me`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok || json?.success === false) return null;
    return json.data as MyModeration;
  } catch {
    return null;
  }
}

export async function clearLastOutcome(token: string, context: ModContext) {
  try {
    await fetch(`${BASE}/moderation/me/clear-outcome`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ context }),
      cache: "no-store",
    });
  } catch {
    /* ignore */
  }
}

export const MOD_ART: Record<string, string> = {
  review: "/moderation/moderation-review.png",
  pardoned: "/moderation/moderation-pardoned.png",
  suspended: "/moderation/moderation-suspended.png",
  blocked: "/moderation/moderation-blocked.png",
  restored: "/moderation/moderation-restored.png",
};