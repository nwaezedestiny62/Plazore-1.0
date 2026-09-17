"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ArrowUpRight, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { adminFetch } from "@/lib/api";

const STORAGE_KEY = "plazore.admin.performanceFloat.open";
/** Same band as ActivityFloat (left). Profile modal uses 9999. */
const Z_FLOAT = 90;

type Summary = {
  overall: string;
  activeIncidents: number;
  services: { app: string; web: string; api: string; database: string };
};

function color(state: string) {
  if (state === "operational") return "#00E575";
  if (state === "degraded" || state === "warning") return "#FBBF24";
  if (state === "critical") return "#F87171";
  return "#737A86";
}

function pretty(state: string) {
  if (state === "operational") return "Operational";
  if (state === "no_data") return "No data";
  if (!state) return "—";
  return state.charAt(0).toUpperCase() + state.slice(1);
}

export function PerformanceFloat() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setOpen(raw !== "0" && raw !== "false");
    } catch {
      setOpen(true);
    }
    setReady(true);
  }, []);

  const persist = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
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
          token,
        );
        if (!cancelled) setSummary(json.data);
      } catch {
        /* silent */
      }
    };
    tick();
    const id = setInterval(tick, 45_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [getToken, isLoaded, isSignedIn]);

  if (!mounted || !ready) return null;

  const overall = summary?.overall || "no_data";
  const c = color(overall);
  const incidents = summary?.activeIncidents ?? 0;

  const shellStyle: React.CSSProperties = {
    position: "fixed",
    right: 16,
    bottom: 20,
    zIndex: Z_FLOAT,
  };

  if (!open) {
    return createPortal(
      <button
        type="button"
        aria-label="Open performance"
        onClick={() => persist(true)}
        style={{
          ...shellStyle,
          boxShadow: `0 0 0 1px ${c}33, 0 0 28px ${c}40`,
        }}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#0E1116]/95 backdrop-blur-md transition duration-300 hover:scale-105"
      >
        <span className="relative flex h-2.5 w-2.5">
          {overall !== "operational" && overall !== "no_data" && (
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
              style={{ background: c }}
            />
          )}
          <span
            className="relative h-2.5 w-2.5 rounded-full"
            style={{ background: c }}
          />
        </span>
      </button>,
      document.body,
    );
  }

  const rows = [
    { k: "App", v: summary?.services?.app },
    { k: "Web", v: summary?.services?.web },
    { k: "API", v: summary?.services?.api },
    { k: "Database", v: summary?.services?.database },
  ];

  return createPortal(
    <div
      style={shellStyle}
      className="w-[min(100vw-2rem,260px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0E1116]/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
    >
      <div className="h-px w-full bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: c }} />
          <p className="text-[11px] font-semibold tracking-[0.16em] text-white/45">
            HEALTH
          </p>
        </div>
        <button
          type="button"
          aria-label="Collapse performance"
          onClick={() => persist(false)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-3.5 pb-3.5">
        <p className="text-[15px] font-semibold" style={{ color: c }}>
          {pretty(overall)}
        </p>
        <ul className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.k}
              className="flex items-center justify-between text-[12px]"
            >
              <span className="text-white/45">{r.k}</span>
              <span style={{ color: color(r.v || "no_data") }}>
                {pretty(r.v || "no_data")}
              </span>
            </li>
          ))}
        </ul>
        {incidents > 0 && (
          <p className="mt-3 text-[11px] text-red-300">
            {incidents} active issues
          </p>
        )}
        <Link
          href="/performance"
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#00E575] transition hover:brightness-110"
        >
          Open health
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
        </Link>
      </div>
    </div>,
    document.body,
  );
}