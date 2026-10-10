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
  Banknote,
  CheckCircle2,
  CreditCard,
  Lock,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";
import { adminFetch } from "@/lib/api";
import { Button, cn } from "@/components/ui";

const GATE_KEY = "plazore.admin.paymentsGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PAYMENTS_PASSWORD ||
  "plazoremoney@098765432123456";

type ProviderHealth = {
  configured: boolean;
  publicKey?: string | null;
};

type MoneyBucket = { currency: string; amount: number };

type PaymentsSummary = {
  feePercent: number;
  gmv: number | null;
  feeRevenue: number | null;
  subRevenue: MoneyBucket[];
  providers: {
    paystack: ProviderHealth;
    stripe: ProviderHealth;
  };
  available: string[];
  counts?: {
    paidOrders?: number;
    pendingPayouts?: number;
    completedPayouts?: number;
    refunds?: number;
  };
};

function PaymentsGate({ children }: { children: ReactNode }) {
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
          <h1 className="mt-2 text-2xl font-semibold">Payments</h1>
          <p className="mt-2 text-[13px] text-white/45">
            Settlement, provider health, payouts and refund operations. Enter
            access password.
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

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        ok
          ? "border-[#00E575]/35 bg-[#00E575]/10 text-[#00E575]"
          : "border-red-500/30 bg-red-500/10 text-red-300"
      )}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

function money(amount: number, currency = "NGN") {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

function sumSubs(rows: any[]): MoneyBucket[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const provider = String(row?.provider || "").toLowerCase();
    if (provider !== "paystack" && provider !== "stripe") continue;
    const amount = Number(row?.amountPaid) || 0;
    if (amount <= 0) continue;
    const currency = String(row?.currency || "NGN").toUpperCase();
    map.set(currency, (map.get(currency) || 0) + amount);
  }
  return Array.from(map.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function PaymentsBody() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<PaymentsSummary | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const token = await getToken();
      if (!token) {
        setError("Session expired. Sign in again.");
        setLoading(false);
        return;
      }

      const [statsRes, subRes, configRes] = await Promise.all([
        adminFetch<any>("/admin/stats", token).catch(() => null),
        adminFetch<any>("/admin/subscriptions/overview", token).catch(() => null),
        adminFetch<any>("/payments/config", token).catch(() => null),
      ]);

      const stats = statsRes?.data || {};
      const config = configRes?.data || configRes || {};
      const subs = subRes?.data?.subscriptions || [];

      const gmvRaw = stats?.commerce?.gmv ?? stats?.totalRevenue;
      const feeRaw =
        stats?.commerce?.platformFeeRevenue ??
        stats?.revenue?.transactionFees ??
        null;

      setData({
        feePercent:
          config.feePercent ??
          (config.feeRate ? Math.round(Number(config.feeRate) * 100) : 8),
        gmv: gmvRaw == null ? null : Number(gmvRaw) || 0,
        feeRevenue: feeRaw == null ? null : Number(feeRaw) || 0,
        subRevenue: sumSubs(subs),
        providers: {
          paystack: {
            configured:
              !!config.providers?.paystack?.configured ||
              config.provider === "paystack",
            publicKey: config.providers?.paystack?.publicKey || null,
          },
          stripe: {
            configured: !!config.providers?.stripe?.configured,
            publicKey: config.providers?.stripe?.publicKey || null,
          },
        },
        available: config.available || [],
        counts: {
          paidOrders: stats?.payments?.paid,
        },
      });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : "Failed to load payments overview";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const subPrimary = data?.subRevenue[0];
  const subLabel = subPrimary
    ? money(subPrimary.amount, subPrimary.currency)
    : data
      ? money(0, "NGN")
      : "—";

  return (
    <div className="mx-auto max-w-5xl pb-24 text-[#F5F7FA]">
      <header className="mb-8">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
          MONETIZATION
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">
              Payments
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] text-white/50">
              Gross merchandise value, platform fee take, and seller plan
              revenue.
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
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-white/40">
            <Banknote className="h-3.5 w-3.5" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
              GMV
            </p>
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">
            {data?.gmv == null ? "—" : money(data.gmv, "NGN")}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-white/35">
            Sum of order totals on non-cancelled orders. Currencies are added
            as stored, not converted. Paid orders:{" "}
            {data?.counts?.paidOrders ?? "—"}.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-white/40">
            <CreditCard className="h-3.5 w-3.5" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
              Transaction fee revenue
            </p>
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">
            {data?.feeRevenue == null ? "—" : money(data.feeRevenue, "NGN")}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-white/35">
            {data?.feeRevenue == null
              ? "Not on /admin/stats yet. Needs a sum of feeBreakdown.platformFee on paid, non-refunded orders."
              : `Default plan rate ${data?.feePercent ?? 8}%. Actual take uses each seller’s plan rate.`}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-white/40">
            <Shield className="h-3.5 w-3.5" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
              Subscription revenue
            </p>
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{subLabel}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-white/35">
            Paid Paystack and Stripe plans only. Promo and Free are excluded.
          </p>
          {data && data.subRevenue.length > 1 && (
            <ul className="mt-3 space-y-1 text-[12px] text-white/55">
              {data.subRevenue.map((b) => (
                <li key={b.currency} className="flex justify-between">
                  <span>{b.currency}</span>
                  <span className="tabular-nums">{money(b.amount, b.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold">Payment providers</h2>
        <p className="mt-1 text-[12px] text-white/45">
          Keys never leave the server. Only public keys and configured flags are
          shown here.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-[#0E1116] p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Paystack</p>
              <StatusPill
                ok={!!data?.providers.paystack.configured}
                label={
                  data?.providers.paystack.configured
                    ? "Connected"
                    : "Not configured"
                }
              />
            </div>
            <p className="mt-2 text-[12px] text-white/45">
              Primary rail for Nigeria &amp; Africa. Charges, refunds, NUBAN
              transfers.
            </p>
            {data?.providers.paystack.publicKey && (
              <p className="mt-3 truncate font-mono text-[10px] text-white/30">
                pk · {String(data.providers.paystack.publicKey).slice(0, 18)}…
              </p>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0E1116] p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Stripe</p>
              <StatusPill
                ok={!!data?.providers.stripe.configured}
                label={
                  data?.providers.stripe.configured
                    ? "Connected"
                    : "Not configured"
                }
              />
            </div>
            <p className="mt-2 text-[12px] text-white/45">
              International cards. PaymentIntents, refunds, Connect transfers to
              sellers.
            </p>
            {data?.providers.stripe.publicKey && (
              <p className="mt-3 truncate font-mono text-[10px] text-white/30">
                pk · {String(data.providers.stripe.publicKey).slice(0, 18)}…
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <PaymentsGate>
      <PaymentsBody />
    </PaymentsGate>
  );
}