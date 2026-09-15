"use client";

import { useCallback, useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { getConnectionInfo, type NetworkKind } from "@/lib/networkStatus";

const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";

export function NetworkStatusBanner() {
  const [kind, setKind] = useState<NetworkKind>("online");
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const sync = useCallback(() => {
    const { online, slow } = getConnectionInfo();
    if (!online) {
      setKind("offline");
      setVisible(true);
      return;
    }
    if (slow) {
      setKind("slow");
      setVisible(true);
      return;
    }
    setKind("online");
    setVisible(false);
  }, []);

  useEffect(() => {
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    sync();

    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    const conn = (navigator as Navigator & { connection?: EventTarget })
      .connection;
    conn?.addEventListener?.("change", sync);

    // Lightweight reachability check (optional, doesn’t block UI)
    let cancelled = false;
    const probe = async () => {
      if (!navigator.onLine) {
        sync();
        return;
      }
      try {
        const ctrl = new AbortController();
        const t = window.setTimeout(() => ctrl.abort(), 4000);
        const start = performance.now();
        await fetch("/favicon.ico", {
          method: "HEAD",
          cache: "no-store",
          signal: ctrl.signal,
        });
        window.clearTimeout(t);
        const ms = performance.now() - start;
        if (cancelled) return;
        if (ms > 3500) {
          setKind("slow");
          setVisible(true);
        } else {
          sync();
        }
      } catch {
        if (cancelled) return;
        if (!navigator.onLine) {
          setKind("offline");
          setVisible(true);
        }
      }
    };

    probe();
    const interval = window.setInterval(probe, 20000);

    return () => {
      cancelled = true;
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      conn?.removeEventListener?.("change", sync);
      window.clearInterval(interval);
    };
  }, [sync]);

  if (!visible || kind === "online") return null;

  const isOffline = kind === "offline";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div
        className="pointer-events-auto w-full max-w-lg border border-white/[0.1] bg-[#0E1116]/96 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
        style={{
          opacity: 1,
          transform: reduceMotion ? undefined : "translateY(0)",
          transition: reduceMotion
            ? "opacity 160ms ease"
            : "opacity 220ms ease, transform 220ms ease",
        }}
      >
        <div className="h-px w-full" style={{ backgroundImage: GRAD }} />
        <div className="flex items-start gap-3 px-4 py-3.5">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border ${
              isOffline
                ? "border-red-500/30 bg-red-500/10"
                : "border-amber-500/30 bg-amber-500/10"
            }`}
          >
            {isOffline ? (
              <WifiOff className="h-4 w-4 text-red-400" />
            ) : (
              <Wifi className="h-4 w-4 text-amber-400" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold tracking-[0.16em] text-white/40">
              CONNECTION
            </p>
            <p className="mt-0.5 text-[14px] font-bold text-[#F5F7FA]">
              {isOffline ? "No internet connection" : "Connection is slow"}
            </p>
            <p className="mt-1 text-[12.5px] leading-[18px] text-[#A7ADB8]">
              {isOffline
                ? "Plazore can’t reach the network right now. Check your connection — we’ll reconnect automatically."
                : "Your network is responding slowly. Some actions may take longer than usual."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}