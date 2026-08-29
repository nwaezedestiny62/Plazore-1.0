"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallback() {
  let after = "/auth/continue";
  if (typeof window !== "undefined") {
    try {
      const saved = sessionStorage.getItem("plazore_return_to");
      if (saved && saved.startsWith("/") && !saved.startsWith("//")) {
        after = saved;
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl={after}
      signUpFallbackRedirectUrl={after}
    />
  );
}