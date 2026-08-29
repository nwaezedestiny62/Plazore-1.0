"use client";

import { useAuth } from "@clerk/nextjs";
import {
  CheckCircle2,
  ChevronLeft,
  FileUp,
  Footprints,   // ← not Walk
  ImagePlus,
  Rocket,
  Store,
  Trash2,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
const CURRENT_PLAN = "free" as keyof typeof PLAN_IMAGE_LIMITS;

type OverlayTone = "info" | "success" | "danger";
type Overlay = { title: string; message?: string; tone?: OverlayTone } | null;

type LocalDoc = { file: File; name: string; type: string };

function TopOverlay({ state, onDismiss }: { state: Overlay; onDismiss: () => void }) {
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [state, onDismiss]);
  if (!state) return null;
  const accent =
    state.tone === "danger" ? "#EF4444" : state.tone === "success" ? "#00E575" : "#3B82F6";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] px-3.5 pt-3 md:px-6">
      <div className="pointer-events-auto mx-auto flex max-w-lg overflow-hidden border border-white/10 bg-[#11141A]">
        <div className="w-[3px] shrink-0" style={{ backgroundColor: accent }} />
        <div className="flex flex-1 gap-2.5 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text">{state.title}</p>
            {state.message && (
              <p className="mt-0.5 text-[12.5px] leading-[18px] text-[#A7ADB8]">{state.message}</p>
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

export default function AddProductPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { region, formatProduct } = useMarketplace();
  const router = useRouter();

  const maxImages = PLAN_IMAGE_LIMITS[CURRENT_PLAN] ?? 6;
  const feePct = PLAN_FEES[CURRENT_PLAN] ?? 8;

  const [overlay, setOverlay] = useState<Overlay>(null);
  const [loading, setLoading] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [specs, setSpecs] = useState<Record<string, string>>({});
  const [documents, setDocuments] = useState<LocalDoc[]>([]);

  const [fulfillCountryCode, setFulfillCountryCode] = useState("");
  const [fulfillStateCode, setFulfillStateCode] = useState("");
  const [fulfillCity, setFulfillCity] = useState("");
  const [shippingMethod, setShippingMethod] = useState<"self" | "courier" | null>(null);
  const [courierCompany, setCourierCompany] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");

  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const toast = useCallback(
    (title: string, message?: string, tone: OverlayTone = "info") => {
      setOverlay({ title, message, tone });
    },
    []
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API}/seller/store`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json?.success && json.data?.storeName) setStoreName(json.data.storeName);
      } catch {
        /* ignore */
      }
    })();
  }, [isLoaded, isSignedIn, getToken]);

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

  const onImages = (files: FileList | null) => {
    if (!files?.length) return;
    const next = [...imageFiles];
    const urls = [...imageUrls];
    for (const f of Array.from(files)) {
      if (next.length >= maxImages) break;
      if (!f.type.startsWith("image/")) continue;
      next.push(f);
      urls.push(URL.createObjectURL(f));
    }
    setImageFiles(next);
    setImageUrls(urls);
  };

  const removeImage = (i: number) => {
    setImageFiles((p) => p.filter((_, idx) => idx !== i));
    setImageUrls((p) => {
      URL.revokeObjectURL(p[i]);
      return p.filter((_, idx) => idx !== i);
    });
  };

  const onDocs = (files: FileList | null) => {
    if (!files?.length) return;
    setDocuments((prev) => {
      const next = [...prev];
      for (const f of Array.from(files)) {
        if (next.length >= 5) break;
        next.push({
          file: f,
          name: f.name,
          type: docTypes[0]?.id || "other",
        });
      }
      return next;
    });
  };

  const validate = () => {
    if (!imageFiles.length) return "Add at least one product image";
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

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast("Check form", err, "danger");
      return;
    }
    try {
      setLoading(true);
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
      const country = FULFILLMENT_COUNTRIES.find((c) => c.code === fulfillCountryCode);
      fd.append(
        "fulfillmentLocation",
        JSON.stringify(
          buildFulfillmentLocation({
            countryCode: fulfillCountryCode,
            country: country?.name || "",
            stateCode: fulfillStateCode,
            state: fulfillStates.find((s) => s.code === fulfillStateCode)?.name || "",
            city: fulfillCity,
          })
        )
      );

      imageFiles.forEach((f) => fd.append("images", f));
      documents.forEach((d, i) => {
        fd.append("documents", d.file);
        fd.append(`documentTypes[${i}]`, d.type);
        fd.append(`documentNames[${i}]`, d.name);
      });

      const res = await fetch(`${API}/seller/products`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();

      if (json?.success) {
        const id = json.data?._id || json.data?.id || json.productId || "";
        setPublishedId(String(id));
        toast("Published", "Your product is live", "success");
      } else {
        toast("Error", json?.message || "Could not publish product", "danger");
      }
    } catch (e: any) {
      console.error(e);
      toast("Error", e?.message || "Could not publish product", "danger");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-green/30 border-t-green" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center bg-bg px-6 text-center">
        <p className="font-semibold text-text">Sign in to add products</p>
        <Link href="/sign-in" className="mt-4 rounded-full bg-text px-6 py-2.5 text-sm font-bold text-bg">
          Sign in
        </Link>
      </div>
    );
  }

  if (publishedId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
        <div className="mb-5 flex h-[88px] w-[88px] items-center justify-center rounded-full bg-gradient-to-br from-green to-blue p-[6px]">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-bg">
            <CheckCircle2 className="h-9 w-9 text-green" />
          </div>
        </div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-text">Product published</h1>
        <p className="mt-2 max-w-sm text-sm leading-[21px] text-[#A7ADB8]">
          {name || "Your product"} is live on Plazore.
        </p>
        <div className="mt-8 w-full max-w-sm space-y-3">
          <Link
            href={publishedId ? `/product/${publishedId}` : "/seller/products"}
            className="flex h-14 w-full items-center justify-center bg-gradient-to-r from-green to-blue text-[15px] font-extrabold text-[#041412]"
          >
            View product
          </Link>
          <button
            type="button"
            onClick={() => router.push("/seller/products")}
            className="flex h-12 w-full items-center justify-center border border-line bg-surface text-sm font-semibold text-text"
          >
            Back to products
          </button>
        </div>
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
            <h1 className="text-2xl font-extrabold tracking-tight md:text-[26px]">Add product</h1>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
          <div>
            {/* 01 Images */}
            <Section step="01" title="Images" subtitle={`Up to ${maxImages} photos`}>
              <div className="flex flex-wrap gap-2">
                {imageUrls.map((url, i) => (
                  <div key={url} className="relative h-[104px] w-[104px] overflow-hidden rounded-[14px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute right-1 top-1 rounded bg-black/70 p-1 text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {imageFiles.length < maxImages && (
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
            </Section>

            {/* 02 Basics */}
            <Section step="02" title="Basics">
              <Label>Product name *</Label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="What are you selling?" />
              <Label>Brand</Label>
              <input className={inputCls} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Optional brand" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Price *</Label>
                  <input
                    className={inputCls}
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <Label>Stock *</Label>
                  <input
                    className={inputCls}
                    value={stock}
                    onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="1"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <Label>Description</Label>
              <textarea
                className={`${inputCls} min-h-[100px]`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell buyers about this product..."
                rows={4}
              />
            </Section>

            {/* 03 Category + specs */}
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
                      setDocuments([]);
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
                        setSpecs((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      placeholder={f.placeholder}
                    />
                  </div>
                ))}
            </Section>

            {/* Docs */}
            {needsDocs && (
              <Section step="04" title="Documents" subtitle="Required for this category">
                {documents.map((doc, index) => (
                  <div key={`${doc.name}-${index}`} className="mb-2.5 rounded-[14px] border border-line bg-[#0A121C] p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-[13px] text-text">{doc.name}</p>
                      <button
                        type="button"
                        onClick={() => setDocuments((p) => p.filter((_, i) => i !== index))}
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
                            setDocuments((prev) =>
                              prev.map((d, i) => (i === index ? { ...d, type: t.id } : d))
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
                {documents.length < 5 && (
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

            {/* Fulfillment */}
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

            {/* Shipping */}
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
  <Footprints className={`h-5 w-5 ${active ? "text-green" : "text-[#737A86]"}`} />
) : (
  <Truck className={`h-5 w-5 ${active ? "text-green" : "text-[#737A86]"}`} />
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
                    onChange={(e) => setDeliveryFee(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </>
              )}
            </Section>

            {/* Publish */}
            <Section step={needsDocs ? "07" : "06"} title="Publish">
              <div className="mb-1.5 flex justify-between text-[13px]">
                <span className="text-[#737A86]">Plan</span>
                <span className="font-semibold capitalize text-text">{CURRENT_PLAN}</span>
              </div>
              <div className="mb-1 flex justify-between text-[13px]">
                <span className="text-[#737A86]">Transaction fee</span>
                <span className="font-semibold text-text">{feePct}% of product price</span>
              </div>
              <p className="text-[11px] text-[#737A86]">
                Fee applies only to product price — never delivery.
              </p>
            </Section>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="mb-8 flex h-14 w-full items-center justify-center gap-2 bg-gradient-to-r from-green to-blue text-[15px] font-extrabold text-[#041412] disabled:opacity-60"
            >
              {loading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#041412]/30 border-t-[#041412]" />
              ) : (
                <>
                  <Rocket className="h-[18px] w-[18px]" />
                  Publish product
                </>
              )}
            </button>
          </div>

          {/* Sticky live preview */}
          <div className="hidden lg:sticky lg:top-6 lg:block">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[2px] text-[#737A86]">
              Live preview
            </p>
            <p className="mb-3 text-lg font-extrabold text-text">What buyers will see</p>

            {/* Card */}
            <div className="mb-4 border border-line bg-[#0A121C] p-3.5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                Showroom card
              </p>
              <div className="w-[150px]">
                <div className="relative aspect-[1/1.35] bg-[#F1F1F1]">
                  {imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrls[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[#E5E7EB]">
                      <ImagePlus className="h-6 w-6 text-[#9CA3AF]" />
                    </div>
                  )}
                  <div className="absolute bottom-[11px] right-[11px] flex h-[34px] w-[34px] items-center justify-center bg-white shadow">
                    <span className="text-[10px] font-bold text-[#111]">Bag</span>
                  </div>
                </div>
                <p className="mt-2.5 truncate text-[13.5px] font-medium text-white">
                  {name || "Product name"}
                </p>
                <p className="text-xs text-white/65">
                  {(brand || storeName || "plazore").toLowerCase()} |{" "}
                  <span className="font-medium text-white">{formatPreviewPrice(priceN)}</span>
                </p>
                {shipsFrom && (
                  <p className="mt-1 truncate text-[11px] text-white/42">{shipsFrom}</p>
                )}
              </div>
            </div>

            {/* Mini product page */}
            <div className="overflow-hidden rounded-[28px] border-[3px] border-[#2C313A] bg-[#12141A] p-2 shadow-2xl">
              <div className="mx-auto mb-1 h-3.5 w-[78px] rounded-lg bg-black" />
              <div className="max-h-[420px] overflow-y-auto rounded-[22px] bg-bg">
                <div className="aspect-[1/1.05] bg-[#07080C]">
                  {imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrls[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImagePlus className="h-8 w-8 text-[#3A3F4A]" />
                    </div>
                  )}
                </div>
                <div className="p-3.5">
                  {(category || subCategory) && (
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[1.2px] text-[#737A86]">
                      {[category, subCategory].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="text-lg font-bold leading-6 text-text">{name || "Product name"}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xl font-bold text-text">{formatPreviewPrice(priceN)}</p>
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}