"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Phone,
  ShieldCheck,
  Store,
} from "lucide-react";
import { REGION_LIST, DEFAULT_REGION } from "@/lib/regions";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const FALLBACK_BG =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80";

type FocusKey =
  | "storeName"
  | "desc"
  | "goal"
  | "phone"
  | "bank"
  | "accName"
  | "accNum"
  | null;

export default function SellerRegisterPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [businessGoal, setBusinessGoal] = useState("");
  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [marketplaceRegion, setMarketplaceRegion] = useState(DEFAULT_REGION);
  const [showRegions, setShowRegions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [focus, setFocus] = useState<FocusKey>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace(
        `/sign-in?redirect_url=${encodeURIComponent("/seller-register")}`
      );
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${API}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        const data = json?.data;
        if (data?.phone) setPhone(String(data.phone));
        if (data?.marketplaceRegion) setMarketplaceRegion(data.marketplaceRegion);
      } catch {
        /* silent */
      }
    })();
  }, [isSignedIn, getToken]);

  const selectedRegion = useMemo(
    () => REGION_LIST.find((r) => r.code === marketplaceRegion) || REGION_LIST[0],
    [marketplaceRegion]
  );

  const fieldClass = (key: FocusKey) =>
    `flex items-center rounded-none border px-3.5 min-h-[54px] transition ${
      focus === key
        ? "border-[#00E575] bg-[rgba(0,229,117,0.06)]"
        : "border-white/14 bg-white/10"
    }`;

  const handleRegister = async () => {
    setError("");

    if (!storeName.trim()) return setError("Please enter your store name");
    if (!storeDescription.trim())
      return setError("Please enter a business description");
    if (!businessGoal.trim()) return setError("Please enter your business goal");
    if (!phone.trim() || phone.trim().length < 7)
      return setError("Please enter a valid phone number");
    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim())
      return setError("Please fill in all payout / bank details");
    if (!marketplaceRegion) return setError("Please select your marketplace region");

    try {
      setLoading(true);
      const token = await getToken();
      if (!token) {
        setError("Please sign in again");
        return;
      }

      const res = await fetch(`${API}/seller/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeName: storeName.trim(),
          storeDescription: storeDescription.trim(),
          businessGoal: businessGoal.trim(),
          phone: phone.trim().replace(/\s+/g, ""),
          bankName: bankName.trim(),
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          marketplaceRegion,
        }),
      });

      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Registration failed");
      }

      await user?.reload();
      setSuccess(true);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#090B0F] text-white/60">
        Loading…
      </div>
    );
  }

  if (success) {
    return (
      <div className="relative min-h-dvh overflow-hidden bg-[#090B0F] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,229,117,0.18),_transparent_55%)]" />
        <div className="relative z-10 mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center border border-[#00E575]/40 bg-[#00E575]/12">
            <Check className="h-7 w-7 text-[#00E575]" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#00E575]">
            Store created
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome to the Seller Lounge
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/65">
            Your seller account is active. You can start adding products and managing your store.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/seller")}
            className="mt-8 inline-flex h-12 items-center gap-2 bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6] px-6 text-[14px] font-extrabold text-[#041412]"
          >
            Go to Dashboard
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#090B0F] text-white">
      {/* Background media — large canvas */}
      <div className="pointer-events-none absolute inset-0">
        {!videoFailed ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
            onError={() => setVideoFailed(true)}
          >
            <source src="/video-3.mp4" type="video/mp4" />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={FALLBACK_BG} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(5,8,12,0.72)] via-[rgba(9,11,15,0.86)] to-[rgba(9,11,15,0.97)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[rgba(6,18,16,0.35)] via-transparent to-[rgba(9,11,15,0.25)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-16 pt-4 sm:px-6 lg:px-10">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between sm:mb-10">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center border border-white/14 bg-white/10 transition hover:bg-white/15"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-[16px] font-bold tracking-tight sm:text-[17px]">
            Become a Seller
          </h1>
          <div className="w-10" />
        </header>

        <div className="grid flex-1 gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-14">
          {/* Left / hero — large canvas feel on desktop */}
          <section className="lg:sticky lg:top-10">
            <div className="mb-5 flex h-14 w-14 items-center justify-center border border-[#00E575]/35 bg-[#00E575]/12 sm:h-16 sm:w-16">
              <Store className="h-6 w-6 text-[#00E575] sm:h-7 sm:w-7" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#00E575]">
              Seller lounge
            </p>
            <h2 className="mt-3 max-w-xl font-display text-[2rem] font-extrabold leading-[1.08] tracking-tight sm:text-4xl lg:text-[2.75rem]">
              Open your store
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/70 sm:text-base">
              Create your seller profile. You receive access to the Lounge after
              registration is complete.
            </p>

            <div className="mt-8 hidden space-y-3 border border-white/10 bg-white/[0.04] p-5 lg:block">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/45">
                What you get
              </p>
              <ul className="space-y-2.5 text-[14px] text-white/70">
                <li>• Your own storefront on Plazore</li>
                <li>• Product, order, and performance tools</li>
                <li>• Direct access to the Seller Lounge</li>
              </ul>
            </div>
          </section>

          {/* Form */}
          <section className="w-full">
            <div className="border border-white/10 bg-[rgba(9,11,15,0.55)] p-4 backdrop-blur-md sm:p-6 md:p-7">
              <p className="mb-4 text-[15px] font-bold tracking-wide">Store</p>

              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">
                Business / store name *
              </label>
              <div className={`${fieldClass("storeName")} mb-4`}>
                <input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  onFocus={() => setFocus("storeName")}
                  onBlur={() => setFocus(null)}
                  placeholder="e.g. Midnight Atelier"
                  className="w-full bg-transparent text-[16px] text-white outline-none placeholder:text-white/35"
                />
              </div>

              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">
                Business description *
              </label>
              <div
                className={`${fieldClass("desc")} mb-4 min-h-[110px] items-start py-3`}
              >
                <textarea
                  value={storeDescription}
                  onChange={(e) => setStoreDescription(e.target.value)}
                  onFocus={() => setFocus("desc")}
                  onBlur={() => setFocus(null)}
                  placeholder="Tell buyers what you sell..."
                  rows={4}
                  className="w-full resize-none bg-transparent text-[16px] text-white outline-none placeholder:text-white/35"
                />
              </div>

              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">
                Business goal *
              </label>
              <div
                className={`${fieldClass("goal")} mb-4 min-h-[96px] items-start py-3`}
              >
                <textarea
                  value={businessGoal}
                  onChange={(e) => setBusinessGoal(e.target.value)}
                  onFocus={() => setFocus("goal")}
                  onBlur={() => setFocus(null)}
                  placeholder="e.g. Reach 100 monthly orders"
                  rows={3}
                  className="w-full resize-none bg-transparent text-[16px] text-white outline-none placeholder:text-white/35"
                />
              </div>

              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">
                Phone number *
              </label>
              <div className={`${fieldClass("phone")} mb-4 gap-2.5`}>
                <Phone
                  className={`h-4 w-4 shrink-0 ${
                    focus === "phone" ? "text-[#00E575]" : "text-white/55"
                  }`}
                />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onFocus={() => setFocus("phone")}
                  onBlur={() => setFocus(null)}
                  placeholder="e.g. 08012345678"
                  inputMode="tel"
                  className="w-full bg-transparent text-[16px] text-white outline-none placeholder:text-white/35"
                />
              </div>

              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">
                Marketplace region *
              </label>
              <button
                type="button"
                onClick={() => setShowRegions((v) => !v)}
                className="mb-3 flex w-full items-center gap-3 border border-white/14 bg-white/10 px-3.5 py-3.5 text-left transition hover:bg-white/[0.12]"
              >
                <span className="text-[22px] leading-none">{selectedRegion?.flag}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold">
                    {selectedRegion?.name}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-white/55">
                    Currency {selectedRegion?.currency?.symbol}
                  </span>
                </span>
                {showRegions ? (
                  <ChevronUp className="h-4 w-4 text-white/55" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-white/55" />
                )}
              </button>

              {showRegions && (
                <div className="mb-4 overflow-hidden border border-white/12 bg-black/35">
                  {REGION_LIST.map((r) => {
                    const on = marketplaceRegion === r.code;
                    return (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => {
                          setMarketplaceRegion(r.code);
                          setShowRegions(false);
                        }}
                        className={`flex w-full items-center gap-3 border-b border-white/[0.08] px-3.5 py-3 text-left last:border-b-0 ${
                          on ? "bg-[#00E575]/10" : "hover:bg-white/[0.04]"
                        }`}
                      >
                        <span className="text-[20px]">{r.flag}</span>
                        <span className="flex-1 text-[15px]">{r.name}</span>
                        {on && <Check className="h-4 w-4 text-[#00E575]" />}
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="mb-4 mt-7 text-[15px] font-bold tracking-wide">
                Payout / bank details
              </p>

              <div className="mb-5 flex gap-3 border border-[#00E575]/28 bg-[#00E575]/[0.08] p-3.5">
                <ShieldCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#00E575]" />
                <p className="text-[13px] leading-[1.45] text-white/75">
                  Please ensure this bank account is valid and belongs to you.
                  Once Plazore reviews and approves your application, this
                  account becomes the default payout destination for sales on
                  Plazore. Changing payout details later will require
                  verification using the last four digits of the account number
                  filled in.
                </p>
              </div>

              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">
                Bank name *
              </label>
              <div className={`${fieldClass("bank")} mb-4`}>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  onFocus={() => setFocus("bank")}
                  onBlur={() => setFocus(null)}
                  placeholder="e.g. GTBank"
                  className="w-full bg-transparent text-[16px] text-white outline-none placeholder:text-white/35"
                />
              </div>

              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">
                Account name *
              </label>
              <div className={`${fieldClass("accName")} mb-4`}>
                <input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  onFocus={() => setFocus("accName")}
                  onBlur={() => setFocus(null)}
                  placeholder="Name on the account"
                  className="w-full bg-transparent text-[16px] text-white outline-none placeholder:text-white/35"
                />
              </div>

              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">
                Account number *
              </label>
              <div className={`${fieldClass("accNum")} mb-2`}>
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  onFocus={() => setFocus("accNum")}
                  onBlur={() => setFocus(null)}
                  placeholder="0123456789"
                  inputMode="numeric"
                  className="w-full bg-transparent text-[16px] text-white outline-none placeholder:text-white/35"
                />
              </div>

              {error && (
                <p className="mt-4 border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-200">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleRegister}
                disabled={loading}
                className="mt-5 flex h-14 w-full items-center justify-center gap-2 bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6] text-[16px] font-extrabold text-[#041412] transition hover:brightness-105 disabled:opacity-70"
              >
                {loading ? (
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#041412]/25 border-t-[#041412]" />
                ) : (
                  <>
                    Launch my store
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-[12px] leading-relaxed text-white/55">
                By continuing, your store and payout information are saved to
                your Plazore account. You can manage details later from Seller
                Lounge, subject to verification.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}