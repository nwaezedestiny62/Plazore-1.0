"use client";

/**
 * Complete profile — web
 * Country first → dial code + national number → name
 * All fields required. No skip. Once saved, never shown again.
 * Background: mall warming up.
 */

import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Phone,
  User,
} from "lucide-react";
import { DEFAULT_REGION, REGION_LIST, type RegionCode } from "@/lib/regions";

const BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com/api";
const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";

const BG_LOCAL = "/auth-logo.jpg";
const BG_REMOTE =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80";
const BG_CACHE_KEY = "plazore_complete_profile_bg_v1";
const COMPLETE_KEY = "plazore_profile_complete_v1";

/** E.164 dial + national length (digits, no trunk 0) */
const DIAL: Record<
  string,
  { dial: string; min: number; max: number; example: string }
> = {
  NG: { dial: "+234", min: 10, max: 10, example: "801 234 5678" },
  GH: { dial: "+233", min: 9, max: 9, example: "24 123 4567" },
  BJ: { dial: "+229", min: 8, max: 10, example: "90 12 34 56" },
  CM: { dial: "+237", min: 9, max: 9, example: "6 12 34 56 78" },
  KE: { dial: "+254", min: 9, max: 9, example: "712 345 678" },
  ZA: { dial: "+27", min: 9, max: 9, example: "82 123 4567" },
  EG: { dial: "+20", min: 10, max: 10, example: "100 123 4567" },
  US: { dial: "+1", min: 10, max: 10, example: "202 555 0147" },
  CA: { dial: "+1", min: 10, max: 10, example: "416 555 0199" },
  GB: { dial: "+44", min: 10, max: 10, example: "7400 123456" },
  DE: { dial: "+49", min: 10, max: 11, example: "1512 3456789" },
  FR: { dial: "+33", min: 9, max: 9, example: "6 12 34 56 78" },
  AU: { dial: "+61", min: 9, max: 9, example: "412 345 678" },
};

function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}

function normalizeNational(raw: string) {
  let d = digitsOnly(raw);
  if (d.startsWith("0") && d.length > 1) d = d.slice(1);
  return d;
}

function isValidNational(raw: string, region: string) {
  const meta = DIAL[region] || DIAL.NG;
  const d = normalizeNational(raw);
  return d.length >= meta.min && d.length <= meta.max;
}

function toE164(raw: string, region: string) {
  const meta = DIAL[region] || DIAL.NG;
  return `${meta.dial}${normalizeNational(raw)}`;
}

function profileComplete(u: { name?: string; phone?: string } | null) {
  return !!(
    u?.name &&
    String(u.name).trim() &&
    u?.phone &&
    String(u.phone).trim()
  );
}

function markLocalComplete(data: {
  name: string;
  phone: string;
  region: string;
}) {
  try {
    localStorage.setItem(
      COMPLETE_KEY,
      JSON.stringify({ complete: true, ...data, at: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

function readLocalComplete(): boolean {
  try {
    const raw = localStorage.getItem(COMPLETE_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw);
    return p?.complete === true;
  } catch {
    return false;
  }
}

function useProfileBackground() {
  const [src, setSrc] = useState(BG_LOCAL);

  useEffect(() => {
    let cancelled = false;
    const apply = (url: string) => {
      if (!cancelled) setSrc(url);
    };

    apply(BG_LOCAL);

    try {
      const cached = localStorage.getItem(BG_CACHE_KEY);
      if (cached && /^https?:\/\//i.test(cached)) {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => apply(cached);
        img.src = cached;
      }
    } catch {
      /* private mode */
    }

    const remote = new Image();
    remote.decoding = "async";
    remote.onload = () => {
      apply(BG_REMOTE);
      try {
        localStorage.setItem(BG_CACHE_KEY, BG_REMOTE);
      } catch {
        /* ignore */
      }
    };
    remote.src = BG_REMOTE;

    return () => {
      cancelled = true;
    };
  }, []);

  return src;
}

export default function CompleteProfilePage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken, isSignedIn } = useAuth();
  const router = useRouter();
  const checkedRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bgSrc = useProfileBackground();

  const prefillName = useMemo(() => {
    const n = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    return n || user?.fullName || "";
  }, [user?.firstName, user?.lastName, user?.fullName]);

  const [name, setName] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [country, setCountry] = useState<RegionCode | "">("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedRegion = useMemo(
    () => (country ? REGION_LIST.find((r) => r.code === country) : null),
    [country],
  );
  const dialMeta = country ? DIAL[country] || DIAL.NG : null;

  const formReady =
    !!country &&
    name.trim().length > 1 &&
    !!dialMeta &&
    isValidNational(phoneLocal, country);

  useEffect(() => {
    if (prefillName) setName((prev) => prev || prefillName);
  }, [prefillName]);

  useEffect(() => {
    if (!countryOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCountryOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [countryOpen]);

  useEffect(() => {
    if (!userLoaded || checkedRef.current) return;
    checkedRef.current = true;

    (async () => {
      try {
        if (!isSignedIn) {
          router.replace("/sign-in");
          return;
        }

        // Local flag from a previous successful save
        if (readLocalComplete()) {
          router.replace("/");
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
          markLocalComplete({
            name: String(u.name).trim(),
            phone: String(u.phone).trim(),
            region: String(u.marketplaceRegion || DEFAULT_REGION),
          });
          router.replace("/");
          return;
        }

        if (u?.name) setName(String(u.name).trim());
        if (u?.marketplaceRegion) {
          setCountry(u.marketplaceRegion as RegionCode);
          if (u?.phone) {
            const ph = String(u.phone).trim();
            const meta = DIAL[u.marketplaceRegion] || DIAL.NG;
            if (ph.startsWith(meta.dial)) {
              setPhoneLocal(ph.slice(meta.dial.length));
            }
          }
        }
      } catch {
        /* show form */
      } finally {
        setChecking(false);
      }
    })();
  }, [userLoaded, isSignedIn, getToken, router]);

  const onSave = async () => {
    setFormError(null);

    if (!formReady || !country || !dialMeta) {
      setFormError("Country, phone, and name are all required");
      return;
    }

    const cleanedName = name.trim();
    const e164 = toE164(phoneLocal, country);

    setLoading(true);
    try {
      try {
        const parts = cleanedName.split(/\s+/);
        await user?.update({
          firstName: parts[0] || cleanedName,
          lastName: parts.slice(1).join(" ") || undefined,
        });
      } catch {
        /* clerk optional */
      }

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
          phone: e164,
          marketplaceRegion: country,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(json?.message || "Could not save");
        return;
      }

      markLocalComplete({
        name: cleanedName,
        phone: e164,
        region: country,
      });

      router.replace("/");
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Could not reach server");
    } finally {
      setLoading(false);
    }
  };

  if (!userLoaded || checking) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-3 bg-[#090B0F]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BG_LOCAL}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-[#090B0F]/70" />
        <div className="relative h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#00E575]" />
        <p className="relative text-[13px] text-white/55">
          Warming up the mall…
        </p>
      </div>
    );
  }

  const avatar = user?.imageUrl;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#090B0F] text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bgSrc}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        decoding="async"
        fetchPriority="high"
        onError={(e) => {
          const el = e.currentTarget;
          if (el.src.includes(BG_LOCAL)) return;
          el.src = BG_LOCAL;
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-[#090B0F]/80 to-[#090B0F]/96" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#061210]/40 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-lg px-5 pb-20 pt-8 sm:px-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#00E575]" />
          <p className="text-[12px] font-semibold tracking-wide text-white/50">
            Warming up the mall…
          </p>
        </div>

        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#00E575]">
          One last step
        </p>
        <h1 className="text-[28px] font-extrabold tracking-tight sm:text-[30px]">
          Finish your profile
        </h1>
        <p className="mt-2 text-[15px] leading-[22px] text-white/78">
          Country, a real phone number, and your name are required before you
          enter Plazore. This only happens once.
        </p>

        <div className="mb-5 mt-6 flex items-center gap-3.5 border border-white/14 bg-white/10 p-3.5 backdrop-blur-sm">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              className="h-14 w-14 object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center bg-black/35">
              <User className="h-6 w-6 text-white/55" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold">
              {avatar ? "Account photo" : "No photo yet"}
            </p>
            <p className="mt-0.5 text-xs leading-[17px] text-white/55">
              {user?.primaryEmailAddress?.emailAddress ||
                "From your sign-in — change later in Profile"}
            </p>
          </div>
        </div>

        {formError ? (
          <div className="mb-3.5 flex items-center gap-2 border border-red-500/40 bg-red-500/18 px-3 py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-300" />
            <p className="text-[13px] leading-[18px] text-red-200">{formError}</p>
          </div>
        ) : null}

        {/* Country FIRST */}
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-white/55">
          Country *
        </p>
        <p className="mb-2.5 text-xs text-white/45">
          Sets dial code, currency, and mall region
        </p>

        <div ref={dropdownRef} className="relative z-30 mb-4">
          <button
            type="button"
            onClick={() => setCountryOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={countryOpen}
            className={`flex h-[54px] w-full items-center gap-3 border px-3.5 text-left transition backdrop-blur-sm ${
              countryOpen
                ? "border-[#00E575] bg-[rgba(0,229,117,0.08)]"
                : "border-white/14 bg-white/10 hover:border-white/25"
            }`}
          >
            <span className="text-[22px] leading-none" aria-hidden>
              {selectedRegion?.flag || "🌍"}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-[15px] font-semibold ${
                  selectedRegion ? "text-white" : "text-white/40"
                }`}
              >
                {selectedRegion?.name || "Select country first"}
              </span>
              {selectedRegion ? (
                <span className="mt-0.5 block text-[11px] text-white/50">
                  {dialMeta?.dial}
                  {selectedRegion.currency?.code
                    ? ` · ${selectedRegion.currency.symbol} ${selectedRegion.currency.code}`
                    : ""}
                </span>
              ) : null}
            </span>
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-white/50 transition-transform duration-200 ${
                countryOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {countryOpen ? (
            <div
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+8px)] max-h-[min(280px,50vh)] overflow-y-auto overscroll-contain border border-white/12 bg-[#11141A]/98 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
              style={{
                animation: "cpDropIn 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {REGION_LIST.map((r) => {
                const on = country === r.code;
                const d = DIAL[r.code]?.dial || "";
                return (
                  <button
                    key={r.code}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => {
                      setCountry(r.code as RegionCode);
                      setPhoneLocal("");
                      setCountryOpen(false);
                      setFormError(null);
                    }}
                    className={`flex w-full items-center gap-3 border-b border-white/[0.06] px-3.5 py-3 text-left last:border-b-0 transition ${
                      on
                        ? "bg-[rgba(0,229,117,0.12)]"
                        : "hover:bg-white/[0.05] active:bg-white/[0.08]"
                    }`}
                  >
                    <span className="text-[20px] leading-none">{r.flag}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold text-white">
                        {r.name}
                      </span>
                      <span className="text-[11px] text-white/45">
                        {d}
                        {r.currency?.code
                          ? ` · ${r.currency.symbol} ${r.currency.code}`
                          : ""}
                      </span>
                    </span>
                    {on ? (
                      <Check className="h-4 w-4 shrink-0 text-[#00E575]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Phone — dial locked to country */}
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-white/55">
          Phone *
        </p>
        <label
          className={`mb-1 flex h-[54px] items-center border px-3.5 backdrop-blur-sm ${
            !country
              ? "cursor-not-allowed border-white/10 bg-white/5 opacity-60"
              : "border-white/14 bg-white/10 focus-within:border-[#00E575] focus-within:bg-[rgba(0,229,117,0.06)]"
          }`}
        >
          <span
            className={`mr-2 min-w-[3.25rem] text-[15px] font-extrabold ${
              dialMeta ? "text-[#00E575]" : "text-white/35"
            }`}
          >
            {dialMeta?.dial || "+—"}
          </span>
          <Phone className="mr-2 h-[18px] w-[18px] shrink-0 text-white/55" />
          <input
            value={phoneLocal}
            onChange={(e) => {
              setPhoneLocal(e.target.value);
              setFormError(null);
            }}
            placeholder={
              country
                ? dialMeta?.example || "Local number"
                : "Select country first"
            }
            autoComplete="tel-national"
            inputMode="numeric"
            disabled={!country}
            className="w-full bg-transparent text-base outline-none placeholder:text-white/35 disabled:cursor-not-allowed"
          />
        </label>
        <p className="mb-4 mt-1.5 text-xs text-white/45">
          {country && dialMeta
            ? `Local number only — we add ${dialMeta.dial} (${dialMeta.min}${
                dialMeta.min !== dialMeta.max ? `–${dialMeta.max}` : ""
              } digits)`
            : "Pick a country to unlock phone entry"}
        </p>

        {/* Name */}
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-white/55">
          Full name *
        </p>
        <label className="mb-2 flex h-[54px] items-center border border-white/14 bg-white/10 px-3.5 backdrop-blur-sm focus-within:border-[#00E575] focus-within:bg-[rgba(0,229,117,0.06)]">
          <User className="mr-2.5 h-[18px] w-[18px] shrink-0 text-white/55" />
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setFormError(null);
            }}
            placeholder="Your name"
            autoComplete="name"
            className="w-full bg-transparent text-base outline-none placeholder:text-white/35"
          />
        </label>

        <button
          type="button"
          onClick={onSave}
          disabled={!formReady || loading}
          className="mt-7 flex h-14 w-full items-center justify-center gap-2 text-base font-extrabold disabled:cursor-not-allowed"
          style={
            formReady
              ? { backgroundImage: GRAD, color: "#041412" }
              : {
                  backgroundColor: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.38)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }
          }
        >
          {loading
            ? "Saving…"
            : formReady
              ? "Continue to mall"
              : "Fill all fields to continue"}
          {formReady && !loading ? (
            <ArrowRight className="h-[18px] w-[18px]" />
          ) : null}
        </button>

        <p className="mt-4 text-center text-xs text-white/40">
          Required once — you won’t see this screen again after you continue.
        </p>
      </div>

      <style jsx global>{`
        @keyframes cpDropIn {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
