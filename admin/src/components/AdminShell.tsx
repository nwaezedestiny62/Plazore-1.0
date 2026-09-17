"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { PerformanceFloat } from "@/components/PerformanceFloat";
import { TV_ROOM_BG, countKeyForPath } from "@/lib/tvCatalog";
import { markCountSeen } from "@/lib/tvSeen";

const RAIL_KEY = "plazore.admin.railOpen";

const RAIL = [
  { href: "/overview", label: "Home", icon: Home },
  { href: "/analytics", label: "Analytics", icon: LayoutGrid },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/overview";
  const [railOpen, setRailOpen] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(RAIL_KEY);
      if (v === "0") setRailOpen(false);
      else setRailOpen(true);
    } catch {
      setRailOpen(true);
    }
    setReady(true);
  }, []);

  const toggleRail = () => {
    setRailOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(RAIL_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    const key = countKeyForPath(pathname);
    if (!key) return;
    const raw = sessionStorage.getItem("plazore.admin.liveCounts");
    if (!raw) return;
    try {
      const counts = JSON.parse(raw) as Record<string, number>;
      markCountSeen(key, Number(counts[key] ?? 0));
    } catch {
      /* ignore */
    }
  }, [pathname]);

  const pad = ready && railOpen ? "pl-16 sm:pl-[72px]" : "pl-0";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#090B0F] text-[#F5F7FA]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={TV_ROOM_BG}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[#090B0F]/74" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#090B0F]/92 via-[#090B0F]/60 to-transparent" />

      <div className="relative z-10 flex min-h-dvh">
        {/* Rail */}
        <aside
          className={`fixed left-0 top-0 z-40 flex h-dvh flex-col items-center bg-black/40 py-4 backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            railOpen
              ? "w-16 translate-x-0 opacity-100 sm:w-[72px]"
              : "w-16 -translate-x-full opacity-0 pointer-events-none"
          }`}
        >
          {/* Logo on top */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/plazore-logo.png"
            alt="Plazore"
            className="mb-5 h-8 w-8 object-contain"
          />

          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#171B22] ring-1 ring-white/20">
            <UserButton
              appearance={{
                elements: {
                  rootBox: "flex h-10 w-10 items-center justify-center",
                  avatarBox: "h-10 w-10 rounded-full",
                  userButtonTrigger:
                    "h-10 w-10 rounded-full focus:shadow-none focus:ring-0",
                  userButtonAvatarBox: "h-10 w-10 rounded-full",
                  userButtonAvatarImage:
                    "h-10 w-10 rounded-full object-cover",
                },
              }}
            />
          </div>

          <nav className="mt-8 flex flex-1 flex-col items-center gap-3">
            {RAIL.map((item) => {
              const active =
                item.href === "/overview"
                  ? isHome
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  aria-label={item.label}
                  onClick={() => router.push(item.href)}
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition duration-300 ${
                    active
                      ? "bg-white text-[#090B0F] shadow-[0_0_24px_rgba(255,255,255,0.28)]"
                      : "text-white/50 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            aria-label="Hide navigation"
            onClick={toggleRail}
            className="mb-1 flex h-10 w-10 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </aside>

        {/* Edge control when rail is closed */}
        {!railOpen && ready && (
          <button
            type="button"
            aria-label="Show navigation"
            onClick={toggleRail}
            className="fixed left-3 top-1/2 z-50 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#0E1116]/90 text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md transition duration-300 hover:border-[#00E575]/40 hover:text-[#00E575]"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        <div
          className={`flex min-h-dvh min-w-0 flex-1 flex-col transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${pad}`}
        >
          {!isHome && (
            <header className="flex items-center gap-3 px-4 py-4 sm:px-8">
              <Link
                href="/overview"
                aria-label="Back to home"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition duration-300 hover:bg-white hover:text-[#090B0F]"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
              </Link>
              {!railOpen && (
                <button
                  type="button"
                  aria-label="Show navigation"
                  onClick={toggleRail}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white sm:hidden"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </header>
          )}

          <main
            className={`min-w-0 flex-1 ${
              isHome ? "" : "tv-screen-in px-4 pb-16 sm:px-8"
            }`}
          >
            {children}
            <PerformanceFloat />
          </main>
        </div>
      </div>
    </div>
  );
}