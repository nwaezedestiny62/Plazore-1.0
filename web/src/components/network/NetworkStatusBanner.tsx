"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { getConnectionInfo, type NetworkKind } from "@/lib/networkStatus";

const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";

const SLOW_VISIBLE_MS = 80_000; // 1m 20s on screen
const SLOW_COOLDOWN_MS = 60_000; // wait 1m before showing slow again
const ONLINE_TOAST_MS = 2400;
const PROBE_MS = 12_000;
const SLOW_RTT_MS = 4_000;
const OFFLINE_GRACE_MS = 1_200; // ignore tiny blips
const SLOW_STREAK_NEED = 2;

type DisplayKind = NetworkKind | "restored";

export function NetworkStatusBanner() {
  const [display, setDisplay] = useState<DisplayKind>("online");
  const [open, setOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const slowStreak = useRef(0);
  const slowHideAt = useRef(0);
  const slowCooldownUntil = useRef(0);
  const offlineSince = useRef<number | null>(null);
  const wasOffline = useRef(false);
  const timers = useRef<number[]>([]);

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
    setDisplay(kind);
    setOpen(true);
    if (autoHideMs && autoHideMs > 0) {
      later(() => setOpen(false), autoHideMs);
    }
  }, []);

  const hide = useCallback(() => setOpen(false), []);

  const apply = useCallback(
    (kind: NetworkKind) => {
      const now = Date.now();

      if (kind === "offline") {
        if (offlineSince.current == null) offlineSince.current = now;
        if (now - (offlineSince.current ?? now) < OFFLINE_GRACE_MS) return;
        wasOffline.current = true;
        clearTimers();
        show("offline"); // stays until recovered
        return;
      }

      offlineSince.current = null;

      if (kind === "online") {
        slowStreak.current = 0;
        if (wasOffline.current) {
          wasOffline.current = false;
          clearTimers();
          show("restored", ONLINE_TOAST_MS);
        } else if (display === "offline") {
          hide();
        }
        return;
      }

      // slow
      if (display === "offline") return;

      slowStreak.current += 1;
      if (slowStreak.current < SLOW_STREAK_NEED) return;
      if (now < slowCooldownUntil.current) return;
      if (open && display === "slow") return;

      clearTimers();
      show("slow");
      slowHideAt.current = now + SLOW_VISIBLE_MS;
      later(() => {
        hide();
        slowCooldownUntil.current = Date.now() + SLOW_COOLDOWN_MS;
      }, SLOW_VISIBLE_MS);
    },
    [display, hide, open, show],
  );

  useEffect(() => {
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );

    const probe = async () => {
      const { online, hintSlow } = getConnectionInfo();

      if (!online) {
        apply("offline");
        return;
      }

      try {
        const ctrl = new AbortController();
        const t = window.setTimeout(() => ctrl.abort(), SLOW_RTT_MS + 500);
        const start = performance.now();
        await fetch(`/favicon.ico?n=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
          signal: ctrl.signal,
        });
        window.clearTimeout(t);
        const rtt = performance.now() - start;
        if (rtt >= SLOW_RTT_MS || hintSlow) apply("slow");
        else {
          slowStreak.current = 0;
          apply("online");
        }
      } catch {
        if (!navigator.onLine) apply("offline");
        else if (hintSlow) apply("slow");
        // fetch fail while still "online" is often a 404/HEAD issue — do not force slow
        else apply("online");
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