"use client";

import { useAuth } from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Lock, Percent, RefreshCw } from "lucide-react";
import { adminFetch } from "@/lib/api";
import { Button, cn } from "@/components/ui";

const GATE_KEY = "plazore.admin.transmissionGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_TRANSMISSION_PASSWORD || "plazore@trans12345";

const PLAN_FEES = [
  { plan: "Free Seller", rate: "8%", rateNum: 0.08 },
  { plan: "Dominant Niche", rate: "5%", rateNum: 0.05 },
  { plan: "Business Plus", rate: "3.5%", rateNum: 0.035 },
  { plan: "Global Reach", rate: "2%", rateNum: 0.02 },
];

function TransmissionGate({ children }: { children: ReactNode }) {
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
          <h1 className="mt-2 text-2xl font-semibold">Transmission fee</h1>
          <p className="mt-2 text-[13px] text-white/45">
            Platform fee rules by seller plan. Product subtotal only — shipping
            excluded.
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

function TransmissionBody() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setNote("");
    try {
      const token = await getToken();
      if (!token) {
        setNote("Session expired.");
        return;
      }
      // Optional future: GET /admin/transmission/config
      await adminFetch("/payments/config", token).catch(() => null);
      setNote("Rates are defined in server/config/plans.ts (source of truth).");
    } catch (e: any) {
      setNote(e?.message || "Could not reach server.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="mx-auto max-w-3xl pb-24 text-[#F5F7FA]">
      <header className="mb-8">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
          MONETIZATION
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">
              Transmission fee
            </h1>
            <p className="mt-2 max-w-[52ch] text-[13.5px] text-white/50">
              Fee is taken from product price only. Delivery is never included.
              Active seller plan at checkout time sets the rate.
            </p>
          </div>
          <Button
            tone="ghost"
            className="h-10 gap-2 rounded-full border border-white/12 bg-[#14181F] text-xs"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-[#00E575]/25 bg-[#00E575]/[0.06] px-4 py-3 text-[13px] text-white/70">
        <Percent className="h-4 w-4 shrink-0 text-[#00E575]" />
        Centralized in{" "}
        <span className="font-mono text-[12px] text-[#00E575]">
          server/config/plans.ts
        </span>
        . Do not hardcode rates elsewhere.
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.12em] text-white/40">
            <tr>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Fee on product</th>
              <th className="px-4 py-3 font-semibold">Shipping</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_FEES.map((row) => (
              <tr
                key={row.plan}
                className="border-b border-white/[0.04] last:border-0"
              >
                <td className="px-4 py-3.5 font-medium">{row.plan}</td>
                <td className="px-4 py-3.5 font-semibold tabular-nums text-[#00E575]">
                  {row.rate}
                </td>
                <td className="px-4 py-3.5 text-white/45">Excluded</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {note && (
        <p className="mt-4 text-[12px] text-white/40">{note}</p>
      )}

      <section className="mt-8 space-y-2 text-[13px] text-white/50">
        <p className="font-semibold text-white/70">Rules</p>
        <p>1. Seller business location sets subscription currency — not buyer browse region.</p>
        <p>2. Fee rate is locked into order feeBreakdown at checkout from active plan.</p>
        <p>3. Refunds and payouts use frozen amounts; never recompute with live rates.</p>
      </section>
    </div>
  );
}

export default function TransmissionPage() {
  return (
    <TransmissionGate>
      <TransmissionBody />
    </TransmissionGate>
  );
}
