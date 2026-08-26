"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

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
      try {
        const token = await getToken();
        if (!token) {
          router.replace("/complete-profile");
          return;
        }
        const res = await fetch(`${BASE}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const u = json?.data;
        const needs = !u?.name?.trim() || !u?.phone?.trim();
        router.replace(needs ? "/complete-profile" : "/");
      } catch {
        router.replace("/complete-profile");
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