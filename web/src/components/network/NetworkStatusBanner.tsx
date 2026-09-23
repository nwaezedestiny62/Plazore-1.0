"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Wifi, WifiOff, X } from "lucide-react";
import { getConnectionInfo } from "@/lib/networkStatus";

const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";

/** Offline toast visible duration */
const OFFLINE_VISIBLE_MS = 6_000;
/** Wait this long after hide before showing offline again (if still offline) */
const OFFLINE_REMIND_MS = 30_000;
/** Ignore brief blips before first offline show */
const OFFLINE_GRACE_MS = 1_200;
/** “Back online” toast */
const RESTORED_VISIBLE_MS = 2_400;

/** Slow connection (optional, same disciplined pattern) */
const PROBE_MS = 20_000;
const PROBE_TIMEOUT_MS = 5_000;
const SLOW_RTT_MS = 2_800;
const SLOW_STREAK_NEED = 3;
const SLOW_VISIBLE_MS = 8_000;
const SLOW_COOLDOWN_MS = 90_000;

type DisplayKind = "offline" | "slow" | "restored";

export function NetworkStatusBanner() {
  const [kind, setKind] = useState<DisplayKind | null>(null);
  const [open, setOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [exiting, setExiting] = useState(false);

  const offlineSince = useRef<number | null>(null);
  const wasOffline = useRef(false);
  const isOffline = useRef(false);
  const openRef = useRef(false);
  const kindRef = useRef<DisplayKind | null>(null);
  const slowStreak = useRef(0);
  const slowCooldownUntil = useRef(0);
  const probing = useRef(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);

  const hideSmooth = useCallback(() => {
    setExiting(true);
    later(() => {
      openRef.current = false;
      kindRef.current = null;
      setOpen(false);
      setKind(null);
      setExiting(false);
    }, 280);
  }, [later]);

  /**
   * Show toast for `visibleMs`, then hide.
   * For offline: after hide, if still offline, schedule another show in 30s.
   */
  const showToast = useCallback(
    (next: DisplayKind, visibleMs: number) => {
      clearTimers();
      setExiting(false);
      kindRef.current = next;
      openRef.current = true;
      setKind(next);
      setOpen(true);

      later(() => {
        setExiting(true);
        later(() => {
          openRef.current = false;
          kindRef.current = null;
          setOpen(false);
          setKind(null);
          setExiting(false);

          // Offline reminder cycle: only if still offline
          if (next === "offline" && isOffline.current) {
            later(() => {
              if (isOffline.current && !openRef.current) {
                showToast("offline", OFFLINE_VISIBLE_MS);
              }
            }, OFFLINE_REMIND_MS);
          }

          if (next === "slow") {
            slowCooldownUntil.current = Date.now() + SLOW_COOLDOWN_MS;
          }
        }, 280);
      }, visibleMs);
    },
    [clearTimers, later]
  );

  const onOffline = useCallback(() => {
    const now = Date.now();
    if (offlineSince.current == null) offlineSince.current = now;
    if (now - (offlineSince.current ?? now) < OFFLINE_GRACE_MS) return;

    isOffline.current = true;
    wasOffline.current = true;
    slowStreak.current = 0;

    // Already showing offline — don't restart the 6s clock mid-toast
    if (openRef.current && kindRef.current === "offline") return;

    showToast("offline", OFFLINE_VISIBLE_MS);
  }, [showToast]);

  const onOnline = useCallback(() => {
    offlineSince.current = null;
    isOffline.current = false;
    slowStreak.current = 0;

    // Cancel any pending offline remind timers
    clearTimers();

    if (wasOffline.current) {
      wasOffline.current = false;
      showToast("restored", RESTORED_VISIBLE_MS);
      return;
    }

    // Clear offline/slow if open
    if (openRef.current) {
      hideSmooth();
    }
  }, [clearTimers, hideSmooth, showToast]);

  const applySlow = useCallback(() => {
    if (isOffline.current) return;
    if (Date.now() < slowCooldownUntil.current) return;
    if (openRef.current && kindRef.current === "slow") return;

    slowStreak.current += 1;
    if (slowStreak.current < SLOW_STREAK_NEED) return;

    showToast("slow", SLOW_VISIBLE_MS);
  }, [showToast]);

  useEffect(() => {
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );

    const probe = async () => {
      if (probing.current) return;
      probing.current = true;
      try {
        const { online } = getConnectionInfo();

        if (!online || !navigator.onLine) {
          onOffline();
          return;
        }

        // Browser says online — verify with a light request
        const ctrl = new AbortController();
        const t = window.setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
        const start = performance.now();
        let ok = false;
        try {
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
          onOffline();
          return;
        }

        // Probe failed while browser still online → don't treat as offline
        // (adblock / CDN) — just treat as healthy enough
        if (!ok) {
          if (isOffline.current) onOnline();
          return;
        }

        if (isOffline.current) {
          onOnline();
          return;
        }

        if (rtt >= SLOW_RTT_MS) applySlow();
        else slowStreak.current = 0;
      } finally {
        probing.current = false;
      }
    };

    const handleOffline = () => onOffline();
    const handleOnline = () => {
      void probe();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    void probe();
    const interval = window.setInterval(() => void probe(), PROBE_MS);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.clearInterval(interval);
      clearTimers();
    };
  }, [applySlow, clearTimers, onOffline, onOnline]);

  if (!open || !kind) return null;

  const copy =
    kind === "offline"
      ? {
          title: "No internet connection",
          body: "Plazore can’t reach the network. We’ll check again shortly.",
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

  const anim = reduceMotion
    ? undefined
    : exiting
      ? "plazore-net-out 280ms cubic-bezier(0.4, 0, 1, 1) forwards"
      : "plazore-net-in 320ms cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div
        className="pointer-events-auto w-full max-w-lg border border-white/[0.1] bg-[#0E1116]/96 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
        style={{ animation: anim }}
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

          {kind === "slow" || kind === "offline" ? (
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => {
                clearTimers();
                hideSmooth();
                if (kind === "offline" && isOffline.current) {
                  // Still schedule next reminder after 30s if they dismiss early
                  later(() => {
                    if (isOffline.current && !openRef.current) {
                      showToast("offline", OFFLINE_VISIBLE_MS);
                    }
                  }, OFFLINE_REMIND_MS);
                }
                if (kind === "slow") {
                  slowCooldownUntil.current = Date.now() + SLOW_COOLDOWN_MS;
                  slowStreak.current = 0;
                }
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
            transform: translateY(-12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes plazore-net-out {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-8px);
          }
        }
      `}</style>
    </div>
  );
}