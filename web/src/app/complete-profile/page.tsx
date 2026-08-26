"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle, Phone, User } from "lucide-react";
import { DEFAULT_REGION, REGION_LIST, type RegionCode } from "@/lib/regions";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";
const FALLBACK_BG =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80";

function isValidPhone(raw: string) {
  return /^\+?\d{7,15}$/.test(raw.trim().replace(/[\s\-()]/g, ""));
}

function profileComplete(u: { name?: string; phone?: string } | null) {
  return !!(u?.name && String(u.name).trim() && u?.phone && String(u.phone).trim());
}

export default function CompleteProfilePage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken, isSignedIn } = useAuth();
  const router = useRouter();
  const checkedRef = useRef(false);
  const [videoOk, setVideoOk] = useState(true);

  const prefillName = useMemo(() => {
    const n = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    return n || user?.fullName || "";
  }, [user?.firstName, user?.lastName, user?.fullName]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<RegionCode>(DEFAULT_REGION);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (prefillName) setName(prefillName);
  }, [prefillName]);

  useEffect(() => {
    if (!userLoaded || checkedRef.current) return;
    checkedRef.current = true;

    (async () => {
      try {
        if (!isSignedIn) {
          router.replace("/sign-in");
          return;
        }
        const token = await getToken();
        if (!token) {
          setChecking(false);
          return;
        }
        const res = await fetch(`${BASE}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const u = json?.data;

        if (profileComplete(u)) {
          router.replace("/");
          return;
        }

        if (u?.name) setName(String(u.name).trim());
        if (u?.phone) setPhone(String(u.phone).trim());
        if (u?.marketplaceRegion) setCountry(u.marketplaceRegion as RegionCode);
      } catch {
        // API down — show form
      } finally {
        setChecking(false);
      }
    })();
  }, [userLoaded, isSignedIn, getToken, router]);

  const onSave = async () => {
    const cleanedName = name.trim();
    const cleanedPhone = phone.trim().replace(/[\s\-()]/g, "");
    setFormError(null);

    if (!cleanedName) {
      setFormError("Name is required");
      return;
    }
    if (!isValidPhone(cleanedPhone)) {
      setFormError("Enter a valid phone (7–15 digits, optional +)");
      return;
    }
    if (!country) {
      setFormError("Select your country");
      return;
    }

    setLoading(true);
    try {
      try {
        const parts = cleanedName.split(/\s+/);
        await user?.update({
          firstName: parts[0] || cleanedName,
          lastName: parts.slice(1).join(" ") || undefined,
        });
      } catch {}

      const token = await getToken();
      if (!token) {
        setFormError("Session expired — sign in again");
        router.replace("/sign-in");
        return;
      }

      const res = await fetch(`${BASE}/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: cleanedName,
          phone: cleanedPhone,
          marketplaceRegion: country,
          ...(user?.imageUrl ? { image: user.imageUrl } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(json?.message || "Could not save");
        return;
      }

      router.replace("/");
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Could not reach server");
    } finally {
      setLoading(false);
    }
  };

  if (!userLoaded || checking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-green" />
        <p className="text-[13px] text-white/55">Checking profile…</p>
      </div>
    );
  }

  const avatar = user?.imageUrl;

  return (
    <div className="relative min-h-screen bg-bg text-white">
      {videoOk ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setVideoOk(false)}
        >
          <source src="/video-3.mp4" type="video/mp4" />
        </video>
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${FALLBACK_BG})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/72 via-bg/82 to-bg/96" />

      <div className="relative mx-auto max-w-lg px-6 pb-20 pt-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-green">Almost there</p>
        <h1 className="text-[28px] font-extrabold tracking-tight">Complete your profile</h1>
        <p className="mt-2 text-[15px] leading-[22px] text-white/78">
          Name, phone, and country keep orders and the mall accurate.
        </p>

        <div className="mt-6 mb-5 flex items-center gap-3.5 rounded-2xl border border-white/14 bg-white/10 p-3.5">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/35">
              <User className="h-6 w-6 text-white/55" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold">{avatar ? "Account photo" : "No photo yet"}</p>
            <p className="mt-0.5 text-xs leading-[17px] text-white/55">
              {avatar ? "From your sign-in — change later in Profile" : "You can add one later in Profile"}
            </p>
          </div>
        </div>

        {formError && (
          <div className="mb-3.5 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/18 px-3 py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-300" />
            <p className="text-[13px] leading-[18px] text-red-200">{formError}</p>
          </div>
        )}

        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-white/55">Full name</p>
        <label className="mb-4 flex h-[54px] items-center rounded-[14px] border border-white/14 bg-white/10 px-3.5 focus-within:border-green focus-within:bg-green/6">
          <User className="mr-2.5 h-[18px] w-[18px] text-white/55" />
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setFormError(null); }}
            placeholder="Your name"
            autoComplete="name"
            className="w-full bg-transparent text-base outline-none placeholder:text-white/35"
          />
        </label>

        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-white/55">Phone</p>
        <label className="mb-4 flex h-[54px] items-center rounded-[14px] border border-white/14 bg-white/10 px-3.5 focus-within:border-green focus-within:bg-green/6">
          <Phone className="mr-2.5 h-[18px] w-[18px] text-white/55" />
          <input
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setFormError(null); }}
            placeholder="e.g. 08012345678"
            autoComplete="tel"
            className="w-full bg-transparent text-base outline-none placeholder:text-white/35"
          />
        </label>

        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-white/55">Country / marketplace</p>
        <p className="mb-2.5 text-xs text-white/55">Sets your currency and mall region</p>
        <div className="flex flex-wrap gap-2">
          {REGION_LIST.map((r) => {
            const on = country === r.code;
            return (
              <button
                key={r.code}
                onClick={() => setCountry(r.code as RegionCode)}
                className={`flex items-center rounded-xl border px-3 py-2.5 ${
                  on ? "border-green/50 bg-green/12" : "border-white/12 bg-white/8"
                }`}
              >
                <span className="mr-1.5 text-base">{r.flag}</span>
                <span className={`text-[13px] font-semibold ${on ? "text-white" : "text-white/78"}`}>{r.name}</span>
                {on && <CheckCircle className="ml-1 h-4 w-4 text-green" />}
              </button>
            );
          })}
        </div>

        <button
          onClick={onSave}
          disabled={loading}
          className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-[14px] text-base font-extrabold text-[#041412]"
          style={{ backgroundImage: GRAD }}
        >
          {loading ? "Saving…" : "Save & enter Plazore"}
          {!loading && <ArrowRight className="h-[18px] w-[18px]" />}
        </button>

        <button onClick={() => router.replace("/")} className="mt-4 w-full py-2.5 text-sm font-semibold text-green">
          Enter Plazore anyway
        </button>
        <p className="mt-3 text-center text-xs text-white/55">You can update these later in settings</p>
      </div>
    </div>
  );
}