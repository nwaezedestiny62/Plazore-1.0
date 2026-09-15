"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";

const AUTOPILOT = [
  "ACTIVITY",
  "OBSERVATION",
  "UNDERSTANDING",
  "ACTION",
  "IMPROVEMENT",
  "ACTIVITY",
];
const COMMERCE = [
  "DISCOVER",
  "EXPLORE",
  "PRODUCT",
  "CART",
  "CHECKOUT",
  "PAYMENT",
  "ORDER",
  "DELIVERY",
  "CONFIRM",
  "COMPLETE",
];
const TRUST = [
  "Payment",
  "Order",
  "Fulfilment",
  "Delivery",
  "Buyer Confirmation",
  "Completion",
];
const ISSUE = ["Issue", "Plazore Contact", "Review", "Resolution"];

/** External imagery (Unsplash) — add images.unsplash.com to next.config images.remotePatterns if needed */
const IMG = {
  cityCommerce:
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80",
  discovery:
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1400&q=80",
  autopilot:
    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80",
  buyers:
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80",
  sellers:
    "https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=1400&q=80",
  showroom:
    "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1400&q=80",
  intelligence:
    "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1400&q=80",
  trust:
    "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1400&q=80",
  direction:
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80",
};

function useInView<T extends HTMLElement>(opts?: { threshold?: number }) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: opts?.threshold ?? 0.14, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [opts?.threshold]);

  return { ref, inView };
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className}`}
      style={{
        transitionDelay: inView ? `${delay}ms` : "0ms",
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(28px)",
      }}
    >
      {children}
    </div>
  );
}

function Quote({ children }: { children: string }) {
  return (
    <blockquote className="my-7 flex gap-4 border-l-[3px] border-[#00E575] pl-5">
      <p className="text-lg font-bold leading-snug tracking-tight text-[#F5F7FA] sm:text-xl">
        {children}
      </p>
    </blockquote>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-white/[0.07] bg-[#11141A] p-5 transition hover:border-white/[0.12]">
      <p className="text-[15px] font-bold text-[#F5F7FA]">{title}</p>
      <p className="mt-2 text-[13.5px] leading-6 text-[#A7ADB8]">{body}</p>
    </div>
  );
}

function FlowCol({ steps }: { steps: string[] }) {
  return (
    <ol className="my-5 space-y-0 border border-white/[0.07] bg-[#11141A] px-5 py-4">
      {steps.map((s, i) => (
        <li key={`${s}-${i}`} className="relative pb-4 pl-5 last:pb-0">
          <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[#00E575]" />
          {i < steps.length - 1 ? (
            <span className="absolute bottom-0 left-[3px] top-4 w-0.5 bg-[#00E575]/25" />
          ) : null}
          <span className="text-[13px] font-bold tracking-wide text-[#F5F7FA]">
            {s}
          </span>
        </li>
      ))}
    </ol>
  );
}

function SectionMedia({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  return (
    <div className="relative my-8 overflow-hidden border border-white/[0.08]">
      <div className="relative aspect-[21/9] w-full sm:aspect-[2.4/1]">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 1024px"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(9,11,15,0.15) 0%, rgba(9,11,15,0.55) 100%)",
          }}
        />
      </div>
      {caption ? (
        <p className="absolute bottom-3 left-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <p
      className="text-[10px] font-bold uppercase tracking-[1.8px]"
      style={{
        backgroundImage: GRAD,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
    >
      {children}
    </p>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#090B0F]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/lounge"
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/[0.07] bg-[#11141A] transition hover:border-[#00E575]/40"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-[10px] font-bold tracking-[1.8px] text-[#00E575]">
              PLAZORE
            </p>
            <h1 className="text-lg font-bold sm:text-xl">About Plazore</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="relative overflow-hidden pb-16 pt-12 text-center sm:pt-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(0,229,117,0.12), transparent 60%), radial-gradient(ellipse 50% 40% at 80% 60%, rgba(59,130,246,0.1), transparent 55%)",
            }}
            aria-hidden
          />
          <Reveal>
            <div className="relative mx-auto mb-6 h-28 w-28 sm:h-36 sm:w-36">
              <Image
                src="/logo.png"
                alt="Plazore"
                fill
                className="object-contain drop-shadow-[0_0_32px_rgba(0,229,117,0.25)]"
                priority
              />
            </div>
            <p className="mt-3 text-base font-bold text-[#00E575] sm:text-lg">
              The New Way to Shop and Earn.
            </p>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-[#A7ADB8] sm:text-[15px]">
              Plazore is a digital commerce platform built to make discovering,
              buying, selling, and understanding commerce feel fundamentally
              different.
            </p>
          </Reveal>
        </section>

        {/* 1 What is Plazore */}
        <section className="mb-16">
          <Reveal>
            <Eyebrow>What is Plazore</Eyebrow>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Commerce, Reimagined.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <SectionMedia
              src={IMG.cityCommerce}
              alt="Commerce and retail environment"
              caption="Commerce as a living system"
            />
          </Reveal>
          <Reveal delay={120}>
            <div className="space-y-4 text-[14.5px] leading-6 text-[#A7ADB8]">
              <p>
                Plazore is a modern digital marketplace designed around a simple
                idea: commerce does not have to feel the same forever.
              </p>
              <p>
                People should be able to discover products naturally, search when
                they know what they want, understand what they are considering,
                buy with confidence, track what happens after checkout, and return
                to a marketplace that becomes more useful through real commerce
                activity.
              </p>
              <p>
                For sellers, Plazore is more than a place to upload products. It is
                a digital environment for establishing a store, reaching buyers,
                managing commerce, understanding business activity, and growing
                with less unnecessary operational friction.
              </p>
              <p className="font-bold text-[#F5F7FA]">
                Familiar commerce fundamentals. A different experience.
              </p>
            </div>
          </Reveal>
        </section>

        {/* 2 Why */}
        <section className="mb-16">
          <Reveal>
            <Eyebrow>Why we exist</Eyebrow>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Why We Built Plazore
            </h2>
            <div className="mt-5 space-y-4 text-[14.5px] leading-6 text-[#A7ADB8]">
              <p>
                Commerce has existed for as long as people have exchanged value.
                The tools around it have changed countless times, but many of the
                habits remain familiar.
              </p>
              <p className="font-semibold tracking-wide text-[#F5F7FA]">
                Search. Browse. Compare. Buy. Sell. Deliver. Get paid. Repeat.
              </p>
              <p>Plazore asks a different question:</p>
              <Quote>What if more of commerce could simply run?</Quote>
              <p>
                What if a business did not have to spend so much of its time
                manually figuring out what was already happening inside its own
                commerce?
              </p>
              <p>
                What if products could become easier to discover from actual
                marketplace activity? What if sellers could understand where their
                business is improving, where it is slowing down, and where
                attention may be needed — without piecing everything together
                themselves?
              </p>
              <p>
                What if buyers could understand products faster and have a
                structured commerce system behind their purchases?
              </p>
              <p className="font-bold text-[#F5F7FA]">
                Plazore is built around that pursuit.
              </p>
            </div>
          </Reveal>
        </section>

        {/* 3 Autopilot */}
        <section className="mb-16">
          <Reveal>
            <Eyebrow>Autopilot</Eyebrow>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Commerce on Autopilot.
            </h2>
            <p className="mt-2 font-bold text-[#00E575]">
              Less guesswork. More intelligent systems.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <SectionMedia
              src={IMG.autopilot}
              alt="Systems and circuitry representing automated intelligence"
              caption="Observe · understand · improve"
            />
          </Reveal>
          <Reveal delay={120}>
            <div className="space-y-4 text-[14.5px] leading-6 text-[#A7ADB8]">
              <p>
                Plazore is pursuing a future where commerce can increasingly
                operate on autopilot — not because humans no longer matter, but
                because people should not spend their time repeatedly performing
                tasks that software can observe, organize, measure, and coordinate.
              </p>
              <FlowCol steps={AUTOPILOT} />
              <p>
                People browse. People buy. Products perform differently. Demand
                changes. Problems appear. Businesses grow or slow down. Plazore
                continuously turns those signals into useful commerce intelligence
                and structured workflows.
              </p>
              <p>The goal is not to remove the human from commerce.</p>
              <Quote>
                The goal is to remove unnecessary human effort from commerce.
              </Quote>
            </div>
          </Reveal>
        </section>

        {/* 4 Buyers */}
        <section className="mb-16">
          <Reveal>
            <Eyebrow>Buyers</Eyebrow>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              For People Who Shop
            </h2>
          </Reveal>
          <Reveal delay={60}>
            <SectionMedia
              src={IMG.buyers}
              alt="People shopping and exploring products"
              caption="Discover · understand · buy"
            />
          </Reveal>
          <Reveal delay={100}>
            <p className="text-[14.5px] leading-6 text-[#A7ADB8]">
              Plazore gives buyers two ways to experience commerce: discover
              naturally or search intentionally.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Card
                title="Discover"
                body="Explore products through the Plazore showroom and encounter things you may not have known you were looking for."
              />
              <Card
                title="Understand"
                body="Use product information and Plazore AI to understand what you are considering more quickly."
              />
              <Card
                title="Buy"
                body="Add products to your cart, review your order, pay through supported payment infrastructure, track delivery, confirm receipt, and raise an issue through Plazore when something goes wrong."
              />
            </div>
            <p className="mt-5 font-bold text-[#F5F7FA]">
              Shopping should not begin with knowing exactly what you want.
              Sometimes discovery comes first.
            </p>
          </Reveal>
        </section>

        {/* 5 Sellers */}
        <section className="mb-16">
          <Reveal>
            <Eyebrow>Sellers</Eyebrow>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              For People Who Sell
            </h2>
          </Reveal>
          <Reveal delay={60}>
            <SectionMedia
              src={IMG.sellers}
              alt="Seller and retail operations"
              caption="Build · reach · grow"
            />
          </Reveal>
          <Reveal delay={100}>
            <p className="text-[14.5px] leading-6 text-[#A7ADB8]">
              Plazore gives sellers a digital place to establish their store,
              present their products, reach buyers, manage orders, and understand
              how their commerce is performing.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Card
                title="Build"
                body="Create your store and bring your products into the Plazore marketplace."
              />
              <Card
                title="Reach"
                body="Let your products participate in search, discovery, showroom activity, and marketplace visibility."
              />
              <Card
                title="Understand"
                body="See the signals behind your commerce instead of relying only on intuition."
              />
              <Card
                title="Grow"
                body="Identify what is gaining traction, what needs attention, where opportunities may exist, and where expansion may or may not make sense."
              />
            </div>
            <p className="mt-5 font-bold text-[#F5F7FA]">
              Growth should be informed by what commerce is actually telling you.
            </p>
          </Reveal>
        </section>

        {/* 6 Discovery */}
        <section className="mb-16">
          <Reveal>
            <Eyebrow>Discovery</Eyebrow>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Discovery Should Feel Alive.
            </h2>
          </Reveal>
          <Reveal delay={60}>
            <SectionMedia
              src={IMG.showroom}
              alt="Curated product discovery space"
              caption="Showroom as a living surface"
            />
          </Reveal>
          <Reveal delay={100}>
            <div className="space-y-4 text-[14.5px] leading-6 text-[#A7ADB8]">
              <p>
                Traditional marketplaces often begin with a question: “What are
                you looking for?” Plazore also asks another:
              </p>
              <Quote>What might you discover?</Quote>
              <p>
                The Plazore showroom uses marketplace activity, user interaction,
                relevance, availability, product freshness, seller activity, and
                other commerce signals to continuously shape discovery. A single
                accidental click should not define someone’s experience.
                Meaningful signals matter more.
              </p>
              <p>
                This is a recommendation and discovery system built around actual
                marketplace signals — not a claim that the showroom is powered only
                by AI.
              </p>
            </div>
          </Reveal>
        </section>

        {/* 7 AI */}
        <section className="mb-16">
          <Reveal>
            <Eyebrow>Plazore AI</Eyebrow>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Intelligence Inside Commerce.
            </h2>
            <p className="mt-2 font-bold text-[#00E575]">Plazore AI</p>
          </Reveal>
          <Reveal delay={60}>
            <SectionMedia
              src={IMG.intelligence}
              alt="Abstract intelligence and data visualization"
              caption="Product & commerce intelligence"
            />
          </Reveal>
          <Reveal delay={100}>
            <p className="text-[14.5px] leading-6 text-[#A7ADB8]">
              Plazore AI is designed around product and commerce intelligence —
              not conversation for conversation’s sake. It helps turn available
              product information and marketplace activity into useful context so
              buyers can understand products faster and sellers can better
              understand their commerce activity.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Card
                title="Buyer Intelligence"
                body="Understand a product faster, with useful context around the information available to you."
              />
              <Card
                title="Seller Intelligence"
                body="Turn commerce activity into clearer business context and help identify meaningful changes in performance."
              />
            </div>
            <p className="mt-5 font-bold text-[#F5F7FA]">
              Plazore AI does not make every decision for you. It exists to make
              the information behind the decision more useful.
            </p>
          </Reveal>
        </section>

        {/* 8 Confidence */}
        <section className="mb-16">
          <Reveal>
            <Eyebrow>Buyer Confidence</Eyebrow>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Confidence Without Pretending.
            </h2>
            <p className="mt-5 text-[14.5px] leading-6 text-[#A7ADB8]">
              Plazore does not believe every product needs an artificial star
              rating. Buyer Confidence communicates how much useful supporting
              information and marketplace activity is available for a product.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="border border-[#00E575]/35 bg-[#00E575]/10 px-3 py-2 text-[11px] font-extrabold tracking-wide">
                HIGH CONFIDENCE
              </span>
              <span className="border border-[#3B82F6]/35 bg-[#3B82F6]/10 px-3 py-2 text-[11px] font-extrabold tracking-wide">
                GROWING
              </span>
              <span className="border border-white/[0.07] bg-[#171B22] px-3 py-2 text-[11px] font-extrabold tracking-wide">
                LIMITED
              </span>
            </div>
            <p className="mt-5 text-[14.5px] leading-6 text-[#A7ADB8]">
              High Confidence means there is meaningful supporting information and
              marketplace activity. Growing means useful signals are developing.
              Limited means there is not yet enough supporting information or
              activity to provide stronger context.
            </p>
            <p className="mt-4 font-bold text-[#F5F7FA]">
              Limited does not automatically mean a product is bad. It means there
              is less information available to support a stronger conclusion.
            </p>
          </Reveal>
        </section>

        {/* 9 Commerce flow */}
        <section className="mb-16">
          <Reveal>
            <Eyebrow>Commerce</Eyebrow>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Built for Commerce.
            </h2>
            <p className="mt-5 text-[14.5px] leading-6 text-[#A7ADB8]">
              Plazore may feel different from a traditional marketplace, but the
              fundamentals remain familiar.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px] font-extrabold tracking-wide">
              {COMMERCE.map((s, i) => (
                <span key={s} className="flex items-center gap-2">
                  <span className="text-[#F5F7FA]">{s}</span>
                  {i < COMMERCE.length - 1 ? (
                    <span className="text-[#6B7280]">→</span>
                  ) : null}
                </span>
              ))}
            </div>
            <p className="mt-5 font-bold text-[#F5F7FA]">
              The experience may evolve. The responsibility of commerce remains
              real.
            </p>
          </Reveal>
        </section>

        {/* 10 Trust */}
        <section className="mb-16">
          <Reveal>
            <Eyebrow>Trust</Eyebrow>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Commerce With Structure.
            </h2>
          </Reveal>
          <Reveal delay={60}>
            <SectionMedia
              src={IMG.trust}
              alt="Secure transaction and structure"
              caption="Payment · order · fulfilment · confirmation"
            />
          </Reveal>
          <Reveal delay={100}>
            <p className="text-[14.5px] leading-6 text-[#A7ADB8]">
              Buying from an unfamiliar seller should not mean leaving the entire
              transaction to an informal conversation. Plazore connects payment,
              order records, delivery status, buyer confirmation, and issue
              handling into a structured marketplace flow.
            </p>
            <p className="mt-6 text-[11px] font-bold tracking-wide text-[#6B7280]">
              ORDER PATH
            </p>
            <FlowCol steps={TRUST} />
            <p className="mt-2 text-[11px] font-bold tracking-wide text-[#6B7280]">
              IF SOMETHING GOES WRONG
            </p>
            <FlowCol steps={ISSUE} />
            <p className="mt-4 font-bold text-[#F5F7FA]">
              Plazore is designed to provide a structured path for addressing
              problems when they occur — not a promise of automatic refunds in
              every case.
            </p>
          </Reveal>
        </section>

        {/* 11 Shop & Earn */}
        <section className="mb-16">
          <Reveal>
            <Eyebrow>Shop & Earn</Eyebrow>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              The New Way to Shop and Earn.
            </h2>
            <div className="mt-5 space-y-4 text-[14.5px] leading-6 text-[#A7ADB8]">
              <p>
                “Shop” is the buyer side: discovering products, exploring stores,
                making informed purchases, and participating in commerce.
              </p>
              <p>
                “Earn” is the seller side: bringing products to market, reaching
                buyers, completing transactions, and building a business.
              </p>
              <Quote>One marketplace. Two sides of commerce.</Quote>
              <p className="font-bold text-[#F5F7FA]">
                Plazore exists where discovery meets opportunity.
              </p>
            </div>
          </Reveal>
        </section>

        {/* 12 Surfaces */}
        <section className="mb-16">
          <Reveal>
            <Eyebrow>Surfaces</Eyebrow>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              One Commerce Ecosystem.
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Card
                title="Web"
                body="A larger canvas for browsing, discovery, shopping, and seller operations."
              />
              <Card
                title="App"
                body="A deeper, more personal Plazore experience built for continued engagement with the marketplace."
              />
            </div>
            <p className="mt-5 font-bold text-[#F5F7FA]">
              Different surfaces. One commerce ecosystem.
            </p>
          </Reveal>
        </section>

        {/* 13 Direction */}
        <section className="mb-16">
          <Reveal>
            <Eyebrow>Direction</Eyebrow>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              We Are Chasing Something Bigger.
            </h2>
          </Reveal>
          <Reveal delay={60}>
            <SectionMedia
              src={IMG.direction}
              alt="Earth from space representing long-term direction"
              caption="Commerce is the beginning"
            />
          </Reveal>
          <Reveal delay={100}>
            <div className="space-y-4 text-[14.5px] leading-6 text-[#A7ADB8]">
              <p>
                Plazore starts with commerce because commerce is one of humanity’s
                oldest systems. People have always bought. People have always sold.
                People have always tried to understand demand, manage risk, find
                opportunity, and make a profit. Technology has changed how those
                things happen. Plazore wants to push that evolution further.
              </p>
              <Quote>
                From manually operated commerce toward increasingly autonomous
                commerce.
              </Quote>
              <p>
                A world where systems can observe what is happening, understand
                what it means, carry out routine actions, identify problems, and
                continuously improve the way commerce operates — while humans
                remain responsible for the decisions that truly require human
                judgment.
              </p>
              <p className="font-bold text-[#F5F7FA]">
                Commerce is the beginning. Fully autonomous commerce is a
                direction we are pursuing — not a claim of what is already
                complete.
              </p>
            </div>
          </Reveal>
        </section>

        {/* 14 Principle */}
        <section className="mb-16">
          <Reveal>
            <Eyebrow>Principle</Eyebrow>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Different by Design.
            </h2>
            <div className="mt-5 space-y-4 text-[14.5px] leading-6 text-[#A7ADB8]">
              <p>Plazore isn’t trying to make e-commerce look prettier.</p>
              <Quote>It’s trying to make commerce feel different.</Quote>
              <p>
                The unfamiliar experience is intentional. The familiar
                fundamentals are intentional. The intelligence is intentional. The
                simplicity is intentional.
              </p>
              <p className="font-bold text-[#F5F7FA]">
                The goal is not technology for technology’s sake. The goal is
                technology that makes commerce work better.
              </p>
            </div>
          </Reveal>
        </section>

        {/* Closing */}
        <Reveal>
          <section className="relative overflow-hidden border border-[#00E575]/20 px-6 py-14 text-center sm:px-10">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(0,229,117,0.12), rgba(20,184,166,0.06), rgba(59,130,246,0.12))",
              }}
              aria-hidden
            />
            <div className="relative mx-auto mb-5 h-24 w-24">
              <Image
                src="/logo.png"
                alt="Plazore"
                fill
                className="object-contain"
              />
            </div>
            <p className="relative mt-3 text-xs font-extrabold tracking-[1.4px] text-[#00E575]">
              THE NEW WAY TO SHOP AND EARN.
            </p>
            <p className="relative mt-4 text-base font-bold tracking-wide">
              SHOP AND EARN LIKE IT’S 2040.
            </p>
            <p className="relative mt-5 text-sm text-[#A7ADB8]">
              Discover differently. Buy confidently. Sell intelligently.
            </p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/download"
                className="inline-flex h-12 items-center justify-center px-6 text-[13px] font-extrabold text-[#041412]"
                style={{ backgroundImage: GRAD }}
              >
                Get the Plazore App
              </Link>
              <Link
                href="/"
                className="inline-flex h-12 items-center justify-center border border-white/12 px-6 text-[13px] font-bold text-white/75 transition hover:text-white"
              >
                Enter the Showroom
              </Link>
            </div>
          </section>
        </Reveal>
      </main>
    </div>
  );
}