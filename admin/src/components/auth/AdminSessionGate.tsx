"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const LIVE_KEY = "plazore_admin_live_session";
const PENDING_KEY = "plazore_admin_auth_pending";

export function markAdminSessionLive() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LIVE_KEY, "1");
  sessionStorage.removeItem(PENDING_KEY);
}

/** Call on the sign-in screen so Google OAuth can return without a loop */
export function markAdminAuthPending() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_KEY, "1");
}

function isSignInPath(pathname: string | null) {
  if (!pathname) return false;
  return pathname === "/sign-in" || pathname.startsWith("/sign-in/");
}

/** Invite accept must work for invitees who are not admins yet */
function isInvitePath(pathname: string | null) {
  if (!pathname) return false;
  return pathname === "/invite/accept" || pathname.startsWith("/invite/");
}

export function AdminSessionGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const onSignIn = isSignInPath(pathname);
  const onInvite = isInvitePath(pathname);

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;

    const run = async () => {
      // Invite accept: allow signed-in or signed-out without admin live session
      if (onInvite) {
        if (!cancelled) setReady(true);
        return;
      }

      const live = sessionStorage.getItem(LIVE_KEY) === "1";
      const pending = sessionStorage.getItem(PENDING_KEY) === "1";

      if (isSignedIn && (onSignIn || pending || live)) {
        markAdminSessionLive();
        if (onSignIn) router.replace("/overview");
        if (!cancelled) setReady(true);
        return;
      }

      if (isSignedIn && !live && !pending && !onSignIn) {
        await signOut({ redirectUrl: "/sign-in" });
        if (!cancelled) setReady(true);
        return;
      }

      if (!isSignedIn && !onSignIn) {
        if (!cancelled) {
          router.replace("/sign-in");
          setReady(true);
        }
        return;
      }

      if (!cancelled) setReady(true);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, onSignIn, onInvite, router, signOut]);

  if (!isLoaded || !ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#090B0F] text-[#A7ADB8]">
        <div className="text-center">
          <div
            className="mx-auto h-7 w-7 animate-spin rounded-full border border-white/15 border-t-[#00E575]"
            aria-hidden
          />
          <p className="mt-4 text-[11px] font-medium tracking-[0.16em] uppercase text-white/40">
            Verifying
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}