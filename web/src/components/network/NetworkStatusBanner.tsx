"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Wifi, WifiOff, X } from "lucide-react";
import { getConnectionInfo, type NetworkKind } from "@/lib/networkStatus";

const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";

/** How often we measure reachability */
const PROBE_MS = 15_000;
/** Abort + treat as slow only if this long */
const PROBE_TIMEOUT_MS = 5_000;
/** RTT above this counts as one slow sample */
const SLOW_RTT_MS = 2_800;
/** Need this many consecutive slow samples before showing */
const SLOW_STREAK_NEED = 3;
/** Slow banner auto-hides after this (must not feel permanent) */
const SLOW_VISIBLE_MS = 10_000;
/** After hide, ignore slow for this long */
const SLOW_COOLDOWN_MS = 90_000;
/** Offline must last at least this before showing */
const OFFLINE_GRACE_MS = 1_500;
const ONLINE_TOAST_MS = 2_200;

type DisplayKind = NetworkKind | "restored";

export function NetworkStatusBanner() {
  const [display, setDisplay] = useState<DisplayKind>("online");
  const [open, setOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const slowStreak = useRef(0);
  const slowCooldownUntil = useRef(0);
  const offlineSince = useRef<number | null>(null);
  const wasOffline = useRef(false);
  const displayRef = useRef<DisplayKind>("online");
  const openRef = useRef(false);
  const timers = useRef<number[]>([]);
  const probing = useRef(false);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };

  const show = useCallback((kind: DisplayKind, autoHideMs?: number) => {
    displayRef.current = kind;
    openRef.current = true;
    setDisplay(kind);
    setOpen(true);
    clearTimers();
    if (autoHideMs && autoHideMs > 0) {
      later(() => {
        openRef.current = false;
        setOpen(false);
        if (kind === "slow") {
          slowCooldownUntil.current = Date.now() + SLOW_COOLDOWN_MS;
        }
      }, autoHideMs);
    }
  }, []);

  const hide = useCallback(() => {
    openRef.current = false;
    setOpen(false);
    clearTimers();
  }, []);

  const apply = useCallback(
    (kind: NetworkKind) => {
      const now = Date.now();

      if (kind === "offline") {
        if (offlineSince.current == null) offlineSince.current = now;
        if (now - (offlineSince.current ?? now) < OFFLINE_GRACE_MS) return;
        wasOffline.current = true;
        slowStreak.current = 0;
        show("offline"); // stays until recovery
        return;
      }

      offlineSince.current = null;

      if (kind === "online") {
        slowStreak.current = 0;
        // Always clear a lingering slow banner when probes are healthy
        if (openRef.current && displayRef.current === "slow") {
          hide();
        }
        if (wasOffline.current) {
          wasOffline.current = false;
          show("restored", ONLINE_TOAST_MS);
        } else if (openRef.current && displayRef.current === "offline") {
          hide();
        }
        return;
      }

      // kind === "slow" — only from measured probe, never API hint alone
      if (displayRef.current === "offline" && openRef.current) return;
      if (now < slowCooldownUntil.current) return;

      slowStreak.current += 1;
      if (slowStreak.current < SLOW_STREAK_NEED) return;
      if (openRef.current && displayRef.current === "slow") return;

      show("slow", SLOW_VISIBLE_MS);
    },
    [hide, show]
  );

  useEffect(() => {
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );

    const probe = async () => {
      if (probing.current) return;
      probing.current = true;
      try {
        const { online } = getConnectionInfo();

        if (!online) {
          apply("offline");
          return;
        }

        const ctrl = new AbortController();
        const t = window.setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
        const start = performance.now();
        let ok = false;
        try {
          // GET + cache-bust — HEAD often fails on static hosts and must not mean "slow"
          await fetch(`/favicon.ico?n=${Date.now()}`, {
            method: "GET",
            cache: "no-store",
            signal: ctrl.signal,
          });
          ok = true;
        } catch {
          ok = false;
        }
        window.clearTimeout(t);
        const rtt = performance.now() - start;

        if (!navigator.onLine) {
          apply("offline");
          return;
        }

        // Failed probe while still "online" → ignore (CDN/404/adblock), do not force slow
        if (!ok) {
          apply("online");
          return;
        }

        if (rtt >= SLOW_RTT_MS) apply("slow");
        else apply("online");
      } finally {
        probing.current = false;
      }
    };

    const onOffline = () => apply("offline");
    const onOnline = () => {
      void probe();
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    void probe();
    const interval = window.setInterval(() => void probe(), PROBE_MS);

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
      clearTimers();
    };
  }, [apply]);

  const kind = display;
  const visible = open && kind !== "online";
  if (!visible) return null;

  const copy =
    kind === "offline"
      ? {
          title: "No internet connection",
          body: "Plazore can’t reach the network. We’ll reconnect automatically.",
          icon: "off" as const,
        }
      : kind === "slow"
        ? {
            title: "Connection is slow",
            body: "The network is responding slowly. Some actions may take longer.",
            icon: "slow" as const,
          }
        : {
            title: "You’re back online",
            body: "Connection restored. You can continue as usual.",
            icon: "on" as const,
          };

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div
        className="pointer-events-auto w-full max-w-lg border border-white/[0.1] bg-[#0E1116]/96 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
        style={{
          animation: reduceMotion
            ? undefined
            : "plazore-net-in 280ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div className="h-px w-full" style={{ backgroundImage: GRAD }} />
        <div className="flex items-start gap-3 px-4 py-3.5">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border ${
              copy.icon === "off"
                ? "border-red-500/30 bg-red-500/10"
                : copy.icon === "slow"
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-emerald-500/30 bg-emerald-500/10"
            }`}
          >
            {copy.icon === "off" ? (
              <WifiOff className="h-4 w-4 text-red-400" />
            ) : (
              <Wifi
                className={`h-4 w-4 ${
                  copy.icon === "slow" ? "text-amber-400" : "text-[#00E575]"
                }`}
              />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold tracking-[0.16em] text-white/40">
              CONNECTION
            </p>
            <p className="mt-0.5 text-[14px] font-bold text-[#F5F7FA]">
              {copy.title}
            </p>
            <p className="mt-1 text-[12.5px] leading-[18px] text-[#A7ADB8]">
              {copy.body}
            </p>
          </div>
          {kind === "slow" ? (
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => {
                hide();
                slowCooldownUntil.current = Date.now() + SLOW_COOLDOWN_MS;
                slowStreak.current = 0;
              }}
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
      <style jsx global>{`
        @keyframes plazore-net-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}