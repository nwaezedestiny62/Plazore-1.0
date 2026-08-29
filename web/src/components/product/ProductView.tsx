"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useSignIn, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Heart,
  Link2,
  MapPin,
  MessageCircle,
  Package,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  X,
} from "lucide-react";
import { AppFeaturePrompt, type AppFeature } from "@/components/app/AppFeaturePrompt";
import { addToCart, cartCount } from "@/lib/cart";
import { fetchProductAI } from "@/lib/api";
import type { PlazoreAIData } from "@/lib/plazoreAI";
import { useMarketplace } from "@/context/MarketplaceContext";
import { DEFAULT_REGION, formatProductPrice } from "@/lib/regions";
import type { Product } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const GRAD = "linear-gradient(90deg,#10B981,#14B8A6,#3B82F6)";
const GOOGLE_G = "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg";
const PENDING_KEY = "plazore_product_pending";

type PendingAction = "bag" | "buy" | "message" | "wishlist";

function formatSpecKey(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function readShipping(product: Product) {
  const extra = product as unknown as { shipping?: Record<string, unknown> };
  const raw = extra.shipping;
  const ship = raw && typeof raw === "object" ? raw : {};
  const method = typeof ship.method === "string" ? ship.method : "";
  const deliveryFee = Number(ship.deliveryFee) || 0;
  const courierName =
    [ship.courier, ship.courierName, ship.courierCompany, ship.company]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .find(Boolean) || "";
  return {
    deliveryFee,
    deliveryMethodLabel:
      method === "self" ? "Direct Merchant Delivery" : courierName || "Courier Delivery",
  };
}

function productKey(product: Product) {
  return String(
    (product as { _id?: string; id?: string })._id ||
      (product as { id?: string }).id ||
      "",
  );
}

function stashReturnTo(path: string) {
  try {
    sessionStorage.setItem("plazore_return_to", path);
  } catch {
    /* ignore */
  }
}

function stashChatProduct(conversationId: string, product: Product, extra?: unknown) {
  try {
    sessionStorage.setItem(
      `plazore_conv_${conversationId}`,
      JSON.stringify(
        extra || {
          product: {
            _id: productKey(product),
            name: product.name,
            images: product.images,
            price: product.price,
            region: product.region,
          },
        },
      ),
    );
  } catch {
    /* ignore */
  }
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
      <p
        className={className}
        style={
          open
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: lines,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }
        }
      >
        {text}
      </p>
      {text.length > 140 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 text-sm font-semibold text-ai-green"
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

function GradientLabel({ children }: { children: string }) {
  return (
    <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>
      {children}
    </span>
  );
}

async function buildShareCard(imageUrl: string, title: string): Promise<Blob | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = imageUrl;
    });
    const w = 1080;
    const h = 1350;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#090B0F";
    ctx.fillRect(0, 0, w, h);
    const scale = Math.max(w / img.width, (h - 160) / img.height);
    const iw = img.width * scale;
    const ih = img.height * scale;
    ctx.drawImage(img, (w - iw) / 2, 0, iw, ih);
    const g = ctx.createLinearGradient(0, h - 280, 0, h);
    g.addColorStop(0, "rgba(9,11,15,0)");
    g.addColorStop(0.4, "rgba(9,11,15,0.85)");
    g.addColorStop(1, "#090B0F");
    ctx.fillStyle = g;
    ctx.fillRect(0, h - 280, w, 280);
    ctx.fillStyle = "#00E575";
    ctx.font = "bold 28px system-ui,sans-serif";
    ctx.fillText("PLAZORE", 48, h - 140);
    ctx.fillStyle = "#F5F7FA";
    ctx.font = "600 36px system-ui,sans-serif";
    const t = title.length > 42 ? title.slice(0, 40) + "…" : title;
    ctx.fillText(t, 48, h - 90);
    ctx.fillStyle = "rgba(245,247,250,0.55)";
    ctx.font = "24px system-ui,sans-serif";
    ctx.fillText("Discover this piece on Plazore", 48, h - 48);
    return await new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.92));
  } catch {
    return null;
  }
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
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/6 text-white"
    >
      {children}
    </button>
  );
}

function Gallery({ images, name }: { images: string[]; name: string }) {
  const [slide, setSlide] = useState(0);
  const startX = useRef(0);
  const dragging = useRef(false);
  const count = images.length;
  const hasMany = count > 1;

  const go = useCallback(
    (i: number) => {
      if (!count) return;
      setSlide((i + count) % count);
    },
    [count],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(slide + 1);
      if (e.key === "ArrowLeft") go(slide - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, slide]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const dx = e.clientX - startX.current;
    if (dx > 48) go(slide - 1);
    else if (dx < -48) go(slide + 1);
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[64px_minmax(0,1fr)] lg:gap-2.5">
        {hasMany ? (
          <div className="hidden min-h-0 flex-col gap-2 overflow-y-auto lg:flex">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => go(i)}
                className={`relative h-16 w-16 shrink-0 overflow-hidden border ${
                  i === slide ? "border-text" : "border-line opacity-70 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <div className="hidden lg:block" />
        )}

        <div
          className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#07080C]"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {images[slide] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={images[slide]}
              alt={name}
              className="absolute inset-0 h-full w-full select-none object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted">No image</div>
          )}

          {hasMany ? (
            <>
              <p className="absolute right-2.5 top-2.5 border border-white/15 bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                {String(slide + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
              </p>
              <button
                type="button"
                onClick={() => go(slide - 1)}
                className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center border border-white/15 bg-black/45 text-white lg:flex"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => go(slide + 1)}
                className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center border border-white/15 bg-black/45 text-white lg:flex"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 lg:hidden">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => go(i)}
                    className={`h-[3px] rounded-full bg-text transition-all ${
                      i === slide ? "w-4 opacity-100" : "w-[5px] opacity-30"
                    }`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {hasMany ? (
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-t border-white/6 bg-bg px-3 py-2 lg:hidden">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => go(i)}
              className={`h-11 w-11 shrink-0 overflow-hidden border ${
                i === slide ? "border-text" : "border-line opacity-70"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProductView({ product }: { product: Product }) {
  const router = useRouter();
  const pathname = usePathname();
  const { getToken, isSignedIn, userId, isLoaded } = useAuth();
  const { user } = useUser();
  const { signIn } = useSignIn();
  const { region: marketplaceRegion } = useMarketplace();
  const displayRegion = marketplaceRegion || DEFAULT_REGION;

  const [ai, setAi] = useState<PlazoreAIData | null>(null);
  const [aiReady, setAiReady] = useState(false);
  const [prompt, setPrompt] = useState<AppFeature | null>(null);
  const [bagCount, setBagCount] = useState(0);
  const [messaging, setMessaging] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const ranPending = useRef(false);

  const images = product.images?.length ? product.images : [];
  const seller = typeof product.seller === "object" ? product.seller : null;
  const sellerId =
    seller && "_id" in seller
      ? String(seller._id)
      : typeof product.seller === "string"
        ? product.seller
        : null;

  const isOwnListing = useMemo(() => {
    if (!isSignedIn || !userId) return false;
    const s = seller && typeof seller === "object" ? (seller as Record<string, unknown>) : null;
    const ids = [
      s?.clerkId,
      s?.userId,
      s?.ownerClerkId,
      s?.owner,
      s?.user,
      (product as { ownerId?: string }).ownerId,
      (product as { sellerUserId?: string }).sellerUserId,
      (product as { createdBy?: string }).createdBy,
    ]
      .map((v) => (v != null ? String(v) : ""))
      .filter(Boolean);
    if (ids.some((id) => id === userId || id === user?.id)) return true;
    const mySellerId =
      typeof window !== "undefined" ? sessionStorage.getItem("plazore_seller_id") || "" : "";
    if (sellerId && mySellerId && sellerId === mySellerId) return true;
    return false;
  }, [isSignedIn, userId, seller, sellerId, product, user?.id]);

  const { deliveryFee, deliveryMethodLabel } = readShipping(product);
  const categoryLabel =
    typeof product.category === "string" ? product.category : product.category?.name;
  const inStock = Number(product.stock) > 0;
  const wishlistCount = Number(
    (product as { wishlistCount?: number; saves?: number }).wishlistCount ??
      (product as { saves?: number }).saves ??
      0,
  );

  const specs = useMemo(() => {
    const raw = product.specifications;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v != null && String(v).trim()) out[k] = String(v);
    }
    return out;
  }, [product.specifications]);

  const docs = Array.isArray(product.verificationDocuments)
    ? product.verificationDocuments
    : [];
  const shipsFrom =
    product.fulfillmentLocation?.displayLabel ||
    [product.fulfillmentLocation?.city, product.fulfillmentLocation?.country]
      .filter(Boolean)
      .join(", ") ||
    null;

  const productUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/product/${product._id}`
      : `/product/${product._id}`;

  const returnTo = pathname || `/product/${product._id}`;
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(returnTo)}`;
  const signUpHref = `/sign-in?mode=signup&redirect_url=${encodeURIComponent(returnTo)}`;
  const shareText = `Found this on Plazore — ${product.name}. Clean listing, clear details. Take a look:`;

  const doBag = useCallback(() => {
    addToCart(product);
    setBagCount(cartCount());
  }, [product]);

  const doBuy = useCallback(() => {
    addToCart(product);
    setBagCount(cartCount());
    router.push("/cart");
  }, [product, router]);

  const doWishlist = useCallback(() => {
    setPrompt("wishlist");
  }, []);

  const messageSeller = useCallback(async () => {
    if (isOwnListing) return;
    const pid = productKey(product);
    if (!pid) {
      setMsgError("This listing has no product id.");
      return;
    }
    setMessaging(true);
    setMsgError(null);
    try {
      const token = await getToken();
      if (!token) {
        setPending("message");
        stashReturnTo(returnTo);
        setAuthOpen(true);
        return;
      }
      const res = await fetch(`${API}/chat/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId: pid }),
      });
      const json = await res.json().catch(() => ({}));
      const conv = json?.data;
      const id = conv?._id || conv?.id;
      if (res.ok && json?.success && id) {
        stashChatProduct(String(id), product, conv);
        router.push(`/chat/${id}?product=${encodeURIComponent(pid)}`);
        return;
      }
      setMsgError(
        json?.message ||
          (res.status === 401 ? "Please sign in again." : "Could not start this conversation."),
      );
    } catch {
      setMsgError("Could not start this conversation.");
    } finally {
      setMessaging(false);
    }
  }, [getToken, isOwnListing, product, returnTo, router]);

  const runAction = useCallback(
    (action: PendingAction) => {
      if (action === "bag") doBag();
      else if (action === "buy") doBuy();
      else if (action === "message") void messageSeller();
      else doWishlist();
    },
    [doBag, doBuy, doWishlist, messageSeller],
  );

  const requireAccount = (action: PendingAction) => {
    if (!isLoaded) return;
    if (isSignedIn) {
      runAction(action);
      return;
    }
    setPending(action);
    try {
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ action, productId: String(product._id) }),
      );
    } catch {
      /* ignore */
    }
    setAuthOpen(true);
  };

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

  useEffect(() => {
    if (!isLoaded || !isSignedIn || ranPending.current) return;
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { action?: PendingAction; productId?: string };
      if (parsed.productId && parsed.productId !== String(product._id)) return;
      if (!parsed.action) return;
      ranPending.current = true;
      sessionStorage.removeItem(PENDING_KEY);
      setAuthOpen(false);
      setPending(null);
      runAction(parsed.action);
    } catch {
      /* ignore */
    }
  }, [isLoaded, isSignedIn, product._id, runAction]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const shareNative = async () => {
    setShareBusy(true);
    try {
      const blob = images[0] ? await buildShareCard(images[0], product.name) : null;
      const file =
        blob &&
        new File([blob], "plazore-product.jpg", {
          type: "image/jpeg",
        });
      if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: product.name,
          text: shareText,
          url: productUrl,
          files: [file],
        });
        setShareOpen(false);
        return;
      }
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: `${shareText}\n${productUrl}`,
          url: productUrl,
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
    const u = encodeURIComponent(productUrl);
    const t = encodeURIComponent(`${shareText} ${productUrl}`);
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${t}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${u}`,
      telegram: `https://t.me/share/url?url=${u}&text=${encodeURIComponent(shareText)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    };
    window.open(urls[kind], "_blank", "noopener,noreferrer");
  };

  const continueGoogle = async () => {
    try {
      sessionStorage.setItem("plazore_return_to", returnTo);
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ action: pending || "bag", productId: String(product._id) }),
      );
    } catch {
      /* ignore */
    }

    if (!signIn) {
      router.push(signInHref);
      return;
    }

    setGoogleBusy(true);
    try {
      const { error } = await signIn.sso({
        strategy: "oauth_google",
        redirectCallbackUrl: "/sso-callback",
        redirectUrl: "/auth/continue",
      });
      if (error) router.push(signInHref);
    } catch {
      router.push(signInHref);
    } finally {
      setGoogleBusy(false);
    }
  };

  const priceLabel = formatProductPrice(
    Number(product.price) || 0,
    product.region,
    displayRegion,
  );
  const feeLabel = formatProductPrice(deliveryFee, product.region, displayRegion);

  const authCopy: Record<PendingAction, { title: string; body: string }> = {
    bag: {
      title: "Sign in to add this to your bag",
      body: "Your bag stays with your Plazore account so you can finish this anytime.",
    },
    buy: {
      title: "Sign in to buy this piece",
      body: "Checkout is tied to your account so orders and delivery stay in one place.",
    },
    message: {
      title: "Sign in to message the seller",
      body: "Chat stays on Plazore — no contact swap until a real order is complete.",
    },
    wishlist: {
      title: "Sign in to save this piece",
      body: "Saves live on your account so they follow you across devices.",
    },
  };
  const gate = authCopy[pending || "bag"];

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-bg text-text">
      {/* Always-on chrome — never scrolls away */}
      <header className="z-40 flex h-12 shrink-0 items-center justify-between border-b border-white/8 bg-bg/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-4 lg:h-14 lg:px-6">
        <ChromeBtn onClick={() => router.back()} label="Back">
          <ChevronLeft className="h-[18px] w-[18px]" />
        </ChromeBtn>
        <p className="mx-3 min-w-0 flex-1 truncate text-center text-[13px] font-semibold lg:text-sm">
          {product.name}
        </p>
        <div className="flex items-center gap-2">
          <ChromeBtn onClick={() => setShareOpen(true)} label="Share">
            <Share2 className="h-[15px] w-[15px]" strokeWidth={2.25} />
          </ChromeBtn>
          <ChromeBtn onClick={() => requireAccount("wishlist")} label="Wishlist">
            <Heart className="h-[15px] w-[15px]" strokeWidth={2.2} />
            {wishlistCount > 0 ? (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-1 text-[9px] font-extrabold leading-none">
                {wishlistCount > 99 ? "99+" : wishlistCount}
              </span>
            ) : null}
          </ChromeBtn>
        </div>
      </header>

      {/* Split: locked gallery + scrolling details */}
      <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(210px,38dvh)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:grid-rows-1">
        <section className="min-h-0 min-w-0 overflow-hidden border-b border-white/6 bg-[#07080C] lg:border-b-0 lg:border-r">
          <Gallery images={images} name={product.name} />
        </section>

        <section className="min-h-0 min-w-0 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 sm:px-6 lg:px-8 lg:pt-6">
          {(product.brand || categoryLabel) && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {product.brand || categoryLabel}
            </p>
          )}
          <h1 className="mt-1.5 break-words font-display text-[22px] font-semibold tracking-tight sm:text-[26px] lg:text-[32px]">
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[22px] font-bold tracking-tight sm:text-[25px]">{priceLabel}</p>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                inStock
                  ? "border-ai-blue/30 bg-ai-green/10"
                  : "border-error/30 bg-error/10 text-error"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${inStock ? "bg-ai-green" : "bg-error"}`} />
              {inStock ? (
                <GradientLabel>{`Available · ${product.stock}`}</GradientLabel>
              ) : (
                "Unavailable"
              )}
            </span>
          </div>

          {(categoryLabel || product.subCategory) && (
            <div className="mt-3 flex flex-wrap gap-2">
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

          <div className="relative mt-5 overflow-hidden rounded-[20px] border border-ai-green/20 bg-[#11141A]/80">
            {!aiReady ? (
              <div className="flex h-[108px] items-center justify-center">
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <span
                    className="absolute inset-0 animate-spin rounded-full border-2 border-transparent"
                    style={{
                      borderTopColor: "#10B981",
                      borderRightColor: "#3B82F6",
                      borderLeftColor: "#10B981",
                    }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/plazore-ai-logo.png"
                    alt=""
                    className="relative z-[1] h-6 w-6 object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-[18px]">
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
                        style={{ backgroundImage: GRAD }}
                      />
                      {ai.highlights[0]}
                    </p>
                  </div>
                )}
                <button
                  type="button"
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
            <div className="mt-7">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em]">Description</p>
              <ExpandableText
                className="text-[15.5px] leading-6 text-secondary"
                text={String(product.description)}
              />
            </div>
          )}

          {Object.keys(specs).length > 0 && (
            <div className="mt-7 rounded-[20px] border border-line bg-surface p-4 sm:p-[18px]">
              <p className="mb-3 text-base font-semibold">Specifications</p>
              {Object.entries(specs).map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-3 border-b border-line py-2.5 last:border-0"
                >
                  <span className="max-w-[42%] text-[13.5px] text-muted">{formatSpecKey(k)}</span>
                  <span className="min-w-0 text-right text-[13.5px] font-medium break-words">{v}</span>
                </div>
              ))}
            </div>
          )}

          {docs.length > 0 && (
            <div className="mt-6 rounded-[20px] border border-line bg-surface p-4 sm:p-[18px]">
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
                    <span className="block truncate text-[14.5px] font-medium">
                      {doc.documentName || "Document"}
                    </span>
                    <span className="text-[11.5px] capitalize text-muted">
                      {String(doc.documentType || "document").replace(/_/g, " ")}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          )}

          <p className="mb-2 mt-7 text-sm font-semibold uppercase tracking-[0.14em]">
            Shipping Details
          </p>
          <div className="rounded-[20px] border border-line bg-surface p-4 sm:p-[18px]">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2">
                <Truck className="h-4 w-4 text-secondary" />
              </span>
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-widest text-muted">
                  Delivery
                </p>
                <p className="text-[15.5px] font-semibold">{deliveryMethodLabel}</p>
              </div>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-[14.5px]">
              <span className="text-secondary">Delivery fee</span>
              <span className="font-semibold">{feeLabel}</span>
            </div>
          </div>

          {shipsFrom && (
            <div className="mt-2.5 flex items-center gap-3 rounded-[20px] border border-line bg-surface p-4 sm:p-[18px]">
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2">
                <MapPin className="h-4 w-4 text-secondary" />
              </span>
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-widest text-muted">
                  Ships from
                </p>
                <p className="text-[15.5px] font-semibold">{shipsFrom}</p>
              </div>
            </div>
          )}

          <p className="mb-2 mt-7 text-sm font-semibold uppercase tracking-[0.14em]">Sold By</p>
          <div className="mb-4 overflow-hidden rounded-[20px] border border-line bg-surface">
            <Link
              href={sellerId ? `/store/${sellerId}` : "#"}
              className="flex items-center p-4 sm:p-[18px]"
            >
              {seller?.storeLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={seller.storeLogo}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-[14px] object-cover"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-line bg-surface-2">
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

            {!isOwnListing ? (
              <div className="border-t border-line px-4 py-3 sm:px-[18px]">
                <button
                  type="button"
                  onClick={() => requireAccount("message")}
                  disabled={messaging}
                  className="flex h-11 w-full items-center justify-center gap-2 border border-white/12 bg-surface-2 text-sm font-bold disabled:opacity-60"
                >
                  <MessageCircle className="h-4 w-4 text-ai-green" />
                  {messaging ? "Opening chat…" : "Message seller"}
                </button>
                {msgError ? (
                  <p className="mt-2 text-center text-[12px] text-error">{msgError}</p>
                ) : null}
              </div>
            ) : (
              <div className="border-t border-line px-4 py-3 sm:px-[18px]">
                <p className="text-center text-[12px] text-muted">This is your listing</p>
                <Link
                  href={`/seller/products/${product._id}/edit`}
                  className="mt-2 flex h-11 w-full items-center justify-center border border-white/12 bg-surface-2 text-sm font-bold"
                >
                  Edit product
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="z-40 shrink-0 border-t border-white/6 bg-bg/97 px-3 py-2 backdrop-blur sm:px-4 lg:px-6 pb-[max(8px,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-6xl items-center gap-1.5 sm:gap-2.5">
          {!isOwnListing ? (
            <button
              type="button"
              onClick={() => requireAccount("message")}
              disabled={messaging}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-surface-2 sm:h-12 sm:w-12"
              aria-label="Message seller"
            >
              <MessageCircle className="h-[18px] w-[18px]" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => requireAccount("bag")}
            className="h-11 min-w-0 flex-1 rounded-full border border-white/12 bg-surface-2 px-2 text-[12px] font-bold whitespace-nowrap sm:h-12 sm:text-sm"
          >
            Add to Bag
          </button>
          <button
            type="button"
            onClick={() => requireAccount("buy")}
            className="h-11 min-w-0 flex-1 rounded-full bg-white px-2 text-[12px] font-extrabold whitespace-nowrap text-bg sm:h-12 sm:text-sm"
          >
            Buy Now
          </button>
          <Link
            href="/cart"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface-2 sm:h-12 sm:w-12"
          >
            <ShoppingBag className="h-[18px] w-[18px]" />
            {bagCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-[17px] rounded-full bg-ai-green px-1 text-center text-[9.5px] font-extrabold text-bg">
                {bagCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {shareOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-6">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto border border-white/10 bg-[#11141A] sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3.5">
              <p className="text-[15px] font-bold">Share product</p>
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
                ]
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
                <Share2 className="h-4 w-4 text-ai-green" />
                {shareBusy ? "Preparing…" : "Share via device"}
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-[#171B22] px-4 py-3 text-left text-sm font-semibold"
              >
                {copied ? (
                  <>
                    <Copy className="h-4 w-4 text-ai-green" /> Link copied
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
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto border border-white/10 bg-[#11141A] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div className="min-w-0">
                <p className="text-[16px] font-extrabold leading-snug">{gate.title}</p>
                <p className="mt-1.5 text-[13px] leading-5 text-white/55">{gate.body}</p>
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
              <button
                type="button"
                disabled={googleBusy}
                onClick={continueGoogle}
                className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-white text-[14px] font-bold text-[#1F1F1F]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={GOOGLE_G} alt="" className="h-5 w-5" />
                {googleBusy ? "Connecting…" : "Continue with Google"}
              </button>
              <Link
                href={signInHref}
                className="flex h-12 w-full items-center justify-center rounded-xl border border-white/12 bg-[#171B22] text-[14px] font-bold"
              >
                Sign in
              </Link>
              <Link
                href={signUpHref}
                className="flex h-12 w-full items-center justify-center rounded-xl text-[14px] font-bold text-[#00E575]"
              >
                Create a Plazore account
              </Link>
              <p className="pt-1 text-center text-[11px] leading-4 text-white/38">
                Already on Plazore? Sign in and you’ll land back on this product.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <AppFeaturePrompt feature={prompt} onClose={() => setPrompt(null)} />
    </div>
  );
}

export function ProductMissing() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-8 text-center text-text">
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