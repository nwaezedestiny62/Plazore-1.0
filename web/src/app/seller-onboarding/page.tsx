"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Store,
  AlertCircle,
} from "lucide-react";

const API =
  process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com/api";

const GREEN = "#00E575";
const BLUE = "#3B82F6";

type SlideKey =
  | "welcome"
  | "how"
  | "products"
  | "orders"
  | "earn"
  | "presence";

const SLIDES: {
  key: SlideKey;
  kicker: string;
  headline: string;
  /** files in web/public/ — board1.png … board6.png */
  image: string;
}[] = [
  {
    key: "welcome",
    kicker: "Seller Lounge",
    headline: "Welcome to Plazore.",
    image: "/board1.png",
  },
  {
    key: "how",
    kicker: "The journey",
    headline: "Your products. A larger digital marketplace.",
    image: "/board2.png",
  },
  {
    key: "products",
    kicker: "Listings",
    headline: "Presentation matters.",
    image: "/board3.png",
  },
  {
    key: "orders",
    kicker: "Fulfilment",
    headline: "When a buyer orders, Plazore keeps the process structured.",
    image: "/board4.png",
  },
  {
    key: "earn",
    kicker: "Economics",
    headline: "Sell through Plazore. Earn from every completed order.",
    image: "/board5.png",
  },
  {
    key: "presence",
    kicker: "Your store",
    headline: "Your store is part of the Plazore experience.",
    image: "/board6.png",
  },
];

function SlideBody({ kind }: { kind: SlideKey }) {
  if (kind === "welcome") {
    return (
      <div className="space-y-3 text-[15px] leading-relaxed text-white/70">
        <p>
          You are not simply listing products. You are building your presence
          inside a new kind of commerce platform.
        </p>
        <p>
          Plazore connects sellers with buyers through discovery, intelligent
          product presentation, and a structured commerce experience.
        </p>
      </div>
    );
  }
  if (kind === "how") {
    const steps = [
      "Create",
      "Present",
      "Get Discovered",
      "Receive Orders",
      "Fulfil",
      "Earn",
    ];
    return (
      <ul className="space-y-3">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#00E575]/35 bg-[#00E575]/12 text-[12px] font-bold text-[#00E575]">
              {i + 1}
            </span>
            <span className="text-[15px] font-medium text-[#F5F7FA]">{step}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (kind === "products") {
    const bullets = [
      "Clear, high-quality product images of the exact item",
      "Avoid blurry, heavily edited or misleading images",
      "Clear product names and accurate descriptions",
      "Correct pricing, category and shipping details",
    ];
    return (
      <div className="space-y-4">
        <p className="text-[15px] leading-relaxed text-white/70">
          Create listings that are clear, accurate and professionally presented.
        </p>
        <ul className="space-y-2.5">
          {bullets.map((t) => (
            <li key={t} className="flex gap-2.5 text-[14px] leading-snug text-white/70">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B82F6]" />
              {t}
            </li>
          ))}
        </ul>
        <p className="text-[15px] font-medium text-[#00E575]">
          Better information creates better buyer confidence.
        </p>
      </div>
    );
  }
  if (kind === "orders") {
    const flow = [
       'Buyer places order',
      'Seller receives order',
      'Seller updates order status via shipped',
      'Seller prepares order',
      'Seller fulfils via selected delivery method',
      'Seller updates order status via delivered',
      'Buyer confirms delivery/package',
      'Order is completed | Seller payout is released',
    ];
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2">
          {flow.map((step, i) => (
            <div
              key={step}
              className="flex items-center gap-3 border-b border-white/[0.05] py-2.5 last:border-0"
            >
              <span className="w-6 font-mono text-[12px] font-bold text-[#3B82F6]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[14px] font-medium text-[#F5F7FA]">{step}</span>
            </div>
          ))}
        </div>
        <p className="text-[15px] leading-relaxed text-white/70">
          Keep your delivery method and fee accurate. You will receive the
          buyer delivery address and contact details needed to fulfil each
          order.
        </p>
      </div>
    );
  }
  if (kind === "earn") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[#00E575]/20 bg-white/[0.03] px-5 py-4 text-center">
          <p className="text-[15px] font-medium text-white/70">
            Product Price + Delivery Fee
          </p>
          <p className="mt-1 text-[18px] font-bold text-[#00E575]">
            = Order Value
          </p>
        </div>
        <p className="text-[15px] leading-relaxed text-white/70">
          Plazore applies a{" "}
          <span className="font-semibold text-[#00E575]">8% transaction fee</span>{" "}
          to the product price only! Never to the delivery fee, subject to the seller
          applicable subscription plan.
        </p>
        <p className="text-[15px] leading-relaxed text-white/70">
          Paid seller subscriptions can significantly reduce the transaction fee
          and provide additional visibility according to your plan.
        </p>
      </div>
    );
  }
  const presence = [
    "Professional product presentation",
    "Accurate business information",
    "Consistent inventory",
    "Reliable fulfilment",
    "Responsible seller behaviour",
    "Strong customer experience",
  ];
  return (
    <div className="space-y-4">
      <p className="text-[15px] leading-relaxed text-white/70">
        You are not merely uploading products — your listings contribute to your
        storefront and Plazore wider discovery experience.
      </p>
      <ul className="space-y-2.5">
        {presence.map((t) => (
          <li key={t} className="flex gap-2.5 text-[14px] leading-snug text-white/70">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B82F6]" />
            {t}
          </li>
        ))}
      </ul>
      <p className="text-[15px] font-semibold text-[#F5F7FA]">
        Build with consistency. Grow with Plazore.
      </p>
    </div>
  );
}

export default function SellerOnboardingPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace(
        `/sign-in?redirect_url=${encodeURIComponent("/seller-onboarding")}`,
      );
      return;
    }
    const role = user?.publicMetadata?.role as string | undefined;
    if (role !== "seller" && role !== "admin") {
      router.replace("/");
      return;
    }
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${API}/seller/onboarding-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const d = json?.data;
        if (d?.businessLocationCompleted) {
          router.replace("/seller");
          return;
        }
        if (d?.sellerOnboardingCompleted && d?.needsBusinessLocation) {
          router.replace("/seller-onboarding/business-location");
          return;
        }
      } catch {
        /* allow onboarding */
      } finally {
        setChecking(false);
      }
    })();
  }, [isLoaded, isSignedIn, user, getToken, router]);

  const finish = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/seller/onboarding/complete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Could not save progress");
      }
      router.replace("/seller-onboarding/business-location");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }, [getToken, router]);

  const onContinue = () => {
    if (index < SLIDES.length - 1) {
      setIndex((i) => i + 1);
      return;
    }
    void finish();
  };

  if (!isLoaded || checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#090B0F]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00E575] border-t-transparent" />
      </div>
    );
  }

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#090B0F] text-[#F5F7FA]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0A0E14] via-[#090B0F] to-[#061210]" />

      <div className="relative mx-auto flex min-h-dvh max-w-3xl flex-col px-5 pb-8 pt-6 sm:px-8">
        {/* Progress */}
        <div className="mb-6 flex gap-1.5">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`h-[3px] flex-1 rounded-full transition-colors ${
                i === index
                  ? "bg-[#00E575]"
                  : i < index
                    ? "bg-[#00E575]/35"
                    : "bg-white/[0.08]"
              }`}
            />
          ))}
        </div>

        {/* Image */}
        <div className="relative mx-auto mb-8 flex h-[min(42vw,280px)] w-full max-w-lg items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.image}
            alt=""
            className="max-h-[88%] max-w-[88%] object-contain"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#090B0F]/90 via-transparent to-transparent" />
        </div>

        {/* Copy */}
        <div className="flex-1">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#00E575]">
            {slide.kicker}
          </p>
          <h1 className="mb-4 text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">
            {slide.headline}
          </h1>
          <SlideBody kind={slide.key} />
        </div>

        {error ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2.5 text-[13px] text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between gap-4">
          {index > 0 ? (
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-2 py-3 text-[15px] font-medium text-white/55 transition hover:text-white/90"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <span className="w-[72px]" />
          )}

          <button
            type="button"
            onClick={onContinue}
            disabled={saving}
            className="inline-flex h-12 min-w-[160px] items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-bold transition disabled:opacity-70"
            style={{
              background: isLast
                ? `linear-gradient(135deg, ${GREEN}, #00C060)`
                : `linear-gradient(135deg, ${BLUE}, #2563EB)`,
              color: isLast ? "#041008" : "#F5F7FA",
            }}
          >
            {saving ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <>
                {isLast ? "Set Up My Business" : "Continue"}
                {isLast ? (
                  <Store className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
