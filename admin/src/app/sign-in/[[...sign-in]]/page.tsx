"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { markAdminSessionLive } from "@/components/auth/AdminSessionGate";

const VIDEO_SRC = "/signup.mp4";

function resolveRedirect(raw: string | null): string {
  if (!raw) return "/overview";
  try {
    if (raw.startsWith("/")) {
      return raw.startsWith("/sign-in") ? "/overview" : raw;
    }
    const u = new URL(raw);
    if (typeof window !== "undefined" && u.origin === window.location.origin) {
      const path = `${u.pathname}${u.search}` || "/overview";
      return path.startsWith("/sign-in") ? "/overview" : path;
    }
  } catch {
    /* ignore */
  }
  return "/overview";
}

function SignInScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const redirectUrl = resolveRedirect(params.get("redirect_url"));

  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOk, setVideoOk] = useState(true);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.play()?.catch(() => setVideoOk(false));
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    markAdminSessionLive();
    router.replace(redirectUrl || "/overview");
  }, [isLoaded, isSignedIn, redirectUrl, router]);

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-[#07090D] text-[#F5F7FA]">
      {/* Media layer */}
      {videoOk ? (
        <video
          ref={videoRef}
          className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover"
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
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(0,229,117,0.22), transparent 50%), radial-gradient(ellipse 60% 50% at 100% 100%, rgba(59,130,246,0.18), transparent 45%), #07090D",
          }}
          aria-hidden
        />
      )}

      {/* Depth scrims */}
      <div className="absolute inset-0 bg-black/50" aria-hidden />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(7,9,13,0.35) 0%, rgba(7,9,13,0.55) 45%, rgba(7,9,13,0.92) 100%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
        style={{
          background:
            "radial-gradient(ellipse 80% 80% at 50% 100%, rgba(0,229,117,0.08), transparent 60%)",
        }}
        aria-hidden
      />

      {/* Content */}
      <div className="relative z-10 flex min-h-dvh flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-8 overflow-hidden rounded-full ring-1 ring-white/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/plazore-logo.png"
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div>
              <p className="text-[13px] font-extrabold tracking-tight">Plazore</p>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-white/40">
                ADMIN
              </p>
            </div>
          </div>
          <span className="hidden text-[11px] font-medium text-white/35 sm:inline">
            Discovery-Led Commerce
          </span>
        </header>

        {/* Center stage */}
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
          <div className="mb-8 max-w-md text-center sm:mb-10">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#00E575]/90">
              Operational access
            </p>
            <h1 className="mt-3 text-[28px] font-extrabold leading-tight tracking-tight sm:text-[34px]">
              Sign in to the control center
            </h1>
            <p className="mx-auto mt-3 max-w-[34ch] text-[13.5px] leading-relaxed text-white/50">
              Staff only. After verification you continue to Overview.
            </p>
          </div>

          {/* Glass card */}
          <div className="w-full max-w-[380px]">
            <div className="overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0C0F14]/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_32px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              {/* Gradient edge */}
              <div
                className="h-[2px] w-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, #00E575, #14B8A6, #3B82F6, transparent)",
                }}
                aria-hidden
              />

              <div className="px-5 pb-6 pt-6 sm:px-6">
                <SignIn
                  path="/sign-in"
                  routing="path"
                  forceRedirectUrl="/overview"
                  fallbackRedirectUrl="/overview"
                  signUpUrl="/sign-in"
                  appearance={{
                    variables: {
                      colorPrimary: "#00E575",
                      colorBackground: "transparent",
                      colorText: "#F5F7FA",
                      colorTextSecondary: "rgba(255,255,255,0.45)",
                      colorInputBackground: "rgba(255,255,255,0.04)",
                      colorInputText: "#F5F7FA",
                      borderRadius: "12px",
                      fontSize: "14px",
                    },
                    elements: {
                      rootBox: "w-full",
                      card: "bg-transparent shadow-none p-0 w-full gap-0",
                      header: "hidden",
                      headerTitle: "hidden",
                      headerSubtitle: "hidden",
                      main: "gap-4",
                      socialButtonsBlockButton:
                        "h-11 rounded-xl border border-white/10 bg-white/[0.04] text-[#F5F7FA] hover:bg-white/[0.08] transition",
                      socialButtonsBlockButtonText: "font-semibold text-[13px]",
                      dividerRow: "my-1",
                      dividerLine: "bg-white/10",
                      dividerText: "text-white/30 text-[11px]",
                      formFieldLabel:
                        "text-[12px] font-medium text-white/50 mb-1.5",
                      formFieldInput:
                        "h-11 rounded-xl border border-white/10 bg-white/[0.04] text-[#F5F7FA] placeholder:text-white/25 focus:border-[#00E575]/40 focus:ring-1 focus:ring-[#00E575]/25",
                      formButtonPrimary:
                        "h-11 rounded-xl font-extrabold text-[14px] text-[#041412] shadow-none transition hover:opacity-95",
                      formButtonPrimary: undefined,
                      footer: "hidden",
                      footerAction: "hidden",
                      identityPreview: "rounded-xl border border-white/10 bg-white/[0.03]",
                      identityPreviewText: "text-[#F5F7FA] text-[13px]",
                      identityPreviewEditButton: "text-[#00E575]",
                      formFieldAction: "text-[#00E575] text-[12px]",
                      alternativeMethodsBlockButton:
                        "text-[#00E575] text-[12px]",
                    },
                    layout: {
                      socialButtonsPlacement: "top",
                    },
                  }}
                />

                {/* Primary CTA styling via wrapper — Clerk primary uses colorPrimary; reinforce with style tag for gradient */}
                <style jsx global>{`
                  .cl-formButtonPrimary {
                    background: linear-gradient(
                      90deg,
                      #00e575,
                      #14b8a6,
                      #3b82f6
                    ) !important;
                    color: #041412 !important;
                    font-weight: 800 !important;
                    border: none !important;
                    box-shadow: none !important;
                  }
                  .cl-formButtonPrimary:hover {
                    opacity: 0.94;
                  }
                  .cl-footer,
                  .cl-footerAction,
                  .cl-internal-b3fm6y {
                    display: none !important;
                  }
                `}</style>
              </div>
            </div>

            <p className="mt-6 text-center text-[11px] leading-relaxed text-white/30">
              Authorized operators only. Unauthorized access is prohibited.
            </p>
          </div>
        </main>

        <footer className="px-5 pb-6 text-center sm:pb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/20">
            Plazore · Discovery-Led Commerce
          </p>
        </footer>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#07090D] text-white/40">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#00E575]" />
        </div>
      }
    >
      <SignInScreen />
    </Suspense>
  );
}