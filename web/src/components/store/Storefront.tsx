"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bookmark, CheckCircle, ChevronLeft, MapPin, Store } from "lucide-react";
import { AppFeaturePrompt, type AppFeature } from "@/components/app/AppFeaturePrompt";
import type { StorePublic } from "@/lib/api";
import { formatProductPrice } from "@/lib/regions";
import type { Product } from "@/lib/types";

export function Storefront({
  store,
  products,
}: {
  store: StorePublic;
  products: Product[];
}) {
  const router = useRouter();
  const [featured, setFeatured] = useState(0);
  const [descOpen, setDescOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [prompt, setPrompt] = useState<AppFeature | null>(null);

  const locationLabel = [store.location?.state, store.location?.country]
    .filter(Boolean)
    .join(", ");

  useEffect(() => {
    if (products.length <= 1) return;
    const t = setInterval(() => {
      setFeatured((i) => (i + 1) % products.length);
    }, 7000);
    return () => clearInterval(t);
  }, [products.length]);

  const current = products[featured];

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="relative h-[34vh] min-h-[240px] max-h-[320px] bg-[#07080C] md:h-[42vh] md:max-h-[420px]">
        {store.storeBanner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={store.storeBanner} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-slate-900 to-bg" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-bg/20 via-transparent to-bg/90" />
        <button
          onClick={() => router.back()}
          className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-bg/45"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="relative z-10 mx-auto -mt-9 max-w-6xl px-5 pb-20 md:px-8">
        <div className="overflow-hidden rounded-[26px] border border-white/8 bg-[#11141A]/95 p-[18px] md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start">
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-line bg-surface-2 md:h-24 md:w-24">
              {store.storeLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.storeLogo} alt="" className="h-full w-full object-cover" />
              ) : (
                <Store className="h-8 w-8 text-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight md:text-3xl">{store.storeName}</h1>
                {store.isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ai-green/12 px-2 py-0.5 text-[10px] font-bold text-ai-green">
                    <CheckCircle className="h-3 w-3" /> Verified
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs tracking-wide text-muted">Explore this store</p>
              {locationLabel && (
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-secondary">
                  <MapPin className="h-3.5 w-3.5 text-muted" />
                  {locationLabel}
                </p>
              )}
            </div>
          </div>

          {store.storeDescription && (
            <div className="mt-4">
              <p className={`text-[14.5px] leading-[22px] text-secondary ${descOpen ? "" : "line-clamp-3"}`}>
                {store.storeDescription}
              </p>
              {store.storeDescription.length > 110 && (
                <button onClick={() => setDescOpen((v) => !v)} className="mt-1.5 text-[13px] font-semibold text-ai-green">
                  {descOpen ? "See less" : "See more"}
                </button>
              )}
            </div>
          )}

          {store.businessGoal && (
            <div className="mt-3.5 rounded-2xl border border-white/6 bg-white/[0.03] px-3.5 py-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Our goal</p>
              <p className={`text-sm leading-5 ${goalOpen ? "" : "line-clamp-2"}`}>{store.businessGoal}</p>
              {store.businessGoal.length > 80 && (
                <button onClick={() => setGoalOpen((v) => !v)} className="mt-1.5 text-[13px] font-semibold text-ai-green">
                  {goalOpen ? "See less" : "See more"}
                </button>
              )}
            </div>
          )}

          <div className="mt-[18px] flex items-center gap-2.5">
            <button
              onClick={() => setPrompt("saved_store")}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-surface-2 py-3.5 text-sm font-bold"
            >
              <Bookmark className="h-4 w-4" />
              Save store
            </button>
            <span className="rounded-2xl border border-white/7 bg-white/[0.04] px-3.5 py-3.5 text-[13px] font-semibold text-secondary">
              {products.length} products
            </span>
          </div>
        </div>

        {products.length > 0 && (
          <section className="mt-9">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Featured</p>
            <p className="mt-1 text-xl font-bold tracking-tight">A closer look</p>

            <Link href={`/product/${current._id}`} className="mt-4 block overflow-hidden rounded-[24px] border border-white/8 bg-surface">
              <div className="relative aspect-[4/5] md:aspect-[16/9]">
                {current.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current.images[0]} alt={current.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full bg-surface-2" />
                )}
                <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-bg to-transparent" />
                <div className="absolute inset-x-[18px] bottom-[18px]">
                  <p className="text-[17px] font-bold leading-snug">{current.name}</p>
                  <p className="mt-1.5 text-xl font-extrabold tracking-tight">
                    {formatProductPrice(Number(current.price), current.region || store.location?.country || "NG", "NG")}
                  </p>
                </div>
              </div>
            </Link>

            {products.length > 1 && (
              <div className="mt-4 flex justify-center gap-1.5">
                {products.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setFeatured(i)}
                    className={`h-[5px] rounded-full ${i === featured ? "w-[18px] bg-ai-green" : "w-1.5 bg-white/20"}`}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <section className="mt-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">The store</p>
          <p className="mt-1 text-xl font-bold tracking-tight">Explore the collection</p>
          <div className="my-[18px] flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted">All products</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          {products.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-secondary">
                This storefront is still being set up.
                <br />
                Check back soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <Link key={p._id} href={`/product/${p._id}`} className="overflow-hidden rounded-[18px] border border-white/6 bg-surface">
                  <div className="aspect-[1/1.15] bg-surface-2">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="px-3 pb-3 pt-2.5">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-[18px]">{p.name}</p>
                    <p className="mt-1.5 text-[14.5px] font-extrabold">
                      {formatProductPrice(Number(p.price), p.region || store.location?.country || "NG", "NG")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-10 mb-2 flex flex-col items-center">
          <span className="mb-3.5 h-[3px] w-9 rounded-sm bg-line" />
          <p className="text-[11px] tracking-widest text-muted">Plazore · Digital Mall</p>
        </footer>
      </div>

      <AppFeaturePrompt feature={prompt} onClose={() => setPrompt(null)} />
    </div>
  );
}

export function StoreMissing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-8 text-center text-text">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface">
        <Store className="h-7 w-7 text-muted" />
      </span>
      <p className="mt-[18px] text-[17px] font-bold">Store not found</p>
      <p className="mt-2 text-sm leading-[21px] text-secondary">
        This store is not reliable right now, check back soon.
      </p>
      <Link href="/" className="mt-6 rounded-full bg-text px-6 py-3 text-[13px] font-bold text-bg">
        Go back
      </Link>
    </div>
  );
}