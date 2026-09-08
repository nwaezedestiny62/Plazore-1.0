"use client";

import { useAuth } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Megaphone,
  RefreshCw,
  Trash2,
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

type Design = {
  layout: "stack" | "split" | "banner";
  theme: "dark" | "light" | "brand";
  accent: "green" | "amber" | "blue" | "neutral";
  titleSize: "sm" | "md" | "lg";
  mediaAspect: "16:9" | "1:1" | "4:5" | "auto";
  showMediaTop: boolean;
};

type Announcement = {
  _id: string;
  headline?: string;
  body?: string;
  mediaType?: "none" | "image" | "video";
  mediaUrl?: string;
  mediaPosterUrl?: string;
  audience?: "all" | "buyers" | "sellers";
  status?: "draft" | "published" | "archived";
  actionLabel?: string;
  actionRoute?: string;
  design?: Partial<Design>;
  allowsReply?: boolean;
  publishedAt?: string;
  expiresAt?: string | null;
  deliveredCount?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: { name?: string; email?: string };
};

const DEFAULT_DESIGN: Design = {
  layout: "stack",
  theme: "dark",
  accent: "green",
  titleSize: "md",
  mediaAspect: "16:9",
  showMediaTop: true,
};

const ACCENT_HEX: Record<string, string> = {
  green: "#00E575",
  amber: "#F59E0B",
  blue: "#3B82F6",
  neutral: "#A7ADB8",
};

function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function statusTone(
  s?: string
): "green" | "error" | "blue" | "warn" | "neutral" {
  if (s === "published") return "green";
  if (s === "archived") return "neutral";
  if (s === "draft") return "warn";
  return "neutral";
}

function LivePreview({
  headline,
  body,
  mediaType,
  mediaUrl,
  mediaPosterUrl,
  actionLabel,
  design,
}: {
  headline: string;
  body: string;
  mediaType: string;
  mediaUrl: string;
  mediaPosterUrl: string;
  actionLabel: string;
  design: Design;
}) {
  const accent = ACCENT_HEX[design.accent] || ACCENT_HEX.green;
  const isLight = design.theme === "light";
  const titleCls =
    design.titleSize === "sm"
      ? "text-base"
      : design.titleSize === "lg"
        ? "text-2xl"
        : "text-xl";
  const aspect =
    design.mediaAspect === "1:1"
      ? "aspect-square"
      : design.mediaAspect === "4:5"
        ? "aspect-[4/5]"
        : design.mediaAspect === "auto"
          ? "min-h-[120px]"
          : "aspect-video";

  const showMedia =
    mediaType !== "none" && mediaUrl && design.showMediaTop !== false;

  return (
    <div
      className={cn(
        "overflow-hidden border",
        isLight
          ? "border-black/10 bg-[#F5F7FA] text-[#0C0F14]"
          : "border-[#252A33] bg-[#11141A] text-[#F5F7FA]"
      )}
    >
      <div className="h-[3px] w-full" style={{ backgroundColor: accent }} />
      {showMedia && design.layout !== "split" && (
        <div className={cn("relative w-full bg-[#0C0F14]", aspect)}>
          {mediaType === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              {mediaPosterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaPosterUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="text-2xl text-white">▶</span>
              </div>
            </>
          )}
        </div>
      )}
      <div className="p-4">
        <div className="mb-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
          <span style={{ color: accent }}>Announcement</span>
          <span className="text-[#737A86]">No reply</span>
        </div>
        <p className={cn("font-semibold leading-snug", titleCls)}>
          {headline || "Headline"}
        </p>
        <p
          className={cn(
            "mt-2 text-sm leading-relaxed whitespace-pre-wrap",
            isLight ? "text-[#4B5563]" : "text-[#A7ADB8]"
          )}
        >
          {body || "Body text…"}
        </p>
        {actionLabel ? (
          <div
            className="mt-4 inline-flex px-3 py-2 text-xs font-bold text-[#041412]"
            style={{ backgroundColor: accent }}
          >
            {actionLabel}
          </div>
        ) : null}
      </div>
      {showMedia && design.layout === "split" && (
        <div className={cn("border-t border-[#252A33] bg-[#0C0F14]", aspect)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaType === "video" && mediaPosterUrl ? mediaPosterUrl : mediaUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}

export default function AnnouncementsAdminPage() {
  const { getToken } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [offline, setOffline] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);

  // Editor
  const [editingId, setEditingId] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "buyers" | "sellers">("all");
  const [mediaType, setMediaType] = useState<"none" | "image" | "video">("none");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaPosterUrl, setMediaPosterUrl] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [actionRoute, setActionRoute] = useState("");
  const [design, setDesign] = useState<Design>({ ...DEFAULT_DESIGN });
  const [uploadBusy, setUploadBusy] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLInputElement>(null);

  const showOffline = mounted && offline;

  useEffect(() => {
    setMounted(true);
    const sync = () =>
      setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const load = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOffline(true);
      setError("You’re offline.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const token = await getToken();
      if (!token) {
        setError("Session expired. Sign in again.");
        return;
      }
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const json = await adminFetch<{ data: Announcement[] }>(
        `/admin/announcements?${params}`,
        token
      );
      setItems(json.data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }, [getToken, statusFilter]);

  useEffect(() => {
    if (!mounted) return;
    load();
  }, [mounted, load]);

  const resetEditor = () => {
    setEditingId(null);
    setHeadline("");
    setBody("");
    setAudience("all");
    setMediaType("none");
    setMediaUrl("");
    setMediaPosterUrl("");
    setActionLabel("");
    setActionRoute("");
    setDesign({ ...DEFAULT_DESIGN });
  };

  const openEdit = (a: Announcement) => {
    setEditingId(a._id);
    setHeadline(a.headline || "");
    setBody(a.body || "");
    setAudience((a.audience as any) || "all");
    setMediaType((a.mediaType as any) || "none");
    setMediaUrl(a.mediaUrl || "");
    setMediaPosterUrl(a.mediaPosterUrl || "");
    setActionLabel(a.actionLabel || "");
    setActionRoute(a.actionRoute || "");
    setDesign({ ...DEFAULT_DESIGN, ...(a.design || {}) });
  };

  const saveDraft = async () => {
    if (showOffline || busy) return;
    const h = headline.trim();
    const b = body.trim();
    if (!h || !b) {
      setError("Headline and body are required.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const token = await getToken();
      if (!token) {
        setError("Session expired.");
        return;
      }
      const payload = {
        headline: h,
        body: b,
        audience,
        mediaType,
        mediaUrl,
        mediaPosterUrl,
        actionLabel,
        actionRoute,
        design,
      };
      if (editingId) {
        await adminFetch(`/admin/announcements/${editingId}`, token, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        const json = await adminFetch<{ data: Announcement }>(
          `/admin/announcements`,
          token,
          { method: "POST", body: JSON.stringify(payload) }
        );
        if (json.data?._id) setEditingId(json.data._id);
      }
      await load();
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const publish = async (id: string) => {
    if (showOffline || busy) return;
    try {
      setBusy(true);
      setError("");
      const token = await getToken();
      const json = await adminFetch<{ deliveredCount?: number }>(
        `/admin/announcements/${id}/publish`,
        token,
        { method: "POST", body: JSON.stringify({}) }
      );
      await load();
      setError("");
      alert(
        `Published. Delivered to ${json.deliveredCount ?? "—"} users (snapshot at publish time).`
      );
    } catch (e: any) {
      setError(e?.message || "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string) => {
    if (showOffline || busy) return;
    try {
      setBusy(true);
      const token = await getToken();
      await adminFetch(`/admin/announcements/${id}/archive`, token, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await load();
    } catch (e: any) {
      setError(e?.message || "Archive failed");
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = async (file: File, kind: "image" | "video") => {
    if (showOffline) return;
    try {
      setUploadBusy(true);
      setError("");
      const token = await getToken();
      if (!token) {
        setError("Session expired.");
        return;
      }
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);

      const base =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${base}/admin/announcements/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Upload failed");
      }
      const url = json.data?.url || "";
      if (kind === "image") {
        setMediaType("image");
        setMediaUrl(url);
      } else {
        setMediaType("video");
        setMediaUrl(url);
      }
    } catch (e: any) {
      setError(e?.message || "Upload failed — check Supabase env & bucket");
    } finally {
      setUploadBusy(false);
    }
  };

  const uploadPoster = async (file: File) => {
    if (showOffline) return;
    try {
      setUploadBusy(true);
      const token = await getToken();
      if (!token) return;
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "image");
      const base =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${base}/admin/announcements/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Poster upload failed");
      }
      setMediaPosterUrl(json.data?.url || "");
    } catch (e: any) {
      setError(e?.message || "Poster upload failed");
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <div
      className={cn(
        poppins.className,
        "relative min-h-[70vh] pb-28 text-[#F5F7FA]"
      )}
    >
      {showOffline && (
        <div className="mb-4 flex items-start gap-3 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">You’re offline</p>
            <p className="mt-0.5 text-xs text-amber-100/80">
              Announcements need a connection.
            </p>
          </div>
        </div>
      )}

      <header className="mb-6 border-b border-[#252A33] pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
          Platform
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-semibold leading-none tracking-tight sm:text-[28px]">
              Announcements
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#A7ADB8]">
              One-way notices to users who exist at publish time. Design for web
              & mobile. Media via Supabase. No text-back.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              tone="ghost"
              className="h-9 gap-1.5 text-xs"
              disabled={loading || showOffline}
              onClick={() => load()}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", loading && "animate-spin")}
              />
              Refresh
            </Button>
            <Button
              className="h-9 gap-1.5 text-xs"
              onClick={resetEditor}
              disabled={showOffline}
            >
              <Megaphone className="h-3.5 w-3.5" />
              New draft
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ─── Editor ─── */}
        <Panel className="overflow-hidden">
          <div className="border-b border-[#252A33] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              {editingId ? "Edit draft" : "Compose"}
            </p>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#737A86]">
                Headline
              </p>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Short headline"
                disabled={busy || showOffline}
              />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#737A86]">
                Body
              </p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Message users will see…"
                className="w-full border border-[#252A33] bg-[#11141A] px-3 py-2 text-sm text-[#F5F7FA] outline-none focus:border-[#00E575]/40"
                disabled={busy || showOffline}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#737A86]">
                  Audience
                </p>
                <Select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as any)}
                  disabled={busy || showOffline}
                >
                  <option value="all">All users</option>
                  <option value="buyers">Buyers only</option>
                  <option value="sellers">Sellers only</option>
                </Select>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#737A86]">
                  Media type
                </p>
                <Select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value as any)}
                  disabled={busy || showOffline}
                >
                  <option value="none">None</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </Select>
              </div>
            </div>

            {mediaType !== "none" && (
              <div className="space-y-2 border border-[#252A33] bg-[#11141A] p-3">
                <p className="text-xs text-[#A7ADB8]">
                  Upload to Supabase bucket <code>announcements</code>
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept={mediaType === "video" ? "video/*" : "image/*"}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      uploadFile(f, mediaType === "video" ? "video" : "image");
                    e.target.value = "";
                  }}
                />
                <Button
                  tone="ghost"
                  className="gap-2 text-xs"
                  disabled={uploadBusy || showOffline}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadBusy ? "Uploading…" : `Upload ${mediaType}`}
                </Button>
                {mediaUrl ? (
                  <p className="truncate text-[11px] text-[#737A86]">
                    {mediaUrl}
                  </p>
                ) : null}

                {mediaType === "video" && (
                  <>
                    <input
                      ref={posterRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadPoster(f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      tone="ghost"
                      className="gap-2 text-xs"
                      disabled={uploadBusy || showOffline}
                      onClick={() => posterRef.current?.click()}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Upload poster image
                    </Button>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#737A86]">
                  CTA label
                </p>
                <Input
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  placeholder="Optional"
                  disabled={busy || showOffline}
                />
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#737A86]">
                  CTA route
                </p>
                <Input
                  value={actionRoute}
                  onChange={(e) => setActionRoute(e.target.value)}
                  placeholder="/orders"
                  disabled={busy || showOffline}
                />
              </div>
            </div>

            {/* Design tokens */}
            <div className="border-t border-[#252A33] pt-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
                Design
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Select
                  value={design.layout}
                  onChange={(e) =>
                    setDesign((d) => ({ ...d, layout: e.target.value as any }))
                  }
                >
                  <option value="stack">Layout: stack</option>
                  <option value="split">Layout: split</option>
                  <option value="banner">Layout: banner</option>
                </Select>
                <Select
                  value={design.theme}
                  onChange={(e) =>
                    setDesign((d) => ({ ...d, theme: e.target.value as any }))
                  }
                >
                  <option value="dark">Theme: dark</option>
                  <option value="light">Theme: light</option>
                  <option value="brand">Theme: brand</option>
                </Select>
                <Select
                  value={design.accent}
                  onChange={(e) =>
                    setDesign((d) => ({ ...d, accent: e.target.value as any }))
                  }
                >
                  <option value="green">Accent: green</option>
                  <option value="amber">Accent: amber</option>
                  <option value="blue">Accent: blue</option>
                  <option value="neutral">Accent: neutral</option>
                </Select>
                <Select
                  value={design.titleSize}
                  onChange={(e) =>
                    setDesign((d) => ({
                      ...d,
                      titleSize: e.target.value as any,
                    }))
                  }
                >
                  <option value="sm">Title: sm</option>
                  <option value="md">Title: md</option>
                  <option value="lg">Title: lg</option>
                </Select>
                <Select
                  value={design.mediaAspect}
                  onChange={(e) =>
                    setDesign((d) => ({
                      ...d,
                      mediaAspect: e.target.value as any,
                    }))
                  }
                >
                  <option value="16:9">Aspect 16:9</option>
                  <option value="1:1">Aspect 1:1</option>
                  <option value="4:5">Aspect 4:5</option>
                  <option value="auto">Aspect auto</option>
                </Select>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-[#A7ADB8]">
                <input
                  type="checkbox"
                  checked={design.showMediaTop}
                  onChange={(e) =>
                    setDesign((d) => ({
                      ...d,
                      showMediaTop: e.target.checked,
                    }))
                  }
                />
                Show media
              </label>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-[#252A33] pt-4">
              <Button
                disabled={busy || showOffline}
                onClick={saveDraft}
              >
                {busy ? "Saving…" : editingId ? "Save changes" : "Save draft"}
              </Button>
              {editingId && (
                <Button
                  tone="ghost"
                  disabled={busy || showOffline}
                  onClick={() => publish(editingId)}
                >
                  Publish
                </Button>
              )}
              <Button tone="ghost" disabled={busy} onClick={resetEditor}>
                Clear
              </Button>
            </div>
            <p className="text-[11px] text-[#737A86]">
              Publish notifies only users who exist at that moment (not future
              signups). Always non-replyable.
            </p>
          </div>
        </Panel>

        {/* ─── Preview + list ─── */}
        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <div className="border-b border-[#252A33] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
                Live preview
              </p>
            </div>
            <div className="p-4">
              <LivePreview
                headline={headline}
                body={body}
                mediaType={mediaType}
                mediaUrl={mediaUrl}
                mediaPosterUrl={mediaPosterUrl}
                actionLabel={actionLabel}
                design={design}
              />
            </div>
          </Panel>

          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </div>

          {loading && items.length === 0 ? (
            <div className="border border-[#252A33] bg-[#11141A]">
              <OrbLoader label="Loading announcements" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No announcements"
              body="Save a draft to get started."
            />
          ) : (
            <div className="space-y-2">
              {items.map((a) => (
                <div
                  key={a._id}
                  className="border border-[#252A33] bg-[#11141A] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={statusTone(a.status)}>
                          {a.status || "—"}
                        </Badge>
                        <Badge tone="neutral">{a.audience || "all"}</Badge>
                        <Badge tone="neutral">No reply</Badge>
                      </div>
                      <p className="mt-2 font-medium">{a.headline}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-[#A7ADB8]">
                        {a.body}
                      </p>
                      <p className="mt-2 text-[11px] text-[#737A86]">
                        {a.status === "published"
                          ? `Published ${fmt(a.publishedAt)} · delivered ${a.deliveredCount ?? 0}`
                          : `Updated ${fmt(a.updatedAt)}`}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        tone="ghost"
                        className="h-8 text-xs"
                        onClick={() => openEdit(a)}
                        disabled={showOffline}
                      >
                        Edit
                      </Button>
                      {a.status === "draft" && (
                        <Button
                          className="h-8 text-xs"
                          onClick={() => publish(a._id)}
                          disabled={busy || showOffline}
                        >
                          Publish
                        </Button>
                      )}
                      {a.status !== "archived" && (
                        <Button
                          tone="ghost"
                          className="h-8 text-xs text-amber-200"
                          onClick={() => archive(a._id)}
                          disabled={busy || showOffline}
                        >
                          Archive
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}