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
} from "react";
import { createPortal } from "react-dom";
import {
  Archive,
  ImagePlus,
  Lock,
  RefreshCw,
  Sparkles,
  Upload,
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
  Select,
  cn,
} from "@/components/ui";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const API = process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com";
const GATE_KEY = "plazore.admin.contentGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_CONTENT_PASSWORD || "";
const Z_MODAL = 9999;

type EnvKind = "development" | "production" | "unknown";

type Creative = {
  imageUrl?: string;
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
  ctaAction?: string;
  ctaTarget?: string;
  kicker?: string;
};

type Slot = {
  _id: string;
  position: number;
  controlType: "system" | "admin";
  label?: string;
  isActive?: boolean;
  published?: Creative;
  draft?: Creative;
  publishedVersion?: number;
  history?: Array<{
    version: number;
    status: string;
    publishedAt?: string;
    note?: string;
    creative?: Creative;
  }>;
  updatedAt?: string;
};

type PersonalSample = {
  _id: string;
  position: number;
  mode?: string;
  primarySignal?: string;
  categoryContext?: string;
  headline?: string;
  imageUrl?: string;
  generatedAt?: string;
  expiresAt?: string;
  user?: { name?: string; email?: string };
};

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

function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function resolveImg(src?: string) {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("data:") || src.startsWith("/"))
    return src;
  return `/${src}`;
}

/* ─── Access gate ─── */
function ContentGate({ children }: { children: ReactNode }) {
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
      setErr("Set NEXT_PUBLIC_ADMIN_CONTENT_PASSWORD in .env");
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
            Hero Banners
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/45">
            Enter the content access password to manage live hero creatives.
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

/* ─── Banner preview card ─── */
function BannerPreview({
  creative,
  position,
  controlType,
}: {
  creative: Creative;
  position: number;
  controlType: string;
}) {
  const img = resolveImg(creative.imageUrl);
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#090B0F]">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#11141A]">
          <ImagePlus className="h-8 w-8 text-white/25" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090B0F] via-[#090B0F]/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#090B0F]/45 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 max-w-[92%] p-3 sm:p-4">
        {creative.kicker ? (
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-[#00E575]">
            {creative.kicker}
          </p>
        ) : null}
        <p className="text-[15px] font-semibold leading-tight text-white sm:text-lg">
          {creative.headline || "Untitled"}
        </p>
        {creative.subheadline ? (
          <p className="mt-1 line-clamp-2 text-[11px] text-white/65">
            {creative.subheadline}
          </p>
        ) : null}
        {creative.ctaLabel ? (
          <span className="mt-2 inline-flex rounded-md border border-white/35 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white">
            {creative.ctaLabel}
          </span>
        ) : null}
      </div>
      <div className="absolute right-2 top-2">
        <Badge tone={controlType === "system" ? "blue" : "green"}>
          {controlType === "system" ? "System" : "Admin"} · #{position}
        </Badge>
      </div>
    </div>
  );
}

/* ─── Smooth popup modal (redesigned content) ─── */
function BannerModal({
  open,
  onClose,
  slot,
  draft,
  setDraft,
  diagnostics,
  recentPersonal,
  offline,
  busy,
  uploading,
  msg,
  msgTone,
  fileRef,
  onPickImage,
  onSaveDraft,
  onPublish,
  onToggleActive,
}: {
  open: boolean;
  onClose: () => void;
  slot: Slot | null;
  draft: Creative;
  setDraft: React.Dispatch<React.SetStateAction<Creative>>;
  diagnostics: PersonalSample[];
  recentPersonal: PersonalSample[];
  offline: boolean;
  busy: boolean;
  uploading: boolean;
  msg: string;
  msgTone: "ok" | "err";
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPickImage: (file: File | null) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onToggleActive: (active: boolean) => void;
}) {
  const [mounted, setMounted] = useState(false);

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
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !slot) return null;

  const isAdmin = slot.controlType === "admin";
  const systemSamples =
    diagnostics.length > 0
      ? diagnostics
      : recentPersonal.filter((p) => p.position === slot.position);

  return createPortal(
    <div
      className={cn(
        "flex items-end justify-center sm:items-center sm:p-6",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      style={{ position: "fixed", inset: 0, zIndex: Z_MODAL }}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/70 backdrop-blur-[3px] transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex w-full max-w-[460px] flex-col overflow-hidden",
          "max-h-[90vh] rounded-t-[20px] border border-white/[0.09] bg-[#0C0F14] shadow-[0_40px_100px_rgba(0,0,0,0.7)] sm:rounded-2xl",
          "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-10 scale-[0.97] opacity-0",
        )}
      >
        {/* Top accent */}
        <div className="h-[2px] shrink-0 bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00E575]">
                {isAdmin ? "Admin slot" : "System slot"}
              </span>
              <span className="text-[10px] text-white/30">·</span>
              <span className="text-[10px] font-medium text-white/40">
                Position {slot.position}
              </span>
            </div>
            <h2 className="truncate text-lg font-semibold tracking-tight text-[#F5F7FA]">
              {slot.label || `Banner ${slot.position}`}
            </h2>
            {isAdmin ? (
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <Badge tone={slot.isActive === false ? "warn" : "green"}>
                  {slot.isActive === false ? "Inactive" : "Active"}
                </Badge>
                <span className="text-[11px] text-white/35">
                  Version {slot.publishedVersion || 0}
                </span>
                {slot.updatedAt ? (
                  <span className="text-[11px] text-white/25">
                    · Updated {fmt(slot.updatedAt)}
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="text-[12px] text-white/40">
                Adaptive · locked · not editable
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/45 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-white/[0.06]" />

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {isAdmin ? (
            <div className="space-y-6">
              {/* Section: Image */}
              <section className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Banner image
                </p>
                <button
                  type="button"
                  disabled={uploading || offline}
                  onClick={() => fileRef.current?.click()}
                  className="group relative block w-full overflow-hidden rounded-xl border border-dashed border-white/12 bg-[#11141A] transition hover:border-[#00E575]/35 disabled:opacity-50"
                >
                  {draft.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveImg(draft.imageUrl)}
                      alt=""
                      className="aspect-[16/9] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2.5 text-white/30">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.05]">
                        <Upload className="h-5 w-5" />
                      </div>
                      <p className="text-[13px] font-medium text-white/50">
                        Upload banner image
                      </p>
                      <p className="text-[11px] text-white/25">
                        JPG · PNG · WEBP · max 8MB
                      </p>
                    </div>
                  )}
                  {draft.imageUrl ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition group-hover:opacity-100">
                      <span className="rounded-full bg-black/50 px-3.5 py-1.5 text-[12px] font-semibold text-white">
                        {uploading ? "Uploading…" : "Replace image"}
                      </span>
                    </div>
                  ) : null}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) =>
                    void onPickImage(e.target.files?.[0] || null)
                  }
                />
              </section>

              {/* Section: Live preview */}
              <section className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Live preview
                </p>
                <BannerPreview
                  creative={draft}
                  position={slot.position}
                  controlType="admin"
                />
              </section>

              {/* Section: Copy */}
              <section className="space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Copy & CTA
                </p>

                <div className="space-y-3.5">
                  <label className="block space-y-1.5">
                    <span className="text-[12px] font-medium text-[#A7ADB8]">
                      Kicker
                    </span>
                    <Input
                      value={draft.kicker || ""}
                      maxLength={40}
                      placeholder="e.g. NEW ARRIVAL"
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, kicker: e.target.value }))
                      }
                      className="rounded-xl"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[12px] font-medium text-[#A7ADB8]">
                      Headline
                    </span>
                    <Input
                      value={draft.headline || ""}
                      maxLength={80}
                      placeholder="Main banner title"
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, headline: e.target.value }))
                      }
                      className="rounded-xl"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[12px] font-medium text-[#A7ADB8]">
                      Supporting text
                    </span>
                    <Input
                      value={draft.subheadline || ""}
                      maxLength={160}
                      placeholder="Short supporting line"
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          subheadline: e.target.value,
                        }))
                      }
                      className="rounded-xl"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1.5">
                    <span className="text-[12px] font-medium text-[#A7ADB8]">
                      CTA label
                    </span>
                    <Input
                      value={draft.ctaLabel || ""}
                      maxLength={40}
                      placeholder="Shop now"
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          ctaLabel: e.target.value,
                        }))
                      }
                      className="rounded-xl"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[12px] mr-3 font-medium text-[#A7ADB8]">
                      CTA action
                    </span>
                    <Select
                      value={draft.ctaAction || "scroll_showroom"}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          ctaAction: e.target.value,
                        }))
                      }
                      className="rounded-xl"
                    >
                      <option value="scroll_showroom">Showroom</option>
                      <option value="category">Category</option>
                      <option value="product">Product</option>
                      <option value="store">Store</option>
                      <option value="url">URL</option>
                    </Select>
                  </label>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-[12px] font-medium text-[#A7ADB8]">
                    CTA target
                  </span>
                  <Input
                    value={draft.ctaTarget || ""}
                    placeholder="Optional — id, slug, or URL"
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        ctaTarget: e.target.value,
                      }))
                    }
                    className="rounded-xl"
                  />
                </label>
              </section>

              {/* Section: History */}
              {(slot.history?.length || 0) > 0 ? (
                <section className="space-y-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    <Archive className="h-3 w-3" />
                    Publish history
                  </p>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    {[...(slot.history || [])]
                      .reverse()
                      .slice(0, 12)
                      .map((h, i) => (
                        <div
                          key={`${h.version}-${i}`}
                          className="flex items-start justify-between gap-3 rounded-lg px-2.5 py-2 text-[12px]"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#F5F7FA]">
                              v{h.version} · {h.creative?.headline || h.status}
                            </p>
                            {h.note ? (
                              <p className="mt-0.5 truncate text-[11px] text-white/30">
                                {h.note}
                              </p>
                            ) : null}
                          </div>
                          <span className="shrink-0 text-[11px] text-white/30">
                            {fmt(h.publishedAt)}
                          </span>
                        </div>
                      ))}
                  </div>
                </section>
              ) : null}

              {/* Feedback */}
              {msg ? (
                <p
                  className={cn(
                    "rounded-xl px-3.5 py-2.5 text-[13px]",
                    msgTone === "err"
                      ? "bg-red-500/10 text-red-300"
                      : "bg-[#00E575]/10 text-[#00E575]",
                  )}
                >
                  {msg}
                </p>
              ) : null}
            </div>
          ) : (
            /* ── System slot body ── */
            <div className="space-y-6">
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.08] px-4 py-3.5 text-[13px] leading-relaxed text-blue-100/90">
                This is a system adaptive slot. It cannot be edited. Below are
                the most recent personalization cycles for this position.
              </div>

              <section className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Current sample
                </p>
                <BannerPreview
                  creative={{
                    imageUrl:
                      diagnostics[0]?.imageUrl ||
                      recentPersonal.find((p) => p.position === slot.position)
                        ?.imageUrl ||
                      "",
                    headline: diagnostics[0]?.headline || "Waiting for cycles",
                    subheadline: diagnostics[0]?.primarySignal || "—",
                    kicker: diagnostics[0]?.categoryContext || "SYSTEM",
                    ctaLabel: "Explore",
                  }}
                  position={slot.position}
                  controlType="system"
                />
              </section>

              <section className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Recent cycles
                </p>
                {systemSamples.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center text-[13px] text-white/35">
                    No adaptive cycles yet for this position.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {systemSamples.map((d) => (
                      <div
                        key={d._id}
                        className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge
                            tone={d.mode === "behavioral" ? "green" : "warn"}
                          >
                            {d.mode || "—"}
                          </Badge>
                          <span className="text-[11px] text-white/35">
                            {fmt(d.generatedAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-[13px] font-medium text-[#F5F7FA]">
                          {d.headline || "—"}
                        </p>
                        {d.primarySignal ? (
                          <p className="mt-1 text-[12px] text-white/45">
                            {d.primarySignal}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/30">
                          {d.categoryContext ? (
                            <span>{d.categoryContext}</span>
                          ) : null}
                          {d.user?.name || d.user?.email ? (
                            <span>{d.user?.name || d.user?.email}</span>
                          ) : null}
                          {d.expiresAt ? (
                            <span>Expires {fmt(d.expiresAt)}</span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* ── Footer actions (admin only) ── */}
        {isAdmin ? (
          <div className="shrink-0 space-y-2.5 border-t border-white/[0.07] bg-[#0A0C10]/90 px-5 py-4">
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                tone="ghost"
                disabled={busy || offline || uploading}
                onClick={onSaveDraft}
                className="h-11 w-full rounded-xl text-[13px]"
              >
                Save draft
              </Button>
              <Button
                disabled={busy || offline || uploading}
                onClick={onPublish}
                className="h-11 w-full rounded-xl bg-[#00E575] text-[13px] font-semibold text-[#041412] hover:brightness-105"
              >
                Publish live
              </Button>
            </div>
            <button
              type="button"
              disabled={busy || offline}
              onClick={() => onToggleActive(slot.isActive === false)}
              className="flex h-10 w-full items-center justify-center rounded-xl text-[12px] font-medium text-white/45 transition hover:bg-white/[0.04] hover:text-white/70 disabled:opacity-40"
            >
              {slot.isActive === false ? "Activate this slot" : "Deactivate this slot"}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ─── Main page ─── */
function ContentInner() {
  const { getToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const clientEnv = useMemo(() => detectEnvFromApi(), []);
  const env: EnvKind = clientEnv;
  const envTone =
    env === "production" ? "error" : env === "development" ? "warn" : "neutral";
  const envLabel =
    env === "production"
      ? "Production data"
      : env === "development"
        ? "Development data"
        : "Environment unknown";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [recentPersonal, setRecentPersonal] = useState<PersonalSample[]>([]);
  const [counts, setCounts] = useState<any>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Creative>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");
  const [diagnostics, setDiagnostics] = useState<PersonalSample[]>([]);

  const selectedSlot = useMemo(
    () => slots.find((s) => s.position === selected) || null,
    [slots, selected],
  );

  const load = useCallback(
    async (soft = false) => {
      try {
        if (!soft) setLoading(true);
        else setRefreshing(true);
        setError("");
        const token = await getToken();
        const res = await adminFetch<any>("/admin/content", token);
        setSlots(res.data?.slots || []);
        setRecentPersonal(res.data?.recentPersonal || []);
        setCounts(res.data?.counts || null);
        setOffline(false);
      } catch (e: any) {
        setOffline(typeof navigator !== "undefined" && !navigator.onLine);
        setError(e?.message || "Failed to load content");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getToken],
  );

  useEffect(() => {
    void load();
    const on = () => {
      setOffline(false);
      void load(true);
    };
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [load]);

  useEffect(() => {
    if (!selectedSlot) return;
    setMsg("");
    if (selectedSlot.controlType === "admin") {
      const src =
        selectedSlot.draft?.imageUrl || selectedSlot.draft?.headline
          ? selectedSlot.draft
          : selectedSlot.published || {};
      setDraft({ ...src });
      setDiagnostics([]);
    } else {
      setDraft({});
      void (async () => {
        try {
          const token = await getToken();
          const res = await adminFetch<any>(
            `/admin/content/diagnostics?position=${selectedSlot.position}`,
            token,
          );
          setDiagnostics(res.data || []);
        } catch {
          setDiagnostics([]);
        }
      })();
    }
  }, [selectedSlot, getToken]);

  function openSlot(position: number) {
    setSelected(position);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    // keep selected briefly so exit animation has content; clear after
    window.setTimeout(() => {
      setSelected(null);
      setMsg("");
    }, 280);
  }

  function flash(text: string, tone: "ok" | "err" = "ok") {
    setMsg(text);
    setMsgTone(tone);
  }

  async function onPickImage(file: File | null) {
    if (!file || !selectedSlot || selectedSlot.controlType !== "admin") return;
    if (!file.type.startsWith("image/")) {
      flash("Choose a jpg, png, or webp image", "err");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      flash("Image must be under 8MB", "err");
      return;
    }
    try {
      setUploading(true);
      flash("Uploading…");
      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const form = new FormData();
      form.append("image", file);

      const res = await fetch(`${API}/admin/content/upload-banner`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || `Upload failed (${res.status})`);
      }

      const url = json?.data?.imageUrl as string;
      if (!url) throw new Error("No image URL returned");

      setDraft((d) => ({ ...d, imageUrl: url }));
      flash("Image uploaded — save draft or publish");
    } catch (e: any) {
      flash(e?.message || "Upload failed", "err");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveDraft() {
    if (!selectedSlot || selectedSlot.controlType !== "admin") return;
    try {
      setBusy(true);
      const token = await getToken();
      await adminFetch(
        `/admin/content/slots/${selectedSlot.position}/draft`,
        token,
        { method: "PUT", body: JSON.stringify(draft) },
      );
      flash("Draft saved");
      await load(true);
    } catch (e: any) {
      flash(e?.message || "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!selectedSlot || selectedSlot.controlType !== "admin") return;
    if (!draft.imageUrl) {
      flash("Upload a banner image first", "err");
      return;
    }
    if (!String(draft.headline || "").trim()) {
      flash("Headline is required", "err");
      return;
    }
    try {
      setBusy(true);
      const token = await getToken();
      await adminFetch(
        `/admin/content/slots/${selectedSlot.position}/publish`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ ...draft, note: "Admin publish" }),
        },
      );
      flash("Published — live on web & app");
      await load(true);
    } catch (e: any) {
      flash(e?.message || "Publish failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(active: boolean) {
    if (!selectedSlot || selectedSlot.controlType !== "admin") return;
    try {
      setBusy(true);
      const token = await getToken();
      await adminFetch(
        `/admin/content/slots/${selectedSlot.position}/active`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive: active }),
        },
      );
      flash(active ? "Slot activated" : "Slot deactivated");
      await load(true);
    } catch (e: any) {
      flash(e?.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className={cn(poppins.className, "py-20")}>
        <OrbLoader label="Loading banners" />
      </div>
    );
  }

  return (
    <div className={cn(poppins.className, "relative min-h-[70vh] pb-10")}>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
            Content
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#F5F7FA]">
            Hero Banners
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#A7ADB8]">
            Edit slots <span className="text-[#F5F7FA]">2 · 3 · 5</span>. Slots{" "}
            <span className="text-[#F5F7FA]">1 · 4</span> are system adaptive.
            Images go through Cloudinary — same stack as products.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={envTone}>{envLabel}</Badge>
          {offline ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">
              <WifiOff className="h-3.5 w-3.5" /> Offline
            </span>
          ) : null}
          <Button
            tone="ghost"
            disabled={refreshing}
            onClick={() => load(true)}
            className="h-9 gap-2 rounded-xl"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      ) : null}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Positions", value: "5" },
          { label: "Admin live", value: counts?.adminPublished ?? "—" },
          { label: "System", value: counts?.systemSlots ?? 2 },
          {
            label: "Personal cycles",
            value: counts?.activePersonalCycles ?? "—",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3.5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              {s.label}
            </p>
            <p className="mt-1.5 text-[20px] font-semibold tabular-nums tracking-tight text-[#F5F7FA]">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Grid — no side pane, clean full width */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {slots.length === 0 ? (
          <EmptyState
            title="No slots"
            body="Hero slots are not initialized on the server yet."
          />
        ) : (
          slots.map((slot) => {
            const creative =
              slot.controlType === "admin"
                ? slot.published || slot.draft || {}
                : {
                    headline: "System personalized",
                    subheadline: "Adaptive · 6h cycle · not editable",
                    imageUrl:
                      recentPersonal.find((p) => p.position === slot.position)
                        ?.imageUrl || "",
                    kicker: "ADAPTIVE",
                    ctaLabel: "—",
                  };
            const isSel = selected === slot.position && modalOpen;
            return (
              <button
                key={slot.position}
                type="button"
                onClick={() => openSlot(slot.position)}
                className={cn(
                  "group text-left transition",
                  isSel
                    ? "ring-1 ring-[#00E575]/55"
                    : "hover:ring-1 hover:ring-white/10",
                )}
              >
                <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#11141A]/80">
                  <BannerPreview
                    creative={creative}
                    position={slot.position}
                    controlType={slot.controlType}
                  />
                  <div className="flex items-center justify-between gap-2 px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#F5F7FA]">
                        {slot.label || `Banner ${slot.position}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/40">
                        {slot.controlType === "system"
                          ? "Locked · adaptive"
                          : `v${slot.publishedVersion || 0} · ${
                              slot.isActive === false ? "Off" : "On"
                            }`}
                      </p>
                    </div>
                    {slot.controlType === "system" ? (
                      <Lock className="h-4 w-4 shrink-0 text-white/35" />
                    ) : (
                      <Sparkles className="h-4 w-4 shrink-0 text-[#00E575]" />
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Popup */}
      <BannerModal
        open={modalOpen}
        onClose={closeModal}
        slot={selectedSlot}
        draft={draft}
        setDraft={setDraft}
        diagnostics={diagnostics}
        recentPersonal={recentPersonal}
        offline={offline}
        busy={busy}
        uploading={uploading}
        msg={msg}
        msgTone={msgTone}
        fileRef={fileRef}
        onPickImage={onPickImage}
        onSaveDraft={saveDraft}
        onPublish={publish}
        onToggleActive={toggleActive}
      />
    </div>
  );
}

export default function ContentPage() {
  return (
    <ContentGate>
      <ContentInner />
    </ContentGate>
  );
}