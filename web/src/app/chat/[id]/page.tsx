"use client";

import { useAuth } from "@clerk/nextjs";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  ImageIcon,
  MessageCircle,
  Send,
  User,
} from "lucide-react";
import { useMarketplace } from "@/context/MarketplaceContext";
import { DEFAULT_REGION, formatProductPrice } from "@/lib/regions";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

type Message = {
  _id: string;
  text: string;
  sender: { _id: string; name?: string; image?: string };
  createdAt: string;
  readBy?: string[];
  status?: "sending" | "sent" | "failed";
  localId?: string;
};

type ProductMeta = {
  _id: string;
  name?: string;
  images?: string[];
  price?: number;
  region?: string;
};

type Conversation = {
  _id: string;
  product?: ProductMeta | string;
  buyer?: { _id: string; name?: string; image?: string };
  seller?: {
    _id: string;
    name?: string;
    storeName?: string;
    storeLogo?: string;
    image?: string;
  };
  myRole?: "buyer" | "seller" | null;
};

function asId(v: unknown) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v && "_id" in v) return String((v as { _id: string })._id);
  return String(v);
}

function cacheKey(id: string) {
  return `plazore_conv_${id}`;
}

function readCache(id: string): Conversation | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(id: string, conv: Conversation) {
  try {
    sessionStorage.setItem(cacheKey(id), JSON.stringify(conv));
  } catch {
    /* ignore */
  }
}

function pickProduct(conv: Conversation | null, fallbackId?: string | null): ProductMeta | null {
  const p = conv?.product;
  if (p && typeof p === "object" && (p._id || p.name)) {
    return { ...p, _id: asId(p._id) };
  }
  if (typeof p === "string" && p) return { _id: p, name: "Product" };
  if (fallbackId) return { _id: fallbackId, name: "Product" };
  return null;
}

function OrbLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#090B0F]">
      <div className="relative flex h-[110px] w-[110px] items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-[2.4px] border-transparent border-t-[#10B981] border-r-[#3B82F6] border-l-[#10B981]" />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#10B981]/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const conversationId = asId(params?.id);
  const productHint = search.get("product");
  const router = useRouter();
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { region: marketplaceRegion } = useMarketplace();
  const displayRegion = marketplaceRegion || DEFAULT_REGION;
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    const cached = readCache(conversationId);
    if (cached) setConversation((prev) => prev || cached);
  }, [conversationId]);

  const scrollEnd = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  const resolveMyUserId = useCallback(async (token: string) => {
    if (myUserId) return myUserId;
    for (const endpoint of ["/users/me", "/users/profile", "/user/me"]) {
      try {
        const res = await fetch(`${API}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const id = json?.data?._id || json?._id;
        if (id) {
          const sid = String(id);
          if (mounted.current) setMyUserId(sid);
          return sid;
        }
      } catch {
        /* next */
      }
    }
    return null;
  }, [myUserId]);

  const resolveRole = useCallback(
    (conv: Conversation | null, uid: string | null): "buyer" | "seller" | null => {
      if (!conv) return null;
      const me = String(uid || "");
      const buyerId = asId(conv.buyer);
      const sellerId = asId(conv.seller);
      if (me && buyerId && me === buyerId) return "buyer";
      if (me && sellerId && me === sellerId) return "seller";
      if (conv.myRole === "buyer" || conv.myRole === "seller") return conv.myRole;
      return null;
    },
    [],
  );

  const mergeConversation = useCallback(
    (next: Conversation, uid: string | null) => {
      const merged: Conversation = {
        ...next,
        myRole: resolveRole(next, uid),
      };
      if (mounted.current) {
        setConversation((prev) => {
          const product =
            pickProduct(merged) || pickProduct(prev) || (productHint ? { _id: productHint } : undefined);
          const out = { ...prev, ...merged, product: product || merged.product };
          writeCache(conversationId, out);
          return out;
        });
      }
    },
    [conversationId, productHint, resolveRole],
  );

  const hydrateProduct = useCallback(
    async (token: string, uid: string | null) => {
      const pid = productHint || asId(readCache(conversationId)?.product);
      if (!pid) return;
      try {
        const res = await fetch(`${API}/chat/start`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ productId: pid }),
        });
        const json = await res.json();
        if (json?.success && json.data) mergeConversation(json.data, uid);
      } catch {
        /* keep cache */
      }
    },
    [conversationId, mergeConversation, productHint],
  );

  const loadChat = useCallback(async () => {
    if (!conversationId) {
      setLoading(false);
      setError("Invalid chat.");
      return;
    }
    if (!isSignedIn) {
      setLoading(false);
      setError("Please sign in to view this chat.");
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setError(null);
      const token = await getTokenRef.current();
      if (!token) {
        setError("Please sign in again.");
        setLoading(false);
        return;
      }
      const uid = await resolveMyUserId(token);

      const messagesRes = await fetch(`${API}/chat/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const messagesJson = await messagesRes.json();
      if (messagesJson?.success && mounted.current) {
        const list: Message[] = (messagesJson.data || []).map((m: Message) => ({
          ...m,
          status: "sent" as const,
        }));
        setMessages(list);
      }

      let found: Conversation | null = null;
      try {
        const convRes = await fetch(`${API}/chat/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const convJson = await convRes.json();
        if (convJson?.success) {
          found =
            (convJson.data || []).find(
              (c: Conversation) => asId(c._id) === conversationId,
            ) || null;
          if (found) mergeConversation(found, uid);
        }
      } catch {
        /* meta optional */
      }

      const hasProduct = !!pickProduct(found) || !!pickProduct(readCache(conversationId));
      if (!hasProduct) await hydrateProduct(token, uid);

      fetch(`${API}/chat/${conversationId}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {});
    } catch {
      if (mounted.current) setError("Could not load this chat.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [conversationId, hydrateProduct, isSignedIn, mergeConversation, resolveMyUserId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace(`/sign-in?redirect_url=${encodeURIComponent(`/chat/${conversationId}`)}`);
      return;
    }
    setLoading(true);
    loadChat();
  }, [isLoaded, isSignedIn, conversationId, loadChat, router]);

  useEffect(() => {
    if (loading) return;
    const t = setInterval(() => loadChat(), 8000);
    return () => clearInterval(t);
  }, [loading, loadChat]);

  useEffect(() => {
    scrollEnd();
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim() || sending || !conversationId) return;
    const messageText = text.trim();
    const localId = `local_${Date.now()}`;
    setText("");
    setSending(true);
    setError(null);
    const optimistic: Message = {
      _id: localId,
      localId,
      text: messageText,
      sender: { _id: myUserId || "me" },
      createdAt: new Date().toISOString(),
      status: "sending",
      readBy: myUserId ? [myUserId] : [],
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollEnd();
    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error("No auth token");
      const res = await fetch(`${API}/chat/${conversationId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: messageText }),
      });
      const json = await res.json();
      if (json?.success && json.data) {
        const real: Message = { ...json.data, status: "sent" };
        if (real.sender?._id) setMyUserId(String(real.sender._id));
        setMessages((prev) => prev.map((m) => (m.localId === localId ? real : m)));
      } else {
        throw new Error(json?.message || "Failed to send");
      }
    } catch (err: unknown) {
      setMessages((prev) =>
        prev.map((m) => (m.localId === localId ? { ...m, status: "failed" } : m)),
      );
      setText(messageText);
      setError(err instanceof Error ? err.message : "Message failed to send.");
    } finally {
      setSending(false);
    }
  };

  const retryFailed = (localId?: string) => {
    if (!localId) return;
    const failed = messages.find((m) => m.localId === localId);
    if (!failed) return;
    setText(failed.text);
    setMessages((prev) => prev.filter((m) => m.localId !== localId));
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  const isMine = useCallback(
    (message: Message) => {
      if (message.status === "sending" || message.status === "failed") return true;
      const senderId = asId(message.sender);
      if (myUserId && senderId) return senderId === String(myUserId);
      if (conversation?.myRole === "buyer" && conversation.buyer) {
        return senderId === asId(conversation.buyer);
      }
      if (conversation?.myRole === "seller" && conversation.seller) {
        return senderId === asId(conversation.seller);
      }
      return false;
    },
    [myUserId, conversation],
  );

  const otherParty = useMemo(() => {
    const role = conversation?.myRole || resolveRole(conversation, myUserId);
    if (role === "seller") {
      return {
        name: conversation?.buyer?.name || "Buyer",
        image: conversation?.buyer?.image,
        label: "Buyer",
      };
    }
    if (role === "buyer") {
      return {
        name: conversation?.seller?.storeName || conversation?.seller?.name || "Seller",
        image: conversation?.seller?.storeLogo || conversation?.seller?.image,
        label: "Seller",
      };
    }
    return {
      name:
        conversation?.seller?.storeName ||
        conversation?.seller?.name ||
        conversation?.buyer?.name ||
        "Chat",
      image:
        conversation?.seller?.storeLogo ||
        conversation?.seller?.image ||
        conversation?.buyer?.image,
      label: "Chat",
    };
  }, [conversation, myUserId, resolveRole]);

  const getTicks = (message: Message) => {
    if (!isMine(message)) return null;
    if (message.status === "sending") return <Clock className="h-3.5 w-3.5 text-white/55" />;
    if (message.status === "failed") return <AlertCircle className="h-3.5 w-3.5 text-red-200" />;
    const role = conversation?.myRole || resolveRole(conversation, myUserId);
    const otherId = role === "buyer" ? asId(conversation?.seller) : asId(conversation?.buyer);
    const readByOther =
      !!otherId &&
      Array.isArray(message.readBy) &&
      message.readBy.some((id) => String(id) === String(otherId));
    return <CheckCheck className={`h-3.5 w-3.5 ${readByOther ? "text-[#10B981]" : "text-white/45"}`} />;
  };

  const product = pickProduct(conversation, productHint);

  if (!isLoaded || loading) return <OrbLoader />;

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#090B0F] text-[#F5F7FA]">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-[#252A33] px-3 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => router.push("/messages")}
          className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#252A33] bg-[#11141A]"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        {otherParty.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={otherParty.image} alt="" className="h-10 w-10 shrink-0 object-cover bg-[#171B22]" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#252A33] bg-[#171B22]">
            <User className="h-[18px] w-[18px] text-[#737A86]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold tracking-tight">{otherParty.name}</p>
          <p className="mt-0.5 truncate text-[11px] tracking-wide text-[#737A86]">
            {product?.name
              ? product.name
              : otherParty.label === "Buyer"
                ? "Buyer inquiry"
                : "Store conversation"}
          </p>
        </div>
      </header>

      {product ? (
        <button
          type="button"
          onClick={() => product._id && router.push(`/product/${product._id}`)}
          className="mx-3 mt-3 mb-1 flex shrink-0 items-center border border-[#252A33] bg-[#11141A] p-2.5 text-left sm:mx-5"
        >
          {product.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.images[0]} alt="" className="h-12 w-12 shrink-0 object-cover bg-[#171B22]" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-[#171B22]">
              <ImageIcon className="h-[18px] w-[18px] text-[#737A86]" />
            </div>
          )}
          <div className="ml-3 min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{product.name || "This listing"}</p>
            <p className="mt-0.5 text-sm font-bold text-[#10B981]">
              {formatProductPrice(Number(product.price || 0), product.region, displayRegion)}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#737A86]" />
        </button>
      ) : null}

      {error ? (
        <div className="mx-3 mt-2.5 border border-[#F97066]/35 bg-[#F97066]/10 p-3 text-center sm:mx-5">
          <p className="text-[13px] text-red-200">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadChat();
            }}
            className="mt-2 text-[13px] font-semibold text-[#3B82F6]"
          >
            Try again
          </button>
        </div>
      ) : null}

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center px-8 pt-[72px] text-center">
            <div className="mb-[18px] flex h-16 w-16 items-center justify-center border border-[#10B981]/25 bg-[#10B981]/10">
              <MessageCircle className="h-7 w-7 text-[#10B981]" />
            </div>
            <h2 className="text-[17px] font-bold">Start the conversation</h2>
            <p className="mt-2 max-w-sm text-[13px] leading-5 text-[#A7ADB8]">
              {product?.name
                ? `Ask about ${product.name} — condition, shipping, or anything else.`
                : "Ask about condition, shipping, or anything else about this piece."}
            </p>
          </div>
        ) : (
          messages.map((item) => {
            const mine = isMine(item);
            return (
              <button
                key={item.localId || item._id}
                type="button"
                onClick={() => item.status === "failed" && retryFailed(item.localId)}
                className={`mb-3 flex max-w-[80%] flex-col ${mine ? "ml-auto items-end" : "mr-auto items-start"}`}
              >
                <div
                  className={`px-3.5 py-2.5 ${
                    mine ? "bg-[#3B82F6]" : "border border-[#252A33] bg-[#11141A]"
                  }`}
                >
                  <p className="text-left text-[15px] leading-[21px] whitespace-pre-wrap">{item.text}</p>
                </div>
                <div className={`mt-1 flex items-center gap-1 ${mine ? "justify-end" : ""}`}>
                  <span className="text-[10px] text-[#737A86]">
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {mine ? getTicks(item) : null}
                  {item.status === "failed" ? (
                    <span className="ml-1 text-[10px] text-[#F97066]">Tap to retry</span>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="shrink-0 border-t border-[#252A33] bg-[#090B0F] px-3 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5"
      >
        <div
          className={`flex min-h-12 items-end border bg-[#11141A] py-1.5 pr-1.5 pl-3.5 ${
            focused ? "border-[#10B981]/45" : "border-[#252A33]"
          }`}
        >
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={product?.name ? `Message about ${product.name}…` : "Write a message…"}
            maxLength={2000}
            rows={1}
            onFocus={() => {
              setFocused(true);
              scrollEnd();
            }}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="max-h-[120px] min-h-[38px] flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-[#737A86]"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className={`ml-2 flex h-[38px] w-[38px] shrink-0 items-center justify-center ${
              text.trim() && !sending ? "bg-[#10B981] text-[#090B0F]" : "bg-[#171B22] text-[#737A86]"
            }`}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}