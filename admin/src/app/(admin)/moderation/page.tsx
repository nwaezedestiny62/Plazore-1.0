"use client";

import { useAuth } from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { adminFetch } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Input,
  PageHeader,
  Panel,
  Select,
} from "@/components/ui";

/* ───────────────────────── types ───────────────────────── */

type Context = "buyer" | "seller";
type ActionKey = "check" | "pardon" | "suspend" | "block" | "lift";

type ModSide = {
  status: string;
  reason?: string;
  publicReason?: string;
  startedAt?: string | null;
  endsAt?: string | null;
  caseId?: string | null;
  lastOutcome?: string | null;
};

type SearchUser = {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
  storeName?: string;
  image?: string;
  marketplaceRegion?: string;
  isSellerSuspended?: boolean;
  moderation?: { buyer?: ModSide; seller?: ModSide };
};

type Profile = {
  user: SearchUser & {
    phone?: string;
    createdAt?: string;
    updatedAt?: string;
    lastActiveAt?: string;
    wishlistCount?: number;
    savedStoreCount?: number;
    cartItemCount?: number;
  };
  buyer: ModSide;
  seller: ModSide;
  cases: any[];
  events: any[];
  reports: any[];
  products: any[];
  activity: {
    productCount: number;
    orderAsBuyer: number;
    orderAsSeller: number;
    recentOrdersBuyer: any[];
    recentOrdersSeller: any[];
    pageVisits?: { path: string; at: string; count?: number }[];
    wishlists?: any[];
    savedStores?: any[];
    cartSummary?: { items: number; lastUpdated?: string };
    checkouts?: { at: string; amount?: number; status?: string }[];
  };
};

type Stats = {
  pendingChecks: number;
  underReview: number;
  sellerSuspensions: number;
  buyerSuspensions: number;
  sellerBlocks: number;
  buyerBlocks: number;
  recentlyPardoned: number;
  recentlyRestored: number;
  recentEvents: any[];
};

/* ───────────────────────── helpers ───────────────────────── */

function normalizeStatus(s?: string) {
  const v = String(s || "NORMAL").toUpperCase();
  if (v === "PARDONED" || v === "RESTORED") return "NORMAL";
  return v;
}

function toneForStatus(status: string) {
  const s = normalizeStatus(status);
  if (s === "NORMAL") return "green" as const;
  if (s === "UNDER_REVIEW" || s === "ACTIVITY_CHECK") return "warn" as const;
  if (s === "SUSPENDED" || s === "BLOCKED") return "error" as const;
  return "neutral" as const;
}

function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function remaining(endsAt?: string | null) {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Expired / auto-lift due";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  return `${h}h ${m}m left`;
}

/** Allowed primary actions for a given status */
function allowedActions(status: string): ActionKey[] {
  const s = normalizeStatus(status);
  switch (s) {
    case "NORMAL":
      return ["check", "suspend", "block"];
    case "ACTIVITY_CHECK":
    case "UNDER_REVIEW":
      return ["pardon", "suspend", "block"];
    case "SUSPENDED":
      return ["lift", "block"];
    case "BLOCKED":
      return ["lift"];
    default:
      return ["check"];
  }
}

function actionLabel(a: ActionKey) {
  switch (a) {
    case "check":
      return "Activity check";
    case "pardon":
      return "Pardon / clear";
    case "suspend":
      return "Suspend";
    case "block":
      return "Block";
    case "lift":
      return "Lift restriction";
  }
}

function actionHint(a: ActionKey, status: string) {
  const s = normalizeStatus(status);
  switch (a) {
    case "check":
      return "Opens review. User sees under-review screen. Next: pardon, suspend, or block.";
    case "pardon":
      return s === "UNDER_REVIEW" || s === "ACTIVITY_CHECK"
        ? "Clear the review with no restriction. User gets a pardoned screen."
        : "Clear this side back to normal.";
    case "suspend":
      return "Time-limited (or open-ended) lock. User can return after lift or expiry.";
    case "block":
      return "Hard lock until manually lifted. Use only for severe cases.";
    case "lift":
      return s === "BLOCKED"
        ? "Restore access after a block. User gets a restored screen."
        : "End the suspension early. User gets a restored screen.";
  }
}

/** Deterministic health score from activity signals — no AI */
function computeHealth(profile: Profile) {
  const a = profile.activity;
  const reports = profile.reports?.length || 0;
  const buyerOrders = a.orderAsBuyer || 0;
  const sellerOrders = a.orderAsSeller || 0;
  const products = a.productCount || 0;
  const cancelledBuyer =
    a.recentOrdersBuyer?.filter((o) =>
      /cancel/i.test(String(o.orderStatus || ""))
    ).length || 0;
  const cancelledSeller =
    a.recentOrdersSeller?.filter((o) =>
      /cancel/i.test(String(o.orderStatus || ""))
    ).length || 0;

  let score = 72; // baseline
  const flags: string[] = [];

  // positive signals
  if (buyerOrders + sellerOrders >= 3) score += 8;
  if (buyerOrders + sellerOrders >= 10) score += 6;
  if (products >= 1 && products <= 40) score += 5;
  if ((a.wishlists?.length || profile.user.wishlistCount || 0) > 0) score += 3;
  if ((a.savedStores?.length || profile.user.savedStoreCount || 0) > 0)
    score += 2;

  // negative
  if (reports >= 1) {
    score -= 12 * Math.min(reports, 4);
    flags.push(`${reports} related report(s)`);
  }
  if (cancelledBuyer + cancelledSeller >= 3) {
    score -= 10;
    flags.push("Elevated cancellations");
  }
  if (products > 80) {
    score -= 8;
    flags.push("Unusually high product volume");
  }
  if (buyerOrders === 0 && sellerOrders === 0 && products === 0) {
    score -= 6;
    flags.push("No commercial activity yet");
  }

  // account age soft signal
  if (profile.user.createdAt) {
    const days =
      (Date.now() - new Date(profile.user.createdAt).getTime()) / 86400000;
    if (days < 2 && (products > 15 || reports > 0)) {
      score -= 10;
      flags.push("Very new account with heavy activity");
    }
    if (days > 90 && buyerOrders + sellerOrders > 0) score += 4;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let band: "Healthy" | "Watch" | "Risk";
  let conclusion: string;
  if (score >= 75) {
    band = "Healthy";
    conclusion =
      "Activity pattern looks consistent with normal marketplace use.";
  } else if (score >= 50) {
    band = "Watch";
    conclusion =
      "Some signals need attention. Prefer activity check before hard enforcement.";
  } else {
    band = "Risk";
    conclusion =
      "Multiple abnormal signals. Review carefully before pardon; suspension may be appropriate.";
  }

  return { score, band, conclusion, flags };
}

/* ───────────────────────── orb preloader ───────────────────────── */

function OrbLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 animate-pulse rounded-full bg-[#00E575]/20 blur-md" />
        <div
          className="absolute inset-1 rounded-full border-2 border-[#00E575]/40 border-t-[#00E575] animate-spin"
          style={{ animationDuration: "0.9s" }}
        />
        <div className="absolute inset-4 rounded-full bg-[#00E575]/30" />
      </div>
      <p className="text-xs font-medium tracking-wide text-[#737A86]">{label}</p>
    </div>
  );
}

/* ───────────────────────── offline banner ───────────────────────── */

function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/* ───────────────────────── page ───────────────────────── */

export default function ModerationPage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const preselect = searchParams.get("userId") || "";
  const online = useOnline();

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    preselect || null
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState("");
  const [momentNote, setMomentNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [context, setContext] = useState<Context>("buyer");
  const [reason, setReason] = useState("");
  const [durationDays, setDurationDays] = useState("7");
  const [step, setStep] = useState<ActionKey | null>(null);

  const [cases, setCases] = useState<any[]>([]);
  const [caseFilter, setCaseFilter] = useState({ context: "", status: "" });
  const [noteBody, setNoteBody] = useState("");
  const [activeCaseId, setActiveCaseId] = useState("");

  const [activityOpen, setActivityOpen] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (msg: string) => {
    setMomentNote(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setMomentNote(""), 4200);
  };

  const loadStats = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      setStatsLoading(true);
      const token = await getToken();
      const json = await adminFetch<{ data: Stats }>("/moderation/stats", token);
      setStats(json.data);
    } catch (e: any) {
      setError(e.message || "Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  }, [getToken]);

  const loadCases = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const token = await getToken();
      const params = new URLSearchParams({ limit: "30" });
      if (caseFilter.context) params.set("context", caseFilter.context);
      if (caseFilter.status) params.set("status", caseFilter.status);
      const json = await adminFetch<any>(`/moderation/cases?${params}`, token);
      setCases(json.data || []);
    } catch {
      /* silent */
    }
  }, [getToken, caseFilter]);

  const loadProfile = useCallback(
    async (id: string) => {
      if (!navigator.onLine) {
        setError("You're offline. Reconnect to load this account.");
        return;
      }
      try {
        setProfileLoading(true);
        setError("");
        setStep(null);
        setReason("");
        const token = await getToken();
        const json = await adminFetch<{ data: Profile }>(
          `/moderation/users/${id}`,
          token
        );
        setProfile(json.data);
        setSelectedId(id);
        if (json.data.user.role === "seller") setContext("seller");
        else setContext("buyer");
      } catch (e: any) {
        setError(e.message || "Failed to load profile");
        setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    },
    [getToken]
  );

  useEffect(() => {
    loadStats();
    loadCases();
  }, [loadStats, loadCases]);

  useEffect(() => {
    if (preselect) loadProfile(preselect);
  }, [preselect, loadProfile]);

  const runSearch = async () => {
    if (!q.trim()) return;
    if (!online) {
      setError("Offline — search needs a connection.");
      return;
    }
    try {
      setSearching(true);
      setError("");
      const token = await getToken();
      const json = await adminFetch<{ data: SearchUser[] }>(
        `/moderation/search?q=${encodeURIComponent(q.trim())}`,
        token
      );
      setSearchResults(json.data || []);
    } catch (e: any) {
      setError(e.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const refreshAll = async () => {
    if (!online) {
      flash("Still offline — can't refresh.");
      return;
    }
    await loadStats();
    await loadCases();
    if (selectedId) await loadProfile(selectedId);
  };

  const side = useMemo(() => {
    if (!profile) return null;
    return context === "seller" ? profile.seller : profile.buyer;
  }, [profile, context]);

  const status = normalizeStatus(side?.status);
  const actions = allowedActions(status);
  const health = useMemo(
    () => (profile ? computeHealth(profile) : null),
    [profile]
  );

  const pickAction = (a: ActionKey) => {
    if (!actions.includes(a)) {
      flash(
        `“${actionLabel(a)}” isn’t available while status is ${status}. Allowed: ${actions
          .map(actionLabel)
          .join(", ")}.`
      );
      return;
    }
    setError("");
    setStep(a);
  };

  const executeAction = async () => {
    if (!selectedId || !step) return;
    if (!online) {
      setError("You're offline. Actions are disabled until you reconnect.");
      return;
    }
    if (["pardon", "suspend", "block", "lift"].includes(step) && !reason.trim()) {
      setError("Reason is required for this action.");
      flash("Add an internal reason before confirming.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const token = await getToken();
      const base = `/moderation/users/${selectedId}`;
      if (step === "check") {
        await adminFetch(`${base}/activity-check`, token, {
          method: "POST",
          body: JSON.stringify({
            context,
            reason: reason.trim() || "Activity check",
          }),
        });
      } else if (step === "pardon") {
        await adminFetch(`${base}/pardon`, token, {
          method: "POST",
          body: JSON.stringify({ context, reason }),
        });
      } else if (step === "suspend") {
        await adminFetch(`${base}/suspend`, token, {
          method: "POST",
          body: JSON.stringify({
            context,
            reason,
            durationDays: Number(durationDays) || 0,
          }),
        });
      } else if (step === "block") {
        await adminFetch(`${base}/block`, token, {
          method: "POST",
          body: JSON.stringify({ context, reason }),
        });
      } else if (step === "lift") {
        await adminFetch(`${base}/lift`, token, {
          method: "POST",
          body: JSON.stringify({ context, reason }),
        });
      }
      setStep(null);
      setReason("");
      await refreshAll();
      flash(`${actionLabel(step)} applied on ${context}.`);
    } catch (e: any) {
      setError(e.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!activeCaseId || !noteBody.trim()) return;
    if (!online) {
      setError("Offline — notes need a connection.");
      return;
    }
    try {
      setBusy(true);
      const token = await getToken();
      await adminFetch(`/moderation/cases/${activeCaseId}/notes`, token, {
        method: "POST",
        body: JSON.stringify({ body: noteBody.trim() }),
      });
      setNoteBody("");
      setActiveCaseId("");
      await refreshAll();
    } catch (e: any) {
      setError(e.message || "Could not add note");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative pb-24">
      {/* Logo + header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/moderation-logo.png"
            alt="Plazore Moderation"
            className="h-14 w-auto object-contain drop-shadow-[0_0_18px_rgba(0,229,117,0.25)]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div>
            <PageHeader
              title="Moderation"
              description="State-aware enforcement. Only valid next steps are shown."
            />
          </div>
        </div>
      </div>

      {!online && (
        <div className="mb-4 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          You’re offline. Search and enforcement are paused. Cached view only —
          reconnect to act.
        </div>
      )}

      {momentNote && (
        <div className="mb-4 border border-[#00E575]/30 bg-[#00E575]/10 px-4 py-3 text-sm text-[#B8F0D0] transition">
          {momentNote}
        </div>
      )}

      {error && (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      )}

      {/* Stats */}
      {statsLoading && !stats ? (
        <OrbLoader label="Loading moderation overview…" />
      ) : stats ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <Card
            label="Pending / review"
            value={stats.pendingChecks}
            hint="Active checks"
          />
          <Card label="Under review" value={stats.underReview} />
          <Card
            label="Seller susp. / block"
            value={`${stats.sellerSuspensions} / ${stats.sellerBlocks}`}
          />
          <Card
            label="Buyer susp. / block"
            value={`${stats.buyerSuspensions} / ${stats.buyerBlocks}`}
          />
          <Card label="Pardoned (7d)" value={stats.recentlyPardoned} />
          <Card label="Restored (7d)" value={stats.recentlyRestored} />
        </div>
      ) : null}

      {/* Search */}
      <Panel className="mb-4 p-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
          Find account
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Name, email, store, phone, or user ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            className="sm:max-w-md"
          />
          <Button onClick={runSearch} disabled={searching || !online}>
            {searching ? "Searching…" : "Search"}
          </Button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
            {searchResults.map((u) => (
              <button
                key={u._id}
                type="button"
                onClick={() => loadProfile(u._id)}
                className={`flex w-full items-center justify-between gap-3 border px-3 py-2.5 text-left text-sm transition ${
                  selectedId === u._id
                    ? "border-[#00E575]/30 bg-[#00E575]/10"
                    : "border-[#252A33] bg-[#171B22] hover:border-[#00E575]/20"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{u.name || "—"}</p>
                  <p className="truncate text-xs text-[#737A86]">
                    {u.email} · {u.role}
                    {u.storeName ? ` · ${u.storeName}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Badge
                    tone={toneForStatus(
                      u.moderation?.buyer?.status || "NORMAL"
                    )}
                  >
                    B:{normalizeStatus(u.moderation?.buyer?.status)}
                  </Badge>
                  <Badge
                    tone={toneForStatus(
                      u.moderation?.seller?.status || "NORMAL"
                    )}
                  >
                    S:{normalizeStatus(u.moderation?.seller?.status)}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </Panel>

      {profileLoading && <OrbLoader label="Loading account…" />}

      {!profileLoading && profile && (
        <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* LEFT: profile */}
          <Panel className="p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#737A86]">
                  Moderation profile
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  {profile.user.name || "—"}
                </h2>
                <p className="text-sm text-[#A7ADB8]">{profile.user.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge
                    tone={
                      profile.user.role === "seller"
                        ? "green"
                        : profile.user.role === "admin"
                          ? "blue"
                          : "neutral"
                    }
                  >
                    {profile.user.role}
                  </Badge>
                  <Badge tone="neutral">
                    {profile.user.marketplaceRegion || "—"}
                  </Badge>
                  {health && (
                    <Badge
                      tone={
                        health.band === "Healthy"
                          ? "green"
                          : health.band === "Watch"
                            ? "warn"
                            : "error"
                      }
                    >
                      Health {health.score} · {health.band}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  tone="primary"
                  className="h-9 text-xs"
                  onClick={() => setActivityOpen(true)}
                >
                  Open activity
                </Button>
                <Button
                  tone="ghost"
                  className="h-9 text-xs"
                  onClick={() => refreshAll()}
                  disabled={!online}
                >
                  Refresh
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <StatusCard
                title="Buyer / general"
                side={profile.buyer}
                active={context === "buyer"}
                onFocus={() => {
                  setContext("buyer");
                  setStep(null);
                }}
              />
              <StatusCard
                title="Seller World"
                side={profile.seller}
                active={context === "seller"}
                onFocus={() => {
                  setContext("seller");
                  setStep(null);
                }}
              />
            </div>

            <div className="mt-4 grid gap-3 border-t border-[#252A33] pt-4 text-sm sm:grid-cols-3">
              <Metric
                label="Orders as buyer"
                value={profile.activity.orderAsBuyer}
              />
              <Metric
                label="Orders as seller"
                value={profile.activity.orderAsSeller}
              />
              <Metric label="Products" value={profile.activity.productCount} />
            </div>

            {health && (
              <div className="mt-4 border border-[#252A33] bg-[#171B22] p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                  Activity health (rule-based)
                </p>
                <p className="mt-2 text-sm text-[#F5F7FA]">{health.conclusion}</p>
                {health.flags.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-xs text-[#A7ADB8]">
                    {health.flags.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-4 border-t border-[#252A33] pt-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                Audit history
              </p>
              {profile.events?.length === 0 ? (
                <p className="mt-2 text-sm text-[#737A86]">
                  No moderation events yet.
                </p>
              ) : (
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                  {profile.events.map((ev: any) => (
                    <div
                      key={ev._id}
                      className="border border-[#252A33] bg-[#171B22] px-3 py-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{ev.context}</Badge>
                        <span className="font-medium text-[#F5F7FA]">
                          {ev.action}
                        </span>
                        <span className="text-[#737A86]">
                          {ev.previousState} → {ev.newState}
                        </span>
                      </div>
                      <p className="mt-1 text-[#A7ADB8]">
                        {ev.reason || "—"} · {fmt(ev.createdAt)}
                        {ev.admin?.name ? ` · ${ev.admin.name}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          {/* RIGHT: state machine actions */}
          <Panel className="h-fit p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Enforcement
            </p>
            <p className="mt-1 text-xs text-[#A7ADB8]">
              Controls change with status. Invalid moves are blocked.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[#737A86]">
                  Context
                </p>
                <Select
                  value={context}
                  onChange={(e) => {
                    setContext(e.target.value as Context);
                    setStep(null);
                  }}
                  className="w-full"
                >
                  <option value="buyer">General user / Buyer</option>
                  <option value="seller">Seller World</option>
                </Select>
              </div>

              {side && (
                <div className="border border-[#252A33] bg-[#171B22] p-3 text-xs">
                  <p className="text-[#737A86]">Current · {context}</p>
                  <p className="mt-1">
                    <Badge tone={toneForStatus(side.status)}>
                      {normalizeStatus(side.status)}
                    </Badge>
                  </p>
                  {side.endsAt && (
                    <p className="mt-2 text-[#A7ADB8]">
                      Until {fmt(side.endsAt)} ({remaining(side.endsAt)})
                    </p>
                  )}
                  {side.publicReason && (
                    <p className="mt-1 text-[#737A86]">{side.publicReason}</p>
                  )}
                </div>
              )}

              {/* Only valid buttons */}
              <div className="grid gap-2">
                {actions.map((a) => (
                  <Button
                    key={a}
                    tone={
                      a === "block" || a === "suspend"
                        ? "danger"
                        : a === "pardon" || a === "lift"
                          ? "primary"
                          : "ghost"
                    }
                    disabled={busy || !online}
                    onClick={() => pickAction(a)}
                    className={
                      step === a ? "ring-1 ring-[#00E575]/50" : undefined
                    }
                  >
                    {actionLabel(a)}
                  </Button>
                ))}
              </div>

              {/* Hidden actions as disabled cues (optional clarity) */}
              {(["check", "pardon", "suspend", "block", "lift"] as ActionKey[])
                .filter((a) => !actions.includes(a))
                .map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => pickAction(a)}
                    className="w-full border border-[#252A33] px-3 py-2 text-left text-xs text-[#5A6F88] line-through opacity-50"
                  >
                    {actionLabel(a)} · not available in {status}
                  </button>
                ))}

              {step && (
                <div className="border border-[#00E575]/25 bg-[#0E1512] p-3">
                  <p className="text-sm font-semibold text-[#B8F0D0]">
                    Next · {actionLabel(step)}
                  </p>
                  <p className="mt-1 text-xs text-[#A7ADB8]">
                    {actionHint(step, status)}
                  </p>

                  {(step === "pardon" ||
                    step === "suspend" ||
                    step === "block" ||
                    step === "lift") && (
                    <div className="mt-3">
                      <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[#737A86]">
                        Internal reason (required)
                      </p>
                      <Input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why this action…"
                      />
                    </div>
                  )}

                  {step === "check" && (
                    <div className="mt-3">
                      <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[#737A86]">
                        Note (optional)
                      </p>
                      <Input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why opening a check…"
                      />
                      <p className="mt-2 text-[11px] text-[#737A86]">
                        After this, next options become: Pardon, Suspend, Block.
                      </p>
                    </div>
                  )}

                  {step === "suspend" && (
                    <div className="mt-3">
                      <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[#737A86]">
                        Duration (days · 0 = until lifted)
                      </p>
                      <Input
                        type="number"
                        min={0}
                        value={durationDays}
                        onChange={(e) => setDurationDays(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button disabled={busy || !online} onClick={executeAction}>
                      {busy ? "Working…" : `Confirm ${actionLabel(step)}`}
                    </Button>
                    <Button
                      tone="ghost"
                      disabled={busy}
                      onClick={() => setStep(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* Cases */}
      <Panel className="mb-4 p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
            Active cases
          </p>
          <div className="flex flex-wrap gap-2">
            <Select
              value={caseFilter.context}
              onChange={(e) =>
                setCaseFilter((f) => ({ ...f, context: e.target.value }))
              }
              className="w-36"
            >
              <option value="">All contexts</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
            </Select>
            <Select
              value={caseFilter.status}
              onChange={(e) =>
                setCaseFilter((f) => ({ ...f, status: e.target.value }))
              }
              className="w-40"
            >
              <option value="">All statuses</option>
              <option value="UNDER_REVIEW">Under review</option>
              <option value="ACTIVITY_CHECK">Activity check</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="BLOCKED">Blocked</option>
            </Select>
            <Button tone="ghost" className="h-10" onClick={loadCases}>
              Apply
            </Button>
          </div>
        </div>
        {cases.length === 0 ? (
          <EmptyState
            title="No active moderation cases"
            body="Activity checks and suspensions show up here."
          />
        ) : (
          <div className="space-y-2">
            {cases.map((c) => (
              <div
                key={c._id}
                className="flex flex-col gap-2 border border-[#252A33] bg-[#171B22] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.user?.name || "User"} · {c.user?.email}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge tone="neutral">{c.context}</Badge>
                    <Badge tone={toneForStatus(c.status)}>{c.status}</Badge>
                    <span className="text-xs text-[#737A86]">
                      {fmt(c.updatedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {c.user?._id && (
                    <Button
                      tone="ghost"
                      className="h-8 text-xs"
                      onClick={() => loadProfile(c.user._id)}
                    >
                      Open
                    </Button>
                  )}
                  <Button
                    tone="ghost"
                    className="h-8 text-xs"
                    onClick={() => setActiveCaseId(c._id)}
                  >
                    Note
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {activeCaseId && (
          <div className="mt-4 border border-[#252A33] p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
              Internal note · case {activeCaseId.slice(-6)}
            </p>
            <Input
              className="mt-2"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Admin-only note (never shown to users)…"
            />
            <div className="mt-2 flex gap-2">
              <Button disabled={busy || !online} onClick={addNote}>
                Save note
              </Button>
              <Button tone="ghost" onClick={() => setActiveCaseId("")}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {stats?.recentEvents && stats.recentEvents.length > 0 && (
        <Panel className="p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
            Recent moderation actions
          </p>
          <div className="space-y-2">
            {stats.recentEvents.map((ev: any) => (
              <div
                key={ev._id}
                className="flex flex-wrap items-center justify-between gap-2 border border-[#252A33] bg-[#171B22] px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-medium text-[#F5F7FA]">
                    {ev.user?.name || "User"}
                  </span>
                  <span className="text-[#737A86]">
                    {" "}
                    · {ev.action} · {ev.context}
                  </span>
                </div>
                <span className="text-[#737A86]">{fmt(ev.createdAt)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* RIGHT ACTIVITY DRAWER */}
      {activityOpen && profile && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close activity"
            onClick={() => setActivityOpen(false)}
          />
          <aside className="relative flex h-full w-full max-w-md flex-col border-l border-[#252A33] bg-[#0C0E12] shadow-2xl sm:max-w-lg">
            <div className="flex items-center justify-between border-b border-[#252A33] px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#00E575]">
                  Platform activity
                </p>
                <p className="text-sm font-semibold text-[#F5F7FA]">
                  {profile.user.name || "User"}
                </p>
              </div>
              <Button
                tone="ghost"
                className="h-8 text-xs"
                onClick={() => setActivityOpen(false)}
              >
                Close
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {health && (
                <div className="border border-[#252A33] bg-[#171B22] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                      Health score
                    </p>
                    <Badge
                      tone={
                        health.band === "Healthy"
                          ? "green"
                          : health.band === "Watch"
                            ? "warn"
                            : "error"
                      }
                    >
                      {health.score} · {health.band}
                    </Badge>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#252A33]">
                    <div
                      className="h-full rounded-full bg-[#00E575]"
                      style={{ width: `${health.score}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[#A7ADB8]">
                    {health.conclusion}
                  </p>
                </div>
              )}

              <Row
                label="Last active"
                value={fmt(
                  profile.user.lastActiveAt || profile.user.updatedAt
                )}
              />
              <Row label="Joined" value={fmt(profile.user.createdAt)} />
              <Row
                label="Wishlist items"
                value={String(
                  profile.user.wishlistCount ??
                    profile.activity.wishlists?.length ??
                    "—"
                )}
              />
              <Row
                label="Saved stores"
                value={String(
                  profile.user.savedStoreCount ??
                    profile.activity.savedStores?.length ??
                    "—"
                )}
              />
              <Row
                label="Cart items"
                value={String(
                  profile.user.cartItemCount ??
                    profile.activity.cartSummary?.items ??
                    "—"
                )}
              />

              <Section title="Recent buyer orders">
                {(profile.activity.recentOrdersBuyer || []).length === 0 ? (
                  <p className="text-xs text-[#737A86]">None</p>
                ) : (
                  profile.activity.recentOrdersBuyer.slice(0, 8).map((o: any) => (
                    <p key={o._id} className="text-xs text-[#A7ADB8]">
                      {o.orderNumber} · {o.orderStatus} ·{" "}
                      {Number(o.totalAmount || 0).toLocaleString()}
                    </p>
                  ))
                )}
              </Section>

              <Section title="Recent seller orders">
                {(profile.activity.recentOrdersSeller || []).length === 0 ? (
                  <p className="text-xs text-[#737A86]">None</p>
                ) : (
                  profile.activity.recentOrdersSeller
                    .slice(0, 8)
                    .map((o: any) => (
                      <p key={o._id} className="text-xs text-[#A7ADB8]">
                        {o.orderNumber} · {o.orderStatus} ·{" "}
                        {Number(o.totalAmount || 0).toLocaleString()}
                      </p>
                    ))
                )}
              </Section>

              <Section title="Products">
                {(profile.products || []).length === 0 ? (
                  <p className="text-xs text-[#737A86]">None</p>
                ) : (
                  profile.products.slice(0, 10).map((p: any) => (
                    <p key={p._id} className="text-xs text-[#A7ADB8]">
                      {p.name} · {p.isActive ? "Live" : "Off"} · stock{" "}
                      {p.stock ?? 0}
                    </p>
                  ))
                )}
              </Section>

              <Section title="Page / screen visits">
                {(profile.activity.pageVisits || []).length === 0 ? (
                  <p className="text-xs text-[#737A86]">
                    No visit trail on this profile payload yet.
                  </p>
                ) : (
                  profile.activity.pageVisits!.slice(0, 12).map((v, i) => (
                    <p key={`${v.path}-${i}`} className="text-xs text-[#A7ADB8]">
                      {v.path} · {fmt(v.at)}
                      {v.count ? ` · ×${v.count}` : ""}
                    </p>
                  ))
                )}
              </Section>

              <Section title="Checkouts">
                {(profile.activity.checkouts || []).length === 0 ? (
                  <p className="text-xs text-[#737A86]">None logged</p>
                ) : (
                  profile.activity.checkouts!.slice(0, 8).map((c, i) => (
                    <p key={i} className="text-xs text-[#A7ADB8]">
                      {fmt(c.at)} · {c.status || "—"} ·{" "}
                      {c.amount != null
                        ? Number(c.amount).toLocaleString()
                        : "—"}
                    </p>
                  ))
                )}
              </Section>

              <Section title={`Reports (${profile.reports?.length || 0})`}>
                {(profile.reports || []).length === 0 ? (
                  <p className="text-xs text-[#737A86]">None</p>
                ) : (
                  profile.reports.slice(0, 8).map((r: any) => (
                    <p key={r._id} className="text-xs text-[#A7ADB8]">
                      {r.status} · {r.priority || "—"} ·{" "}
                      {r.targetType || "report"}
                    </p>
                  ))
                )}
              </Section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── small UI bits ───────────────────────── */

function StatusCard({
  title,
  side,
  active,
  onFocus,
}: {
  title: string;
  side: ModSide;
  active: boolean;
  onFocus: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onFocus}
      className={`border p-3 text-left transition ${
        active
          ? "border-[#00E575]/35 bg-[#00E575]/5"
          : "border-[#252A33] bg-[#171B22] hover:border-[#00E575]/20"
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
        {title}
      </p>
      <div className="mt-2">
        <Badge tone={toneForStatus(side.status)}>
          {normalizeStatus(side.status)}
        </Badge>
      </div>
      {side.endsAt && (
        <p className="mt-2 text-xs text-[#A7ADB8]">
          Ends {fmt(side.endsAt)} · {remaining(side.endsAt)}
        </p>
      )}
      {side.publicReason && (
        <p className="mt-1 text-xs text-[#737A86]">{side.publicReason}</p>
      )}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
        {label}
      </p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#252A33] py-2 text-xs">
      <span className="text-[#737A86]">{label}</span>
      <span className="text-right text-[#F5F7FA]">{value}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}