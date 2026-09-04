"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  Clock,
  Package,
  Plane,
  SlidersHorizontal,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const CLEARED_KEY = "plazore_cleared_notification_ids";

type NotifType =
  | "new_order"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled"
  | "order_reminder"
  | "order_shipped_reminder"
  | "general"
  | "contact_reply"
  | "contact_need_info"
  | "report_received"
  | "report_update"
  | "announcement";

type Notif = {
  _id: string;
  title?: string;
  message?: string;
  type?: string;
  isRead?: boolean;
  order?: string | { _id?: string };
  orderNumber?: string;
  contact?: string | { _id?: string };
  report?: string | { _id?: string };
  announcement?: string | { _id?: string };
  link?: string;
  createdAt?: string;
};

type OverlayAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  primary?: boolean;
};

type OverlayState = {
  title: string;
  message?: string;
  tone?: "info" | "success" | "danger";
  actions?: OverlayAction[];
  durationMs?: number;
} | null;

function loadClearedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveClearedIds(ids: Set<string>) {
  try {
    localStorage.setItem(CLEARED_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function idOf(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v && "_id" in v) {
    return String((v as { _id?: string })._id || "");
  }
  return String(v);
}

function isPlazoreMessage(type?: string) {
  return (
    type === "contact_reply" ||
    type === "contact_need_info" ||
    type === "report_received" ||
    type === "report_update" ||
    type === "announcement" ||
    type === "general"
  );
}

function IconForType({
  type,
  className,
}: {
  type?: string;
  className?: string;
}) {
  if (isPlazoreMessage(type)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logo.png"
        alt="Plazore"
        className={
          className
            ? `${className} object-contain`
            : "h-5 w-5 object-contain"
        }
      />
    );
  }
  switch (type as NotifType) {
    case "new_order":
      return <Package className={className} />;
    case "order_shipped":
      return <Plane className={className} />;
    case "order_delivered":
      return <Check className={className} />;
    case "order_cancelled":
      return <XCircle className={className} />;
    case "order_reminder":
    case "order_shipped_reminder":
      return <Clock className={className} />;
    default:
      return <Bell className={className} />;
  }
}

function accentForType(type?: string, isRead?: boolean) {
  if (isRead) return { bg: "bg-[#171B22]", icon: "text-[#6B7280]" };
  if (isPlazoreMessage(type)) {
    return { bg: "bg-[rgba(0,229,117,0.12)]", icon: "text-[#00E575]" };
  }
  switch (type as NotifType) {
    case "order_cancelled":
      return { bg: "bg-[rgba(239,68,68,0.18)]", icon: "text-[#EF4444]" };
    case "order_delivered":
      return { bg: "bg-[rgba(0,229,117,0.15)]", icon: "text-[#00E575]" };
    case "order_shipped":
      return { bg: "bg-[rgba(59,130,246,0.15)]", icon: "text-[#3B82F6]" };
    case "new_order":
      return { bg: "bg-[rgba(0,229,117,0.12)]", icon: "text-[#00E575]" };
    default:
      return { bg: "bg-[#171B22]", icon: "text-[#F5F7FA]" };
  }
}

function OrbLoader() {
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

function TopOverlay({
  state,
  onDismiss,
}: {
  state: OverlayState;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!state || state.actions?.length) return;
    const ms = state.durationMs ?? 5000;
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
  }, [state, onDismiss]);

  if (!state) return null;

  const accent =
    state.tone === "danger"
      ? "bg-[#EF4444]"
      : state.tone === "success"
        ? "bg-[#00E575]"
        : "bg-[#3B82F6]";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3.5 pt-3 sm:pt-4">
      <div className="pointer-events-auto flex w-full max-w-lg overflow-hidden border border-white/10 bg-[#11141A] shadow-2xl">
        <span className={`w-[3px] shrink-0 ${accent}`} />
        <div className="flex-1 p-3">
          <div className="flex items-start gap-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold tracking-tight">{state.title}</p>
              {state.message ? (
                <p className="mt-1 text-[12.5px] leading-[18px] text-[#A7ADB8]">
                  {state.message}
                </p>
              ) : null}
            </div>
            {!state.actions?.length ? (
              <button
                type="button"
                onClick={onDismiss}
                className="p-0.5"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4 text-[#6B7280]" />
              </button>
            ) : null}
          </div>
          {state.actions?.length ? (
            <div className="mt-3 flex justify-end gap-2">
              {state.actions.map((a, i) => (
                <button
                  key={`${a.label}-${i}`}
                  type="button"
                  onClick={() => {
                    onDismiss();
                    requestAnimationFrame(() => a.onPress());
                  }}
                  className={`min-w-[72px] px-3.5 py-2 text-[13px] font-bold ${
                    a.destructive
                      ? "bg-[#EF4444] text-white"
                      : a.primary
                        ? "bg-[#F5F7FA] text-[#090B0F]"
                        : "border border-white/[0.07] bg-[#171B22] text-[#F5F7FA]"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [overlay, setOverlay] = useState<OverlayState>(null);
  const clearedRef = useRef<Set<string>>(new Set());

  const dismissOverlay = useCallback(() => setOverlay(null), []);

  const applyClearedFilter = useCallback((list: Notif[]) => {
    const cleared = clearedRef.current;
    if (!cleared.size) return list;
    return list.filter((n) => !cleared.has(String(n._id)));
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      clearedRef.current = loadClearedIds();
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.success) {
        setNotifications(applyClearedFilter(json.data || []));
      }
    } catch {
      /* keep list */
    } finally {
      setLoading(false);
    }
  }, [getToken, applyClearedFilter]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    fetchNotifications();
  }, [isLoaded, isSignedIn, fetchNotifications, router]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
    );
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`${API}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* local ok */
    }
  };

  const handlePress = async (item: Notif) => {
    if (!item.isRead) await markAsRead(item._id);

    if (item.link) {
      router.push(item.link);
      return;
    }

    if (item.type === "contact_reply" || item.type === "contact_need_info") {
      const contactId = idOf(item.contact);
      if (contactId) {
        router.push(`/contact/conversation/${contactId}`);
        return;
      }
    }

    if (item.type === "report_received" || item.type === "report_update") {
      return;
    }

    if (item.type === "announcement") {
      const annId = idOf(item.announcement);
      if (annId) {
        router.push(`/announcements/${annId}`);
        return;
      }
    }

    const orderId = idOf(item.order);
    if (!orderId) return;

    if (
      item.type === "new_order" ||
      item.type === "order_reminder" ||
      item.type === "order_shipped_reminder"
    ) {
      router.push(`/seller/orders/${orderId}`);
      return;
    }

    router.push(`/orders/${orderId}`);
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setConfigOpen(false);
    setOverlay({
      title: "All caught up",
      message: "Every notification is marked as read.",
      tone: "success",
      durationMs: 5000,
    });
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`${API}/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* local ok */
    }
  };

  const runClearRead = async () => {
    if (clearing) return;
    setClearing(true);
    const ids = notifications.filter((n) => n.isRead).map((n) => String(n._id));
    setNotifications((prev) => prev.filter((n) => !n.isRead));
    const next = new Set(clearedRef.current);
    ids.forEach((id) => next.add(id));
    clearedRef.current = next;
    saveClearedIds(next);
    setOverlay({
      title: "Read notifications cleared",
      message: "They’re gone from this list on your device.",
      tone: "success",
      durationMs: 5000,
    });
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API}/notifications/read`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        await fetch(`${API}/notifications/clear-read`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      /* local is source of truth */
    } finally {
      setClearing(false);
    }
  };

  const clearRead = () => {
    setConfigOpen(false);
    const readCount = notifications.filter((n) => n.isRead).length;
    if (readCount === 0) {
      setOverlay({
        title: "Nothing to clear",
        message: "You have no read notifications yet.",
        tone: "info",
        durationMs: 8000,
      });
      return;
    }
    setOverlay({
      title: "Clear read notifications?",
      message: `Remove ${readCount} read notification${
        readCount !== 1 ? "s" : ""
      } from this list?`,
      tone: "danger",
      actions: [
        { label: "Cancel", onPress: () => {} },
        {
          label: clearing ? "Clearing…" : "Clear",
          destructive: true,
          onPress: runClearRead,
        },
      ],
    });
  };

  if (!isLoaded || (loading && isSignedIn)) return <OrbLoader />;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <TopOverlay state={overlay} onDismiss={dismissOverlay} />

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.07] bg-[#090B0F]/95 px-2 py-2.5 backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 shrink-0 items-center justify-center"
            aria-label="Back"
          >
            <ChevronLeft className="h-[22px] w-[22px]" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight">
              Notifications
            </h1>
            <p className="text-[11px] text-[#6B7280]">
              {unreadCount > 0
                ? `${unreadCount} unread`
                : `${notifications.length} total`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-semibold text-[#A7ADB8]"
            >
              Mark all read
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-white/[0.07] bg-[#11141A]"
            aria-label="Options"
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">
        {notifications.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center px-7 pt-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.07] bg-[#11141A]">
              <Bell className="h-8 w-8 text-[#6B7280]" />
            </div>
            <h2 className="text-[17px] font-bold">No notifications yet</h2>
            <p className="mt-1.5 text-[13px] leading-5 text-[#A7ADB8]">
              Order updates and alerts will show up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {notifications.map((item) => {
              const colors = accentForType(item.type, item.isRead);
              return (
                <li key={item._id}>
                  <button
                    type="button"
                    onClick={() => handlePress(item)}
                    className={`flex w-full items-start rounded-[14px] border p-3.5 text-left ${
                      item.isRead
                        ? "border-white/[0.07] bg-[#11141A]"
                        : "border-white/12 bg-[#171B22]"
                    }`}
                  >
                    <span
                      className={`mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors.bg}`}
                    >
                      <IconForType
                        type={item.type}
                        className={`h-[18px] w-[18px] ${colors.icon}`}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm leading-[19px] ${
                          item.isRead
                            ? "font-semibold text-[#A7ADB8]"
                            : "font-bold text-[#F5F7FA]"
                        }`}
                      >
                        {item.title}
                      </span>
                      <span className="mt-1 block text-[13px] leading-[18px] text-[#A7ADB8] line-clamp-3">
                        {item.message}
                      </span>
                      {item.orderNumber ? (
                        <span className="mt-1.5 block text-[11px] text-[#6B7280]">
                          {item.orderNumber}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-[11px] text-[#6B7280]">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString()
                          : ""}
                      </span>
                    </span>
                    {!item.isRead ? (
                      <span className="ml-2 mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#00E575]" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {configOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/72 sm:items-center sm:p-6">
          <div className="w-full max-w-sm overflow-hidden border-t border-white/[0.07] bg-[#11141A] sm:border">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-base font-bold">Notification options</h2>
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="flex h-8 w-8 items-center justify-center border border-white/[0.07] bg-[#171B22]"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-[#A7ADB8]" />
              </button>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              className="flex w-full items-center gap-3 border-t border-white/[0.07] px-5 py-3.5 text-left"
            >
              <CheckCheck className="h-4 w-4 text-[#A7ADB8]" />
              <span className="text-sm font-semibold">Mark All as Read</span>
            </button>
            <button
              type="button"
              onClick={clearRead}
              className="flex w-full items-center gap-3 border-t border-white/[0.07] px-5 py-3.5 text-left text-[#EF4444]"
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-sm font-semibold">
                Clear Read Notifications
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}