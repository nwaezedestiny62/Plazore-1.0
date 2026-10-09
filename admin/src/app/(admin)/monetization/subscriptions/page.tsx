"use client";

import { useAuth } from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Gift,
  Lock,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Users,
} from "lucide-react";
import { adminFetch } from "@/lib/api";
import { Button, cn } from "@/components/ui";

const GATE_KEY = "plazore.admin.subscriptionsGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_SUBSCRIPTIONS_PASSWORD || "plazoresub@5678";

type PromoState = {
  enabled: boolean;
  totalSlots: number;
  claimedSlots: number;
  remaining: number;
  durationMonths: number;
};

type SubRow = {
  _id?: string;
  seller?: {
    _id?: string;
    name?: string;
    storeName?: string;
    email?: string;
  };
  planId?: string;
  status?: string;
  country?: string;
  currency?: string;
  amountPaid?: number;
  isPromotional?: boolean;
  promoSlotNumber?: number | null;
  startedAt?: string;
  expiresAt?: string;
  transactionFeeRate?: number;
};

function SubscriptionsGate({ children }: { children: ReactNode }) {
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
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
            shake && "animate-[plazore-shake_0.4s_ease-in-out]"
          )}
        >
          <div className="h-px bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />
          <div className="mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
            <Lock className="h-4 w-4 text-[#00E575]" />
          </div>
          <p className="mt-4 text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
            RESTRICTED
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            On-platform subscriptions
          </h1>
          <p className="mt-2 text-[13px] text-white/45">
            Seller plans, promotional Dominant Niche slots, and activation
            status.
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

function planLabel(id?: string) {
  const map: Record<string, string> = {
    free: "Free Seller",
    dominant: "Dominant Niche",
    business_plus: "Business Plus",
    global_reach: "Global Reach",
  };
  return map[String(id || "")] || id || "—";
}

function fmtDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "—";
  }
}

function SubscriptionsBody() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [promo, setPromo] = useState<PromoState>({
    enabled: false,
    totalSlots: 200,
    claimedSlots: 0,
    remaining: 200,
    durationMonths: 7,
  });
  const [rows, setRows] = useState<SubRow[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const token = await getToken();
      if (!token) {
        setError("Session expired.");
        setLoading(false);
        return;
      }

      try {
        const json = await adminFetch<any>("/admin/subscriptions/overview", token);
        const body = json?.data || json || {};
        if (body.promo) {
          setPromo({
            enabled: !!body.promo.enabled,
            totalSlots: Number(body.promo.totalSlots ?? 200),
            claimedSlots: Number(body.promo.claimedSlots ?? 0),
            remaining: Math.max(
              0,
              Number(body.promo.totalSlots ?? 200) -
                Number(body.promo.claimedSlots ?? 0)
            ),
            durationMonths: Number(body.promo.durationMonths ?? 7),
          });
        }
        if (Array.isArray(body.subscriptions)) {
          setRows(body.subscriptions);
        } else if (Array.isArray(body.data)) {
          setRows(body.data);
        }
      } catch {
        // Endpoints may not be wired yet — show static promo defaults
        setError(
          "Subscription API not reachable yet. Promo defaults shown. Wire /admin/subscriptions/overview when ready."
        );
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePromo = async () => {
    try {
      setBusy(true);
      setError("");
      const token = await getToken();
      if (!token) return;
      const next = !promo.enabled;
      try {
        await adminFetch("/admin/subscriptions/promo", token, {
          method: "POST",
          body: JSON.stringify({ enabled: next }),
        });
        setPromo((p) => ({ ...p, enabled: next }));
      } catch (e: any) {
        setError(
          e?.message ||
            "Could not update promo toggle. Ensure POST /admin/subscriptions/promo exists."
        );
        // Optimistic local only if backend missing
        setPromo((p) => ({ ...p, enabled: next }));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl pb-24 text-[#F5F7FA]">
      <header className="mb-8">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
          MONETIZATION
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">
              On-platform subscriptions
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] text-white/50">
              Plans activate only after server-side payment verification.
              Business location country drives currency — not marketplace
              browse region.
            </p>
          </div>
          <Button
            tone="ghost"
            className="h-10 gap-2 rounded-full border border-white/12 bg-[#14181F] text-xs"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      {/* 200 Dominant Niche promo */}
      <section className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00E575]/10">
              <Gift className="h-5 w-5 text-[#00E575]" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">
                200 Dominant Niche free slots
              </h2>
              <p className="mt-1 max-w-md text-[12px] text-white/45">
                When ON, the first 200 sellers who complete onboarding may claim
                Dominant Niche free for {promo.durationMonths} months. Toggle ON
                does not auto-grant — backend enforces slot limits atomically.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void togglePromo()}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition",
              promo.enabled
                ? "border-[#00E575]/40 bg-[#00E575]/15 text-[#00E575]"
                : "border-white/12 bg-[#14181F] text-white/55"
            )}
          >
            {promo.enabled ? (
              <ToggleRight className="h-5 w-5" />
            ) : (
              <ToggleLeft className="h-5 w-5" />
            )}
            {promo.enabled ? "Promotion ON" : "Promotion OFF"}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-[#0E1116] p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/35">
              Total
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {promo.totalSlots}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0E1116] p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/35">
              Claimed
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[#00E575]">
              {promo.claimedSlots}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0E1116] p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/35">
              Remaining
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {promo.remaining}
            </p>
          </div>
        </div>
      </section>

      {/* Plan reference */}
      <section className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-white/40" />
          <h2 className="text-sm font-semibold">Plan hierarchy</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-white/40">
              <tr>
                <th className="pb-2 font-semibold">Plan</th>
                <th className="pb-2 font-semibold">NGN</th>
                <th className="pb-2 font-semibold">USD</th>
                <th className="pb-2 font-semibold">Images</th>
                <th className="pb-2 font-semibold">Fee</th>
              </tr>
            </thead>
            <tbody className="text-white/70">
              <tr className="border-t border-white/[0.06]">
                <td className="py-2.5">Free Seller</td>
                <td>₦0</td>
                <td>$0</td>
                <td>6</td>
                <td>8%</td>
              </tr>
              <tr className="border-t border-white/[0.06]">
                <td className="py-2.5">Dominant Niche</td>
                <td>₦12,000</td>
                <td>$12</td>
                <td>12</td>
                <td>5%</td>
              </tr>
              <tr className="border-t border-white/[0.06]">
                <td className="py-2.5">Business Plus</td>
                <td>₦30,000</td>
                <td>$30</td>
                <td>20</td>
                <td>3.5%</td>
              </tr>
              <tr className="border-t border-white/[0.06]">
                <td className="py-2.5">Global Reach</td>
                <td>₦75,000</td>
                <td>$75</td>
                <td>20</td>
                <td>2%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Active subscriptions list */}
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-sm font-semibold">Seller subscriptions</h2>
          <p className="text-[11px] text-white/40">
            {rows.length} loaded · promotional rows marked
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-white/40">
            No subscription rows yet. Wire{" "}
            <span className="font-mono text-[12px]">
              GET /admin/subscriptions/overview
            </span>{" "}
            to populate.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.1em] text-white/40">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Seller</th>
                  <th className="px-4 py-2.5 font-semibold">Plan</th>
                  <th className="px-4 py-2.5 font-semibold">Country</th>
                  <th className="px-4 py-2.5 font-semibold">Fee</th>
                  <th className="px-4 py-2.5 font-semibold">Promo</th>
                  <th className="px-4 py-2.5 font-semibold">Expires</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r._id || i}
                    className="border-b border-white/[0.04] last:border-0"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {r.seller?.storeName || r.seller?.name || "—"}
                      </p>
                      <p className="text-[11px] text-white/35">
                        {r.seller?.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">{planLabel(r.planId)}</td>
                    <td className="px-4 py-3">
                      {r.country || "—"} · {r.currency || "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.transactionFeeRate != null
                        ? `${(r.transactionFeeRate * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.isPromotional
                        ? `Slot #${r.promoSlotNumber ?? "—"}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-white/55">
                      {fmtDate(r.expiresAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <SubscriptionsGate>
      <SubscriptionsBody />
    </SubscriptionsGate>
  );
}
