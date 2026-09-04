"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AppFeaturePrompt, type AppFeature } from "@/components/app/AppFeaturePrompt";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Bookmark,
  CheckCircle,
  ChevronLeft,
  Copy,
  Link2,
  MapPin,
  Flag,
  MessageCircle,
  Share2,
  Store,
  X,
} from "lucide-react";
import type { StorePublic } from "@/lib/api";
import { useMarketplace } from "@/context/MarketplaceContext";
import { DEFAULT_REGION, formatProductPrice } from "@/lib/regions";
import type { Product } from "@/lib/types";

const FEATURED_MS = 7000;

function storeKey(store: StorePublic) {
  return String(
    (store as { _id?: string; id?: string })._id ||
      (store as { id?: string }).id ||
      ""
  );
}

function ChromeBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black/45 text-white backdrop-blur-md"
    >
      {children}
    </button>
  );
}

function BrandMark({ brand }: { brand: "whatsapp" | "x" | "telegram" | "facebook" }) {
  const box = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full";
  if (brand === "whatsapp") {
    return (
      <span className={`${box} bg-[#25D366]`}>
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </span>
    );
  }
  if (brand === "x") {
    return (
      <span className={`${box} border border-white/15 bg-black`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.242 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
        </svg>
      </span>
    );
  }
  if (brand === "telegram") {
    return (
      <span className={`${box} bg-[#229ED9]`}>
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-white">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.15 1.568-.769 5.233-1.087 6.943-.134.72-.401 1.856-.66 1.864-.248.009-.479-.34-.753-.666-.43-.512-2.141-1.447-3.56-2.427-1.378-.95-.486-1.47.302-2.32.206-.223 3.768-3.455 3.836-3.75.008-.033.017-.17-.062-.241s-.182-.041-.261-.024c-.111.025-1.879 1.194-5.304 3.505-.502.344-.956.512-1.363.504-.448-.008-1.311-.253-1.951-.46-.786-.254-1.41-.389-1.357-.652.028-.137.325-.277.893-.42 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`${box} bg-[#1877F2]`}>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-white">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    </span>
  );
}

export function Storefront({
  store,
  products,
}: {
  store: StorePublic;
  products: Product[];
}) {
  const router = useRouter();
  const { region: marketplaceRegion } = useMarketplace();
  const displayRegion = marketplaceRegion || DEFAULT_REGION;

  const [featured, setFeatured] = useState(0);
  const [descOpen, setDescOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prompt, setPrompt] = useState<AppFeature | null>(null);
  const { isSignedIn, isLoaded } = useAuth();
const [authOpen, setAuthOpen] = useState(false);

  const id = storeKey(store);
  const locationLabel = [store.location?.state, store.location?.country]
    .filter(Boolean)
    .join(", ");
  const current = products[featured];
  const storeUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/store/${id}`
      : `/store/${id}`;
  const shareText = `Shop ${store.storeName} on Plazore — a clean storefront, real products, no guesswork.`;

  const priceOf = (p: Product) =>
    formatProductPrice(Number(p.price) || 0, p.region, displayRegion);

  useEffect(() => {
    if (products.length <= 1) return;
    const t = setInterval(() => {
      setFeatured((i) => (i + 1) % products.length);
    }, FEATURED_MS);
    return () => clearInterval(t);
  }, [products.length]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const shareNative = async () => {
    setShareBusy(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: store.storeName,
          text: `${shareText}\n${storeUrl}`,
          url: storeUrl,
        });
        setShareOpen(false);
        return;
      }
      await copyLink();
    } catch {
      /* cancelled */
    } finally {
      setShareBusy(false);
    }
  };

  const openExternal = (kind: "whatsapp" | "x" | "telegram" | "facebook") => {
    const u = encodeURIComponent(storeUrl);
    const t = encodeURIComponent(`${shareText} ${storeUrl}`);
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${t}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${u}`,
      telegram: `https://t.me/share/url?url=${u}&text=${encodeURIComponent(shareText)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    };
    window.open(urls[kind], "_blank", "noopener,noreferrer");
  };

  const featuredCard = current ? (
    <Link
      href={`/product/${current._id}`}
      className="block overflow-hidden rounded-[24px] border border-white/8 bg-[#11141A]"
    >
      <div className="relative aspect-[4/5] lg:aspect-[16/10]">
        {current.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.images[0]} alt={current.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full bg-[#171B22]" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#090B0F] to-transparent" />
        <div className="absolute inset-x-[18px] bottom-[18px]">
          <p className="text-[17px] font-bold leading-snug">{current.name}</p>
          <p className="mt-1.5 text-xl font-extrabold tracking-tight">{priceOf(current)}</p>
        </div>
      </div>
    </Link>
  ) : null;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#090B0F] text-[#F5F7FA]">
      {/* Banner */}
      <div className="relative h-[34vh] min-h-[220px] max-h-[280px] bg-[#07080C] lg:h-[42vh] lg:max-h-[420px]">
        {store.storeBanner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={store.storeBanner} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-slate-900 via-[#090B0F] to-[#111827]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#090B0F]/20 via-transparent to-[#090B0F]/90" />

        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] lg:px-8">
          <ChromeBtn onClick={() => router.back()} label="Back">
            <ChevronLeft className="h-5 w-5" />
          </ChromeBtn>
          <ChromeBtn onClick={() => setShareOpen(true)} label="Share store">
            <Share2 className="h-[15px] w-[15px]" strokeWidth={2.25} />
          </ChromeBtn>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-9 w-full max-w-6xl px-5 pb-16 sm:px-6 lg:-mt-12 lg:px-8">
        <div className="overflow-hidden rounded-[26px] border border-white/8 bg-[#11141A]/95 p-[18px] lg:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-[#252A33] bg-[#171B22] lg:h-24 lg:w-24">
              {store.storeLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.storeLogo} alt="" className="h-full w-full object-cover" />
              ) : (
                <Store className="h-8 w-8 text-[#737A86]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight lg:text-3xl">
                  {store.storeName}
                </h1>
                {store.isVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#10B981]/12 px-2 py-0.5 text-[10px] font-bold text-[#10B981]">
                    <CheckCircle className="h-3 w-3" /> Verified
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs tracking-wide text-[#737A86]">Explore this store</p>
              {locationLabel ? (
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-[#A7ADB8]">
                  <MapPin className="h-3.5 w-3.5 text-[#737A86]" />
                  {locationLabel}
                </p>
              ) : null}
            </div>
          </div>

          {store.storeDescription ? (
            <div className="mt-4">
              <p
                className={`text-[14.5px] leading-[22px] text-[#A7ADB8] ${
                  descOpen ? "" : "line-clamp-3"
                }`}
              >
                {store.storeDescription}
              </p>
              {store.storeDescription.length > 110 ? (
                <button
                  type="button"
                  onClick={() => setDescOpen((v) => !v)}
                  className="mt-1.5 text-[13px] font-semibold text-[#10B981]"
                >
                  {descOpen ? "See less" : "See more"}
                </button>
              ) : null}
            </div>
          ) : null}

          {store.businessGoal ? (
            <div className="mt-3.5 rounded-2xl border border-white/6 bg-white/[0.03] px-3.5 py-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#737A86]">
                Our goal
              </p>
              <p className={`text-sm leading-5 ${goalOpen ? "" : "line-clamp-2"}`}>
                {store.businessGoal}
              </p>
              {store.businessGoal.length > 80 ? (
                <button
                  type="button"
                  onClick={() => setGoalOpen((v) => !v)}
                  className="mt-1.5 text-[13px] font-semibold text-[#10B981]"
                >
                  {goalOpen ? "See less" : "See more"}
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Save = app-only prompt */}
          <div className="mt-[18px] flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPrompt("saved_stores")}
              aria-label="Save store"
              className="flex h-12 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-[13px] font-semibold text-[#F5F7FA]"
            >
              <Bookmark className="h-4 w-4 text-[#D4A853]" strokeWidth={2.2} />
              Save store
            </button>
            <span className="rounded-2xl border border-white/7 bg-white/[0.04] px-3.5 py-3.5 text-[13px] font-semibold text-[#A7ADB8]">
              {products.length} products
            </span>
          </div>
        </div>

        {products.length > 0 ? (
          <section className="mt-9">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#737A86]">
              Featured
            </p>
            <p className="mt-1 text-xl font-bold tracking-tight">A closer look</p>
            <div className="mt-4">{featuredCard}</div>
            {products.length > 1 ? (
              <div className="mt-4 flex justify-center gap-1.5">
                {products.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setFeatured(i)}
                    className={`h-[5px] rounded-full ${
                      i === featured ? "w-[18px] bg-[#10B981]" : "w-1.5 bg-white/20"
                    }`}
                    aria-label={`Featured ${i + 1}`}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mt-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#737A86]">
            The store
          </p>
          <p className="mt-1 text-xl font-bold tracking-tight">Explore the collection</p>
          <div className="my-[18px] flex items-center gap-3">
            <span className="h-px flex-1 bg-[#252A33]" />
            <span className="text-[10px] uppercase tracking-[0.16em] text-[#737A86]">
              All products
            </span>
            <span className="h-px flex-1 bg-[#252A33]" />
          </div>

          {products.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[#A7ADB8]">
                This storefront is still being set up.
                <br />
                Check back soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <Link
                  key={String(p._id)}
                  href={`/product/${p._id}`}
                  className="overflow-hidden rounded-[18px] border border-white/6 bg-[#11141A]"
                >
                  <div className="aspect-[1/1.15] bg-[#171B22]">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="px-3 pb-3 pt-2.5">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-[18px]">
                      {p.name}
                    </p>
                    <p className="mt-1.5 text-[14.5px] font-extrabold">{priceOf(p)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

{/* Support — Contact Store through Plazore + Report Store */}
<section className="mt-10">
  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#737A86]">
    Support
  </p>

  <button
    type="button"
    onClick={() => {
      if (!isLoaded) return;
      if (!isSignedIn) {
        setAuthOpen(true);
        return;
      }
      const q = new URLSearchParams({
        mode: "contact",
        contextType: "store",
        storeId: String(id || ""),
        storeName: String(store.storeName || ""),
      });
      router.push(`/contact?${q.toString()}`);
    }}
    className="mt-3 flex w-full items-center gap-3 rounded-[18px] border border-[#10B981]/25 bg-[#10B981]/[0.06] px-3.5 py-3.5 text-left transition hover:border-[#10B981]/40"
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#10B981]/15">
      <MessageCircle className="h-4 w-4 text-[#10B981]" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[14.5px] font-bold tracking-tight">
        Contact Store through Plazore
      </span>
      <span className="mt-0.5 block text-xs text-[#737A86]">
        Routed through Plazore · not direct seller chat
      </span>
    </span>
    <ChevronLeft className="h-4 w-4 shrink-0 rotate-180 text-[#737A86]" />
  </button>

  <button
    type="button"
    onClick={() => {
      if (!isLoaded) return;
      if (!isSignedIn) {
        setAuthOpen(true);
        return;
      }
      const q = new URLSearchParams({
        mode: "report",
        contextType: "store",
        storeId: String(id || ""),
        storeName: String(store.storeName || ""),
      });
      router.push(`/contact?${q.toString()}`);
    }}
    className="mt-2.5 flex w-full items-center gap-3 rounded-[18px] border border-[#252A33] bg-[#11141A] px-3.5 py-3.5 text-left transition hover:border-white/15"
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#EF4444]/25 bg-[#EF4444]/15">
    <Flag className="h-4 w-4 text-[#EF4444]" />
  </span>
  <span className="min-w-0 flex-1">
    <span className="block text-[14.5px] font-bold tracking-tight text-[#F87171]">
      Report Store
    </span>
    <span className="mt-0.5 block text-xs text-[#F87171]/70">
      Structured report to Plazore moderation
    </span>
  </span>
  <ChevronLeft className="h-4 w-4 shrink-0 rotate-180 text-[#F87171]/80" />
</button>
</section>
        </section>

        <footer className="mb-2 mt-10 flex flex-col items-center">
          <span className="mb-3.5 h-[3px] w-9 rounded-sm bg-[#252A33]" />
          <p className="text-[11px] tracking-widest text-[#737A86]">Plazore · Digital Mall</p>
        </footer>
      </div>

      {/* Share sheet */}
      {shareOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-6">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto border border-white/10 bg-[#11141A] sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3.5">
              <p className="text-[15px] font-bold">Share store</p>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/6"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-white/50" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 px-4 py-5">
              {(
                [
                  { id: "whatsapp" as const, label: "WhatsApp" },
                  { id: "x" as const, label: "X" },
                  { id: "telegram" as const, label: "Telegram" },
                  { id: "facebook" as const, label: "Facebook" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openExternal(item.id)}
                  className="flex flex-col items-center gap-2"
                >
                  <BrandMark brand={item.id} />
                  <span className="text-[11px] font-medium text-white/55">{item.label}</span>
                </button>
              ))}
            </div>
            <div className="space-y-2 border-t border-white/8 px-4 py-3">
              <button
                type="button"
                disabled={shareBusy}
                onClick={shareNative}
                className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-[#171B22] px-4 py-3 text-left text-sm font-semibold"
              >
                <Share2 className="h-4 w-4 text-[#10B981]" />
                {shareBusy ? "Preparing…" : "Share via device"}
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-[#171B22] px-4 py-3 text-left text-sm font-semibold"
              >
                {copied ? (
                  <>
                    <Copy className="h-4 w-4 text-[#10B981]" /> Link copied
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" /> Copy link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {authOpen ? (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-6">
    <div className="w-full max-w-md border border-white/10 bg-[#11141A] sm:rounded-2xl">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <p className="text-[16px] font-extrabold">Continue on Plazore</p>
          <p className="mt-1.5 text-[13px] leading-5 text-white/55">
            Sign in to contact this store or send a report. You’ll return here after.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAuthOpen(false)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/6"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-white/50" />
        </button>
      </div>
      <div className="space-y-2.5 px-5 py-5">
        <Link
          href={`/sign-in?redirect_url=${encodeURIComponent(`/store/${id}`)}`}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-white text-[14px] font-bold text-[#1F1F1F]"
        >
          Sign in
        </Link>
        <Link
          href={`/sign-in?mode=signup&redirect_url=${encodeURIComponent(`/store/${id}`)}`}
          className="flex h-12 w-full items-center justify-center rounded-xl text-[14px] font-bold text-[#00E575]"
        >
          Create a Plazore account
        </Link>
      </div>
    </div>
  </div>
) : null}

      {/* App necessity — Save store */}
      <AppFeaturePrompt feature={prompt} onClose={() => setPrompt(null)} />
    </div>
  );
}

export function StoreMissing() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#090B0F] px-8 text-center text-[#F5F7FA]">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-[#252A33] bg-[#11141A]">
        <Store className="h-7 w-7 text-[#737A86]" />
      </span>
      <p className="mt-[18px] text-[17px] font-bold">Store not found</p>
      <p className="mt-2 text-sm leading-[21px] text-[#A7ADB8]">
        This store is not reliable right now, check back soon.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-[#F5F7FA] px-6 py-3 text-[13px] font-bold text-[#090B0F]"
      >
        Go back
      </Link>
    </div>
  );
}