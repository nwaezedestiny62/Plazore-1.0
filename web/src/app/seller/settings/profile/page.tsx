"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import {
  ChevronLeft,
  ExternalLink,
  Globe2,
  Mail,
  Phone,
  Store,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMarketplace } from "@/context/MarketplaceContext";
import { getRegion, REGION_LIST } from "@/lib/regions";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";

async function readJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const t = await res.text();
    throw new Error(`Bad response ${res.status}`);
  }
  return res.json();
}

export default function SellerIdentityPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const { region: appRegion, setRegion: setRegionCtx } = useMarketplace() as any;

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const clerkName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    clerkUser?.fullName ||
    "";

  const [name, setName] = useState(clerkName);
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState(appRegion || "NG");
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRegions, setShowRegions] = useState(false);
  const [toast, setToast] = useState<{ title: string; sub?: string; ok?: boolean } | null>(
    null
  );

  const regionTouched = useRef(false);
  const loadedOnce = useRef(false);

  const flash = (title: string, sub?: string, ok = true) => {
    setToast({ title, sub, ok });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    if (!isLoaded || loadedOnce.current) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    loadedOnce.current = true;

    (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) return;

        const [meRes, storeRes] = await Promise.all([
          fetch(`${API}/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API}/seller/store`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null),
        ]);

        const me = await readJson(meRes);
        if (me?.success) {
          const u = me.data;
          setName(u.name || clerkName || "");
          setPhone(u.phone || "");
          if (!regionTouched.current) {
            setRegion(u.marketplaceRegion || appRegion || "NG");
          }
        }

        if (storeRes?.ok) {
          try {
            const st = await readJson(storeRes);
            if (st?.success && st.data?.storeName) {
              setStoreName(String(st.data.storeName));
            }
          } catch {
            /* ignore */
          }
        }
      } catch {
        if (clerkName) setName(clerkName);
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, clerkName, appRegion]);

  const handleSelectRegion = (code: string) => {
    regionTouched.current = true;
    setRegion(code);
    setShowRegions(false);
  };

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      flash("Name is required", "Enter the name buyers may see after a sale", false);
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        flash("Not signed in", "Sign in again", false);
        return;
      }

      // Identity only — never payout / shipping
      const res = await fetch(`${API}/users/me`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          phone: phone.trim(),
          marketplaceRegion: region,
        }),
      });
      const json = await readJson(res);
      if (!json?.success) throw new Error(json?.message || "Save failed");

      const savedRegion = json.data?.marketplaceRegion || region;
      setRegion(savedRegion);
      try {
        await setRegionCtx?.(savedRegion);
      } catch {
        /* optional */
      }
      regionTouched.current = false;

      const chosen = getRegion(savedRegion);
      flash(
        "Identity updated",
        `Marketplace: ${chosen?.name || savedRegion}`
      );
      setTimeout(() => router.back(), 600);
    } catch (e: any) {
      flash("Failed to save", e?.message || "Try again", false);
    } finally {
      setSaving(false);
    }
  }, [name, phone, region, saving, setRegionCtx, router]);

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-[#090B0F]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#00E575]/30 border-t-[#00E575]" />
        <p className="text-sm text-white/50">Loading identity…</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center bg-[#090B0F] px-6 text-center">
        <p className="font-semibold text-white">Sign in required</p>
        <Link href="/sign-in" className="mt-4 font-bold text-[#00E575]">
          Sign in
        </Link>
      </div>
    );
  }

  const currentRegion = getRegion(region);
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    "—";

  return (
    <div className="min-h-screen bg-[#090B0F] text-white">
      {toast && (
        <div
          className={`fixed left-1/2 top-4 z-50 max-w-sm -translate-x-1/2 border px-4 py-2.5 text-sm shadow-xl ${
            toast.ok
              ? "border-[#00E575]/25 bg-[#11141A]"
              : "border-[#EF4444]/35 bg-[#1A1010]"
          }`}
        >
          <p className="font-bold">{toast.title}</p>
          {toast.sub && (
            <p className="mt-0.5 text-xs text-white/55">{toast.sub}</p>
          )}
        </div>
      )}

      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-white/[0.07] bg-[#090B0F]/95 px-2 py-3 backdrop-blur sm:px-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06]"
          aria-label="Back"
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-[18px] font-bold tracking-tight">Seller identity</h1>
          <p className="text-[11px] text-white/40">Private · not your public storefront</p>
        </div>
        <div className="w-10" />
      </header>

      <div className="mx-auto max-w-lg px-5 pb-14 pt-2">
        {/* Identity card */}
        <div className="mb-6 border border-white/[0.08] bg-[#11151C] p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-[#00E575]/35 bg-[#00E575]/[0.06]">
              {clerkUser?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clerkUser.imageUrl}
                  alt=""
                  className="h-[62px] w-[62px] rounded-full object-cover"
                />
              ) : (
                <User className="h-8 w-8 text-white/35" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-block bg-[#00E575]/12 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#00E575]">
                Seller
              </span>
              <p className="mt-1 truncate text-base font-bold">
                {name.trim() || "Your name"}
              </p>
              <p className="truncate text-xs text-white/40">{email}</p>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-[17px] text-white/38">
            Photo comes from your sign-in provider. This name and phone are used
            for account recovery and order contact —{" "}
            <span className="text-white/55">not shown as your store brand</span>.
          </p>
        </div>

        {/* Store teaser — links out, no edit here */}
        <Link
          href="/seller/store"
          className="mb-6 flex items-center gap-3 border border-white/[0.08] bg-[#11151C] p-3.5 transition hover:border-[#00E575]/25"
        >
          <span className="flex h-10 w-10 items-center justify-center bg-[#00E575]/10">
            <Store className="h-[18px] w-[18px] text-[#00E575]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-white/40">
              Public storefront
            </span>
            <span className="block truncate text-[15px] font-semibold">
              {storeName || "Set up store name & branding"}
            </span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 text-white/35" />
        </Link>

        {/* Full name */}
        <p className="mb-2 text-[13px] font-semibold text-white/70">Full name</p>
        <label className="mb-[18px] flex h-14 items-center rounded-2xl border border-white/[0.08] bg-[#11151C] px-3.5 focus-within:border-[#00E575]/50 focus-within:bg-[#00E575]/[0.05]">
          <User className="mr-3 h-[18px] w-[18px] text-white/35" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full bg-transparent text-base outline-none placeholder:text-white/35"
            autoCapitalize="words"
          />
        </label>

        {/* Email readonly */}
        <p className="mb-2 text-[13px] font-semibold text-white/70">Email</p>
        <div className="mb-[18px] flex h-14 items-center rounded-2xl border border-white/[0.08] bg-[#11151C]/80 px-3.5 opacity-80">
          <Mail className="mr-3 h-[18px] w-[18px] text-white/35" />
          <span className="truncate text-base text-white/55">{email}</span>
        </div>

        {/* Phone */}
        <p className="mb-2 text-[13px] font-semibold text-white/70">Phone</p>
        <label className="mb-[18px] flex h-14 items-center rounded-2xl border border-white/[0.08] bg-[#11151C] px-3.5 focus-within:border-[#00E575]/50 focus-within:bg-[#00E575]/[0.05]">
          <Phone className="mr-3 h-[18px] w-[18px] text-white/35" />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 08012345678"
            inputMode="tel"
            className="w-full bg-transparent text-base outline-none placeholder:text-white/35"
          />
        </label>

        {/* Region — shared field, seller-aware copy + deep link */}
        <p className="mb-1 text-[13px] font-semibold text-white/70">
          Seller marketplace region
        </p>
        <p className="mb-2.5 text-xs leading-[17px] text-white/38">
          Catalog currency for{" "}
          <span className="text-white/55">your products & dashboard</span>. Buyers
          still shop in their own region. For a full region hub, use{" "}
          <Link
            href="/seller/settings/region"
            className="font-semibold text-[#00E575]"
          >
            Seller region settings
          </Link>
          .
        </p>

        <button
          type="button"
          onClick={() => setShowRegions((v) => !v)}
          className="mb-3 flex w-full items-center rounded-2xl border border-white/[0.08] bg-[#11151C] px-3.5 py-3.5 text-left"
        >
          <span className="mr-3.5 text-[26px]">{currentRegion?.flag || "🌍"}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">
              {currentRegion?.name || region}
            </span>
            <span className="mt-0.5 block text-[13px] text-white/55">
              {currentRegion?.currency?.symbol} ({currentRegion?.currency?.code})
            </span>
          </span>
          <Globe2 className="h-[18px] w-[18px] text-white/40" />
        </button>

        {showRegions && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#11151C]">
            {REGION_LIST.map((r: any, index: number) => {
              const selected = region === r.code;
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => handleSelectRegion(r.code)}
                  className={`flex w-full items-center px-3.5 py-3 text-left ${
                    index < REGION_LIST.length - 1
                      ? "border-b border-white/[0.08]"
                      : ""
                  } ${selected ? "bg-[#00E575]/[0.08]" : ""}`}
                >
                  <span className="mr-3 text-[22px]">{r.flag}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">{r.name}</span>
                    <span className="text-xs text-white/55">
                      {r.currency?.symbol} · {r.currency?.code}
                    </span>
                  </span>
                  {selected && (
                    <span className="text-xs font-bold text-[#00E575]">Active</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Explicitly out of scope */}
        <div className="mb-5 border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-[12px] leading-[17px] text-white/38">
          Bank payout and shipping defaults live under{" "}
          <Link
            href="/seller/settings/payout"
            className="font-semibold text-white/55 underline-offset-2 hover:underline"
          >
            Payout & shipping
          </Link>
          — not here.
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex h-14 w-full items-center justify-center rounded-2xl text-base font-extrabold text-[#041412] disabled:opacity-60"
          style={{ backgroundImage: GRAD }}
        >
          {saving ? "Saving…" : "Save identity"}
        </button>
      </div>
    </div>
  );
}