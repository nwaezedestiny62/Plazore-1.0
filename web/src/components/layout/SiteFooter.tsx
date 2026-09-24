"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com/api";
const YEAR = new Date().getFullYear();
const GRAD = "linear-gradient(90deg,#00E575 0%,#14B8A6 45%,#3B82F6 100%)";

const COLS = [
  {
    title: "Explore",
    links: [
      { href: "/", label: "Showroom" },
      { href: "/browse", label: "Browse" },
      { href: "/lounge", label: "Lounge" },
      { href: "/cart", label: "Cart" },
    ],
  },
  {
    title: "You",
    links: [
      { href: "/profile", label: "Profile" },
      { href: "/orders", label: "Orders" },
      { href: "/download", label: "Get the app" },
      { href: "/about", label: "About" },
    ],
  },
  {
    title: "Plazore",
    links: [
      { href: "/help", label: "Help" },
      { href: "/contact", label: "Contact" },
      { href: "/help", label: "Privacy" },
      { href: "/help", label: "Terms" },
    ],
  },
] as const;

function isSellerPayload(u: any): boolean {
  if (!u || typeof u !== "object") return false;
  if (u.isSeller === true || u.seller === true) return true;
  const role = String(u.role || u.userRole || "").toLowerCase();
  if (role === "seller" || role === "admin") return true;
  if (u.storeName || u.store?.name || u.sellerProfile) return true;
  return false;
}

export function SiteFooter() {
  const ref = useRef<HTMLElement>(null);
  const { isSignedIn, getToken, isLoaded } = useAuth();
  const [inView, setInView] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [sellerChecked, setSellerChecked] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "80px", threshold: 0.03 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isLoaded) return;
      if (!isSignedIn) {
        if (!cancelled) {
          setIsSeller(false);
          setSellerChecked(true);
        }
        return;
      }
      try {
        const token = await getToken();
        if (!token || cancelled) {
          if (!cancelled) setSellerChecked(true);
          return;
        }
        const res = await fetch(`${API}/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) {
            setIsSeller(false);
            setSellerChecked(true);
          }
          return;
        }
        const json = await res.json();
        const u = json?.data ?? json?.user ?? json;
        if (!cancelled) {
          setIsSeller(isSellerPayload(u));
          setSellerChecked(true);
        }
      } catch {
        if (!cancelled) {
          setIsSeller(false);
          setSellerChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  const sellerCta = isSeller
    ? { href: "/seller", label: "Enter Dashboard", jiggle: false }
    : {
        href: "/seller-register",
        label: "Secure a Store on Plazore today!",
        jiggle: true,
      };

  return (
    <footer
      ref={ref}
      className={`relative mt-auto overflow-hidden ${
        inView ? "pf-in" : "opacity-0"
      }`}
    >
      {/* Top edge — mall threshold */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 5%, rgba(0,229,117,0.4), rgba(59,130,246,0.35), transparent 95%)",
        }}
        aria-hidden
      />

      {/* Stage floor background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[#05070B]" />
        {/* Soft ceiling lights */}
        <div className="pf-light absolute left-[12%] top-0 h-[1px] w-[28%] max-w-[280px]" />
        <div className="pf-light absolute right-[18%] top-0 h-[1px] w-[22%] max-w-[200px] opacity-70" />
        <div className="pf-glow-a absolute left-[-10%] top-[-20%] h-[70%] w-[55%]" />
        <div className="pf-glow-b absolute bottom-[-35%] right-[-10%] h-[75%] w-[50%]" />
        {/* Subtle aisle perspective */}
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(180deg, transparent 0%, transparent 40%, rgba(255,255,255,0.02) 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.2]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage:
              "linear-gradient(to bottom, transparent, black 20%, black 70%, transparent)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 pb-11 pt-14 sm:px-8 sm:pb-12 sm:pt-16">
        {/* Brand row */}
        <div className="flex flex-col gap-8 border-b border-white/[0.06] pb-11 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div className="max-w-md">
            <Link href="/" className="inline-flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt=""
                className="h-9 w-9 object-contain sm:h-10 sm:w-10"
              />
              <div>
                <span className="block text-[11px] font-semibold tracking-[0.3em] text-white/90 uppercase">
                  Plazore
                </span>
                <span className="mt-0.5 block text-[10px] tracking-[0.18em] text-white/30 uppercase">
                  Digital Mall
                </span>
              </div>
            </Link>
            <p className="mt-5 text-[14px] leading-[1.7] text-white/42 sm:text-[15px]">
              Curated floors. Trusted sellers. Shopping without the noise.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <Link
              href="/download"
              className="inline-flex h-11 items-center justify-center border border-white/[0.1] bg-white/[0.03] px-5 text-[10px] font-bold tracking-[0.18em] text-white/75 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white sm:h-12 sm:px-6 sm:text-[11px]"
            >
              GET THE APP
            </Link>

            {/* Seller-aware primary CTA */}
            {sellerChecked ? (
              <Link
                href={sellerCta.href}
                className={`inline-flex h-11 items-center justify-center px-5 text-center text-[10px] font-extrabold tracking-[0.12em] text-[#041412] transition hover:brightness-110 active:translate-y-px sm:h-12 sm:px-6 sm:text-[11px] sm:tracking-[0.14em] ${
                  sellerCta.jiggle ? "pf-jiggle" : ""
                }`}
                style={{ backgroundImage: GRAD }}
              >
                {sellerCta.label.toUpperCase()}
              </Link>
            ) : (
              <span
                className="inline-flex h-11 items-center justify-center px-5 text-[10px] font-extrabold tracking-[0.14em] text-[#041412]/50 sm:h-12 sm:px-6 sm:text-[11px]"
                style={{ backgroundImage: GRAD, opacity: 0.55 }}
                aria-hidden
              >
                …
              </span>
            )}
          </div>
        </div>

        {/* Directory columns — mall directory board */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 pt-11 sm:grid-cols-3 sm:gap-12">
          {COLS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-[9px] font-bold tracking-[0.28em] text-white/28 uppercase sm:text-[10px]">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
                {col.links.map((l) => (
                  <li key={`${col.title}-${l.label}`}>
                    <Link
                      href={l.href}
                      className="group inline-flex items-center gap-2 text-[13px] text-white/52 transition hover:text-white sm:text-[13.5px]"
                    >
                      <span className="h-px w-0 shrink-0 bg-[#00E575] transition-all duration-300 group-hover:w-2.5" />
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom legal strip */}
        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/[0.06] pt-7 sm:mt-16 sm:flex-row sm:items-center sm:pt-8">
          <p className="text-[11px] tracking-wide text-white/28">
            © {YEAR} Plazore
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/32">
            <Link href="/help" className="transition hover:text-white/65">
              Privacy
            </Link>
            <Link href="/help" className="transition hover:text-white/65">
              Terms
            </Link>
            <Link href="/help" className="transition hover:text-white/65">
              Help
            </Link>
            <Link href="/contact" className="transition hover:text-white/65">
              Contact
            </Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .pf-light {
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.35),
            transparent
          );
          box-shadow: 0 0 40px 8px rgba(0, 229, 117, 0.06);
        }
        .pf-glow-a {
          background: radial-gradient(
            ellipse at center,
            rgba(0, 229, 117, 0.11),
            transparent 68%
          );
          filter: blur(56px);
          transform: translateZ(0);
          animation: pfDriftA 22s ease-in-out infinite alternate;
          will-change: transform;
        }
        .pf-glow-b {
          background: radial-gradient(
            ellipse at center,
            rgba(59, 130, 246, 0.1),
            transparent 68%
          );
          filter: blur(60px);
          transform: translateZ(0);
          animation: pfDriftB 26s ease-in-out infinite alternate;
          will-change: transform;
        }
        @keyframes pfDriftA {
          from {
            transform: translate3d(0, 0, 0);
          }
          to {
            transform: translate3d(2.5%, 3%, 0);
          }
        }
        @keyframes pfDriftB {
          from {
            transform: translate3d(0, 0, 0);
          }
          to {
            transform: translate3d(-3%, -2.5%, 0);
          }
        }
        .pf-in {
          animation: pfReveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes pfReveal {
          from {
            opacity: 0;
            transform: translate3d(0, 10px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        /* Soft jiggle — non-sellers only, pauses between cycles */
        .pf-jiggle {
          animation: pfJiggle 3.2s ease-in-out infinite;
          transform-origin: center center;
          will-change: transform;
        }
        @keyframes pfJiggle {
          0%,
          78%,
          100% {
            transform: rotate(0deg) translate3d(0, 0, 0);
          }
          82% {
            transform: rotate(-1.6deg) translate3d(-1px, 0, 0);
          }
          86% {
            transform: rotate(1.5deg) translate3d(1px, 0, 0);
          }
          90% {
            transform: rotate(-1deg) translate3d(-0.5px, 0, 0);
          }
          94% {
            transform: rotate(0.6deg) translate3d(0.5px, 0, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .pf-glow-a,
          .pf-glow-b,
          .pf-jiggle {
            animation: none !important;
          }
          .pf-in {
            animation: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>
    </footer>
  );
}