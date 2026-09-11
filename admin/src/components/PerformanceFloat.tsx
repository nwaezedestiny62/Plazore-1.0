"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { useEffect, useState } from "react";
import { Activity, Minus, ChevronUp } from "lucide-react";
import { adminFetch } from "@/lib/api";
import { cn } from "@/components/ui";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const STORAGE_KEY = "plazore.admin.performanceFloat.open";

type Summary = {
  overall: string;
  activeIncidents: number;
  services: {
    app: string;
    web: string;
    api: string;
    database: string;
  };
  lastObserved?: string;
  environment?: string;
};

function tone(state: string) {
  if (state === "operational") return "text-[#00E575]";
  if (state === "degraded" || state === "warning") return "text-amber-400";
  if (state === "critical") return "text-red-300";
  return "text-[#737A86]";
}

function dot(state: string) {
  if (state === "operational") return "bg-[#00E575]";
  if (state === "degraded" || state === "warning") return "bg-amber-400";
  if (state === "critical") return "bg-red-400";
  return "bg-[#737A86]";
}

function pulseRing(state: string) {
  if (state === "critical") return "ring-red-400/40";
  if (state === "degraded" || state === "warning") return "ring-amber-400/35";
  if (state === "operational") return "ring-[#00E575]/30";
  return "ring-[#252A33]";
}

function label(state: string) {
  if (state === "operational") return "Operational";
  if (state === "no_data") return "No data";
  if (!state) return "—";
  return state.charAt(0).toUpperCase() + state.slice(1);
}

export function PerformanceFloat() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Restore preference once on client (default = open)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "0" || raw === "false") setOpen(false);
      else setOpen(true);
    } catch {
      setOpen(true);
    }
    setReady(true);
  }, []);

  const persistOpen = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore quota / private mode
    }
  };

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const token = await getToken();
        const json = await adminFetch<{ data: Summary }>(
          "/admin/performance/summary?environment=production",
          token
        );
        if (!cancelled) setSummary(json.data);
      } catch {
        // silent
      }
    };

    tick();
    const id = setInterval(tick, 45_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [getToken, isLoaded, isSignedIn]);

  // Avoid flash of wrong state before localStorage read
  if (!ready) return null;

  const overall = summary?.overall || "no_data";
  const incidents = summary?.activeIncidents ?? 0;

  // ── Collapsed: compact status chip (always shows health) ──
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => persistOpen(true)}
        title={`Performance · ${label(overall)} — click to expand`}
        className={cn(
          poppins.className,
          "fixed bottom-4 right-4 z-50 flex items-center gap-2 border border-[#252A33] bg-[#11141A]/95 px-2.5 py-2 shadow-lg backdrop-blur transition",
          "hover:border-[#00E575]/35 hover:text-[#F5F7FA]",
          "max-sm:bottom-16",
          "ring-1",
          pulseRing(overall)
        )}
      >
        <span className="relative flex h-2.5 w-2.5">
          {(overall === "critical" || overall === "warning") && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                dot(overall)
              )}
            />
          )}
          <span
            className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", dot(overall))}
          />
        </span>
        <span className="text-[11px] font-medium text-[#A7ADB8]">Perf</span>
        <span className={cn("text-[11px] font-semibold", tone(overall))}>
          {label(overall)}
        </span>
        {incidents > 0 ? (
          <span className="rounded-sm bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
            {incidents}
          </span>
        ) : null}
        <ChevronUp className="h-3.5 w-3.5 text-[#737A86]" />
      </button>
    );
  }

  // ── Expanded card ──
  const rows = [
    { k: "App", v: summary?.services?.app },
    { k: "Web", v: summary?.services?.web },
    { k: "API", v: summary?.services?.api },
    { k: "Database", v: summary?.services?.database },
  ];

  return (
    <div
      className={cn(
        poppins.className,
        "fixed bottom-4 right-4 z-50 w-[min(100vw-2rem,272px)] border border-[#252A33] bg-[#11141A]/95 shadow-xl backdrop-blur",
        "max-sm:bottom-16",
        "ring-1",
        pulseRing(overall)
      )}
    >
      <div className="flex items-center justify-between border-b border-[#252A33] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-[#00E575]" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#737A86]">
            Performance
          </p>
        </div>
        <button
          type="button"
          onClick={() => persistOpen(false)}
          className="flex h-7 w-7 items-center justify-center border border-transparent text-[#737A86] transition hover:border-[#252A33] hover:bg-[#171B22] hover:text-[#F5F7FA]"
          aria-label="Hide performance card"
          title="Hide — status stays visible"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {(overall === "critical" || overall === "warning") && (
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                  dot(overall)
                )}
              />
            )}
            <span
              className={cn(
                "relative inline-flex h-2.5 w-2.5 rounded-full",
                dot(overall)
              )}
            />
          </span>
          <span className={cn("text-sm font-semibold", tone(overall))}>
            {label(overall)}
          </span>
        </div>

        <ul className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.k}
              className="flex items-center justify-between text-[12px]"
            >
              <span className="text-[#A7ADB8]">{r.k}</span>
              <span className={cn("font-medium", tone(r.v || "no_data"))}>
                {label(r.v || "no_data")}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-[11px] text-[#737A86]">
          Active issues — {incidents}
        </p>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <Link
            href="/performance"
            className="text-[12px] font-semibold text-[#00E575] transition hover:brightness-110"
          >
            View performance →
          </Link>
          <button
            type="button"
            onClick={() => persistOpen(false)}
            className="text-[11px] text-[#737A86] transition hover:text-[#A7ADB8]"
          >
            Hide
          </button>
        </div>
      </div>
    </div>
  );
}