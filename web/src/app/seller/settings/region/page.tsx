"use client";

import { useAuth } from "@clerk/nextjs";
import { Check, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMarketplace } from "@/context/MarketplaceContext";
import {
  DEFAULT_REGION,
  REGION_LIST,
  getRegion,
  resolveRegionCode,
} from "@/lib/regions";

const API = process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com/api";

async function readJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const t = await res.text();
    throw new Error(`Bad response ${res.status}: ${t.slice(0, 120)}`);
  }
  return res.json();
}

export default function SellerMarketplaceRegionPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const {
    region: ctxRegion,
    setRegion: setRegionCtx,
    setRegionLocal,
    refreshRegion,
  } = useMarketplace() as any;

  const [region, setRegion] = useState(DEFAULT_REGION);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  // Load server value once
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setRegion(resolveRegionCode(ctxRegion) || DEFAULT_REGION);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) {
          setRegion(resolveRegionCode(ctxRegion) || DEFAULT_REGION);
          return;
        }
        const res = await fetch(`${API}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await readJson(res);
        if (json?.success) {
          const saved = resolveRegionCode(
            json.data?.marketplaceRegion || DEFAULT_REGION
          );
          setRegion(saved);
        } else {
          setRegion(resolveRegionCode(ctxRegion) || DEFAULT_REGION);
        }
      } catch {
        setRegion(resolveRegionCode(ctxRegion) || DEFAULT_REGION);
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback(
    async (rawCode: string) => {
      const code = resolveRegionCode(rawCode);
      if (code === region || saving) return;

      // Optimistic UI + local context (sticky so refreshRegion doesn't overwrite)
      setRegion(code);
      try {
        setRegionLocal?.(code);
      } catch {
        /* optional */
      }

      try {
        setSaving(true);
        const token = await getTokenRef.current();
        if (!token) {
          showToast("Sign in required");
          return;
        }

        const res = await fetch(`${API}/users/me`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ marketplaceRegion: code }),
        });
        const json = await readJson(res);

        if (json?.success) {
          const saved = resolveRegionCode(
            json.data?.marketplaceRegion || code
          );
          setRegion(saved);
          try {
            await setRegionCtx?.(saved);
            await refreshRegion?.();
          } catch {
            /* local already set */
          }
          const meta = getRegion(saved);
          showToast(`Store marketplace → ${meta?.name || saved}`);
        } else {
          // Revert UI to last known good
          showToast(json?.message || "Could not save region");
          const fallback = resolveRegionCode(ctxRegion) || DEFAULT_REGION;
          setRegion(fallback);
          setRegionLocal?.(fallback);
        }
      } catch {
        showToast("Could not save store region");
        const fallback = resolveRegionCode(ctxRegion) || DEFAULT_REGION;
        setRegion(fallback);
        setRegionLocal?.(fallback);
      } finally {
        setSaving(false);
      }
    },
    [region, saving, setRegionCtx, setRegionLocal, refreshRegion, ctxRegion]
  );

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#090B0F]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00E575]/30 border-t-[#00E575]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      {toast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 border border-white/10 bg-[#11141A] px-4 py-2.5 text-sm shadow-xl">
          {toast}
        </div>
      )}

      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-white/[0.07] bg-[#090B0F]/95 px-2 py-3 backdrop-blur sm:px-4">
        <Link
          href="/seller/settings"
          className="flex h-10 w-10 items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 className="text-[17px] font-extrabold">Marketplace region</h1>
          <p className="text-[11px] text-[#737A86]">
            Seller store currency & catalog
          </p>
        </div>
        <div className="w-10" />
      </header>

      <div className="mx-auto max-w-lg px-5 py-5 pb-12">
        <p className="mb-5 text-[13px] leading-5 text-[#737A86]">
          This sets the currency and market for your products, storefront, and
          seller dashboard. Buyers still shop in their own region.
        </p>

        <div className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#11141A]">
          {REGION_LIST.map((r, index) => {
            const selected = region === r.code;
            return (
              <button
                key={r.code}
                type="button"
                disabled={saving}
                onClick={() => handleSelect(r.code)}
                className={`flex w-full items-center px-4 py-3.5 text-left disabled:opacity-60 ${
                  index < REGION_LIST.length - 1
                    ? "border-b border-white/[0.07]"
                    : ""
                } ${selected ? "bg-[#00E575]/[0.08]" : ""}`}
              >
                <span className="mr-3 text-xl">{r.flag}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">
                    {r.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#737A86]">
                    {r.currency?.symbol} · {r.currency?.code}
                  </span>
                </span>
                {selected && (
                  <Check className="h-[22px] w-[22px] text-[#00E575]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}