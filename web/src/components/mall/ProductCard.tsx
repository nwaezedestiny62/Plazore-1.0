"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ShoppingCart, X } from "lucide-react";
import { useShowroomFlyCart } from "./ShowroomFlyCart";
import { useMarketplace } from "@/context/MarketplaceContext";
import {
  DEFAULT_REGION,
  formatMoney,
  formatProductPrice,
} from "@/lib/regions";
import type { Product } from "@/lib/types";
import { trackShowroomEvent } from "@/lib/showroomEvents";

const PENDING_KEY = "plazore_pending_action";
const GOOGLE_G =
  "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg";

function storeName(product: Product) {
  if (typeof product.seller === "object" && product.seller?.storeName) {
    return product.seller.storeName;
  }
  return product.brand || "plazore";
}

/** Location line under brand — matches mobile showroom card. */
function productLocation(product: Product): string {
  const p = product as Product & {
    shipsFrom?: string;
    shipsFromLabel?: string;
    fulfillmentLocation?: {
      displayLabel?: string;
      city?: string;
      state?: string;
      country?: string;
    };
    location?: string;
  };

  if (p.shipsFromLabel?.trim()) return p.shipsFromLabel.trim();
  if (typeof p.shipsFrom === "string" && p.shipsFrom.trim()) {
    return p.shipsFrom.trim();
  }
  const loc = p.fulfillmentLocation;
  if (loc?.displayLabel?.trim()) return loc.displayLabel.trim();
  if (loc) {
    const parts = [loc.city, loc.state, loc.country].filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  if (typeof p.location === "string" && p.location.trim()) {
    return p.location.trim();
  }
  return "";
}

function stashReturn(productId: string) {
  try {
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        type: "add_to_cart",
        productId,
        at: Date.now(),
      }),
    );
    sessionStorage.setItem(
      "plazore_return_to",
      typeof window !== "undefined" ? window.location.pathname : "/",
    );
  } catch {
    /* ignore */
  }
}

export function ProductCard({
  product,
  tone = "dark",
  compact,
  room,
  position,
}: {
  product: Product;
  tone?: "dark" | "light";
  compact?: boolean;
  room?: number;
  position?: number;
}) {
  const { isSignedIn, isLoaded } = useAuth();
  const fly = useShowroomFlyCart();
  const marketplace = useMarketplace() as {
    region?: string;
    formatProduct?: (amount: number, productRegion?: string | null) => string;
    ratesToNgn?: Record<string, number> | null;
  } | null;

  const displayRegion = marketplace?.region || DEFAULT_REGION;
  const [mounted, setMounted] = useState(false);

  const btnRef = useRef<HTMLButtonElement>(null);
  const impressed = useRef(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const images = product.images?.length ? product.images : [];

  const brand = storeName(product);
  const location = productLocation(product);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (impressed.current || !product?._id) return;
    impressed.current = true;
    void trackShowroomEvent({
      productId: String(product._id),
      type: "impression",
      room,
      position,
      region: product.region || displayRegion || "NG",
    });
  }, [product?._id, product?.region, room, position, displayRegion]);

  // Lightweight slideshow — only tick when 2+ images; no transform on every frame
  useEffect(() => {
    if (images.length < 2) return;
    const id = window.setInterval(() => {
      setImgIdx((i) => (i + 1) % images.length);
    }, 4200);
    return () => clearInterval(id);
  }, [images.length]);

  const light = tone === "light";

  const widthClass = compact
    ? "min-w-[160px] w-[42vw] max-w-[200px] sm:min-w-[180px] sm:w-[200px]"
    : "min-w-[180px] w-[48vw] max-w-[240px] sm:min-w-[220px] sm:w-[240px] md:max-w-[280px]";

  /**
   * SSR + first client paint: product-region only (stable).
   * After mount: buyer-region conversion (FR → €, etc.).
   */
  const priceLabel = useMemo(() => {
    const amount = Number(product.price) || 0;
    const productRegion = product.region || DEFAULT_REGION;
    if (!mounted) {
      return formatMoney(amount, productRegion);
    }
    if (typeof marketplace?.formatProduct === "function") {
      return marketplace.formatProduct(amount, productRegion);
    }
    return formatProductPrice(
      amount,
      productRegion,
      displayRegion,
      marketplace?.ratesToNgn || undefined,
    );
  }, [mounted, product.price, product.region, displayRegion, marketplace]);

  const trackOpen = () => {
    if (!product?._id) return;
    void trackShowroomEvent({
      productId: String(product._id),
      type: "open",
      room,
      position,
      region: product.region || displayRegion || "NG",
    });
  };

  const doAdd = () => {
    void trackShowroomEvent({
      productId: String(product._id),
      type: "cart",
      room,
      position,
      region: product.region || displayRegion || "NG",
    });

    const el = btnRef.current;
    if (el && fly) {
      const r = el.getBoundingClientRect();
      fly.flyAdd(product, {
        x: r.left,
        y: r.top,
        width: r.width,
        height: r.height,
      });
      return;
    }
    if (fly) {
      fly.flyAdd(product, { x: 0, y: 0, width: 34, height: 34 });
    }
  };

  const onCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoaded) return;
    if (!isSignedIn) {
      stashReturn(product._id);
      setAuthOpen(true);
      return;
    }
    doAdd();
  };

  const goAuth = (path: "/sign-in" | "/sign-up") => {
    stashReturn(product._id);
    const returnPath =
      typeof window !== "undefined" ? window.location.pathname : "/";
    window.location.href = `${path}?redirect_url=${encodeURIComponent(returnPath)}`;
  };

  return (
    <>
      <div
        className={`group relative ${widthClass} ${
          light ? "text-chamber-ink" : "text-text"
        }`}
      >
        <Link
          href={`/product/${product._id}`}
          className="block"
          onClick={trackOpen}
        >
          {/* Slightly shorter than 3/4 to tighten card height */}
          <div className="relative aspect-[3/3.55] overflow-hidden bg-surface-2 sm:aspect-[3/3.5]">
            {images.length > 0 ? (
              images.map((src, i) => {
                const active = i === imgIdx;
                // Only active + neighbors stay in the opacity path (less GPU work)
                if (!active && images.length > 3) {
                  const prev = (imgIdx - 1 + images.length) % images.length;
                  const next = (imgIdx + 1) % images.length;
                  if (i !== prev && i !== next) return null;
                }
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${product._id}-${i}`}
                    src={src}
                    alt={product.name}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      opacity: active ? 1 : 0,
                      transition: "opacity 1.1s ease-in-out",
                    }}
                  />
                );
              })
            ) : (
              <div className="h-full w-full bg-surface" />
            )}
          </div>

          {/* Name */}
          <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-snug sm:text-sm">
            {product.name}
          </p>

          {/* Brand | location — side by side like mobile showroom card */}
          <p
            className={`mt-1 flex items-center gap-1.5 text-[11px] leading-tight ${
              light ? "text-chamber-ink/50" : "text-white/55"
            }`}
          >
            <span className="truncate font-medium lowercase">
              {brand.toLowerCase()}
            </span>
            {location ? (
              <>
                <span
                  className={light ? "text-chamber-ink/30" : "text-white/30"}
                  aria-hidden
                >
                  |
                </span>
                <span className="min-w-0 truncate opacity-80">{location}</span>
              </>
            ) : null}
          </p>

          {/* Price */}
          <p
            className={`mt-1 text-[13px] font-semibold ${
              light ? "text-chamber-ink" : "text-secondary"
            }`}
            suppressHydrationWarning
          >
            {priceLabel}
          </p>
        </Link>

        <button
          ref={btnRef}
          type="button"
          onClick={onCart}
          aria-label="Add to bag"
          className="absolute right-2.5 top-[calc(68%-2.5rem)] z-10 flex h-[34px] w-[34px] items-center justify-center bg-white text-[#111] shadow-[0_1px_6px_rgba(0,0,0,0.18)] transition hover:scale-105 active:scale-95"
        >
          <ShoppingCart className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {authOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => setAuthOpen(false)}
          />
          <div className="relative w-full max-w-md border border-white/10 bg-[#11141A] p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">
                  Account required
                </p>
                <h3 className="mt-1 text-lg font-bold">
                  Sign in to add to your bag
                </h3>
                <p className="mt-1 text-sm text-white/50">
                  Your bag stays with your Plazore account across devices.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuthOpen(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5 text-white/50" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => goAuth("/sign-in")}
              className="mb-2 flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-white/12 bg-white text-[14px] font-bold text-[#111]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GOOGLE_G} alt="" className="h-5 w-5" />
              Continue with Google
            </button>

            <button
              type="button"
              onClick={() => goAuth("/sign-in")}
              className="mb-1 flex h-12 w-full items-center justify-center rounded-xl border border-white/12 bg-[#171B22] text-[14px] font-bold"
            >
              Sign in
            </button>

            <button
              type="button"
              onClick={() => goAuth("/sign-up")}
              className="flex h-12 w-full items-center justify-center text-[14px] font-bold text-[#00E575]"
            >
              Create a Plazore account
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}