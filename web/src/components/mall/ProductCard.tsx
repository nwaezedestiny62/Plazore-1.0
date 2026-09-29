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

function productHasVariants(product: Product): boolean {
  const p = product as Product & {
    hasVariants?: boolean;
    variants?: unknown[];
  };
  if (p.hasVariants === true) return true;
  return Array.isArray(p.variants) && p.variants.length > 0;
}

function freeDelivery(product: Product): boolean {
  const ship = (product as Product & { shipping?: { feeMode?: string } })
    .shipping;
  return ship?.feeMode === "free";
}

function stashReturn(productId: string) {
  try {
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        type: "add_to_cart",
        productId,
        at: Date.now(),
      })
    );
    sessionStorage.setItem(
      "plazore_return_to",
      typeof window !== "undefined" ? window.location.pathname : "/"
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
  const [pressed, setPressed] = useState(false);
  const images = product.images?.length ? product.images : [];

  const brand = storeName(product);
  const location = productLocation(product);
  const variants = productHasVariants(product);
  const isFreeShip = freeDelivery(product);
  const inStock =
    productHasVariants(product)
      ? true
      : Math.max(0, Number(product.stock) || 0) > 0;

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

  // Soft crossfade — long ease, low frequency
  useEffect(() => {
    if (images.length < 2) return;
    const id = window.setInterval(() => {
      setImgIdx((i) => (i + 1) % images.length);
    }, 4800);
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
      marketplace?.ratesToNgn || undefined
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
      fly.flyAdd(product, { x: 0, y: 0, width: 36, height: 36 });
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
          className="block focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
          onClick={trackOpen}
        >
          {/* Image — sharp frame, soft crossfade */}
          <div className="relative aspect-[3/3.55] overflow-hidden bg-[#0A0C10] sm:aspect-[3/3.5]">
            {images.length > 0 ? (
              images.map((src, i) => {
                const active = i === imgIdx;
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
                    className="absolute inset-0 h-full w-full object-cover will-change-[opacity]"
                    style={{
                      opacity: active ? 1 : 0,
                      transition: "opacity 1.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  />
                );
              })
            ) : (
              <div className="h-full w-full bg-surface" />
            )}

            {/* Subtle bottom fade for text legibility over edge cases */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-8 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.18), transparent)",
              }}
            />

            {/* Dot indicators — only when multi-image */}
            {images.length > 1 && (
              <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                {images.slice(0, 5).map((_, i) => (
                  <span
                    key={i}
                    className="block h-[2px] transition-all duration-500 ease-out"
                    style={{
                      width: i === imgIdx ? 14 : 6,
                      backgroundColor:
                        i === imgIdx
                          ? "rgba(255,255,255,0.95)"
                          : "rgba(255,255,255,0.28)",
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Name */}
          <p className="mt-2.5 line-clamp-2 text-[13px] font-medium leading-[1.35] tracking-[-0.01em] sm:text-[13.5px]">
            {product.name}
          </p>

          {/* Brand | location */}
          <p
            className={`mt-1 flex items-center gap-1.5 text-[11px] leading-tight ${
              light ? "text-chamber-ink/50" : "text-white/52"
            }`}
          >
            <span className="truncate font-medium lowercase">
              {brand.toLowerCase()}
            </span>
            {location ? (
              <>
                <span
                  className={light ? "text-chamber-ink/28" : "text-white/28"}
                  aria-hidden
                >
                  |
                </span>
                <span className="min-w-0 truncate opacity-80">{location}</span>
              </>
            ) : null}
          </p>

          {/* Price row */}
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p
              className={`text-[13.5px] font-semibold tracking-tight ${
                light ? "text-chamber-ink" : "text-secondary"
              }`}
              suppressHydrationWarning
            >
              {priceLabel}
              {variants ? (
                <span
                  className={`ml-1 text-[10px] font-medium ${
                    light ? "text-chamber-ink/40" : "text-white/40"
                  }`}
                >
                  from
                </span>
              ) : null}
            </p>
            {isFreeShip && (
              <span
                className={`text-[10px] font-semibold uppercase tracking-[0.06em] ${
                  light ? "text-emerald-700/80" : "text-[#00E575]/85"
                }`}
              >
                Free delivery
              </span>
            )}
          </div>

          {!inStock && !variants && (
            <p
              className={`mt-1 text-[10px] font-medium uppercase tracking-[0.08em] ${
                light ? "text-red-600/70" : "text-red-400/70"
              }`}
            >
              Unavailable
            </p>
          )}
        </Link>

        {/* Cart — sharp square, soft press */}
        <button
          ref={btnRef}
          type="button"
          onClick={onCart}
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerLeave={() => setPressed(false)}
          aria-label="Add to bag"
          className="absolute right-2 top-[calc(68%-2.25rem)] z-10 flex h-9 w-9 items-center justify-center bg-white text-[#111] shadow-[0_2px_10px_rgba(0,0,0,0.16)] transition-[transform,box-shadow,opacity] duration-200 ease-out hover:shadow-[0_4px_14px_rgba(0,0,0,0.22)] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 active:opacity-90"
          style={{
            transform: pressed ? "scale(0.96)" : "scale(1)",
          }}
        >
          <ShoppingCart className="h-[15px] w-[15px]" strokeWidth={2.1} />
        </button>
      </div>

      {/* Auth sheet — sharp edges, calm motion */}
      {authOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/72 sm:items-center sm:p-6"
          style={{
            animation: "plazore-fade-in 0.22s ease-out",
          }}
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => setAuthOpen(false)}
          />
          <div
            className="relative w-full max-w-md border border-white/10 bg-[#0E1116] p-5 sm:p-6"
            style={{
              animation: "plazore-rise 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">
                  Account required
                </p>
                <h3 className="mt-1.5 text-[17px] font-bold tracking-tight text-white">
                  Sign in to add to your bag
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/48">
                  Your bag stays with your Plazore account across devices.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuthOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center text-white/45 transition-colors hover:text-white"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => goAuth("/sign-in")}
              className="mb-2 flex h-12 w-full items-center justify-center gap-2.5 border border-white/10 bg-white text-[14px] font-bold text-[#111] transition-opacity hover:opacity-95 active:opacity-90"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GOOGLE_G} alt="" className="h-5 w-5" />
              Continue with Google
            </button>

            <button
              type="button"
              onClick={() => goAuth("/sign-in")}
              className="mb-1 flex h-12 w-full items-center justify-center border border-white/10 bg-[#161A20] text-[14px] font-bold text-white transition-colors hover:bg-[#1A1F26] active:opacity-90"
            >
              Sign in
            </button>

            <button
              type="button"
              onClick={() => goAuth("/sign-up")}
              className="flex h-12 w-full items-center justify-center text-[14px] font-bold text-[#00E575] transition-opacity hover:opacity-90"
            >
              Create a Plazore account
            </button>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        @keyframes plazore-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes plazore-rise {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}