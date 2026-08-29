"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Mail,
  Phone,
  User,
} from "lucide-react";
import { useMarketplace } from "@/context/MarketplaceContext";
import { getRegion, REGION_LIST } from "@/lib/regions";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";

function OrbPreloader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#090B0F]">
      <div className="animate-pulse">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="mx-auto h-24 w-24 object-contain" />
      </div>
      <p className="mt-5 text-[15px] font-medium tracking-wide text-white/65">
        Loading profile…
      </p>
    </div>
  );
}

export default function EditProfilePage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user: clerkUser } = useUser();
  const { region: appRegion, setRegion } = useMarketplace();
  const router = useRouter();

  const clerkName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    clerkUser?.fullName ||
    "";

  const [name, setName] = useState(clerkName);
  const [phone, setPhone] = useState("");
  const [region, setLocalRegion] = useState(appRegion || "NG");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRegions, setShowRegions] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    title: string;
    message?: string;
  } | null>(null);

  const regionTouched = useRef(false);
  const loadedOnce = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    if (loadedOnce.current) return;
    loadedOnce.current = true;

    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          setLoading(false);
          return;
        }
        const res = await fetch(`${API}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json?.success) {
          const u = json.data;
          setName(u.name || clerkName || "");
          setPhone(u.phone || "");
          if (!regionTouched.current) {
            setLocalRegion(u.marketplaceRegion || appRegion || "NG");
          }
        }
      } catch {
        if (clerkName) setName(clerkName);
        if (!regionTouched.current && appRegion) setLocalRegion(appRegion);
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, getToken, router, clerkName, appRegion]);

  const handleSelectRegion = (code: string) => {
    regionTouched.current = true;
    setLocalRegion(code);
    setShowRegions(false);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setToast({
        type: "error",
        title: "Name is required",
        message: "Enter your name before saving",
      });
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        setToast({
          type: "error",
          title: "Not signed in",
          message: "Sign out and sign in again",
        });
        setSaving(false);
        return;
      }

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
      const json = await res.json();

      if (!res.ok || !json?.success) {
        if (res.status === 401) {
          setToast({
            type: "error",
            title: "Session expired",
            message: "Please sign out and sign in again",
          });
        } else {
          setToast({
            type: "error",
            title: "Failed to save",
            message: json?.message || "Check your connection and try again",
          });
        }
        return;
      }

      const savedRegion = json.data?.marketplaceRegion || region;
      await setRegion(savedRegion);
      setLocalRegion(savedRegion);
      regionTouched.current = false;

      try {
        const parts = trimmedName.split(/\s+/);
        await clerkUser?.update({
          firstName: parts[0],
          lastName: parts.slice(1).join(" ") || undefined,
        });
      } catch {
        /* optional */
      }

      const chosen = getRegion(savedRegion);
      setToast({
        type: "success",
        title: "Profile updated",
        message: `Marketplace: ${chosen.name} (${chosen.currency.symbol})`,
      });
      setTimeout(() => router.back(), 600);
    } catch (e: unknown) {
      setToast({
        type: "error",
        title: "Failed to save",
        message: e instanceof Error ? e.message : "Check your connection and try again",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded || loading) return <OrbPreloader />;

  const currentRegion = getRegion(region);
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    "—";

  const fieldClass = (focused: boolean) =>
    `mb-[18px] flex h-14 items-center rounded-2xl border bg-[#11151C] px-3.5 transition ${
      focused
        ? "border-[#00E575] bg-[rgba(0,229,117,0.05)]"
        : "border-white/[0.08]"
    }`;

  return (
    <div className="min-h-screen bg-[#090B0F] text-white">
      {toast ? (
        <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-4">
          <div
            className={`w-full max-w-md border px-4 py-3 ${
              toast.type === "success"
                ? "border-[#00E575]/35 bg-[#11141A]"
                : "border-[#EF4444]/40 bg-[#11141A]"
            }`}
          >
            <p className="text-sm font-bold">{toast.title}</p>
            {toast.message ? (
              <p className="mt-0.5 text-[12.5px] text-white/55">{toast.message}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#090B0F]/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06]"
          aria-label="Back"
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <h1 className="text-lg font-bold tracking-tight">Edit Profile</h1>
        <div className="w-10" />
      </header>

      <main className="mx-auto w-full max-w-lg px-5 pb-12">
        <div className="mb-8 mt-2 flex flex-col items-center">
          <div className="flex h-[108px] w-[108px] items-center justify-center rounded-full border-2 border-[#00E575]/35 bg-[#00E575]/[0.06] shadow-[0_8px_24px_rgba(0,229,117,0.2)]">
            {clerkUser?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clerkUser.imageUrl}
                alt=""
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#11151C]">
                <User className="h-10 w-10 text-white/35" />
              </div>
            )}
          </div>
          <p className="mt-3.5 max-w-xs text-center text-[13px] leading-[18px] text-white/35">
            Profile photo is managed by your account provider
          </p>
        </div>

        <label className="mb-2 block text-[13px] font-semibold tracking-wide text-white/70">
          Full Name
        </label>
        <div className={fieldClass(nameFocused)}>
          <User
            className={`mr-3 h-[18px] w-[18px] shrink-0 ${
              nameFocused ? "text-[#00E575]" : "text-white/35"
            }`}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            placeholder="Your full name"
            autoCapitalize="words"
            className="w-full bg-transparent text-base outline-none placeholder:text-white/35"
          />
        </div>

        <label className="mb-2 block text-[13px] font-semibold tracking-wide text-white/70">
          Email
        </label>
        <div className="mb-[18px] flex h-14 items-center rounded-2xl border border-white/[0.08] bg-[#11151C] px-3.5 opacity-75">
          <Mail className="mr-3 h-[18px] w-[18px] shrink-0 text-white/35" />
          <span className="truncate text-base text-white/55">{email}</span>
        </div>

        <label className="mb-2 block text-[13px] font-semibold tracking-wide text-white/70">
          Phone Number
        </label>
        <div className={fieldClass(phoneFocused)}>
          <Phone
            className={`mr-3 h-[18px] w-[18px] shrink-0 ${
              phoneFocused ? "text-[#00E575]" : "text-white/35"
            }`}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onFocus={() => setPhoneFocused(true)}
            onBlur={() => setPhoneFocused(false)}
            placeholder="e.g. 08012345678"
            inputMode="tel"
            className="w-full bg-transparent text-base outline-none placeholder:text-white/35"
          />
        </div>

        <label className="mb-2 block text-[13px] font-semibold tracking-wide text-white/70">
          Marketplace Region
        </label>
        <p className="mb-2.5 mt-[-2px] text-xs leading-[17px] text-white/35">
          Prices and currency across the app follow this country.
        </p>

        <button
          type="button"
          onClick={() => setShowRegions((v) => !v)}
          className="mb-3 flex w-full items-center rounded-2xl border border-white/[0.08] bg-[#11151C] px-3.5 py-3.5 text-left"
        >
          <span className="mr-3.5 text-[26px] leading-none">{currentRegion.flag}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">{currentRegion.name}</span>
            <span className="mt-0.5 block text-[13px] text-white/55">
              Currency: {currentRegion.currency.symbol} ({currentRegion.currency.code})
            </span>
          </span>
          {showRegions ? (
            <ChevronUp className="h-[18px] w-[18px] text-white/55" />
          ) : (
            <ChevronDown className="h-[18px] w-[18px] text-white/55" />
          )}
        </button>

        {showRegions ? (
          <div className="mb-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#11151C]">
            {REGION_LIST.map((r, index) => {
              const selected = region === r.code;
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => handleSelectRegion(r.code)}
                  className={`flex w-full items-center px-3.5 py-3 text-left ${
                    selected ? "bg-[rgba(0,229,117,0.08)]" : ""
                  } ${
                    index < REGION_LIST.length - 1
                      ? "border-b border-white/[0.08]"
                      : ""
                  }`}
                >
                  <span className="mr-3 text-[22px] leading-none">{r.flag}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">{r.name}</span>
                    <span className="mt-px block text-xs text-white/55">
                      {r.currency.symbol} · {r.currency.code}
                    </span>
                  </span>
                  {selected ? <Check className="h-[22px] w-[22px] text-[#00E575]" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-3 flex h-14 w-full items-center justify-center text-base font-extrabold tracking-wide text-[#041412] disabled:opacity-70"
          style={{ backgroundImage: GRAD }}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </main>
    </div>
  );
}