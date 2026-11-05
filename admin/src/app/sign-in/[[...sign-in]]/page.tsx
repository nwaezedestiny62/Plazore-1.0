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

/* Clerk — sharp corners, dark, green accent, no radius */
const clerkAppearance = {
  variables: {
    colorPrimary: "#00E575",
    colorBackground: "transparent",
    colorInputBackground: "#14181F",
    colorInputText: "#F5F7FA",
    colorText: "#F5F7FA",
    colorTextSecondary: "#A7ADB8",
    colorNeutral: "#FFFFFF",
    colorDanger: "#F87171",
    borderRadius: "0px",
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
    card: "w-full gap-5 bg-transparent p-0 shadow-none border-0",
    header: "hidden",
    footer: "hidden",
    main: "gap-5",

    socialButtons: "gap-2.5",
    socialButtonsBlockButton:
      "h-11 rounded-none border border-[#252A33] bg-[#14181F] text-[#F5F7FA] shadow-none transition-colors duration-200 hover:border-[#3A4150] hover:bg-[#1A1F28]",
    socialButtonsBlockButtonText: "text-[13px] font-medium tracking-wide",
    socialButtonsProviderIcon: "h-[17px] w-[17px]",

    dividerLine: "bg-[#252A33]",
    dividerText:
      "text-[10px] font-semibold uppercase tracking-[0.2em] text-[#737A86]",

    form: "gap-4",
    formFieldLabel:
      "mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737A86]",
    formFieldInput:
      "h-11 rounded-none border border-[#252A33] bg-[#14181F] px-3.5 text-[14px] text-[#F5F7FA] shadow-none transition-colors duration-200 placeholder:text-[#737A86] focus:border-[#00E575]/55 focus:bg-[#171B22] focus:ring-0",
    formFieldInputShowPasswordButton: "text-[#737A86] hover:text-[#F5F7FA]",
    formFieldAction: "text-[12px] text-[#00E575] hover:text-[#34F09A]",
    formFieldErrorText: "text-[12px] text-red-300",

    formButtonPrimary:
      "h-11 rounded-none border-0 bg-[#00E575] text-[13px] font-semibold normal-case tracking-[0.04em] text-[#041412] shadow-none transition-all duration-200 hover:brightness-110 active:brightness-95",

    identityPreview:
      "rounded-none border border-[#252A33] bg-[#14181F]",
    identityPreviewText: "text-[#F5F7FA]",
    identityPreviewEditButton: "text-[#00E575] hover:text-[#34F09A]",

    alternativeMethodsBlockButton:
      "h-11 rounded-none border border-[#252A33] bg-[#14181F] text-[#F5F7FA] shadow-none hover:bg-[#1A1F28]",
    backLink: "text-[#00E575] hover:text-[#34F09A]",
    otpCodeFieldInput:
      "rounded-none border border-[#252A33] bg-[#14181F] text-[#F5F7FA]",
    footerActionLink: "text-[#00E575] hover:text-[#34F09A]",
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
      className={`${poppins.className} relative isolate min-h-dvh overflow-hidden bg-[#090B0F] text-[#F5F7FA] antialiased`}
    >
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        {videoOk ? (
          <video
            ref={videoRef}
            className="h-full w-full scale-[1.02] object-cover"
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
                "radial-gradient(1000px 700px at 75% 15%, rgba(0,229,117,0.14), transparent 55%), radial-gradient(800px 600px at 15% 90%, rgba(37,99,235,0.12), transparent 55%), #090B0F",
            }}
            aria-hidden
          />
        )}

        {/* Mobile full dim */}
        <div
          className="absolute inset-0 bg-[#090B0F]/80 lg:bg-transparent"
          aria-hidden
        />

        {/* Desktop left veil for form readability */}
        <div
          className="absolute inset-0 hidden lg:block"
          style={{
            background:
              "linear-gradient(100deg, rgba(9,11,15,0.96) 0%, rgba(9,11,15,0.88) 28%, rgba(9,11,15,0.45) 52%, rgba(9,11,15,0.08) 72%, transparent 100%)",
          }}
          aria-hidden
        />

        {/* Subtle accent wash */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 110%, rgba(0,229,117,0.08), transparent 50%)",
          }}
          aria-hidden
        />
      </div>

      {/* Shell */}
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[1440px]">
        {/* Form column */}
        <main className="flex w-full flex-col justify-center px-5 py-8 sm:px-8 sm:py-10 lg:w-[480px] lg:shrink-0 lg:px-10 xl:w-[520px] xl:px-12">
          <div className="mx-auto w-full max-w-[400px] lg:mx-0 lg:max-w-none">
            {/* Brand row */}
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center border border-[#252A33] bg-[#11141A]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/plazore-logo.png"
                    alt="Plazore"
                    className="h-5 w-5 object-contain"
                  />
                </div>
                <div className="leading-none">
                  <p className="text-[14px] font-semibold tracking-tight text-[#F5F7FA]">
                    Plazore
                  </p>
                  <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#737A86]">
                    Admin
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 border border-[#252A33] bg-[#11141A] px-2.5 py-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping bg-[#00E575]/50" />
                  <span className="relative inline-flex h-1.5 w-1.5 bg-[#00E575]" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#A7ADB8]">
                  Secure
                </span>
              </div>
            </header>

            {/* Accent rule */}
            <div
              className="mt-8 h-px w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(0,229,117,0.45), rgba(37,99,235,0.3), transparent)",
              }}
              aria-hidden
            />

            {/* Copy */}
            <div className="mt-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#00E575]">
                Control Center
              </p>
              <h1 className="mt-3 text-[28px] font-semibold leading-[1.15] tracking-tight text-[#F5F7FA] sm:text-[32px]">
                Welcome back
              </h1>
              <p className="mt-2.5 max-w-[36ch] text-[13.5px] font-light leading-relaxed text-[#A7ADB8]">
                Operator access only. Authenticate to continue to the overview
                dashboard.
              </p>
            </div>

            {/* Clerk form */}
            <div className="mt-8 w-full">
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
            <footer className="mt-10 border-t border-[#252A33] pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#737A86]">
                  Plazore | Digital Mall
                </p>
                <p className="text-[10px] font-medium text-[#525860]">
                  Authorized personnel only
                </p>
              </div>
            </footer>
          </div>
        </main>

        {/* Desktop right panel — glass status card over video */}
        <aside className="relative hidden flex-1 lg:block">
          <div className="absolute bottom-8 right-8 xl:bottom-10 xl:right-10">
            <div className="flex items-center gap-3 border border-[#252A33] bg-[#0E1116]/80 py-3 pl-3 pr-5 backdrop-blur-md">
              <span
                className="grid h-9 w-9 place-items-center"
                style={{
                  background:
                    "linear-gradient(135deg, #00E575 0%, #14B8A6 50%, #2563EB 100%)",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-[#041412]"
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
                <p className="text-[12px] font-semibold tracking-wide text-[#F5F7FA]">
                  Operations desk
                </p>
                <p className="mt-0.5 text-[11px] font-light text-[#A7ADB8]">
                  Verified sessions only
                </p>
              </div>
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
          className={`${poppins.className} flex min-h-dvh items-center justify-center bg-[#090B0F]`}
        >
          <div className="flex items-center gap-3 border border-[#252A33] bg-[#11141A] px-5 py-3">
            <span className="h-1.5 w-1.5 animate-pulse bg-[#00E575]" />
            <span className="text-[12px] font-medium tracking-[0.12em] text-[#A7ADB8]">
              Loading
            </span>
          </div>
        </div>
      }
    >
      <SignInScreen />
    </Suspense>
  );
}