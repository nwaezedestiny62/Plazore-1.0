"use client";

/**
 * Plazore privacy consent — sharp editorial bottom sheet
 * Essential always on · optional analytics / marketing when enabled in config
 * Geometry: zero radius. Motion: clip-path + staggered reveal (not generic scale).
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

type Mode = "banner" | "manage" | "hidden";

const ACCENT = "#00E575";
const GRAD = "linear-gradient(95deg,#00E575 0%,#12C98A 50%,#3B82F6 120%)";

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
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpen(true));
      });
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
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpen(true));
      });
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
      const ms = reduceMotion ? 0 : 340;
      window.setTimeout(() => setMode("hidden"), ms);
    },
    [reduceMotion]
  );

  const onAcceptAll = () => dismiss(acceptAll());
  const onEssential = () => dismiss(essentialOnly());
  const onSaveCustom = () =>
    dismiss(saveCustom({ analytics: analyticsOn, marketing: marketingOn }));

  if (!mounted || mode === "hidden") return null;

  const hasOptional = HAS_OPTIONAL_ANALYTICS || HAS_OPTIONAL_MARKETING;

  /* Entrance: clip from bottom + slight lift — not scale/fade cookie-banner */
  const sheetStyle: React.CSSProperties = reduceMotion
    ? { opacity: open ? 1 : 0 }
    : {
        opacity: open ? 1 : 0,
        clipPath: open
          ? "inset(0 0 0 0)"
          : "inset(100% 0 0 0)",
        transform: open ? "translateY(0)" : "translateY(12px)",
        transition:
          "opacity 280ms cubic-bezier(0.16,1,0.3,1), clip-path 380ms cubic-bezier(0.16,1,0.3,1), transform 380ms cubic-bezier(0.16,1,0.3,1)",
      };

  const stagger = (i: number): React.CSSProperties =>
    reduceMotion
      ? {}
      : {
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(10px)",
          transition: `opacity 320ms cubic-bezier(0.16,1,0.3,1) ${80 + i * 55}ms, transform 320ms cubic-bezier(0.16,1,0.3,1) ${80 + i * 55}ms`,
        };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-5"
      role="region"
      aria-label="Privacy preferences"
    >
      {/* Hard edge glow — no soft blob */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{
          background:
            "linear-gradient(to top, rgba(0,229,117,0.09) 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <div
        className="pointer-events-auto relative w-full max-w-[26.5rem] overflow-hidden border border-white/[0.1] bg-[#0A0C10]/96 shadow-[0_24px_64px_rgba(0,0,0,0.72)] backdrop-blur-xl"
        style={sheetStyle}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
      >
        {/* Sharp accent bar */}
        <div className="h-[2px] w-full" style={{ backgroundImage: GRAD }} aria-hidden />

        {mode === "banner" && (
          <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
            <div className="mb-5 flex items-start gap-3.5" style={stagger(0)}>
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#00E575]/30 bg-[#00E575]/[0.08]"
                aria-hidden
              >
                <ShieldIcon className="h-[18px] w-[18px] text-[#00E575]" />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00E575]">
                  Privacy
                </p>
                <h2
                  id={titleId}
                  className="mt-1 text-[18px] font-extrabold tracking-tight text-[#F2F4F7]"
                >
                  Your data, your choice
                </h2>
              </div>
            </div>

            <p
              className="text-[13.5px] leading-[1.7] text-[#9AA1AD]"
              style={stagger(1)}
            >
              Plazore uses essential tools so account, checkout, and security
              stay reliable. Optional tools — only if you allow them — help us
              understand usage and refine the experience.
            </p>

            {!hasOptional && (
              <p
                className="mt-4 border border-white/[0.06] bg-white/[0.025] px-3.5 py-3 text-[12.5px] leading-relaxed text-white/45"
                style={stagger(2)}
              >
                Only essential technologies are active. Optional analytics or
                marketing will appear here if we enable them later.
              </p>
            )}

            <p
              className="mt-3.5 text-[12.5px] leading-relaxed text-white/38"
              style={stagger(2)}
            >
              Details in{" "}
              <Link
                href="/help"
                className="font-semibold text-[#00E575] underline-offset-2 transition hover:underline"
              >
                Help & Support
              </Link>
              .
            </p>

            <div className="mt-6 flex flex-col gap-2.5" style={stagger(3)}>
              <button
                type="button"
                onClick={onAcceptAll}
                className="flex w-full min-h-[52px] items-center justify-center px-5 py-3.5 text-[14.5px] font-extrabold tracking-[0.02em] text-[#041412] transition active:brightness-95 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E575]"
                style={{ backgroundImage: GRAD }}
              >
                Accept all
              </button>

              <button
                type="button"
                onClick={onEssential}
                className="flex w-full min-h-[52px] items-center justify-center border border-white/[0.12] bg-white/[0.04] px-5 py-3.5 text-[14.5px] font-extrabold tracking-[0.02em] text-[#F2F4F7] transition hover:bg-white/[0.07] active:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E575]"
              >
                Essential only
              </button>

              {hasOptional && (
                <button
                  type="button"
                  onClick={() => setMode("manage")}
                  className="flex w-full min-h-[48px] items-center justify-center px-5 py-3 text-[13.5px] font-semibold tracking-[0.01em] text-white/60 transition hover:bg-white/[0.035] hover:text-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E575]"
                >
                  Customize
                </button>
              )}
            </div>
          </div>
        )}

        {mode === "manage" && (
          <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
            <div
              className="mb-1 flex items-start justify-between gap-3"
              style={stagger(0)}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00E575]">
                  Preferences
                </p>
                <h2
                  id={titleId}
                  className="mt-1 text-[18px] font-extrabold tracking-tight text-[#F2F4F7]"
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
                      reduceMotion ? 0 : 340
                    );
                  } else {
                    setMode("banner");
                  }
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/[0.1] bg-white/[0.035] text-white/50 transition hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E575]"
                aria-label="Close"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            <p
              className="mt-2 text-[13.5px] leading-[1.65] text-[#9AA1AD]"
              style={stagger(1)}
            >
              Essential stays on. Toggle optional categories to match how you
              want Plazore to work for you.
            </p>

            <div className="mt-4 space-y-2.5" style={stagger(2)}>
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
                  description="Helps show relevant offers and measure campaigns. Off until you allow it."
                  checked={marketingOn}
                  onChange={setMarketingOn}
                />
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2.5" style={stagger(3)}>
              <button
                type="button"
                onClick={onSaveCustom}
                className="flex w-full min-h-[52px] items-center justify-center px-5 py-3.5 text-[14.5px] font-extrabold tracking-[0.02em] text-[#041412] transition active:brightness-95 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E575]"
                style={{ backgroundImage: GRAD }}
              >
                Save preferences
              </button>
              <button
                type="button"
                onClick={onAcceptAll}
                className="flex w-full min-h-[52px] items-center justify-center border border-white/[0.12] bg-white/[0.04] px-5 py-3.5 text-[14.5px] font-extrabold tracking-[0.02em] text-[#F2F4F7] transition hover:bg-white/[0.07] active:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E575]"
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
      className={`border px-3.5 py-3.5 transition ${
        checked
          ? "border-[#00E575]/25 bg-[#00E575]/[0.05]"
          : "border-white/[0.07] bg-[#0E1218]"
      }`}
    >
      <div className="flex items-start justify-between gap-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={id}
              className="text-[13.5px] font-bold text-[#F2F4F7]"
            >
              {title}
            </label>
            {locked && (
              <span className="border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/40">
                Required
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#7E8694]">
            {description}
          </p>
        </div>

        {/* Sharp switch — no pill radius */}
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={locked}
          onClick={() => !locked && onChange(!checked)}
          className={`relative mt-0.5 h-7 w-12 shrink-0 border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E575] disabled:cursor-default ${
            checked
              ? "border-[#00E575]/40 bg-[#00E575]/25"
              : "border-white/14 bg-[#080A0E]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 border border-white/10 transition-all duration-200 ${
              checked
                ? "left-[1.35rem] bg-[#00E575]"
                : "left-0.5 bg-white/35"
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
      strokeWidth="1.7"
      strokeLinecap="square"
      strokeLinejoin="miter"
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
      strokeLinecap="square"
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