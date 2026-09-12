"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

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

function Quote({ children }: { children: string }) {
  return (
    <blockquote className="my-6 flex gap-3 border-l-[3px] border-[#00E575] pl-4">
      <p className="text-lg font-bold leading-snug tracking-tight text-[#F5F7FA] sm:text-xl">
        {children}
      </p>
    </blockquote>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-white/[0.07] bg-[#11141A] p-5">
      <p className="text-[15px] font-bold text-[#F5F7FA]">{title}</p>
      <p className="mt-2 text-[13.5px] leading-5 text-[#A7ADB8]">{body}</p>
    </div>
  );
}

function FlowCol({ steps }: { steps: string[] }) {
  return (
    <ol className="my-5 space-y-0 border border-white/[0.07] bg-[#11141A] px-5 py-4">
      {steps.map((s, i) => (
        <li key={`${s}-${i}`} className="relative pl-5 pb-4 last:pb-0">
          <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[#00E575]" />
          {i < steps.length - 1 ? (
            <span className="absolute left-[3px] top-4 bottom-0 w-0.5 bg-[#00E575]/25" />
          ) : null}
          <span className="text-[13px] font-bold tracking-wide text-[#F5F7FA]">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="border-b border-white/[0.07]">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/lounge"
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/[0.07] bg-[#11141A] transition hover:border-[#00E575]/40"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-[10px] font-bold tracking-[1.8px] text-[#00E575]">PLAZORE</p>
            <h1 className="text-lg font-bold sm:text-xl">About Plazore</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="flex flex-col items-center px-2 pb-16 pt-12 text-center sm:pt-16">
                       <div className="relative mb-6 h-28 w-28 sm:h-36 sm:w-36">
            <Image
              src="/logo.png"
              alt="Plazore"
              fill
              className="object-contain"
              priority
            />
          </div>
          <p className="mt-3 text-base font-bold text-[#00E575] sm:text-lg">
            The New Way to Shop and Earn.
          </p>
          <p className="mt-5 max-w-xl text-sm leading-6 text-[#A7ADB8] sm:text-[15px]">
            Plazore is a digital commerce platform built to make discovering, buying,
            selling, and understanding commerce feel fundamentally different.
          </p>
        </section>

        {/* 1 */}
        <section className="mb-14">
          <p className="text-[10px] font-bold tracking-[1.8px] text-[#6B7280]">WHAT IS PLAZORE</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Commerce, Reimagined.
          </h2>
          <div className="mt-5 space-y-4 text-[14.5px] leading-6 text-[#A7ADB8]">
            <p>
              Plazore is a modern digital marketplace designed around a simple idea:
              commerce does not have to feel the same forever.
            </p>
            <p>
              People should be able to discover products naturally, search when they know
              what they want, understand what they are considering, buy with confidence,
              track what happens after checkout, and return to a marketplace that becomes
              more useful through real commerce activity.
            </p>
            <p>
              For sellers, Plazore is more than a place to upload products. It is a digital
              environment for establishing a store, reaching buyers, managing commerce,
              understanding business activity, and growing with less unnecessary
              operational friction.
            </p>
            <p className="font-bold text-[#F5F7FA]">
              Familiar commerce fundamentals. A different experience.
            </p>
          </div>
        </section>

        {/* 2 */}
        <section className="mb-14">
          <p className="text-[10px] font-bold tracking-[1.8px] text-[#6B7280]">WHY WE EXIST</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Why We Built Plazore
          </h2>
          <div className="mt-5 space-y-4 text-[14.5px] leading-6 text-[#A7ADB8]">
            <p>
              Commerce has existed for as long as people have exchanged value. The tools
              around it have changed countless times, but many of the habits remain
              familiar.
            </p>
            <p className="font-semibold tracking-wide text-[#F5F7FA]">
              Search. Browse. Compare. Buy. Sell. Deliver. Get paid. Repeat.
            </p>
            <p>Plazore asks a different question:</p>
            <Quote>What if more of commerce could simply run?</Quote>
            <p>
              What if a business did not have to spend so much of its time manually
              figuring out what was already happening inside its own commerce?
            </p>
            <p>
              What if products could become easier to discover from actual marketplace
              activity? What if sellers could understand where their business is improving,
              where it is slowing down, and where attention may be needed — without piecing
              everything together themselves?
            </p>
            <p>
              What if buyers could understand products faster and have a structured
              commerce system behind their purchases?
            </p>
            <p className="font-bold text-[#F5F7FA]">Plazore is built around that pursuit.</p>
          </div>
        </section>

        {/* 3 */}
        <section className="mb-14">
          <p className="text-[10px] font-bold tracking-[1.8px] text-[#6B7280]">AUTOPILOT</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Commerce on Autopilot.
          </h2>
          <p className="mt-2 font-bold text-[#00E575]">
            Less guesswork. More intelligent systems.
          </p>
          <div className="mt-5 space-y-4 text-[14.5px] leading-6 text-[#A7ADB8]">
            <p>
              Plazore is pursuing a future where commerce can increasingly operate on
              autopilot — not because humans no longer matter, but because people should
              not spend their time repeatedly performing tasks that software can observe,
              organize, measure, and coordinate.
            </p>
            <FlowCol steps={AUTOPILOT} />
            <p>
              People browse. People buy. Products perform differently. Demand changes.
              Problems appear. Businesses grow or slow down. Plazore continuously turns
              those signals into useful commerce intelligence and structured workflows.
            </p>
            <p>The goal is not to remove the human from commerce.</p>
            <Quote>The goal is to remove unnecessary human effort from commerce.</Quote>
          </div>
        </section>

        {/* 4 Buyers */}
        <section className="mb-14">
          <p className="text-[10px] font-bold tracking-[1.8px] text-[#6B7280]">BUYERS</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            For People Who Shop
          </h2>
          <p className="mt-5 text-[14.5px] leading-6 text-[#A7ADB8]">
            Plazore gives buyers two ways to experience commerce: discover naturally or
            search intentionally.
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
            Shopping should not begin with knowing exactly what you want. Sometimes
            discovery comes first.
          </p>
        </section>

        {/* 5 Sellers */}
        <section className="mb-14">
          <p className="text-[10px] font-bold tracking-[1.8px] text-[#6B7280]">SELLERS</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            For People Who Sell
          </h2>
          <p className="mt-5 text-[14.5px] leading-6 text-[#A7ADB8]">
            Plazore gives sellers a digital place to establish their store, present their
            products, reach buyers, manage orders, and understand how their commerce is
            performing.
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
        </section>

        {/* 6 Discovery */}
        <section className="mb-14">
          <p className="text-[10px] font-bold tracking-[1.8px] text-[#6B7280]">DISCOVERY</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Discovery Should Feel Alive.
          </h2>
          <div className="mt-5 space-y-4 text-[14.5px] leading-6 text-[#A7ADB8]">
            <p>
              Traditional marketplaces often begin with a question: “What are you looking
              for?” Plazore also asks another:
            </p>
            <Quote>What might you discover?</Quote>
            <p>
              The Plazore showroom uses marketplace activity, user interaction, relevance,
              availability, product freshness, seller activity, and other commerce signals
              to continuously shape discovery. A single accidental click should not define
              someone’s experience. Meaningful signals matter more.
            </p>
            <p>
              This is a recommendation and discovery system built around actual marketplace
              signals — not a claim that the showroom is powered only by AI.
            </p>
          </div>
        </section>

        {/* 7 AI */}
        <section className="mb-14">
          <p className="text-[10px] font-bold tracking-[1.8px] text-[#6B7280]">PLAZORE AI</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Intelligence Inside Commerce.
          </h2>
          <p className="mt-2 font-bold text-[#00E575]">Plazore AI</p>
          <p className="mt-4 text-[14.5px] leading-6 text-[#A7ADB8]">
            Plazore AI is designed around product and commerce intelligence — not
            conversation for conversation’s sake. It helps turn available product
            information and marketplace activity into useful context so buyers can
            understand products faster and sellers can better understand their commerce
            activity.
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
            Plazore AI does not make every decision for you. It exists to make the
            information behind the decision more useful.
          </p>
        </section>

        {/* 8 Confidence */}
        <section className="mb-14">
          <p className="text-[10px] font-bold tracking-[1.8px] text-[#6B7280]">
            BUYER CONFIDENCE
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Confidence Without Pretending.
          </h2>
          <p className="mt-5 text-[14.5px] leading-6 text-[#A7ADB8]">
            Plazore does not believe every product needs an artificial star rating. Buyer
            Confidence communicates how much useful supporting information and marketplace
            activity is available for a product.
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
            marketplace activity. Growing means useful signals are developing. Limited
            means there is not yet enough supporting information or activity to provide
            stronger context.
          </p>
          <p className="mt-4 font-bold text-[#F5F7FA]">
            Limited does not automatically mean a product is bad. It means there is less
            information available to support a stronger conclusion.
          </p>
        </section>

        {/* 9 Commerce flow */}
        <section className="mb-14">
          <p className="text-[10px] font-bold tracking-[1.8px] text-[#6B7280]">COMMERCE</p>
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
            The experience may evolve. The responsibility of commerce remains real.
          </p>
        </section>

        {/* 10 Trust */}
        <section className="mb-14">
          <p className="text-[10px] font-bold tracking-[1.8px] text-[#6B7280]">TRUST</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Commerce With Structure.
          </h2>
          <p className="mt-5 text-[14.5px] leading-6 text-[#A7ADB8]">
            Buying from an unfamiliar seller should not mean leaving the entire
            transaction to an informal conversation. Plazore connects payment, order
            records, delivery status, buyer confirmation, and issue handling into a
            structured marketplace flow.
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
            Plazore is designed to provide a structured path for addressing problems when
            they occur — not a promise of automatic refunds in every case.
          </p>
        </section>

        {/* 11 Shop & Earn */}
        <section className="mb-14">
          <p className="text-[10px] font-bold tracking-[1.8px] text-[#6B7280]">SHOP & EARN</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            The New Way to Shop and Earn.
          </h2>
          <div className="mt-5 space-y-4 text-[14.5px] leading-6 text-[#A7ADB8]">
            <p>
              “Shop” is the buyer side: discovering products, exploring stores, making
              informed purchases, and participating in commerce.
            </p>
            <p>
              “Earn” is the seller side: bringing products to market, reaching buyers,
              completing transactions, and building a business.
            </p>
            <Quote>One marketplace. Two sides of commerce.</Quote>
            <p className="font-bold text-[#F5F7FA]">
              Plazore exists where discovery meets opportunity.
            </p>
          </div>
        </section>

        {/* 12 Surfaces */}
        <section className="mb-14">
          <p className="text-[10px] font-bold tracking-[1.8px] text-[#6B7280]">SURFACES</p>
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
        </section>

        {/* 13 Direction */}
        <section className="mb-14">
          <p className="text-[10px] font-bold tracking-[1.8px] text-[#6B7280]">DIRECTION</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            We Are Chasing Something Bigger.
          </h2>
          <div className="mt-5 space-y-4 text-[14.5px] leading-6 text-[#A7ADB8]">
            <p>
              Plazore starts with commerce because commerce is one of humanity’s oldest
              systems. People have always bought. People have always sold. People have
              always tried to understand demand, manage risk, find opportunity, and make a
              profit. Technology has changed how those things happen. Plazore wants to push
              that evolution further.
            </p>
            <Quote>
              From manually operated commerce toward increasingly autonomous commerce.
            </Quote>
            <p>
              A world where systems can observe what is happening, understand what it
              means, carry out routine actions, identify problems, and continuously improve
              the way commerce operates — while humans remain responsible for the decisions
              that truly require human judgment.
            </p>
            <p className="font-bold text-[#F5F7FA]">
              Commerce is the beginning. Fully autonomous commerce is a direction we are
              pursuing — not a claim of what is already complete.
            </p>
          </div>
        </section>

        {/* 14 Principle */}
        <section className="mb-14">
          <p className="text-[10px] font-bold tracking-[1.8px] text-[#6B7280]">PRINCIPLE</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Different by Design.
          </h2>
          <div className="mt-5 space-y-4 text-[14.5px] leading-6 text-[#A7ADB8]">
            <p>Plazore isn’t trying to make e-commerce look prettier.</p>
            <Quote>It’s trying to make commerce feel different.</Quote>
            <p>
              The unfamiliar experience is intentional. The familiar fundamentals are
              intentional. The intelligence is intentional. The simplicity is intentional.
            </p>
            <p className="font-bold text-[#F5F7FA]">
              The goal is not technology for technology’s sake. The goal is technology that
              makes commerce work better.
            </p>
          </div>
        </section>

        {/* Closing */}
        <section className="border border-[#00E575]/20 bg-gradient-to-br from-[#00E575]/10 to-[#3B82F6]/10 px-6 py-14 text-center sm:px-10">
                    <div className="relative mx-auto mb-5 h-24 w-24">
            <Image src="/logo.png" alt="Plazore" fill className="object-contain" />
          </div>
          <p className="mt-3 text-xs font-extrabold tracking-[1.4px] text-[#00E575]">
            THE NEW WAY TO SHOP AND EARN.
          </p>
          <p className="mt-4 text-base font-bold tracking-wide">
            BUY AND SELL LIKE IT’S 2040.
          </p>
          <p className="mt-5 text-sm text-[#A7ADB8]">
            Discover differently. Buy confidently. Sell intelligently.
          </p>
        </section>
      </main>
    </div>
  );
}