"use client";

import { useAuth } from "@clerk/nextjs";
import {
  Check,
  Diamond,
  Globe2,
  Leaf,
  Rocket,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMarketplace } from "@/context/MarketplaceContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const DEFAULT_REGION = "NG";

const PLAN_PRICE_USD: Record<string, number | null> = {
  free: null,
  global: 12,
  business: 30,
  dominant: 75,
};

const PLAN_PRICE_NGN: Record<string, number | null> = {
  free: null,
  global: 12000,
  business: 30000,
  dominant: 75000,
};

type PlanId = "free" | "global" | "business" | "dominant";

type PlanDef = {
  id: PlanId;
  name: string;
  feePct: number;
  features: string[];
  limited?: boolean;
  Icon: React.ComponentType<{ className?: string }>;
};

const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free Seller",
    feePct: 8,
    Icon: Leaf,
    features: [
      "Up to 6 images per product",
      "Standard showroom visibility",
      "Seller dashboard & orders",
      "Personal storefront",
    ],
  },
  {
    id: "global",
    name: "Global Reach",
    feePct: 5,
    Icon: Globe2,
    features: [
      "Up to 12 images per product",
      "Increased showroom visibility",
    ],
  },
  {
    id: "business",
    name: "Business Plus",
    feePct: 3.5,
    Icon: Rocket,
    features: [
      "Up to 20 images per product",
      "High showroom visibility",
      "Priority product discovery",
    ],
  },
  {
    id: "dominant",
    name: "Dominant Visibility",
    feePct: 2,
    limited: true,
    Icon: Diamond,
    features: [
      "Up to 20 images per product",
      "Maximum showroom visibility",
      "Eligible for Plazore banner",
      "Highest discovery priority",
    ],
  },
];

const PLAN_LABEL: Record<string, string> = {
  free: "Free Seller",
  global: "Global Reach",
  pro: "Global Reach",
  business: "Business Plus",
  dominant: "Dominant Visibility",
};

const REGION_META: Record<
  string,
  { code: string; name: string; flag: string; currency: { code: string; symbol: string } }
> = {
  NG: { code: "NG", name: "Nigeria", flag: "🇳🇬", currency: { code: "NGN", symbol: "₦" } },
  US: { code: "US", name: "United States", flag: "🇺🇸", currency: { code: "USD", symbol: "$" } },
  GB: { code: "GB", name: "United Kingdom", flag: "🇬🇧", currency: { code: "GBP", symbol: "£" } },
  GH: { code: "GH", name: "Ghana", flag: "🇬🇭", currency: { code: "GHS", symbol: "₵" } },
  KE: { code: "KE", name: "Kenya", flag: "🇰🇪", currency: { code: "KES", symbol: "KSh" } },
  ZA: { code: "ZA", name: "South Africa", flag: "🇿🇦", currency: { code: "ZAR", symbol: "R" } },
};

function getRegionMeta(code: string) {
  return REGION_META[code] || REGION_META[DEFAULT_REGION];
}

function formatLocalMoney(amount: number, regionCode: string) {
  const meta = getRegionMeta(regionCode);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: meta.currency.code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${meta.currency.symbol}${Math.round(amount).toLocaleString()}`;
  }
}

/** Simple FX approx if only USD price exists (same idea as mobile convertPrice) */
function convertFromUsd(usd: number, regionCode: string): number {
  const rates: Record<string, number> = {
    US: 1,
    NG: 1600,
    GB: 0.79,
    GH: 15.5,
    KE: 129,
    ZA: 18.2,
  };
  return usd * (rates[regionCode] ?? rates.US);
}

function resolvePlanPrice(planId: PlanId, regionCode: string): string {
  if (planId === "free") return "Free";

  if (regionCode === "NG" && PLAN_PRICE_NGN[planId] != null) {
    return formatLocalMoney(PLAN_PRICE_NGN[planId]!, "NG");
  }

  const usd = PLAN_PRICE_USD[planId];
  if (usd == null) return "Free";

  const local = convertFromUsd(usd, regionCode);
  return formatLocalMoney(Math.round(local), regionCode);
}

function normalizePlan(raw: string): string {
  const p = String(raw || "free").toLowerCase();
  if (p === "pro") return "global";
  return p;
}

async function readJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const t = await res.text();
    throw new Error(`Bad response ${res.status}: ${t.slice(0, 80)}`);
  }
  return res.json();
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
  const { region: appRegion } = useMarketplace();

  const [loading, setLoading] = useState(true);
  const [sellerRegion, setSellerRegion] = useState(appRegion || DEFAULT_REGION);
  const [currentPlan, setCurrentPlan] = useState<string>("free");

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await readJson(res);
      if (json?.success) {
        const u = json.data;
        setSellerRegion(u.marketplaceRegion || appRegion || DEFAULT_REGION);
        setCurrentPlan(
          normalizePlan(
            String(u.sellerPlan || u.subscriptionPlan || u.plan || "free")
          )
        );
      }
    } catch {
      setSellerRegion(appRegion || DEFAULT_REGION);
    } finally {
      setLoading(false);
    }
  }, [getToken, appRegion]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    load();
  }, [isLoaded, isSignedIn, load]);

  const regionMeta = useMemo(() => getRegionMeta(sellerRegion), [sellerRegion]);
  const currentLabel = PLAN_LABEL[currentPlan] || PLAN_LABEL.free;
  const currentFee =
    PLANS.find(
      (p) =>
        p.id === currentPlan || (currentPlan === "pro" && p.id === "global")
    )?.feePct ?? 8;

  if (!isLoaded || loading) return <OrbLoader />;

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <div className="mx-auto max-w-2xl px-[18px] py-5 pb-12 sm:px-6 lg:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[1.8px] text-[#737A86]">
          Growth
        </p>
        <h1 className="mt-1 text-[26px] font-extrabold tracking-tight">
          Seller plans
        </h1>
        <p className="mb-5 mt-2.5 text-sm leading-[21px] text-[#A7ADB8]">
          Lower fees and stronger visibility as your store grows. Fees apply to
          product price only — never delivery.
        </p>

        {/* Current plan hero */}
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
          <p className="mt-1.5 text-[22px] font-extrabold">{currentLabel}</p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-[#737A86]">Transaction fee</p>
              <p className="mt-0.5 text-[28px] font-extrabold text-[#00E575]">
                {currentFee}%
              </p>
            </div>
            <div className="border border-white/[0.07] bg-[#171B22] px-2.5 py-1.5">
              <span className="text-xs font-semibold text-[#A7ADB8]">
                {regionMeta.flag} {regionMeta.name}
              </span>
            </div>
          </div>
        </div>

        <p className="mb-3 text-[11px] font-bold uppercase tracking-[1.4px] text-[#737A86]">
          Plans · {regionMeta.currency.code}
        </p>

        <div className="space-y-3">
          {PLANS.map((plan) => {
            const isCurrent =
              plan.id === currentPlan ||
              (currentPlan === "pro" && plan.id === "global");
            const priceLabel = resolvePlanPrice(plan.id, sellerRegion);
            const Icon = plan.Icon;

            return (
              <article
                key={plan.id}
                className={`relative overflow-hidden border bg-[#11141A] p-4 ${
                  isCurrent
                    ? "border-[#00E575]/35"
                    : "border-white/[0.07]"
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
                      {plan.limited && (
                        <span className="border border-white/[0.07] bg-[#171B22] px-1.5 py-0.5 text-[10px] font-bold text-[#737A86]">
                          Limited
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xl font-extrabold">{priceLabel}</p>
                    <p className="mt-0.5 text-[11px] text-[#737A86]">
                      {plan.id === "free"
                        ? "No monthly charge"
                        : `per month · ${regionMeta.name}`}
                    </p>
                  </div>
                </div>

                <div className="my-3.5 h-px bg-white/[0.07]" />

                <ul className="space-y-2">
                  {plan.features.map((f) => (
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
                  <span className="text-[15px] font-extrabold">{plan.feePct}%</span>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-4 px-2 text-center text-xs leading-[18px] text-[#737A86]">
          Payments and plan changes will open in a later update. Until then,
          this screen shows your current tier and what each plan unlocks.
        </p>
      </div>
    </div>
  );
}