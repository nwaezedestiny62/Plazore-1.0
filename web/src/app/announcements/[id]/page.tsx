"use client";

import { useAuth } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Lock } from "lucide-react";
import {
  AnnouncementCard,
  type AnnouncementData,
} from "@/components/AnnouncementCard";
import { fetchAnnouncementById, fetchPublicAnnouncements } from "@/lib/api";

export default function AnnouncementDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const router = useRouter();
  const { getToken } = useAuth();
  const [item, setItem] = useState<AnnouncementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      // Prefer dedicated detail if backend adds it; else search public list
      try {
        const one = await fetchAnnouncementById(id);
        if (one) {
          setItem(one);
          return;
        }
      } catch {
        /* fall through */
      }

      const list = await fetchPublicAnnouncements({ limit: 30 });
      const found = list.find((a) => String(a._id) === id);
      if (found) setItem(found);
      else setError("Announcement not found or no longer available.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load announcement");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-white/[0.07] bg-[#090B0F]/95 px-2 py-2.5 backdrop-blur sm:px-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight">
            Announcement
          </h1>
          <p className="text-[11px] text-[#6B7280]">From Plazore</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00E575] border-t-transparent" />
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#A7ADB8]">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-4 border border-white/[0.07] bg-[#11141A] px-4 py-2 text-sm font-bold text-[#00E575]"
            >
              Retry
            </button>
          </div>
        ) : item ? (
          <>
            <AnnouncementCard
              data={item}
              onAction={(route) => {
                if (route.startsWith("/")) router.push(route);
                else if (route.startsWith("http"))
                  window.open(route, "_blank", "noopener,noreferrer");
              }}
            />
            <div className="mt-4 flex items-start gap-2 border border-white/[0.07] bg-[#11141A] p-3">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6B7280]" />
              <p className="text-xs leading-relaxed text-[#6B7280]">
                This is a one-way notice. You can’t reply to announcements.
              </p>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}