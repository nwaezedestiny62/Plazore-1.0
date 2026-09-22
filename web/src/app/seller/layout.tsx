"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Diamond,
  Grid2x2,
  LogOut,
  MessageCircle,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
} from "lucide-react";
import {
  fetchMyModeration,
  isContextBlocked,
} from "@/lib/moderation";

const API = process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com";
const PENDING_STATUSES = new Set(["Preparing"]);
const RAIL_KEY = "plazore.seller.railOpen";

const NAV = [
  {
    href: "/seller",
    label: "Dashboard",
    icon: Grid2x2,
    match: (p: string) => p === "/seller",
  },
  {
    href: "/seller/products",
    label: "Products",
    icon: Package,
    match: (p: string) => p.startsWith("/seller/products"),
  },
  {
    href: "/seller/orders",
    label: "Orders",
    icon: Receipt,
    match: (p: string) => p.startsWith("/seller/orders"),
  },
  {
    href: "/seller/messages",
    label: "Messages",
    icon: MessageCircle,
    match: (p: string) => p.startsWith("/seller/messages"),
  },
  {
    href: "/seller/subscription",
    label: "Plan",
    icon: Diamond,
    match: (p: string) => p.startsWith("/seller/subscription"),
  },
] as const;

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span className="absolute -right-1.5 -top-1.5 min-w-[15px] rounded-full border border-[#0C0E12] bg-[#00E575] px-1 text-center text-[9px] font-bold leading-[15px] text-[#041412]">
      {label}
    </span>
  );
}

function ExitToMall({
  compact,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      title="Exit to Mall"
      className={
        className ||
        (compact
          ? "inline-flex h-9 items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 text-[11px] font-semibold text-[#8BA3C7] transition hover:border-white/20 hover:bg-white/[0.07] hover:text-[#F5F7FA]"
          : "inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-3.5 py-2 text-[12px] font-semibold text-[#8BA3C7] transition hover:border-white/18 hover:bg-white/[0.06] hover:text-[#F5F7FA]")
      }
    >
      <LogOut className={compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} strokeWidth={2} />
      <span>Exit to Mall</span>
    </Link>
  );
}

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "";

  const [pendingOrders, setPendingOrders] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const [modChecking, setModChecking] = useState(true);
  const [sellerLocked, setSellerLocked] = useState(false);
  const redirected = useRef(false);

  const [railOpen, setRailOpen] = useState(true);
  const [railReady, setRailReady] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(RAIL_KEY);
      if (v === "0") setRailOpen(false);
      else setRailOpen(true);
    } catch {
      setRailOpen(true);
    }
    setRailReady(true);
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

  const checkModeration = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setModChecking(false);
        return;
      }
      const m = await fetchMyModeration(token);
      const seller = m?.seller;
      const locked = isContextBlocked(seller?.status);
      setSellerLocked(locked);

      if (locked && !redirected.current) {
        redirected.current = true;
        const params = new URLSearchParams({
          context: "seller",
          status: seller?.status || "UNDER_REVIEW",
          publicReason: seller?.publicReason || "",
          endsAt: seller?.endsAt ? String(seller.endsAt) : "",
        });
        router.replace(`/moderation-status?${params.toString()}`);
        return;
      }

      if (seller?.lastOutcome && !locked && !redirected.current) {
        redirected.current = true;
        const params = new URLSearchParams({
          context: "seller",
          status: seller.status || "NORMAL",
          publicReason: seller.publicReason || "",
        });
        router.replace(`/moderation-status?${params.toString()}`);
      }
    } finally {
      setModChecking(false);
    }
  }, [getToken, router]);

  const refreshBadges = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };

      const [ordersRes, chatsRes] = await Promise.all([
        fetch(`${API}/orders/seller/my`, { headers })
          .then((r) => r.json())
          .catch(() => null),
        fetch(`${API}/chat/conversations`, { headers })
          .then((r) => r.json())
          .catch(() => null),
      ]);

      if (ordersRes?.success && Array.isArray(ordersRes.data)) {
        setPendingOrders(
          ordersRes.data.filter((o: { orderStatus?: string }) =>
            PENDING_STATUSES.has(String(o?.orderStatus || ""))
          ).length
        );
      }

      if (chatsRes?.success && Array.isArray(chatsRes.data)) {
        const total = chatsRes.data.reduce(
          (
            sum: number,
            c: { unreadCount?: number; unreadBySeller?: number }
          ) => {
            const n =
              typeof c.unreadCount === "number"
                ? c.unreadCount
                : typeof c.unreadBySeller === "number"
                  ? c.unreadBySeller
                  : 0;
            return sum + (n > 0 ? n : 0);
          },
          0
        );
        setUnreadChats(total);
      }
    } catch {
      /* keep last */
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    const role = user?.publicMetadata?.role as string | undefined;
    if (!user || (role !== "seller" && role !== "admin")) {
      router.replace("/");
      return;
    }
    checkModeration();
  }, [isLoaded, user, router, checkModeration]);

  useEffect(() => {
    if (!isLoaded || sellerLocked) return;
    const role = user?.publicMetadata?.role as string | undefined;
    if (!user || (role !== "seller" && role !== "admin")) return;
    refreshBadges();
    const id = setInterval(refreshBadges, 25000);
    return () => clearInterval(id);
  }, [isLoaded, user, refreshBadges, sellerLocked]);

  useEffect(() => {
    const onFocus = () => {
      redirected.current = false;
      checkModeration();
      if (!sellerLocked) refreshBadges();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [checkModeration, refreshBadges, sellerLocked]);

  if (!isLoaded || modChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090B0F]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00E575] border-t-transparent" />
      </div>
    );
  }

  const role = user?.publicMetadata?.role as string | undefined;
  if (!user || (role !== "seller" && role !== "admin")) return null;

  if (sellerLocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090B0F]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00E575] border-t-transparent" />
      </div>
    );
  }

  const badgeFor = (href: string) => {
    if (href === "/seller/orders") return pendingOrders;
    if (href === "/seller/messages") return unreadChats;
    return 0;
  };

  const storeLabel =
    (user?.publicMetadata?.storeName as string | undefined) ||
    user?.fullName ||
    "Seller";

  return (
    <div className="min-h-dvh bg-[#090B0F] text-[#F5F7FA] lg:flex">
      {/* ── Desktop sidebar ── */}
      <aside
        className={`
          fixed left-0 top-0 z-30 hidden h-dvh flex-col
          border-r border-white/[0.06] bg-[#0A0C10]
          transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
          lg:flex
          ${
            railReady && railOpen
              ? "w-[240px]"
              : railReady
                ? "w-[68px]"
                : "w-[240px]"
          }
        `}
      >
        <div
          className={`flex shrink-0 items-center border-b border-white/[0.06] ${
            railOpen ? "justify-between gap-2 px-4 py-4" : "flex-col gap-3 px-2 py-4"
          }`}
        >
          {railOpen ? (
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-[#5C6570]">
                SELLER LOUNGE
              </p>
              <p className="mt-0.5 truncate text-[13px] font-semibold text-[#E8EAED]">
                Plazore Commerce
              </p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logo.png"
              alt="Plazore"
              className="h-7 w-7 object-contain opacity-90"
            />
          )}
          <button
            type="button"
            onClick={toggleRail}
            aria-label={railOpen ? "Collapse sidebar" : "Expand sidebar"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#5C6570] transition hover:bg-white/[0.05] hover:text-[#E8EAED]"
          >
            {railOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav
          className={`flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto ${
            railOpen ? "p-2.5" : "items-center px-2 py-3"
          }`}
        >
          {NAV.map((item) => {
            const active = item.match(pathname);
            const count = badgeFor(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`
                  relative flex items-center transition-colors duration-150
                  ${
                    railOpen
                      ? "gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium"
                      : "h-10 w-10 justify-center rounded-md"
                  }
                  ${
                    active
                      ? railOpen
                        ? "bg-white/[0.06] text-[#F5F7FA]"
                        : "bg-white/[0.1] text-[#F5F7FA]"
                      : railOpen
                        ? "text-[#7A8494] hover:bg-white/[0.03] hover:text-[#C5CAD3]"
                        : "text-[#5C6570] hover:bg-white/[0.05] hover:text-[#C5CAD3]"
                  }
                `}
              >
                {railOpen && active ? (
                  <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-[#00E575]" />
                ) : null}
                <span className="relative shrink-0">
                  <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
                  <NavBadge count={count} />
                </span>
                {railOpen ? <span className="truncate">{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div
          className={`shrink-0 border-t border-white/[0.06] ${
            railOpen ? "space-y-2 p-3" : "flex flex-col items-center gap-2 p-2"
          }`}
        >
          {railOpen ? (
            <p className="truncate px-2 text-[11px] text-[#5C6570]">{storeLabel}</p>
          ) : null}
          <Link
            href="/"
            title="Exit to Mall"
            className={`
              flex items-center font-medium transition
              ${
                railOpen
                  ? "gap-2.5 rounded-md px-3 py-2.5 text-[13px] text-[#8BA3C7] hover:bg-white/[0.04] hover:text-[#F5F7FA]"
                  : "h-10 w-10 justify-center rounded-md text-[#8BA3C7] hover:bg-white/[0.06]"
              }
            `}
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {railOpen ? <span>Exit to Mall</span> : null}
          </Link>
        </div>
      </aside>

      {railReady && !railOpen ? (
        <button
          type="button"
          aria-label="Show sidebar"
          onClick={toggleRail}
          className="fixed left-2.5 top-1/2 z-40 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#0E1116]/95 text-[#A7ADB8] shadow-lg backdrop-blur-md transition hover:border-white/20 hover:text-white lg:flex"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}

      {/* Main */}
      <div
        className={`
          flex min-h-dvh min-w-0 flex-1 flex-col
          pb-[72px] lg:pb-0
          transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
          ${
            railReady && railOpen
              ? "lg:pl-[240px]"
              : railReady
                ? "lg:pl-[68px]"
                : "lg:pl-[240px]"
          }
        `}
      >
        {/* Mobile top bar — Exit always visible on responsive */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-[#090B0F]/92 px-3 py-2.5 backdrop-blur-md sm:px-4 lg:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt=""
              className="h-7 w-7 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="text-[9px] font-semibold tracking-[0.16em] text-[#5C6570]">
                SELLER
              </p>
              <p className="truncate text-[12px] font-semibold text-[#E8EAED]">
                {storeLabel}
              </p>
            </div>
          </div>
          <ExitToMall compact />
        </header>

        {/* Desktop top strip */}
        <header className="sticky top-0 z-20 hidden items-center justify-between border-b border-white/[0.06] bg-[#090B0F]/90 px-5 py-2.5 backdrop-blur-md lg:flex lg:px-6">
          <button
            type="button"
            onClick={toggleRail}
            className="flex h-8 items-center gap-2 rounded-md px-2 text-[12px] font-medium text-[#5C6570] transition hover:bg-white/[0.04] hover:text-[#C5CAD3]"
            aria-label={railOpen ? "Hide sidebar" : "Show sidebar"}
          >
            {railOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
            <span>{railOpen ? "Hide menu" : "Show menu"}</span>
          </button>
          <ExitToMall />
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/[0.07] bg-[#0C0E12]/98 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md lg:hidden">
        {NAV.map((item) => {
          const active = item.match(pathname);
          const count = badgeFor(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[9px] font-medium tracking-wide ${
                active ? "text-[#E8EAED]" : "text-[#5C6570]"
              }`}
            >
              {active ? (
                <span className="absolute top-0 h-[2px] w-6 rounded-full bg-[#00E575]" />
              ) : null}
              <span className="relative">
                <Icon className="h-[19px] w-[19px]" strokeWidth={1.75} />
                <NavBadge count={count} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}