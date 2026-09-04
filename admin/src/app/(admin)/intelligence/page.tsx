"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
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

function toneForConf(s?: string) {
  if (s === "High Confidence") return "green" as const;
  if (s === "Growing Confidence") return "blue" as const;
  if (s === "Limited Confidence") return "warn" as const;
  return "neutral" as const;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
      {children}
    </p>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2 break-words text-sm leading-relaxed text-[#F5F7FA]">
        {children ?? "—"}
      </div>
    </div>
  );
}

function FullText({ value }: { value?: string | null }) {
  const text = String(value || "").trim();
  if (!text) {
    return <p className="text-sm text-[#737A86]">—</p>;
  }
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-[1.7] text-[#A7ADB8]">
      {text}
    </p>
  );
}

function BulletList({ items }: { items?: string[] | null }) {
  const list = (items || []).map((s) => String(s || "").trim()).filter(Boolean);
  if (!list.length) {
    return <p className="text-sm text-[#737A86]">—</p>;
  }
  return (
    <ul className="space-y-2">
      {list.map((item, i) => (
        <li
          key={`${i}-${item.slice(0, 24)}`}
          className="flex gap-2 text-sm leading-[1.7] text-[#A7ADB8]"
        >
          <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-[#00E575]" />
          <span className="min-w-0 whitespace-pre-wrap break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function IntelligencePage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const deepId = (searchParams.get("productId") || "").trim();
  const deepOpened = useRef<string | null>(null);
  const pollRef = useRef<number | null>(null);

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
  const [paneOpen, setPaneOpen] = useState(false);
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
        const json = await adminFetch<any>(`/admin/intelligence?${params}`, token);
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
    [getToken, q, status, confidence]
  );

  useEffect(() => {
    load(1);
  }, [status, confidence]); // eslint-disable-line

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
    [getToken]
  );

  const openPane = async (id: string) => {
    setOpenId(id);
    setPaneOpen(true);
    stopPoll();
    await loadDetail(id);
  };

  const closePane = () => {
    stopPoll();
    setPaneOpen(false);
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
    void openPane(deepId);
  }, [deepId]); // eslint-disable-line

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
  const src = detail?.source;
  const gen = detail?.generated;
  const pipe = detail?.pipeline;
  const specs =
    src?.specifications && typeof src.specifications === "object"
      ? Object.entries(src.specifications as Record<string, unknown>)
      : [];

  return (
    <div className={cn(poppins.className, "relative min-h-[70vh] pb-24 text-[#F5F7FA]")}>
      <header className="mb-6 border-b border-[#252A33] pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
          Intelligence
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight sm:text-[28px]">
              Product Intelligence
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#A7ADB8]">
              Full generated copy for each product. After a listing edit, the previous generation stays visible until the new one is saved — then this pane shows the complete replacement.
            </p>
          </div>
          <Button
            tone="ghost"
            className="h-9 gap-1.5 text-xs"
            disabled={loading}
            onClick={() => load(page)}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </header>

      {ov ? (
        <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden border border-[#252A33] bg-[#252A33] sm:grid-cols-4 xl:grid-cols-7">
          {[
            ["Ready", ov.withIntelligence],
            ["Pending", ov.pending],
            ["Failed", ov.failed],
            ["Missing", ov.missing],
            ["Updated 7d", ov.recentlyUpdated7d],
            ["High", ov.buyerConfidence.high],
            ["Limited", ov.buyerConfidence.limited],
          ].map(([label, n]) => (
            <div key={String(label)} className="bg-[#11141A] px-3 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
                {label}
              </p>
              <p className="mt-1.5 text-[22px] font-semibold tabular-nums">
                {Number(n).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <Panel className="mb-4 overflow-hidden">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <Input
            placeholder="Product, brand, category, store…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            className="lg:max-w-md"
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ready">Ready</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="missing">Missing</option>
          </Select>
          <Select value={confidence} onChange={(e) => setConfidence(e.target.value)}>
            <option value="">All confidence</option>
            <option value="High Confidence">High Confidence</option>
            <option value="Growing Confidence">Growing</option>
            <option value="Limited Confidence">Limited</option>
          </Select>
          <Button onClick={() => load(1)} disabled={loading}>
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
        <div className="border border-[#252A33] bg-[#11141A]">
          <OrbLoader label="Loading intelligence" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No intelligence rows"
          body="Try another filter or generate from a product update."
        />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-[#252A33] text-[11px] uppercase tracking-[0.12em] text-[#737A86]">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Buyer Confidence</th>
                <th className="px-4 py-3">Generated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.productId}
                  onClick={() => openPane(row.productId)}
                  className={cn(
                    "cursor-pointer border-b border-[#252A33]/70 hover:bg-[#171B22]/80",
                    openId === row.productId && paneOpen && "bg-[#00E575]/[0.06]"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 overflow-hidden border border-[#252A33] bg-[#171B22]">
                        {row.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.image} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.name}</p>
                        <p className="truncate text-xs text-[#737A86]">{row.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#A7ADB8]">
                    {row.seller?.storeName || row.seller?.name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={toneForStatus(row.status)}>{row.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {row.buyerConfidence?.level ? (
                      <Badge tone={toneForConf(row.buyerConfidence.level)}>
                        {row.buyerConfidence.level.replace(" Confidence", "")}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#737A86]">{fmt(row.generatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center gap-2">
          <Button tone="ghost" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>
            Previous
          </Button>
          <span className="text-xs text-[#737A86]">
            Page {page} of {pages} · {total.toLocaleString()}
          </span>
          <Button tone="ghost" disabled={page >= pages || loading} onClick={() => load(page + 1)}>
            Next
          </Button>
        </div>
      )}

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
          paneOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closePane}
      />
      <aside
        className={cn(
          poppins.className,
          "fixed top-0 right-0 z-50 flex h-full w-full max-w-[520px] flex-col border-l border-[#252A33] bg-[#0C0F14] shadow-2xl transition-transform duration-300 ease-out",
          paneOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-[#252A33] px-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00E575]">
              Intelligence
            </p>
            <p className="text-sm font-medium">Full generation</p>
          </div>
          <button
            type="button"
            onClick={closePane}
            className="flex h-9 w-9 items-center justify-center border border-[#252A33] bg-[#171B22]"
          >
            <X className="h-4 w-4 text-[#A7ADB8]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {detailLoading && !detail ? (
            <OrbLoader label="Loading intelligence" />
          ) : src ? (
            <div className="space-y-7">
              <div>
                <h2 className="text-lg font-semibold leading-snug">{src.name}</h2>
                <p className="mt-1 text-sm text-[#A7ADB8]">
                  {[src.brand, src.category, src.subCategory, src.region]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={toneForStatus(gen?.status || "missing")}>
                    {gen?.status || "missing"}
                  </Badge>
                  {gen?.buyerConfidence?.level ? (
                    <Badge tone={toneForConf(gen.buyerConfidence.level)}>
                      {gen.buyerConfidence.level}
                    </Badge>
                  ) : null}
                  {pipe?.needsRefresh ? <Badge tone="warn">Fingerprint stale</Badge> : null}
                  {gen?.status === "pending" ? <Badge tone="warn">Refreshing</Badge> : null}
                </div>
              </div>

              <p className="text-xs leading-relaxed text-[#A7ADB8]">{pipe?.note}</p>
              <p className="text-[11px] leading-relaxed text-[#737A86]">
                One saved generation per product. If the listing is edited, the current text stays until the new generation is ready — then this pane shows the new copy in full.
              </p>

              {/* GENERATED — full, no truncation */}
              <div className="space-y-5 border-t border-[#252A33] pt-5">
                <SectionLabel>Generated intelligence</SectionLabel>
                {gen ? (
                  <div className="space-y-5">
                    <Field label="Summary">
                      <FullText value={gen.summary} />
                    </Field>
                    <Field label="Overview">
                      <FullText value={gen.overview} />
                    </Field>
                    <Field label="Highlights">
                      <BulletList items={gen.highlights} />
                    </Field>
                    <Field label="Best for">
                      <BulletList items={gen.bestFor} />
                    </Field>
                    <Field label="Shipping summary">
                      <FullText value={gen.shippingSummary} />
                    </Field>
                    <Field label="Things to consider">
                      <BulletList items={gen.thingsToConsider} />
                    </Field>
                    <Field label="Buyer confidence explanation">
                      <FullText value={gen.confidenceExplanation} />
                    </Field>
                    <Field label="Buyer confidence">
                      <p className="text-sm text-[#F5F7FA]">
                        {gen.buyerConfidence?.level || "—"}
                        {typeof gen.buyerConfidence?.score === "number"
                          ? ` · ${gen.buyerConfidence.score}/100`
                          : ""}
                      </p>
                      {gen.buyerConfidence?.factors?.length ? (
                        <div className="mt-2">
                          <BulletList items={gen.buyerConfidence.factors} />
                        </div>
                      ) : null}
                    </Field>
                    <div className="space-y-1 text-[11px] leading-relaxed text-[#737A86]">
                      <p>Generated {fmt(gen.generatedAt)}</p>
                      <p>Updated {fmt(gen.updatedAt)}</p>
                      <p>
                        Model {gen.modelVersion || "—"} · prompt v{gen.promptVersion ?? "—"}
                      </p>
                      {gen.fingerprint ? (
                        <p className="break-all font-mono">Fingerprint {gen.fingerprint}</p>
                      ) : null}
                      {pipe?.currentFingerprint ? (
                        <p className="break-all font-mono">
                          Current product fingerprint {pipe.currentFingerprint}
                        </p>
                      ) : null}
                    </div>
                    {gen.error ? (
                      <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[#F87171]">
                        {gen.error}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-[#737A86]">No saved intelligence yet.</p>
                )}
              </div>

              {/* SOURCE — full listing used for generation */}
              <div className="space-y-4 border-t border-[#252A33] pt-5">
                <SectionLabel>Source product</SectionLabel>
                {Array.isArray(src.images) && src.images.length ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {src.images.map((img: string, i: number) => (
                      <div
                        key={`${img}-${i}`}
                        className="h-16 w-16 shrink-0 overflow-hidden border border-[#252A33] bg-[#171B22]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : null}
                <Field label="Description">
                  <FullText value={src.description} />
                </Field>
                <p className="text-sm">
                  Price {Number(src.price || 0).toLocaleString()} · stock {src.stock} ·{" "}
                  {src.isActive ? "active" : "inactive"}
                </p>
                {src.shipping ? (
                  <p className="text-xs leading-relaxed text-[#737A86]">
                    Shipping {src.shipping.method || "—"}
                    {src.shipping.courierCompany ? ` · ${src.shipping.courierCompany}` : ""}
                    {src.shipping.deliveryFee != null
                      ? ` · fee ${src.shipping.deliveryFee}`
                      : ""}
                  </p>
                ) : null}
                {src.fulfillmentLocation ? (
                  <p className="text-xs leading-relaxed text-[#737A86]">
                    Fulfilment{" "}
                    {src.fulfillmentLocation.displayLabel ||
                      [
                        src.fulfillmentLocation.city,
                        src.fulfillmentLocation.state,
                        src.fulfillmentLocation.country,
                      ]
                        .filter(Boolean)
                        .join(", ") ||
                      "—"}
                  </p>
                ) : null}
                {specs.length ? (
                  <div>
                    <SectionLabel>Specifications</SectionLabel>
                    <div className="mt-2 space-y-1.5">
                      {specs.map(([k, v]) => (
                        <p key={k} className="text-xs leading-relaxed text-[#A7ADB8]">
                          <span className="text-[#737A86]">{k}: </span>
                          {String(v ?? "—")}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                <p className="text-xs text-[#737A86]">
                  Seller {src.seller?.storeName || src.seller?.name || "—"}
                </p>
                <p className="text-xs text-[#737A86]">
                  Activity {src.activity?.views ?? 0} views · {src.activity?.cartAdds ?? 0} carts ·{" "}
                  {src.activity?.purchases ?? 0} purchases
                </p>
                <p className="text-xs text-[#737A86]">
                  Seller {src.sellerActivity?.productsListed ?? 0} listings ·{" "}
                  {src.sellerActivity?.ordersGenerated ?? 0} orders
                </p>
                <p className="text-xs text-[#737A86]">Listed {fmt(src.createdAt)}</p>
                <p className="text-xs text-[#737A86]">Product updated {fmt(src.updatedAt)}</p>
              </div>

              <div className="flex flex-col gap-2 border-t border-[#252A33] pt-4">
                <Link
                  href={`/products?productId=${encodeURIComponent(src._id)}`}
                  className="inline-flex h-10 items-center justify-center border border-[#252A33] bg-[#171B22] px-4 text-sm text-[#93C5FD]"
                >
                  Open product on Products
                </Link>
                {src.seller?._id ? (
                  <Link
                    href={`/users?userId=${encodeURIComponent(src.seller._id)}&role=seller`}
                    className="inline-flex h-10 items-center justify-center border border-[#252A33] bg-[#171B22] px-4 text-sm text-[#00E575]"
                  >
                    Open seller on Users
                  </Link>
                ) : null}
                <Button disabled={busy} onClick={regenerate}>
                  {busy
                    ? "Queuing…"
                    : gen?.status === "pending"
                    ? "Refresh queued…"
                    : "Queue intelligence refresh"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-[#A7ADB8]">Select a row.</p>
          )}
        </div>
      </aside>
    </div>
  );
}