"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Ban,
  Copy,
  CreditCard,
  ExternalLink,
  Heart,
  Lock,
  PackageCheck,
  Pause,
  Pin,
  Play,
  Radio,
  RefreshCw,
  Search,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  Wallet,
  X,
} from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import { Button, EmptyState, ErrorBlock, Input, Panel, cn } from "@/components/ui";

const GATE_KEY = "plazore.admin.latestGate.v1";
const PIN_KEY = "plazore.admin.latestPins.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_LATEST_PASSWORD || "plazorelatestnews@";

type Kind =
  | "bought"
  | "paid"
  | "payment_failed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "seller_paid"
  | "listed"
  | "cart"
  | "wishlist";

type Person = { id?: string; name: string; email?: string; storeName?: string };

type LatestEvent = {
  id: string;
  kind: Kind;
  at: string;
  title: string;
  summary: string;
  region?: string;
  money?: { amount: number; currency: string };
  actor?: Person;
  other?: Person;
  product?: { id?: string; name: string };
  order?: {
    id: string;
    number?: string;
    orderStatus?: string;
    paymentStatus?: string;
    total?: number;
    currency?: string;
  };
  links: { label: string; href: string }[];
  meta?: Record<string, string | number>;
};

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bought", label: "Bought" },
  { id: "cart", label: "Cart" },
  { id: "wishlist", label: "Wishlist" },
  { id: "listed", label: "Listed" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "seller_paid", label: "Paid out" },
  { id: "paid", label: "Payment" },
  { id: "payment_failed", label: "Failed" },
  { id: "cancelled", label: "Cancelled" },
];

const WINDOWS = [
  { id: 1, label: "1h" },
  { id: 6, label: "6h" },
  { id: 24, label: "24h" },
  { id: 168, label: "7d" },
];

const KIND_META: Record<
  Kind,
  { label: string; tone: string; Icon: typeof ShoppingBag }
> = {
  bought: {
    label: "Bought",
    tone: "text-[#00E575] border-[#00E575]/40 bg-[#00E575]/10",
    Icon: ShoppingBag,
  },
  paid: {
    label: "Paid",
    tone: "text-sky-300 border-sky-400/35 bg-sky-400/10",
    Icon: CreditCard,
  },
  payment_failed: {
    label: "Failed",
    tone: "text-red-300 border-red-400/40 bg-red-500/10",
    Icon: Ban,
  },
  shipped: {
    label: "Shipped",
    tone: "text-cyan-200 border-cyan-300/35 bg-cyan-400/10",
    Icon: Truck,
  },
  delivered: {
    label: "Delivered",
    tone: "text-emerald-200 border-emerald-300/35 bg-emerald-400/10",
    Icon: PackageCheck,
  },
  cancelled: {
    label: "Cancelled",
    tone: "text-white/55 border-white/15 bg-white/5",
    Icon: Ban,
  },
  seller_paid: {
    label: "Paid out",
    tone: "text-lime-200 border-lime-300/40 bg-lime-400/10",
    Icon: Wallet,
  },
  listed: {
    label: "Listed",
    tone: "text-indigo-200 border-indigo-300/35 bg-indigo-400/10",
    Icon: Store,
  },
  cart: {
    label: "Cart",
    tone: "text-amber-200 border-amber-300/35 bg-amber-400/10",
    Icon: ShoppingCart,
  },
  wishlist: {
    label: "Wishlist",
    tone: "text-rose-200 border-rose-300/35 bg-rose-400/10",
    Icon: Heart,
  },
};

function fmtMoney(n?: number, currency = "NGN") {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v.toLocaleString()} ${currency}`;
  }
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.round(diff / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function exactWhen(iso?: string) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function briefOf(ev: LatestEvent) {
  const money = ev.money ? fmtMoney(ev.money.amount, ev.money.currency) : "";
  return [
    ev.title,
    exactWhen(ev.at),
    ev.summary,
    ev.order?.number ? `Order ${ev.order.number}` : "",
    money,
    ev.region || "",
  ]
    .filter(Boolean)
    .join(" | ");
}

export default function LatestCommercePage() {
  const { getToken, isLoaded } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState("");

  const [hours, setHours] = useState(24);
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LatestEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [pins, setPins] = useState<string[]>([]);
  const [copied, setCopied] = useState("");
  const seen = useRef<Set<string>>(new Set());
  const booted = useRef(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(GATE_KEY) === "1") setUnlocked(true);
      const raw = localStorage.getItem(PIN_KEY);
      if (raw) setPins(JSON.parse(raw));
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQ(qLive.trim()), 280);
    return () => clearTimeout(t);
  }, [qLive]);

  const unlock = (e: FormEvent) => {
    e.preventDefault();
    if (pw === EXPECTED_PASSWORD) {
      setUnlocked(true);
      setPwErr("");
      try {
        sessionStorage.setItem(GATE_KEY, "1");
      } catch {
        /* */
      }
    } else setPwErr("Incorrect password");
  };

  const load = useCallback(async () => {
    if (!unlocked || !isLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const qs = new URLSearchParams({
        hours: String(hours),
        kind,
        ...(q ? { q } : {}),
      });
      const json = await adminFetch<{ success: boolean; data: any }>(
        `/admin/latest?${qs}`,
        token
      );
      const next: LatestEvent[] = json.data?.items || [];
      if (booted.current) {
        const born = next.filter((ev) => !seen.current.has(ev.id)).map((ev) => ev.id);
        if (born.length) {
          setFresh(new Set(born));
          window.setTimeout(() => setFresh(new Set()), 12000);
        }
      }
      booted.current = true;
      seen.current = new Set(next.map((ev) => ev.id));
      setItems(next);
      setCounts(json.data?.counts || {});
      setServerTime(json.data?.serverTime || null);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [unlocked, isLoaded, getToken, hours, kind, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!live || !unlocked) return;
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      void load();
    };
    const id = window.setInterval(tick, 8000);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [live, unlocked, load]);

  const selected = useMemo(
    () => items.find((ev) => ev.id === selectedId) || null,
    [items, selectedId]
  );

  const ordered = useMemo(() => {
    const pin = new Set(pins);
    return [...items].sort((a, b) => {
      const ap = pin.has(a.id) ? 1 : 0;
      const bp = pin.has(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return +new Date(b.at) - +new Date(a.at);
    });
  }, [items, pins]);

  const togglePin = (id: string) => {
    setPins((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev].slice(0, 40);
      try {
        localStorage.setItem(PIN_KEY, JSON.stringify(next));
      } catch {
        /* */
      }
      return next;
    });
  };

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      window.setTimeout(() => setCopied(""), 1400);
    } catch {
      setCopied("");
    }
  };

  if (!unlocked) {
    return (
      <div className="flex min-h-[70dvh] items-center justify-center px-4">
        <form
          onSubmit={unlock}
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#11141A]/95 p-6 shadow-2xl"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#00E575]/30 bg-[#00E575]/10">
            <Lock className="h-5 w-5 text-[#00E575]" />
          </div>
          <h1 className="text-lg font-bold">Latest</h1>
          <p className="mt-1 text-sm text-white/50">
            Live commerce tape. Buys, bags, wishlists, shipments, and payouts.
          </p>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Desk password"
            className="mt-4"
            autoFocus
          />
          {pwErr ? <p className="mt-2 text-xs text-red-400">{pwErr}</p> : null}
          <Button type="submit" className="mt-4 w-full">
            Unlock
          </Button>
        </form>
      </div>
    );
  }

  const detail = selected ? (
    <Detail
      ev={selected}
      pinned={pins.includes(selected.id)}
      copied={copied}
      onClose={() => setSelectedId(null)}
      onPin={() => togglePin(selected.id)}
      onCopy={() => void copy(briefOf(selected), "brief")}
      onCopyOrder={
        selected.order?.number
          ? () => void copy(selected.order!.number || "", "order")
          : undefined
      }
    />
  ) : (
    <Panel className="hidden p-6 lg:block">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
        Detail
      </p>
      <p className="mt-2 text-sm text-white/55">
        Tap any line to see who did it, when, and which admin desk to open.
      </p>
    </Panel>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
            Marketplace
          </p>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Latest</h1>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                live
                  ? "border-[#00E575]/40 bg-[#00E575]/10 text-[#00E575]"
                  : "border-white/15 bg-white/5 text-white/45"
              )}
            >
              <Radio className={cn("h-3 w-3", live && "animate-pulse")} />
              {live ? "Live" : "Paused"}
            </span>
          </div>
          <p className="mt-1 max-w-xl text-sm text-white/50">
            Every buy, listing, bag, wishlist, shipment, and seller payout in this window.
            Refreshes every 8 seconds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" tone="ghost" onClick={() => setLive((v) => !v)}>
            {live ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {live ? "Pause" : "Resume"}
          </Button>
          <Button type="button" tone="ghost" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { k: "bought", label: "Bought" },
          { k: "cart", label: "Cart" },
          { k: "shipped", label: "Shipped" },
          { k: "seller_paid", label: "Paid out" },
        ].map((c) => (
          <Panel key={c.k} className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              {c.label}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{counts[c.k] || 0}</p>
          </Panel>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setHours(w.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold",
                hours === w.id
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-white/10 text-white/45"
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-sm lg:ml-auto">
          <Search className="h-4 w-4 shrink-0 text-white/35" />
          <Input
            value={qLive}
            onChange={(e) => setQLive(e.target.value)}
            placeholder="Search name, store, order #"
            className="h-9"
          />
        </div>
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setKind(f.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold",
              kind === f.id
                ? "border-[#00E575]/50 bg-[#00E575]/15 text-[#00E575]"
                : "border-white/10 bg-white/5 text-white/55"
            )}
          >
            {f.label}
            {counts[f.id] ? (
              <span className="ml-1 tabular-nums opacity-70">{counts[f.id]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorBlock message={error} />
        </div>
      ) : null}

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-2">
          {loading && !items.length ? (
            <div className="flex justify-center py-16">
              <OrbLoader />
            </div>
          ) : null}
          {!loading && !ordered.length && !error ? (
            <EmptyState
              title="Quiet window"
              body="No buys, carts, shipments, or payouts in this range yet. Leave this page open — it stays live."
            />
          ) : null}
          {ordered.map((ev) => {
            const meta = KIND_META[ev.kind] || KIND_META.bought;
            const Icon = meta.Icon;
            const active = ev.id === selectedId;
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => setSelectedId(ev.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border bg-[#11141A]/80 p-3 text-left transition sm:p-4",
                  active ? "border-[#00E575]/45" : "border-white/10 hover:border-white/20",
                  fresh.has(ev.id) && "ring-1 ring-[#00E575]/40"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                    meta.tone
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">{ev.title}</span>
                    {pins.includes(ev.id) ? (
                      <Pin className="h-3 w-3 text-[#00E575]" />
                    ) : null}
                    {fresh.has(ev.id) ? (
                      <span className="rounded-full bg-[#00E575] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#041412]">
                        New
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-white/50">
                    {ev.summary}
                  </span>
                  <span className="mt-1 block text-[11px] text-white/35">
                    {timeAgo(ev.at)}
                    {ev.order?.number ? ` | ${ev.order.number}` : ""}
                    {ev.region ? ` | ${ev.region}` : ""}
                  </span>
                </span>
                {ev.money ? (
                  <span className="shrink-0 text-right text-sm font-semibold tabular-nums">
                    {fmtMoney(ev.money.amount, ev.money.currency)}
                  </span>
                ) : null}
              </button>
            );
          })}
          {serverTime ? (
            <p className="pt-2 text-center text-[10px] uppercase tracking-wider text-white/30">
              Tape time {exactWhen(serverTime)}
            </p>
          ) : null}
        </div>
        <div className="hidden lg:sticky lg:top-4 lg:block">{detail}</div>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/55 lg:hidden" onClick={() => setSelectedId(null)}>
          <div
            className="max-h-[82dvh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0C0F14] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {detail}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">
        {label}
      </span>
      <span className="max-w-[65%] text-right text-sm text-white/85">{value}</span>
    </div>
  );
}

function Detail({
  ev,
  pinned,
  copied,
  onClose,
  onPin,
  onCopy,
  onCopyOrder,
}: {
  ev: LatestEvent;
  pinned: boolean;
  copied: string;
  onClose: () => void;
  onPin: () => void;
  onCopy: () => void;
  onCopyOrder?: () => void;
}) {
  const meta = KIND_META[ev.kind] || KIND_META.bought;
  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span
            className={cn(
              "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
              meta.tone
            )}
          >
            {meta.label}
          </span>
          <h2 className="mt-2 text-lg font-bold leading-snug">{ev.title}</h2>
          <p className="mt-1 text-sm text-white/55">{ev.summary}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 p-1.5 text-white/50 lg:hidden"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4">
        <Row label="When" value={`${exactWhen(ev.at)} | ${timeAgo(ev.at)}`} />
        <Row label="Who" value={ev.actor ? `${ev.actor.name}${ev.actor.email ? ` | ${ev.actor.email}` : ""}` : undefined} />
        <Row
          label="With"
          value={
            ev.other
              ? `${ev.other.storeName || ev.other.name}${ev.other.email ? ` | ${ev.other.email}` : ""}`
              : undefined
          }
        />
        <Row label="Product" value={ev.product?.name} />
        <Row label="Order" value={ev.order?.number || ev.order?.id} />
        <Row label="Order status" value={ev.order?.orderStatus} />
        <Row label="Payment" value={ev.order?.paymentStatus} />
        <Row
          label="Amount"
          value={ev.money ? fmtMoney(ev.money.amount, ev.money.currency) : undefined}
        />
        <Row label="Region" value={ev.region} />
        {ev.meta
          ? Object.entries(ev.meta)
              .filter(([, v]) => v !== "" && v !== 0)
              .map(([k, v]) => <Row key={k} label={k} value={String(v)} />)
          : null}
      </div>

      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
        Open in admin
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {ev.links.map((l) => (
          <Link
            key={l.href + l.label}
            href={l.href}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-[#00E575]/40"
          >
            {l.label}
            <ExternalLink className="h-3 w-3 opacity-60" />
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" tone="ghost" onClick={onPin}>
          <Pin className="mr-2 h-4 w-4" />
          {pinned ? "Unpin" : "Pin"}
        </Button>
        <Button type="button" tone="ghost" onClick={onCopy}>
          <Copy className="mr-2 h-4 w-4" />
          {copied === "brief" ? "Copied" : "Copy brief"}
        </Button>
        {onCopyOrder ? (
          <Button type="button" tone="ghost" onClick={onCopyOrder}>
            <Copy className="mr-2 h-4 w-4" />
            {copied === "order" ? "Copied" : "Copy order #"}
          </Button>
        ) : null}
      </div>
    </Panel>
  );
}
