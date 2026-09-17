"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
  Database,
  Lock,
  RefreshCw,
  Sparkles,
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

const GATE_KEY = "plazore.admin.intelligenceGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_INTELLIGENCE_PASSWORD || "";
const Z_MODAL = 9999;

type EnvKind = "development" | "production" | "unknown";
type TabId = "confidence" | "generation" | "source";

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

function toneForStatus(s?: string) {
  if (s === "ready") return "green" as const;
  if (s === "failed") return "error" as const;
  if (s === "pending") return "warn" as const;
  return "neutral" as const;
}

function toneForConf(level?: string) {
  const s = String(level || "");
  if (s === "High Confidence") return "green" as const;
  if (s === "Growing Confidence") return "blue" as const;
  if (s === "Limited Confidence") return "warn" as const;
  return "neutral" as const;
}

function shortConf(level?: string) {
  const s = String(level || "");
  if (s === "High Confidence") return "High";
  if (s === "Growing Confidence") return "Growing";
  if (s === "Limited Confidence") return "Limited";
  return s || "—";
}

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

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
      {children}
    </p>
  );
}

function Prose({ value }: { value?: string | null }) {
  const text = String(value || "").trim();
  if (!text) return <p className="text-[13px] text-white/30">—</p>;
  return (
    <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.55] text-white/65">
      {text}
    </p>
  );
}

function Bullets({ items }: { items?: string[] | null }) {
  const list = (items || []).map((s) => String(s || "").trim()).filter(Boolean);
  if (!list.length) return <p className="text-[13px] text-white/30">—</p>;
  return (
    <ul className="space-y-1.5">
      {list.map((item, i) => (
        <li
          key={`${i}-${item.slice(0, 20)}`}
          className="flex gap-2 text-[13px] leading-[1.5] text-white/65"
        >
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#00E575]" />
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ScoreBar({ score }: { score?: number | null }) {
  const n =
    typeof score === "number" && Number.isFinite(score)
      ? Math.max(0, Math.min(100, score))
      : null;
  if (n == null) return null;
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[11px] text-white/40">
        <span>Evidence</span>
        <span className="tabular-nums text-white/55">{n}/100</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#00E575] to-[#3B82F6]"
          style={{ width: `${n}%` }}
        />
      </div>
    </div>
  );
}

function SliceCard({
  title,
  slice,
}: {
  title: string;
  slice?: {
    orders?: number;
    delivered?: number;
    confirmed?: number;
    issues?: number;
    sellerCancelled?: number;
  } | null;
}) {
  const s = slice || {};
  const rows: [string, number][] = [
    ["Orders", Number(s.orders) || 0],
    ["Delivered", Number(s.delivered) || 0],
    ["Confirmed", Number(s.confirmed) || 0],
    ["Issues", Number(s.issues) || 0],
    ["Seller cancel", Number(s.sellerCancelled) || 0],
  ];
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40">
        {title}
      </p>
      <div className="mt-1.5 space-y-1">
        {rows.map(([label, n]) => (
          <div
            key={label}
            className="flex items-center justify-between text-[11px] text-white/50"
          >
            <span>{label}</span>
            <span className="tabular-nums text-[#F5F7FA]">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntelligenceGate({ children }: { children: ReactNode }) {
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
      setErr("Set NEXT_PUBLIC_ADMIN_INTELLIGENCE_PASSWORD in .env");
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
          <h1 className="mt-2 text-2xl font-semibold">Product Intelligence</h1>
          <p className="mt-2 text-[13px] text-white/45">
            Enter access password to continue.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access password"
              autoComplete="current-password"
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

function IntelligenceModal({
  open,
  onClose,
  detail,
  detailLoading,
  busy,
  onRegenerate,
}: {
  open: boolean;
  onClose: () => void;
  detail: any;
  detailLoading: boolean;
  busy: boolean;
  onRegenerate: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<TabId>("generation");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setTab("generation");
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
  }, [open, detail?.source?._id, tab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const src = detail?.source;
  const gen = detail?.generated;
  const pipe = detail?.pipeline;
  const conf = gen?.buyerConfidence;
  const commerce = gen?.commerceEvidence || detail?.commerceEvidence || null;
  const specs =
    src?.specifications && typeof src.specifications === "object"
      ? Object.entries(src.specifications as Record<string, unknown>)
      : [];

  const tabs: { id: TabId; label: string }[] = [
    { id: "generation", label: "Generation" },
    { id: "confidence", label: "Confidence" },
    { id: "source", label: "Source" },
  ];

  return createPortal(
    <div
      className={cn(
        "flex items-end justify-center sm:items-center sm:p-5",
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
          "absolute inset-0 bg-black/65 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex w-full max-w-[420px] flex-col",
          "max-h-[min(88dvh,720px)]",
          "rounded-t-2xl border border-white/10 bg-[#0C0F14] shadow-[0_32px_80px_rgba(0,0,0,0.65)] sm:rounded-2xl",
          "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-8 scale-[0.98] opacity-0",
        )}
      >
        <div className="h-[2px] shrink-0 bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />

        {/* Header — compact */}
        <div className="flex shrink-0 items-start gap-3 px-4 pb-3 pt-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-[#00E575]">
              INTELLIGENCE
            </p>
            {src ? (
              <>
                <h2 className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug">
                  {src.name}
                </h2>
                <p className="mt-0.5 truncate text-[11px] text-white/40">
                  {[src.brand, src.category].filter(Boolean).join(" · ")}
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-sm text-white/50">Loading…</p>
            )}
            {src && (
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge tone={toneForStatus(gen?.status || "missing")}>
                  {gen?.status || "missing"}
                </Badge>
                {conf?.level ? (
                  <Badge tone={toneForConf(conf.level)}>
                    {shortConf(conf.level)}
                  </Badge>
                ) : null}
                {pipe?.needsRefresh ? (
                  <Badge tone="warn">Stale</Badge>
                ) : null}
                {gen?.status === "pending" ? (
                  <Badge tone="warn">Refreshing</Badge>
                ) : null}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/50 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 border-b border-white/[0.06] px-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "relative px-3 py-2.5 text-[12px] font-semibold transition",
                tab === t.id
                  ? "text-[#F5F7FA]"
                  : "text-white/40 hover:text-white/70",
              )}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#00E575]" />
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5"
        >
          {detailLoading && !detail ? (
            <OrbLoader label="Loading" />
          ) : !src ? (
            <p className="py-12 text-center text-sm text-white/40">
              Select a row.
            </p>
          ) : tab === "generation" ? (
            <div className="space-y-4">
              {!gen ? (
                <p className="text-[13px] text-white/40">
                  No saved intelligence yet.
                </p>
              ) : (
                <>
                  <div>
                    <Label>Summary</Label>
                    <div className="mt-1.5">
                      <Prose value={gen.summary} />
                    </div>
                  </div>
                  <div>
                    <Label>Overview</Label>
                    <div className="mt-1.5">
                      <Prose value={gen.overview} />
                    </div>
                  </div>
                  <div>
                    <Label>Highlights</Label>
                    <div className="mt-1.5">
                      <Bullets items={gen.highlights} />
                    </div>
                  </div>
                  <div>
                    <Label>Best for</Label>
                    <div className="mt-1.5">
                      <Bullets items={gen.bestFor} />
                    </div>
                  </div>
                  <div>
                    <Label>Shipping</Label>
                    <div className="mt-1.5">
                      <Prose value={gen.shippingSummary} />
                    </div>
                  </div>
                  <div>
                    <Label>Things to consider</Label>
                    <div className="mt-1.5">
                      <Bullets items={gen.thingsToConsider} />
                    </div>
                  </div>
                  <div className="space-y-0.5 border-t border-white/[0.06] pt-3 text-[10px] text-white/30">
                    <p>
                      Generated {fmt(gen.generatedAt)} · Updated{" "}
                      {fmt(gen.updatedAt)}
                    </p>
                    <p>
                      Model {gen.modelVersion || "—"} · prompt v
                      {gen.promptVersion ?? "—"}
                    </p>
                  </div>
                  {gen.error ? (
                    <p className="text-[12px] leading-relaxed text-[#F87171]">
                      {gen.error}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : tab === "confidence" ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {conf?.level ? (
                    <Badge tone={toneForConf(conf.level)}>{conf.level}</Badge>
                  ) : (
                    <span className="text-[13px] text-white/35">Not set</span>
                  )}
                  {typeof conf?.score === "number" ? (
                    <span className="text-[12px] tabular-nums text-white/50">
                      {conf.score}/100
                    </span>
                  ) : null}
                </div>
                <ScoreBar score={conf?.score} />
              </div>
              <div>
                <Label>Explanation</Label>
                <div className="mt-1.5">
                  <Prose value={gen?.confidenceExplanation} />
                </div>
              </div>
              <div>
                <Label>Evidence factors</Label>
                <div className="mt-1.5">
                  <Bullets items={conf?.factors} />
                </div>
              </div>
              {commerce ? (
                <div>
                  <Label>Commerce snapshot</Label>
                  <p className="mt-0.5 text-[10px] text-white/30">
                    {fmt(commerce.gatheredAt)}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <SliceCard title="Seller" slice={commerce.seller} />
                    <SliceCard title="Product" slice={commerce.product} />
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-white/35">
                  No commerce evidence on this generation.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {Array.isArray(src.images) && src.images.length ? (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  {src.images.slice(0, 6).map((img: string, i: number) => (
                    <div
                      key={`${img}-${i}`}
                      className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
              <div>
                <Label>Description</Label>
                <div className="mt-1.5">
                  <Prose value={src.description} />
                </div>
              </div>
              <p className="text-[12px] text-white/50">
                {Number(src.price || 0).toLocaleString()} · stock {src.stock} ·{" "}
                {src.isActive ? "active" : "inactive"}
              </p>
              {specs.length ? (
                <div>
                  <Label>Specs</Label>
                  <div className="mt-1.5 space-y-1">
                    {specs.map(([k, v]) => (
                      <p key={k} className="text-[12px] text-white/50">
                        <span className="text-white/30">{k}: </span>
                        {String(v ?? "—")}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="text-[11px] text-white/30">
                Seller {src.seller?.storeName || src.seller?.name || "—"}
              </p>
              <p className="text-[11px] text-white/30">
                Listed {fmt(src.createdAt)} · Updated {fmt(src.updatedAt)}
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {src && (
          <div className="shrink-0 space-y-2 border-t border-white/[0.06] px-4 py-3">
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/products?productId=${encodeURIComponent(src._id)}`}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-white/12 text-[12px] font-semibold text-white/70 hover:text-white"
              >
                Product
              </Link>
              {src.seller?._id ? (
                <Link
                  href={`/users?userId=${encodeURIComponent(src.seller._id)}&role=seller`}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-white/12 text-[12px] font-semibold text-white/70 hover:text-white"
                >
                  Seller
                </Link>
              ) : (
                <div />
              )}
            </div>
            <Button
              className="h-9 w-full rounded-xl text-[13px]"
              disabled={busy}
              onClick={onRegenerate}
            >
              {busy
                ? "Queuing…"
                : gen?.status === "pending"
                  ? "Refresh queued…"
                  : "Queue refresh"}
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function IntelligenceDirectory() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const deepId = (searchParams.get("productId") || "").trim();
  const deepOpened = useRef<string | null>(null);
  const pollRef = useRef<number | null>(null);

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

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [confidence, setConfidence] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [openId, setOpenId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const stopPoll = () => {
    if (pollRef.current) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  };

  const load = useCallback(
    async (p = 1) => {
      try {
        setLoading(true);
        setError("");
        const token = await getToken();
        const params = new URLSearchParams({ page: String(p), limit: "20" });
        if (q.trim()) params.set("q", q.trim());
        if (status) params.set("status", status);
        if (confidence) params.set("confidence", confidence);
        const json = await adminFetch<any>(
          `/admin/intelligence?${params}`,
          token,
        );
        setOverview(json.data.overview);
        setItems(json.data.items || []);
        setPages(json.data.pagination?.pages || 1);
        setTotal(json.data.pagination?.total || 0);
        setPage(json.data.pagination?.page || p);
      } catch (e: any) {
        setError(e.message || "Failed to load intelligence");
      } finally {
        setLoading(false);
      }
    },
    [getToken, q, status, confidence],
  );

  useEffect(() => {
    load(1);
  }, [status, confidence]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        setDetailLoading(true);
        const token = await getToken();
        const json = await adminFetch<any>(`/admin/intelligence/${id}`, token);
        setDetail(json.data);
        return json.data;
      } catch (e: any) {
        setError(e.message || "Failed to load detail");
        setDetail(null);
        return null;
      } finally {
        setDetailLoading(false);
      }
    },
    [getToken],
  );

  const openModal = async (id: string) => {
    setOpenId(id);
    setModalOpen(true);
    stopPoll();
    await loadDetail(id);
  };

  const closeModal = () => {
    stopPoll();
    setModalOpen(false);
    deepOpened.current = null;
    if (deepId) router.replace(pathname);
    window.setTimeout(() => {
      setOpenId(null);
      setDetail(null);
    }, 280);
  };

  useEffect(() => {
    if (!deepId) return;
    if (deepOpened.current === deepId) return;
    deepOpened.current = deepId;
    void openModal(deepId);
  }, [deepId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopPoll(), []);

  const pollUntilSettled = async (id: string) => {
    stopPoll();
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      const data = await loadDetail(id);
      await load(page);
      const st = data?.generated?.status;
      if (st === "ready" || st === "failed" || attempts >= 20) {
        pollRef.current = null;
        return;
      }
      pollRef.current = window.setTimeout(tick, 2500);
    };
    await tick();
  };

  const regenerate = async () => {
    if (!openId) return;
    try {
      setBusy(true);
      const token = await getToken();
      await adminFetch(`/admin/intelligence/${openId}/regenerate`, token, {
        method: "POST",
      });
      await loadDetail(openId);
      await load(page);
      void pollUntilSettled(openId);
    } catch (e: any) {
      setError(e.message || "Queue failed");
    } finally {
      setBusy(false);
    }
  };

  const ov = overview;
  const confHigh = ov?.buyerConfidence?.high ?? 0;
  const confGrowing = ov?.buyerConfidence?.growing ?? 0;
  const confLimited = ov?.buyerConfidence?.limited ?? 0;

  return (
    <div className="relative mx-auto max-w-6xl pb-24 text-[#F5F7FA]">
      <header className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
              INTELLIGENCE
            </p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight sm:text-[32px]">
              Product Intelligence
            </h1>
            <p className="mt-2 max-w-2xl text-[13.5px] text-white/50">
              Generated interpretation and Buyer Confidence. Evidence-based —
              not a rating. Prior copy stays until a new generation is saved.
            </p>
          </div>
          <Button
            tone="ghost"
            className="h-10 gap-1.5 rounded-full border border-white/12 bg-[#14181F] text-xs"
            disabled={loading}
            onClick={() => load(page)}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={envTone as any}>
            <Database className="mr-1 inline h-3 w-3" />
            {envLabel}
          </Badge>
          <Badge tone="blue">
            <Sparkles className="mr-1 inline h-3 w-3" />
            AI
          </Badge>
        </div>
      </header>

      {ov ? (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {[
            ["Ready", ov.withIntelligence],
            ["Pending", ov.pending],
            ["Failed", ov.failed],
            ["Missing", ov.missing],
            ["Updated 7d", ov.recentlyUpdated7d],
            ["High", confHigh],
            ["Growing", confGrowing],
            ["Limited", confLimited],
          ].map(([label, n]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3.5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                {label}
              </p>
              <p className="mt-1.5 text-[22px] font-semibold tabular-nums">
                {Number(n).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <Panel className="mb-4 overflow-hidden rounded-2xl border-white/[0.08] bg-white/[0.03]">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <Input
            placeholder="Product, brand, category, store…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            className="rounded-xl border-white/12 bg-[#14181F] lg:max-w-md"
          />
          <DarkSelect value={status} onChange={setStatus} className="lg:w-40">
            <option value="">All statuses</option>
            <option value="ready">Ready</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="missing">Missing</option>
          </DarkSelect>
          <DarkSelect
            value={confidence}
            onChange={setConfidence}
            className="lg:w-48"
          >
            <option value="">All confidence</option>
            <option value="High Confidence">High Confidence</option>
            <option value="Growing Confidence">Growing Confidence</option>
            <option value="Limited Confidence">Limited Confidence</option>
          </DarkSelect>
          <Button
            className="rounded-xl"
            onClick={() => load(1)}
            disabled={loading}
          >
            {loading ? "Searching…" : "Search"}
          </Button>
        </div>
      </Panel>

      {error ? (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
          <OrbLoader label="Loading intelligence" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No intelligence rows"
          body="Try another filter, or queue generation after a product update."
        />
      ) : (
        <Panel className="overflow-x-auto rounded-2xl border-white/[0.08] bg-white/[0.03]">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.12em] text-white/40">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Buyer Confidence</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Generated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.productId}
                  onClick={() => openModal(row.productId)}
                  className={cn(
                    "cursor-pointer border-b border-white/[0.05] hover:bg-white/[0.03]",
                    openId === row.productId &&
                      modalOpen &&
                      "bg-[#00E575]/[0.06]",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                        {row.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.name}</p>
                        <p className="truncate text-xs text-white/40">
                          {row.category}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/55">
                    {row.seller?.storeName || row.seller?.name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={toneForStatus(row.status)}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {row.buyerConfidence?.level ? (
                      <Badge tone={toneForConf(row.buyerConfidence.level)}>
                        {shortConf(row.buyerConfidence.level)}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-white/50">
                    {typeof row.buyerConfidence?.score === "number"
                      ? `${row.buyerConfidence.score}/100`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/35">
                    {fmt(row.generatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            tone="ghost"
            className="rounded-xl"
            disabled={page <= 1 || loading}
            onClick={() => load(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-white/40">
            Page {page} of {pages} · {total.toLocaleString()}
          </span>
          <Button
            tone="ghost"
            className="rounded-xl"
            disabled={page >= pages || loading}
            onClick={() => load(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <IntelligenceModal
        open={modalOpen}
        onClose={closeModal}
        detail={detail}
        detailLoading={detailLoading}
        busy={busy}
        onRegenerate={regenerate}
      />
    </div>
  );
}

export default function IntelligencePage() {
  return (
    <IntelligenceGate>
      <IntelligenceDirectory />
    </IntelligenceGate>
  );
}