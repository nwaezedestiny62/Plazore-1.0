"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  FileText,
  Heart,
  MapPin,
  MessageCircle,
  Package,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
} from "lucide-react";
import { AppFeaturePrompt, type AppFeature } from "@/components/app/AppFeaturePrompt";
import { addToCart, cartCount } from "@/lib/cart";
import { fetchProductAI } from "@/lib/api";
import type { PlazoreAIData } from "@/lib/plazoreAI";
import { formatProductPrice } from "@/lib/regions";
import type { Product } from "@/lib/types";

function formatSpecKey(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ExpandableText({
  text,
  lines = 4,
  className,
}: {
  text: string;
  lines?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!text?.trim()) return null;
  return (
    <div>
      <p className={className} style={open ? undefined : {
        display: "-webkit-box",
        WebkitLineClamp: lines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {text}
      </p>
      {text.length > 160 && (
        <button onClick={() => setOpen((v) => !v)} className="mt-2 text-sm font-semibold text-ai-green">
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

function GradientLabel({ children }: { children: string }) {
  return (
    <span
      className="bg-clip-text text-transparent"
      style={{ backgroundImage: "linear-gradient(90deg,#10B981,#14B8A6,#3B82F6)" }}
    >
      {children}
    </span>
  );
}

export function ProductView({ product }: { product: Product }) {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [ai, setAi] = useState<PlazoreAIData | null>(null);
  const [aiReady, setAiReady] = useState(false);
  const [prompt, setPrompt] = useState<AppFeature | null>(null);
  const [bagCount, setBagCount] = useState(0);

  const images = product.images?.length ? product.images : [];
  const seller = typeof product.seller === "object" ? product.seller : null;
  const sellerId =
    seller && "_id" in seller
      ? String(seller._id)
      : typeof product.seller === "string"
        ? product.seller
        : null;

  const ship = (product as Product & { shipping?: Record<string, unknown> }).shipping || {};
  const deliveryFee = Number(ship.deliveryFee) || 0;
  const isSelf = ship.method === "self";
  const courierName = String(ship.courier || ship.courierName || ship.courierCompany || ship.company || "");
  const deliveryMethodLabel = isSelf
    ? "Direct Merchant Delivery"
    : courierName || "Courier Delivery";

  const categoryLabel =
    typeof product.category === "string" ? product.category : product.category?.name;
  const inStock = Number(product.stock) > 0;
  const specs = useMemo(() => {
    const raw = product.specifications;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v != null && String(v).trim()) out[k] = String(v);
    }
    return out;
  }, [product.specifications]);
  const docs = Array.isArray(product.verificationDocuments) ? product.verificationDocuments : [];
  const shipsFrom =
    product.fulfillmentLocation?.displayLabel ||
    [product.fulfillmentLocation?.city, product.fulfillmentLocation?.country].filter(Boolean).join(", ") ||
    null;

  useEffect(() => {
    setBagCount(cartCount());
    const sync = () => setBagCount(cartCount());
    window.addEventListener("plazore-cart", sync);
    return () => window.removeEventListener("plazore-cart", sync);
  }, []);

  useEffect(() => {
    fetchProductAI(product._id).then(setAi);
    const t = setTimeout(() => setAiReady(true), 1800);
    return () => clearTimeout(t);
  }, [product._id]);

  const bag = () => {
    addToCart(product);
    setBagCount(cartCount());
  };

  return (
    <div className="min-h-screen bg-bg pb-28 text-text">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between px-4 md:px-8">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-bg/70"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => setPrompt("wishlist")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-bg/70"
          aria-label="Wishlist"
        >
          <Heart className="h-4 w-4" />
        </button>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 md:px-8 lg:grid-cols-2 lg:items-start">
        <div className="lg:sticky lg:top-16">
          <div className="relative aspect-[4/5] overflow-hidden bg-[#07080C]">
            {images[slide] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[slide]} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted">No image</div>
            )}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlide(i)}
                    className={`h-[3.5px] rounded-full bg-text transition-all ${i === slide ? "w-4 opacity-100" : "w-[5px] opacity-30"}`}
                  />
                ))}
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((src, i) => (
                <button
                  key={src + i}
                  onClick={() => setSlide(i)}
                  className={`h-16 w-16 shrink-0 overflow-hidden border ${i === slide ? "border-text" : "border-line"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pb-8">
          {(product.brand || categoryLabel) && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {product.brand || categoryLabel}
            </p>
          )}
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {product.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[25px] font-bold tracking-tight">
              {formatProductPrice(Number(product.price), product.region, "NG")}
            </p>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                inStock
                  ? "border-ai-blue/30 bg-ai-green/10"
                  : "border-error/30 bg-error/10 text-error"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${inStock ? "bg-ai-green" : "bg-error"}`} />
              {inStock ? <GradientLabel>{`Available · ${product.stock}`}</GradientLabel> : "Unavailable"}
            </span>
          </div>

          {(categoryLabel || product.subCategory) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {categoryLabel && (
                <span className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12.5px] text-secondary">
                  {categoryLabel}
                </span>
              )}
              {product.subCategory && (
                <span className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12.5px] text-muted">
                  {product.subCategory}
                </span>
              )}
            </div>
          )}

          <div className="relative mt-6 overflow-hidden rounded-[20px] border border-ai-green/20 bg-[#11141A]/80">
            {!aiReady ? (
              <div className="flex h-[118px] items-center justify-center">
                <div className="relative h-14 w-14">
                  <span className="absolute inset-0 animate-spin rounded-full border-[2.2px] border-transparent border-l-ai-green border-r-ai-blue border-t-ai-green" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/plazore-ai-logo.png" alt="" className="absolute inset-4 object-contain" />
                </div>
              </div>
            ) : (
              <div className="p-[18px]">
                <div className="mb-1 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/plazore-ai-logo.png" alt="" className="h-[22px] w-[22px] object-contain" />
                  <p className="font-display text-[17px]">Plazore AI</p>
                </div>
                <p className="font-display text-sm text-white/88">Quick AI Insights</p>
                <ExpandableText
                  className="mt-3 text-[15px] leading-6"
                  text={
                    ai?.status === "ready"
                      ? String(ai.summary || "")
                      : "Plazore AI is preparing a thoughtful reading of this listing."
                  }
                />
                {ai?.status === "ready" && ai.highlights?.[0] && (
                  <div className="mt-3.5">
                    <p className="mb-2 text-sm font-bold">Key Points</p>
                    <p className="flex gap-2.5 text-[14.5px] text-secondary">
                      <span
                        className="mt-2 h-[4.5px] w-[4.5px] shrink-0 rounded-full"
                        style={{ backgroundImage: "linear-gradient(90deg,#10B981,#3B82F6)" }}
                      />
                      {ai.highlights[0]}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => setPrompt("ai_deeper")}
                  className="mt-3 flex w-full items-center justify-center gap-1 rounded-full border border-white/13 bg-white/4 py-2.5 text-[13.5px]"
                >
                  See more <ChevronDown className="h-3.5 w-3.5 text-secondary" />
                </button>
              </div>
            )}
          </div>

          <div className="relative mt-4 overflow-hidden rounded-2xl border border-ai-green/20 bg-[#11141A]/70 p-3.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px]"
                style={{ backgroundImage: "linear-gradient(135deg,#10B981,#3B82F6)" }}
              >
                <ShieldCheck className="h-3 w-3 text-white" />
              </span>
              <p className="font-display text-[10px] uppercase tracking-[0.12em]">
                <GradientLabel>Buyer Confidence</GradientLabel>
              </p>
            </div>
            <p className="text-[14.5px] font-bold">
              {ai?.buyerConfidence?.level || "Verified Atelier Standard"}
            </p>
            <ExpandableText
              lines={3}
              className="mt-1 text-[13px] leading-[19px] text-secondary"
              text={
                ai?.confidenceExplanation ||
                "Drawn from merchant verification history, transparent disclosures, and regional standards."
              }
            />
          </div>

          {product.description && (
            <div className="mt-8">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em]">Description</p>
              <ExpandableText className="text-[15.5px] leading-6 text-secondary" text={String(product.description)} />
            </div>
          )}

          {Object.keys(specs).length > 0 && (
            <div className="mt-8 rounded-[20px] border border-line bg-surface p-[18px]">
              <p className="mb-3 text-base font-semibold">Specifications</p>
              {Object.entries(specs).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line py-2.5 last:border-0">
                  <span className="max-w-[40%] text-[13.5px] text-muted">{formatSpecKey(k)}</span>
                  <span className="text-right text-[13.5px] font-medium">{v}</span>
                </div>
              ))}
            </div>
          )}

          {docs.length > 0 && (
            <div className="mt-6 rounded-[20px] border border-line bg-surface p-[18px]">
              <p className="mb-3 text-base font-semibold">Verification Documents</p>
              {docs.map((doc, i) => (
                <a
                  key={`${doc.secureUrl}-${i}`}
                  href={doc.secureUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 border-b border-line py-2.5 last:border-0"
                >
                  <span className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-line bg-surface-2">
                    <FileText className="h-4 w-4 text-secondary" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">{doc.documentName || "Document"}</span>
                    <span className="text-[11.5px] capitalize text-muted">
                      {String(doc.documentType || "document").replace(/_/g, " ")}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          )}

          <p className="mt-8 mb-2 text-sm font-semibold uppercase tracking-[0.14em]">Shipping Details</p>
          <div className="rounded-[20px] border border-line bg-surface p-[18px]">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-line bg-surface-2">
                <Truck className="h-4 w-4 text-secondary" />
              </span>
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-widest text-muted">Delivery</p>
                <p className="text-[15.5px] font-semibold">{deliveryMethodLabel}</p>
              </div>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-[14.5px]">
              <span className="text-secondary">Delivery fee</span>
              <span className="font-semibold">{formatProductPrice(deliveryFee, product.region, "NG")}</span>
            </div>
          </div>

          {shipsFrom && (
            <div className="mt-2.5 flex items-center gap-3 rounded-[20px] border border-line bg-surface p-[18px]">
              <span className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-line bg-surface-2">
                <MapPin className="h-4 w-4 text-secondary" />
              </span>
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-widest text-muted">Ships from</p>
                <p className="text-[15.5px] font-semibold">{shipsFrom}</p>
              </div>
            </div>
          )}

          <p className="mt-8 mb-2 text-sm font-semibold uppercase tracking-[0.14em]">Sold By</p>
          <Link
            href={sellerId ? `/store/${sellerId}` : "#"}
            className="mb-6 flex items-center rounded-[20px] border border-line bg-surface p-[18px]"
          >
            {seller?.storeLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.storeLogo} alt="" className="h-12 w-12 rounded-[14px] object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-line bg-surface-2">
                <Store className="h-4 w-4 text-secondary" />
              </span>
            )}
            <span className="ml-3 min-w-0 flex-1">
              <span className="block text-[10.5px] font-semibold uppercase tracking-widest text-muted">
                Visit storefront
              </span>
              <span className="mt-0.5 block truncate text-[15.5px] font-bold">
                {seller?.storeName || seller?.name || "Atelier Merchant"}
              </span>
              <span className="block truncate text-[12.5px] text-muted">
                {seller?.storeDescription || "Open this seller's showroom"}
              </span>
            </span>
          </Link>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/6 bg-bg/97 px-4 py-3.5 md:px-8">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5">
          <button
            onClick={bag}
            className="h-12 flex-1 rounded-full border border-white/12 bg-surface-2 text-sm font-bold"
          >
            Add to Bag
          </button>
          <button
            onClick={() => {
              bag();
              router.push("/cart");
            }}
            className="h-12 flex-1 rounded-full bg-white text-sm font-extrabold text-bg"
          >
            Buy Now
          </button>
          <Link
            href="/cart"
            className="relative flex h-[50px] w-[50px] items-center justify-center rounded-full border border-white/10 bg-surface-2"
          >
            <ShoppingBag className="h-[18px] w-[18px]" />
            {bagCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-[17px] rounded-full bg-ai-green px-1 text-center text-[9.5px] font-extrabold">
                {bagCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      <AppFeaturePrompt feature={prompt} onClose={() => setPrompt(null)} />
    </div>
  );
}

export function ProductMissing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-8 text-center text-text">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface">
        <Package className="h-6 w-6 text-ai-green" />
      </span>
      <p className="mt-4 font-semibold">Piece not found</p>
      <Link href="/" className="mt-6 rounded-full bg-text px-6 py-2.5 text-sm font-bold text-bg">
        Return
      </Link>
    </div>
  );
}