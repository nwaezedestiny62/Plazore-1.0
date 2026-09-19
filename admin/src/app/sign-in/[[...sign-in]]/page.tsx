"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  markAdminAuthPending,
  markAdminSessionLive,
} from "@/components/auth/AdminSessionGate";

const VIDEO_SRC = "/signup.mp4";

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
    <div className="relative min-h-dvh bg-[#090B0F] text-[#F5F7FA]">
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        {/* Form column */}
        <section className="relative z-10 flex min-h-dvh flex-col border-white/[0.06] bg-[#090B0F] lg:border-r">
          <div className="flex flex-1 flex-col px-7 py-8 sm:px-10 lg:px-12 lg:py-10">
            <header className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/plazore-logo.png"
                alt="Plazore"
                className="h-8 w-8 object-contain"
              />
              <div>
                <p className="text-[14px] font-semibold tracking-tight">Plazore</p>
                <p className="text-[10px] tracking-[0.2em] text-[#737A86]">ADMIN</p>
              </div>
            </header>

            <div className="flex flex-1 flex-col justify-center py-12">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-[#00E575]">
                CONTROL CENTER
              </p>
              <h1 className="mt-3 text-[32px] font-semibold leading-none tracking-tight">
                Sign in
              </h1>
              <p className="mt-3 max-w-[34ch] text-[13.5px] leading-relaxed text-[#A7ADB8]">
                Operator access only. After verification you enter Overview.
              </p>

              <div className="mt-8 w-full max-w-[360px]">
                <SignIn
                  path="/sign-in"
                  routing="path"
                  forceRedirectUrl="/overview"
                  fallbackRedirectUrl="/overview"
                  signUpUrl="/sign-in"
                  appearance={
  {
    variables: {
      colorPrimary: "#00E575",
      colorBackground: "transparent",
      colorInputBackground: "#14181F",
      colorInputText: "#F5F7FA",
      borderRadius: "0px",
    },
    layout: {
      socialButtonsPlacement: "top",
      socialButtonsVariant: "blockButton",
    },
    elements: {
      rootBox: "w-full",
      card: "w-full bg-transparent p-0 shadow-none",
      header: "hidden",
      footer: "hidden",
    },
  } as Record<string, unknown>
}
                />
              </div>
            </div>

            <p className="text-[10px] tracking-[0.18em] text-[#737A86]/70">
              PLAZORE · Digital Mall
            </p>
          </div>
        </section>

        {/* Media column — desktop only */}
        <section className="relative hidden overflow-hidden lg:block">
          {videoOk ? (
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
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
                  "radial-gradient(800px 500px at 70% 30%, rgba(0,229,117,0.14), transparent 55%), radial-gradient(700px 400px at 20% 80%, rgba(59,130,246,0.12), transparent 50%), #11141A",
              }}
              aria-hidden
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, #090B0F 0%, rgba(9,11,15,0.35) 28%, transparent 55%)",
            }}
            aria-hidden
          />
        </section>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#090B0F] text-[#737A86]">
          Loading
        </div>
      }
    >
      <SignInScreen />
    </Suspense>
  );
}