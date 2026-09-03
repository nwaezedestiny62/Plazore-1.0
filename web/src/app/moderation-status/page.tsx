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
        title: seller ? "Seller World under review" : "Account under review",
        body: "We're reviewing activity on this side of Plazore. Access is paused until the check is complete.",
        cta: "Understood",
      };
    case "suspended":
      return {
        title: seller
          ? "Seller World is suspended"
          : "Plazore access is suspended",
        body: seller
          ? "You can't manage products, orders, or store settings right now. Shopping as a buyer may still work."
          : "Marketplace access is temporarily limited.",
        cta: "Got it",
      };
    case "blocked":
      return {
        title: seller
          ? "Seller World is blocked"
          : "Plazore account is blocked",
        body: seller
          ? "Seller tools are locked. This does not automatically block you as a buyer."
          : "Access to this side of Plazore is blocked until further notice.",
        cta: "Close",
      };
    case "pardoned":
      return {
        title: "You're clear",
        body: "Review is complete. No further action is required on your account.",
        cta: "Proceed",
      };
    case "restored":
      return {
        title: "Access restored",
        body: seller
          ? "Seller World is available again."
          : "Your Plazore access is available again.",
        cta: "Proceed",
      };
    default:
      return {
        title: "All clear",
        body: "No moderation restriction on this side.",
        cta: "Continue",
      };
  }
}

function formatEnds(endsAt?: string | null) {
  if (!endsAt) return null;
  try {
    const d = new Date(endsAt);
    if (Number.isNaN(d.getTime())) return null;
    if (d.getTime() <= Date.now()) return "Ending soon / expired";
    return `Until ${d.toLocaleString()}`;
  } catch {
    return null;
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
  const paramEnds = search.get("endsAt");

  // Seed from URL so first paint is final content — no spinner flash
  const seed: ModSide | null = paramStatus
    ? {
        status: paramStatus,
        publicReason: paramReason || undefined,
        endsAt: paramEnds,
      }
    : null;

  const [side, setSide] = useState<ModSide | null>(seed);
  const [booting, setBooting] = useState(!seed);
  const [busy, setBusy] = useState(false);

  const fetchedOnce = useRef(false);
  const navigating = useRef(false);

  // Fetch once. Never re-run when getToken / isSignedIn identity changes.
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
        // keep seed
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
  const endsLabel = formatEnds(side?.endsAt || paramEnds);
  const artSrc = MOD_ART[kind as keyof typeof MOD_ART] || MOD_ART.pardoned;

  const goHome = () => {
    if (navigating.current) return;
    navigating.current = true;
    router.replace("/");
  };

  const onProceed = async () => {
    if (busy || navigating.current) return;
    setBusy(true);
    try {
      const token = await getToken();

      // Clear outcome BEFORE navigating into seller — stops redirect loop
      if (token && (kind === "pardoned" || kind === "restored")) {
        await clearLastOutcome(token, context);
      }

      navigating.current = true;

      if (kind === "review" || kind === "suspended" || kind === "blocked") {
        router.replace("/");
        return;
      }

      router.replace(context === "seller" ? "/seller" : "/");
    } catch {
      navigating.current = false;
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
            <img
              src={artSrc}
              alt=""
              className="h-full w-full object-contain"
            />
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

          {endsLabel && (kind === "suspended" || kind === "blocked") ? (
            <p className="mt-4 text-sm text-[#737A86]">{endsLabel}</p>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={onProceed}
            className="mt-8 flex h-12 w-full items-center justify-center bg-[#00E575] text-base font-extrabold text-[#041412] transition hover:brightness-105 disabled:opacity-60"
          >
            {busy ? "…" : copy.cta}
          </button>

          {(kind === "review" ||
            kind === "suspended" ||
            kind === "blocked") &&
            context === "seller" && (
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