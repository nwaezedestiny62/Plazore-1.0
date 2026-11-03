"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Poppins } from "next/font/google";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  markAdminAuthPending,
  markAdminSessionLive,
} from "@/components/auth/AdminSessionGate";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const VIDEO_SRC = "/signup.mp4";

/* Clerk theming: soft, rounded, dark, blue-green accent */
const clerkAppearance = {
  variables: {
    colorPrimary: "#2DD4BF",
    colorBackground: "transparent",
    colorInputBackground: "rgba(255,255,255,0.04)",
    colorInputText: "#F1F5F9",
    colorText: "#F1F5F9",
    colorTextSecondary: "#94A3B8",
    colorNeutral: "#FFFFFF",
    colorDanger: "#F87171",
    borderRadius: "14px",
    fontFamily: "inherit",
    fontSize: "14px",
  },
  layout: {
    socialButtonsPlacement: "top",
    socialButtonsVariant: "blockButton",
    showOptionalFields: false,
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full gap-6 bg-transparent p-0 shadow-none border-0",
    header: "hidden",
    footer: "hidden",
    main: "gap-5",

    socialButtons: "gap-3",
    socialButtonsBlockButton:
      "h-12 rounded-2xl border border-white/10 bg-white/[0.04] text-slate-100 shadow-none transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08]",
    socialButtonsBlockButtonText: "text-[13.5px] font-medium",
    socialButtonsProviderIcon: "h-[18px] w-[18px]",

    dividerLine: "bg-white/10",
    dividerText: "text-[11px] uppercase tracking-[0.18em] text-slate-500",

    form: "gap-5",
    formFieldLabel: "mb-1.5 text-[12.5px] font-medium text-slate-400",
    formFieldInput:
      "h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-slate-100 shadow-none transition-all duration-300 placeholder:text-slate-500 focus:border-teal-300/50 focus:bg-white/[0.06] focus:ring-4 focus:ring-teal-300/10",
    formFieldInputShowPasswordButton: "text-slate-400 hover:text-slate-200",
    formFieldAction: "text-[12.5px] text-teal-300 hover:text-teal-200",
    formFieldErrorText: "text-[12px]",

    formButtonPrimary:
      "h-12 rounded-2xl border-0 bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 text-[14px] font-semibold normal-case tracking-wide text-[#04141A] shadow-[0_10px_30px_-10px_rgba(45,212,191,0.55)] transition-all duration-300 hover:-translate-y-px hover:brightness-110 hover:shadow-[0_14px_36px_-10px_rgba(56,189,248,0.6)] active:translate-y-0",

    identityPreview:
      "rounded-2xl border border-white/10 bg-white/[0.04]",
    identityPreviewText: "text-slate-100",
    identityPreviewEditButton: "text-teal-300 hover:text-teal-200",

    alternativeMethodsBlockButton:
      "h-12 rounded-2xl border border-white/10 bg-white/[0.04] text-slate-100 shadow-none hover:bg-white/[0.08]",
    backLink: "text-teal-300 hover:text-teal-200",
    otpCodeFieldInput:
      "rounded-xl border border-white/10 bg-white/[0.04] text-slate-100",
    footerActionLink: "text-teal-300 hover:text-teal-200",
  },
} as Record<string, unknown>;

function SignInScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOk, setVideoOk] = useState(true);

  useEffect(() => {
    markAdminAuthPending();
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    void el.play().catch(() => setVideoOk(false));
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    markAdminSessionLive();
    router.replace("/overview");
  }, [isLoaded, isSignedIn, router]);

  return (
    <div
      className={`${poppins.className} relative isolate min-h-dvh overflow-hidden bg-[#050A0F] text-slate-100 antialiased`}
    >
      {/* ── Background: video (all devices) with fallback ── */}
      <div className="absolute inset-0 -z-10">
        {videoOk ? (
          <video
            ref={videoRef}
            className="h-full w-full scale-[1.03] object-cover"
            src={VIDEO_SRC}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onError={() => setVideoOk(false)}
            aria-hidden
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(900px 600px at 70% 20%, rgba(45,212,191,0.22), transparent 60%), radial-gradient(800px 600px at 20% 85%, rgba(56,189,248,0.20), transparent 60%), #08111A",
            }}
            aria-hidden
          />
        )}

        {/* Readability + depth overlays */}
        <div
          className="absolute inset-0 bg-[#050A0F]/70 lg:bg-transparent"
          aria-hidden
        />
        <div
          className="absolute inset-0 hidden lg:block"
          style={{
            background:
              "linear-gradient(100deg, rgba(5,10,15,0.92) 0%, rgba(5,10,15,0.6) 38%, rgba(5,10,15,0.1) 70%)",
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 120%, rgba(45,212,191,0.12), transparent 55%), radial-gradient(ellipse at 100% 0%, rgba(56,189,248,0.12), transparent 50%)",
          }}
          aria-hidden
        />
      </div>

      {/* ── Layout ── */}
      <div className="mx-auto flex min-h-dvh w-full max-w-[1600px] items-stretch px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        {/* Form panel */}
        <main className="flex w-full flex-col items-center justify-center lg:w-[520px] lg:shrink-0 lg:items-stretch xl:w-[560px]">
          <div className="relative w-full max-w-[460px] rounded-[28px] border border-white/10 bg-[#0A131B]/70 p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:rounded-[32px] sm:p-9 lg:max-w-none lg:flex-1 lg:p-11 lg:flex lg:flex-col">
            {/* soft top glow */}
            <div
              className="pointer-events-none absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-teal-300/60 to-transparent"
              aria-hidden
            />

            {/* Brand */}
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.05]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/plazore-logo.png"
                    alt="Plazore"
                    className="h-6 w-6 object-contain"
                  />
                </div>
                <div className="leading-none">
                  <p className="text-[15px] font-semibold tracking-tight text-white">
                    Plazore
                  </p>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.24em] text-slate-500">
                    Admin
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-slate-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Secure
              </span>
            </header>

            {/* Heading */}
            <div className="mt-10 sm:mt-12 lg:mt-auto">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-300">
                Control Center
              </p>
              <h1 className="mt-3 bg-gradient-to-br from-white via-white to-slate-400 bg-clip-text text-[32px] font-semibold leading-[1.1] tracking-tight text-transparent sm:text-[36px]">
                Welcome back
              </h1>
              <p className="mt-3 max-w-[34ch] text-[14px] font-light leading-relaxed text-slate-400">
                Operator access only. Sign in to continue to your overview.
              </p>
            </div>

            {/* Clerk */}
            <div className="mt-8 w-full lg:mb-auto">
              <SignIn
                path="/sign-in"
                routing="path"
                forceRedirectUrl="/overview"
                fallbackRedirectUrl="/overview"
                signUpUrl="/sign-in"
                appearance={clerkAppearance}
              />
            </div>

            {/* Footer */}
            <footer className="mt-8 flex items-center justify-between border-t border-white/[0.06] pt-5 lg:mt-10">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                Plazore | Digital Mall
              </p>
            </footer>
          </div>
        </main>

        {/* Video side: floating glass details (desktop only) */}
        <aside className="relative hidden flex-1 lg:block">
          <div className="absolute bottom-2 right-2 flex items-center gap-3 rounded-full border border-white/10 bg-[#0A131B]/50 py-2 pl-2 pr-5 backdrop-blur-xl">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-400">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-[#04141A]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 3l8 4v5c0 4.5-3.2 8.3-8 9-4.8-.7-8-4.5-8-9V7l8-4z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-[12.5px] font-medium text-white">
                Operations
              </p>
              <p className="text-[11px] font-light text-slate-400">
                Verified sessions only
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div
          className={`${poppins.className} flex min-h-dvh items-center justify-center bg-[#050A0F] text-slate-500`}
        >
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-5 py-3">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-300" />
            <span className="text-[13px] tracking-wide">Loading</span>
          </div>
        </div>
      }
    >
      <SignInScreen />
    </Suspense>
  );
}