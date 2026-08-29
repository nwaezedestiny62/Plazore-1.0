"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronLeft, Globe } from "lucide-react";
import { useMarketplace } from "@/context/MarketplaceContext";
import { REGION_LIST } from "@/lib/regions";

export default function RegionSettingsPage() {
  const router = useRouter();
  const { region, setRegion, currencyCode, loading } = useMarketplace();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (code: string) => {
    if (code === region || saving) return;
    setSaving(code);
    setError(null);
    try {
      await setRegion(code);
    } catch {
      setError("Could not save region. Your local choice is still applied.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-white/[0.07] bg-[#090B0F]/95 px-2 py-2.5 backdrop-blur sm:px-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">Marketplace region</h1>
          <p className="text-[11px] text-[#6B7280]">Currency & product catalog</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-start gap-3 border border-white/[0.08] bg-[#11141A] p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/[0.08] bg-[#171B22]">
            <Globe className="h-5 w-5 text-[#00E575]" />
          </span>
          <div>
            <p className="text-sm font-bold">Active marketplace</p>
            <p className="mt-1 text-[13px] leading-5 text-[#A7ADB8]">
              Prices convert into your region’s currency. Catalogs prefer this marketplace when
              the API supports region filtering.
            </p>
            {!loading && (
              <p className="mt-2 text-[12px] font-semibold text-[#00E575]">
                Current: {region} · {currencyCode}
              </p>
            )}
          </div>
        </div>

        {error ? (
          <p className="mb-4 border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-[13px] text-[#FECACA]">
            {error}
          </p>
        ) : null}

        <p className="mb-3 text-[11px] font-extrabold tracking-[0.14em] text-[#6B7280]">
          SELECT REGION
        </p>

        <ul className="space-y-2">
          {REGION_LIST.map((r) => {
            const on = region === r.code;
            const busy = saving === r.code;
            return (
              <li key={r.code}>
                <button
                  type="button"
                  onClick={() => onPick(r.code)}
                  disabled={!!saving}
                  className={`flex w-full items-center gap-3 border px-4 py-3.5 text-left transition ${
                    on
                      ? "border-[#00E575]/45 bg-[rgba(0,229,117,0.08)]"
                      : "border-white/[0.08] bg-[#11141A] hover:border-white/15"
                  }`}
                >
                  <span className="text-xl leading-none">{r.flag}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{r.name}</span>
                    <span className="mt-0.5 block text-[12px] text-[#737A86]">
                      {r.currency.code} · {r.currency.symbol}
                    </span>
                  </span>
                  {busy ? (
                    <span className="text-[12px] text-[#A7ADB8]">Saving…</span>
                  ) : on ? (
                    <Check className="h-5 w-5 text-[#00E575]" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}