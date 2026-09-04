"use client";

import { useAuth } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Send } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

type Msg = {
  senderType?: "user" | "admin" | string;
  body?: string;
  createdAt?: string;
};

type ContactDoc = {
  _id: string;
  status?: string;
  category?: string;
  contextType?: string;
  message?: string;
  messages?: Msg[];
  responses?: { body?: string; createdAt?: string }[];
  createdAt?: string;
  lastMessageAt?: string;
};

function wordCount(text: string) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export default function ContactConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken, isSignedIn, isLoaded } = useAuth();

  const [item, setItem] = useState<ContactDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const words = useMemo(() => wordCount(reply), [reply]);
  const closed = String(item?.status || "").toLowerCase() === "closed";

  const load = useCallback(async () => {
    try {
      setError("");
      const token = await getToken();
      if (!token) {
        router.replace("/sign-in");
        return;
      }
      const res = await fetch(`${API}/contact/mine/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || "Conversation not found");
      }
      setItem(json.data || null);
    } catch (e: any) {
      setError(e?.message || "Failed to load conversation");
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, id, router]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    load();
  }, [isLoaded, isSignedIn, load, router]);

  const thread: Msg[] = useMemo(() => {
    if (!item) return [];
    if (Array.isArray(item.messages) && item.messages.length) {
      return item.messages.map((m) => ({
        senderType: m.senderType || "user",
        body: m.body || "",
        createdAt: m.createdAt,
      }));
    }
    // fallback: original message + legacy responses
    const out: Msg[] = [];
    if (item.message) {
      out.push({
        senderType: "user",
        body: item.message,
        createdAt: item.createdAt,
      });
    }
    for (const r of item.responses || []) {
      out.push({
        senderType: "admin",
        body: r.body || "",
        createdAt: r.createdAt,
      });
    }
    return out;
  }, [item]);

  const sendReply = async () => {
    if (closed) return;
    if (words < 1) {
      setError("Write a short reply first.");
      return;
    }
    if (words > 300) {
      setError("Reply must be 300 words or fewer.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired");
      const res = await fetch(`${API}/contact/mine/${id}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: reply.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to send");
      setReply("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090B0F]">
        <div className="relative flex h-[110px] w-[110px] items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-[2.4px] border-transparent border-t-[#00E575] border-r-[#3B82F6] border-l-[#00E575]" />
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00E575]/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#090B0F] text-[#F5F7FA]">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#090B0F]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-2 sm:px-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center"
            aria-label="Back"
          >
            <ChevronLeft className="h-[22px] w-[22px]" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-extrabold tracking-tight">
              Conversation with Plazore
            </h1>
            <p className="truncate text-[11px] text-[#6B7280]">
             Shop the New Way
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-4 sm:px-6">
        {error && !item ? (
          <div className="mt-16 text-center">
            <p className="text-sm text-[#ef6262]">{error}</p>
            <button
              type="button"
              onClick={() => router.push("/contact")}
              className="mt-4 border border-white/10 bg-[#11141A] px-4 py-2 text-sm font-semibold"
            >
              Start a new contact
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 pb-4">
              {thread.map((m, i) => {
                const fromPlazore =
                  m.senderType === "admin" || m.senderType === "plazore";
                return (
                  <div
                    key={`${i}-${m.createdAt || ""}`}
                    className={`flex ${fromPlazore ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[85%] border px-3.5 py-2.5 ${
                        fromPlazore
                          ? "border-[#00E575]/20 bg-[#00E575]/10"
                          : "border-white/[0.08] bg-[#11141A]"
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        {fromPlazore ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src="/logo.png"
                            alt=""
                            className="h-4 w-4 object-contain"
                          />
                        ) : null}
                        <span className="text-[11px] font-bold tracking-[0.08em] text-[#6B7280]">
                          {fromPlazore ? "PLAZORE" : "YOU"}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-[14px] leading-relaxed">
                        {m.body}
                      </p>
                      {m.createdAt ? (
                        <p className="mt-1.5 text-[10px] text-[#6B7280]">
                          {new Date(m.createdAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {closed ? (
              <p className="border border-white/[0.08] bg-[#11141A] px-4 py-3 text-center text-[13px] text-[#A7ADB8]">
                This conversation is closed.
              </p>
            ) : (
              <div className="sticky bottom-0 border-t border-white/[0.07] bg-[#090B0F] pt-3 pb-4">
                {error ? (
                  <p className="mb-2 text-[12px] text-[#ef6262]">{error}</p>
                ) : null}
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <textarea
                      value={reply}
                      onChange={(e) => {
                        if (wordCount(e.target.value) <= 300) {
                          setReply(e.target.value);
                        }
                      }}
                      rows={3}
                      placeholder="Write a reply…"
                      className="w-full resize-none border border-white/[0.08] bg-[#11141A] px-3 py-2.5 text-[14px] outline-none placeholder:text-[#5C6370] focus:border-[#00E575]/40"
                    />
                    <p className="mt-1 text-right text-[11px] text-[#6B7280]">
                      {words}/300
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={sending || words < 1}
                    onClick={sendReply}
                    className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#00E575] text-[#041412] disabled:opacity-50"
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}