"use client";

import { useAuth } from "@clerk/nextjs";
import {
  Check,
  Diamond,
  Gift,
  Globe2,
  Leaf,
  Loader2,
  Rocket,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  activateFreePlan,
  activatePromoPlan,
  fetchSellerPlans,
  initiatePlan,
  verifyPlan,
  type PlanId,
  type PlanRow,
  type PlansResponse,
} from "@/lib/subscriptionApi";

const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#2563EB)";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  free: Leaf,
  dominant: Globe2,
  business_plus: Rocket,
  global_reach: Diamond,
};

function feePct(rate?: number) {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 1)}%`;
}

function formatPrice(amount: number, currency: string) {
  if (!(amount > 0)) return "Free";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

function featureList(p: PlanRow): string[] {
  const b = p.benefits;
  const lines = [
    `Up to ${b.maxImagesPerProduct} images per product`,
    `${b.showroomVisibility} showroom visibility`,
  ];
  if (b.priorityDiscovery) lines.push("Priority product discovery");
  if (b.bannerEligible) lines.push("Eligible for Plazore banner");
  lines.push(`Transaction fee: ${feePct(b.transactionFeeRate)} (product only)`);
  return lines;
}

function OrbLoader() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-[#090B0F]">
      <div className="relative h-[110px] w-[110px]">
        <div className="absolute inset-0 animate-spin rounded-full border-[2.4px] border-transparent border-t-[#00E575] border-r-[#3B82F6] border-l-[#00E575]" />
      </div>
      <p className="text-[13px] text-[#737A86]">Loading plans…</p>
    </div>
  );
}

export default function SellerSubscriptionPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [payload, setPayload] = useState<PlansResponse["data"] | null>(null);

  const load = useCallback(async () => {
    try {
      setError("");
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const json = await fetchSellerPlans(token);
      setPayload(json.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // Return from Paystack callback ?reference=
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const ref =
      searchParams.get("reference") ||
      searchParams.get("trxref") ||
      searchParams.get("ref");
    if (!ref) {
      void load();
      return;
    }
    (async () => {
      try {
        setBusy("verify");
        const token = await getToken();
        if (!token) return;
        const v = await verifyPlan(token, ref);
        setToast(v.data?.message || "Plan activated.");
        await load();
        // clean query
        if (typeof window !== "undefined") {
          const u = new URL(window.location.href);
          u.searchParams.delete("reference");
          u.searchParams.delete("trxref");
          u.searchParams.delete("ref");
          window.history.replaceState({}, "", u.pathname);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Verification failed");
        await load();
      } finally {
        setBusy(null);
      }
    })();
  }, [isLoaded, isSignedIn, searchParams, getToken, load]);

  const active = payload?.active;
  const currency = payload?.currency || "NGN";
  const country = payload?.country || "NG";
  const promo = payload?.promo;

  const plans = useMemo(() => {
    const list = payload?.plans || [];
    // Ensure order free → dominant → business_plus → global_reach
    const order: PlanId[] = ["free", "dominant", "business_plus", "global_reach"];
    return order
      .map((id) => list.find((p) => p.id === id))
      .filter(Boolean) as PlanRow[];
  }, [payload?.plans]);

  const onSelect = async (planId: PlanId) => {
    if (busy) return;
    setError("");
    setToast("");
    try {
      setBusy(planId);
      const token = await getToken();
      if (!token) throw new Error("Sign in required");

      if (planId === "free") {
        await activateFreePlan(token);
        setToast("Free Seller is now active.");
        await load();
        return;
      }

      const callbackUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/seller/subscription`
          : undefined;

      const res = await initiatePlan(token, planId, callbackUrl);
      if (res.data?.activated) {
        setToast(res.data.message || "Plan activated.");
        await load();
        return;
      }
      const url = res.data?.authorizationUrl;
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error(res.data?.message || "Could not start payment");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const onPromo = async () => {
    if (busy) return;
    setError("");
    try {
      setBusy("promo");
      const token = await getToken();
      if (!token) throw new Error("Sign in required");
      const res = await activatePromoPlan(token);
      setToast(res.data?.message || "Promotional Dominant Niche activated.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Promo unavailable");
    } finally {
      setBusy(null);
    }
  };

  if (!isLoaded || loading) return <OrbLoader />;

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center text-[#F5F7FA]">
        <p className="text-lg font-extrabold">Sign in required</p>
        <p className="mt-2 text-sm text-white/50">
          Open seller plans after signing in as a seller.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <div className="mx-auto max-w-2xl px-[18px] py-5 pb-16 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[1.8px] text-[#737A86]">
          Growth
        </p>
        <h1 className="mt-1 text-[26px] font-extrabold tracking-tight">
          Seller plans
        </h1>
        <p className="mb-5 mt-2.5 text-sm leading-[21px] text-[#A7ADB8]">
          Pricing follows your <strong className="text-white/80">business location</strong>{" "}
          ({country} · {currency}) — not the marketplace you browse. Fees apply
          to product price only, never delivery.
        </p>

        {error && (
          <div className="mb-4 border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-[13px] text-red-200">
            {error}
          </div>
        )}
        {toast && (
          <div className="mb-4 border border-[#00E575]/30 bg-[#00E575]/10 px-3.5 py-3 text-[13px] text-[#00E575]">
            {toast}
          </div>
        )}

        {/* Current plan */}
        <div
          className="mb-6 border border-[#00E575]/22 p-[18px]"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,229,117,0.12), rgba(59,130,246,0.08))",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-[#737A86]">
            Your plan
          </p>
          <p className="mt-1.5 text-[22px] font-extrabold">
            {plans.find((p) => p.id === active?.planId)?.name ||
              active?.planId ||
              "Free Seller"}
            {active?.isPromotional ? (
              <span className="ml-2 bg-[#00E575]/14 px-1.5 py-0.5 text-[10px] font-extrabold text-[#00E575]">
                Promo
              </span>
            ) : null}
          </p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-[#737A86]">Transaction fee</p>
              <p className="mt-0.5 text-[28px] font-extrabold text-[#00E575]">
                {feePct(active?.transactionFeeRate)}
              </p>
            </div>
            <div className="border border-white/[0.07] bg-[#171B22] px-2.5 py-1.5 text-xs font-semibold text-[#A7ADB8]">
              {country} · {currency}
              {active?.maxImagesPerProduct
                ? ` · ${active.maxImagesPerProduct} imgs`
                : ""}
            </div>
          </div>
          {active?.isPromotional && active?.promoExpiresAt && (
            <p className="mt-3 text-[12px] text-white/50">
              Promotional Dominant Niche until{" "}
              {new Date(active.promoExpiresAt).toLocaleDateString()}. After that,
              renew at normal price — we will not charge silently.
            </p>
          )}
        </div>

        {/* Promo card */}
        {(promo?.eligible || promo?.claimed) && (
          <div className="mb-5 border border-amber-500/30 bg-amber-500/[0.08] p-4">
            <div className="flex gap-3">
              <Gift className="h-5 w-5 shrink-0 text-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-amber-100">
                  Dominant Niche — promotional access
                </p>
                <p className="mt-1 text-[12.5px] leading-[18px] text-white/55">
                  {promo.claimed
                    ? `You hold a promotional entitlement (${promo.durationMonths} months free). Activate it below or stay on Free Seller.`
                    : `First 200 eligible sellers: Dominant Niche free for ${promo.durationMonths} months. Not the same as Free Seller — full Dominant benefits at ₦0/$0.`}
                </p>
                {!promo.claimed && promo.eligible && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void onPromo()}
                    className="mt-3 flex h-10 items-center gap-2 px-4 text-[13px] font-extrabold text-[#041412] disabled:opacity-50"
                    style={{ backgroundImage: GRAD }}
                  >
                    {busy === "promo" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Claim promotional Dominant Niche
                  </button>
                )}
                {promo.claimed && active?.planId !== "dominant" && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void onPromo()}
                    className="mt-3 flex h-10 items-center gap-2 px-4 text-[13px] font-extrabold text-[#041412] disabled:opacity-50"
                    style={{ backgroundImage: GRAD }}
                  >
                    Activate promotional Dominant Niche
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <p className="mb-3 text-[11px] font-bold uppercase tracking-[1.4px] text-[#737A86]">
          Plans · {currency}
        </p>

        <div className="space-y-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === active?.planId;
            const Icon = ICONS[plan.id] || Leaf;
            const priceLabel = formatPrice(plan.price.amount, plan.price.currency);
            const features = featureList(plan);

            return (
              <article
                key={plan.id}
                className={`relative overflow-hidden border bg-[#11141A] p-4 ${
                  isCurrent ? "border-[#00E575]/35" : "border-white/[0.07]"
                }`}
              >
                {isCurrent && (
                  <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-[#00E575]" />
                )}

                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#00E575]/10">
                    <Icon className="h-[18px] w-[18px] text-[#00E575]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="text-base font-extrabold">{plan.name}</h2>
                      {isCurrent && (
                        <span className="bg-[#00E575]/14 px-1.5 py-0.5 text-[10px] font-extrabold text-[#00E575]">
                          Current
                        </span>
                      )}
                      {plan.id === "global_reach" && (
                        <span className="border border-white/[0.07] bg-[#171B22] px-1.5 py-0.5 text-[10px] font-bold text-[#737A86]">
                          Limited
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xl font-extrabold">{priceLabel}</p>
                    <p className="mt-0.5 text-[11px] text-[#737A86]">
                      {plan.price.amount > 0
                        ? `per month · ${country}`
                        : "No monthly charge"}
                    </p>
                  </div>
                </div>

                <div className="my-3.5 h-px bg-white/[0.07]" />

                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00E575]" />
                      <span className="text-[13px] leading-[19px] text-[#A7ADB8]">
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center justify-between border border-white/[0.07] bg-[#171B22] px-3 py-2.5">
                  <span className="text-xs text-[#737A86]">Transaction fee</span>
                  <span className="text-[15px] font-extrabold">
                    {feePct(plan.benefits.transactionFeeRate)}
                  </span>
                </div>

                {!isCurrent && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void onSelect(plan.id)}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-2 text-[14px] font-extrabold text-[#041412] disabled:opacity-50"
                    style={{ backgroundImage: GRAD }}
                  >
                    {busy === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {plan.id === "free"
                      ? "Switch to Free Seller"
                      : `Subscribe · ${priceLabel}/mo`}
                  </button>
                )}
              </article>
            );
          })}
        </div>

        <p className="mt-5 px-2 text-center text-xs leading-[18px] text-[#737A86]">
          Paid plans activate only after Paystack confirms payment on the
          server. Cancelling or declining leaves your current plan unchanged.
        </p>
      </div>
    </div>
  );
}
