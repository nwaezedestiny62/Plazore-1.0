"use client";

import { useAuth } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Input,
  Panel,
  Select,
  cn,
} from "@/components/ui";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type Context = "buyer" | "seller";
type ModStatus = string;
type ActionKind = "check" | "pardon" | "suspend" | "block" | "lift";

type ModSide = {
  status: ModStatus;
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
  moderation?: { buyer?: ModSide; seller?: ModSide };
};

type Profile = {
  user: SearchUser & { phone?: string; createdAt?: string; updatedAt?: string };
  buyer: ModSide;
  seller: ModSide;
  cases: any[];
  events: any[];
  reports: any[];
  products: any[];
  addresses?: any[];
  paymentMethods?: any[];
  wishlist?: any[];
  savedStores?: any[];
  activity: {
    productCount: number;
    orderAsBuyer: number;
    orderAsSeller: number;
    recentOrdersBuyer: any[];
    recentOrdersSeller: any[];
    addressCount?: number;
    paymentMethodCount?: number;
    wishlistCount?: number;
    savedStoreCount?: number;
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

const HOUR_PRESETS = [
  { value: "1", label: "1 hour" },
  { value: "3", label: "3 hours" },
  { value: "6", label: "6 hours" },
  { value: "12", label: "12 hours" },
  { value: "24", label: "24 hours" },
  { value: "48", label: "48 hours" },
  { value: "72", label: "72 hours" },
  { value: "168", label: "7 days (168h)" },
  { value: "0", label: "Until lifted manually" },
  { value: "custom", label: "Custom hours…" },
];

function toneForStatus(status: string) {
  if (["NORMAL", "PARDONED", "RESTORED"].includes(status)) return "green" as const;
  if (["UNDER_REVIEW", "ACTIVITY_CHECK"].includes(status)) return "warn" as const;
  if (["SUSPENDED", "BLOCKED"].includes(status)) return "error" as const;
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
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  return `${h}h ${m}m left`;
}

function computeHealth(profile: Profile) {
  let score = 74;
  const signals: string[] = [];
  const reports = profile.reports?.length || 0;
  const buyerOrders = profile.activity.orderAsBuyer || 0;
  const sellerOrders = profile.activity.orderAsSeller || 0;
  const products = profile.activity.productCount || 0;
  const addresses = profile.addresses?.length || profile.activity.addressCount || 0;
  const payments = profile.paymentMethods?.length || profile.activity.paymentMethodCount || 0;
  const wishlist = profile.wishlist?.length || profile.activity.wishlistCount || 0;
  const saved = profile.savedStores?.length || profile.activity.savedStoreCount || 0;
  const ageMs = profile.user.createdAt
    ? Date.now() - new Date(profile.user.createdAt).getTime()
    : 0;
  const ageDays = ageMs / 86_400_000;

  if (reports === 0) {
    score += 8;
    signals.push("No related reports on file");
  } else if (reports >= 3) {
    score -= 20;
    signals.push("Several related reports — worth a careful read");
  } else {
    score -= 7;
    signals.push("A related report is on file");
  }

  if (addresses >= 8) {
    score -= 10;
    signals.push("Unusually many delivery addresses");
  }
  if (payments >= 6) {
    score -= 10;
    signals.push("Unusually many payment methods");
  }
  if (wishlist >= 80) {
    score -= 6;
    signals.push("Very large wishlist in a short pattern");
  }
  if (saved >= 40) {
    score -= 4;
    signals.push("High volume of saved stores");
  }

  if (ageDays < 14 && products >= 12 && sellerOrders < 2) {
    score -= 14;
    signals.push("New account with a large catalog and little order history");
  }

  if (buyerOrders + sellerOrders === 0 && products === 0 && wishlist === 0) {
    score -= 6;
    signals.push("Very little marketplace activity yet");
  } else if (buyerOrders + sellerOrders > 8) {
    score += 8;
    signals.push("Steady order history");
  }

  const recentBad = (profile.events || []).filter((e: any) =>
    ["SUSPENDED", "BLOCKED", "ACTIVITY_CHECK_REQUESTED"].includes(e.action)
  ).length;
  if (recentBad >= 2) {
    score -= 12;
    signals.push("Repeat moderation history");
  }

  score = Math.max(8, Math.min(97, score));
  let conclusion = "Looks healthy";
  let tone: "green" | "warn" | "error" = "green";
  if (score < 40) {
    conclusion = "Needs a closer look";
    tone = "error";
  } else if (score < 62) {
    conclusion = "Some unusual patterns";
    tone = "warn";
  } else if (score < 78) {
    conclusion = "Mostly fine, minor flags";
    tone = "warn";
  }
  return { score, conclusion, tone, signals };
}

function allowedActions(status: ModStatus): ActionKind[] {
  switch (status) {
    case "UNDER_REVIEW":
    case "ACTIVITY_CHECK":
      return ["suspend", "block", "pardon"];
    case "SUSPENDED":
      return ["pardon"];
    case "BLOCKED":
      return ["lift"];
    case "NORMAL":
    case "PARDONED":
    case "RESTORED":
    default:
      return ["check", "suspend", "block"];
  }
}

const ACTION_META: Record<
  ActionKind,
  { label: string; tone: "primary" | "ghost" | "danger"; hint: string }
> = {
  check: {
    label: "Request activity check",
    tone: "ghost",
    hint: "Puts this side under review. Then you can suspend, block, or pardon.",
  },
  pardon: {
    label: "Pardon / clear",
    tone: "primary",
    hint: "Clears the restriction and restores access.",
  },
  suspend: {
    label: "Suspend",
    tone: "danger",
    hint: "Temporary pause. Duration is internal — users never see the clock.",
  },
  block: {
    label: "Block",
    tone: "danger",
    hint: "Stays in place until you lift it.",
  },
  lift: {
    label: "Blockage lifted",
    tone: "primary",
    hint: "Removes the block and restores access.",
  },
};

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="min-w-0 border border-[#252A33] bg-[#11141A] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">{label}</p>
      <p className="mt-1.5 text-[22px] font-semibold tabular-nums leading-none text-[#F5F7FA]">{value}</p>
      {hint ? <p className="mt-1.5 text-[11px] text-[#737A86]">{hint}</p> : null}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#737A86]">{children}</p>
  );
}

export default function ModerationPage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const preselect = searchParams.get("userId") || "";

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(preselect || null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [context, setContext] = useState<Context>("buyer");
  const [reason, setReason] = useState("");
  const [hourPreset, setHourPreset] = useState("24");
  const [customHours, setCustomHours] = useState("24");
  const [activeAction, setActiveAction] = useState<ActionKind | null>(null);

  const [cases, setCases] = useState<any[]>([]);
  const [caseFilter, setCaseFilter] = useState({ context: "", status: "" });
  const [noteBody, setNoteBody] = useState("");
  const [activeCaseId, setActiveCaseId] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("offline", sync);
    window.addEventListener("online", sync);
    return () => {
      window.removeEventListener("offline", sync);
      window.removeEventListener("online", sync);
    };
  }, []);

  const durationHours = hourPreset === "custom" ? Number(customHours) || 0 : Number(hourPreset) || 0;

  const loadStats = useCallback(async () => {
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
      try {
        setProfileLoading(true);
        setError("");
        setActiveAction(null);
        setReason("");
        const token = await getToken();
        const json = await adminFetch<{ data: Profile }>(`/moderation/users/${id}`, token);
        setProfile(json.data);
        setSelectedId(id);
        setContext(json.data.user.role === "seller" ? "seller" : "buyer");
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
    if (mounted && !navigator.onLine) {
      setError("You are offline. Search requires a connection.");
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
    await Promise.all([loadStats(), loadCases()]);
    if (selectedId) await loadProfile(selectedId);
  };

  const executeAction = async () => {
    if (!selectedId || !activeAction) return;
    if (["pardon", "suspend", "block", "lift"].includes(activeAction) && !reason.trim()) {
      setError("A reason is required for this action.");
      return;
    }
    if (mounted && !navigator.onLine) {
      setError("You are offline. Actions cannot be sent right now.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const token = await getToken();
      const base = `/moderation/users/${selectedId}`;
      if (activeAction === "check") {
        await adminFetch(`${base}/activity-check`, token, {
          method: "POST",
          body: JSON.stringify({ context, reason: reason || "Activity check" }),
        });
        setActivityOpen(true);
      } else if (activeAction === "pardon") {
        await adminFetch(`${base}/pardon`, token, {
          method: "POST",
          body: JSON.stringify({ context, reason }),
        });
      } else if (activeAction === "suspend") {
        await adminFetch(`${base}/suspend`, token, {
          method: "POST",
          body: JSON.stringify({ context, reason, durationHours }),
        });
      } else if (activeAction === "block") {
        await adminFetch(`${base}/block`, token, {
          method: "POST",
          body: JSON.stringify({ context, reason }),
        });
      } else if (activeAction === "lift") {
        await adminFetch(`${base}/lift`, token, {
          method: "POST",
          body: JSON.stringify({ context, reason }),
        });
      }
      setActiveAction(null);
      setReason("");
      await refreshAll();
    } catch (e: any) {
      setError(e.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!activeCaseId || !noteBody.trim()) return;
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

  const side = useMemo(() => {
    if (!profile) return null;
    return context === "seller" ? profile.seller : profile.buyer;
  }, [profile, context]);

  const health = useMemo(() => (profile ? computeHealth(profile) : null), [profile]);
  const visibleActions = side ? allowedActions(side.status) : [];
  const showOffline = mounted && offline;
  const underReview =
    side?.status === "UNDER_REVIEW" || side?.status === "ACTIVITY_CHECK";

  return (
    <div className={cn(poppins.className, "relative pb-20 text-[#F5F7FA]")}>
      {showOffline && (
        <div className="mb-4 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          You are offline. Search and enforcement are paused until you reconnect.
        </div>
      )}

      <header className="mb-7 flex flex-col gap-4 border-b border-[#252A33] pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-[#00E575]/25 bg-[#041412]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/moderation-logo.png"
              alt="Moderation"
              className="h-9 w-9 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/plazore-logo.png";
              }}
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#00E575]">
              Trust & Safety
            </p>
            <h1 className="mt-0.5 text-[28px] font-semibold leading-none tracking-tight">
              Moderation
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#A7ADB8]">
              Internal durations never appear to buyers or sellers.
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-5">
          <ErrorBlock message={error} />
        </div>
      )}

      {statsLoading && !stats ? (
        <div className="mb-6 border border-[#252A33] bg-[#11141A]">
          <OrbLoader label="Loading overview" />
        </div>
      ) : stats ? (
        <section className="mb-6 grid grid-cols-2 gap-px overflow-hidden border border-[#252A33] bg-[#252A33] lg:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Pending" value={stats.pendingChecks} hint="Active checks" />
          <Kpi label="Under review" value={stats.underReview} />
          <Kpi label="Seller" value={`${stats.sellerSuspensions} / ${stats.sellerBlocks}`} hint="Suspended / blocked" />
          <Kpi label="Buyer" value={`${stats.buyerSuspensions} / ${stats.buyerBlocks}`} hint="Suspended / blocked" />
          <Kpi label="Pardoned" value={stats.recentlyPardoned} hint="Last 7 days" />
          <Kpi label="Restored" value={stats.recentlyRestored} hint="Last 7 days" />
        </section>
      ) : null}

      <Panel className="mb-5 overflow-hidden">
        <div className="border-b border-[#252A33] px-5 py-4">
          <SectionLabel>Find account</SectionLabel>
        </div>
        <div className="px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Name, email, store, phone, or user ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              className="sm:max-w-lg"
            />
            <Button onClick={runSearch} disabled={searching || showOffline}>
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-4 divide-y divide-[#252A33] border border-[#252A33]">
              {searchResults.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => loadProfile(u._id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm",
                    selectedId === u._id ? "bg-[#00E575]/10" : "bg-[#171B22] hover:bg-[#1C2129]"
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.name || "—"}</p>
                    <p className="truncate text-xs text-[#737A86]">
                      {u.email} · {u.role}
                      {u.storeName ? ` · ${u.storeName}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge tone={toneForStatus(u.moderation?.buyer?.status || "NORMAL")}>
                      Buyer · {u.moderation?.buyer?.status || "NORMAL"}
                    </Badge>
                    <Badge tone={toneForStatus(u.moderation?.seller?.status || "NORMAL")}>
                      Seller · {u.moderation?.seller?.status || "NORMAL"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Panel>

      {profileLoading && (
        <div className="mb-5 border border-[#252A33] bg-[#11141A]">
          <OrbLoader label="Loading account" />
        </div>
      )}

      {!profileLoading && profile && (
        <div className="mb-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#252A33] px-5 py-5">
              <div className="min-w-0">
                <SectionLabel>Account</SectionLabel>
                <h2 className="mt-1 truncate text-xl font-semibold">{profile.user.name || "—"}</h2>
                <p className="truncate text-sm text-[#A7ADB8]">{profile.user.email}</p>
              </div>
              <div className="flex gap-2">
                <Button tone="ghost" className="h-9 text-xs" onClick={() => setActivityOpen(true)}>
                  See user activity
                </Button>
                <Button tone="ghost" className="h-9 text-xs" onClick={refreshAll}>
                  Refresh
                </Button>
              </div>
            </div>

            <div className="grid gap-px bg-[#252A33] sm:grid-cols-2">
              {(["buyer", "seller"] as const).map((sideKey) => {
                const s = sideKey === "buyer" ? profile.buyer : profile.seller;
                return (
                  <button
                    key={sideKey}
                    type="button"
                    onClick={() => {
                      setContext(sideKey);
                      setActiveAction(null);
                      setReason("");
                    }}
                    className={cn("bg-[#11141A] p-5 text-left", context === sideKey && "bg-[#041412]")}
                  >
                    <SectionLabel>{sideKey === "buyer" ? "Buyer / General" : "Seller World"}</SectionLabel>
                    <div className="mt-3">
                      <Badge tone={toneForStatus(s.status)}>{s.status}</Badge>
                    </div>
                    {s.endsAt && s.status === "SUSPENDED" && (
                      <p className="mt-2 text-xs text-[#A7ADB8]">
                        Internal · {fmt(s.endsAt)} · {remaining(s.endsAt)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </Panel>

          <aside className="xl:sticky xl:top-6">
            <Panel className="overflow-hidden">
              <div className="border-b border-[#252A33] px-5 py-4">
                <SectionLabel>Enforcement</SectionLabel>
                <p className="mt-1.5 text-sm text-[#A7ADB8]">
                  Buttons follow the current status. Clock times stay internal.
                </p>
              </div>
              <div className="space-y-4 px-5 py-4">
                <div className="grid grid-cols-2 gap-px border border-[#252A33] bg-[#252A33]">
                  {(["buyer", "seller"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setContext(c);
                        setActiveAction(null);
                        setReason("");
                      }}
                      className={cn(
                        "h-10 text-xs font-semibold",
                        context === c ? "bg-[#00E575] text-[#041412]" : "bg-[#171B22] text-[#A7ADB8]"
                      )}
                    >
                      {c === "buyer" ? "Buyer" : "Seller"}
                    </button>
                  ))}
                </div>

                {side && (
                  <div className="border border-[#252A33] bg-[#171B22] p-3">
                    <Badge tone={toneForStatus(side.status)}>{side.status}</Badge>
                    {side.status === "SUSPENDED" && side.endsAt && (
                      <p className="mt-2 text-xs text-[#A7ADB8]">Internal end · {remaining(side.endsAt)}</p>
                    )}
                    {side.status === "BLOCKED" && (
                      <p className="mt-2 text-xs text-[#A7ADB8]">Until blockage is lifted</p>
                    )}
                  </div>
                )}

                {underReview && (
                  <Button className="w-full" onClick={() => setActivityOpen(true)}>
                    See user activity
                  </Button>
                )}

                <div className="grid gap-2">
                  {visibleActions.map((kind) => {
                    const meta = ACTION_META[kind];
                    const isActive = activeAction === kind;
                    return (
                      <button
                        key={kind}
                        type="button"
                        disabled={busy || showOffline}
                        onClick={() => {
                          setActiveAction(isActive ? null : kind);
                          setError("");
                        }}
                        className={cn(
                          "h-11 border px-3 text-left text-sm font-semibold disabled:opacity-50",
                          isActive
                            ? "border-[#00E575]/40 bg-[#00E575]/10 text-[#00E575]"
                            : meta.tone === "danger"
                              ? "border-red-500/30 bg-red-500/5 text-red-300"
                              : meta.tone === "primary"
                                ? "border-[#00E575]/30 bg-[#00E575]/5 text-[#00E575]"
                                : "border-[#252A33] bg-[#171B22] text-[#A7ADB8]"
                        )}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>

                {activeAction && (
                  <div className="space-y-3 border border-amber-500/25 bg-amber-500/5 p-3">
                    <p className="text-sm font-semibold text-amber-100">{ACTION_META[activeAction].label}</p>
                    <p className="text-xs text-[#A7ADB8]">{ACTION_META[activeAction].hint}</p>
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Internal reason…"
                    />
                    {activeAction === "suspend" && (
                      <div className="space-y-2">
                        <Select value={hourPreset} onChange={(e) => setHourPreset(e.target.value)} className="w-full">
                          {HOUR_PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </Select>
                        {hourPreset === "custom" && (
                          <Input
                            type="number"
                            min={1}
                            value={customHours}
                            onChange={(e) => setCustomHours(e.target.value)}
                            placeholder="Hours"
                          />
                        )}
                        <p className="text-[10px] text-[#737A86]">Users never see this duration.</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button disabled={busy || showOffline} onClick={executeAction}>
                        {busy ? "Working…" : "Confirm"}
                      </Button>
                      <Button tone="ghost" onClick={() => setActiveAction(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          </aside>
        </div>
      )}

      <Panel className="mb-5 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#252A33] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionLabel>Active cases</SectionLabel>
          <div className="flex flex-wrap gap-2">
            <Select
              value={caseFilter.context}
              onChange={(e) => setCaseFilter((f) => ({ ...f, context: e.target.value }))}
              className="w-36"
            >
              <option value="">All contexts</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
            </Select>
            <Select
              value={caseFilter.status}
              onChange={(e) => setCaseFilter((f) => ({ ...f, status: e.target.value }))}
              className="w-40"
            >
              <option value="">All statuses</option>
              <option value="UNDER_REVIEW">Under review</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="BLOCKED">Blocked</option>
            </Select>
            <Button tone="ghost" className="h-10" onClick={loadCases}>
              Apply
            </Button>
          </div>
        </div>
        <div className="p-5">
          {cases.length === 0 ? (
            <EmptyState title="No active cases" body="Activity checks and suspensions appear here." />
          ) : (
            <div className="space-y-2">
              {cases.map((c) => (
                <div
                  key={c._id}
                  className="flex flex-col gap-3 border border-[#252A33] bg-[#171B22] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.user?.name || "User"} · {c.user?.email}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <Badge tone="neutral">{c.context}</Badge>
                      <Badge tone={toneForStatus(c.status)}>{c.status}</Badge>
                    </div>
                  </div>
                  {c.user?._id && (
                    <Button tone="ghost" className="h-8 text-xs" onClick={() => loadProfile(c.user._id)}>
                      Open
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {activeCaseId && (
            <div className="mt-4 border border-[#252A33] p-4">
              <Input value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Internal note…" />
              <div className="mt-2 flex gap-2">
                <Button onClick={addNote}>Save note</Button>
                <Button tone="ghost" onClick={() => setActiveCaseId("")}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {activityOpen && profile && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setActivityOpen(false)}
          />
          <aside
            className={cn(
              poppins.className,
              "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#252A33] bg-[#0D1015]"
            )}
          >
            <div className="flex items-center justify-between border-b border-[#252A33] px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00E575]">
                  User activity
                </p>
                <p className="mt-0.5 text-sm font-medium">{profile.user.name}</p>
              </div>
              <Button tone="ghost" className="h-9 w-9 p-0" onClick={() => setActivityOpen(false)}>
                ✕
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {health && (
                <div className="mb-6 border border-[#252A33] bg-[#11141A] p-4">
                  <SectionLabel>Activity health</SectionLabel>
                  <div className="mt-3 flex items-end gap-3">
                    <span className="text-4xl font-semibold tabular-nums">{health.score}</span>
                    <Badge tone={health.tone}>{health.conclusion}</Badge>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {health.signals.map((s, i) => (
                      <li key={i} className="text-xs text-[#A7ADB8]">
                        · {s}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[10px] text-[#737A86]">
                    Rule-based review aid. Treat as a prompt to look closer, not a verdict.
                  </p>
                </div>
              )}

              <section className="mb-6">
                <SectionLabel>Wishlist ({profile.wishlist?.length || 0})</SectionLabel>
                {profile.wishlist?.length ? (
                  <div className="mt-3 space-y-1.5">
                    {profile.wishlist.slice(0, 12).map((p: any) => (
                      <p key={p._id} className="border border-[#252A33] bg-[#171B22] px-3 py-2 text-xs">
                        {p.name || "Item"}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[#737A86]">No wishlist items.</p>
                )}
              </section>

              <section className="mb-6">
                <SectionLabel>Saved stores ({profile.savedStores?.length || 0})</SectionLabel>
                {profile.savedStores?.length ? (
                  <div className="mt-3 space-y-1.5">
                    {profile.savedStores.slice(0, 12).map((s: any) => (
                      <p key={s._id} className="border border-[#252A33] bg-[#171B22] px-3 py-2 text-xs">
                        {s.name || "Store"}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[#737A86]">No saved stores.</p>
                )}
              </section>

              <section className="mb-6">
                <SectionLabel>Payment methods ({profile.paymentMethods?.length || 0})</SectionLabel>
                {profile.paymentMethods?.length ? (
                  <div className="mt-3 space-y-1.5">
                    {profile.paymentMethods.map((p: any) => (
                      <p key={p._id} className="border border-[#252A33] bg-[#171B22] px-3 py-2 text-xs">
                        {p.brand} ···· {p.last4}
                        {p.isDefault ? " · default" : ""}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[#737A86]">No payment methods on file.</p>
                )}
              </section>

              <section className="mb-6">
                <SectionLabel>Addresses ({profile.addresses?.length || 0})</SectionLabel>
                {profile.addresses?.length ? (
                  <div className="mt-3 space-y-1.5">
                    {profile.addresses.map((a: any) => (
                      <p key={a._id} className="border border-[#252A33] bg-[#171B22] px-3 py-2 text-xs">
                        {a.type} · {a.city}, {a.state}
                        {a.isDefault ? " · default" : ""}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[#737A86]">No addresses on file.</p>
                )}
              </section>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}