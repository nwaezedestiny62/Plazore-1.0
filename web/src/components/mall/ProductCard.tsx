"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ShoppingBag, ShoppingCart, X } from "lucide-react";
import { useShowroomFlyCart } from "./ShowroomFlyCart";
import { useMarketplace } from "@/context/MarketplaceContext";
import { DEFAULT_REGION, formatProductPrice } from "@/lib/regions";
import type { Product } from "@/lib/types";

const PENDING_KEY = "plazore_pending_action";
const GOOGLE_G =
  "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg";

function storeName(product: Product) {
  if (typeof product.seller === "object" && product.seller?.storeName) {
    return product.seller.storeName;
  }
  return product.brand || "plazore";
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
}: {
  product: Product;
  tone?: "dark" | "light";
  compact?: boolean;
}) {
  const { isSignedIn, isLoaded } = useAuth();
  const fly = useShowroomFlyCart();
  const marketplace = useMarketplace() as { region?: string } | null;
  const displayRegion = marketplace?.region || DEFAULT_REGION;

  const btnRef = useRef<HTMLButtonElement>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
const images = product.images?.length ? product.images : [];

useEffect(() => {
  if (images.length < 2) return;
  const id = window.setInterval(() => {
    setImgIdx((i) => (i + 1) % images.length);
  }, 4200);
  return () => clearInterval(id);
}, [images.length]);
  const image = images[imgIdx] || images[0];
  const light = tone === "light";

  const widthClass = compact
    ? "min-w-[160px] w-[42vw] max-w-[200px] sm:min-w-[180px] sm:w-[200px]"
    : "min-w-[180px] w-[48vw] max-w-[240px] sm:min-w-[220px] sm:w-[240px] md:max-w-[280px]";

  const returnPath =
    typeof window !== "undefined" ? window.location.pathname : "/";

  const authQs = `redirect_url=${encodeURIComponent(returnPath)}`;

  const doAdd = () => {
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
    window.location.href = `${path}?${authQs}`;
  };

  return (
    <>
      <div
        className={`group relative ${widthClass} ${
          light ? "text-chamber-ink" : "text-text"
        }`}
      >
        <Link href={`/product/${product._id}`} className="block">
          <div className="relative aspect-[3/4] overflow-hidden bg-surface-2">
  {images.length > 0 ? (
    images.map((src, i) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`${product._id}-${i}`}
        src={src}
        alt={product.name}
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ease-in-out"
        style={{
          opacity: i === imgIdx ? 1 : 0,
          transform: i === imgIdx ? "scale(1.03)" : "scale(1)",
          transition:
            i === imgIdx
              ? "opacity 1.6s ease-in-out, transform 4.2s linear"
              : "opacity 1.6s ease-in-out",
        }}
      />
    ))
  ) : (
    <div className="h-full w-full bg-surface" />
  )}
</div>

          <p
            className={`mt-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              light ? "text-chamber-ink/45" : "text-muted"
            }`}
          >
            {storeName(product)}
          </p>
          <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug sm:text-sm">
            {product.name}
          </p>
          <p
            className={`mt-1 text-[13px] font-semibold ${
              light ? "text-chamber-ink" : "text-secondary"
            }`}
          >
            {formatProductPrice(
              Number(product.price),
              product.region,
              displayRegion
            )}
          </p>
        </Link>

        <button
          ref={btnRef}
          type="button"
          onClick={onCart}
          aria-label="Add to bag"
          className="absolute right-2.5 top-[calc(70%-2.75rem)] z-10 flex h-[34px] w-[34px] items-center justify-center bg-white text-[#111] shadow-[0_1px_6px_rgba(0,0,0,0.18)] transition hover:scale-105 active:scale-95"
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