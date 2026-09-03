import api from "@/constants/api";

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

export async function fetchMyModeration(
  token: string
): Promise<MyModeration | null> {
  try {
    const res = await api.get("/moderation/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.data?.success) return res.data.data as MyModeration;
    return null;
  } catch {
    return null;
  }
}

export async function clearLastOutcome(token: string, context: ModContext) {
  try {
    await api.post(
      "/moderation/me/clear-outcome",
      { context },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch {
    // ignore
  }
}

/** Map API state → screen kind for the status UI */
export function resolveScreenKind(
  side: ModSide | null | undefined,
  context: ModContext
):
  | "review"
  | "suspended"
  | "blocked"
  | "pardoned"
  | "restored"
  | "clear" {
  if (!side) return "clear";

  if (side.lastOutcome === "PARDONED") return "pardoned";
  if (side.lastOutcome === "RESTORED") return "restored";

  const s = String(side.status || "NORMAL");
  if (s === "UNDER_REVIEW" || s === "ACTIVITY_CHECK") return "review";
  if (s === "SUSPENDED") return "suspended";
  if (s === "BLOCKED") return "blocked";
  return "clear";
}