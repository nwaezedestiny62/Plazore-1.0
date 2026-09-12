"use client";

import { useAuth } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, History, AlertTriangle } from "lucide-react";
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

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type RateRow = {
  currencyCode: string;
  name?: string;
  symbol?: string;
  rateToNgn: string | null;
  isActive: boolean;
  version: number;
  lastUpdated?: string | null;
  changedByName?: string | null;
  reason?: string | null;
  percentChange?: number | null;
};

type HistoryRow = {
  _id: string;
  version: number;
  rateToNgn: string;
  previousRateToNgn?: string;
  percentChange?: number;
  reason?: string;
  changedByName?: string;
  effectiveFrom?: string;
  isActive?: boolean;
};

function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

export default function CurrencyRatesPage() {
  const { getToken } = useAuth();
  const [rates, setRates] = useState<RateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [reason, setReason] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setOffline(false);
      const token = await getToken();
      const res = await adminFetch<{
        success: boolean;
        data: { rates: RateRow[]; baseCurrency: string };
      }>("/admin/currency/rates", token);
      setRates(res.data?.rates || []);
    } catch (e: any) {
      setError(e.message || "Failed to load rates");
      if (/network|fetch|offline/i.test(String(e.message))) setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  const openRow = async (code: string) => {
    setSelected(code);
    setMsg("");
    const row = rates.find((r) => r.currencyCode === code);
    setDraft(row?.rateToNgn ? String(row.rateToNgn) : "");
    setReason("");
    setSourceNote("");
    try {
      const token = await getToken();
      const res = await adminFetch<{ success: boolean; data: HistoryRow[] }>(
        `/admin/currency/rates/${code}/history`,
        token
      );
      setHistory(res.data || []);
    } catch {
      setHistory([]);
    }
  };

  const save = async () => {
    if (!selected || selected === "NGN") return;
    const n = Number(draft);
    if (!(n > 0)) {
      setMsg("Enter a positive rate (1 unit = X NGN)");
      return;
    }
    try {
      setBusy(true);
      setMsg("");
      const token = await getToken();
      const res = await adminFetch<{
        success: boolean;
        warning?: string;
        note?: string;
        percentChange?: number;
      }>(`/admin/currency/rates/${selected}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          rateToNgn: draft,
          reason: reason || "Admin update",
          sourceNote,
        }),
      });
      setMsg(
        [
          res.note || "Rate published for future conversions only.",
          res.warning || "",
          res.percentChange != null
            ? `Change: ${res.percentChange.toFixed(2)}%`
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
      await load();
      await openRow(selected);
    } catch (e: any) {
      setMsg(e.message || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rates;
    return rates.filter(
      (r) =>
        r.currencyCode.toLowerCase().includes(s) ||
        (r.name || "").toLowerCase().includes(s)
    );
  }, [rates, q]);

  const sel = rates.find((r) => r.currencyCode === selected);

  if (loading) {
    return (
      <div className={cn(poppins.className, "flex min-h-[50vh] items-center justify-center")}>
        <OrbLoader />
      </div>
    );
  }

  return (
    <div className={cn(poppins.className, "space-y-4 p-4 md:p-6")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
            Operations
          </p>
          <h1 className="text-xl font-semibold text-[#F5F7FA]">
            Currency & Exchange Rates
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[#A7ADB8]">
            Base currency <span className="text-[#00E575]">NGN</span>. Rates are
            internal. Customers only see final amounts — never this machinery.
            Changes affect future conversions only; history is preserved.
          </p>
        </div>
        <Button tone="ghost" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {offline && (
        <div className="border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Offline or API unreachable. Showing last loaded state if any.
        </div>
      )}
      {error && <ErrorBlock message={error} />}

      <Panel className="border border-[#252A33] bg-[#11141A] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="green">Base: NGN — Nigerian Naira</Badge>
          <span className="text-xs text-[#737A86]">
            1 unit of each currency = X NGN · Cross-rates derived automatically
          </span>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-[#A7ADB8]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          Do not chase every market tick. Update only when a verified reference
          has materially diverged and an authorized admin has reviewed it.
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel className="border border-[#252A33] bg-[#11141A] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search currency…"
              className="max-w-xs"
            />
          </div>
          {filtered.length === 0 ? (
            <EmptyState title="No currencies" />
          ) : (
            <div className="divide-y divide-[#252A33]">
              {filtered.map((r) => (
                <button
                  key={r.currencyCode}
                  type="button"
                  onClick={() => openRow(r.currencyCode)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-2 py-3 text-left transition hover:bg-[#171B22]",
                    selected === r.currencyCode && "bg-[#171B22]"
                  )}
                >
                  <div>
                    <p className="font-medium text-[#F5F7FA]">
                      {r.currencyCode}{" "}
                      <span className="text-[#737A86]">{r.name}</span>
                    </p>
                    <p className="text-sm text-[#A7ADB8]">
                      {r.currencyCode === "NGN"
                        ? "1 NGN = ₦1 (base)"
                        : r.rateToNgn
                          ? `1 ${r.currencyCode} = ₦${r.rateToNgn}`
                          : "No active rate"}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge tone={r.isActive ? "green" : "warn"}>
                      {r.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <p className="mt-1 text-[10px] text-[#737A86]">
                      v{r.version} · {fmt(r.lastUpdated)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="border border-[#252A33] bg-[#11141A] p-4">
          {!selected ? (
            <p className="text-sm text-[#737A86]">
              Select a currency to update or view history.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737A86]">
                  {sel?.name}
                </p>
                <h2 className="text-lg font-semibold text-[#F5F7FA]">
                  {selected}
                </h2>
                <p className="text-xs text-[#A7ADB8]">
                  Current:{" "}
                  {selected === "NGN"
                    ? "1 (locked)"
                    : sel?.rateToNgn
                      ? `1 ${selected} = ₦${sel.rateToNgn}`
                      : "—"}
                </p>
              </div>

              {selected !== "NGN" && (
                <>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#737A86]">
                      New rate — 1 {selected} = ₦ ?
                    </label>
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      inputMode="decimal"
                      placeholder="e.g. 1326.68"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#737A86]">
                      Reason
                    </label>
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Verified reference rate materially changed"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#737A86]">
                      Source note (optional)
                    </label>
                    <Input
                      value={sourceNote}
                      onChange={(e) => setSourceNote(e.target.value)}
                      placeholder="Reference source used"
                    />
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#A7ADB8]">
                    This rate change affects <strong className="text-[#F5F7FA]">future</strong>{" "}
                    conversions only. Historical orders, payments, and payouts
                    will not be recalculated. Seller canonical prices are not
                    rewritten.
                  </p>
                  <Button disabled={busy} onClick={save}>
                    {busy ? "Publishing…" : "Publish rate"}
                  </Button>
                </>
              )}

              {msg && (
                <p className="border border-[#252A33] bg-[#171B22] px-3 py-2 text-xs text-[#A7ADB8]">
                  {msg}
                </p>
              )}

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737A86]">
                  <History className="h-3 w-3" /> Rate history
                </p>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {history.length === 0 ? (
                    <p className="text-xs text-[#737A86]">No history yet.</p>
                  ) : (
                    history.map((h) => (
                      <div
                        key={h._id}
                        className="border border-[#252A33] bg-[#0C0F14] px-3 py-2 text-xs"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="text-[#F5F7FA]">
                            v{h.version} · ₦{h.rateToNgn}
                            {h.isActive ? " · active" : ""}
                          </span>
                          <span className="text-[#737A86]">
                            {fmt(h.effectiveFrom)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[#737A86]">
                          {h.changedByName || "—"}
                          {h.percentChange != null
                            ? ` · ${h.percentChange.toFixed(2)}%`
                            : ""}
                          {h.reason ? ` · ${h.reason}` : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}