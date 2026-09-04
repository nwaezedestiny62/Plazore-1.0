"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { fetchProduct, fetchProductAI } from "@/lib/api";
import type { PlazoreAIData } from "@/lib/plazoreAI";
import type { Product } from "@/lib/types";

const GRAD = "linear-gradient(90deg,#10B981,#14B8A6,#3B82F6)";

const gText = {
  backgroundImage: GRAD,
  WebkitBackgroundClip: "text" as const,
  WebkitTextFillColor: "transparent",
  color: "transparent",
};

export default function ProductAIPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id || "");

  const [ai, setAi] = useState<PlazoreAIData | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      const [aiData, prod] = await Promise.all([
        fetchProductAI(id),
        fetchProduct(id),
      ]);
      if (!alive) return;
      setAi(aiData);
      setProduct(prod);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    const t = window.setTimeout(() => setRevealed(true), 2200);
    return () => window.clearTimeout(t);
  }, []);

  const images = (product?.images || []).filter(Boolean).slice(0, 3);
  const name = product?.name || "";

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(`/product/${id}`);
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#090B0F] text-[#F5F7FA]">
      <div className="pointer-events-none absolute inset-0 hidden lg:block">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[#10B981]/[0.07] blur-[120px]" />
        <div className="absolute top-[28%] right-[-8%] h-[420px] w-[420px] rounded-full bg-[#3B82F6]/[0.06] blur-[110px]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#090B0F]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-10 lg:py-4">
          <button
            type="button"
            onClick={goBack}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] lg:h-11 lg:w-11"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/plazore-ai-logo.png"
                alt=""
                className="h-[22px] w-[22px] object-contain lg:h-7 lg:w-7"
              />
              <p className="font-display text-[16px] font-semibold tracking-tight lg:text-[18px]">
                Plazore AI
              </p>
            </div>
            <p
              className="mt-0.5 font-display text-[9px] font-medium uppercase tracking-[0.18em] lg:text-[10px]"
              style={gText}
            >
              Product Intelligence
            </p>
          </div>
          <span className="w-10 lg:w-11" />
        </div>
      </header>

      {!revealed ? (
        <div className="relative flex min-h-[72vh] items-center justify-center px-7">
          <div className="relative w-full max-w-sm overflow-hidden rounded-[28px] border border-[#10B981]/20 bg-[#11141A]/80 px-8 py-16 lg:max-w-xl lg:rounded-[36px] lg:px-16 lg:py-24">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(16,185,129,0.07), rgba(59,130,246,0.05))",
              }}
            />
            <div className="relative mx-auto flex h-[120px] w-[120px] items-center justify-center lg:h-[168px] lg:w-[168px]">
              <span
                className="absolute inset-0 animate-spin rounded-full border-[2.5px] border-transparent lg:border-[3px]"
                style={{
                  borderTopColor: "#10B981",
                  borderRightColor: "#3B82F6",
                  borderLeftColor: "#10B981",
                  animationDuration: "2.6s",
                }}
              />
              <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#10B981]/10 lg:h-[80px] lg:w-[80px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/plazore-ai-logo.png"
                  alt=""
                  className="h-[34px] w-[34px] object-contain lg:h-[46px] lg:w-[46px]"
                />
              </span>
            </div>
          </div>
        </div>
      ) : (
        <main className="relative mx-auto max-w-6xl px-5 pb-20 pt-6 sm:px-6 lg:px-10 lg:pb-28 lg:pt-12 [animation:aiIn_0.9s_ease-out]">
          {/* Hero — stacked on mobile, cinematic split on large */}
          <div className="mb-8 flex flex-col items-center lg:mb-14 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
            <ImageStack images={images} />

            <div className="mt-1 w-full text-center lg:mt-0 lg:text-left">
              {name ? (
                <h1 className="mx-auto max-w-[28ch] text-[17px] font-bold leading-snug tracking-tight lg:mx-0 lg:max-w-[18ch] lg:text-[44px] lg:leading-[1.12] lg:tracking-[-0.03em]">
                  {name}
                </h1>
              ) : null}
              <p
                className="mt-1.5 font-display text-[11px] uppercase tracking-[0.12em] lg:mt-4 lg:text-[12px] lg:tracking-[0.18em]"
                style={gText}
              >
                Product interpretation
              </p>
              {ai?.summary ? (
                <p className="mt-5 hidden whitespace-pre-wrap text-[17px] leading-8 text-[#A7ADB8] lg:block">
                  {ai.summary}
                </p>
              ) : null}
              <Link
                href={`/product/${id}`}
                className="mt-7 hidden h-11 w-fit items-center rounded-full border border-white/12 bg-white/[0.04] px-5 text-sm font-semibold lg:inline-flex"
              >
                Back to product
              </Link>
            </div>
          </div>

          {/* Mobile-only summary card (desktop already has it in the hero) */}
          {ai?.summary ? (
            <div className="lg:hidden">
              <Section eyebrow="Summary" title="Quick interpretation">
                <p className="whitespace-pre-wrap text-[15px] leading-6 text-[#A7ADB8]">
                  {ai.summary}
                </p>
              </Section>
            </div>
          ) : null}

          <Section
            eyebrow="Understand"
            title="The product in context"
            featured
          >
            <p className="whitespace-pre-wrap text-[15px] leading-6 text-[#A7ADB8] lg:text-[17px] lg:leading-8">
              {ai?.overview ||
                "Plazore AI is still preparing the full interpretation for this listing."}
            </p>
          </Section>

          <div className="lg:grid lg:grid-cols-2 lg:gap-5">
            {!!ai?.highlights?.length && (
              <Section eyebrow="Evaluate" title="What stands out">
                {ai.highlights.map((item, i) => (
                  <Bullet key={i} text={item} />
                ))}
              </Section>
            )}

            {!!ai?.bestFor?.length && (
              <Section eyebrow="Consider" title="What may matter to you">
                {ai.bestFor.map((item, i) => (
                  <Bullet key={i} text={item} />
                ))}
              </Section>
            )}

            {!!ai?.thingsToConsider?.length && (
              <Section eyebrow="Clarity" title="Things worth noting">
                {ai.thingsToConsider.map((item, i) => (
                  <Bullet key={i} text={item} />
                ))}
              </Section>
            )}

            {ai?.shippingSummary ? (
              <Section eyebrow="Delivery" title="Shipping details">
                <p className="whitespace-pre-wrap text-[15px] leading-6 text-[#A7ADB8] lg:text-[16px] lg:leading-7">
                  {ai.shippingSummary}
                </p>
              </Section>
            ) : null}
          </div>

          {ai?.buyerConfidence ? (
            <Section eyebrow="Confidence" title="Buyer confidence" featured>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-10">
                <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[#3B82F6]/30 bg-[#10B981]/10 px-2.5 py-1.5 lg:px-3 lg:py-2">
                  <span
                    className="flex h-[22px] w-[22px] items-center justify-center rounded-full lg:h-7 lg:w-7"
                    style={{ backgroundImage: GRAD }}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-white lg:h-4 lg:w-4" />
                  </span>
                  <span className="text-[14.5px] font-semibold lg:text-base" style={gText}>
                    {ai.buyerConfidence.level}
                  </span>
                </div>
                {ai.confidenceExplanation ? (
                  <p className="whitespace-pre-wrap text-[15px] leading-6 text-[#A7ADB8] lg:text-[17px] lg:leading-8">
                    {ai.confidenceExplanation}
                  </p>
                ) : null}
              </div>
            </Section>
          ) : null}

          <p className="mt-6 border-t border-white/[0.06] pt-6 text-center text-[12.5px] leading-[19px] text-[#737A86] lg:mx-auto lg:mt-12 lg:max-w-xl lg:pt-10 lg:text-[13.5px] lg:leading-6">
            Plazore AI interprets the information shared by the merchant. It helps you understand the listing — it does not decide for you.
          </p>

          <Link
            href={`/product/${id}`}
            className="mt-6 flex h-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-sm font-semibold lg:hidden"
          >
            Back to product
          </Link>
        </main>
      )}

      <style>{`
        @keyframes aiIn {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ImageStack({ images }: { images: string[] }) {
  return (
    <div className="relative mb-4 h-[148px] w-[132px] lg:mb-0 lg:h-[340px] lg:w-[300px]">
      {images.length ? (
        images.map((uri, i) => {
          const depth = images.length - 1 - i;
          const rotate = depth === 2 ? -8 : depth === 1 ? 7 : 0;
          const x = depth === 2 ? -14 : depth === 1 ? 14 : 0;
          const y = depth > 0 ? 6 : 0;
          const scale = depth === 0 ? 1 : 0.92;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${uri}-${i}`}
              src={uri}
              alt=""
              className="absolute left-1/2 top-1/2 h-[128px] w-[108px] rounded-[14px] border border-white/12 object-cover lg:h-[280px] lg:w-[230px] lg:rounded-[22px]"
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rotate}deg) scale(${scale})`,
                zIndex: 10 - depth,
                boxShadow:
                  depth === 0
                    ? "0 24px 48px rgba(0,0,0,0.45)"
                    : "0 12px 28px rgba(0,0,0,0.28)",
              }}
            />
          );
        })
      ) : (
        <div className="absolute left-1/2 top-1/2 h-[128px] w-[108px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-[#252A33] bg-[#11141A] lg:h-[280px] lg:w-[230px] lg:rounded-[22px]" />
      )}
    </div>
  );
}

function Section({
  eyebrow,
  title,
  children,
  featured = false,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <section
      className={`relative mb-4 overflow-hidden rounded-[22px] border border-[#10B981]/18 bg-[#11141A]/65 p-[18px] lg:mb-5 lg:rounded-[28px] ${
        featured ? "lg:p-9" : "lg:p-7"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(16,185,129,0.05), rgba(59,130,246,0.04))",
        }}
      />
      <div className="relative">
        <p
          className="mb-1.5 font-display text-[10px] uppercase tracking-[0.16em] lg:mb-2 lg:text-[11px]"
          style={gText}
        >
          {eyebrow}
        </p>
        <h2
          className={`mb-3 font-bold tracking-tight ${
            featured
              ? "text-[17px] lg:text-[28px] lg:tracking-[-0.03em]"
              : "text-[17px] lg:text-[22px]"
          }`}
        >
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <p className="mb-2.5 flex gap-2.5 text-[14.5px] leading-[22px] text-[#A7ADB8] last:mb-0 lg:text-[16px] lg:leading-7">
      <span
        className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full"
        style={{ backgroundImage: GRAD }}
      />
      <span className="min-w-0 whitespace-pre-wrap">{text}</span>
    </p>
  );
}