"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { ShoppingCart, X } from "lucide-react";
import { useShowroomFlyCart } from "./ShowroomFlyCart";
import { useMarketplace } from "@/context/MarketplaceContext";
import {
  DEFAULT_REGION,
  formatMoney,
  formatProductPrice,
} from "@/lib/regions";
import type { Product, ProductVariant } from "@/lib/types";
import { trackShowroomEvent } from "@/lib/showroomEvents";
import { addToCart } from "@/lib/cart";

const PENDING_KEY = "plazore_pending_action";
const GOOGLE_G =
  "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg";
const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#2563EB)";

function storeName(product: Product) {
  if (typeof product.seller === "object" && product.seller?.storeName) {
    return product.seller.storeName;
  }
  return product.brand || "plazore";
}

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
    options?: unknown[];
  };
  if (p.hasVariants === true) return true;
  return (
    (Array.isArray(p.variants) && p.variants.length > 0) ||
    (Array.isArray(p.options) && p.options.length > 0)
  );
}

function freeDelivery(product: Product): boolean {
  const ship = (product as Product & { shipping?: { feeMode?: string } })
    .shipping;
  return ship?.feeMode === "free";
}

function mapToRecord(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (raw instanceof Map) {
    const o: Record<string, string> = {};
    raw.forEach((v, k) => {
      if (v != null && String(v).trim()) o[String(k)] = String(v);
    });
    return o;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v != null && String(v).trim()) o[String(k)] = String(v);
    }
    return o;
  }
  return {};
}

type OptionGroup = { name: string; values: string[] };

function getOptionGroups(product: Product): OptionGroup[] {
  const p = product as Product & {
    options?: { name?: string; values?: unknown }[];
    variants?: ProductVariant[];
  };
  const fromOpts: OptionGroup[] = [];
  if (Array.isArray(p.options)) {
    for (const o of p.options) {
      const name = String(o?.name || "").trim();
      const values = Array.isArray(o?.values)
        ? o.values.map((x) => String(x).trim()).filter(Boolean)
        : [];
      if (name && values.length) fromOpts.push({ name, values });
    }
  }
  if (fromOpts.length) return fromOpts;

  const map = new Map<string, Set<string>>();
  for (const v of p.variants || []) {
    const opts = mapToRecord(v.options);
    for (const [k, val] of Object.entries(opts)) {
      if (!map.has(k)) map.set(k, new Set());
      map.get(k)!.add(val);
    }
  }
  return Array.from(map.entries()).map(([name, set]) => ({
    name,
    values: Array.from(set),
  }));
}

function getVariants(product: Product): ProductVariant[] {
  const list = (product as Product & { variants?: ProductVariant[] }).variants;
  if (!Array.isArray(list)) return [];
  return list.map((v) => ({
    ...v,
    options: mapToRecord(v.options),
  }));
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const impressed = useRef(false);
  const addLockRef = useRef(false);

  const [authOpen, setAuthOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIn, setPickerIn] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});

  const primaryImage =
    product.images?.length && product.images[0] ? product.images[0] : null;

  const brand = storeName(product);
  const location = productLocation(product);
  const hasVariants = productHasVariants(product);
  const isFreeShip = freeDelivery(product);
  const optionGroups = useMemo(
    () => (hasVariants ? getOptionGroups(product) : []),
    [hasVariants, product]
  );
  const variantsList = useMemo(
    () => (hasVariants ? getVariants(product) : []),
    [hasVariants, product]
  );

  const selectedVariant = useMemo(() => {
    if (!hasVariants || !optionGroups.length) return null;
    if (optionGroups.some((g) => !selected[g.name])) return null;
    return (
      variantsList.find((v) => {
        if (v.available === false) return false;
        const opts = mapToRecord(v.options);
        return optionGroups.every(
          (g) =>
            String(opts[g.name] || "").toLowerCase() ===
            String(selected[g.name] || "").toLowerCase()
        );
      }) || null
    );
  }, [hasVariants, optionGroups, variantsList, selected]);

  const selectionComplete =
    !hasVariants ||
    (optionGroups.length > 0 &&
      optionGroups.every((g) => !!selected[g.name]) &&
      !!selectedVariant);

  const unitAmount = selectedVariant
    ? Number(selectedVariant.price ?? product.price) || 0
    : Number(product.price) || 0;

  const variantStock = selectedVariant
    ? Math.max(0, Number(selectedVariant.stock) || 0)
    : 0;

  const inStock = hasVariants
    ? !selectionComplete
      ? true
      : variantStock > 0
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

  useEffect(() => {
    if (!pickerOpen) {
      setPickerIn(false);
      return;
    }
    const id = requestAnimationFrame(() => setPickerIn(true));
    return () => cancelAnimationFrame(id);
  }, [pickerOpen]);

  const light = tone === "light";

  const widthClass = compact
    ? "min-w-[160px] w-[42vw] max-w-[200px] sm:min-w-[180px] sm:w-[200px]"
    : "min-w-[180px] w-[48vw] max-w-[240px] sm:min-w-[220px] sm:w-[240px] md:max-w-[280px]";

  const priceLabel = useMemo(() => {
    const productRegion = product.region || DEFAULT_REGION;
    if (!mounted) {
      return formatMoney(unitAmount, productRegion);
    }
    if (typeof marketplace?.formatProduct === "function") {
      return marketplace.formatProduct(unitAmount, productRegion);
    }
    return formatProductPrice(
      unitAmount,
      productRegion,
      displayRegion,
      marketplace?.ratesToNgn || undefined
    );
  }, [mounted, unitAmount, product.region, displayRegion, marketplace]);

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

  const closePicker = useCallback(() => {
    setPickerIn(false);
    window.setTimeout(() => {
      setPickerOpen(false);
      setSelected({});
    }, 240);
  }, []);

  const doAdd = useCallback(
    (variant?: ProductVariant | null) => {
      void trackShowroomEvent({
        productId: String(product._id),
        type: "cart",
        room,
        position,
        region: product.region || displayRegion || "NG",
      });

      const payload = variant
        ? {
            ...product,
            price: Number(variant.price ?? product.price) || product.price,
            selectedVariant: variant,
            variantId: variant.variantId,
            variantKey: variant.key,
            selectedOptions: mapToRecord(variant.options),
          }
        : product;

      try {
        addToCart(product, 1, {
          variantId: variant?.variantId,
          variantKey: variant?.key,
          selectedOptions: variant ? mapToRecord(variant.options) : undefined,
          variant: variant || undefined,
        });
      } catch {
        /* picker path should already enforce selection */
      }

      const el = btnRef.current;
      if (el && fly) {
        const r = el.getBoundingClientRect();
        fly.flyAdd(payload as Product, {
          x: r.left,
          y: r.top,
          width: r.width,
          height: r.height,
        });
        return;
      }
      if (fly) {
        fly.flyAdd(payload as Product, { x: 0, y: 0, width: 36, height: 36 });
      }
    },
    [product, room, position, displayRegion, fly]
  );

  const onCart = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoaded) return;

    if (addLockRef.current) return;
    addLockRef.current = true;
    window.setTimeout(() => {
      addLockRef.current = false;
    }, 400);

    if (!isSignedIn) {
      stashReturn(product._id);
      setAuthOpen(true);
      return;
    }
    if (hasVariants && optionGroups.length > 0) {
      setPickerOpen(true);
      return;
    }
    doAdd(null);
  };

  const confirmVariant = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectionComplete || !selectedVariant || !inStock) return;

    if (addLockRef.current) return;
    addLockRef.current = true;
    window.setTimeout(() => {
      addLockRef.current = false;
    }, 400);

    doAdd(selectedVariant);
    closePicker();
  };

  const goAuth = (path: "/sign-in" | "/sign-up") => {
    stashReturn(product._id);
    const returnPath =
      typeof window !== "undefined" ? window.location.pathname : "/";
    window.location.href = `${path}?redirect_url=${encodeURIComponent(returnPath)}`;
  };

  const pickValue = (name: string, val: string) => {
    setSelected((prev) => {
      if (prev[name] === val) {
        const next = { ...prev };
        delete next[name];
        return next;
      }
      return { ...prev, [name]: val };
    });
  };

  const valuePossible = (name: string, val: string) => {
    const trial = { ...selected, [name]: val };
    return variantsList.some((v) => {
      if (v.available === false) return false;
      if ((Number(v.stock) || 0) <= 0) return false;
      const opts = mapToRecord(v.options);
      return optionGroups.every((g) => {
        const pick = trial[g.name];
        if (!pick) return true;
        return (
          String(opts[g.name] || "").toLowerCase() === pick.toLowerCase()
        );
      });
    });
  };

  const pickedCount = optionGroups.filter((g) => selected[g.name]).length;

  return (
    <>
      <div
        className={`group relative ${widthClass} ${
          light ? "text-chamber-ink" : "text-text"
        }`}
      >
        {/* Image is the positioning parent. Button is a sibling of the link, pinned to this frame. */}
        <div className="relative aspect-[3/3.55] overflow-hidden bg-[#0A0C10] sm:aspect-[3/3.5]">
          <Link
            href={`/product/${product._id}`}
            className="absolute inset-0 block focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
            onClick={trackOpen}
          >
            {primaryImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryImage}
                alt={product.name}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  transform: pickerOpen ? "scale(1.03)" : "scale(1)",
                  filter: pickerOpen
                    ? "saturate(0.88) brightness(0.92)"
                    : "none",
                  transition:
                    "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), filter 0.3s ease",
                }}
              />
            ) : (
              <div className="h-full w-full bg-surface" />
            )}
          </Link>

          {pickerOpen ? (
            <div
              className="absolute inset-0 z-20 flex flex-col"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(120% 80% at 50% 100%, rgba(0,229,117,0.08), transparent 55%), linear-gradient(180deg, rgba(4,6,10,0.28) 0%, rgba(4,6,10,0.62) 100%)",
                  opacity: pickerIn ? 1 : 0,
                  transition: "opacity 0.28s ease",
                }}
                onClick={closePicker}
              />

              <div
                className="relative z-10 mt-auto flex min-h-0 max-h-full flex-1 flex-col"
                style={{
                  transform: pickerIn ? "translateY(0)" : "translateY(14px)",
                  opacity: pickerIn ? 1 : 0,
                  transition:
                    "transform 0.36s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.26s ease",
                }}
              >
                <div
                  className="flex min-h-0 flex-1 flex-col overflow-hidden border-t"
                  style={{
                    borderColor: "rgba(255,255,255,0.16)",
                    background:
                      "linear-gradient(180deg, rgba(18,22,30,0.55) 0%, rgba(10,12,18,0.78) 100%)",
                    backdropFilter: "blur(22px) saturate(1.55)",
                    WebkitBackdropFilter: "blur(22px) saturate(1.55)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.12), 0 -24px 48px rgba(0,0,0,0.38)",
                  }}
                >
                  <div
                    className="h-[2px] w-full shrink-0"
                    style={{ backgroundImage: GRAD }}
                  />

                  <div className="flex shrink-0 items-center justify-between gap-2 px-2.5 py-2 sm:px-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/38 sm:text-[10px]">
                        Configure
                      </p>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-white/82 sm:text-[12px]">
                        {pickedCount}/{optionGroups.length} selected
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closePicker}
                      aria-label="Close"
                      className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/12 bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </button>
                  </div>

                  <div
                    ref={scrollRef}
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-1 sm:px-3"
                    style={{
                      WebkitOverflowScrolling: "touch",
                      scrollbarWidth: "thin",
                      scrollbarColor: "rgba(255,255,255,0.18) transparent",
                    }}
                  >
                    {optionGroups.map((g, gi) => (
                      <div
                        key={g.name}
                        className={gi === 0 ? "pt-0.5" : "pt-2.5"}
                      >
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50 sm:text-[11px]">
                            {g.name}
                          </p>
                          {selected[g.name] ? (
                            <p className="max-w-[55%] truncate text-[10px] font-medium text-[#00E575]/90">
                              {selected[g.name]}
                            </p>
                          ) : (
                            <p className="text-[10px] text-white/28">choose</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {g.values.map((val) => {
                            const on = selected[g.name] === val;
                            const possible = valuePossible(g.name, val);
                            return (
                              <button
                                key={val}
                                type="button"
                                disabled={!possible && !on}
                                onClick={() =>
                                  possible && pickValue(g.name, val)
                                }
                                className="min-h-[28px] px-2.5 text-[11px] font-semibold sm:min-h-[30px] sm:px-3 sm:text-[12px]"
                                style={{
                                  backgroundImage: on ? GRAD : undefined,
                                  backgroundColor: on
                                    ? undefined
                                    : possible
                                      ? "rgba(255,255,255,0.07)"
                                      : "rgba(255,255,255,0.02)",
                                  color: on
                                    ? "#041412"
                                    : possible
                                      ? "rgba(255,255,255,0.9)"
                                      : "rgba(255,255,255,0.22)",
                                  border: on
                                    ? "1px solid transparent"
                                    : possible
                                      ? "1px solid rgba(255,255,255,0.14)"
                                      : "1px solid rgba(255,255,255,0.05)",
                                  boxShadow: on
                                    ? "0 0 0 1px rgba(0,229,117,0.18), 0 8px 18px rgba(0,0,0,0.25)"
                                    : "none",
                                  textDecoration: possible
                                    ? "none"
                                    : "line-through",
                                  cursor: possible ? "pointer" : "not-allowed",
                                  transition:
                                    "background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease",
                                }}
                              >
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    className="shrink-0 border-t px-2.5 py-2 sm:px-3 sm:py-2.5"
                    style={{
                      borderColor: "rgba(255,255,255,0.1)",
                      background: "rgba(8,10,14,0.55)",
                      backdropFilter: "blur(16px)",
                      WebkitBackdropFilter: "blur(16px)",
                    }}
                  >
                    <p
                      className="mb-1.5 truncate text-[11px] font-semibold tracking-tight text-white/88 sm:text-[12px]"
                      suppressHydrationWarning
                    >
                      {priceLabel}
                      {selectionComplete && inStock ? (
                        <span className="ml-1.5 text-[10px] font-medium text-white/38">
                          ready
                        </span>
                      ) : null}
                    </p>
                    <button
                      type="button"
                      onClick={confirmVariant}
                      disabled={!selectionComplete || !inStock}
                      className="flex h-9 w-full items-center justify-center text-[12px] font-extrabold tracking-wide disabled:opacity-45 sm:h-10 sm:text-[13px]"
                      style={{
                        backgroundImage:
                          selectionComplete && inStock ? GRAD : undefined,
                        backgroundColor:
                          selectionComplete && inStock
                            ? undefined
                            : "rgba(255,255,255,0.08)",
                        color:
                          selectionComplete && inStock
                            ? "#041412"
                            : "rgba(255,255,255,0.5)",
                        boxShadow:
                          selectionComplete && inStock
                            ? "0 10px 24px rgba(0,229,117,0.18)"
                            : "none",
                      }}
                    >
                      {!selectionComplete
                        ? "Select options"
                        : !inStock
                          ? "Out of stock"
                          : "Add to bag"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <button
            ref={btnRef}
            type="button"
            onClick={onCart}
            onPointerDown={(e) => {
              e.stopPropagation();
              setPressed(true);
            }}
            onPointerUp={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            aria-label={hasVariants ? "Choose options" : "Add to bag"}
            className="absolute bottom-2 right-2 z-30 flex h-8 w-8 items-center justify-center bg-white text-[#111] shadow-[0_2px_10px_rgba(0,0,0,0.18)] transition-[transform,box-shadow,opacity] duration-200 ease-out hover:shadow-[0_4px_14px_rgba(0,0,0,0.22)] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 active:opacity-90 sm:bottom-2.5 sm:right-2.5 sm:h-9 sm:w-9"
            style={{
              transform: pressed ? "scale(0.96)" : "scale(1)",
              opacity: pickerOpen ? 0 : 1,
              pointerEvents: pickerOpen ? "none" : "auto",
            }}
          >
            <ShoppingCart
              className="h-[14px] w-[14px] sm:h-[15px] sm:w-[15px]"
              strokeWidth={2.1}
            />
          </button>
        </div>

        <Link
          href={`/product/${product._id}`}
          className="block focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
          onClick={trackOpen}
        >
          <p className="mt-2.5 line-clamp-2 text-[13px] font-medium leading-[1.35] tracking-[-0.01em] sm:text-[13.5px]">
            {product.name}
          </p>

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

          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p
              className={`text-[13.5px] font-semibold tracking-tight ${
                light ? "text-chamber-ink" : "text-secondary"
              }`}
              suppressHydrationWarning
            >
              {priceLabel}
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

          {!inStock && !hasVariants && (
            <p
              className={`mt-1 text-[10px] font-medium uppercase tracking-[0.08em] ${
                light ? "text-red-600/70" : "text-red-400/70"
              }`}
            >
              Unavailable
            </p>
          )}
        </Link>
      </div>

      {authOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/72 sm:items-center sm:p-6"
          style={{ animation: "plazore-fade-in 0.22s ease-out" }}
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

export default ProductCard;