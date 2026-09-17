"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Database,
  Lock,
  RefreshCw,
  Search,
  Shield,
  WifiOff,
  X,
} from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Input,
  Panel,
  cn,
} from "@/components/ui";

const GATE_KEY = "plazore.admin.moderationGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_MODERATION_PASSWORD || "";
const Z_MODAL = 9999;

type EnvKind = "development" | "production" | "unknown";
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

function detectEnvFromApi(): EnvKind {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_URL ||
    "";
  const lower = base.toLowerCase();
  if (
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes(":3000")
  )
    return "development";
  if (lower.includes("plazore") || lower.startsWith("https://"))
    return "production";
  if (process.env.NODE_ENV === "development") return "development";
  if (process.env.NODE_ENV === "production") return "production";
  return "unknown";
}

function toneForStatus(status: string) {
  if (["NORMAL", "PARDONED", "RESTORED"].includes(status))
    return "green" as const;
  if (["UNDER_REVIEW", "ACTIVITY_CHECK"].includes(status))
    return "warn" as const;
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

function money(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return String(n);
  }
}

function computeHealth(profile: Profile) {
  let score = 74;
  const signals: string[] = [];
  const reports = profile.reports?.length || 0;
  const buyerOrders = profile.activity.orderAsBuyer || 0;
  const sellerOrders = profile.activity.orderAsSeller || 0;
  const products = profile.activity.productCount || 0;
  const addresses =
    profile.addresses?.length || profile.activity.addressCount || 0;
  const payments =
    profile.paymentMethods?.length || profile.activity.paymentMethodCount || 0;
  const wishlist =
    profile.wishlist?.length || profile.activity.wishlistCount || 0;
  const saved =
    profile.savedStores?.length || profile.activity.savedStoreCount || 0;
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
    ["SUSPENDED", "BLOCKED", "ACTIVITY_CHECK_REQUESTED"].includes(e.action),
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

function DarkSelect({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ colorScheme: "dark" }}
      className={cn(
        "h-10 w-full rounded-xl border border-white/12 bg-[#14181F] px-3 text-[13px] text-[#F5F7FA] outline-none focus:border-[#00E575]/40",
        className,
      )}
    >
      {children}
    </select>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>
      <p className="mt-1.5 text-[22px] font-semibold tabular-nums leading-none text-[#F5F7FA]">
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-[11px] text-white/35">{hint}</p>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
      {children}
    </p>
  );
}

function OrderChip({ o }: { o: any }) {
  const id = o.orderNumber || o._id || "—";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
      <p className="font-mono text-[12px] font-semibold text-[#00E575]">{id}</p>
      <p className="mt-0.5 text-[11px] text-white/45">
        {fmt(o.createdAt)} · {o.orderStatus || o.status || "—"} ·{" "}
        {money(o.totalAmount ?? o.total)}
      </p>
    </div>
  );
}

function ModerationGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(GATE_KEY) === "1") setUnlocked(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EXPECTED_PASSWORD) {
      setErr("Set NEXT_PUBLIC_ADMIN_MODERATION_PASSWORD in .env");
      return;
    }
    if (password === EXPECTED_PASSWORD) {
      try {
        sessionStorage.setItem(GATE_KEY, "1");
      } catch {
        /* ignore */
      }
      setUnlocked(true);
      setErr("");
      return;
    }
    setErr("Incorrect password.");
    setShake(true);
    window.setTimeout(() => setShake(false), 420);
  };

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-white/35">
        …
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 text-[#F5F7FA]">
        <div
          className={cn(
            "rounded-2xl border border-white/10 bg-[#0E1116]/95 p-6 sm:p-8",
            shake && "animate-[plazore-shake_0.4s_ease-in-out]",
          )}
        >
          <div className="h-px bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />
          <div className="mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
            <Lock className="h-4 w-4 text-[#00E575]" />
          </div>
          <p className="mt-4 text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
            RESTRICTED
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Moderation</h1>
          <p className="mt-2 text-[13px] text-white/45">
            Enter access password to continue.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access password"
              className="h-12 w-full rounded-xl border border-white/12 bg-[#14181F] px-4 text-sm text-[#F5F7FA] outline-none focus:border-[#00E575]/45"
            />
            {err && <p className="text-xs text-red-400">{err}</p>}
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6] text-sm font-extrabold text-[#041412]"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/** Portaled activity dossier — viewport fixed, same pattern as Users */
function ActivityModal({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
}) {
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const health = profile ? computeHealth(profile) : null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
    }
  }, [open, profile?.user?._id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !profile) return null;

  const buyerOrders = profile.activity.recentOrdersBuyer || [];
  const sellerOrders = profile.activity.recentOrdersSeller || [];

  return createPortal(
    <div
      className={cn(
        "flex items-end justify-center sm:items-center sm:p-6",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      style={{ position: "fixed", inset: 0, zIndex: Z_MODAL }}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/70 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex w-full max-w-lg flex-col max-h-[min(92dvh,900px)]",
          "rounded-t-3xl border border-white/10 bg-[#0A0D12] shadow-[0_40px_100px_rgba(0,0,0,0.7)] sm:rounded-3xl",
          "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-10 scale-[0.97] opacity-0",
        )}
      >
        <div className="h-[2px] shrink-0 bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />
        <div className="flex h-12 shrink-0 items-center justify-between px-4 sm:px-5">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-[#00E575]">
            ACTIVITY DOSSIER
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/50 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 sm:px-5"
        >
          <p className="text-sm font-medium text-[#F5F7FA]">
            {profile.user.name}
          </p>
          <p className="text-xs text-white/40">{profile.user.email}</p>

          {health && (
            <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
              <SectionLabel>Activity health</SectionLabel>
              <div className="mt-3 flex items-end gap-3">
                <span className="text-4xl font-semibold tabular-nums">
                  {health.score}
                </span>
                <Badge tone={health.tone}>{health.conclusion}</Badge>
              </div>
              <ul className="mt-3 space-y-1.5">
                {health.signals.map((s, i) => (
                  <li key={i} className="text-xs text-white/50">
                    · {s}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[10px] text-white/30">
                Rule-based review aid — not a verdict.
              </p>
            </div>
          )}

          <div className="mt-4 space-y-4">
            <section>
              <SectionLabel>
                Orders as buyer ({buyerOrders.length})
              </SectionLabel>
              <div className="mt-2 space-y-1.5">
                {buyerOrders.length === 0 ? (
                  <p className="text-xs text-white/35">None</p>
                ) : (
                  buyerOrders.map((o: any, i: number) => (
                    <OrderChip key={o._id || i} o={o} />
                  ))
                )}
              </div>
            </section>

            <section>
              <SectionLabel>
                Orders as seller ({sellerOrders.length})
              </SectionLabel>
              <div className="mt-2 space-y-1.5">
                {sellerOrders.length === 0 ? (
                  <p className="text-xs text-white/35">None</p>
                ) : (
                  sellerOrders.map((o: any, i: number) => (
                    <OrderChip key={o._id || i} o={o} />
                  ))
                )}
              </div>
            </section>

            <section>
              <SectionLabel>
                Wishlist ({profile.wishlist?.length || 0})
              </SectionLabel>
              {profile.wishlist?.length ? (
                <div className="mt-2 space-y-1.5">
                  {profile.wishlist.slice(0, 20).map((p: any) => (
                    <p
                      key={p._id}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs"
                    >
                      {p.name || p.title || "Item"}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-white/35">Empty</p>
              )}
            </section>

            <section>
              <SectionLabel>
                Saved stores ({profile.savedStores?.length || 0})
              </SectionLabel>
              {profile.savedStores?.length ? (
                <div className="mt-2 space-y-1.5">
                  {profile.savedStores.slice(0, 12).map((s: any) => (
                    <p
                      key={s._id}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs"
                    >
                      {s.name || s.storeName || "Store"}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-white/35">None</p>
              )}
            </section>

            <section>
              <SectionLabel>
                Payment methods ({profile.paymentMethods?.length || 0})
              </SectionLabel>
              {profile.paymentMethods?.length ? (
                <div className="mt-2 space-y-1.5">
                  {profile.paymentMethods.map((p: any) => (
                    <p
                      key={p._id}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs"
                    >
                      {p.brand} ···· {p.last4}
                      {p.isDefault ? " · default" : ""}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-white/35">None</p>
              )}
            </section>

            <section>
              <SectionLabel>
                Addresses ({profile.addresses?.length || 0})
              </SectionLabel>
              {profile.addresses?.length ? (
                <div className="mt-2 space-y-1.5">
                  {profile.addresses.map((a: any) => (
                    <p
                      key={a._id}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs"
                    >
                      {a.type} · {a.city}, {a.state}
                      {a.isDefault ? " · default" : ""}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-white/35">None</p>
              )}
            </section>

            <Link
              href={`/users?userId=${profile.user._id}`}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/12 text-sm text-white/60"
            >
              Open full user dossier
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ModerationDirectory() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const preselect = searchParams.get("userId") || "";

  const clientEnv = useMemo(() => detectEnvFromApi(), []);
  const [apiEnv, setApiEnv] = useState<EnvKind | null>(null);
  const env: EnvKind = apiEnv || clientEnv;
  const envTone =
    env === "production" ? "error" : env === "development" ? "warn" : "neutral";
  const envLabel =
    env === "production"
      ? "Production data"
      : env === "development"
        ? "Development data"
        : "Environment unknown";

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    preselect || null,
  );
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

  const durationHours =
    hourPreset === "custom" ? Number(customHours) || 0 : Number(hourPreset) || 0;

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const token = await getToken();
      const json = await adminFetch<{ data: Stats; environment?: string }>(
        "/moderation/stats",
        token,
      );
      setStats(json.data);
      if ((json as any).environment) {
        setApiEnv((json as any).environment as EnvKind);
      }
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
        const json = await adminFetch<{ data: Profile }>(
          `/moderation/users/${id}`,
          token,
        );
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
    [getToken],
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
        token,
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
    if (
      ["pardon", "suspend", "block", "lift"].includes(activeAction) &&
      !reason.trim()
    ) {
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

  const visibleActions = side ? allowedActions(side.status) : [];
  const showOffline = mounted && offline;
  const underReview =
    side?.status === "UNDER_REVIEW" || side?.status === "ACTIVITY_CHECK";

  return (
    <div className="relative mx-auto max-w-6xl pb-24 text-[#F5F7FA]">
      {showOffline && (
        <div className="mb-4 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          Offline — search and enforcement paused.
        </div>
      )}

      <header className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#00E575]/25 bg-[#041412]">
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
              <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
                TRUST & SAFETY
              </p>
              <h1 className="mt-0.5 text-[28px] font-semibold tracking-tight sm:text-[32px]">
                Moderation
              </h1>
              <p className="mt-2 max-w-xl text-[13.5px] text-white/50">
                Internal durations never appear to buyers or sellers.
              </p>
            </div>
          </div>
          <Button
            tone="ghost"
            className="h-10 gap-1.5 rounded-full border border-white/12 bg-[#14181F] text-xs"
            onClick={refreshAll}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={envTone as any}>
            <Database className="mr-1 inline h-3 w-3" />
            {envLabel}
          </Badge>
          <Badge tone="blue">
            <Shield className="mr-1 inline h-3 w-3" />
            Enforcement
          </Badge>
        </div>
      </header>

      {error && (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      )}

      {statsLoading && !stats ? (
        <div className="mb-6 overflow-hidden rounded-2xl border border-white/[0.08]">
          <OrbLoader label="Loading overview" />
        </div>
      ) : stats ? (
        <section className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Pending" value={stats.pendingChecks} hint="Active checks" />
          <Kpi label="Under review" value={stats.underReview} />
          <Kpi
            label="Seller"
            value={`${stats.sellerSuspensions} / ${stats.sellerBlocks}`}
            hint="Suspended / blocked"
          />
          <Kpi
            label="Buyer"
            value={`${stats.buyerSuspensions} / ${stats.buyerBlocks}`}
            hint="Suspended / blocked"
          />
          <Kpi label="Pardoned" value={stats.recentlyPardoned} hint="Last 7 days" />
          <Kpi label="Restored" value={stats.recentlyRestored} hint="Last 7 days" />
        </section>
      ) : null}

      <Panel className="mb-5 overflow-hidden rounded-2xl border-white/[0.08] bg-white/[0.03]">
        <div className="border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <SectionLabel>Find account</SectionLabel>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                className="rounded-xl border-white/12 bg-[#14181F] pl-10"
                placeholder="Name, email, store, phone, or user ID…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
            </div>
            <Button
              className="h-10 rounded-xl"
              onClick={runSearch}
              disabled={searching || showOffline}
            >
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.08]">
              {searchResults.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => loadProfile(u._id)}
                  className={cn(
                    "flex w-full flex-col gap-2 px-4 py-3 text-left transition sm:flex-row sm:items-center sm:justify-between",
                    selectedId === u._id
                      ? "bg-[#00E575]/10"
                      : "bg-white/[0.02] hover:bg-white/[0.04]",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.name || "—"}</p>
                    <p className="truncate text-xs text-white/40">
                      {u.email} · {u.role}
                      {u.storeName ? ` · ${u.storeName}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      tone={toneForStatus(
                        u.moderation?.buyer?.status || "NORMAL",
                      )}
                    >
                      Buyer · {u.moderation?.buyer?.status || "NORMAL"}
                    </Badge>
                    <Badge
                      tone={toneForStatus(
                        u.moderation?.seller?.status || "NORMAL",
                      )}
                    >
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
        <div className="mb-5 overflow-hidden rounded-2xl border border-white/[0.08]">
          <OrbLoader label="Loading account" />
        </div>
      )}

      {!profileLoading && profile && (
        <div className="mb-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          <Panel className="overflow-hidden rounded-2xl border-white/[0.08] bg-white/[0.03]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <SectionLabel>Account</SectionLabel>
                <h2 className="mt-1 truncate text-xl font-semibold">
                  {profile.user.name || "—"}
                </h2>
                <p className="truncate text-sm text-white/45">
                  {profile.user.email}
                </p>
                {profile.user.marketplaceRegion && (
                  <p className="mt-1 text-xs text-white/35">
                    Region · {profile.user.marketplaceRegion}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  tone="ghost"
                  className="h-9 gap-1.5 rounded-xl text-xs"
                  onClick={() => setActivityOpen(true)}
                >
                  <Activity className="h-3.5 w-3.5" />
                  Activity
                </Button>
                <Button
                  tone="ghost"
                  className="h-9 rounded-xl text-xs"
                  onClick={refreshAll}
                >
                  Refresh
                </Button>
              </div>
            </div>

            <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
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
                    className={cn(
                      "rounded-2xl border p-4 text-left transition",
                      context === sideKey
                        ? "border-[#00E575]/35 bg-[#00E575]/10"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/15",
                    )}
                  >
                    <SectionLabel>
                      {sideKey === "buyer" ? "Buyer / General" : "Seller World"}
                    </SectionLabel>
                    <div className="mt-3">
                      <Badge tone={toneForStatus(s.status)}>{s.status}</Badge>
                    </div>
                    {s.endsAt && s.status === "SUSPENDED" && (
                      <p className="mt-2 text-xs text-white/45">
                        Internal · {fmt(s.endsAt)} · {remaining(s.endsAt)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </Panel>

          <aside className="lg:sticky lg:top-6">
            <Panel className="overflow-hidden rounded-2xl border-white/[0.08] bg-white/[0.03]">
              <div className="border-b border-white/[0.06] px-4 py-4">
                <SectionLabel>Enforcement</SectionLabel>
                <p className="mt-1.5 text-[13px] text-white/45">
                  Actions follow status. Clock times stay internal.
                </p>
              </div>
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 p-1">
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
                        "h-9 rounded-lg text-xs font-semibold transition",
                        context === c
                          ? "bg-[#00E575] text-[#041412]"
                          : "text-white/50 hover:text-white",
                      )}
                    >
                      {c === "buyer" ? "Buyer" : "Seller"}
                    </button>
                  ))}
                </div>

                {side && (
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                    <Badge tone={toneForStatus(side.status)}>
                      {side.status}
                    </Badge>
                    {side.status === "SUSPENDED" && side.endsAt && (
                      <p className="mt-2 text-xs text-white/45">
                        Internal end · {remaining(side.endsAt)}
                      </p>
                    )}
                    {side.status === "BLOCKED" && (
                      <p className="mt-2 text-xs text-white/45">
                        Until blockage is lifted
                      </p>
                    )}
                  </div>
                )}

                {underReview && (
                  <Button
                    className="w-full rounded-xl"
                    onClick={() => setActivityOpen(true)}
                  >
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
                          "h-11 rounded-xl border px-3 text-left text-sm font-semibold disabled:opacity-50",
                          isActive
                            ? "border-[#00E575]/40 bg-[#00E575]/10 text-[#00E575]"
                            : meta.tone === "danger"
                              ? "border-red-500/30 bg-red-500/5 text-red-300"
                              : meta.tone === "primary"
                                ? "border-[#00E575]/30 bg-[#00E575]/5 text-[#00E575]"
                                : "border-white/10 bg-white/[0.03] text-white/55",
                        )}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>

                {activeAction && (
                  <div className="space-y-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-3">
                    <p className="text-sm font-semibold text-amber-100">
                      {ACTION_META[activeAction].label}
                    </p>
                    <p className="text-xs text-white/50">
                      {ACTION_META[activeAction].hint}
                    </p>
                    <Input
                      className="rounded-xl border-white/12 bg-[#14181F]"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Internal reason…"
                    />
                    {activeAction === "suspend" && (
                      <div className="space-y-2">
                        <DarkSelect
                          value={hourPreset}
                          onChange={setHourPreset}
                        >
                          {HOUR_PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </DarkSelect>
                        {hourPreset === "custom" && (
                          <Input
                            type="number"
                            min={1}
                            value={customHours}
                            onChange={(e) => setCustomHours(e.target.value)}
                            placeholder="Hours"
                            className="rounded-xl border-white/12 bg-[#14181F]"
                          />
                        )}
                        <p className="text-[10px] text-white/30">
                          Users never see this duration.
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        className="rounded-xl"
                        disabled={busy || showOffline}
                        onClick={executeAction}
                      >
                        {busy ? "Working…" : "Confirm"}
                      </Button>
                      <Button
                        tone="ghost"
                        className="rounded-xl"
                        onClick={() => setActiveAction(null)}
                      >
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

      <Panel className="mb-5 overflow-hidden rounded-2xl border-white/[0.08] bg-white/[0.03]">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <SectionLabel>Active cases</SectionLabel>
          <div className="flex flex-wrap gap-2">
            <DarkSelect
              value={caseFilter.context}
              onChange={(v) =>
                setCaseFilter((f) => ({ ...f, context: v }))
              }
              className="w-36"
            >
              <option value="">All contexts</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
            </DarkSelect>
            <DarkSelect
              value={caseFilter.status}
              onChange={(v) =>
                setCaseFilter((f) => ({ ...f, status: v }))
              }
              className="w-40"
            >
              <option value="">All statuses</option>
              <option value="UNDER_REVIEW">Under review</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="BLOCKED">Blocked</option>
            </DarkSelect>
            <Button
              tone="ghost"
              className="h-10 rounded-xl"
              onClick={loadCases}
            >
              Apply
            </Button>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          {cases.length === 0 ? (
            <EmptyState
              title="No active cases"
              body="Activity checks and suspensions appear here."
            />
          ) : (
            <div className="space-y-2">
              {cases.map((c) => (
                <div
                  key={c._id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
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
                    <Button
                      tone="ghost"
                      className="h-8 rounded-xl text-xs"
                      onClick={() => loadProfile(c.user._id)}
                    >
                      Open
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {activeCaseId && (
            <div className="mt-4 rounded-2xl border border-white/[0.08] p-4">
              <Input
                className="rounded-xl border-white/12 bg-[#14181F]"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Internal note…"
              />
              <div className="mt-2 flex gap-2">
                <Button className="rounded-xl" onClick={addNote}>
                  Save note
                </Button>
                <Button
                  tone="ghost"
                  className="rounded-xl"
                  onClick={() => setActiveCaseId("")}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </Panel>

      <ActivityModal
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        profile={profile}
      />
    </div>
  );
}

export default function ModerationPage() {
  return (
    <ModerationGate>
      <ModerationDirectory />
    </ModerationGate>
  );
}