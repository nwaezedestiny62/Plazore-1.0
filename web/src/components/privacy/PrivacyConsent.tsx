"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import {
  acceptAll,
  essentialOnly,
  HAS_OPTIONAL_ANALYTICS,
  HAS_OPTIONAL_MARKETING,
  readConsent,
  saveCustom,
  type PrivacyConsentState,
} from "@/lib/privacyConsent";

const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";

type Mode = "banner" | "manage" | "hidden";

export function PrivacyConsent() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(false);
  const [marketingOn, setMarketingOn] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduceMotion(reduced);

    const existing = readConsent();
    if (!existing) {
      setMode("banner");
      requestAnimationFrame(() => setOpen(true));
    } else {
      setMode("hidden");
      setAnalyticsOn(!!existing.analytics);
      setMarketingOn(!!existing.marketing);
    }
    setMounted(true);

    const onOpenManage = () => {
      const c = readConsent();
      setAnalyticsOn(!!c?.analytics);
      setMarketingOn(!!c?.marketing);
      setMode("manage");
      requestAnimationFrame(() => setOpen(true));
    };
    window.addEventListener("plazore:open-privacy-prefs", onOpenManage);
    return () =>
      window.removeEventListener("plazore:open-privacy-prefs", onOpenManage);
  }, []);

  const dismiss = useCallback((next: PrivacyConsentState) => {
    setAnalyticsOn(!!next.analytics);
    setMarketingOn(!!next.marketing);
    setOpen(false);
    const ms = reduceMotion ? 0 : 220;
    window.setTimeout(() => setMode("hidden"), ms);
  }, [reduceMotion]);

  const onAcceptAll = () => dismiss(acceptAll());
  const onEssential = () => dismiss(essentialOnly());
  const onSaveCustom = () =>
    dismiss(saveCustom({ analytics: analyticsOn, marketing: marketingOn }));

  if (!mounted || mode === "hidden") return null;

  const anim = reduceMotion
    ? { opacity: open ? 1 : 0 }
    : {
        opacity: open ? 1 : 0,
        transform: open ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 240ms ease, transform 240ms ease",
      };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center p-3 sm:p-5"
      role="region"
      aria-label="Privacy preferences"
    >
      <div
        className="pointer-events-auto w-full max-w-xl border border-white/[0.1] bg-[#0E1116]/97 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-md"
        style={anim}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
      >
        <div
          className="h-px w-full"
          style={{ backgroundImage: GRAD }}
          aria-hidden
        />

        {mode === "banner" && (
          <div className="p-4 sm:p-5">
            <p className="text-[10px] font-extrabold tracking-[0.18em] text-[#00E575]">
              YOUR PRIVACY, YOUR CHOICE
            </p>
            <h2
              id={titleId}
              className="mt-1.5 text-[17px] font-extrabold tracking-tight text-[#F5F7FA]"
            >
              Privacy preferences
            </h2>
            <p className="mt-2.5 text-[13px] leading-[1.55] text-[#A7ADB8]">
              Plazore uses essential technologies to keep your account, security
              and commerce experience working. Optional technologies, when
              enabled, help us understand how Plazore is used and improve the
              experience.
            </p>
            {!HAS_OPTIONAL_ANALYTICS && !HAS_OPTIONAL_MARKETING && (
              <p className="mt-2 text-[12px] leading-relaxed text-white/40">
                Right now only essential technologies are in use. Optional
                analytics or marketing tools will appear here if they are added
                later.
              </p>
            )}
            <p className="mt-2 text-[12px] text-white/40">
              See our{" "}
              <Link
                href="/help"
                className="text-[#00E575] underline-offset-2 hover:underline"
              >
                Help &amp; Support
              </Link>{" "}
              for more on how Plazore handles data.
            </p>

            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={onAcceptAll}
                className="flex h-11 flex-1 items-center justify-center text-[13px] font-extrabold tracking-wide text-[#041412] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E575]"
                style={{ backgroundImage: GRAD }}
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={onEssential}
                className="flex h-11 flex-1 items-center justify-center border border-white/12 bg-[#14181F] text-[13px] font-bold text-[#F5F7FA] transition hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E575]"
              >
                Essential only
              </button>
              <button
                type="button"
                onClick={() => setMode("manage")}
                className="flex h-11 w-full items-center justify-center text-[12px] font-semibold text-white/55 transition hover:text-white sm:w-auto sm:px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E575]"
              >
                Manage preferences
              </button>
            </div>
          </div>
        )}

        {mode === "manage" && (
          <div className="max-h-[min(70vh,520px)] overflow-y-auto p-4 sm:p-5">
            <p className="text-[10px] font-extrabold tracking-[0.18em] text-[#00E575]">
              YOUR PRIVACY, YOUR CHOICE
            </p>
            <h2
              id={titleId}
              className="mt-1.5 text-[17px] font-extrabold tracking-tight text-[#F5F7FA]"
            >
              Manage preferences
            </h2>

            <div className="mt-4 space-y-3">
              <div className="border border-white/[0.08] bg-[#14181F] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-bold text-[#F5F7FA]">
                      Essential
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-[#A7ADB8]">
                      Required for Plazore to operate core features such as
                      authentication, security and commerce functionality.
                    </p>
                  </div>
                  <span className="shrink-0 border border-[#00E575]/30 bg-[#00E575]/10 px-2 py-1 text-[9px] font-extrabold tracking-wide text-[#00E575]">
                    ALWAYS ACTIVE
                  </span>
                </div>
              </div>

              {HAS_OPTIONAL_ANALYTICS && (
                <PreferenceToggle
                  title="Analytics"
                  description="Helps Plazore understand how the product is used so we can improve performance and experience. Not required to use Plazore."
                  checked={analyticsOn}
                  onChange={setAnalyticsOn}
                />
              )}

              {HAS_OPTIONAL_MARKETING && (
                <PreferenceToggle
                  title="Marketing"
                  description="Used for optional marketing measurement. Not required to shop or sell on Plazore."
                  checked={marketingOn}
                  onChange={setMarketingOn}
                />
              )}

              {!HAS_OPTIONAL_ANALYTICS && !HAS_OPTIONAL_MARKETING && (
                <p className="border border-white/[0.06] bg-[#11141A] p-3.5 text-[12px] leading-relaxed text-white/45">
                  No optional analytics or marketing technologies are currently
                  active on Plazore Web. Only essential platform technologies are
                  required.
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={onSaveCustom}
                className="flex h-11 flex-1 items-center justify-center text-[13px] font-extrabold text-[#041412] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E575]"
                style={{ backgroundImage: GRAD }}
              >
                Save preferences
              </button>
              <button
                type="button"
                onClick={() => {
                  const c = readConsent();
                  if (c) {
                    setOpen(false);
                    window.setTimeout(() => setMode("hidden"), reduceMotion ? 0 : 220);
                  } else {
                    setMode("banner");
                  }
                }}
                className="flex h-11 flex-1 items-center justify-center border border-white/10 bg-transparent text-[13px] font-semibold text-white/60 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E575]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreferenceToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="border border-white/[0.08] bg-[#14181F] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="text-[13px] font-bold text-[#F5F7FA]">
            {title}
          </label>
          <p className="mt-1 text-[12px] leading-relaxed text-[#A7ADB8]">
            {description}
          </p>
        </div>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E575] ${
            checked
              ? "border-[#00E575]/50 bg-[#00E575]/25"
              : "border-white/15 bg-[#0E1116]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full transition ${
              checked
                ? "left-6 bg-[#00E575]"
                : "left-0.5 bg-white/40"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

/** Open manage UI from Settings */
export function openPrivacyPreferences() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("plazore:open-privacy-prefs"));
}