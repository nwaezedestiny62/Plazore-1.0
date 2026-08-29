"use client";

import { useAuth } from "@clerk/nextjs";
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ImageIcon,
  MapPin,
  Store,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMarketplace } from "@/context/MarketplaceContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

type StoreForm = {
  storeName: string;
  storeDescription: string;
  businessGoal: string;
  phone: string;
  storeLogo: string;
  storeBanner: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  deliveryMethod: "" | "courier" | "self";
  courierCompany: string;
};

const emptyForm: StoreForm = {
  storeName: "",
  storeDescription: "",
  businessGoal: "",
  phone: "",
  storeLogo: "",
  storeBanner: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  street: "",
  city: "",
  state: "",
  zipCode: "",
  country: "",
  deliveryMethod: "",
  courierCompany: "",
};

type OverlayTone = "info" | "success" | "danger";

type Overlay = {
  title: string;
  message?: string;
  tone?: OverlayTone;
} | null;

function OrbLoader() {
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

function TopOverlay({ state, onDismiss }: { state: Overlay; onDismiss: () => void }) {
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(onDismiss, 3800);
    return () => clearTimeout(t);
  }, [state, onDismiss]);

  if (!state) return null;
  const accent =
    state.tone === "danger" ? "#EF4444" : state.tone === "success" ? "#00E575" : "#3B82F6";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] px-3.5 pt-3 md:px-6 md:pt-4">
      <div className="pointer-events-auto mx-auto flex max-w-lg overflow-hidden border border-white/10 bg-[#11141A]">
        <div className="w-[3px] shrink-0" style={{ backgroundColor: accent }} />
        <div className="flex flex-1 gap-2.5 p-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center"
            style={{ backgroundColor: `${accent}22` }}
          >
            <CheckCircle2 className="h-[18px] w-[18px]" style={{ color: accent }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text">{state.title}</p>
            {state.message && (
              <p className="mt-0.5 text-[12.5px] leading-[18px] text-[#A7ADB8]">{state.message}</p>
            )}
          </div>
          <button type="button" onClick={onDismiss} className="text-[#737A86] hover:text-text">
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

function LivePreview({
  storeName,
  storeDescription,
  businessGoal,
  storeLogo,
  storeBanner,
  state,
  country,
  products,
  formatProduct,
}: {
  storeName: string;
  storeDescription: string;
  businessGoal: string;
  storeLogo: string;
  storeBanner: string;
  state: string;
  country: string;
  products: any[];
  formatProduct: (n: number, region?: string) => string;
}) {
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [descOpen, setDescOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const touchRef = useRef(false);

  const locationLabel = [state, country].filter(Boolean).join(", ");
  const name = storeName.trim() || "Your store name";
  const hasBanner = !!storeBanner.trim();
  const hasLogo = !!storeLogo.trim();

  useEffect(() => {
    if (products.length <= 1) return;
    const t = setInterval(() => {
      if (touchRef.current) return;
      setFeaturedIndex((i) => (i + 1) % products.length);
    }, 7000);
    return () => clearInterval(t);
  }, [products.length]);

  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div className="overflow-hidden rounded-[28px] border-[2.5px] border-[#2C313A] bg-[#12141A] p-1.5 shadow-2xl">
        <div className="mx-auto mb-1.5 h-3.5 w-16 rounded-lg bg-black" />
        <div className="max-h-[560px] overflow-y-auto rounded-2xl bg-bg">
          {/* Banner */}
          <div className="relative h-[140px] bg-[#07080C]">
            {hasBanner ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={storeBanner} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-b from-[#0F172A] via-bg to-[#111827]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-bg/15 via-transparent to-bg/85" />
            <div className="absolute left-2.5 top-2.5 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-bg/50">
              <ChevronLeft className="h-4 w-4 text-text" />
            </div>
          </div>

          {/* Identity */}
          <div className="-mt-7 px-4">
            <div className="overflow-hidden rounded-[18px] border border-white/8 bg-[#11141A]/98 p-3 backdrop-blur">
              <div className="flex items-center gap-2.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-line bg-[#171B22]">
                  {hasLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={storeLogo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-5 w-5 text-[#737A86]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-extrabold tracking-tight text-text">{name}</p>
                  <p className="mt-0.5 text-[10px] text-[#737A86]">Explore this store</p>
                  {!!locationLabel && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-[#A7ADB8]">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{locationLabel}</span>
                    </p>
                  )}
                </div>
              </div>

              {!!storeDescription.trim() && (
                <div className="mt-3">
                  <p className={`text-xs leading-[18px] text-[#A7ADB8] ${descOpen ? "" : "line-clamp-3"}`}>
                    {storeDescription}
                  </p>
                  {storeDescription.length > 90 && (
                    <button
                      type="button"
                      onClick={() => setDescOpen((v) => !v)}
                      className="mt-1 text-[11px] font-semibold text-ai-green"
                    >
                      {descOpen ? "See less" : "See more"}
                    </button>
                  )}
                </div>
              )}

              {!!businessGoal.trim() && (
                <div className="mt-2.5 rounded-xl border border-white/6 bg-white/[0.03] px-2.5 py-2">
                  <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[1.2px] text-[#737A86]">
                    Our goal
                  </p>
                  <p className={`text-xs leading-[17px] text-text ${goalOpen ? "" : "line-clamp-2"}`}>
                    {businessGoal}
                  </p>
                  {businessGoal.length > 70 && (
                    <button
                      type="button"
                      onClick={() => setGoalOpen((v) => !v)}
                      className="mt-1 text-[11px] font-semibold text-ai-green"
                    >
                      {goalOpen ? "See less" : "See more"}
                    </button>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <div className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-line bg-[#171B22] py-2.5 text-xs font-bold text-text">
                  Save store
                </div>
                <div className="rounded-xl border border-white/7 bg-white/[0.04] px-2.5 py-2.5 text-[11px] font-semibold text-[#A7ADB8]">
                  {products.length} products
                </div>
              </div>
            </div>
          </div>

          {/* Featured */}
          {products.length > 0 && (
            <div className="mt-5">
              <div className="mb-2.5 px-4">
                <p className="text-[9px] font-bold uppercase tracking-[1.4px] text-[#737A86]">Featured</p>
                <p className="text-[15px] font-bold tracking-tight text-text">A closer look</p>
              </div>
              <div
                className="flex snap-x snap-mandatory overflow-x-auto px-4 scrollbar-none"
                onTouchStart={() => {
                  touchRef.current = true;
                }}
                onTouchEnd={() => {
                  touchRef.current = false;
                }}
              >
                {products.map((p, i) => {
                  const img = p.images?.[0];
                  return (
                    <div
                      key={p._id || p.id || i}
                      className={`w-full shrink-0 snap-center ${i === featuredIndex ? "" : "hidden"}`}
                    >
                      <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#11141A]">
                        <div className="relative h-[220px] bg-[#171B22]">
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <ImageIcon className="h-7 w-7 text-[#3A3F4A]" />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 h-[90px] bg-gradient-to-t from-bg/92 via-bg/55 to-transparent" />
                          <div className="absolute bottom-3 left-3 right-3">
                            <p className="line-clamp-2 text-[13px] font-bold leading-[17px] text-text">
                              {p.name}
                            </p>
                            <p className="mt-1 text-[15px] font-extrabold text-text">
                              {formatProduct(Number(p.price) || 0, p.region || country || "NG")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {products.length > 1 && (
                <div className="mt-2.5 flex justify-center gap-1">
                  {products.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFeaturedIndex(i)}
                      className={`h-1 rounded-sm transition-all ${
                        i === featuredIndex ? "w-3.5 bg-ai-green" : "w-1.5 bg-white/20"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Grid */}
          <div className="mt-6 px-4 pb-5">
            <p className="text-[9px] font-bold uppercase tracking-[1.4px] text-[#737A86]">The store</p>
            <p className="text-[15px] font-bold tracking-tight text-text">Explore the collection</p>
            <div className="my-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-line" />
              <span className="text-[9px] uppercase tracking-[1.2px] text-[#737A86]">All products</span>
              <div className="h-px flex-1 bg-line" />
            </div>

            {products.length === 0 ? (
              <div className="py-7 text-center">
                <ImageIcon className="mx-auto h-5 w-5 text-[#737A86]" />
                <p className="mt-2.5 text-xs leading-[18px] text-[#A7ADB8]">
                  This storefront is still being set up.
                  <br />
                  Products appear here when you publish.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {products.slice(0, 6).map((p) => {
                  const img = p.images?.[0];
                  return (
                    <div
                      key={p._id || p.id}
                      className="overflow-hidden rounded-xl border border-white/6 bg-[#11141A]"
                    >
                      <div className="aspect-[1/1.15] bg-[#171B22]">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-[#3A3F4A]" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="line-clamp-2 text-[11px] font-semibold leading-[15px] text-text">
                          {p.name}
                        </p>
                        <p className="mt-1 text-xs font-extrabold text-text">
                          {formatProduct(Number(p.price) || 0, p.region || country || "NG")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pb-4 text-center">
            <div className="mx-auto mb-2 h-0.5 w-7 rounded-sm bg-line" />
            <p className="text-[9px] tracking-widest text-[#737A86]">Plazore · Digital Mall</p>
          </div>
        </div>
        <div className="mx-auto mt-1.5 h-0.5 w-20 rounded-sm bg-white/20" />
      </div>
    </div>
  );
}

export default function SellerStorePage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { formatProduct } = useMarketplace();

  const [form, setForm] = useState<StoreForm>(emptyForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [overlay, setOverlay] = useState<Overlay>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const setField = <K extends keyof StoreForm>(key: K, value: StoreForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toast = useCallback(
  (title: string, message?: string, tone: OverlayTone = "info") => {
    setOverlay({ title, message, tone });
  },
  []
);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const [storeRes, prodRes] = await Promise.all([
        fetch(`${API}/seller/store`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch(`${API}/seller/products`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .catch(() => null),
      ]);

      if (storeRes?.success && storeRes.data) {
        const d = storeRes.data;
        setForm({
          storeName: d.storeName || "",
          storeDescription: d.storeDescription || "",
          businessGoal: d.businessGoal || "",
          phone: d.phone || "",
          storeLogo: d.storeLogo || "",
          storeBanner: d.storeBanner || "",
          bankName: d.payout?.bankName || "",
          accountName: d.payout?.accountName || "",
          accountNumber: d.payout?.accountNumber || "",
          street: d.shippingDefaults?.address?.street || "",
          city: d.shippingDefaults?.address?.city || "",
          state: d.shippingDefaults?.address?.state || "",
          zipCode: d.shippingDefaults?.address?.zipCode || "",
          country: d.shippingDefaults?.address?.country || "",
          deliveryMethod: d.shippingDefaults?.deliveryMethod || "",
          courierCompany: d.shippingDefaults?.courierCompany || "",
        });
        setLogoFile(null);
        setBannerFile(null);
        setLogoPreview(null);
        setBannerPreview(null);
      }

      if (prodRes?.success) {
        const list = Array.isArray(prodRes.data)
          ? prodRes.data
          : prodRes.data?.products || [];
        setProducts(list.filter((p: any) => p.isActive !== false).slice(0, 12));
      }
    } catch (e) {
      console.error(e);
      toast("Error", "Could not load store settings", "danger");
    } finally {
      setLoading(false);
    }
  }, [getToken, toast]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    load();
  }, [isLoaded, isSignedIn, load]);

  const onPick = (kind: "logo" | "banner", file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (kind === "logo") {
      setLogoFile(file);
      setLogoPreview(url);
    } else {
      setBannerFile(file);
      setBannerPreview(url);
    }
  };

  const handleSave = async () => {
    if (!form.storeName.trim()) {
      toast("Required", "Business / store name is required", "danger");
      return;
    }
    try {
      setSaving(true);
      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const fd = new FormData();
      fd.append("storeName", form.storeName.trim());
      fd.append("storeDescription", form.storeDescription.trim());
      fd.append("businessGoal", form.businessGoal.trim());
      fd.append("phone", form.phone.trim());
      fd.append(
        "payout",
        JSON.stringify({
          bankName: form.bankName.trim(),
          accountName: form.accountName.trim(),
          accountNumber: form.accountNumber.trim(),
        })
      );
      fd.append(
        "shippingDefaults",
        JSON.stringify({
          address: {
            street: form.street.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            zipCode: form.zipCode.trim(),
            country: form.country.trim(),
          },
          deliveryMethod: form.deliveryMethod,
          courierCompany: form.courierCompany.trim(),
        })
      );

      if (logoFile) fd.append("storeLogo", logoFile);
      if (bannerFile) fd.append("storeBanner", bannerFile);

      const res = await fetch(`${API}/seller/store`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();

      if (json?.success) {
        toast("Saved", "Your store settings were updated", "success");
        await load();
      } else {
        toast("Error", json?.message || "Could not save store settings", "danger");
      }
    } catch (e: any) {
      console.error(e);
      toast("Error", e?.message || "Could not save store settings", "danger");
    } finally {
      setSaving(false);
    }
  };

  const bannerSrc = (bannerPreview || form.storeBanner || "").trim();
  const logoSrc = (logoPreview || form.storeLogo || "").trim();

  if (!isLoaded || loading) return <OrbLoader />;

  if (!isSignedIn) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center bg-bg px-6 text-center">
        <p className="font-semibold text-text">Sign in to manage your store</p>
        <Link href="/sign-in" className="mt-4 rounded-full bg-text px-6 py-2.5 text-sm font-bold text-bg">
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
            href="/seller/settings"
            className="flex h-10 w-10 items-center justify-center border border-line bg-surface text-[#A7ADB8] hover:text-text"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[2px] text-[#737A86]">
              Seller Lounge
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-[26px]">My Store</h1>
          </div>
        </div>

        <p className="mb-6 max-w-xl text-[13px] leading-[19px] text-[#A7ADB8]">
          Private management only. Buyers never see edit controls on the public storefront.
        </p>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
          {/* Form */}
          <div className="space-y-4">
            <section className="border border-line bg-surface p-4 md:p-5">
              <div className="mb-3.5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center bg-green/10">
                  <Store className="h-[18px] w-[18px] text-green" />
                </div>
                <div>
                  <p className="text-base font-bold">Store appearance</p>
                  <p className="text-[11px] text-[#737A86]">
                    Banner, logo, and identity shown to buyers
                  </p>
                </div>
              </div>
              <div className="mb-3.5 h-px bg-line" />

              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                Banner
              </p>
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="relative mb-4 h-[140px] w-full overflow-hidden rounded-[14px] border border-line bg-[#0A121C]"
              >
                {bannerSrc ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bannerSrc} alt="" className="h-full w-full object-cover" />
                    <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-bg/85 px-2.5 py-1 text-[11px] font-semibold text-green">
                      <Camera className="h-3 w-3" />
                      Change
                    </span>
                  </>
                ) : (
                  <span className="flex h-full flex-col items-center justify-center text-[#737A86]">
                    <ImageIcon className="h-[22px] w-[22px]" />
                    <span className="mt-1.5 text-[13px]">Tap to upload banner</span>
                    <span className="mt-0.5 text-[11px] text-[#3D5268]">16:9 recommended</span>
                  </span>
                )}
              </button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPick("banner", e.target.files?.[0] || null)}
              />

              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                Logo
              </p>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="mb-4 flex h-24 w-24 flex-col items-center justify-center overflow-hidden rounded-[18px] border border-line bg-[#0A121C] text-[#737A86]"
              >
                {logoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  <>
                    <Camera className="h-[22px] w-[22px]" />
                    <span className="mt-1 text-[10px]">Upload</span>
                  </>
                )}
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPick("logo", e.target.files?.[0] || null)}
              />

              {(
                [
                  ["storeName", "Business / Store Name *", "Your store name", false],
                  ["storeDescription", "About the store", "What you sell...", true],
                  ["businessGoal", "Business Goal", "Where you're headed...", true],
                  ["phone", "Phone Number", "080...", false],
                ] as const
              ).map(([key, label, ph, multi]) => (
                <div key={key} className="mb-3.5">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                    {label}
                  </p>
                  {multi ? (
                    <textarea
                      value={form[key]}
                      onChange={(e) => setField(key, e.target.value)}
                      placeholder={ph}
                      rows={3}
                      className="w-full rounded-[14px] border border-line bg-[#0A121C] px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-[#3D5268] focus:border-green/40"
                    />
                  ) : (
                    <input
                      value={form[key]}
                      onChange={(e) => setField(key, e.target.value)}
                      placeholder={ph}
                      className="w-full rounded-[14px] border border-line bg-[#0A121C] px-3.5 py-[13px] text-[15px] text-text outline-none placeholder:text-[#3D5268] focus:border-green/40"
                    />
                  )}
                </div>
              ))}
            </section>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex h-14 w-full items-center justify-center gap-2 bg-gradient-to-r from-green via-teal-500 to-blue text-[15px] font-extrabold text-[#041412] disabled:opacity-60"
            >
              {saving ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#041412]/30 border-t-[#041412]" />
              ) : (
                <>
                  <CheckCircle2 className="h-[18px] w-[18px]" />
                  Save store settings
                </>
              )}
            </button>
          </div>

          {/* Live preview — desktop sticky */}
          <div className="lg:sticky lg:top-6">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[2px] text-[#737A86]">
              Live storefront
            </p>
            <p className="mb-1 text-lg font-extrabold text-text">How buyers see your store</p>
            <p className="mb-4 text-[13px] leading-[19px] text-[#A7ADB8]">
              Updates as you edit. Products are your active listings.
            </p>
            <LivePreview
              storeName={form.storeName}
              storeDescription={form.storeDescription}
              businessGoal={form.businessGoal}
              storeLogo={logoSrc}
              storeBanner={bannerSrc}
              state={form.state}
              country={form.country}
              products={products}
              formatProduct={(n, r) => {
                try {
                  return formatProduct(n, r as any);
                } catch {
                  return String(n);
                }
              }}
            />
            <p className="mt-3 text-center text-[11px] text-[#737A86]">
              Preview · scroll inside the phone to explore
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}