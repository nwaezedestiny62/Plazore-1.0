"use client";

import { useAuth } from "@clerk/nextjs";
import { Check, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMarketplace } from "@/context/MarketplaceContext";
import { REGION_LIST, getRegion } from "@/lib/regions";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

async function readJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const t = await res.text();
    throw new Error(`Bad response ${res.status}`);
  }
  return res.json();
}

export default function SellerMarketplaceRegionPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const { setRegion: setRegionCtx, refreshRegion } = useMarketplace() as any;

  const [region, setRegion] = useState("NG");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      if (isLoaded) setLoading(false);
      return;
    }
    (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const res = await fetch(`${API}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await readJson(res);
        if (json?.success) {
          setRegion(json.data?.marketplaceRegion || "NG");
        }
      } catch {
        /* keep default */
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn]);

  const handleSelect = useCallback(
    async (code: string) => {
      if (code === region || saving) return;
      setRegion(code);
      try {
        setRegionCtx?.(code);
      } catch {
        /* optional local sync */
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
          const saved = json.data?.marketplaceRegion || code;
          setRegion(saved);
          try {
            setRegionCtx?.(saved);
            await refreshRegion?.();
          } catch {
            /* ignore */
          }
          const meta = getRegion(saved);
          showToast(`Store marketplace → ${meta?.name || saved}`);
        } else {
          showToast(json?.message || "Could not save");
        }
      } catch {
        showToast("Could not save store region");
      } finally {
        setSaving(false);
      }
    },
    [region, saving, setRegionCtx, refreshRegion]
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
          <p className="text-[11px] text-[#737A86]">Seller store currency & catalog</p>
        </div>
        <div className="w-10" />
      </header>

      <div className="mx-auto max-w-lg px-5 py-5 pb-12">
        <p className="mb-5 text-[13px] leading-5 text-[#737A86]">
          This sets the currency and market for your products, storefront, and
          seller dashboard. Buyers still shop in their own region.
        </p>

        <div className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#11141A]">
          {REGION_LIST.map((r: any, index: number) => {
            const selected = region === r.code;
            return (
              <button
                key={r.code}
                type="button"
                disabled={saving}
                onClick={() => handleSelect(r.code)}
                className={`flex w-full items-center px-4 py-3.5 text-left disabled:opacity-60 ${
                  index < REGION_LIST.length - 1 ? "border-b border-white/[0.07]" : ""
                } ${selected ? "bg-[#00E575]/[0.08]" : ""}`}
              >
                <span className="mr-3 text-xl">{r.flag}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{r.name}</span>
                  <span className="mt-0.5 block text-xs text-[#737A86]">
                    {r.currency?.symbol} · {r.currency?.code}
                  </span>
                </span>
                {selected && <Check className="h-[22px] w-[22px] text-[#00E575]" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}