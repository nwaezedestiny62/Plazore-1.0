"use client";

import { useAuth } from "@clerk/nextjs";
import {
  CheckCircle2,
  ChevronLeft,
  FileUp,
  Footprints,
  ImagePlus,
  Store,
  Trash2,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMarketplace } from "@/context/MarketplaceContext";
import {
  buildFulfillmentLocation,
  FULFILLMENT_COUNTRIES,
  getCitiesForState,
  getStatesForCountry,
} from "@/lib/locations";
import {
  CATEGORY_LIST,
  PLAN_FEES,
  PLAN_IMAGE_LIMITS,
  PRODUCT_CATEGORIES,
} from "@/lib/productCatalog";
import {
  categoryNeedsDocs,
  getDocTypes,
  getSpecFields,
} from "@/lib/productSpecs";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const API_ORIGIN = API.replace(/\/api\/?$/, "");
const CURRENT_PLAN = "free" as keyof typeof PLAN_IMAGE_LIMITS;

type OverlayTone = "info" | "success" | "danger";
type Overlay = { title: string; message?: string; tone?: OverlayTone } | null;

type ImageItem =
  | { id: string; type: "remote"; uri: string }
  | { id: string; type: "local"; uri: string; file: File };

type ExistingDoc = {
  documentName: string;
  documentType: string;
  secureUrl: string;
};

type LocalDoc = { file: File; name: string; type: string };

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeImageUrl(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return "";
    if (
      s.startsWith("http://") ||
      s.startsWith("https://") ||
      s.startsWith("blob:") ||
      s.startsWith("data:")
    ) {
      return s;
    }
    if (s.startsWith("//")) return `https:${s}`;
    if (s.startsWith("/")) return `${API_ORIGIN}${s}`;
    return s;
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return normalizeImageUrl(
      o.secure_url ??
        o.secureUrl ??
        o.url ??
        o.uri ??
        o.path ??
        o.src ??
        o.image ??
        o.original
    );
  }
  return "";
}

/** First URL in the returned list is always the cover. */
function extractImageList(p: any): string[] {
  if (!p || typeof p !== "object") return [];

  const candidates = [
    p.images,
    p.imageUrls,
    p.photos,
    p.gallery,
    p.media,
  ];

  let list: unknown[] = [];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) {
      list = c;
      break;
    }
  }

  const urls = list.map(normalizeImageUrl).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }

  if (out.length === 0) {
    const single = normalizeImageUrl(
      p.coverImage ||
        p.cover ||
        p.image ||
        p.thumbnail ||
        p.mainImage ||
        p.primaryImage
    );
    if (single) out.push(single);
  }

  return out;
}

function normalizeSpecs(raw: any): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v != null && String(v).trim()) out[String(k)] = String(v);
    }
    return out;
  }
  return {};
}

async function readJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      `Expected JSON, got ${res.status}. Body starts: ${text.slice(0, 80)}`
    );
  }
  return res.json();
}

function TopOverlay({
  state,
  onDismiss,
}: {
  state: Overlay;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(onDismiss, 3800);
    return () => clearTimeout(t);
  }, [state, onDismiss]);

  if (!state) return null;
  const accent =
    state.tone === "danger"
      ? "#EF4444"
      : state.tone === "success"
        ? "#00E575"
        : "#3B82F6";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] px-3.5 pt-3 md:px-6">
      <div className="pointer-events-auto mx-auto flex max-w-lg overflow-hidden border border-white/10 bg-[#11141A]">
        <div className="w-[3px] shrink-0" style={{ backgroundColor: accent }} />
        <div className="flex flex-1 gap-2.5 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text">{state.title}</p>
            {state.message && (
              <p className="mt-0.5 text-[12.5px] leading-[18px] text-[#A7ADB8]">
                {state.message}
              </p>
            )}
          </div>
          <button type="button" onClick={onDismiss} className="text-[#737A86]">
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-3.5 border border-line bg-surface p-4 md:p-5">
      <div className="mb-3.5 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-green to-blue text-[12px] font-extrabold text-[#041412]">
          {step}
        </div>
        <div>
          <p className="text-base font-bold text-text">{title}</p>
          {subtitle && <p className="text-[11px] text-[#737A86]">{subtitle}</p>}
        </div>
      </div>
      <div className="mb-3.5 h-px bg-line" />
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
      {children}
    </p>
  );
}

const inputCls =
  "mb-3 w-full rounded-[14px] border border-line bg-[#0A121C] px-3.5 py-[13px] text-[15px] text-text outline-none placeholder:text-[#3D5268] focus:border-green/40";

const pillCls = (on: boolean) =>
  `mr-2 mb-2 inline-flex rounded-full border px-3 py-2 text-xs font-medium transition ${
    on
      ? "border-green/35 bg-green/12 font-bold text-green"
      : "border-line bg-[#0A121C] text-[#737A86]"
  }`;

function SafeImg({
  src,
  alt = "",
  className,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-[#E5E7EB] ${className || ""}`}
      >
        <ImagePlus className="h-6 w-6 text-[#9CA3AF]" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

type BuyerPreviewProps = {
  images: string[];
  name: string;
  brand: string;
  storeName: string;
  category: string;
  subCategory: string;
  description: string;
  priceLabel: string;
  stockN: number;
  shipsFrom: string | null;
  shippingMethod: "self" | "courier" | null;
  courierCompany: string;
  deliveryFeeLabel: string;
};

function BuyerLivePreview({
  images,
  name,
  brand,
  storeName,
  category,
  subCategory,
  description,
  priceLabel,
  stockN,
  shipsFrom,
  shippingMethod,
  courierCompany,
  deliveryFeeLabel,
}: BuyerPreviewProps) {
  const cover = images[0] || "";
  const [idx, setIdx] = useState(0);
  const shown =
    images[Math.min(idx, Math.max(images.length - 1, 0))] || cover || "";

  useEffect(() => {
    setIdx(0);
  }, [images.join("|")]);

  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[2px] text-[#737A86]">
        Live preview
      </p>
      <p className="mb-3 text-lg font-extrabold text-text">What buyers will see</p>

      <div className="mb-4 border border-line bg-[#0A121C] p-3.5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
          Showroom card · cover = first photo
        </p>
        <div className="w-[150px]">
          <div className="relative aspect-[1/1.35] overflow-hidden bg-[#F1F1F1]">
            <SafeImg src={cover} className="h-full w-full object-cover" />
            <div className="absolute bottom-[11px] right-[11px] flex h-[34px] w-[34px] items-center justify-center bg-white shadow">
              <span className="text-[10px] font-bold text-[#111]">Bag</span>
            </div>
          </div>
          <p className="mt-2.5 truncate text-[13.5px] font-medium text-white">
            {name || "Product name"}
          </p>
          <p className="text-xs text-white/65">
            {(brand || storeName || "plazore").toLowerCase()} |{" "}
            <span className="font-medium text-white">{priceLabel}</span>
          </p>
          {shipsFrom ? (
            <p className="mt-1 truncate text-[11px] text-white/42">{shipsFrom}</p>
          ) : (
            <p className="mt-1 text-[11px] text-white/30">Ships from…</p>
          )}
        </div>
      </div>

      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
        Mobile product screen
      </p>
      <div className="overflow-hidden rounded-[28px] border-[3px] border-[#2C313A] bg-[#12141A] p-2 shadow-2xl">
        <div className="mx-auto mb-1 h-3.5 w-[78px] rounded-lg bg-black" />
        <div className="max-h-[520px] overflow-y-auto rounded-[22px] bg-bg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="relative aspect-[1/1.05] overflow-hidden bg-[#07080C]">
            <SafeImg src={shown} className="h-full w-full object-cover" />
            {images.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                {images.slice(0, 6).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIdx(i)}
                    className={`h-[4px] rounded-full ${
                      i === idx ? "w-4 bg-white" : "w-1.5 bg-white/30"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="p-3.5">
            {(category || subCategory) && (
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[1.2px] text-[#737A86]">
                {[category, subCategory].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="text-lg font-bold leading-6 text-text">
              {name || "Product name"}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xl font-bold text-text">{priceLabel}</p>
              <span
                className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                  stockN > 0
                    ? "border-blue/28 bg-ai-green/10 text-ai-green"
                    : "border-red-400/28 bg-red-400/10 text-red-400"
                }`}
              >
                {stockN > 0 ? `Available · ${stockN}` : "Unavailable"}
              </span>
            </div>
            {!!brand && (
              <span className="mt-2 inline-block rounded-full border border-line bg-[#171B22] px-2.5 py-1 text-xs text-[#A7ADB8]">
                {brand}
              </span>
            )}

            {!!description.trim() && (
              <>
                <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-text">
                  About
                </p>
                <div className="rounded-[14px] border border-line bg-surface p-3 text-[13px] leading-[19px] text-[#A7ADB8]">
                  {description}
                </div>
              </>
            )}

            <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-text">
              Sold by
            </p>
            <div className="flex items-center gap-2.5 rounded-[14px] border border-line bg-surface p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#171B22]">
                <Store className="h-4 w-4 text-[#A7ADB8]" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#737A86]">
                  Visit storefront
                </p>
                <p className="text-sm font-bold text-text">
                  {storeName || brand || "Your store"}
                </p>
              </div>
            </div>

            <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-text">
              Delivery
            </p>
            <div className="rounded-[14px] border border-line bg-surface p-3">
              <div className="flex items-center gap-2">
                {shippingMethod === "courier" ? (
                  <Truck className="h-4 w-4 text-green" />
                ) : (
                  <Footprints className="h-4 w-4 text-green" />
                )}
                <p className="text-[13px] font-semibold text-text">
                  {shippingMethod === "courier"
                    ? courierCompany || "Courier"
                    : shippingMethod === "self"
                      ? "Self delivery"
                      : "Shipping"}
                </p>
                <p className="ml-auto text-[13px] font-bold text-text">
                  {deliveryFeeLabel}
                </p>
              </div>
              <p className="mt-1.5 text-[11px] leading-[16px] text-[#737A86]">
                {shipsFrom || "Set fulfillment location"}
              </p>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2">
              <span className="flex h-11 items-center justify-center border border-line text-[11px] font-bold uppercase tracking-wide text-text">
                Add to bag
              </span>
              <span className="flex h-11 items-center justify-center bg-text text-[11px] font-extrabold uppercase tracking-wide text-bg">
                Buy now
              </span>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-white/15" />
      </div>
    </div>
  );
}

export default function EditProductPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { region, formatProduct } = useMarketplace();
  const router = useRouter();

  const maxImages = PLAN_IMAGE_LIMITS[CURRENT_PLAN] ?? 6;
  const feePct = PLAN_FEES[CURRENT_PLAN] ?? 8;

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [storeName, setStoreName] = useState("");

  const [images, setImages] = useState<ImageItem[]>([]);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [specs, setSpecs] = useState<Record<string, string>>({});
  const [existingDocs, setExistingDocs] = useState<ExistingDoc[]>([]);
  const [newDocuments, setNewDocuments] = useState<LocalDoc[]>([]);

  const [fulfillCountryCode, setFulfillCountryCode] = useState("");
  const [fulfillStateCode, setFulfillStateCode] = useState("");
  const [fulfillCity, setFulfillCity] = useState("");
  const [shippingMethod, setShippingMethod] = useState<"self" | "courier" | null>(
    null
  );
  const [courierCompany, setCourierCompany] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");

  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const blobUrlsRef = useRef<Set<string>>(new Set());

  const toast = useCallback(
    (title: string, message?: string, tone: OverlayTone = "info") => {
      setOverlay({ title, message, tone });
    },
    []
  );

  const revokeBlobUri = useCallback((uri: string) => {
    if (!uri?.startsWith("blob:")) return;
    try {
      URL.revokeObjectURL(uri);
    } catch {
      /* ignore */
    }
    blobUrlsRef.current.delete(uri);
  }, []);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
      blobUrlsRef.current.clear();
    };
  }, []);

  const applyProduct = useCallback(
    (p: any, opts?: { allowEmptyImages?: boolean }) => {
      setName(p.name || "");
      setBrand(p.brand || "");
      setPrice(p.price != null ? String(p.price) : "");
      setStock(p.stock != null ? String(p.stock) : "1");
      setDescription(p.description || "");
      setCategory(p.category || "");
      setSubCategory(p.subCategory || "");
      setSpecs(normalizeSpecs(p.specifications));

      const urls = extractImageList(p);
      setImages((prev) => {
        // Never wipe a working gallery with an empty server payload
        if (!urls.length && prev.length && !opts?.allowEmptyImages) {
          return prev;
        }
        prev.forEach((item) => {
          if (item.type === "local") revokeBlobUri(item.uri);
        });
        return urls.map((uri) => ({
          id: uid(),
          type: "remote" as const,
          uri,
        }));
      });

      setExistingDocs(
        (p.documents || p.verificationDocuments || [])
          .map((d: any) => ({
            documentName: d.documentName || d.name || "Document",
            documentType: d.documentType || d.type || "other",
            secureUrl: normalizeImageUrl(
              d.secureUrl || d.url || d.secure_url || ""
            ),
          }))
          .filter((d: ExistingDoc) => d.documentName)
      );

      const ship = p.shipping || {};
      const method = ship.method || ship.deliveryMethod || null;
      setShippingMethod(
        method === "self" || method === "courier" ? method : null
      );
      setCourierCompany(
        String(ship.courier || ship.courierCompany || ship.courierName || "")
      );
      setDeliveryFee(
        ship.deliveryFee != null && ship.deliveryFee !== ""
          ? String(ship.deliveryFee)
          : ""
      );

      const loc = p.fulfillmentLocation || p.shipsFromLocation || {};
      const countryCode =
        loc.countryCode ||
        FULFILLMENT_COUNTRIES.find(
          (c) => c.name === loc.country || c.code === loc.country
        )?.code ||
        "";
      setFulfillCountryCode(countryCode);
      setFulfillStateCode(loc.stateCode || "");
      setFulfillCity(loc.city || "");
    },
    [revokeBlobUri]
  );

  const fetchProduct = useCallback(
    async (token: string) => {
      let product: any = null;
      try {
        const prodRaw = await fetch(`${API}/seller/products/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (prodRaw.ok) {
          const prodRes = await readJson(prodRaw);
          product = prodRes?.data || prodRes?.product || prodRes;
          if (prodRes?.success === false) product = null;
        }
      } catch (e) {
        console.warn("GET /seller/products/:id failed", e);
      }

      if (!product) {
        const listRaw = await fetch(`${API}/seller/products`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const listRes = await readJson(listRaw);
        const list = Array.isArray(listRes?.data)
          ? listRes.data
          : listRes?.data?.products || [];
        product = list.find((x: any) => String(x._id || x.id) === String(id));
      }
      return product;
    },
    [id]
  );

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const token = await getToken();
      if (!token) return;

      try {
        const storeRaw = await fetch(`${API}/seller/store`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (storeRaw.ok) {
          const storeRes = await readJson(storeRaw);
          if (storeRes?.success && storeRes.data?.storeName) {
            setStoreName(storeRes.data.storeName);
          }
        }
      } catch {
        /* ignore */
      }

      const product = await fetchProduct(token);
      if (!product) {
        toast("Error", "Product not found", "danger");
        return;
      }
      applyProduct(product, { allowEmptyImages: true });
    } catch (e: any) {
      console.error(e);
      toast(
        "Error",
        e?.message || "Could not load product. Check API URL.",
        "danger"
      );
    } finally {
      setPageLoading(false);
    }
  }, [id, getToken, toast, applyProduct, fetchProduct]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      if (isLoaded && !isSignedIn) setPageLoading(false);
      return;
    }
    load();
  }, [isLoaded, isSignedIn, load]);

  const subCats = category ? PRODUCT_CATEGORIES[category] || [] : [];
  const specFields = useMemo(() => getSpecFields(category), [category]);
  const needsDocs = categoryNeedsDocs(category);
  const docTypes = useMemo(() => getDocTypes(category), [category]);
  const fulfillStates = useMemo(
    () => getStatesForCountry(fulfillCountryCode),
    [fulfillCountryCode]
  );
  const fulfillCities = useMemo(
    () => getCitiesForState(fulfillCountryCode, fulfillStateCode),
    [fulfillCountryCode, fulfillStateCode]
  );

  const previewImages = useMemo(
    () => images.map((i) => i.uri).filter(Boolean),
    [images]
  );

  const shipsFrom = useMemo(() => {
    if (!fulfillCountryCode || !fulfillCity) return null;
    const c = FULFILLMENT_COUNTRIES.find((x) => x.code === fulfillCountryCode);
    return buildFulfillmentLocation({
      countryCode: fulfillCountryCode,
      country: c?.name || "",
      stateCode: fulfillStateCode,
      state: fulfillStates.find((s) => s.code === fulfillStateCode)?.name || "",
      city: fulfillCity,
    }).displayLabel;
  }, [fulfillCountryCode, fulfillStateCode, fulfillCity, fulfillStates]);

  const priceN = Number(price) || 0;
  const stockN = Math.max(0, parseInt(stock || "0", 10) || 0);
  const feeN = Number(deliveryFee) || 0;

  const formatPreviewPrice = useCallback(
    (n: number) => {
      try {
        return formatProduct(n, region as any);
      } catch {
        return String(n);
      }
    },
    [formatProduct, region]
  );

  const deliveryFeeLabel =
    deliveryFee === ""
      ? "—"
      : feeN === 0
        ? "Free delivery"
        : formatPreviewPrice(feeN);

  const previewProps: BuyerPreviewProps = {
    images: previewImages,
    name,
    brand,
    storeName,
    category,
    subCategory,
    description,
    priceLabel: formatPreviewPrice(priceN),
    stockN,
    shipsFrom,
    shippingMethod,
    courierCompany,
    deliveryFeeLabel,
  };

  const onImages = (files: FileList | null) => {
    if (!files?.length) return;
    setImages((prev) => {
      const next = [...prev];
      for (const f of Array.from(files)) {
        if (next.length >= maxImages) break;
        if (!f.type.startsWith("image/")) continue;
        const uri = URL.createObjectURL(f);
        blobUrlsRef.current.add(uri);
        next.push({ id: uid(), type: "local", uri, file: f });
      }
      return next;
    });
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeImage = (i: number) => {
    setImages((prev) => {
      const item = prev[i];
      if (item?.type === "local") revokeBlobUri(item.uri);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  /** First slot is always cover — move any photo to front. */
  const setAsCover = (i: number) => {
    if (i <= 0) return;
    setImages((prev) => {
      if (i >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(i, 1);
      next.unshift(item);
      return next;
    });
  };

  const onDocs = (files: FileList | null) => {
    if (!files?.length) return;
    setNewDocuments((prev) => {
      const next = [...prev];
      for (const f of Array.from(files)) {
        if (existingDocs.length + next.length >= 5) break;
        next.push({
          file: f,
          name: f.name,
          type: docTypes[0]?.id || "other",
        });
      }
      return next;
    });
    if (docInputRef.current) docInputRef.current.value = "";
  };

  const validate = () => {
    if (!images.length) return "Add at least one product image";
    if (!images[0]?.uri) return "Cover image is missing — add a photo";
    if (!name.trim()) return "Product name is required";
    if (!priceN || priceN <= 0) return "Enter a valid price";
    if (!category) return "Select a category";
    if (!fulfillCountryCode || !fulfillCity) return "Set fulfillment location";
    if (!shippingMethod) return "Choose a shipping method";
    if (shippingMethod === "courier" && !courierCompany.trim())
      return "Courier company is required";
    if (deliveryFee === "" || feeN < 0) return "Enter delivery fee (0 allowed)";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast("Check form", err, "danger");
      return;
    }
    try {
      setSaving(true);
      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("brand", brand.trim());
      fd.append("price", String(priceN));
      fd.append("stock", String(stockN));
      fd.append("description", description.trim());
      fd.append("category", category);
      fd.append("subCategory", subCategory);
      fd.append("region", region || "NG");
      fd.append("specifications", JSON.stringify(specs));
      fd.append(
        "shipping",
        JSON.stringify({
          method: shippingMethod,
          courier: courierCompany.trim(),
          courierCompany: courierCompany.trim(),
          deliveryFee: feeN,
        })
      );

      const country = FULFILLMENT_COUNTRIES.find(
        (c) => c.code === fulfillCountryCode
      );
      fd.append(
        "fulfillmentLocation",
        JSON.stringify(
          buildFulfillmentLocation({
            countryCode: fulfillCountryCode,
            country: country?.name || "",
            stateCode: fulfillStateCode,
            state:
              fulfillStates.find((s) => s.code === fulfillStateCode)?.name || "",
            city: fulfillCity,
          })
        )
      );

            // Flat fields so backend never misses shipping / fulfillment
      if (shippingMethod) {
        fd.append("shippingMethod", shippingMethod);
        fd.append("courierCompany", courierCompany.trim());
        fd.append("courier", courierCompany.trim());
        fd.append("deliveryFee", String(feeN));
      }

      fd.append("fulfillmentCountryCode", fulfillCountryCode);
      fd.append(
        "fulfillmentCountry",
        FULFILLMENT_COUNTRIES.find((c) => c.code === fulfillCountryCode)?.name ||
          ""
      );
      fd.append("fulfillmentStateCode", fulfillStateCode);
      fd.append(
        "fulfillmentState",
        fulfillStates.find((s) => s.code === fulfillStateCode)?.name || ""
      );
      fd.append("fulfillmentCity", fulfillCity);

      /**
       * Preserve visual order. Index 0 = cover.
       * existingImages = remote URLs still kept (same order as on screen among remotes).
       * imageOrder = full sequence so backend can interleave new uploads correctly.
       */
      const keepUrls: string[] = [];
      const newFiles: File[] = [];
      const imageOrder: Array<
        | { kind: "existing"; url: string }
        | { kind: "new"; index: number }
      > = [];

      for (const item of images) {
        if (item.type === "remote" && item.uri) {
          keepUrls.push(item.uri);
          imageOrder.push({ kind: "existing", url: item.uri });
        } else if (item.type === "local" && item.file) {
          const index = newFiles.length;
          newFiles.push(item.file);
          imageOrder.push({ kind: "new", index });
        }
      }

      const cover =
        images[0]?.type === "remote"
          ? images[0].uri
          : images[0]?.type === "local"
            ? "__new_0__"
            : "";

      fd.append("existingImages", JSON.stringify(keepUrls));
      fd.append("keepImages", JSON.stringify(keepUrls));
      fd.append("imagesToKeep", JSON.stringify(keepUrls));
      fd.append("imageOrder", JSON.stringify(imageOrder));
      fd.append("coverImage", cover);
      fd.append("coverIndex", "0");

      newFiles.forEach((file, i) => {
        fd.append("images", file, file.name || `image-${i}.jpg`);
      });

      fd.append("existingDocuments", JSON.stringify(existingDocs));
      newDocuments.forEach((d, i) => {
        fd.append("documents", d.file, d.file.name);
        fd.append(`documentTypes[${i}]`, d.type);
        fd.append(`documentNames[${i}]`, d.name);
      });

      const res = await fetch(`${API}/seller/products/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const json = await readJson(res);

      if (!res.ok || json?.success === false) {
        toast(
          "Error",
          json?.message || `Could not save product (${res.status})`,
          "danger"
        );
        return;
      }

      // Always re-fetch so list/cover match what Mongo actually stored
      const fresh = await fetchProduct(token);
      if (fresh) {
        applyProduct(fresh, { allowEmptyImages: true });
        setNewDocuments([]);
      } else if (json?.data || json?.product) {
        applyProduct(json.data || json.product);
        setNewDocuments([]);
      }

      toast("Saved", "Product updated — cover is the first photo", "success");
      setTimeout(() => router.push("/seller/products"), 700);
    } catch (e: any) {
      console.error(e);
      toast("Error", e?.message || "Could not save product", "danger");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded || pageLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-bg">
        <div className="relative flex h-[110px] w-[110px] items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-[2.4px] border-transparent border-t-green border-r-blue border-l-green" />
          <div className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-green/10">
            <Store className="h-6 w-6 text-green" />
          </div>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center bg-bg px-6 text-center">
        <p className="font-semibold text-text">Sign in to edit products</p>
        <Link
          href="/sign-in"
          className="mt-4 rounded-full bg-text px-6 py-2.5 text-sm font-bold text-bg"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <TopOverlay state={overlay} onDismiss={() => setOverlay(null)} />

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/seller/products"
            className="flex h-10 w-10 items-center justify-center border border-line bg-surface text-[#A7ADB8] hover:text-text"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[2px] text-[#737A86]">
              Seller Lounge
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-[26px]">
              Edit product
            </h1>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
          <div>
            <div className="mb-5 lg:hidden">
              <BuyerLivePreview {...previewProps} />
            </div>

            <Section
              step="01"
              title="Images"
              subtitle={`Up to ${maxImages} · first photo is always the cover`}
            >
              <div className="flex flex-wrap gap-2">
                {images.map((item, i) => (
                  <div
                    key={item.id}
                    className={`relative h-[104px] w-[104px] overflow-hidden rounded-[14px] bg-[#0A121C] ${
                      i === 0 ? "ring-2 ring-[#00E575]" : ""
                    }`}
                  >
                    <SafeImg
                      src={item.uri}
                      className="h-full w-full object-cover"
                    />
                    {i === 0 ? (
                      <span className="absolute left-1 top-1 rounded bg-[#00E575] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#041412]">
                        Cover
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAsCover(i)}
                        className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                      >
                        Make cover
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute right-1 top-1 rounded bg-black/70 p-1 text-white"
                      aria-label="Remove image"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {images.length < maxImages && (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[#2A4560] bg-[#0A121C] text-[#737A86]"
                  >
                    <ImagePlus className="h-6 w-6" />
                    <span className="mt-1 text-[11px]">Add</span>
                  </button>
                )}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onImages(e.target.files)}
              />
              <p className="mt-2 text-[12px] text-[#737A86]">
                The first image is the cover on the product list and showroom.
                Use “Make cover” to move another photo to the front.
              </p>
            </Section>

            <Section step="02" title="Basics">
              <Label>Product name *</Label>
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Label>Brand</Label>
              <input
                className={inputCls}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Price *</Label>
                  <input
                    className={inputCls}
                    value={price}
                    onChange={(e) =>
                      setPrice(e.target.value.replace(/[^0-9.]/g, ""))
                    }
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <Label>Stock *</Label>
                  <input
                    className={inputCls}
                    value={stock}
                    onChange={(e) =>
                      setStock(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    inputMode="numeric"
                  />
                </div>
              </div>
              <Label>Description</Label>
              <textarea
                className={`${inputCls} min-h-[100px]`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </Section>

            <Section step="03" title="Category & specs">
              <Label>Category *</Label>
              <div className="mb-3 flex flex-wrap">
                {CATEGORY_LIST.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCategory(c);
                      setSubCategory("");
                      setSpecs({});
                    }}
                    className={pillCls(category === c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {!!subCats.length && (
                <>
                  <Label>Sub-category</Label>
                  <div className="mb-3 flex flex-wrap">
                    {subCats.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSubCategory(s)}
                        className={pillCls(subCategory === s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {!!category &&
                specFields.map((f) => (
                  <div key={f.key}>
                    <Label>
                      {f.label}
                      {f.optional ? "" : " *"}
                    </Label>
                    <input
                      className={inputCls}
                      value={specs[f.key] || ""}
                      onChange={(e) =>
                        setSpecs((prev) => ({
                          ...prev,
                          [f.key]: e.target.value,
                        }))
                      }
                      placeholder={f.placeholder}
                    />
                  </div>
                ))}
            </Section>

            {needsDocs && (
              <Section
                step="04"
                title="Documents"
                subtitle="Required for this category"
              >
                {existingDocs.map((doc, index) => (
                  <div
                    key={`ex-${index}`}
                    className="mb-2.5 rounded-[14px] border border-line bg-[#0A121C] p-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-text">
                          {doc.documentName}
                        </p>
                        <p className="text-[11px] capitalize text-[#737A86]">
                          {doc.documentType.replace(/_/g, " ")} · saved
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setExistingDocs((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4 text-[#FF8A9A]" />
                      </button>
                    </div>
                  </div>
                ))}
                {newDocuments.map((doc, index) => (
                  <div
                    key={`new-${index}`}
                    className="mb-2.5 rounded-[14px] border border-line bg-[#0A121C] p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-[13px] text-text">
                        {doc.name}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setNewDocuments((p) => p.filter((_, i) => i !== index))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-[#FF8A9A]" />
                      </button>
                    </div>
                    <div className="flex flex-wrap">
                      {docTypes.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            setNewDocuments((prev) =>
                              prev.map((d, i) =>
                                i === index ? { ...d, type: t.id } : d
                              )
                            )
                          }
                          className={pillCls(doc.type === t.id)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {existingDocs.length + newDocuments.length < 5 && (
                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    className="flex w-full flex-col items-center rounded-[14px] border border-dashed border-[#2A4560] py-4 text-[#737A86]"
                  >
                    <FileUp className="h-[22px] w-[22px]" />
                    <span className="mt-1 text-xs">Add document</span>
                  </button>
                )}
                <input
                  ref={docInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(e) => onDocs(e.target.files)}
                />
              </Section>
            )}

            <Section
              step={needsDocs ? "05" : "04"}
              title="Fulfillment location"
              subtitle="Where this ships from"
            >
              <Label>Country *</Label>
              <div className="mb-3 flex flex-wrap">
                {FULFILLMENT_COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setFulfillCountryCode(c.code);
                      setFulfillStateCode("");
                      setFulfillCity("");
                    }}
                    className={pillCls(fulfillCountryCode === c.code)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              {fulfillStates.length > 0 && (
                <>
                  <Label>State / Province *</Label>
                  <div className="mb-3 flex flex-wrap">
                    {fulfillStates.map((s) => (
                      <button
                        key={s.code}
                        type="button"
                        onClick={() => {
                          setFulfillStateCode(s.code);
                          setFulfillCity("");
                        }}
                        className={pillCls(fulfillStateCode === s.code)}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {!!fulfillCountryCode &&
                (fulfillStates.length === 0 || !!fulfillStateCode) && (
                  <>
                    <Label>City *</Label>
                    <div className="mb-2 flex flex-wrap gap-2">
                      {fulfillCities.map((city) => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => setFulfillCity(city)}
                          className={pillCls(fulfillCity === city)}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </>
                )}
            </Section>

            <Section step={needsDocs ? "06" : "05"} title="Shipping method">
              <div className="mb-3.5 grid grid-cols-2 gap-2.5">
                {(["self", "courier"] as const).map((m) => {
                  const active = shippingMethod === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setShippingMethod(m)}
                      className={`flex flex-col items-center rounded-[14px] border py-4 ${
                        active
                          ? "border-green/40 bg-green/8"
                          : "border-line bg-[#0A121C]"
                      }`}
                    >
                      {m === "self" ? (
                        <Footprints
                          className={`h-5 w-5 ${active ? "text-green" : "text-[#737A86]"}`}
                        />
                      ) : (
                        <Truck
                          className={`h-5 w-5 ${active ? "text-green" : "text-[#737A86]"}`}
                        />
                      )}
                      <span
                        className={`mt-2 text-[13px] font-semibold ${
                          active ? "text-text" : "text-[#737A86]"
                        }`}
                      >
                        {m === "self" ? "Self delivery" : "Courier"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {shippingMethod === "courier" && (
                <>
                  <Label>Courier company *</Label>
                  <input
                    className={inputCls}
                    value={courierCompany}
                    onChange={(e) => setCourierCompany(e.target.value)}
                    placeholder="e.g. DHL, GIG, FedEx"
                  />
                </>
              )}
              {!!shippingMethod && (
                <>
                  <Label>Delivery fee *</Label>
                  <input
                    className={inputCls}
                    value={deliveryFee}
                    onChange={(e) =>
                      setDeliveryFee(e.target.value.replace(/[^0-9.]/g, ""))
                    }
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </>
              )}
            </Section>

            <Section step={needsDocs ? "07" : "06"} title="Save changes">
              <div className="mb-1.5 flex justify-between text-[13px]">
                <span className="text-[#737A86]">Plan</span>
                <span className="font-semibold capitalize text-text">
                  {CURRENT_PLAN}
                </span>
              </div>
              <div className="mb-1 flex justify-between text-[13px]">
                <span className="text-[#737A86]">Transaction fee</span>
                <span className="font-semibold text-text">
                  {feePct}% of product price
                </span>
              </div>
              <p className="text-[11px] text-[#737A86]">
                Fee applies only to product price — never delivery.
              </p>
            </Section>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="mb-8 flex h-14 w-full items-center justify-center gap-2 bg-gradient-to-r from-green to-blue text-[15px] font-extrabold text-[#041412] disabled:opacity-60"
            >
              {saving ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#041412]/30 border-t-[#041412]" />
              ) : (
                <>
                  <CheckCircle2 className="h-[18px] w-[18px]" />
                  Save product
                </>
              )}
            </button>
          </div>

          <div className="hidden lg:sticky lg:top-6 lg:block">
            <BuyerLivePreview {...previewProps} />
          </div>
        </div>
      </div>
    </div>
  );
}