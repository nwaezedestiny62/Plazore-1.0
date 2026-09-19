"use client";

import { useAuth } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  Image as ImageIcon,
  Lock,
  Megaphone,
  RefreshCw,
  Upload,
  WifiOff,
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
  Select,
  cn,
} from "@/components/ui";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const GATE_KEY = "plazore.admin.announcementsGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_ANNOUNCEMENTS_PASSWORD || "";

/* ═══════════════════════════════════════════════
   Design system — expandable, preview-driven
═══════════════════════════════════════════════ */

type LayoutKey =
  | "stack"
  | "split"
  | "banner"
  | "card"
  | "cinema"
  | "magazine"
  | "minimal";

type ThemeKey =
  | "dark"
  | "light"
  | "brand"
  | "midnight"
  | "glass"
  | "neon"
  | "paper"
  | "ink";

type AccentKey = string; // resolved via ACCENT_MAP

type TitleSizeKey = "xs" | "sm" | "md" | "lg" | "xl" | "display";

type AspectKey =
  | "16:9"
  | "21:9"
  | "1:1"
  | "4:5"
  | "3:4"
  | "9:16"
  | "4:3"
  | "auto";

type RadiusKey = "none" | "sm" | "md" | "lg" | "xl" | "full";

type AnimKey =
  | "none"
  | "pulse"
  | "heartbeat"
  | "joggle"
  | "bounce"
  | "shimmer"
  | "glow"
  | "float"
  | "wiggle"
  | "spin-soft"
  | "shake"
  | "pop";

type DensityKey = "compact" | "comfortable" | "spacious";

type Design = {
  layout: LayoutKey;
  theme: ThemeKey;
  accent: AccentKey;
  titleSize: TitleSizeKey;
  mediaAspect: AspectKey;
  showMediaTop: boolean;
  radius: RadiusKey;
  buttonAnim: AnimKey;
  density: DensityKey;
};

const DEFAULT_DESIGN: Design = {
  layout: "stack",
  theme: "dark",
  accent: "plazore",
  titleSize: "md",
  mediaAspect: "16:9",
  showMediaTop: true,
  radius: "md",
  buttonAnim: "none",
  density: "comfortable",
};

/** accent → solid OR gradient (CSS background) */
const ACCENT_MAP: Record<
  string,
  { label: string; group: string; value: string; isGradient?: boolean }
> = {
  // Plazore core
  plazore: {
    label: "Plazore gradient",
    group: "Plazore",
    value: "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)",
    isGradient: true,
  },
  "plazore-green": {
    label: "Plazore green",
    group: "Plazore",
    value: "#00E575",
  },
  "plazore-teal": {
    label: "Plazore teal",
    group: "Plazore",
    value: "#14B8A6",
  },
  "plazore-blue": {
    label: "Plazore blue",
    group: "Plazore",
    value: "#3B82F6",
  },
  "plazore-soft": {
    label: "Plazore soft",
    group: "Plazore",
    value: "linear-gradient(135deg,#5CFFB0,#00E575,#0A3D2C)",
    isGradient: true,
  },

  // Solids
  green: { label: "Green", group: "Solid", value: "#00E575" },
  emerald: { label: "Emerald", group: "Solid", value: "#10B981" },
  teal: { label: "Teal", group: "Solid", value: "#14B8A6" },
  cyan: { label: "Cyan", group: "Solid", value: "#22D3EE" },
  blue: { label: "Blue", group: "Solid", value: "#3B82F6" },
  indigo: { label: "Indigo", group: "Solid", value: "#6366F1" },
  violet: { label: "Violet", group: "Solid", value: "#8B5CF6" },
  purple: { label: "Purple", group: "Solid", value: "#A855F7" },
  fuchsia: { label: "Fuchsia", group: "Solid", value: "#D946EF" },
  pink: { label: "Pink", group: "Solid", value: "#EC4899" },
  rose: { label: "Rose", group: "Solid", value: "#F43F5E" },
  red: { label: "Red", group: "Solid", value: "#EF4444" },
  orange: { label: "Orange", group: "Solid", value: "#F97316" },
  amber: { label: "Amber", group: "Solid", value: "#F59E0B" },
  yellow: { label: "Yellow", group: "Solid", value: "#EAB308" },
  lime: { label: "Lime", group: "Solid", value: "#84CC16" },
  neutral: { label: "Neutral", group: "Solid", value: "#A7ADB8" },
  white: { label: "White", group: "Solid", value: "#F5F7FA" },
  slate: { label: "Slate", group: "Solid", value: "#64748B" },

  // Gradients
  "aurora-green": {
    label: "Aurora green",
    group: "Gradient",
    value: "linear-gradient(90deg,#00E575,#22D3EE)",
    isGradient: true,
  },
  "ocean-depth": {
    label: "Ocean depth",
    group: "Gradient",
    value: "linear-gradient(90deg,#0EA5E9,#3B82F6,#6366F1)",
    isGradient: true,
  },
  sunset: {
    label: "Sunset",
    group: "Gradient",
    value: "linear-gradient(90deg,#F59E0B,#F97316,#EF4444)",
    isGradient: true,
  },
  twilight: {
    label: "Twilight",
    group: "Gradient",
    value: "linear-gradient(90deg,#8B5CF6,#EC4899,#F43F5E)",
    isGradient: true,
  },
  mint: {
    label: "Mint glass",
    group: "Gradient",
    value: "linear-gradient(135deg,#A7F3D0,#6EE7B7,#14B8A6)",
    isGradient: true,
  },
  cosmic: {
    label: "Cosmic",
    group: "Gradient",
    value: "linear-gradient(135deg,#3B82F6,#8B5CF6,#EC4899)",
    isGradient: true,
  },
  gold: {
    label: "Gold rush",
    group: "Gradient",
    value: "linear-gradient(90deg,#FDE68A,#F59E0B,#B45309)",
    isGradient: true,
  },
  ice: {
    label: "Ice",
    group: "Gradient",
    value: "linear-gradient(90deg,#E0F2FE,#7DD3FC,#38BDF8)",
    isGradient: true,
  },
  neon: {
    label: "Neon pulse",
    group: "Gradient",
    value: "linear-gradient(90deg,#00E575,#D946EF,#3B82F6)",
    isGradient: true,
  },
  charcoal: {
    label: "Charcoal fade",
    group: "Gradient",
    value: "linear-gradient(90deg,#737A86,#A7ADB8,#F5F7FA)",
    isGradient: true,
  },

  // Seasons
  spring: {
    label: "Spring bloom",
    group: "Season",
    value: "linear-gradient(90deg,#86EFAC,#4ADE80,#22C55E)",
    isGradient: true,
  },
  summer: {
    label: "Summer heat",
    group: "Season",
    value: "linear-gradient(90deg,#FDE047,#FB923C,#F43F5E)",
    isGradient: true,
  },
  autumn: {
    label: "Autumn leaf",
    group: "Season",
    value: "linear-gradient(90deg,#FBBF24,#F97316,#B45309)",
    isGradient: true,
  },
  winter: {
    label: "Winter frost",
    group: "Season",
    value: "linear-gradient(90deg,#E0E7FF,#93C5FD,#64748B)",
    isGradient: true,
  },

  // Events / festivals
  newyear: {
    label: "New Year",
    group: "Event",
    value: "linear-gradient(90deg,#FDE68A,#A78BFA,#3B82F6)",
    isGradient: true,
  },
  valentine: {
    label: "Valentine",
    group: "Event",
    value: "linear-gradient(90deg,#FB7185,#E11D48,#BE123C)",
    isGradient: true,
  },
  easter: {
    label: "Easter",
    group: "Event",
    value: "linear-gradient(90deg,#FBCFE8,#C4B5FD,#86EFAC)",
    isGradient: true,
  },
  independence: {
    label: "Independence",
    group: "Event",
    value: "linear-gradient(90deg,#22C55E,#FFFFFF,#15803D)",
    isGradient: true,
  },
  halloween: {
    label: "Halloween",
    group: "Event",
    value: "linear-gradient(90deg,#F97316,#7C2D12,#1C1917)",
    isGradient: true,
  },
  diwali: {
    label: "Diwali",
    group: "Event",
    value: "linear-gradient(90deg,#FDE047,#F59E0B,#DC2626)",
    isGradient: true,
  },
  christmas: {
    label: "Christmas",
    group: "Event",
    value: "linear-gradient(90deg,#22C55E,#EF4444,#F5F7FA)",
    isGradient: true,
  },
  ramadan: {
    label: "Ramadan",
    group: "Event",
    value: "linear-gradient(90deg,#0F766E,#14B8A6,#FDE68A)",
    isGradient: true,
  },
  blackfriday: {
    label: "Black Friday",
    group: "Event",
    value: "linear-gradient(90deg,#111827,#6B7280,#F59E0B)",
    isGradient: true,
  },
  cybermonday: {
    label: "Cyber Monday",
    group: "Event",
    value: "linear-gradient(90deg,#06B6D4,#3B82F6,#8B5CF6)",
    isGradient: true,
  },
};

const ACCENT_GROUPS = [
  "Plazore",
  "Solid",
  "Gradient",
  "Season",
  "Event",
] as const;

type Announcement = {
  _id: string;
  headline?: string;
  body?: string;
  mediaType?: "none" | "image" | "video";
  mediaUrl?: string;
  mediaPosterUrl?: string;
  audience?: "all" | "buyers" | "sellers";
  status?: "draft" | "published" | "archived";
  actionLabel?: string;
  actionRoute?: string;
  design?: Partial<Design>;
  allowsReply?: boolean;
  publishedAt?: string;
  expiresAt?: string | null;
  deliveredCount?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: { name?: string; email?: string };
};

function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function statusTone(
  s?: string,
): "green" | "error" | "blue" | "warn" | "neutral" {
  if (s === "published") return "green";
  if (s === "archived") return "neutral";
  if (s === "draft") return "warn";
  return "neutral";
}

function accentStyle(key: string): CSSProperties {
  const a = ACCENT_MAP[key] || ACCENT_MAP.plazore;
  if (a.isGradient) return { background: a.value };
  return { backgroundColor: a.value };
}

function accentColor(key: string): string {
  const a = ACCENT_MAP[key] || ACCENT_MAP.plazore;
  if (a.isGradient) return "#00E575"; // fallback for text
  return a.value;
}

/* ─── Password gate ─── */
function AnnouncementsGate({ children }: { children: ReactNode }) {
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
      setErr("Set NEXT_PUBLIC_ADMIN_ANNOUNCEMENTS_PASSWORD in .env");
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
            "rounded-2xl border border-white/10 bg-[#0E1116]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-8",
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
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Announcements
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/45">
            Enter access password to design and publish platform notices.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access password"
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-white/12 bg-[#14181F] px-4 text-sm text-[#F5F7FA] outline-none placeholder:text-white/30 focus:border-[#00E575]/45"
            />
            {err ? <p className="text-xs text-red-400">{err}</p> : null}
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6] text-sm font-extrabold text-[#041412] transition hover:brightness-105"
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

/* ─── Live preview (fully design-driven) ─── */
function LivePreview({
  headline,
  body,
  mediaType,
  mediaUrl,
  mediaPosterUrl,
  actionLabel,
  design,
}: {
  headline: string;
  body: string;
  mediaType: string;
  mediaUrl: string;
  mediaPosterUrl: string;
  actionLabel: string;
  design: Design;
}) {
  const accent = ACCENT_MAP[design.accent] || ACCENT_MAP.plazore;
  const isLight =
    design.theme === "light" ||
    design.theme === "paper" ||
    design.theme === "brand";

  const themeBg: Record<ThemeKey, string> = {
    dark: "border-white/[0.08] bg-[#11141A] text-[#F5F7FA]",
    light: "border-black/10 bg-[#F5F7FA] text-[#0C0F14]",
    brand: "border-[#00E575]/25 bg-[#0A1210] text-[#F5F7FA]",
    midnight: "border-indigo-500/20 bg-[#0B0F1A] text-[#E8EAFF]",
    glass: "border-white/15 bg-white/[0.06] text-[#F5F7FA] backdrop-blur-md",
    neon: "border-[#00E575]/40 bg-[#050807] text-[#E8FFF4]",
    paper: "border-amber-900/15 bg-[#FBF7F0] text-[#1C1917]",
    ink: "border-white/10 bg-[#0A0A0B] text-[#FAFAFA]",
  };

  const titleCls: Record<TitleSizeKey, string> = {
    xs: "text-sm",
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
    xl: "text-3xl",
    display: "text-4xl tracking-tight",
  };

  const aspectCls: Record<AspectKey, string> = {
    "16:9": "aspect-video",
    "21:9": "aspect-[21/9]",
    "1:1": "aspect-square",
    "4:5": "aspect-[4/5]",
    "3:4": "aspect-[3/4]",
    "9:16": "aspect-[9/16]",
    "4:3": "aspect-[4/3]",
    auto: "min-h-[120px]",
  };

  const radiusCls: Record<RadiusKey, string> = {
    none: "rounded-none",
    sm: "rounded-md",
    md: "rounded-xl",
    lg: "rounded-2xl",
    xl: "rounded-3xl",
    full: "rounded-[2rem]",
  };

  const padCls: Record<DensityKey, string> = {
    compact: "p-3",
    comfortable: "p-4",
    spacious: "p-6",
  };

  const animCls: Record<AnimKey, string> = {
    none: "",
    pulse: "ann-anim-pulse",
    heartbeat: "ann-anim-heartbeat",
    joggle: "ann-anim-joggle",
    bounce: "ann-anim-bounce",
    shimmer: "ann-anim-shimmer",
    glow: "ann-anim-glow",
    float: "ann-anim-float",
    wiggle: "ann-anim-wiggle",
    "spin-soft": "ann-anim-spin-soft",
    shake: "ann-anim-shake",
    pop: "ann-anim-pop",
  };

  const showMedia =
    mediaType !== "none" && !!mediaUrl && design.showMediaTop !== false;

  const mediaBlock = showMedia ? (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-[#0C0F14]",
        aspectCls[design.mediaAspect],
      )}
    >
      {mediaType === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <>
          {mediaPosterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaPosterUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-2xl text-white">▶</span>
          </div>
        </>
      )}
    </div>
  ) : null;

  const cta =
    actionLabel.trim().length > 0 ? (
      <div
        className={cn(
          "mt-4 inline-flex px-3.5 py-2 text-xs font-bold text-[#041412]",
          radiusCls[design.radius === "full" ? "full" : "sm"],
          animCls[design.buttonAnim],
        )}
        style={accentStyle(design.accent)}
      >
        {actionLabel}
      </div>
    ) : null;

  const bodyText = (
    <div className={padCls[design.density]}>
      <div className="mb-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
        <span style={{ color: accentColor(design.accent) }}>Announcement</span>
        <span className={isLight ? "text-black/40" : "text-white/35"}>
          No reply
        </span>
      </div>
      <p className={cn("font-semibold leading-snug", titleCls[design.titleSize])}>
        {headline || "Headline"}
      </p>
      <p
        className={cn(
          "mt-2 text-sm leading-relaxed whitespace-pre-wrap",
          isLight ? "text-[#4B5563]" : "text-[#A7ADB8]",
        )}
      >
        {body || "Body text…"}
      </p>
      {cta}
    </div>
  );

  // Layout variants
  let content: ReactNode = null;
  if (design.layout === "split") {
    content = (
      <>
        {bodyText}
        {mediaBlock}
      </>
    );
  } else if (design.layout === "cinema" || design.layout === "banner") {
    content = (
      <>
        {mediaBlock}
        {bodyText}
      </>
    );
  } else if (design.layout === "magazine") {
    content = (
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {mediaBlock}
        {bodyText}
      </div>
    );
  } else if (design.layout === "minimal") {
    content = bodyText;
  } else {
    // stack | card
    content = (
      <>
        {mediaBlock}
        {bodyText}
      </>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden border transition-all duration-200",
        themeBg[design.theme],
        radiusCls[design.radius],
      )}
    >
      <div className="h-[3px] w-full" style={accentStyle(design.accent)} />
      {content}
    </div>
  );
}

/* ─── Page ─── */
function AnnouncementsInner() {
  const { getToken } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [offline, setOffline] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "buyers" | "sellers">("all");
  const [mediaType, setMediaType] = useState<"none" | "image" | "video">("none");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaPosterUrl, setMediaPosterUrl] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [actionRoute, setActionRoute] = useState("");
  const [design, setDesign] = useState<Design>({ ...DEFAULT_DESIGN });
  const [uploadBusy, setUploadBusy] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLInputElement>(null);
  const showOffline = mounted && offline;

  const setDesignField = useCallback(
    <K extends keyof Design>(key: K, value: Design[K]) => {
      setDesign((d) => ({ ...d, [key]: value }));
    },
    [],
  );

  useEffect(() => {
    setMounted(true);
    const sync = () =>
      setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const load = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOffline(true);
      setError("You’re offline.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const token = await getToken();
      if (!token) {
        setError("Session expired. Sign in again.");
        return;
      }
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const json = await adminFetch<{ data: Announcement[] }>(
        `/admin/announcements?${params}`,
        token,
      );
      setItems(json.data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }, [getToken, statusFilter]);

  useEffect(() => {
    if (!mounted) return;
    load();
  }, [mounted, load]);

  const resetEditor = () => {
    setEditingId(null);
    setHeadline("");
    setBody("");
    setAudience("all");
    setMediaType("none");
    setMediaUrl("");
    setMediaPosterUrl("");
    setActionLabel("");
    setActionRoute("");
    setDesign({ ...DEFAULT_DESIGN });
  };

  const openEdit = (a: Announcement) => {
    setEditingId(a._id);
    setHeadline(a.headline || "");
    setBody(a.body || "");
    setAudience((a.audience as any) || "all");
    setMediaType((a.mediaType as any) || "none");
    setMediaUrl(a.mediaUrl || "");
    setMediaPosterUrl(a.mediaPosterUrl || "");
    setActionLabel(a.actionLabel || "");
    setActionRoute(a.actionRoute || "");
    setDesign({ ...DEFAULT_DESIGN, ...(a.design || {}) });
  };

  const saveDraft = async () => {
    if (showOffline || busy) return;
    const h = headline.trim();
    const b = body.trim();
    if (!h || !b) {
      setError("Headline and body are required.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const token = await getToken();
      if (!token) {
        setError("Session expired.");
        return;
      }
      const payload = {
        headline: h,
        body: b,
        audience,
        mediaType,
        mediaUrl,
        mediaPosterUrl,
        actionLabel,
        actionRoute,
        design,
      };
      if (editingId) {
        await adminFetch(`/admin/announcements/${editingId}`, token, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        const json = await adminFetch<{ data: Announcement }>(
          `/admin/announcements`,
          token,
          { method: "POST", body: JSON.stringify(payload) },
        );
        if (json.data?._id) setEditingId(json.data._id);
      }
      await load();
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const publish = async (id: string) => {
    if (showOffline || busy) return;
    try {
      setBusy(true);
      setError("");
      const token = await getToken();
      const json = await adminFetch<{ deliveredCount?: number }>(
        `/admin/announcements/${id}/publish`,
        token,
        { method: "POST", body: JSON.stringify({}) },
      );
      await load();
      alert(
        `Published. Delivered to ${json.deliveredCount ?? "—"} users (snapshot at publish time).`,
      );
    } catch (e: any) {
      setError(e?.message || "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string) => {
    if (showOffline || busy) return;
    try {
      setBusy(true);
      const token = await getToken();
      await adminFetch(`/admin/announcements/${id}/archive`, token, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await load();
    } catch (e: any) {
      setError(e?.message || "Archive failed");
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = async (file: File, kind: "image" | "video") => {
    if (showOffline) return;
    try {
      setUploadBusy(true);
      setError("");
      const token = await getToken();
      if (!token) {
        setError("Session expired.");
        return;
      }
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const base =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${base}/admin/announcements/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Upload failed");
      }
      const url = json.data?.url || "";
      if (kind === "image") {
        setMediaType("image");
        setMediaUrl(url);
      } else {
        setMediaType("video");
        setMediaUrl(url);
      }
    } catch (e: any) {
      setError(e?.message || "Upload failed — check Supabase env & bucket");
    } finally {
      setUploadBusy(false);
    }
  };

  const uploadPoster = async (file: File) => {
    if (showOffline) return;
    try {
      setUploadBusy(true);
      const token = await getToken();
      if (!token) return;
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "image");
      const base =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${base}/admin/announcements/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Poster upload failed");
      }
      setMediaPosterUrl(json.data?.url || "");
    } catch (e: any) {
      setError(e?.message || "Poster upload failed");
    } finally {
      setUploadBusy(false);
    }
  };

  const accentOptions = useMemo(() => {
    return ACCENT_GROUPS.map((group) => ({
      group,
      items: Object.entries(ACCENT_MAP).filter(([, v]) => v.group === group),
    }));
  }, []);

  return (
    <div
      className={cn(
        poppins.className,
        "relative min-h-[70vh] pb-28 text-[#F5F7FA]",
      )}
    >
      {/* Global animation keyframes — lightweight, no lag */}
      <style jsx global>{`
        @keyframes ann-pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.85;
            transform: scale(1.03);
          }
        }
        @keyframes ann-heartbeat {
          0%,
          100% {
            transform: scale(1);
          }
          14% {
            transform: scale(1.08);
          }
          28% {
            transform: scale(1);
          }
          42% {
            transform: scale(1.06);
          }
          70% {
            transform: scale(1);
          }
        }
        @keyframes ann-joggle {
          0%,
          100% {
            transform: translateX(0) rotate(0);
          }
          25% {
            transform: translateX(-2px) rotate(-1deg);
          }
          75% {
            transform: translateX(2px) rotate(1deg);
          }
        }
        @keyframes ann-bounce {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        @keyframes ann-shimmer {
          0% {
            filter: brightness(1);
          }
          50% {
            filter: brightness(1.25);
          }
          100% {
            filter: brightness(1);
          }
        }
        @keyframes ann-glow {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(0, 229, 117, 0.35);
          }
          50% {
            box-shadow: 0 0 16px 2px rgba(0, 229, 117, 0.55);
          }
        }
        @keyframes ann-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }
        @keyframes ann-wiggle {
          0%,
          100% {
            transform: rotate(0);
          }
          25% {
            transform: rotate(-2deg);
          }
          75% {
            transform: rotate(2deg);
          }
        }
        @keyframes ann-spin-soft {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes ann-shake {
          0%,
          100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-3px);
          }
          40% {
            transform: translateX(3px);
          }
          60% {
            transform: translateX(-2px);
          }
          80% {
            transform: translateX(2px);
          }
        }
        @keyframes ann-pop {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.06);
          }
        }
        .ann-anim-pulse {
          animation: ann-pulse 1.6s ease-in-out infinite;
        }
        .ann-anim-heartbeat {
          animation: ann-heartbeat 1.2s ease-in-out infinite;
        }
        .ann-anim-joggle {
          animation: ann-joggle 0.45s ease-in-out infinite;
        }
        .ann-anim-bounce {
          animation: ann-bounce 0.9s ease-in-out infinite;
        }
        .ann-anim-shimmer {
          animation: ann-shimmer 1.8s ease-in-out infinite;
        }
        .ann-anim-glow {
          animation: ann-glow 1.6s ease-in-out infinite;
        }
        .ann-anim-float {
          animation: ann-float 2.2s ease-in-out infinite;
        }
        .ann-anim-wiggle {
          animation: ann-wiggle 0.55s ease-in-out infinite;
        }
        .ann-anim-spin-soft {
          animation: ann-spin-soft 3.5s linear infinite;
        }
        .ann-anim-shake {
          animation: ann-shake 0.5s ease-in-out infinite;
        }
        .ann-anim-pop {
          animation: ann-pop 0.8s ease-in-out infinite;
        }
      `}</style>

      {showOffline && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">You’re offline</p>
            <p className="mt-0.5 text-xs text-amber-100/80">
              Announcements need a connection.
            </p>
          </div>
        </div>
      )}

      <header className="mb-6 border-b border-white/[0.08] pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
          Platform · Design studio
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-semibold leading-none tracking-tight sm:text-[28px]">
              Announcements
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#A7ADB8]">
              One-way notices with a full design canvas. Accents, layouts,
              seasons, festivals, button motion — live on the preview.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              tone="ghost"
              className="h-9 gap-1.5 rounded-xl text-xs"
              disabled={loading || showOffline}
              onClick={() => load()}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", loading && "animate-spin")}
              />
              Refresh
            </Button>
            <Button
              className="h-9 gap-1.5 rounded-xl text-xs"
              onClick={resetEditor}
              disabled={showOffline}
            >
              <Megaphone className="h-3.5 w-3.5" />
              New draft
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ─── Editor ─── */}
        <Panel className="overflow-hidden rounded-2xl border-white/[0.08]">
          <div className="border-b border-white/[0.08] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              {editingId ? "Edit draft" : "Compose"}
            </p>
          </div>
          <div className="space-y-5 p-4 sm:p-5">
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Headline
              </p>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Short headline"
                disabled={busy || showOffline}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Body
              </p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Message users will see…"
                className="w-full rounded-xl border border-[#252A33] bg-[#11141A] px-3 py-2.5 text-sm text-[#F5F7FA] outline-none focus:border-[#00E575]/40"
                disabled={busy || showOffline}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Audience
                </p>
                <Select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as any)}
                  disabled={busy || showOffline}
                  className="rounded-xl"
                >
                  <option value="all">All users</option>
                  <option value="buyers">Buyers only</option>
                  <option value="sellers">Sellers only</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Media type
                </p>
                <Select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value as any)}
                  disabled={busy || showOffline}
                  className="rounded-xl"
                >
                  <option value="none">None</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </Select>
              </div>
            </div>

            {mediaType !== "none" && (
              <div className="space-y-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                <p className="text-xs text-[#A7ADB8]">
                  Upload to Supabase bucket <code className="text-[#00E575]">announcements</code>
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept={mediaType === "video" ? "video/*" : "image/*"}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      uploadFile(f, mediaType === "video" ? "video" : "image");
                    e.target.value = "";
                  }}
                />
                <Button
                  tone="ghost"
                  className="gap-2 rounded-xl text-xs"
                  disabled={uploadBusy || showOffline}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadBusy ? "Uploading…" : `Upload ${mediaType}`}
                </Button>
                {mediaUrl ? (
                  <p className="truncate text-[11px] text-white/35">{mediaUrl}</p>
                ) : null}
                {mediaType === "video" && (
                  <>
                    <input
                      ref={posterRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadPoster(f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      tone="ghost"
                      className="gap-2 rounded-xl text-xs"
                      disabled={uploadBusy || showOffline}
                      onClick={() => posterRef.current?.click()}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Upload poster image
                    </Button>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  CTA label
                </p>
                <Input
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  placeholder="Shop now"
                  disabled={busy || showOffline}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  CTA route
                </p>
                <Input
                  value={actionRoute}
                  onChange={(e) => setActionRoute(e.target.value)}
                  placeholder="/orders"
                  disabled={busy || showOffline}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* ═══ Design studio ═══ */}
            <div className="space-y-4 border-t border-white/[0.08] pt-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00E575]">
                  Design canvas
                </p>
                <p className="mt-1 text-[12px] text-white/40">
                  Every control updates the live preview instantly.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Layout
                  </p>
                  <Select
                    value={design.layout}
                    onChange={(e) =>
                      setDesignField("layout", e.target.value as LayoutKey)
                    }
                    className="rounded-xl"
                  >
                    <option value="stack">Stack</option>
                    <option value="split">Split</option>
                    <option value="banner">Banner</option>
                    <option value="card">Card</option>
                    <option value="cinema">Cinema</option>
                    <option value="magazine">Magazine</option>
                    <option value="minimal">Minimal (no media)</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Theme
                  </p>
                  <Select
                    value={design.theme}
                    onChange={(e) =>
                      setDesignField("theme", e.target.value as ThemeKey)
                    }
                    className="rounded-xl"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="brand">Brand</option>
                    <option value="midnight">Midnight</option>
                    <option value="glass">Glass</option>
                    <option value="neon">Neon</option>
                    <option value="paper">Paper</option>
                    <option value="ink">Ink</option>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Accent
                  </p>
                  <Select
                    value={design.accent}
                    onChange={(e) => setDesignField("accent", e.target.value)}
                    className="rounded-xl"
                  >
                    {accentOptions.map(({ group, items }) => (
                      <optgroup key={group} label={group}>
                        {items.map(([key, meta]) => (
                          <option key={key} value={key}>
                            {meta.label}
                            {meta.isGradient ? " · gradient" : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                  {/* Accent swatch */}
                  <div
                    className="mt-2 h-2 w-full rounded-full"
                    style={accentStyle(design.accent)}
                  />
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Title size
                  </p>
                  <Select
                    value={design.titleSize}
                    onChange={(e) =>
                      setDesignField(
                        "titleSize",
                        e.target.value as TitleSizeKey,
                      )
                    }
                    className="rounded-xl"
                  >
                    <option value="xs">XS</option>
                    <option value="sm">Small</option>
                    <option value="md">Medium</option>
                    <option value="lg">Large</option>
                    <option value="xl">XL</option>
                    <option value="display">Display</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Media aspect
                  </p>
                  <Select
                    value={design.mediaAspect}
                    onChange={(e) =>
                      setDesignField(
                        "mediaAspect",
                        e.target.value as AspectKey,
                      )
                    }
                    className="rounded-xl"
                  >
                    <option value="16:9">16:9</option>
                    <option value="21:9">21:9 ultrawide</option>
                    <option value="4:3">4:3</option>
                    <option value="1:1">1:1 square</option>
                    <option value="4:5">4:5 portrait</option>
                    <option value="3:4">3:4</option>
                    <option value="9:16">9:16 story</option>
                    <option value="auto">Auto</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Corner radius
                  </p>
                  <Select
                    value={design.radius}
                    onChange={(e) =>
                      setDesignField("radius", e.target.value as RadiusKey)
                    }
                    className="rounded-xl"
                  >
                    <option value="none">Sharp</option>
                    <option value="sm">Soft</option>
                    <option value="md">Rounded</option>
                    <option value="lg">Large</option>
                    <option value="xl">Extra large</option>
                    <option value="full">Pill edges</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Density
                  </p>
                  <Select
                    value={design.density}
                    onChange={(e) =>
                      setDesignField("density", e.target.value as DensityKey)
                    }
                    className="rounded-xl"
                  >
                    <option value="compact">Compact</option>
                    <option value="comfortable">Comfortable</option>
                    <option value="spacious">Spacious</option>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    CTA button animation
                  </p>
                  <Select
                    value={design.buttonAnim}
                    onChange={(e) =>
                      setDesignField("buttonAnim", e.target.value as AnimKey)
                    }
                    className="rounded-xl"
                  >
                    <option value="none">None</option>
                    <option value="pulse">Pulse</option>
                    <option value="heartbeat">Heartbeat</option>
                    <option value="joggle">Joggle</option>
                    <option value="bounce">Bounce</option>
                    <option value="shimmer">Shimmer</option>
                    <option value="glow">Glow</option>
                    <option value="float">Float</option>
                    <option value="wiggle">Wiggle</option>
                    <option value="spin-soft">Soft spin</option>
                    <option value="shake">Shake</option>
                    <option value="pop">Pop</option>
                  </Select>
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-[13px] text-[#A7ADB8]">
                <input
                  type="checkbox"
                  checked={design.showMediaTop}
                  onChange={(e) =>
                    setDesignField("showMediaTop", e.target.checked)
                  }
                  className="h-4 w-4 rounded border-white/20"
                />
                Show media in preview
              </label>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-white/[0.08] pt-4">
              <Button
                disabled={busy || showOffline}
                onClick={saveDraft}
                className="rounded-xl"
              >
                {busy ? "Saving…" : editingId ? "Save changes" : "Save draft"}
              </Button>
              {editingId && (
                <Button
                  tone="ghost"
                  disabled={busy || showOffline}
                  onClick={() => publish(editingId)}
                  className="rounded-xl"
                >
                  Publish
                </Button>
              )}
              <Button
                tone="ghost"
                disabled={busy}
                onClick={resetEditor}
                className="rounded-xl"
              >
                Clear
              </Button>
            </div>
            <p className="text-[11px] text-white/35">
              Publish notifies only users who exist at that moment. Always
              non-replyable.
            </p>
          </div>
        </Panel>

        {/* ─── Preview + list ─── */}
        <div className="space-y-4">
          <Panel className="overflow-hidden rounded-2xl border-white/[0.08]">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                Live preview
              </p>
              <span className="text-[10px] text-white/30">
                {ACCENT_MAP[design.accent]?.label || design.accent} ·{" "}
                {design.layout} · {design.theme}
              </span>
            </div>
            <div className="bg-[#080A0E] p-4 sm:p-5">
              <LivePreview
                headline={headline}
                body={body}
                mediaType={mediaType}
                mediaUrl={mediaUrl}
                mediaPosterUrl={mediaPosterUrl}
                actionLabel={actionLabel}
                design={design}
              />
            </div>
          </Panel>

          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </div>

          {loading && items.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#11141A]">
              <OrbLoader label="Loading announcements" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No announcements"
              body="Save a draft to get started."
            />
          ) : (
            <div className="space-y-2.5">
              {items.map((a) => (
                <div
                  key={a._id}
                  className="rounded-2xl border border-white/[0.08] bg-[#11141A]/90 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={statusTone(a.status)}>
                          {a.status || "—"}
                        </Badge>
                        <Badge tone="neutral">{a.audience || "all"}</Badge>
                        <Badge tone="neutral">No reply</Badge>
                      </div>
                      <p className="mt-2 font-medium text-[#F5F7FA]">
                        {a.headline}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-[#A7ADB8]">
                        {a.body}
                      </p>
                      <p className="mt-2 text-[11px] text-white/35">
                        {a.status === "published"
                          ? `Published ${fmt(a.publishedAt)} · delivered ${a.deliveredCount ?? 0}`
                          : `Updated ${fmt(a.updatedAt)}`}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        tone="ghost"
                        className="h-8 rounded-xl text-xs"
                        onClick={() => openEdit(a)}
                        disabled={showOffline}
                      >
                        Edit
                      </Button>
                      {a.status === "draft" && (
                        <Button
                          className="h-8 rounded-xl text-xs"
                          onClick={() => publish(a._id)}
                          disabled={busy || showOffline}
                        >
                          Publish
                        </Button>
                      )}
                      {a.status !== "archived" && (
                        <Button
                          tone="ghost"
                          className="h-8 rounded-xl text-xs text-amber-200"
                          onClick={() => archive(a._id)}
                          disabled={busy || showOffline}
                        >
                          Archive
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnnouncementsAdminPage() {
  return (
    <AnnouncementsGate>
      <AnnouncementsInner />
    </AnnouncementsGate>
  );
}