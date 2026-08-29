"use client";

import { useAuth } from "@clerk/nextjs";
import { MessageCircle, User } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const INACTIVITY_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

type Conversation = {
  _id: string;
  product?: {
    _id: string;
    name?: string;
    images?: string[];
    price?: number;
  };
  buyer?: {
    _id: string;
    name?: string;
    image?: string;
  };
  seller?: {
    _id: string;
    name?: string;
    storeName?: string;
    storeLogo?: string;
    image?: string;
  };
  lastMessage?: {
    text?: string;
    createdAt?: string;
  };
  unreadByBuyer?: number;
  unreadBySeller?: number;
  unreadCount?: number;
  myRole?: "buyer" | "seller" | null;
  updatedAt?: string;
  createdAt?: string;
};

function getActivityTime(conv: Conversation): number {
  const raw =
    conv.lastMessage?.createdAt || conv.updatedAt || conv.createdAt || 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function isActiveConversation(conv: Conversation): boolean {
  const activity = getActivityTime(conv);
  if (!activity) return false;
  return Date.now() - activity <= INACTIVITY_MS;
}

function formatTime(dateString?: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

async function readJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const t = await res.text();
    throw new Error(`Bad response ${res.status}: ${t.slice(0, 80)}`);
  }
  return res.json();
}

export default function SellerMessagesPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);

  const isFetching = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resolveMyUserId = useCallback(async (token: string) => {
    const endpoints = ["/users/me", "/users/profile", "/user/me"];
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(`${API}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) continue;
        const json = await readJson(res);
        const id = json?.data?._id || json?._id;
        if (id) {
          setMyUserId(String(id));
          return String(id);
        }
      } catch {
        /* try next */
      }
    }
    return null;
  }, []);

  const fetchConversations = useCallback(
    async (isRefresh = false) => {
      if (!isSignedIn) {
        if (mountedRef.current) {
          setConversations([]);
          setBooted(true);
          setRefreshing(false);
        }
        return;
      }

      if (isFetching.current) return;
      isFetching.current = true;

      try {
        if (mountedRef.current) {
          setError(null);
          if (isRefresh) setRefreshing(true);
        }

        const token = await getTokenRef.current();
        if (!token) {
          if (mountedRef.current) setError("Please sign in again.");
          return;
        }

        let uid = myUserId;
        if (!uid) {
          uid = await resolveMyUserId(token);
        }

        const res = await fetch(`${API}/chat/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await readJson(res);

        if (json?.success) {
          const list: Conversation[] = Array.isArray(json.data) ? json.data : [];
          const me = String(uid || "");

          const sellerChats = list
            .filter((conv) => {
              if (conv.myRole === "seller") return true;
              const sellerId = String(
                (conv.seller as any)?._id || conv.seller || ""
              );
              return !!me && sellerId === me;
            })
            .map((conv) => {
              const unread =
                typeof conv.unreadCount === "number" && conv.myRole === "seller"
                  ? conv.unreadCount
                  : conv.unreadBySeller || 0;

              return {
                ...conv,
                myRole: "seller" as const,
                unreadCount: unread,
              };
            })
            .filter(isActiveConversation);

          if (mountedRef.current) setConversations(sellerChats);
        } else {
          if (mountedRef.current) {
            setConversations([]);
            setError(json?.message || "Failed to load chats");
          }
        }
      } catch (err: any) {
        console.error("Seller chat fetch error:", err);
        if (mountedRef.current) {
          const msg = err?.message || "Network error. Please try again.";
          if (/network/i.test(String(msg))) {
            setError(
              "No internet connection. Check your network and try again."
            );
          } else {
            setError(msg);
          }
        }
      } finally {
        if (mountedRef.current) {
          setBooted(true);
          setRefreshing(false);
        }
        isFetching.current = false;
      }
    },
    [isSignedIn, myUserId, resolveMyUserId]
  );

  useEffect(() => {
    if (!isLoaded) return;
    fetchConversations(false);
  }, [isLoaded, isSignedIn, fetchConversations]);

  // Soft poll while page is open
  useEffect(() => {
    if (!isSignedIn) return;
    const t = setInterval(() => fetchConversations(false), 15000);
    return () => clearInterval(t);
  }, [isSignedIn, fetchConversations]);

  const sorted = useMemo(
    () =>
      [...conversations].sort((a, b) => getActivityTime(b) - getActivityTime(a)),
    [conversations]
  );

  const getUnread = (conv: Conversation) =>
    typeof conv.unreadCount === "number"
      ? conv.unreadCount
      : conv.unreadBySeller || 0;

  if (!isLoaded) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-[#090B0F]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#10B981]/30 border-t-[#10B981]" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center bg-[#090B0F] px-6 text-center">
        <p className="font-semibold text-[#F5F7FA]">Sign in to see buyer messages</p>
        <Link
          href="/sign-in"
          className="mt-4 rounded-full bg-[#F5F7FA] px-6 py-2.5 text-sm font-bold text-[#090B0F]"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="border-b border-[#252A33] px-5 pb-3.5 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="mb-1 text-[10px] font-bold tracking-[1.8px] text-[#10B981]">
            STOREFRONT
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight">Buyer messages</h1>
          <p className="mt-2.5 text-[13px] leading-[19px] text-[#A7ADB8]">
            Only chats about your products. Threads with no activity for 2 days
            leave this list automatically.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-3.5 sm:px-6 lg:px-8">
        {!!error && (
          <div className="mb-3 border border-[#F97066]/35 bg-[#F97066]/10 p-3.5 text-center">
            <p className="text-[13px] leading-[19px] text-[#FECACA]">{error}</p>
            <button
              type="button"
              onClick={() => fetchConversations(false)}
              className="mt-2.5 text-[13px] font-semibold text-[#3B82F6]"
            >
              Try again
            </button>
          </div>
        )}

        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => fetchConversations(true)}
            disabled={refreshing}
            className="text-[12px] font-semibold text-[#10B981] disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {!booted ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#10B981]/30 border-t-[#10B981]" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center px-7 pt-16 text-center">
            <div className="mb-[18px] flex h-16 w-16 items-center justify-center border border-[#10B981]/25 bg-[#10B981]/10">
              <MessageCircle className="h-7 w-7 text-[#10B981]" />
            </div>
            <p className="text-lg font-bold tracking-tight">No buyer messages</p>
            <p className="mt-2 text-[13px] leading-5 text-[#A7ADB8]">
              When someone messages you about one of your products, it will
              appear here — only on this storefront.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5 pb-20">
            {sorted.map((item) => {
              const unread = getUnread(item);
              const product = item.product;
              const lastText = item.lastMessage?.text || "No messages yet";
              const time = formatTime(
                item.lastMessage?.createdAt || item.updatedAt || item.createdAt
              );
              const hasUnread = unread > 0;
              const buyerName = item.buyer?.name || "Buyer";

              return (
                <li key={item._id}>
                  <Link
                    href={`/chat/${item._id}`}
                    className={`flex items-center border bg-[#11141A] p-3 transition hover:border-[#10B981]/30 ${
                      hasUnread
                        ? "border-[#10B981]/40"
                        : "border-[#252A33]"
                    }`}
                  >
                    <div className="relative shrink-0">
                      {product?.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.images[0]}
                          alt=""
                          className="h-[52px] w-[52px] object-cover bg-[#171B22]"
                        />
                      ) : item.buyer?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.buyer.image}
                          alt=""
                          className="h-[52px] w-[52px] object-cover bg-[#171B22]"
                        />
                      ) : (
                        <div className="flex h-[52px] w-[52px] items-center justify-center bg-[#171B22]">
                          <User className="h-5 w-5 text-[#737A86]" />
                        </div>
                      )}
                      {hasUnread && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 border-2 border-[#11141A] bg-[#10B981]" />
                      )}
                    </div>

                    <div className="ml-3 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[15px] font-bold">{buyerName}</p>
                        <span className="shrink-0 text-[11px] text-[#737A86]">
                          {time}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[#737A86]">
                        {product?.name || "Product conversation"}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <p
                          className={`min-w-0 flex-1 truncate text-[13px] leading-[18px] ${
                            hasUnread
                              ? "font-semibold text-[#F5F7FA]"
                              : "text-[#737A86]"
                          }`}
                        >
                          {lastText}
                        </p>
                        {hasUnread && (
                          <span className="flex h-[22px] min-w-[22px] items-center justify-center bg-[#10B981] px-1.5 text-[10px] font-extrabold text-[#090B0F]">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}