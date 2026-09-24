"use client";

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

/** Local first (works offline if in /public), then remote */
const BG_LOCAL = "/auth-logo.jpg";
const BG_REMOTE =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80";
const BG_CACHE_KEY = "plazore_complete_profile_bg_v1";

function isValidPhone(raw: string) {
  return /^\+?\d{7,15}$/.test(raw.trim().replace(/[\s\-()]/g, ""));
}

function profileComplete(u: { name?: string; phone?: string } | null) {
  return !!(
    u?.name &&
    String(u.name).trim() &&
    u?.phone &&
    String(u.phone).trim()
  );
}

/** Resolve best background URL: cache → local → remote (prefetched hard) */
function useProfileBackground() {
  const [src, setSrc] = useState(BG_LOCAL);

  useEffect(() => {
    let cancelled = false;

    const apply = (url: string) => {
      if (!cancelled) setSrc(url);
    };

    // 1) Always paint local immediately
    apply(BG_LOCAL);

    // 2) Cached remote from a previous successful visit
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

    // 3) Aggressive remote fetch + decode (when online)
    const remote = new Image();
    remote.decoding = "async";
    remote.loading = "eager";
    remote.fetchPriority = "high";
    remote.onload = () => {
      apply(BG_REMOTE);
      try {
        localStorage.setItem(BG_CACHE_KEY, BG_REMOTE);
      } catch {
        /* ignore */
      }
    };
    remote.onerror = () => {
      /* keep local */
    };
    // Bust CDN soft-cache a little while still allowing browser HTTP cache
    remote.src = `${BG_REMOTE}${BG_REMOTE.includes("?") ? "&" : "?"}plazore=1`;

    // 4) Second pass with credentials mode off via fetch → blob (heavy path)
    (async () => {
      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false)
          return;
        const res = await fetch(BG_REMOTE, {
          mode: "cors",
          cache: "force-cache",
          credentials: "omit",
          priority: "high" as RequestPriority,
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled || !blob.type.startsWith("image/")) return;
        const objectUrl = URL.createObjectURL(blob);
        const probe = new Image();
        probe.onload = () => {
          if (!cancelled) apply(objectUrl);
        };
        probe.onerror = () => URL.revokeObjectURL(objectUrl);
        probe.src = objectUrl;
      } catch {
        /* offline / CORS — local stays */
      }
    })();

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
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<RegionCode>(DEFAULT_REGION);
  const [countryOpen, setCountryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedRegion = useMemo(
    () => REGION_LIST.find((r) => r.code === country) || REGION_LIST[0],
    [country],
  );

  useEffect(() => {
    if (prefillName) setName(prefillName);
  }, [prefillName]);

  // Close dropdown on outside click / Escape
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
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-3 bg-[#090B0F]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BG_LOCAL}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-[#090B0F]/70" />
        <div className="relative h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#00E575]" />
        <p className="relative text-[13px] text-white/55">Checking profile…</p>
      </div>
    );
  }

  const avatar = user?.imageUrl;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#090B0F] text-white">
      {/* Still image only — local / cached / remote */}
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
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-[#090B0F]/82 to-[#090B0F]/96" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#061210]/35 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-lg px-5 pb-20 pt-8 sm:px-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#00E575]">
          Almost there
        </p>
        <h1 className="text-[28px] font-extrabold tracking-tight sm:text-[30px]">
          Complete your profile
        </h1>
        <p className="mt-2 text-[15px] leading-[22px] text-white/78">
          Name, phone, and country keep orders and the mall accurate.
        </p>

        <div className="mb-5 mt-6 flex items-center gap-3.5 rounded-2xl border border-white/14 bg-white/10 p-3.5 backdrop-blur-sm">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/35">
              <User className="h-6 w-6 text-white/55" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold">
              {avatar ? "Account photo" : "No photo yet"}
            </p>
            <p className="mt-0.5 text-xs leading-[17px] text-white/55">
              {avatar
                ? "From your sign-in — change later in Profile"
                : "You can add one later in Profile"}
            </p>
          </div>
        </div>

        {formError && (
          <div className="mb-3.5 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/18 px-3 py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-300" />
            <p className="text-[13px] leading-[18px] text-red-200">{formError}</p>
          </div>
        )}

        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-white/55">
          Full name
        </p>
        <label className="mb-4 flex h-[54px] items-center rounded-[14px] border border-white/14 bg-white/10 px-3.5 backdrop-blur-sm focus-within:border-[#00E575] focus-within:bg-[rgba(0,229,117,0.06)]">
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

        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-white/55">
          Phone
        </p>
        <label className="mb-4 flex h-[54px] items-center rounded-[14px] border border-white/14 bg-white/10 px-3.5 backdrop-blur-sm focus-within:border-[#00E575] focus-within:bg-[rgba(0,229,117,0.06)]">
          <Phone className="mr-2.5 h-[18px] w-[18px] shrink-0 text-white/55" />
          <input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setFormError(null);
            }}
            placeholder="e.g. 08012345678"
            autoComplete="tel"
            className="w-full bg-transparent text-base outline-none placeholder:text-white/35"
          />
        </label>

        {/* Country — smooth custom dropdown */}
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-white/55">
          Country / marketplace
        </p>
        <p className="mb-2.5 text-xs text-white/55">
          Sets your currency and mall region
        </p>

        <div ref={dropdownRef} className="relative z-30 mb-2">
          <button
            type="button"
            onClick={() => setCountryOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={countryOpen}
            className={`flex h-[54px] w-full items-center gap-3 rounded-[14px] border px-3.5 text-left transition backdrop-blur-sm ${
              countryOpen
                ? "border-[#00E575] bg-[rgba(0,229,117,0.08)]"
                : "border-white/14 bg-white/10 hover:border-white/25"
            }`}
          >
            <span className="text-[22px] leading-none" aria-hidden>
              {selectedRegion?.flag}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-white">
                {selectedRegion?.name}
              </span>
              <span className="mt-0.5 block text-[11px] text-white/50">
                Currency {selectedRegion?.currency?.symbol}
                {selectedRegion?.currency?.code
                  ? ` · ${selectedRegion.currency.code}`
                  : ""}
              </span>
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
              className="absolute left-0 right-0 top-[calc(100%+8px)] max-h-[min(280px,50vh)] overflow-y-auto overscroll-contain rounded-[14px] border border-white/12 bg-[#11141A]/98 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
              style={{
                animation: "cpDropIn 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {REGION_LIST.map((r) => {
                const on = country === r.code;
                return (
                  <button
                    key={r.code}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => {
                      setCountry(r.code as RegionCode);
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
                        {r.currency?.symbol}
                        {r.currency?.code ? ` · ${r.currency.code}` : ""}
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

        <button
          type="button"
          onClick={onSave}
          disabled={loading}
          className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-[14px] text-base font-extrabold text-[#041412] disabled:opacity-70"
          style={{ backgroundImage: GRAD }}
        >
          {loading ? "Saving…" : "Save & enter Plazore"}
          {!loading && <ArrowRight className="h-[18px] w-[18px]" />}
        </button>

        <button
          type="button"
          onClick={() => router.replace("/")}
          className="mt-4 w-full py-2.5 text-sm font-semibold text-[#00E575]"
        >
          Enter Plazore anyway
        </button>
        <p className="mt-3 text-center text-xs text-white/55">
          You can update these later in settings
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