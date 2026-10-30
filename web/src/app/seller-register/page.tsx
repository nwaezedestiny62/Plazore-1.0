"use client";

/**
 * Web seller register — hardened
 * Logo + banner required. NG Paystack NUBAN resolve on server. Other regions Stripe Connect.
 */

import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Phone,
  ShieldCheck,
  Store,
  X,
} from "lucide-react";
import { REGION_LIST, DEFAULT_REGION } from "@/lib/regions";

const API =
  process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com/api";

const BG_IMAGE =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80";

const NGN_BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "063", name: "Access Bank (Diamond)" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank" },
  { code: "00103", name: "Globus Bank" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "030", name: "Heritage Bank" },
  { code: "301", name: "Jaiz Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "50211", name: "Kuda Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "100", name: "Suntrust Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank For Africa" },
  { code: "215", name: "Unity Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
  { code: "999992", name: "OPay" },
  { code: "999991", name: "PalmPay" },
] as const;

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
  const [bankCode, setBankCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [showBanks, setShowBanks] = useState(false);
  const [marketplaceRegion, setMarketplaceRegion] = useState(DEFAULT_REGION);
  const [showRegions, setShowRegions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState<FocusKey>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const isNigeria = marketplaceRegion === "NG";
  const selectedBank = NGN_BANKS.find((b) => b.code === bankCode);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace(
        `/sign-in?redirect_url=${encodeURIComponent("/seller-register")}`,
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
        if (data?.marketplaceRegion)
          setMarketplaceRegion(data.marketplaceRegion);
      } catch {
        /* silent */
      }
    })();
  }, [isSignedIn, getToken]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [logoPreview, bannerPreview]);

  useEffect(() => {
    setAccountName("");
  }, [bankCode, accountNumber, marketplaceRegion]);

  const selectedRegion = useMemo(
    () =>
      REGION_LIST.find((r) => r.code === marketplaceRegion) || REGION_LIST[0],
    [marketplaceRegion],
  );

  const fieldClass = (key: FocusKey) =>
    `flex items-center rounded-none border px-3.5 min-h-[54px] transition ${
      focus === key
        ? "border-[#00E575] bg-[rgba(0,229,117,0.06)]"
        : "border-white/14 bg-white/10"
    }`;

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const onBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerFile(f);
    setBannerPreview(URL.createObjectURL(f));
  };

  const clearLogo = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    if (logoRef.current) logoRef.current.value = "";
  };

  const clearBanner = () => {
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerFile(null);
    setBannerPreview(null);
    if (bannerRef.current) bannerRef.current.value = "";
  };

  const handleRegister = async () => {
    setError("");

    if (!logoFile) return setError("Upload a store logo (required).");
    if (!bannerFile) return setError("Upload a store banner (required).");
    if (!storeName.trim() || storeName.trim().length < 2)
      return setError("Enter a valid store name (min 2 characters).");
    if (!storeDescription.trim() || storeDescription.trim().length < 20)
      return setError("Business description must be at least 20 characters.");
    if (!businessGoal.trim() || businessGoal.trim().length < 10)
      return setError("Business goal must be at least 10 characters.");
    if (!phone.trim() || phone.replace(/\D/g, "").length < 10)
      return setError("Enter a valid phone number (at least 10 digits).");
    if (!marketplaceRegion)
      return setError("Please select your marketplace region");
    if (isNigeria) {
      if (!bankCode) return setError("Select your bank from the official list.");
      if (!/^\d{10}$/.test(accountNumber.replace(/\D/g, "")))
        return setError("Nigerian account number must be exactly 10 digits.");
    }

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
          marketplaceRegion,
          bankCode: isNigeria ? bankCode : "",
          bankName: isNigeria ? selectedBank?.name || "" : "",
          accountName: isNigeria ? accountName.trim() : "",
          accountNumber: isNigeria
            ? accountNumber.replace(/\D/g, "")
            : "",
        }),
      });

      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Registration failed");
      }

      // Logo + banner MUST succeed
      const fd = new FormData();
      fd.append("storeLogo", logoFile);
      fd.append("storeBanner", bannerFile);
      const imgRes = await fetch(`${API}/seller/store`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const imgJson = await imgRes.json().catch(() => ({}));
      if (!imgRes.ok || imgJson?.success === false) {
        throw new Error(
          imgJson?.message ||
            "Store created but logo/banner upload failed. Open settings and upload them before selling.",
        );
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
            {isNigeria
              ? "Paystack will verify your NUBAN when keys are live. Complete orientation and business location next."
              : "Stripe Connect is required before payouts in this region. Complete orientation next."}
          </p>
          <button
            type="button"
            onClick={() => router.replace("/seller-onboarding")}
            className="mt-8 inline-flex h-12 items-center gap-2 bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6] px-6 text-[14px] font-extrabold text-[#041412]"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#090B0F] text-white">
      <div className="pointer-events-none absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BG_IMAGE} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(5,8,12,0.72)] via-[rgba(9,11,15,0.86)] to-[rgba(9,11,15,0.97)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-16 pt-4 sm:px-6 lg:px-10">
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
              Every field is required. Logo and banner are mandatory. Nigeria
              uses live Paystack account resolve — incomplete accounts cannot
              register.
            </p>
          </section>

          <section className="w-full">
            <div className="border border-white/10 bg-[rgba(9,11,15,0.55)] p-4 backdrop-blur-md sm:p-6 md:p-7">
              <p className="mb-4 text-[15px] font-bold tracking-wide">
                Store identity *
              </p>

              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">
                Store logo *
              </label>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => logoRef.current?.click()}
                  className={`relative flex h-24 w-24 items-center justify-center overflow-hidden border border-dashed bg-white/[0.06] transition hover:border-white/40 ${
                    logoPreview ? "border-white/25" : "border-red-400/40"
                  }`}
                >
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoPreview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-white/50">
                      <ImagePlus className="h-6 w-6" />
                      <span className="text-[11px] font-semibold">Logo</span>
                    </span>
                  )}
                </button>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#00E575]"
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onLogoChange}
                />
              </div>

              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">
                Store banner *
              </label>
              <button
                type="button"
                onClick={() => bannerRef.current?.click()}
                className={`relative mb-2 flex h-[7.5rem] w-full items-center justify-center overflow-hidden border border-dashed bg-white/[0.06] transition hover:border-white/40 sm:h-32 ${
                  bannerPreview ? "border-white/25" : "border-red-400/40"
                }`}
              >
                {bannerPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bannerPreview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-white/50">
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-[12px] font-semibold">
                      Add store banner
                    </span>
                  </span>
                )}
              </button>
              {bannerPreview && (
                <button
                  type="button"
                  onClick={clearBanner}
                  className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[#00E575]"
                >
                  <X className="h-3.5 w-3.5" /> Remove banner
                </button>
              )}
              <input
                ref={bannerRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onBannerChange}
              />

              <p className="mb-4 mt-6 text-[15px] font-bold tracking-wide">
                Store *
              </p>

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
                Business description * (min 20)
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
                <span className="text-[22px] leading-none">
                  {selectedRegion?.flag}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold">
                    {selectedRegion?.name}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-white/55">
                    {isNigeria ? "Paystack payouts" : "Stripe Connect payouts"} |{" "}
                    {selectedRegion?.currency?.symbol}
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
                          setBankCode("");
                          setAccountNumber("");
                          setAccountName("");
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
                Payout wallet *
              </p>

              <div className="mb-5 flex gap-3 border border-[#00E575]/28 bg-[#00E575]/[0.08] p-3.5">
                <ShieldCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#00E575]" />
                <p className="text-[13px] leading-[1.45] text-white/75">
                  {isNigeria
                    ? "Nigeria: bank code + 10-digit NUBAN must resolve on Paystack. Fake accounts are rejected. Account name is filled by Paystack."
                    : "This region uses Stripe Connect — not a Nigerian account. Store can open now; payouts stay held until Connect is linked."}
                </p>
              </div>

              {isNigeria ? (
                <>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">
                    Bank *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowBanks((v) => !v)}
                    className="mb-3 flex w-full items-center gap-3 border border-white/14 bg-white/10 px-3.5 py-3.5 text-left"
                  >
                    <span className="min-w-0 flex-1 text-[16px] font-semibold">
                      {selectedBank?.name || "Select bank"}
                    </span>
                    {showBanks ? (
                      <ChevronUp className="h-4 w-4 text-white/55" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-white/55" />
                    )}
                  </button>
                  {showBanks && (
                    <div className="mb-4 max-h-64 overflow-y-auto border border-white/12 bg-black/35">
                      {NGN_BANKS.map((b) => {
                        const on = bankCode === b.code;
                        return (
                          <button
                            key={b.code}
                            type="button"
                            onClick={() => {
                              setBankCode(b.code);
                              setShowBanks(false);
                            }}
                            className={`flex w-full items-center gap-3 border-b border-white/[0.08] px-3.5 py-3 text-left last:border-b-0 ${
                              on ? "bg-[#00E575]/10" : "hover:bg-white/[0.04]"
                            }`}
                          >
                            <span className="flex-1 text-[15px]">{b.name}</span>
                            {on && <Check className="h-4 w-4 text-[#00E575]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">
                    Account number * (10 digits)
                  </label>
                  <div className={`${fieldClass("accNum")} mb-4`}>
                    <input
                      value={accountNumber}
                      onChange={(e) =>
                        setAccountNumber(
                          e.target.value.replace(/\D/g, "").slice(0, 10),
                        )
                      }
                      onFocus={() => setFocus("accNum")}
                      onBlur={() => setFocus(null)}
                      placeholder="0123456789"
                      inputMode="numeric"
                      className="w-full bg-transparent text-[16px] text-white outline-none placeholder:text-white/35"
                    />
                  </div>

                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">
                    Account name (Paystack)
                  </label>
                  <div className={`${fieldClass("accName")} mb-2 opacity-80`}>
                    <input
                      value={accountName}
                      readOnly
                      placeholder="Filled automatically when Paystack verifies"
                      className="w-full bg-transparent text-[16px] text-white outline-none placeholder:text-white/35"
                    />
                  </div>
                </>
              ) : (
                <div className="mb-4 border border-[#5C3D1E] bg-[#2A1F14] p-3.5 text-[13px] leading-relaxed text-[#C4A882]">
                  Stripe Connect will collect bank details securely after
                  onboarding. No Nigerian NUBAN is stored for{" "}
                  {selectedRegion?.name}.
                </div>
              )}

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
                Incomplete profiles are rejected. Logo, banner, store details,
                and payout destination must be accurate.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
