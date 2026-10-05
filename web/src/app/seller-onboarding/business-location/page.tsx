"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ShieldCheck } from "lucide-react";
import { REGION_LIST } from "@/lib/regions";

const API =
  process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com/api";

type Form = {
  country: string;
  state: string;
  city: string;
  street: string;
  zipCode: string;
  landmark: string;
  label: string;
};

export default function BusinessLocationPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [form, setForm] = useState<Form>({
    country: "",
    state: "",
    city: "",
    street: "",
    zipCode: "",
    landmark: "",
    label: "",
  });
  const [showCountries, setShowCountries] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace(
        `/sign-in?redirect_url=${encodeURIComponent("/seller-onboarding/business-location")}`,
      );
      return;
    }
    const role = user?.publicMetadata?.role as string | undefined;
    if (role !== "seller" && role !== "admin") {
      router.replace("/");
      return;
    }

    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${API}/seller/onboarding-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const d = json?.data;
        if (d?.businessLocationCompleted) {
          router.replace("/seller");
          return;
        }
        if (d?.needsOnboarding) {
          router.replace("/seller-onboarding");
          return;
        }
        const region = d?.marketplaceRegion || "NG";
        const regionName =
          REGION_LIST.find((r) => r.code === region)?.name || region;
        setForm((f) => ({
          ...f,
          country: d?.businessLocation?.country || regionName,
          state: d?.businessLocation?.state || "",
          city: d?.businessLocation?.city || "",
          street: d?.businessLocation?.street || "",
          zipCode: d?.businessLocation?.zipCode || "",
          landmark: d?.businessLocation?.landmark || "",
          label: d?.businessLocation?.label || "",
        }));
      } catch {
        /* allow form */
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, user, getToken, router]);

  const set = (key: keyof Form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next: Partial<Record<keyof Form, string>> = {};
    if (!form.country.trim()) next.country = "Country is required";
    if (!form.city.trim()) next.city = "City is required";
    if (!form.street.trim()) next.street = "Business address is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setApiError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/seller/business-location`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          country: form.country.trim(),
          state: form.state.trim(),
          city: form.city.trim(),
          street: form.street.trim(),
          zipCode: form.zipCode.trim(),
          landmark: form.landmark.trim(),
          label: form.label.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Could not save location");
      }
      router.replace("/seller");
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = (key: string) =>
    [
      "w-full rounded-xl border bg-white/[0.04] px-3.5 py-3 text-[15px] text-[#F5F7FA] outline-none transition placeholder:text-white/35",
      focus === key
        ? "border-[#3B82F6]/55 bg-white/[0.06]"
        : "border-white/[0.08]",
      errors[key as keyof Form] ? "border-red-400/55" : "",
    ].join(" ");

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#090B0F]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00E575] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-[#090B0F] text-[#F5F7FA]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0A0E14] via-[#090B0F] to-[#061210]" />

      <div className="relative mx-auto max-w-lg px-5 pb-10 pt-8 sm:px-6">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#00E575]">
          Final step
        </p>
        <h1 className="mb-3 text-[24px] font-bold leading-tight tracking-tight sm:text-[28px]">
          Where does your business operate from?
        </h1>
        <p className="mb-8 text-[14px] leading-relaxed text-white/65">
          Your default business location helps Plazore organize fulfilment,
          seller information, and marketplace operations accurately.
        </p>

        <form onSubmit={submit} className="space-y-1">
          <label className="mb-1.5 mt-4 block text-[13px] font-semibold text-white/65">
            Country *
          </label>
          <button
            type="button"
            onClick={() => setShowCountries((v) => !v)}
            className={`${fieldClass("country")} flex items-center justify-between text-left`}
          >
            <span className={form.country ? "" : "text-white/35"}>
              {form.country || "Select country"}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-white/45 transition ${showCountries ? "rotate-180" : ""}`}
            />
          </button>
          {errors.country ? (
            <p className="mt-1 text-[12px] text-red-400">{errors.country}</p>
          ) : null}
          {showCountries ? (
            <div className="mt-1 max-h-52 overflow-y-auto rounded-xl border border-white/[0.08] bg-[#11141A]">
              {REGION_LIST.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => {
                    set("country", r.name);
                    setShowCountries(false);
                  }}
                  className="flex w-full items-center gap-2 border-b border-white/[0.05] px-3.5 py-2.5 text-left text-[15px] last:border-0 hover:bg-white/[0.04]"
                >
                  <span>{r.flag}</span>
                  <span>{r.name}</span>
                </button>
              ))}
            </div>
          ) : null}

          <label className="mb-1.5 mt-4 block text-[13px] font-semibold text-white/65">
            State / Province
          </label>
          <input
            value={form.state}
            onChange={(e) => set("state", e.target.value)}
            placeholder="e.g. Lagos, California"
            className={fieldClass("state")}
            onFocus={() => setFocus("state")}
            onBlur={() => setFocus(null)}
          />

          <label className="mb-1.5 mt-4 block text-[13px] font-semibold text-white/65">
            City *
          </label>
          <input
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="City or town"
            className={fieldClass("city")}
            onFocus={() => setFocus("city")}
            onBlur={() => setFocus(null)}
          />
          {errors.city ? (
            <p className="mt-1 text-[12px] text-red-400">{errors.city}</p>
          ) : null}

          <label className="mb-1.5 mt-4 block text-[13px] font-semibold text-white/65">
            Business address *
          </label>
          <textarea
            value={form.street}
            onChange={(e) => set("street", e.target.value)}
            placeholder="Street, building, suite"
            rows={2}
            className={`${fieldClass("street")} resize-none`}
            onFocus={() => setFocus("street")}
            onBlur={() => setFocus(null)}
          />
          {errors.street ? (
            <p className="mt-1 text-[12px] text-red-400">{errors.street}</p>
          ) : null}

          <label className="mb-1.5 mt-4 block text-[13px] font-semibold text-white/65">
            Postal / ZIP code
          </label>
          <input
            value={form.zipCode}
            onChange={(e) => set("zipCode", e.target.value)}
            placeholder="Optional"
            className={fieldClass("zipCode")}
            onFocus={() => setFocus("zipCode")}
            onBlur={() => setFocus(null)}
          />

          <label className="mb-1.5 mt-4 block text-[13px] font-semibold text-white/65">
            Landmark / additional info
          </label>
          <input
            value={form.landmark}
            onChange={(e) => set("landmark", e.target.value)}
            placeholder="Optional — helps with fulfilment"
            className={fieldClass("landmark")}
            onFocus={() => setFocus("landmark")}
            onBlur={() => setFocus(null)}
          />

          <label className="mb-1.5 mt-4 block text-[13px] font-semibold text-white/65">
            Location label
          </label>
          <input
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="e.g. Main warehouse, Storefront"
            className={fieldClass("label")}
            onFocus={() => setFocus("label")}
            onBlur={() => setFocus(null)}
          />

          <div className="mt-6 flex gap-2.5 rounded-xl border border-[#3B82F6]/20 bg-[#3B82F6]/08 p-3.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#3B82F6]" />
            <p className="text-[13px] leading-relaxed text-white/65">
              This location is used for fulfilment organisation and seller
              profile accuracy. City and country may appear on your public
              storefront; full street address is not shown to buyers by default.
            </p>
          </div>

          {apiError ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2.5 text-[13px] text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {apiError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00E575] to-[#00C060] text-[16px] font-bold text-[#041008] transition disabled:opacity-70"
          >
            {saving ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#041008] border-t-transparent" />
            ) : (
              <>
                Complete Seller Setup
                <CheckCircle2 className="h-5 w-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
