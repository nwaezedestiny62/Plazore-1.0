"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  ChevronRight,
  CreditCard,
  LogOut,
  MapPin,
  MessageCircle,
  Package,
  Settings,
  ShieldCheck,
  Store,
  User,
} from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";

const MENU = [
  { id: "messages", title: "Messages", subtitle: "Product conversations", href: "/messages", Icon: MessageCircle },
  { id: "orders", title: "Orders", subtitle: "Purchases & delivery", href: "/orders", Icon: Package },
  { id: "addresses", title: "Addresses", subtitle: "Shipping locations", href: "/addresses", Icon: MapPin },
  { id: "payment-methods", title: "Payment Methods", subtitle: "Cards & billing", href: "/payment-methods", Icon: CreditCard },
  { id: "notifications", title: "Notifications", subtitle: "Orders & alerts", href: "/notifications", Icon: Bell },
  { id: "settings", title: "Settings", subtitle: "Account & preferences", href: "/settings", Icon: Settings },
] as const;

function Badge({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="mr-1 flex h-5 min-w-5 items-center justify-center bg-[#F97066] px-1 text-[10px] font-extrabold">
      {value > 99 ? "99+" : value}
    </span>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [booting, setBooting] = useState(true);
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const inFlight = useRef(false);
  const role = (user?.publicMetadata?.role as string) || "buyer";

  const fetchUnread = useCallback(async () => {
    if (!isSignedIn) {
      setUnreadNotifs(0);
      setUnreadMessages(0);
      setBooting(false);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch(`${BASE}/notifications`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (json?.success && Array.isArray(json.data)) {
          setUnreadNotifs(json.data.filter((x: { isRead?: boolean }) => !x.isRead).length);
        }
      } catch {
        setUnreadNotifs(0);
      }
      try {
        const res = await fetch(`${BASE}/chat/conversations`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (json?.success && Array.isArray(json.data)) {
          const total = json.data.reduce((sum: number, conv: { myRole?: string; unreadByBuyer?: number; unreadBySeller?: number }) => {
            if (conv.myRole === "seller") return sum + (conv.unreadBySeller || 0);
            return sum + (conv.unreadByBuyer || 0);
          }, 0);
          setUnreadMessages(total);
        }
      } catch {
        setUnreadMessages(0);
      }
    } finally {
      inFlight.current = false;
      setBooting(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    fetchUnread();
  }, [isLoaded, fetchUnread]);

  useEffect(() => {
    if (role !== "seller" || !isSignedIn) {
      setStoreLogo(null);
      return;
    }
    let alive = true;
    (async () => {
      const token = await getToken();
      if (!token) return;
      for (const ep of ["/seller/store", "/seller/me", "/users/me"]) {
        try {
          const res = await fetch(`${BASE}${ep}`, { headers: { Authorization: `Bearer ${token}` } });
          const json = await res.json();
          const data = json?.data || json;
          const logo = data?.storeLogo || data?.store?.storeLogo || data?.logo;
          if (logo && alive) {
            setStoreLogo(String(logo));
            return;
          }
        } catch {}
      }
    })();
    return () => {
      alive = false;
    };
  }, [role, isSignedIn, getToken]);

  if (!isLoaded || (booting && isSignedIn)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg">
        <div className="h-[110px] w-[110px] animate-spin rounded-full border-[2.4px] border-transparent border-l-green border-r-blue border-t-green" />
        <p className="mt-4 text-[13px] font-semibold text-[#737A86]">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="flex items-center justify-between border-b border-white/8 px-4 py-3 md:px-8">
        <div className="flex items-center gap-2.5">
          <Link href="/lounge" className="flex h-[42px] w-[42px] flex-col items-start justify-center gap-[5.5px] px-2" aria-label="Open navigation">
            <span className="h-[2.6px] w-[22px] bg-text" />
            <span className="h-[2.6px] w-[15px] bg-text" />
            <span className="h-[2.6px] w-[22px] bg-text" />
          </Link>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-green">Account</p>
            <p className="text-[22px] font-extrabold tracking-tight">Profile</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/notifications" className="relative flex h-[42px] w-[42px] items-center justify-center border border-white/8 bg-surface">
            <Bell className="h-5 w-5" />
            {unreadNotifs > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center bg-[#F97066] px-0.5 text-[9px] font-extrabold">
                {unreadNotifs > 99 ? "99+" : unreadNotifs}
              </span>
            )}
          </Link>
          <Link href="/settings" className="flex h-[42px] w-[42px] items-center justify-center border border-white/8 bg-surface">
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-[18px] pb-24 md:px-8">
        {!user ? (
          <div className="mt-6 border border-white/8 bg-surface p-7 text-center">
            <span className="mx-auto mb-[18px] flex h-[72px] w-[72px] items-center justify-center rounded-full border border-white/8 bg-surface-2">
              <User className="h-8 w-8 text-[#737A86]" />
            </span>
            <p className="text-xl font-extrabold tracking-tight">Welcome to Plazore</p>
            <p className="mt-2 text-sm leading-[21px] text-secondary">
              Sign in to manage orders, messages, and your account.
            </p>
            <Link href="/sign-in" className="mt-[22px] block py-[15px] text-[15px] font-extrabold text-[#041412]" style={{ backgroundImage: GRAD }}>
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-3.5 border border-white/8 bg-surface p-4">
              <div className="relative">
                {user.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.imageUrl} alt="" className="h-[72px] w-[72px] rounded-full object-cover bg-surface-2" />
                ) : (
                  <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-surface-2">
                    <User className="h-7 w-7 text-[#737A86]" />
                  </span>
                )}
                {role === "seller" && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-green/45 bg-surface">
                    <ShieldCheck className="h-3 w-3 text-green" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className={`mb-1.5 inline-block border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                  role === "seller" ? "border-green/35 bg-green/10 text-green" : "border-white/8 bg-surface-2 text-[#737A86]"
                }`}>
                  {role === "seller" ? "Seller" : "Member"}
                </span>
                <p className="truncate text-xl font-extrabold tracking-tight">{user.fullName || user.firstName || "Member"}</p>
                <p className="mt-0.5 truncate text-[13px] text-secondary">
                  {user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress}
                </p>
              </div>
            </div>

            {role === "buyer" ? (
              <Link href="/seller-register" className="mb-[22px] flex items-center gap-3 border border-white/8 bg-surface p-3.5">
                <span className="flex h-11 w-11 items-center justify-center border border-green/30 bg-green/10">
                  <Store className="h-[22px] w-[22px] text-green" />
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] font-bold">Become a Seller</span>
                  <span className="mt-0.5 block text-xs text-[#737A86]">Open your storefront on Plazore</span>
                </span>
                <ChevronRight className="h-[18px] w-[18px] text-[#737A86]" />
              </Link>
            ) : (
              <Link href="/seller" className="mb-[22px] flex items-center gap-3 p-3.5" style={{ backgroundImage: GRAD }}>
                <span className="flex h-11 w-11 items-center justify-center overflow-hidden bg-bg/12">
                  {storeLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={storeLogo} alt="" className="h-11 w-11 object-cover" />
                  ) : (
                    <Store className="h-5 w-5 text-bg" />
                  )}
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] font-bold text-bg">Storefront</span>
                  <span className="mt-0.5 block text-xs text-bg/65">Products, orders & chats</span>
                </span>
                <ArrowRight className="h-[18px] w-[18px] text-bg" />
              </Link>
            )}

            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#737A86]">Quick access</p>
            <div className="mb-[22px] grid grid-cols-2 gap-2.5">
              <Link href="/messages" className="border border-white/8 bg-surface p-3.5">
                <span className="relative mb-3 flex h-10 w-10 items-center justify-center border border-white/8 bg-surface-2">
                  <MessageCircle className="h-5 w-5" />
                  <span className="absolute -right-1 -top-1">
                    <Badge value={unreadMessages} />
                  </span>
                </span>
                <p className="text-sm font-bold">Messages</p>
                <p className="mt-0.5 text-xs text-[#737A86]">Inbox</p>
              </Link>
              <Link href="/orders" className="border border-white/8 bg-surface p-3.5">
                <span className="mb-3 flex h-10 w-10 items-center justify-center border border-white/8 bg-surface-2">
                  <Package className="h-5 w-5" />
                </span>
                <p className="text-sm font-bold">Orders</p>
                <p className="mt-0.5 text-xs text-[#737A86]">Track</p>
              </Link>
            </div>

            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#737A86]">Account</p>
            <div className="mb-[22px] overflow-hidden border border-white/8 bg-surface">
              {MENU.map((item, i) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center px-3.5 py-3.5 ${i < MENU.length - 1 ? "border-b border-white/8" : ""}`}
                >
                  <span className="mr-3 flex h-10 w-10 items-center justify-center border border-white/8 bg-surface-2">
                    <item.Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className="mt-0.5 block text-xs text-[#737A86]">{item.subtitle}</span>
                  </span>
                  {item.id === "messages" && <Badge value={unreadMessages} />}
                  {item.id === "notifications" && <Badge value={unreadNotifs} />}
                  <ChevronRight className="ml-2 h-4 w-4 text-[#737A86]" />
                </Link>
              ))}
            </div>

            <button
              onClick={async () => {
                await signOut();
                router.replace("/sign-in");
              }}
              className="flex w-full items-center justify-center gap-2 border border-[#F97066]/35 bg-[#F97066]/8 py-3.5 text-sm font-bold text-[#F97066]"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}