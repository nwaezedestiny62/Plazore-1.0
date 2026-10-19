"use client";

/**
 * Plazore privacy consent — bottom sheet
 * Essential always on · optional analytics / marketing when enabled in config
 * Mobile: full-width buttons, generous inner padding, stacked (never cramped).
 */

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

const GRAD = "linear-gradient(100deg,#00E575 0%,#12C98A 55%,#3B82F6 140%)";

type Mode = "banner" | "manage" | "hidden";

const btnBase =
  "flex w-full min-h-[56px] items-center justify-center rounded-2xl px-6 py-4 text-[15px] font-extrabold tracking-[0.01em] leading-none transition active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E575]";

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

  const dismiss = useCallback(
    (next: PrivacyConsentState) => {
      setAnalyticsOn(!!next.analytics);
      setMarketingOn(!!next.marketing);
      setOpen(false);
      const ms = reduceMotion ? 0 : 280;
      window.setTimeout(() => setMode("hidden"), ms);
    },
    [reduceMotion]
  );

  const onAcceptAll = () => dismiss(acceptAll());
  const onEssential = () => dismiss(essentialOnly());
  const onSaveCustom = () =>
    dismiss(saveCustom({ analytics: analyticsOn, marketing: marketingOn }));

  if (!mounted || mode === "hidden") return null;

  const sheetStyle: React.CSSProperties = reduceMotion
    ? { opacity: open ? 1 : 0 }
    : {
        opacity: open ? 1 : 0,
        transform: open ? "translateY(0) scale(1)" : "translateY(18px) scale(0.98)",
        transition:
          "opacity 280ms cubic-bezier(0.22,1,0.36,1), transform 320ms cubic-bezier(0.22,1,0.36,1)",
      };

  const hasOptional = HAS_OPTIONAL_ANALYTICS || HAS_OPTIONAL_MARKETING;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6"
      role="region"
      aria-label="Privacy preferences"
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[radial-gradient(ellipse_at_bottom,rgba(0,229,117,0.14),transparent_68%)]"
        aria-hidden
      />

      <div
        className="pointer-events-auto relative w-full max-w-[28rem] overflow-hidden rounded-[1.6rem] border border-white/[0.1] bg-[#0C0F14]/94 shadow-[0_28px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        style={sheetStyle}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
      >
        <div
          className="h-[3px] w-full"
          style={{ backgroundImage: GRAD }}
          aria-hidden
        />

        {mode === "banner" && (
          <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
            <div className="mb-4 flex items-start gap-3.5">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#00E575]/25 bg-[#00E575]/[0.1]"
                aria-hidden
              >
                <ShieldIcon className="h-5 w-5 text-[#00E575]" />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#00E575]">
                  Privacy
                </p>
                <h2
                  id={titleId}
                  className="mt-1 text-[19px] font-extrabold tracking-tight text-[#F5F7FA]"
                >
                  Your data, your choice
                </h2>
              </div>
            </div>

            <p className="text-[14px] leading-[1.65] text-[#A7ADB8]">
              Plazore uses essential tools so your account, checkout, and
              security work reliably. Optional tools — if you allow them — help
              us understand usage and refine the experience.
            </p>

            {!hasOptional && (
              <p className="mt-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 text-[13px] leading-relaxed text-white/50">
                Only essential technologies are active right now. Optional
                analytics or marketing will show up here if we add them later.
              </p>
            )}

            <p className="mt-3.5 text-[13px] leading-relaxed text-white/40">
              Learn more in{" "}
              <Link
                href="/help"
                className="font-semibold text-[#00E575] underline-offset-2 transition hover:underline"
              >
                Help & Support
              </Link>
              .
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={onAcceptAll}
                className={`${btnBase} text-[#041412] shadow-[0_10px_28px_rgba(0,229,117,0.22)] hover:brightness-105`}
                style={{ backgroundImage: GRAD }}
              >
                Accept all
              </button>

              <button
                type="button"
                onClick={onEssential}
                className={`${btnBase} border border-white/[0.12] bg-white/[0.05] text-[#F5F7FA] hover:bg-white/[0.08]`}
              >
                Essential only
              </button>

              {hasOptional && (
                <button
                  type="button"
                  onClick={() => setMode("manage")}
                  className={`${btnBase} border border-transparent bg-transparent font-semibold text-white/70 hover:bg-white/[0.04] hover:text-white`}
                >
                  Customize
                </button>
              )}
            </div>
          </div>
        )}

        {mode === "manage" && (
          <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
            <div className="mb-1 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#00E575]">
                  Preferences
                </p>
                <h2
                  id={titleId}
                  className="mt-1 text-[19px] font-extrabold tracking-tight text-[#F5F7FA]"
                >
                  Manage privacy
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  const c = readConsent();
                  if (c) {
                    setOpen(false);
                    window.setTimeout(
                      () => setMode("hidden"),
                      reduceMotion ? 0 : 280
                    );
                  } else {
                    setMode("banner");
                  }
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.04] text-white/55 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Close"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-[14px] leading-[1.6] text-[#A7ADB8]">
              Essential is always on. Turn optional categories on or off to match
              how you want Plazore to work for you.
            </p>

            <div className="mt-4 space-y-3">
              <PreferenceToggle
                title="Essential"
                description="Sign-in, security, cart, and core marketplace functions. Always required."
                checked
                locked
                onChange={() => {}}
              />
              {HAS_OPTIONAL_ANALYTICS && (
                <PreferenceToggle
                  title="Analytics"
                  description="Anonymous usage signals so we can improve performance and product flow."
                  checked={analyticsOn}
                  onChange={setAnalyticsOn}
                />
              )}
              {HAS_OPTIONAL_MARKETING && (
                <PreferenceToggle
                  title="Marketing"
                  description="Helps us show relevant offers and measure campaigns. Off by default until you allow it."
                  checked={marketingOn}
                  onChange={setMarketingOn}
                />
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={onSaveCustom}
                className={`${btnBase} text-[#041412] shadow-[0_10px_28px_rgba(0,229,117,0.22)] hover:brightness-105`}
                style={{ backgroundImage: GRAD }}
              >
                Save preferences
              </button>
              <button
                type="button"
                onClick={onAcceptAll}
                className={`${btnBase} border border-white/[0.12] bg-white/[0.05] text-[#F5F7FA] hover:bg-white/[0.08]`}
              >
                Accept all
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
  locked,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  locked?: boolean;
}) {
  const id = useId();
  return (
    <div
      className={`rounded-2xl border px-4 py-4 transition ${
        checked
          ? "border-[#00E575]/20 bg-[#00E575]/[0.06]"
          : "border-white/[0.07] bg-[#12161C]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={id} className="text-[14px] font-bold text-[#F5F7FA]">
              {title}
            </label>
            {locked && (
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/45">
                Required
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#8B929E]">
            {description}
          </p>
        </div>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={locked}
          onClick={() => !locked && onChange(!checked)}
          className={`relative mt-0.5 h-8 w-14 shrink-0 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E575] disabled:cursor-default ${
            checked
              ? "border-[#00E575]/45 bg-[#00E575]/30"
              : "border-white/15 bg-[#0A0D12]"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full shadow-sm transition-all duration-200 ${
              checked ? "left-7 bg-[#00E575]" : "left-1 bg-white/40"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3z" />
      <path d="M9.5 12l1.8 1.8 3.7-3.8" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Open manage UI from Settings */
export function openPrivacyPreferences() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("plazore:open-privacy-prefs"));
}