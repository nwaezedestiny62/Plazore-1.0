"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, MessageCircle, User } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const INACTIVITY_MS = 2 * 24 * 60 * 60 * 1000;

type Conversation = {
  _id: string;
  product?: { _id: string; name?: string; images?: string[]; price?: number };
  buyer?: { _id: string; name?: string; image?: string };
  seller?: {
    _id: string;
    name?: string;
    storeName?: string;
    storeLogo?: string;
    image?: string;
  };
  lastMessage?: { text?: string; createdAt?: string };
  unreadByBuyer?: number;
  unreadBySeller?: number;
  unreadCount?: number;
  myRole?: "buyer" | "seller" | null;
  updatedAt?: string;
  createdAt?: string;
};

function getActivityTime(conv: Conversation) {
  const raw = conv.lastMessage?.createdAt || conv.updatedAt || conv.createdAt || 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function isActiveConversation(conv: Conversation) {
  const activity = getActivityTime(conv);
  if (!activity) return false;
  return Date.now() - activity <= INACTIVITY_MS;
}

export default function MessagesPage() {
  const router = useRouter();
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const fetching = useRef(false);

  const resolveMyUserId = useCallback(async (token: string) => {
    for (const endpoint of ["/users/me", "/users/profile", "/user/me"]) {
      try {
        const res = await fetch(`${API}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const id = json?.data?._id || json?._id;
        if (id) {
          setMyUserId(String(id));
          return String(id);
        }
      } catch {
        /* next */
      }
    }
    return null;
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!isSignedIn) {
      setConversations([]);
      setBooted(true);
      return;
    }
    if (fetching.current) return;
    fetching.current = true;
    try {
      setError(null);
      const token = await getTokenRef.current();
      if (!token) {
        setError("Please sign in again to view your messages.");
        return;
      }
      let uid = myUserId;
      if (!uid) uid = await resolveMyUserId(token);

      const res = await fetch(`${API}/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.success) {
        const list: Conversation[] = Array.isArray(json.data) ? json.data : [];
        const enriched = list.map((conv) => {
          if (conv.myRole && typeof conv.unreadCount === "number") return conv;
          const buyerId = String(conv.buyer?._id || conv.buyer || "");
          const sellerId = String(conv.seller?._id || conv.seller || "");
          const me = String(uid || "");
          let myRole: "buyer" | "seller" | null = null;
          if (me && buyerId === me) myRole = "buyer";
          else if (me && sellerId === me) myRole = "seller";
          const unreadCount =
            myRole === "buyer"
              ? conv.unreadByBuyer || 0
              : myRole === "seller"
                ? conv.unreadBySeller || 0
                : (conv.unreadByBuyer || 0) + (conv.unreadBySeller || 0);
          return { ...conv, myRole, unreadCount };
        });
        setConversations(enriched.filter(isActiveConversation));
      } else {
        setConversations([]);
        setError(json?.message || "Failed to load messages");
      }
    } catch {
      setError("No internet connection. Check your network and try again.");
    } finally {
      setBooted(true);
      fetching.current = false;
    }
  }, [isSignedIn, myUserId, resolveMyUserId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    fetchConversations();
  }, [isLoaded, isSignedIn, fetchConversations, router]);

  useEffect(() => {
    const onFocus = () => fetchConversations();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchConversations]);

  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (days === 1) return "Yesterday";
    if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { day: "numeric", month: "short" });
  };

  const getOtherParty = (conv: Conversation) => {
    if (conv.myRole === "seller") {
      return { name: conv.buyer?.name || "Buyer", image: conv.buyer?.image };
    }
    return {
      name: conv.seller?.storeName || conv.seller?.name || "Seller",
      image: conv.seller?.storeLogo || conv.seller?.image,
    };
  };

  const getUnread = (conv: Conversation) => {
    if (typeof conv.unreadCount === "number") return conv.unreadCount;
    if (conv.myRole === "buyer") return conv.unreadByBuyer || 0;
    if (conv.myRole === "seller") return conv.unreadBySeller || 0;
    return (conv.unreadByBuyer || 0) + (conv.unreadBySeller || 0);
  };

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => getActivityTime(b) - getActivityTime(a)),
    [conversations],
  );

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="border-b border-[#252A33] px-4 pt-3 pb-3.5 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center border border-[#252A33] bg-[#11141A]"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight">Messages</h1>
        </div>
        <p className="mx-auto mt-3 max-w-3xl text-[13px] leading-[19px] text-[#A7ADB8]">
          Product conversations. Threads without activity for 2 days leave your inbox automatically.
        </p>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-3.5 sm:px-6">
        {error ? (
          <div className="mb-3 border border-[#F97066]/35 bg-[#F97066]/10 p-3.5 text-center">
            <p className="text-[13px] leading-[19px] text-red-200">{error}</p>
            <button
              type="button"
              onClick={() => fetchConversations()}
              className="mt-2.5 text-[13px] font-semibold text-[#3B82F6]"
            >
              Try again
            </button>
          </div>
        ) : null}

        {booted && sorted.length === 0 ? (
          <div className="flex flex-col items-center px-7 pt-[72px] text-center">
            <div className="mb-[18px] flex h-16 w-16 items-center justify-center border border-[#10B981]/25 bg-[#10B981]/10">
              <MessageCircle className="h-7 w-7 text-[#10B981]" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">No active conversations</h2>
            <p className="mt-2 max-w-sm text-[13px] leading-5 text-[#A7ADB8]">
              Message a seller about a product and the thread will appear here. Quiet chats clear after 2 days.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {sorted.map((item) => {
              const unread = getUnread(item);
              const other = getOtherParty(item);
              const product = item.product;
              const lastText = item.lastMessage?.text || "No messages yet";
              const time = formatTime(item.lastMessage?.createdAt || item.updatedAt || item.createdAt);
              const hasUnread = unread > 0;
              return (
                <li key={item._id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/chat/${item._id}`)}
                    className={`flex w-full items-center border p-3 text-left ${
                      hasUnread ? "border-[#10B981]/40 bg-[#11141A]" : "border-[#252A33] bg-[#11141A]"
                    }`}
                  >
                    <div className="relative shrink-0">
                      {product?.images?.[0] || other.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product?.images?.[0] || other.image}
                          alt=""
                          className="h-[52px] w-[52px] object-cover bg-[#171B22]"
                        />
                      ) : (
                        <div className="flex h-[52px] w-[52px] items-center justify-center bg-[#171B22]">
                          <User className="h-5 w-5 text-[#737A86]" />
                        </div>
                      )}
                      {hasUnread ? (
                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 border-2 border-[#11141A] bg-[#10B981]" />
                      ) : null}
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[15px] font-bold">{other.name}</p>
                        <span className="shrink-0 text-[11px] text-[#737A86]">{time}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[#737A86]">
                        {product?.name || "Product conversation"}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <p
                          className={`min-w-0 flex-1 truncate text-[13px] leading-[18px] ${
                            hasUnread ? "font-semibold text-[#F5F7FA]" : "text-[#737A86]"
                          }`}
                        >
                          {lastText}
                        </p>
                        {hasUnread ? (
                          <span className="flex h-[22px] min-w-[22px] items-center justify-center bg-[#10B981] px-1.5 text-[10px] font-extrabold text-[#090B0F]">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}