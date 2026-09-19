"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQRCode } from "next-qrcode";
import { ArrowRight, Download, Home } from "lucide-react";
import {
  APP_DOWNLOAD_AVAILABLE,
  getApkDownloadUrl,
  getDownloadPageUrl,
} from "@/lib/appDownload";

/* ─── tokens ─── */
const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";
const GRAD_SOFT =
  "linear-gradient(135deg, rgba(0,229,117,0.18), rgba(20,184,166,0.12), rgba(59,130,246,0.14))";

/* ─── assets (do not rename) ─── */
const SHOTS = {
  welcome: "/welcoming.png",
  home: "/home-page.png",
  showroom: "/showroom.jpg",
  product: "/product-page.jpg",
  dashboard: "/dashboard-page.jpg",
  ai: "/plazore-ai.jpg",
} as const;

const DISCOVERY_VIDEO = "/discovery.mp4";

/* ─── scroll reveal ─── */
function useInView<T extends HTMLElement>(opts?: {
  threshold?: number;
  once?: boolean;
}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const once = opts?.once ?? true;

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
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold: opts?.threshold ?? 0.18, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [opts?.threshold, once]);

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

/* ─── annotation ─── */
type Callout = {
  n: number;
  label: string;
  top: string;
  left: string;
  side?: "left" | "right";
};

function CalloutMarkers({
  callouts,
  inView,
}: {
  callouts: Callout[];
  inView: boolean;
}) {
  return (
    <>
      {callouts.map((c, i) => (
        <div
          key={c.n}
          className="pointer-events-none absolute z-10 transition-all duration-700 ease-out"
          style={{
            top: c.top,
            left: c.left,
            opacity: inView ? 1 : 0,
            transform: inView ? "scale(1)" : "scale(0.6)",
            transitionDelay: inView ? `${180 + i * 90}ms` : "0ms",
          }}
        >
          <div className="relative flex items-center gap-2">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-[#041412] shadow-[0_0_0_3px_rgba(9,11,15,0.85)]"
              style={{ backgroundImage: GRAD }}
            >
              {c.n}
            </span>
            <span
              className={`
                max-w-[140px] rounded-md border border-white/15 bg-[#0B0C12]/92 px-2 py-1
                text-[10px] font-semibold leading-snug text-[#F5F7FA] backdrop-blur-md
                sm:max-w-[160px] sm:text-[11px]
                ${c.side === "left" ? "-translate-x-[calc(100%+8px)]" : ""}
              `}
            >
              {c.label}
            </span>
          </div>
        </div>
      ))}
    </>
  );
}

function AnnotatedShot({
  src,
  alt,
  callouts,
  priority,
}: {
  src: string;
  alt: string;
  callouts: Callout[];
  priority?: boolean;
}) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.2 });

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[340px] sm:max-w-[380px]">
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] opacity-60 blur-2xl"
        style={{ background: GRAD_SOFT }}
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-[28px] border border-white/[0.1] bg-[#0B0C12] shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
        <Image
          src={src}
          alt={alt}
          width={760}
          height={1520}
          priority={priority}
          className="h-auto w-full object-cover object-top"
          sizes="(max-width: 640px) 90vw, 380px"
        />
        <CalloutMarkers callouts={callouts} inView={inView} />
      </div>
    </div>
  );
}

function AnnotatedDiscoveryVideo({
  callouts,
  poster,
}: {
  callouts: Callout[];
  poster?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.15 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || failed) return;
    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute("muted", "");
    el.playsInline = true;
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");

    const tryPlay = () => {
      if (inView) el.play().catch(() => {});
      else el.pause();
    };
    tryPlay();
    el.addEventListener("loadeddata", tryPlay);
    return () => el.removeEventListener("loadeddata", tryPlay);
  }, [failed, inView]);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[340px] sm:max-w-[380px]">
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] opacity-60 blur-2xl"
        style={{ background: GRAD_SOFT }}
        aria-hidden
      />
      <div className="relative aspect-[9/19] overflow-hidden rounded-[28px] border border-white/[0.1] bg-[#0B0C12] shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
        {!failed ? (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover object-top"
            src={DISCOVERY_VIDEO}
            poster={poster}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            controls={false}
            disablePictureInPicture
            onError={() => setFailed(true)}
            aria-label="Plazore discovery experience"
          />
        ) : (
          <Image
            src={poster || SHOTS.home}
            alt="Plazore home"
            width={760}
            height={1520}
            className="h-full w-full object-cover object-top"
            sizes="(max-width: 640px) 90vw, 380px"
          />
        )}
        <CalloutMarkers callouts={callouts} inView={inView} />
      </div>
    </div>
  );
}

/* ─── CTAs ─── */
/** Mobile-first gradient primary; desktop can pass className for width */
function DownloadCta({
  className = "",
  variant = "default",
}: {
  className?: string;
  /** "hero" = full-width gradient emphasis (mobile landing) */
  variant?: "default" | "hero";
}) {
  const apk = getApkDownloadUrl();
  const available = APP_DOWNLOAD_AVAILABLE && !!apk;
  const hero =
    variant === "hero"
      ? "h-14 w-full rounded-xl text-[15px] shadow-[0_12px_40px_rgba(0,229,117,0.25)]"
      : "h-12 w-full sm:w-auto";

  if (available) {
    return (
      <a
        href={apk!}
        download
        className={`inline-flex items-center justify-center gap-2.5 px-6 font-extrabold tracking-wide text-[#041412] transition hover:brightness-110 ${hero} ${className}`}
        style={{ backgroundImage: GRAD }}
      >
        <Download className="h-5 w-5 shrink-0" aria-hidden />
        Download the Plazore App
      </a>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={`inline-flex cursor-not-allowed items-center justify-center gap-2.5 px-6 font-extrabold tracking-wide text-[#041412]/70 ${hero}`}
        style={{ backgroundImage: GRAD, opacity: 0.85 }}
      >
        <Download className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
        Download the Plazore App
      </button>
      <p className="mt-2.5 text-center text-[11px] font-medium tracking-wide text-[#00E575]/90 sm:text-left">
        The Plazore App is coming shortly.
      </p>
    </div>
  );
}

function LearnMoreLink({
  children = "Learn more",
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href="/about"
      className={`inline-flex items-center gap-1.5 text-[13px] font-bold tracking-wide text-white/70 transition hover:text-white ${className}`}
    >
      <span>{children}</span>
      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
    </Link>
  );
}

/* ─── QR (desktop only) ─── */
function QrBlock({ size = 168 }: { size?: number }) {
  const { Canvas } = useQRCode();
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(getDownloadPageUrl());
  }, []);

  if (!url) {
    return (
      <div
        className="animate-pulse rounded-2xl bg-white/10"
        style={{ width: size + 32, height: size + 80 }}
      />
    );
  }

  return (
    <div className="flex flex-col items-center">
      <p
        className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em]"
        style={{
          backgroundImage: GRAD,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        Scan to get Plazore
      </p>
      <div
        className="rounded-2xl border border-white/15 bg-white p-4 shadow-[0_16px_48px_rgba(0,0,0,0.45),0_0_0_1px_rgba(0,229,117,0.12)]"
        role="img"
        aria-label={`QR code to open ${url} on your phone`}
      >
        <Canvas
          text={url}
          options={{
            errorCorrectionLevel: "M",
            margin: 1,
            scale: 5,
            width: size,
            color: { dark: "#090B0F", light: "#FFFFFF" },
          }}
        />
      </div>
      <p className="mt-3 max-w-[24ch] text-center text-[11px] leading-relaxed text-white/45">
        Point your phone camera here to open the app download page.
      </p>
    </div>
  );
}

/* ─── section shells ─── */
function SectionCopy({
  kicker,
  title,
  body,
  align = "left",
}: {
  kicker?: string;
  title: string;
  body: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      {kicker ? (
        <p
          className="text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{
            backgroundImage: GRAD,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {kicker}
        </p>
      ) : null}
      <h2 className="mt-3 font-display text-[26px] font-bold leading-[1.15] tracking-tight text-[#F5F7FA] sm:text-[32px]">
        {title}
      </h2>
      <p
        className={`mt-4 text-[15px] leading-[1.7] text-[#A7ADB8] ${
          align === "center" ? "mx-auto max-w-[42ch]" : "max-w-[40ch]"
        }`}
      >
        {body}
      </p>
    </div>
  );
}

/* ─── PAGE ─── */
export default function DownloadPage() {
  /**
   * Viewport-based device context (reliable for layout).
   * lg+ = desktop/laptop canvas → QR on hero.
   * < lg = phone → gradient download + image, no QR.
   */
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const discoveryCallouts: Callout[] = [
    { n: 1, label: "Explore beyond the search bar", top: "10%", left: "12%" },
    { n: 2, label: "Discover products naturally", top: "42%", left: "14%" },
    { n: 3, label: "Find what's next on Plazore", top: "90%", left: "40%" },
  ];

  return (
    <div className="min-h-dvh bg-[#090B0F] text-[#F5F7FA]">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#090B0F]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Plazore home">
            <Image
              src="/logo.png"
              alt="Plazore"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              priority
            />
            <span className="font-display text-[15px] font-bold tracking-tight">
              Plazore
            </span>
          </Link>
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center border border-white/10 bg-[#11141A] text-white/60 transition hover:border-white/20 hover:text-white"
            aria-label="Home"
          >
            <Home className="h-4 w-4" />
          </Link>
        </div>
      </header>

            {/* ═══════ HERO — device-aware ═══════ */}
      <section className="relative overflow-hidden border-b border-white/[0.05]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 70% 20%, rgba(0,229,117,0.12), transparent 55%), radial-gradient(ellipse 60% 40% at 20% 80%, rgba(59,130,246,0.1), transparent 50%)",
          }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
          {/* ── MOBILE / TABLET: text → gradient download → image · NO QR ── */}
          <div className="lg:hidden">
            <Reveal>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.22em]"
                style={{
                  backgroundImage: GRAD,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                Plazore App
              </p>
              <h1 className="mt-4 font-display text-[34px] font-bold leading-[1.08] tracking-tight text-[#F5F7FA]">
                The new way to shop and earn.
              </h1>
              <p className="mt-4 max-w-[36ch] text-[15px] leading-[1.7] text-[#A7ADB8]">
                Plazore is a Digital Mall built to change how
                people discover, buy and sell goods.
              </p>
            </Reveal>
            <Reveal delay={80} className="mt-8 flex flex-col gap-3">
              <DownloadCta variant="hero" />
              <LearnMoreLink className="h-11 justify-center border border-white/10 bg-transparent px-4" />
            </Reveal>
            <Reveal delay={140} className="mt-12">
              <AnnotatedShot
                src={SHOTS.home}
                alt="Plazore home screen"
                priority
                callouts={[
                  { n: 1, label: "Discovery surface", top: "12%", left: "8%" },
                  { n: 2, label: "Product rails", top: "48%", left: "10%" },
                  { n: 3, label: "Navigation", top: "88%", left: "42%" },
                ]}
              />
            </Reveal>
          </div>

          {/* ── DESKTOP / LAPTOP: copy · QR center (dominant) · app visual ── */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-12 items-center gap-6 xl:gap-8">
              {/* Left — copy */}
              <div className="col-span-4">
                <Reveal>
                  <p
                    className="text-[11px] font-bold uppercase tracking-[0.22em]"
                    style={{
                      backgroundImage: GRAD,
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    Plazore App
                  </p>
                  <h1 className="mt-5 font-display text-[36px] font-bold leading-[1.08] tracking-tight text-[#F5F7FA] xl:text-[42px]">
                    The new way to shop and earn.
                  </h1>
                  <p className="mt-5 max-w-[34ch] text-[15px] leading-[1.7] text-[#A7ADB8]">
                    Plazore is a Digital Mall built to change
                    how people discover, buy and sell goods.
                  </p>
                </Reveal>
                <Reveal delay={100} className="mt-8">
                  <LearnMoreLink className="h-12 items-center border border-white/10 px-5" />
                </Reveal>
              </div>

              {/* Center — dominant QR */}
              <div className="col-span-4 flex justify-center">
                <Reveal delay={60}>
                  <div
                    className="
                      relative flex flex-col items-center
                      rounded-[28px] border border-white/[0.12]
                      bg-[#0B0C12]/90 px-8 py-9
                      shadow-[0_24px_80px_rgba(0,0,0,0.5)]
                      backdrop-blur-md
                    "
                  >
                    {/* gradient ring accent */}
                    <div
                      className="pointer-events-none absolute -inset-px rounded-[28px] opacity-80"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(0,229,117,0.35), rgba(20,184,166,0.15), rgba(59,130,246,0.35))",
                        mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                        maskComposite: "exclude",
                        WebkitMaskComposite: "xor",
                        padding: "1px",
                      }}
                      aria-hidden
                    />
                    <div
                      className="pointer-events-none absolute -inset-8 -z-10 rounded-full opacity-50 blur-3xl"
                      style={{ background: GRAD_SOFT }}
                      aria-hidden
                    />
                    <QrBlock size={200} />
                  </div>
                </Reveal>
              </div>

              {/* Right — app visual */}
              <div className="col-span-4 flex justify-end">
                <Reveal delay={100}>
                  <AnnotatedShot
                    src={SHOTS.welcome}
                    alt="Plazore welcome screen"
                    priority
                    callouts={[
                      { n: 1, label: "Your gateway to Plazore", top: "12%", left: "8%" },
                      { n: 2, label: "Discover, shop and explore", top: "48%", left: "10%" },
                      { n: 3, label: "Everything commerce, in one place", top: "88%", left: "42%" },
                    ]}
                  />
                </Reveal>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ 01 DISCOVERY — video loop ═══════ */}
      <section className="border-b border-white/[0.05] py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <SectionCopy
              kicker="01 · Home"
              title="Discover commerce differently."
              body="Plazore puts discovery at the center of the commerce experience, helping people encounter products and businesses rather than relying only on traditional search."
            />
            <div className="mt-8">
              <LearnMoreLink />
            </div>
          </Reveal>
          <Reveal delay={100}>
            <AnnotatedDiscoveryVideo
              callouts={discoveryCallouts}
              poster={SHOTS.home}
            />
          </Reveal>
        </div>
      </section>

      {/* ═══════ 02 SHOWROOM ═══════ */}
      <section className="border-b border-white/[0.05] py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <Reveal className="order-2 lg:order-1">
            <AnnotatedShot
              src={SHOTS.showroom}
              alt="Plazore Showroom"
              callouts={[
                { n: 1, label: "Discover what's happening across Plazore", top: "22%", left: "10%" },
                { n: 2, label: "Move naturally from discovery to commerce", top: "48%", left: "18%" },
              ]}
            />
          </Reveal>
          <Reveal delay={80} className="order-1 lg:order-2">
            <SectionCopy
              kicker="02 · Plazore"
              title="A new way to experience commerce."
              body="Plazore brings buying, selling, and product discovery into one connected commerce experience — designed to feel less like browsing a catalog and more like entering a marketplace built around how people actually explore."
            />
            <div className="mt-8">
              <LearnMoreLink />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ 03 PRODUCT ═══════ */}
      <section className="border-b border-white/[0.05] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionCopy
              align="center"
              kicker="03 · Product"
              title="Understand what you're buying."
              body="The product experience brings the information, seller context and commerce controls together before the purchase decision."
            />
            <div className="mt-6 flex justify-center">
              <LearnMoreLink />
            </div>
          </Reveal>
          <Reveal delay={100} className="mt-14">
            <AnnotatedShot
              src={SHOTS.product}
              alt="Plazore product page"
              callouts={[
                { n: 1, label: "Product imagery", top: "20%", left: "12%" },
                { n: 2, label: "Name, Price & Availability", top: "55%", left: "14%" },
                { n: 4, label: "Purchase controls", top: "76%", left: "3%" },
              ]}
            />
          </Reveal>
        </div>
      </section>

      {/* ═══════ 04 DASHBOARD ═══════ */}
      <section className="border-b border-white/[0.05] py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <SectionCopy
              kicker="04 · Seller"
              title="One platform. Both sides of commerce."
              body="Plazore gives sellers a dedicated commerce environment for managing products, orders and activity while participating in the same marketplace buyers explore."
            />
            <div className="mt-8">
              <LearnMoreLink />
            </div>
          </Reveal>
          <Reveal delay={100}>
            <AnnotatedShot
              src={SHOTS.dashboard}
              alt="Plazore seller dashboard"
              callouts={[
                { n: 1, label: "Activity overview", top: "20%", left: "10%" },
                { n: 2, label: "Orders & products", top: "50%", left: "5%" },
                { n: 3, label: "Seller tools", top: "64%", left: "64%" },
              ]}
            />
          </Reveal>
        </div>
      </section>

      {/* ═══════ 05 PLAZORE AI ═══════ */}
      <section className="border-b border-white/[0.05] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionCopy
              align="center"
              kicker="05 · Intelligence"
              title="Commerce without the guesswork."
              body="Plazore uses product intelligence and real commerce activity to help people understand products and commerce activity more clearly."
            />
            <div className="mt-6 flex justify-center">
              <LearnMoreLink />
            </div>
          </Reveal>
          <Reveal delay={100} className="mt-14">
            <AnnotatedShot
              src={SHOTS.ai}
              alt="Plazore AI product intelligence"
              callouts={[
                { n: 1, label: "Product intelligence", top: "14%", left: "10%" },
                { n: 2, label: "Signal from activity", top: "46%", left: "12%" },
                { n: 3, label: "Clearer context", top: "64%", left: "56%" },
              ]}
            />
          </Reveal>
        </div>
      </section>

      {/* ═══════ ABOUT TRANSITION ═══════ */}
      <section className="border-b border-white/[0.05] py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Reveal>
            <h2 className="font-display text-[28px] font-bold tracking-tight text-[#F5F7FA] sm:text-[34px]">
              There&apos;s more to Plazore.
            </h2>
            <p className="mx-auto mt-4 max-w-[40ch] text-[15px] leading-[1.7] text-[#A7ADB8]">
              Explore the thinking, technology and ideas behind the platform.
            </p>
            <Link
              href="/about"
              className="mt-8 inline-flex h-12 items-center justify-center gap-2 px-6 text-[13px] font-extrabold tracking-wide text-[#041412]"
              style={{ backgroundImage: GRAD }}
            >
              Learn more about Plazore
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Reveal>
        </div>
      </section>

            {/* ═══════ FINAL ═══════ */}
      <section className="border-t border-white/[0.05] py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <Reveal>
            <h2 className="text-center font-display text-[30px] font-bold tracking-tight text-[#F5F7FA] sm:text-[40px]">
              Do commerce like it&apos;s 2040.
            </h2>

            {/* ── MOBILE: gradient download · no QR ── */}
            <div className="mt-10 flex flex-col items-center gap-4 lg:hidden">
              <div className="w-full max-w-sm">
                <DownloadCta variant="hero" />
              </div>
              <LearnMoreLink className="h-12 items-center border border-white/10 px-5" />
            </div>

            {/* ── DESKTOP: QR dead-center & dominant ── */}
            <div className="mt-12 hidden lg:block">
              <div className="flex flex-col items-center">
                <div
                  className="
                    relative flex flex-col items-center
                    rounded-[28px] border border-white/[0.12]
                    bg-[#0B0C12]/90 px-10 py-10
                    shadow-[0_28px_90px_rgba(0,0,0,0.55)]
                    backdrop-blur-md
                  "
                >
                  <div
                    className="pointer-events-none absolute -inset-px rounded-[28px] opacity-90"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(0,229,117,0.4), rgba(20,184,166,0.18), rgba(59,130,246,0.4))",
                      mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                      maskComposite: "exclude",
                      WebkitMaskComposite: "xor",
                      padding: "1px",
                    }}
                    aria-hidden
                  />
                  <div
                    className="pointer-events-none absolute -inset-12 -z-10 rounded-full opacity-55 blur-3xl"
                    style={{ background: GRAD_SOFT }}
                    aria-hidden
                  />
                  <QrBlock size={220} />
                </div>

                <p className="mt-6 max-w-[28ch] text-center text-[13px] leading-relaxed text-white/45">
                  Scan with your phone to open the Plazore download page and get
                  the app.
                </p>

                <div className="mt-8">
                  <LearnMoreLink className="h-12 items-center border border-white/10 px-5" />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-white/[0.05] py-8 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">
          Digital Mall
        </p>
      </footer>
    </div>
  );
}