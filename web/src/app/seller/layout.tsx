"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Diamond,
  Grid2x2,
  LogOut,
  MessageCircle,
  Package,
  Receipt,
} from "lucide-react";
import {
  fetchMyModeration,
  isContextBlocked,
  resolveScreenKind,
} from "@/lib/moderation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const PENDING_STATUSES = new Set(["Preparing"]);

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

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span className="absolute -right-1.5 -top-1.5 min-w-[15px] rounded-full border border-[#11141A] bg-[#00E575] px-1 text-center text-[9px] font-extrabold leading-[15px] text-[#041412]">
      {label}
    </span>
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

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA] lg:flex">
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0C0E12] lg:flex">
        <div className="border-b border-white/[0.07] px-5 py-5">
          <p className="text-[10px] font-extrabold tracking-[0.18em] text-[#737A86]">
            SELLER LOUNGE
          </p>
          <p className="mt-1 text-sm font-bold">Plazore Commerce</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => {
            const active = item.match(pathname);
            const count = badgeFor(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-white/[0.06] text-[#B8F0D0]"
                    : "text-[#5A6F88] hover:bg-white/[0.04] hover:text-[#F5F7FA]"
                }`}
              >
                <span className="relative">
                  <item.icon className="h-[18px] w-[18px]" />
                  <Badge count={count} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/[0.07] p-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#3B82F6] hover:bg-white/[0.04]"
          >
            <LogOut className="h-4 w-4" />
            Exit to Mall
          </Link>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-[72px] lg:pb-0">
        {children}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/[0.08] bg-[#11141A] pb-[max(8px,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        {NAV.map((item) => {
          const active = item.match(pathname);
          const count = badgeFor(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center gap-1 py-1 text-[10px] font-semibold ${
                active ? "text-[#B8F0D0]" : "text-[#5A6F88]"
              }`}
            >
              <span className="relative">
                <item.icon className="h-[20px] w-[20px]" />
                <Badge count={count} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}