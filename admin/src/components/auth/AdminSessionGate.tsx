"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const LIVE_KEY = "plazore_admin_live_session";

export function markAdminSessionLive() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(LIVE_KEY, "1");
  }
}

export function AdminSessionGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const onSignInRoute =
    pathname === "/sign-in" || (pathname?.startsWith("/sign-in/") ?? false);

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;

    const run = async () => {
      const live =
        typeof window !== "undefined" &&
        sessionStorage.getItem(LIVE_KEY) === "1";

      // 1) On sign-in page after successful auth → mark live, go to Overview
      //    NEVER sign out here (that caused the loop)
      if (isSignedIn && onSignInRoute) {
        markAdminSessionLive();
        if (!cancelled) {
          router.replace("/overview");
          setReady(true);
        }
        return;
      }

      // 2) Protected route + signed in + this browser tab session is live → OK
      if (isSignedIn && live) {
        if (!cancelled) setReady(true);
        return;
      }

      // 3) Protected route + signed in from old cookie, but tab is NEW → force sign-in
      if (isSignedIn && !live && !onSignInRoute) {
        await signOut({ redirectUrl: "/sign-in" });
        if (!cancelled) setReady(true);
        return;
      }

      // 4) Not signed in on a protected route → sign-in
      if (!isSignedIn && !onSignInRoute) {
        if (!cancelled) {
          router.replace("/sign-in");
          setReady(true);
        }
        return;
      }

      // 5) Not signed in, already on sign-in → show the form
      if (!cancelled) setReady(true);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, onSignInRoute, router, signOut]);

  if (!isLoaded || !ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#090B0F] text-[#A7ADB8]">
        <div className="text-center">
          <div
            className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#00E575]"
            aria-hidden
          />
          <p className="mt-4 text-[12px] font-semibold tracking-wide">
            Verifying access…
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}