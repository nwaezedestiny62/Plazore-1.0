"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutGrid,
  List,
  RefreshCw,
  WifiOff,
  X,
  AlertTriangle,
} from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Input,
  Panel,
  Select,
  cn,
} from "@/components/ui";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type ContactRow = {
  _id: string;
  contactAs?: string;
  contextType?: string;
  category?: string;
  subject?: string;
  email?: string;
  message?: string;
  status?: string;
  priority?: string;
  unreadByAdmin?: boolean;
  lastMessageAt?: string;
  createdAt?: string;
  location?: {
    country?: string;
    state?: string;
    city?: string;
    street?: string;
  };
  user?: {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
    storeName?: string;
    marketplaceRegion?: string;
    phone?: string;
  };
  relatedProduct?: { _id?: string; name?: string; images?: string[] };
  relatedSeller?: {
    _id?: string;
    name?: string;
    storeName?: string;
    email?: string;
  };
  relatedOrder?: {
    _id?: string;
    orderNumber?: string;
    orderStatus?: string;
    totalAmount?: number;
    paymentStatus?: string;
    deliveredAt?: string;
    buyerConfirmation?: {
      status?: "none" | "pending" | "confirmed" | "issue_reported";
      confirmedAt?: string;
      issueReportedAt?: string;
    };
    payout?: {
      status?: string;
      eligibleAt?: string;
      blockedReason?: string;
    };
  };
  assignedAdmin?: { _id?: string; name?: string; email?: string };
  messages?: Array<{
    _id?: string;
    senderType?: string;
    body?: string;
    createdAt?: string;
    sender?: { name?: string };
  }>;
  responses?: Array<{
    body?: string;
    createdAt?: string;
    admin?: { name?: string };
  }>;
  internalNotes?: Array<{
    body?: string;
    createdAt?: string;
    admin?: { name?: string };
  }>;
};

type Counts = {
  all: number;
  new: number;
  open: number;
  awaiting_user: number;
  awaiting_plazore: number;
  resolved: number;
  closed: number;
  unread: number;
  high: number;
};

function fmt(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function statusTone(
  s?: string
): "green" | "error" | "blue" | "warn" | "neutral" {
  if (s === "resolved") return "green";
  if (s === "closed") return "neutral";
  if (s === "new") return "blue";
  if (s === "awaiting_user") return "warn";
  if (s === "awaiting_plazore") return "blue";
  if (s === "open" || s === "in_progress") return "warn";
  return "neutral";
}

function isDeliveryIssue(row: ContactRow) {
  return (
    row.contextType === "order" ||
    row.category === "delivery" ||
    !!row.relatedOrder
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737A86]">
        {label}
      </p>
      <div className="mt-1 break-words text-sm text-[#F5F7FA]">
        {children ?? "—"}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#737A86]">
      {children}
    </p>
  );
}

export default function ContactsPage() {
  const { getToken } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [offline, setOffline] = useState(false);
  const [status, setStatus] = useState("");
  const [contactAs, setContactAs] = useState("");
  const [category, setCategory] = useState("");
  const [contextType, setContextType] = useState("");
  const [priority, setPriority] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");

  const [items, setItems] = useState<ContactRow[]>([]);
  const [counts, setCounts] = useState<Counts>({
    all: 0,
    new: 0,
    open: 0,
    awaiting_user: 0,
    awaiting_plazore: 0,
    resolved: 0,
    closed: 0,
    unread: 0,
    high: 0,
  });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);

  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ContactRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paneOpen, setPaneOpen] = useState(false);

  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolveBusy, setResolveBusy] = useState(false);

  const cacheRef = useRef<{
    items: ContactRow[];
    counts: Counts;
    total: number;
    pages: number;
    page: number;
  } | null>(null);

  const showOffline = mounted && offline;

  useEffect(() => {
    setMounted(true);
    const sync = () =>
      setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const load = useCallback(
    async (p = 1) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setOffline(true);
        if (cacheRef.current) {
          setItems(cacheRef.current.items);
          setCounts(cacheRef.current.counts);
          setTotal(cacheRef.current.total);
          setPages(cacheRef.current.pages);
          setPage(cacheRef.current.page);
          setStale(true);
          setError("You’re offline. Showing last loaded inbox.");
          setLoading(false);
          return;
        }
        setError("You’re offline. Connect to load contacts.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        setStale(false);
        const token = await getToken();
        if (!token) {
          setError("Session expired. Sign in again.");
          setLoading(false);
          return;
        }

        const params = new URLSearchParams({
          page: String(p),
          limit: "20",
        });
        if (status) params.set("status", status);
        if (contactAs) params.set("contactAs", contactAs);
        if (category) params.set("category", category);
        if (contextType) params.set("contextType", contextType);
        if (priority) params.set("priority", priority);
        if (unreadOnly) params.set("unread", "1");
        if (q.trim()) params.set("q", q.trim());

        const json = await adminFetch<any>(`/admin/contacts?${params}`, token);
        const nextItems = json.data || [];
        const nextCounts = json.counts || counts;
        const nextTotal = json.pagination?.total || 0;
        const nextPages = json.pagination?.pages || 1;
        const nextPage = json.pagination?.page || p;

        setItems(nextItems);
        setCounts(nextCounts);
        setTotal(nextTotal);
        setPages(nextPages);
        setPage(nextPage);
        cacheRef.current = {
          items: nextItems,
          counts: nextCounts,
          total: nextTotal,
          pages: nextPages,
          page: nextPage,
        };
      } catch (e: any) {
        if (cacheRef.current) {
          setItems(cacheRef.current.items);
          setCounts(cacheRef.current.counts);
          setTotal(cacheRef.current.total);
          setPages(cacheRef.current.pages);
          setPage(cacheRef.current.page);
          setStale(true);
          setError(
            e?.message
              ? `${e.message} — showing last load.`
              : "Request failed — showing last load."
          );
        } else {
          setError(e?.message || "Failed to load contacts");
        }
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getToken, status, contactAs, category, contextType, priority, unreadOnly, q]
  );

  useEffect(() => {
    if (!mounted) return;
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, status, contactAs, category, contextType, priority, unreadOnly]);

  const openPane = async (row: ContactRow) => {
    setOpenId(row._id);
    setSelected(row);
    setPaneOpen(true);
    setReply("");
    setNote("");
    if (showOffline) return;
    try {
      setDetailLoading(true);
      const token = await getToken();
      const json = await adminFetch<{ data: ContactRow }>(
        `/admin/contacts/${row._id}`,
        token
      );
      setSelected(json.data);
      await adminFetch(`/admin/contacts/${row._id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ markRead: true }),
      }).catch(() => {});
    } catch {
      /* keep list row */
    } finally {
      setDetailLoading(false);
    }
  };

  const closePane = () => {
    setPaneOpen(false);
    setTimeout(() => {
      setOpenId(null);
      setSelected(null);
    }, 280);
  };

  const patch = async (body: Record<string, unknown>) => {
    if (!selected || showOffline) return;
    try {
      setBusy(true);
      const token = await getToken();
      const json = await adminFetch<{ data: ContactRow }>(
        `/admin/contacts/${selected._id}`,
        token,
        { method: "PATCH", body: JSON.stringify(body) }
      );
      setSelected(json.data);
      setReply("");
      setNote("");
      await load(page);
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  /** Delivery issue resolution — updates Order.buyerConfirmation + payout */
  const resolveDeliveryIssue = async (
    action: "refund_buyer" | "seller_favour" | "authorize_payout"
  ) => {
    if (!selected || showOffline || resolveBusy) return;
    try {
      setResolveBusy(true);
      setError("");
      const token = await getToken();
      const json = await adminFetch<{ data: ContactRow }>(
        `/admin/contacts/${selected._id}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({
            resolveDeliveryIssue: action,
            status: "resolved",
          }),
        }
      );
      setSelected(json.data);
      await load(page);
    } catch (e: any) {
      setError(e?.message || "Resolution failed");
    } finally {
      setResolveBusy(false);
    }
  };

  const clearFilters = () => {
    setStatus("");
    setContactAs("");
    setCategory("");
    setContextType("");
    setPriority("");
    setUnreadOnly(false);
    setQ("");
  };

  const filtersActive = !!(
    status ||
    contactAs ||
    category ||
    contextType ||
    priority ||
    unreadOnly ||
    q.trim()
  );

  const thread = (() => {
    if (!selected)
      return [] as Array<{
        who: string;
        body: string;
        at?: string;
        side: "user" | "admin";
      }>;
    if (selected.messages?.length) {
      return selected.messages.map((m) => ({
        who:
          m.senderType === "admin"
            ? m.sender?.name || "Plazore"
            : selected.user?.name || "User",
        body: m.body || "",
        at: m.createdAt,
        side: (m.senderType === "admin" ? "admin" : "user") as
          | "user"
          | "admin",
      }));
    }
    const out: Array<{
      who: string;
      body: string;
      at?: string;
      side: "user" | "admin";
    }> = [];
    if (selected.message) {
      out.push({
        who: selected.user?.name || "User",
        body: selected.message,
        at: selected.createdAt,
        side: "user",
      });
    }
    for (const r of selected.responses || []) {
      out.push({
        who: r.admin?.name || "Plazore",
        body: r.body || "",
        at: r.createdAt,
        side: "admin",
      });
    }
    return out;
  })();

  const order = selected?.relatedOrder;
  const confStatus = order?.buyerConfirmation?.status;
  const payoutStatus = order?.payout?.status;
  const isIssueOpen =
    confStatus === "issue_reported" || payoutStatus === "blocked_issue";

  return (
    <div
      className={cn(
        poppins.className,
        "relative min-h-[70vh] pb-28 text-[#F5F7FA]"
      )}
    >
      {showOffline && (
        <div className="mb-4 flex items-start gap-3 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">You’re offline</p>
            <p className="mt-0.5 text-xs text-amber-100/80">
              Inbox actions need a connection.
              {stale ? " Showing last load." : ""}
            </p>
          </div>
        </div>
      )}

      <header className="mb-6 border-b border-[#252A33] pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
          Support
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-semibold leading-none tracking-tight sm:text-[28px]">
              Contact
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#A7ADB8]">
              Conversations from Plazore users — general, store, product, and
              order context. Delivery issues control seller payout here.
            </p>
          </div>
          <Button
            tone="ghost"
            className="h-9 gap-1.5 text-xs"
            disabled={loading || showOffline}
            onClick={() => load(page)}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </header>

      {/* Status counts */}
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden border border-[#252A33] bg-[#252A33] sm:grid-cols-4 lg:grid-cols-8">
        {(
          [
            ["All", "", counts.all],
            ["New", "new", counts.new],
            ["Open", "open", counts.open],
            ["Await user", "awaiting_user", counts.awaiting_user],
            ["Await us", "awaiting_plazore", counts.awaiting_plazore],
            ["Resolved", "resolved", counts.resolved],
            ["Closed", "closed", counts.closed],
            ["Unread", "__unread", counts.unread],
          ] as const
        ).map(([label, value, n]) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (value === "__unread") {
                setUnreadOnly(true);
                setStatus("");
              } else {
                setUnreadOnly(false);
                setStatus(value);
              }
            }}
            className={cn(
              "bg-[#11141A] px-2 py-3 text-left transition sm:px-3",
              ((value === "__unread" && unreadOnly) ||
                (value !== "__unread" && status === value && !unreadOnly)) &&
                "bg-[#041412] ring-1 ring-inset ring-[#00E575]/30"
            )}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#737A86]">
              {label}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums leading-none">
              {Number(n || 0).toLocaleString()}
            </p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Panel className="mb-4 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#252A33] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
            Filters
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-[#A7ADB8] hover:text-[#00E575]"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              placeholder="Search email, subject, message…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !showOffline && load(1)}
              className="lg:max-w-md"
            />
            <Button onClick={() => load(1)} disabled={loading || showOffline}>
              Search
            </Button>
            <div className="flex gap-1 border border-[#252A33] lg:ml-auto">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center",
                  view === "list"
                    ? "bg-[#00E575] text-[#041412]"
                    : "text-[#A7ADB8]"
                )}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView("grid")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center",
                  view === "grid"
                    ? "bg-[#00E575] text-[#041412]"
                    : "text-[#A7ADB8]"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              value={contactAs}
              onChange={(e) => setContactAs(e.target.value)}
            >
              <option value="">All roles</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
            </Select>
            <Select
              value={contextType}
              onChange={(e) => setContextType(e.target.value)}
            >
              <option value="">All context</option>
              <option value="general">General</option>
              <option value="store">Store</option>
              <option value="product">Product</option>
              <option value="order">Order</option>
              <option value="seller">Seller</option>
              <option value="buyer">Buyer</option>
            </Select>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              <option value="buying">Buying</option>
              <option value="selling">Selling</option>
              <option value="order_payment">Order / payment</option>
              <option value="delivery">Delivery</option>
              <option value="feedback">Feedback</option>
              <option value="technical">Technical</option>
              <option value="account">Account</option>
              <option value="other">Other</option>
            </Select>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">All priority</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
          </div>
        </div>
      </Panel>

      {error && (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="border border-[#252A33] bg-[#11141A]">
          <OrbLoader label="Loading conversations" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No conversations"
          body="When users contact Plazore, they appear here."
        />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((row) => (
            <button
              key={row._id}
              type="button"
              onClick={() => openPane(row)}
              className={cn(
                "border border-[#252A33] bg-[#11141A] p-4 text-left transition hover:border-[#00E575]/35",
                openId === row._id &&
                  paneOpen &&
                  "border-[#00E575]/45 bg-[#00E575]/5"
              )}
            >
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={statusTone(row.status)}>
                  {row.status || "—"}
                </Badge>
                {row.unreadByAdmin && <Badge tone="blue">Unread</Badge>}
                {isDeliveryIssue(row) && (
                  <Badge tone="warn">Delivery issue</Badge>
                )}
                <Badge tone="neutral">{row.contactAs || "—"}</Badge>
              </div>
              <p className="mt-2 truncate font-medium">
                {row.user?.name || row.email || "User"}
              </p>
              <p className="truncate text-xs text-[#737A86]">
                {row.subject || row.category || row.contextType || "—"}
              </p>
              <p className="mt-2 line-clamp-2 text-xs text-[#A7ADB8]">
                {row.message || "—"}
              </p>
              <p className="mt-2 text-[11px] text-[#737A86]">
                {fmt(row.lastMessageAt || row.createdAt)}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-[#252A33] text-[11px] uppercase tracking-[0.12em] text-[#737A86]">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Context</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row._id}
                  onClick={() => openPane(row)}
                  className={cn(
                    "cursor-pointer border-b border-[#252A33]/70 transition hover:bg-[#171B22]/80",
                    openId === row._id &&
                      paneOpen &&
                      "bg-[#00E575]/[0.06]"
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {row.user?.name || "—"}
                      {row.unreadByAdmin && (
                        <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-[#00E575]" />
                      )}
                    </p>
                    <p className="text-xs text-[#737A86]">
                      {row.email || row.user?.email}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[#A7ADB8]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{row.contextType || "general"}</span>
                      {isDeliveryIssue(row) && (
                        <Badge tone="warn">Delivery</Badge>
                      )}
                      {row.relatedProduct?.name
                        ? ` · ${row.relatedProduct.name}`
                        : ""}
                      {row.relatedSeller?.storeName
                        ? ` · ${row.relatedSeller.storeName}`
                        : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#A7ADB8]">
                    {row.category || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(row.status)}>
                      {row.status || "—"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        row.priority === "critical"
                          ? "error"
                          : row.priority === "high"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {row.priority || "normal"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#A7ADB8]">
                    {fmt(row.lastMessageAt || row.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center gap-2">
          <Button
            tone="ghost"
            disabled={page <= 1 || loading || showOffline}
            onClick={() => load(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-[#737A86]">
            Page {page} of {pages} · {total} total
          </span>
          <Button
            tone="ghost"
            disabled={page >= pages || loading || showOffline}
            onClick={() => load(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
          paneOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
        onClick={closePane}
        aria-hidden
      />

      {/* Detail pane */}
      <aside
        className={cn(
          poppins.className,
          "fixed top-0 right-0 z-50 flex h-full w-full max-w-[460px] flex-col border-l border-[#252A33] bg-[#0C0F14] shadow-2xl transition-transform duration-300 ease-out",
          paneOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#252A33] px-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00E575]">
              Conversation
            </p>
            <p className="text-sm font-medium">Support workspace</p>
          </div>
          <button
            type="button"
            onClick={closePane}
            className="flex h-9 w-9 items-center justify-center border border-[#252A33] bg-[#171B22] text-[#A7ADB8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {detailLoading && !selected && (
            <OrbLoader label="Loading conversation" />
          )}
          {selected && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={statusTone(selected.status)}>
                  {selected.status}
                </Badge>
                <Badge tone="neutral">{selected.contactAs}</Badge>
                <Badge tone="neutral">
                  {selected.contextType || "general"}
                </Badge>
                {isDeliveryIssue(selected) && (
                  <Badge tone="warn">Delivery issue</Badge>
                )}
                {selected.priority && (
                  <Badge
                    tone={
                      selected.priority === "critical"
                        ? "error"
                        : selected.priority === "high"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {selected.priority}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <SectionLabel>User</SectionLabel>
                <Field label="Name">{selected.user?.name || "—"}</Field>
                <Field label="Email">
                  {selected.email || selected.user?.email || "—"}
                </Field>
                {selected.user?._id && (
                  <Link
                    href={`/users?userId=${selected.user._id}&role=${selected.contactAs || "buyer"}`}
                    className="inline-flex text-xs font-medium text-[#00E575] hover:underline"
                  >
                    Open on Users
                  </Link>
                )}
              </div>

              {(selected.relatedProduct ||
                selected.relatedSeller ||
                selected.relatedOrder) && (
                <div className="space-y-2 border-t border-[#252A33] pt-4">
                  <SectionLabel>Context</SectionLabel>
                  {selected.relatedProduct && (
                    <Field label="Product">
                      {selected.relatedProduct.name || "—"}
                      {selected.relatedProduct._id && (
                        <div>
                          <Link
                            href={`/products?q=${encodeURIComponent(selected.relatedProduct.name || "")}`}
                            className="text-xs text-[#00E575] hover:underline"
                          >
                            View product
                          </Link>
                        </div>
                      )}
                    </Field>
                  )}
                  {selected.relatedSeller && (
                    <Field label="Store">
                      {selected.relatedSeller.storeName ||
                        selected.relatedSeller.name ||
                        "—"}
                      {selected.relatedSeller._id && (
                        <div>
                          <Link
                            href={`/users?userId=${selected.relatedSeller._id}&role=seller`}
                            className="text-xs text-[#00E575] hover:underline"
                          >
                            Open seller
                          </Link>
                        </div>
                      )}
                    </Field>
                  )}
                  {selected.relatedOrder && (
                    <Field label="Order">
                      {selected.relatedOrder.orderNumber ||
                        selected.relatedOrder._id ||
                        "—"}
                      {selected.relatedOrder._id && (
                        <div>
                          <Link
                            href={`/orders?q=${encodeURIComponent(selected.relatedOrder.orderNumber || selected.relatedOrder._id)}`}
                            className="text-xs text-[#00E575] hover:underline"
                          >
                            Open order
                          </Link>
                        </div>
                      )}
                    </Field>
                  )}
                </div>
              )}

              {/* ─── Delivery confirmation & payout control ─── */}
              {isDeliveryIssue(selected) && (
                <div className="space-y-3 border-t border-[#252A33] pt-4">
                  <SectionLabel>Delivery confirmation & payout</SectionLabel>

                  {order ? (
                    <div className="space-y-2 border border-[#252A33] bg-[#11141A] p-3 text-xs">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="neutral">
                          Status: {order.orderStatus || "—"}
                        </Badge>
                        <Badge
                          tone={
                            confStatus === "confirmed"
                              ? "green"
                              : confStatus === "issue_reported"
                                ? "error"
                                : confStatus === "pending"
                                  ? "warn"
                                  : "neutral"
                          }
                        >
                          Confirm: {confStatus || "none"}
                        </Badge>
                        <Badge
                          tone={
                            payoutStatus === "eligible" ||
                            payoutStatus === "completed"
                              ? "green"
                              : payoutStatus === "blocked_issue"
                                ? "error"
                                : "warn"
                          }
                        >
                          Payout: {payoutStatus || "—"}
                        </Badge>
                      </div>
                      <p className="text-[#A7ADB8]">
                        Total:{" "}
                        {Number(order.totalAmount || 0).toLocaleString()} ·
                        Delivered: {fmt(order.deliveredAt)}
                      </p>
                      {order.payout?.blockedReason && (
                        <p className="text-amber-200/90">
                          {order.payout.blockedReason}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-[#737A86]">
                      Order context is linked. Open the order for full details.
                    </p>
                  )}

                  {isIssueOpen && selected.status !== "resolved" && (
                    <div className="flex items-start gap-2 border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Seller payout is blocked while this issue is open.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      tone="ghost"
                      className="justify-start border border-amber-500/30 text-amber-200"
                      disabled={
                        resolveBusy ||
                        showOffline ||
                        selected.status === "resolved"
                      }
                      onClick={() => resolveDeliveryIssue("seller_favour")}
                    >
                      Resolve in seller’s favour
                    </Button>
                    <Button
                      tone="ghost"
                      className="justify-start border border-[#00E575]/30 text-[#00E575]"
                      disabled={
                        resolveBusy ||
                        showOffline ||
                        selected.status === "resolved"
                      }
                      onClick={() => resolveDeliveryIssue("authorize_payout")}
                    >
                      Authorize seller payout
                    </Button>
                    <Button
                      tone="ghost"
                      className="justify-start border border-red-500/30 text-red-300"
                      disabled={
                        resolveBusy ||
                        showOffline ||
                        selected.status === "resolved"
                      }
                      onClick={() => resolveDeliveryIssue("refund_buyer")}
                    >
                      Refund buyer
                    </Button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#737A86]">
                    These actions update the linked order’s confirmation and
                    payout state on the server. Refunds will later call
                    Paystack; for now the ledger is updated and audited.
                  </p>
                </div>
              )}

              {selected.location && (
                <div className="space-y-2 border-t border-[#252A33] pt-4">
                  <SectionLabel>Location</SectionLabel>
                  <Field label="Country">
                    {selected.location.country || "—"}
                  </Field>
                  <Field label="State">
                    {selected.location.state || "—"}
                  </Field>
                  <Field label="City">{selected.location.city || "—"}</Field>
                </div>
              )}

              <div className="space-y-3 border-t border-[#252A33] pt-4">
                <SectionLabel>Thread</SectionLabel>
                <div className="space-y-2">
                  {thread.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "border px-3 py-2 text-sm",
                        m.side === "admin"
                          ? "border-[#00E575]/25 bg-[#00E575]/5"
                          : "border-[#252A33] bg-[#11141A]"
                      )}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#737A86]">
                        {m.who} · {fmt(m.at)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[#F5F7FA]">
                        {m.body}
                      </p>
                    </div>
                  ))}
                  {thread.length === 0 && (
                    <p className="text-xs text-[#737A86]">No messages yet.</p>
                  )}
                </div>
              </div>

              {(selected.internalNotes?.length || 0) > 0 && (
                <div className="space-y-2 border-t border-[#252A33] pt-4">
                  <SectionLabel>Internal notes</SectionLabel>
                  {selected.internalNotes!.map((n, i) => (
                    <div
                      key={i}
                      className="border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100"
                    >
                      <p className="text-[10px] opacity-70">
                        {n.admin?.name || "Admin"} · {fmt(n.createdAt)}
                      </p>
                      <p className="mt-1">{n.body}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 border-t border-[#252A33] pt-4">
                <SectionLabel>Reply to user</SectionLabel>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                  placeholder="Write a reply visible to the user…"
                  className="w-full border border-[#252A33] bg-[#11141A] px-3 py-2 text-sm text-[#F5F7FA] outline-none focus:border-[#00E575]/40"
                  disabled={busy || showOffline}
                />
                <Button
                  disabled={busy || showOffline || !reply.trim()}
                  onClick={() => patch({ reply: reply.trim() })}
                >
                  Send reply
                </Button>
              </div>

              <div className="space-y-3 border-t border-[#252A33] pt-4">
                <SectionLabel>Internal note</SectionLabel>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Admin-only note (never shown to users)…"
                  className="w-full border border-[#252A33] bg-[#11141A] px-3 py-2 text-sm text-[#F5F7FA] outline-none focus:border-[#00E575]/40"
                  disabled={busy || showOffline}
                />
                <Button
                  tone="ghost"
                  disabled={busy || showOffline || !note.trim()}
                  onClick={() => patch({ internalNote: note.trim() })}
                >
                  Save note
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-[#252A33] pt-4">
                <Select
                  value={selected.status || ""}
                  disabled={busy || showOffline}
                  onChange={(e) => patch({ status: e.target.value })}
                >
                  <option value="new">New</option>
                  <option value="open">Open</option>
                  <option value="awaiting_user">Awaiting user</option>
                  <option value="awaiting_plazore">Awaiting Plazore</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </Select>
                <Select
                  value={selected.priority || "normal"}
                  disabled={busy || showOffline}
                  onChange={(e) => patch({ priority: e.target.value })}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Select>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}