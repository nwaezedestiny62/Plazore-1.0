"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Panel,
  Select,
  cn,
} from "@/components/ui";
import { REGION_LIST } from "@/lib/region";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type ProductCard = {
  _id: string;
  name: string;
  images?: string[];
  price: number;
  category?: string;
  region?: string;
  stock?: number;
  seller?: { _id?: string; storeName?: string; name?: string };
};

type Section = {
  capacity: number;
  populated: number;
  fillPct: number;
  reusedFromEarlier: number;
  unique: number;
  categories: { key: string; count: number }[];
  sellers: { key: string; count: number }[];
  regions: { key: string; count: number }[];
  products: ProductCard[];
};

const ROOM_META: Record<string, { title: string; body: string }> = {
  "1": { title: "Section 1 · Discovery", body: "50 slots · two rows of 25 · primary unique set" },
  "2": { title: "Section 2 · Preference pairs", body: "14 slots · side-by-side pairs · primary unique set" },
  "3": { title: "Section 3 · Exploration", body: "16 slots · may reuse 1–2 when inventory is thin" },
  "4": { title: "Section 4 · Broader surface", body: "33 slots · may reuse earlier rooms when inventory is thin" },
};

function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="border border-[#252A33] bg-[#11141A] px-3 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
        {label}
      </p>
      <p className="mt-1.5 text-[22px] font-semibold tabular-nums leading-none">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint ? <p className="mt-1.5 text-[11px] text-[#737A86]">{hint}</p> : null}
    </div>
  );
}

export default function ShowroomPage() {
  const { getToken } = useAuth();
  const [region, setRegion] = useState("NG");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState<ProductCard | null>(null);
  const [paneOpen, setPaneOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const token = await getToken();
      const json = await adminFetch<any>(
        `/admin/showroom?region=${encodeURIComponent(region)}`,
        token
      );
      setData(json.data);
    } catch (e: any) {
      setError(e.message || "Failed to load showroom");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, region]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    try {
      setRefreshing(true);
      setError("");
      const token = await getToken();
      await adminFetch(`/admin/showroom/refresh`, token, {
        method: "POST",
        body: JSON.stringify({ region }),
      });
      await load();
    } catch (e: any) {
      setError(e.message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const openPane = (p: ProductCard) => {
    setOpen(p);
    setPaneOpen(true);
  };
  const closePane = () => {
    setPaneOpen(false);
    window.setTimeout(() => setOpen(null), 280);
  };

  const ov = data?.overview;
  const health = data?.health;
  const algo = data?.algorithm;
  const sections: Record<string, Section> = data?.sections || {};

  return (
    <div className={cn(poppins.className, "relative min-h-[70vh] pb-24 text-[#F5F7FA]")}>
      <header className="mb-6 border-b border-[#252A33] pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
          Intelligence
        </p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight sm:text-[28px]">
              Showroom
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#A7ADB8]">
              What the adaptive showroom is showing, why the ranker behaves this way, and whether inventory can fill the rooms.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGION_LIST.map((r: any) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
            </Select>
            <Button
              tone="ghost"
              className="h-9 gap-1.5 text-xs"
              disabled={loading || refreshing}
              onClick={() => load()}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Reload
            </Button>
            <Button disabled={loading || refreshing} onClick={refresh}>
              {refreshing ? "Refreshing…" : "Force refresh ranker"}
            </Button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      ) : null}

      {loading && !data ? (
        <div className="border border-[#252A33] bg-[#11141A]">
          <OrbLoader label="Loading showroom" />
        </div>
      ) : !data ? (
        <EmptyState title="No showroom data" body="Connect and retry." />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                health?.status === "healthy"
                  ? "green"
                  : health?.status === "issue"
                  ? "error"
                  : "warn"
              }
            >
              {health?.label}
            </Badge>
            <Badge tone={algo?.status === "live" ? "green" : "warn"}>
              Ranker {algo?.status}
            </Badge>
            <span className="text-xs text-[#737A86]">
              Last refresh {fmt(ov?.lastRefresh)} · populated{" "}
              {data.totals.populated}/{data.totals.capacity}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden border border-[#252A33] bg-[#252A33] sm:grid-cols-3 xl:grid-cols-5">
            <Stat label="Active products" value={ov.totalActive} />
            <Stat label="Eligible (in stock)" value={ov.eligible} />
            <Stat label={`Eligible in ${region}`} value={ov.localEligible} />
            <Stat label="Out of stock" value={ov.outOfStock} />
            <Stat label="Sellers contributing" value={ov.sellersContributing} />
            <Stat label="Categories" value={ov.categoriesRepresented} />
            <Stat label="Added 7d" value={ov.recentlyAdded7d} />
            <Stat label="Updated 7d" value={ov.recentlyUpdated7d} />
            <Stat label="Sessions this region" value={ov.sessionCount} />
            <Stat label="Inactive listings" value={ov.inactive} />
          </div>

          <Panel className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Algorithm
            </p>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 text-sm text-[#A7ADB8]">
                <p>
                  <span className="text-[#F5F7FA]">{algo.name}</span> · {algo.version} ·{" "}
                  {algo.type.replaceAll("_", " ")}
                </p>
                <p>Refresh interval: {algo.refreshIntervalLabel}</p>
                <p>Last refresh: {fmt(algo.lastRefresh)}</p>
                <p>Next session expiry: {fmt(algo.nextScheduledRefresh)}</p>
                <p className="font-mono text-[11px] text-[#737A86]">
                  {algo.sessionId || "no session"}
                </p>
                <p>{algo.regionalFallback}</p>
                <p>{algo.reusePolicy}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737A86]">
                  Ranking signals
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-[#A7ADB8]">
                  {algo.rankingSignals.map((s: any) => (
                    <li key={s.name}>
                      <span className="text-[#F5F7FA]">{s.name}</span>
                      <span className="text-[#737A86]"> · {s.weight}</span>
                      <span> — {s.notes}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-[#737A86]">
                  Eligibility: {algo.eligibility.join(" · ")}
                </p>
              </div>
            </div>
          </Panel>

          {health?.issues?.length ? (
            <Panel className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
                Health
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {health.issues.map((i: any) => (
                  <Badge key={i.code} tone="warn">
                    {i.label}
                  </Badge>
                ))}
              </div>
            </Panel>
          ) : null}

          {(["1", "2", "3", "4"] as const).map((k) => {
            const sec = sections[k];
            if (!sec) return null;
            const meta = ROOM_META[k];
            return (
              <Panel key={k} className="overflow-hidden">
                <div className="flex flex-col gap-2 border-b border-[#252A33] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{meta.title}</p>
                    <p className="text-[12px] text-[#737A86]">{meta.body}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={sec.populated ? "green" : "warn"}>
                      {sec.populated}/{sec.capacity} filled
                    </Badge>
                    {sec.reusedFromEarlier > 0 ? (
                      <Badge tone="blue">
                        {sec.reusedFromEarlier} reused from earlier rooms
                      </Badge>
                    ) : (
                      <Badge tone="neutral">No reuse</Badge>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                      Categories
                    </p>
                    <p className="mt-1 text-xs text-[#A7ADB8]">
                      {sec.categories.slice(0, 6).map((c) => `${c.key} ${c.count}`).join(" · ") || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                      Sellers
                    </p>
                    <p className="mt-1 text-xs text-[#A7ADB8]">
                      {sec.sellers.slice(0, 4).map((c) => `${c.key} ${c.count}`).join(" · ") || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                      Regions
                    </p>
                    <p className="mt-1 text-xs text-[#A7ADB8]">
                      {sec.regions.map((c) => `${c.key} ${c.count}`).join(" · ") || "—"}
                    </p>
                  </div>
                </div>
                {sec.products.length === 0 ? (
                  <p className="px-4 pb-4 text-sm text-[#737A86]">
                    No products in this room for {region}. Ranker does not pad empty slots.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                    {sec.products.map((p) => (
                      <button
                        key={`${k}-${p._id}`}
                        type="button"
                        onClick={() => openPane(p)}
                        className="border border-[#252A33] bg-[#11141A] p-1.5 text-left transition hover:border-[#00E575]/35"
                      >
                        <div className="aspect-square overflow-hidden bg-[#171B22]">
                          {p.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-[11px] font-medium">{p.name}</p>
                        <p className="truncate text-[10px] text-[#737A86]">
                          {p.seller?.storeName || p.seller?.name || p.region}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
          paneOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closePane}
        aria-hidden
      />
      <aside
        className={cn(
          poppins.className,
          "fixed top-0 right-0 z-50 flex h-full w-full max-w-[400px] flex-col border-l border-[#252A33] bg-[#0C0F14] shadow-2xl transition-transform duration-300 ease-out",
          paneOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-[#252A33] px-4">
          <p className="text-sm font-medium">Listing in showroom</p>
          <button type="button" onClick={closePane} className="flex h-9 w-9 items-center justify-center border border-[#252A33] bg-[#171B22]">
            <X className="h-4 w-4 text-[#A7ADB8]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {open ? (
            <div className="space-y-4">
              <div className="aspect-[4/3] overflow-hidden border border-[#252A33] bg-[#171B22]">
                {open.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={open.images[0]} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <h2 className="text-lg font-semibold">{open.name}</h2>
              <p className="text-sm text-[#A7ADB8]">
                {open.category} · {open.region} · stock {open.stock}
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {Number(open.price || 0).toLocaleString()}
              </p>
              <Link
                href={`/products?productId=${encodeURIComponent(open._id)}`}
                className="inline-flex h-10 items-center justify-center border border-[#252A33] bg-[#171B22] px-4 text-sm text-[#93C5FD]"
              >
                Open on Products
              </Link>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}