"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

function safeReturnTo() {
  try {
    const v = sessionStorage.getItem("plazore_return_to");
    if (v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/sign-in") && !v.startsWith("/sso-callback")) {
      return v;
    }
  } catch {
    /* ignore */
  }
  return "/";
}

export default function AuthContinue() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    (async () => {
      const next = safeReturnTo();
      try {
        const token = await getToken();
        if (!token) {
          router.replace(`/complete-profile?redirect_url=${encodeURIComponent(next)}`);
          return;
        }
        const res = await fetch(`${BASE}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const u = json?.data;
        const needs = !u?.name?.trim() || !u?.phone?.trim();
        if (needs) {
          router.replace(`/complete-profile?redirect_url=${encodeURIComponent(next)}`);
          return;
        }
        router.replace(next);
      } catch {
        router.replace(next);
      }
    })();
  }, [isLoaded, isSignedIn, getToken, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="mb-5 h-24 w-24 animate-pulse object-contain" />
      <p className="text-[15px] tracking-wide text-white/72">Taking you in…</p>
    </div>
  );
}