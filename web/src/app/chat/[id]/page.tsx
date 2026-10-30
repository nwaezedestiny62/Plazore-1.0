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

const API =
  process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com/api";

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
  if (typeof v === "object" && v && "_id" in v)
    return String((v as { _id: string })._id);
  return String(v);
}

function normText(s: string) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function timeMs(iso?: string) {
  const n = new Date(iso || 0).getTime();
  return Number.isFinite(n) ? n : 0;
}

function isPending(m: Message) {
  return m.status === "sending" || m.status === "failed";
}

/**
 * One server row per _id.
 * A pending optimistic bubble is dropped only when a *new* server row
 * (not already shown as sent) has the same text — FIFO, one consume each.
 * Two real sends of the same text both stay.
 */
export function mergeThread(serverRaw: Message[], prev: Message[]): Message[] {
  const seen = new Set<string>();
  const server: Message[] = [];
  for (const m of serverRaw) {
    const id = asId(m._id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    server.push({ ...m, _id: id, status: "sent", localId: undefined });
  }
  server.sort((a, b) => timeMs(a.createdAt) - timeMs(b.createdAt));

  const already = new Set(
    prev.filter((m) => !isPending(m)).map((m) => asId(m._id)),
  );
  const pending = prev.filter(isPending);
  const left = pending.slice();

  for (const s of server) {
    if (already.has(s._id)) continue;
    const idx = left.findIndex((p) => normText(p.text) === normText(s.text));
    if (idx >= 0) left.splice(idx, 1);
  }

  const out = [...server, ...left];
  out.sort((a, b) => timeMs(a.createdAt) - timeMs(b.createdAt));
  return out;
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

function pickProduct(
  conv: Conversation | null,
  fallbackId?: string | null,
): ProductMeta | null {
  const p = conv?.product;
  if (p && typeof p === "object" && (p._id || p.name)) {
    return { ...p, _id: asId(p._id) };
  }
  if (typeof p === "string" && p) return { _id: p, name: "Product" };
  if (fallbackId) return { _id: fallbackId, name: "Product" };
  return null;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = (start(now) - start(d)) / 86400000;
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function OrbLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#07090D]">
      <div className="relative flex h-[110px] w-[110px] items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-[2.4px] border-transparent border-t-[#00E575] border-r-[#3B82F6]" />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00E575]/10">
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
  const productHint =
    search.get("productId") ||
    search.get("product") ||
    search.get("product_id") ||
    null;
  const fromParam = (search.get("from") || "").toLowerCase();
  const router = useRouter();
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { formatProduct } = useMarketplace();

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [conversation, setConversation] = useState<Conversation | null>(() =>
    conversationId ? readCache(conversationId) : null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [productOverride, setProductOverride] = useState<ProductMeta | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const sendLock = useRef(false);
  const hydratedProduct = useRef(false);
  const myUserIdRef = useRef<string | null>(null);
  const conversationRef = useRef<Conversation | null>(conversation);
  const productHintRef = useRef(productHint);

  myUserIdRef.current = myUserId;
  conversationRef.current = conversation;
  productHintRef.current = productHint;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    hydratedProduct.current = false;
    sendLock.current = false;
    setBooting(true);
    setError(null);
    setMessages([]);
    setProductOverride(null);
    setConversation(conversationId ? readCache(conversationId) : null);
  }, [conversationId]);

  const goBackSafe = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    if (fromParam === "product" && productHint) {
      router.replace(`/product/${productHint}`);
      return;
    }
    if (fromParam === "notif" || fromParam === "notifications") {
      router.replace("/notifications");
      return;
    }
    if (fromParam === "seller") {
      router.replace("/seller/chat");
      return;
    }
    router.replace("/messages");
  }, [fromParam, productHint, router]);

  const scrollEnd = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, []);

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
      const merged: Conversation = { ...next, myRole: resolveRole(next, uid) };
      if (!mounted.current) return;
      setConversation((prev) => {
        const product =
          pickProduct(merged) ||
          pickProduct(prev) ||
          (productHintRef.current ? { _id: productHintRef.current } : undefined);
        const out = { ...prev, ...merged, product: product || merged.product };
        if (conversationId) writeCache(conversationId, out);
        conversationRef.current = out;
        return out;
      });
    },
    [conversationId, resolveRole],
  );

  const loadChat = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = !!opts?.silent;
      if (!conversationId) {
        if (mounted.current) {
          setBooting(false);
          setError("Invalid chat.");
        }
        return;
      }
      if (!isSignedIn) {
        if (mounted.current) {
          setBooting(false);
          setError("Please sign in to view this chat.");
        }
        return;
      }
      if (inFlight.current) return;
      inFlight.current = true;

      try {
        if (!silent && mounted.current) setError(null);

        const token = await getTokenRef.current();
        if (!token) {
          if (mounted.current) {
            setError("Please sign in again.");
            setBooting(false);
          }
          return;
        }

        let uid = myUserIdRef.current;
        if (!uid) {
          for (const endpoint of ["/users/me", "/users/profile", "/user/me"]) {
            try {
              const res = await fetch(`${API}${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const json = await res.json();
              const id = json?.data?._id || json?._id;
              if (id) {
                uid = String(id);
                myUserIdRef.current = uid;
                if (mounted.current) setMyUserId(uid);
                break;
              }
            } catch {
              /* next */
            }
          }
        }

        const messagesRes = await fetch(`${API}/chat/${conversationId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const messagesJson = await messagesRes.json();
        if (messagesJson?.success && mounted.current) {
          const serverList: Message[] = messagesJson.data || [];
          setMessages((prev) => mergeThread(serverList, prev));
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

        const hint = productHintRef.current;
        const hasProduct =
          !!pickProduct(found) ||
          !!pickProduct(conversationRef.current) ||
          !!pickProduct(readCache(conversationId), hint);

        if ((!hasProduct || hint) && !hydratedProduct.current) {
          const pid =
            hint || asId(conversationRef.current?.product) || asId(found?.product);
          if (pid) {
            hydratedProduct.current = true;
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
              hydratedProduct.current = false;
            }
          }
        }

        fetch(`${API}/chat/${conversationId}/read`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        }).catch(() => {});
      } catch {
        if (mounted.current && !silent) setError("Could not load this chat.");
      } finally {
        inFlight.current = false;
        if (mounted.current) setBooting(false);
      }
    },
    [conversationId, isSignedIn, mergeConversation],
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace(
        `/sign-in?redirect_url=${encodeURIComponent(`/chat/${conversationId}`)}`,
      );
      return;
    }
    loadChat({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, conversationId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !conversationId) return;
    const t = setInterval(() => {
      loadChat({ silent: true });
    }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, conversationId]);

  useEffect(() => {
    scrollEnd();
  }, [messages.length, scrollEnd]);

  const productBase = pickProduct(conversation, productHint);

  useEffect(() => {
    const pid = productBase?._id || productHint;
    if (!pid) return;
    if (productBase?.region && productBase?.price != null) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/products/${pid}`);
        const json = await res.json();
        const p = json?.data;
        if (!cancelled && p && (p.price != null || p.region)) {
          const next: ProductMeta = {
            _id: String(p._id || pid),
            name: p.name,
            images: p.images,
            price: p.price,
            region: p.region,
          };
          setProductOverride(next);
          if (conversationId) {
            const cached = readCache(conversationId) || { _id: conversationId };
            writeCache(conversationId, {
              ...cached,
              product: {
                ...(typeof cached.product === "object" ? cached.product : {}),
                ...next,
              },
            });
          }
        }
      } catch {
        /* keep whatever we have */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productBase?._id, productBase?.region, productBase?.price, productHint, conversationId]);

  const product: ProductMeta | null = useMemo(() => {
    if (!productBase && !productOverride) return null;
    if (!productOverride) return productBase;
    if (!productBase) return productOverride;
    return {
      ...productBase,
      ...productOverride,
      _id: productOverride._id || productBase._id,
      name: productOverride.name || productBase.name,
      images: productOverride.images?.length ? productOverride.images : productBase.images,
      price: productOverride.price ?? productBase.price,
      region: productOverride.region || productBase.region,
    };
  }, [productBase, productOverride]);

  const handleSend = async () => {
    const messageText = text.trim();
    if (!messageText || !conversationId) return;
    if (sendLock.current) return;
    sendLock.current = true;

    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setText("");
    setError(null);

    const optimistic: Message = {
      _id: localId,
      localId,
      text: messageText,
      sender: { _id: myUserIdRef.current || "me" },
      createdAt: new Date().toISOString(),
      status: "sending",
      readBy: myUserIdRef.current ? [myUserIdRef.current] : [],
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollEnd();

    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error("No auth token");
      const res = await fetch(`${API}/chat/${conversationId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: messageText }),
      });
      const json = await res.json();
      if (json?.success && json.data) {
        const real: Message = {
          ...json.data,
          _id: asId(json.data._id) || localId,
          status: "sent",
          localId: undefined,
        };
        if (real.sender?._id) {
          myUserIdRef.current = String(real.sender._id);
          setMyUserId(String(real.sender._id));
        }
        setMessages((prev) => {
          const without = prev.filter(
            (m) => m.localId !== localId && asId(m._id) !== real._id,
          );
          return mergeThread([real], without.concat(without.length ? [] : []));
        });
        // replace optimistic in place, then let mergeThread drop twins
        setMessages((prev) => {
          const swapped = prev.map((m) => (m.localId === localId ? real : m));
          return mergeThread(
            swapped.filter((m) => !isPending(m)),
            swapped,
          );
        });
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
      sendLock.current = false;
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
    if (message.status === "sending")
      return <Clock className="h-3 w-3 text-black/40" />;
    if (message.status === "failed")
      return <AlertCircle className="h-3 w-3 text-red-200" />;
    const role = conversation?.myRole || resolveRole(conversation, myUserId);
    const otherId = role === "buyer" ? asId(conversation?.seller) : asId(conversation?.buyer);
    const readByOther =
      !!otherId &&
      Array.isArray(message.readBy) &&
      message.readBy.some((id) => String(id) === String(otherId));
    return (
      <CheckCheck
        className={`h-3.5 w-3.5 ${readByOther ? "text-[#04130C]" : "text-black/35"}`}
      />
    );
  };

  if (!isLoaded || booting) return <OrbLoader />;

  let lastDay = "";

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#07090D] text-[#F4F6F8]">
      <header className="flex shrink-0 items-center gap-3 bg-[#07090D]/80 px-3 py-3 backdrop-blur-xl sm:px-6">
        <button
          type="button"
          onClick={goBackSafe}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/80 transition active:scale-95"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        {otherParty.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={otherParty.image}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
            <User className="h-[18px] w-[18px] text-white/40" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold tracking-tight">{otherParty.name}</p>
          <p className="mt-0.5 truncate text-[12px] text-white/40">
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
          className="mx-3 mb-1 mt-1 flex shrink-0 items-center gap-3 rounded-2xl bg-white/[0.04] p-2 text-left transition active:scale-[0.99] sm:mx-6"
        >
          {product.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.images[0]}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
              <ImageIcon className="h-[18px] w-[18px] text-white/35" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white/90">
              {product.name || "This listing"}
            </p>
            <p className="mt-0.5 text-[13px] font-semibold text-[#00E575]">
              {formatProduct(Number(product.price || 0), product.region)}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
        </button>
      ) : null}

      {error ? (
        <div className="mx-3 mt-2 rounded-2xl bg-[#F97066]/10 px-3 py-2.5 text-center sm:mx-6">
          <p className="text-[13px] text-red-200">{error}</p>
          <button
            type="button"
            onClick={() => {
              setBooting(true);
              loadChat({ silent: false });
            }}
            className="mt-1.5 text-[13px] font-semibold text-[#7DD3FC]"
          >
            Try again
          </button>
        </div>
      ) : null}

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center px-8 pt-24 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#00E575]/10">
              <MessageCircle className="h-7 w-7 text-[#00E575]" />
            </div>
            <h2 className="text-[18px] font-semibold tracking-tight">Start the conversation</h2>
            <p className="mt-2 max-w-xs text-[13px] leading-5 text-white/45">
              {product?.name
                ? `Ask about ${product.name}. This chat shows in both inboxes after the first message.`
                : "Ask about condition, shipping, or anything else."}
            </p>
          </div>
        ) : (
          messages.map((item, i) => {
            const mine = isMine(item);
            const day = dayLabel(item.createdAt);
            const showDay = day && day !== lastDay;
            if (showDay) lastDay = day;
            const prev = messages[i - 1];
            const sameSender = prev && isMine(prev) === mine && !showDay;
            const key = item.localId || item._id;
            return (
              <div key={key}>
                {showDay ? (
                  <p className="my-5 text-center text-[11px] font-medium tracking-wide text-white/30">
                    {day}
                  </p>
                ) : null}
                <div
                  className={`flex ${sameSender ? "mt-1" : "mt-3.5"} ${
                    mine ? "justify-end" : "justify-start"
                  }`}
                  style={{ animation: "plazore-msg-in 0.28s ease-out" }}
                >
                  <div
                    role={item.status === "failed" ? "button" : undefined}
                    onClick={() => item.status === "failed" && retryFailed(item.localId)}
                    className={`max-w-[78%] ${item.status === "failed" ? "cursor-pointer" : ""}`}
                  >
                    <div
                      className={`px-3.5 py-2.5 text-[15px] leading-[1.35] ${
                        mine
                          ? "rounded-[20px] rounded-br-[6px] bg-[#00E575] text-[#04130C]"
                          : "rounded-[20px] rounded-bl-[6px] bg-white/[0.07] text-white/92"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{item.text}</p>
                    </div>
                    <div
                      className={`mt-1 flex items-center gap-1 px-1 ${
                        mine ? "justify-end" : "justify-start"
                      }`}
                    >
                      <span className={`text-[10px] ${mine ? "text-white/35" : "text-white/30"}`}>
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {mine ? getTicks(item) : null}
                      {item.status === "failed" ? (
                        <span className="text-[10px] text-[#F97066]">Tap to retry</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
        className="shrink-0 bg-gradient-to-t from-[#07090D] via-[#07090D] to-transparent px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 sm:px-6"
      >
        <div
          className={`flex min-h-[52px] items-end rounded-[26px] bg-white/[0.06] py-1.5 pl-4 pr-1.5 transition ${
            focused ? "bg-white/[0.09]" : ""
          }`}
        >
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={product?.name ? `Message about ${product.name}` : "Message"}
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
                void handleSend();
              }
            }}
            className="max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-white/30"
          />
          <button
            type="submit"
            disabled={!text.trim() || sendLock.current}
            className={`mb-0.5 ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
              text.trim()
                ? "bg-[#00E575] text-[#04130C]"
                : "bg-white/[0.06] text-white/30"
            }`}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>

      <style jsx>{`
        @keyframes plazore-msg-in {
          from {
            opacity: 0;
            transform: translateY(6px);
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