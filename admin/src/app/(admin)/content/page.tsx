"use client";

import { useAuth } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ImagePlus,
  Lock,
  RefreshCw,
  Sparkles,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Input,
  Panel,
  Select,
  cn,
} from "@/components/ui";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

type Creative = {
  imageUrl?: string;
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
  ctaAction?: string;
  ctaTarget?: string;
  kicker?: string;
};

type Slot = {
  _id: string;
  position: number;
  controlType: "system" | "admin";
  label?: string;
  isActive?: boolean;
  published?: Creative;
  draft?: Creative;
  publishedVersion?: number;
  history?: Array<{
    version: number;
    status: string;
    publishedAt?: string;
    note?: string;
    creative?: Creative;
  }>;
  updatedAt?: string;
};

type PersonalSample = {
  _id: string;
  position: number;
  mode?: string;
  primarySignal?: string;
  categoryContext?: string;
  headline?: string;
  imageUrl?: string;
  generatedAt?: string;
  expiresAt?: string;
  user?: { name?: string; email?: string };
};

function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function resolveImg(src?: string) {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("data:") || src.startsWith("/"))
    return src;
  return `/${src}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function BannerPreview({
  creative,
  position,
  controlType,
}: {
  creative: Creative;
  position: number;
  controlType: string;
}) {
  const img = resolveImg(creative.imageUrl);
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden border border-[#252A33] bg-[#090B0F]">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#11141A]">
          <ImagePlus className="h-8 w-8 text-[#737A86]" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090B0F] via-[#090B0F]/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#090B0F]/40 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 max-w-[92%] p-3 sm:p-4">
        {creative.kicker ? (
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-[#00E575]">
            {creative.kicker}
          </p>
        ) : null}
        <p className="text-[15px] font-semibold leading-tight text-white sm:text-lg">
          {creative.headline || "Untitled"}
        </p>
        {creative.subheadline ? (
          <p className="mt-1 line-clamp-2 text-[11px] text-white/65">
            {creative.subheadline}
          </p>
        ) : null}
        {creative.ctaLabel ? (
          <span className="mt-2 inline-flex border border-white/35 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white">
            {creative.ctaLabel}
          </span>
        ) : null}
      </div>
      <div className="absolute right-2 top-2">
        <Badge tone={controlType === "system" ? "blue" : "green"}>
          {controlType === "system" ? "System" : "Admin"} · #{position}
        </Badge>
      </div>
    </div>
  );
}

export default function ContentPage() {
  const { getToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [recentPersonal, setRecentPersonal] = useState<PersonalSample[]>([]);
  const [counts, setCounts] = useState<any>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<Creative>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");
  const [diagnostics, setDiagnostics] = useState<PersonalSample[]>([]);

  const selectedSlot = useMemo(
    () => slots.find((s) => s.position === selected) || null,
    [slots, selected]
  );
  const paneOpen = selected != null;

  const load = useCallback(
    async (soft = false) => {
      try {
        if (!soft) setLoading(true);
        else setRefreshing(true);
        setError("");
        const token = await getToken();
        const res = await adminFetch<any>("/admin/content", token);
        setSlots(res.data?.slots || []);
        setRecentPersonal(res.data?.recentPersonal || []);
        setCounts(res.data?.counts || null);
        setOffline(false);
      } catch (e: any) {
        setOffline(typeof navigator !== "undefined" && !navigator.onLine);
        setError(e?.message || "Failed to load content");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getToken]
  );

  useEffect(() => {
    void load();
    const on = () => {
      setOffline(false);
      void load(true);
    };
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [load]);

  useEffect(() => {
    if (!selectedSlot) return;
    setMsg("");
    if (selectedSlot.controlType === "admin") {
      const src =
        selectedSlot.draft?.imageUrl || selectedSlot.draft?.headline
          ? selectedSlot.draft
          : selectedSlot.published || {};
      setDraft({ ...src });
      setDiagnostics([]);
    } else {
      setDraft({});
      void (async () => {
        try {
          const token = await getToken();
          const res = await adminFetch<any>(
            `/admin/content/diagnostics?position=${selectedSlot.position}`,
            token
          );
          setDiagnostics(res.data || []);
        } catch {
          setDiagnostics([]);
        }
      })();
    }
  }, [selectedSlot, getToken]);

  function closePane() {
    setSelected(null);
    setMsg("");
  }

  function flash(text: string, tone: "ok" | "err" = "ok") {
    setMsg(text);
    setMsgTone(tone);
  }

  /** Real upload → backend Cloudinary (same stack as product images) */
    async function onPickImage(file: File | null) {
    if (!file || !selectedSlot || selectedSlot.controlType !== "admin") return;

    if (!file.type.startsWith("image/")) {
      flash("Choose a jpg, png, or webp image", "err");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      flash("Image must be under 8MB", "err");
      return;
    }

    try {
      setUploading(true);
      flash("Uploading…");
      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const form = new FormData();
      form.append("image", file); // field name MUST match upload.single("image")

      const res = await fetch(`${API}/admin/content/upload-banner`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // DO NOT set Content-Type — browser sets multipart boundary
        },
        body: form,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || `Upload failed (${res.status})`);
      }

      const url = json?.data?.imageUrl as string;
      if (!url) throw new Error("No image URL returned");

      setDraft((d) => ({ ...d, imageUrl: url }));
      flash("Image uploaded — save draft or publish");
    } catch (e: any) {
      flash(e?.message || "Upload failed", "err");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveDraft() {
    if (!selectedSlot || selectedSlot.controlType !== "admin") return;
    try {
      setBusy(true);
      const token = await getToken();
      await adminFetch(`/admin/content/slots/${selectedSlot.position}/draft`, token, {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      flash("Draft saved");
      await load(true);
    } catch (e: any) {
      flash(e?.message || "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!selectedSlot || selectedSlot.controlType !== "admin") return;
    if (!draft.imageUrl) {
      flash("Upload a banner image first", "err");
      return;
    }
    if (!String(draft.headline || "").trim()) {
      flash("Headline is required", "err");
      return;
    }
    try {
      setBusy(true);
      const token = await getToken();
      await adminFetch(
        `/admin/content/slots/${selectedSlot.position}/publish`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ ...draft, note: "Admin publish" }),
        }
      );
      flash("Published — live on web & app");
      await load(true);
    } catch (e: any) {
      flash(e?.message || "Publish failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(active: boolean) {
    if (!selectedSlot || selectedSlot.controlType !== "admin") return;
    try {
      setBusy(true);
      const token = await getToken();
      await adminFetch(
        `/admin/content/slots/${selectedSlot.position}/active`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive: active }),
        }
      );
      flash(active ? "Slot activated" : "Slot deactivated");
      await load(true);
    } catch (e: any) {
      flash(e?.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className={cn(poppins.className, "py-20")}>
        <OrbLoader />
      </div>
    );
  }

  return (
    <div className={cn(poppins.className, "relative min-h-[70vh] pb-8")}>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
            Content
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#F5F7FA]">
            Hero Banners
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[#A7ADB8]">
            Edit slots <span className="text-[#F5F7FA]">2 · 3 · 5</span>. Slots{" "}
            <span className="text-[#F5F7FA]">1 · 4</span> are system adaptive.
            Images upload via Cloudinary (same as products).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {offline ? (
            <span className="inline-flex items-center gap-1.5 border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">
              <WifiOff className="h-3.5 w-3.5" /> Offline
            </span>
          ) : null}
          <Button
            tone="ghost"
            disabled={refreshing}
            onClick={() => load(true)}
            className="h-9 gap-2"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? <div className="mb-4">
          <ErrorBlock message={error} />
        </div> : null}

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: "Positions", value: "5" },
          { label: "Admin live", value: counts?.adminPublished ?? "—" },
          { label: "System", value: counts?.systemSlots ?? 2 },
          { label: "Personal cycles", value: counts?.activePersonalCycles ?? "—" },
        ].map((s) => (
          <div key={s.label} className="border border-[#252A33] bg-[#11141A] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737A86]">
              {s.label}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-[#F5F7FA]">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        className={cn(
          "grid gap-3 transition-[margin] duration-300",
          paneOpen
            ? "grid-cols-1 sm:grid-cols-2 lg:mr-[min(100%,400px)]"
            : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
        )}
      >
        {slots.length === 0 ? (
          <EmptyState
            title="No slots"
            body="Hero slots not initialized on the server yet."
          />
        ) : (
          slots.map((slot) => {
            const creative =
              slot.controlType === "admin"
                ? slot.published || slot.draft || {}
                : {
                    headline: "System personalized",
                    subheadline: "Adaptive · 6h cycle · not editable",
                    imageUrl:
                      recentPersonal.find((p) => p.position === slot.position)
                        ?.imageUrl || "",
                    kicker: "ADAPTIVE",
                    ctaLabel: "—",
                  };
            const isSel = selected === slot.position;
            return (
              <button
                key={slot.position}
                type="button"
                onClick={() => setSelected(slot.position)}
                className={cn(
                  "text-left transition",
                  isSel
                    ? "ring-1 ring-[#00E575]/60"
                    : "hover:ring-1 hover:ring-[#252A33]"
                )}
              >
                <Panel className="overflow-hidden p-0">
                  <BannerPreview
                    creative={creative}
                    position={slot.position}
                    controlType={slot.controlType}
                  />
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#F5F7FA]">
                        {slot.label || `Banner ${slot.position}`}
                      </p>
                      <p className="text-[11px] text-[#737A86]">
                        {slot.controlType === "system"
                          ? "Locked · adaptive"
                          : `v${slot.publishedVersion || 0} · ${
                              slot.isActive === false ? "Off" : "On"
                            }`}
                      </p>
                    </div>
                    {slot.controlType === "system" ? (
                      <Lock className="h-4 w-4 shrink-0 text-[#737A86]" />
                    ) : (
                      <Sparkles className="h-4 w-4 shrink-0 text-[#00E575]" />
                    )}
                  </div>
                </Panel>
              </button>
            );
          })
        )}
      </div>

      {/* Backdrop (mobile) */}
      {paneOpen ? (
        <button
          type="button"
          aria-label="Close"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={closePane}
        />
      ) : null}

      {/* Right pane */}
      <aside
        className={cn(
          "fixed bottom-0 right-0 top-0 z-40 flex w-full max-w-[400px] flex-col border-l border-[#252A33] bg-[#0C0F14] shadow-2xl transition-transform duration-300 ease-out",
          paneOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {selectedSlot ? (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-[#252A33] px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
                  Position {selectedSlot.position}
                </p>
                <h2 className="mt-0.5 truncate text-base font-semibold text-[#F5F7FA]">
                  {selectedSlot.label || `Banner ${selectedSlot.position}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={closePane}
                className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#252A33] text-[#A7ADB8] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {selectedSlot.controlType === "system" ? (
                <>
                  <div className="border border-blue-500/25 bg-blue-500/10 px-3 py-3 text-xs text-blue-100">
                    System slot — not editable. Sample cycles only.
                  </div>
                  <BannerPreview
                    creative={{
                      imageUrl:
                        diagnostics[0]?.imageUrl ||
                        recentPersonal.find(
                          (p) => p.position === selectedSlot.position
                        )?.imageUrl ||
                        "",
                      headline:
                        diagnostics[0]?.headline || "Waiting for cycles",
                      subheadline: diagnostics[0]?.primarySignal || "—",
                      kicker: diagnostics[0]?.categoryContext || "SYSTEM",
                      ctaLabel: "Explore",
                    }}
                    position={selectedSlot.position}
                    controlType="system"
                  />
                  <div className="space-y-2">
                    {(
                      diagnostics.length
                        ? diagnostics
                        : recentPersonal.filter(
                            (p) => p.position === selectedSlot.position
                          )
                    ).map((d) => (
                      <div
                        key={d._id}
                        className="border border-[#252A33] bg-[#11141A] px-3 py-2 text-xs"
                      >
                        <div className="flex justify-between gap-2">
                          <Badge tone={d.mode === "behavioral" ? "green" : "warn"}>
                            {d.mode || "—"}
                          </Badge>
                          <span className="text-[#737A86]">{fmt(d.generatedAt)}</span>
                        </div>
                        <p className="mt-1 font-medium text-[#F5F7FA]">
                          {d.headline || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Upload zone */}
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
                      Banner image
                    </p>
                    <button
                      type="button"
                      disabled={uploading || offline}
                      onClick={() => fileRef.current?.click()}
                      className="group relative block w-full overflow-hidden border border-dashed border-[#252A33] bg-[#11141A] transition hover:border-[#00E575]/40"
                    >
                      {draft.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveImg(draft.imageUrl)}
                          alt=""
                          className="aspect-[16/9] w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 text-[#737A86]">
                          <Upload className="h-6 w-6" />
                          <p className="text-xs">Tap to upload image</p>
                          <p className="text-[10px]">jpg · png · webp · max 8MB</p>
                        </div>
                      )}
                      {draft.imageUrl ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                          <span className="text-xs font-semibold text-white">
                            {uploading ? "Uploading…" : "Replace image"}
                          </span>
                        </div>
                      ) : null}
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) =>
                        void onPickImage(e.target.files?.[0] || null)
                      }
                    />
                  </div>

                  <BannerPreview
                    creative={draft}
                    position={selectedSlot.position}
                    controlType="admin"
                  />

                  <div className="space-y-2.5">
                    <label className="block space-y-1 text-xs text-[#A7ADB8]">
                      Kicker
                      <Input
                        value={draft.kicker || ""}
                        maxLength={40}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, kicker: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block space-y-1 text-xs text-[#A7ADB8]">
                      Headline
                      <Input
                        value={draft.headline || ""}
                        maxLength={80}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, headline: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block space-y-1 text-xs text-[#A7ADB8]">
                      Supporting text
                      <Input
                        value={draft.subheadline || ""}
                        maxLength={160}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            subheadline: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block space-y-1 text-xs text-[#A7ADB8]">
                        CTA label
                        <Input
                          value={draft.ctaLabel || ""}
                          maxLength={40}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              ctaLabel: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="block space-y-1 text-xs text-[#A7ADB8]">
                        CTA action
                        <Select
                          value={draft.ctaAction || "scroll_showroom"}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              ctaAction: e.target.value,
                            }))
                          }
                        >
                          <option value="scroll_showroom">Showroom</option>
                          <option value="category">Category</option>
                          <option value="product">Product</option>
                          <option value="store">Store</option>
                          <option value="url">URL</option>
                        </Select>
                      </label>
                    </div>
                    <label className="block space-y-1 text-xs text-[#A7ADB8]">
                      CTA target
                      <Input
                        value={draft.ctaTarget || ""}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            ctaTarget: e.target.value,
                          }))
                        }
                        placeholder="Optional"
                      />
                    </label>
                  </div>

                  {(selectedSlot.history?.length || 0) > 0 ? (
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
                        <Archive className="h-3 w-3" /> History
                      </p>
                      <div className="max-h-32 space-y-1 overflow-y-auto">
                        {[...(selectedSlot.history || [])]
                          .reverse()
                          .slice(0, 10)
                          .map((h, i) => (
                            <div
                              key={`${h.version}-${i}`}
                              className="flex justify-between gap-2 border border-[#252A33] bg-[#11141A] px-2 py-1.5 text-[11px] text-[#A7ADB8]"
                            >
                              <span className="truncate">
                                v{h.version} · {h.creative?.headline || h.status}
                              </span>
                              <span className="shrink-0 text-[#737A86]">
                                {fmt(h.publishedAt)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}

                  {msg ? (
                    <p
                      className={cn(
                        "text-xs",
                        msgTone === "err" ? "text-red-300" : "text-[#00E575]"
                      )}
                    >
                      {msg}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            {selectedSlot.controlType === "admin" ? (
              <div className="space-y-2 border-t border-[#252A33] px-4 py-3">
                <Button
                  tone="ghost"
                  disabled={busy || offline || uploading}
                  onClick={saveDraft}
                  className="h-10 w-full"
                >
                  Save draft
                </Button>
                <Button
                  disabled={busy || offline || uploading}
                  onClick={publish}
                  className="h-10 w-full bg-[#00E575] font-semibold text-[#041412] hover:brightness-105"
                >
                  Publish live
                </Button>
                <Button
                  tone="ghost"
                  disabled={busy || offline}
                  className="h-9 w-full text-[#A7ADB8]"
                  onClick={() =>
                    toggleActive(selectedSlot.isActive === false)
                  }
                >
                  {selectedSlot.isActive === false
                    ? "Activate slot"
                    : "Deactivate slot"}
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </aside>
    </div>
  );
}