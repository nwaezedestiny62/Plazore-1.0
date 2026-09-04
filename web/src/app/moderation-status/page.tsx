"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  clearLastOutcome,
  fetchMyModeration,
  MOD_ART,
  ModContext,
  ModSide,
  resolveScreenKind,
} from "@/lib/moderation";

function copyFor(kind: string, context: ModContext) {
  const seller = context === "seller";
  switch (kind) {
    case "review":
      return {
        title: seller ? "Seller World is under review" : "Your account is under review",
        body: seller
          ? "We're checking activity on Seller World. Store tools stay paused until that review is finished."
          : "We're checking activity on this account. Marketplace access stays paused until the review is finished.",
        cta: "Understood",
      };
    case "suspended":
      return {
        title: seller ? "Seller World is paused" : "Plazore access is paused",
        body: seller
          ? "You can't manage products, orders, or store settings right now. This lasts until the pause period ends. Shopping as a buyer may still work."
          : "Marketplace access is limited until this pause period ends. You don't need to do anything on your side.",
        cta: "Got it",
      };
    case "blocked":
      return {
        title: seller ? "Seller World is blocked" : "This account is blocked",
        body: seller
          ? "Seller tools stay locked until Plazore lifts the block. This does not automatically block you as a buyer."
          : "Access to this side of Plazore stays blocked until it is lifted.",
        cta: "Close",
      };
    case "pardoned":
      return {
        title: "You're clear",
        body: "The review is complete. No further action is required on your account.",
        cta: "Continue",
      };
    case "restored":
      return {
        title: "Access restored",
        body: seller
          ? "Seller World is available again. You can continue managing your store."
          : "Your Plazore access is available again.",
        cta: "Continue",
      };
    default:
      return {
        title: "All clear",
        body: "There's no restriction on this side of your account.",
        cta: "Continue",
      };
  }
}

function ModerationStatusInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { getToken, isSignedIn } = useAuth();

  const context: ModContext =
    search.get("context") === "seller" ? "seller" : "buyer";

  const paramStatus = search.get("status");
  const paramReason = search.get("publicReason") || "";

  const seed: ModSide | null = paramStatus
    ? {
        status: paramStatus,
        publicReason: paramReason || undefined,
      }
    : null;

  const [side, setSide] = useState<ModSide | null>(seed);
  const [booting, setBooting] = useState(!seed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchedOnce = useRef(false);
  const navigating = useRef(false);

  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;

    let cancelled = false;

    (async () => {
      try {
        if (!isSignedIn) {
          if (!cancelled) setBooting(false);
          return;
        }
        const token = await getToken();
        if (!token || cancelled) {
          if (!cancelled) setBooting(false);
          return;
        }
        const m = await fetchMyModeration(token);
        if (cancelled) return;
        if (m?.[context]) setSide(m[context]);
      } catch {
        /* keep seed */
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kind = useMemo(() => {
    if (side) return resolveScreenKind(side);
    return "clear";
  }, [side]);

  const copy = copyFor(kind, context);
  const publicReason = side?.publicReason || paramReason || "";
  const artSrc = MOD_ART[kind as keyof typeof MOD_ART] || MOD_ART.pardoned;
  const locked = kind === "review" || kind === "suspended" || kind === "blocked";

  const goHome = () => {
    if (navigating.current) return;
    navigating.current = true;
    router.replace("/");
  };

  const onProceed = async () => {
    if (busy || navigating.current) return;
    setBusy(true);
    setError("");

    try {
      if (!locked) {
        const token = await getToken();
        if (!token) {
          setError("Couldn't confirm your session. Please try again.");
          navigating.current = false;
          setBusy(false);
          return;
        }
        await clearLastOutcome(token, context);
        setSide((prev) =>
          prev ? { ...prev, lastOutcome: null, publicReason: "" } : prev
        );
      }

      navigating.current = true;

      if (locked) {
        router.replace("/");
        return;
      }

      router.replace(context === "seller" ? "/seller" : "/");
    } catch {
      navigating.current = false;
      setError("Couldn't finish this step. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#090B0F] px-6 py-10 text-[#F5F7FA]">
      <div className="mx-auto w-full max-w-md">
        <p className="text-[11px] font-extrabold tracking-[0.18em] text-[#00E575]">
          {context === "seller" ? "SELLER WORLD" : "PLAZORE"}
        </p>
        <p className="mt-1 text-sm font-semibold text-[#737A86]">Moderation</p>
      </div>

      {booting ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#00E575] border-t-transparent" />
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center pb-16 text-center">
          <div className="relative mb-8 h-52 w-52">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={artSrc} alt="" className="h-full w-full object-contain" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#A7ADB8]">
            {copy.body}
          </p>

          {publicReason ? (
            <div className="mt-6 w-full border border-white/[0.08] bg-[#11141A] p-4 text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#737A86]">
                Message
              </p>
              <p className="mt-2 text-sm text-[#F5F7FA]">{publicReason}</p>
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 text-sm text-red-300">{error}</p>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={onProceed}
            className="mt-8 flex h-12 w-full items-center justify-center bg-[#00E575] text-base font-extrabold text-[#041412] transition hover:brightness-105 disabled:opacity-60"
          >
            {busy ? "…" : copy.cta}
          </button>

          {locked && context === "seller" && (
            <button
              type="button"
              onClick={goHome}
              className="mt-4 text-sm font-semibold text-[#737A86] hover:text-[#F5F7FA]"
            >
              Continue as buyer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ModerationStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#090B0F]">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#00E575] border-t-transparent" />
        </div>
      }
    >
      <ModerationStatusInner />
    </Suspense>
  );
}