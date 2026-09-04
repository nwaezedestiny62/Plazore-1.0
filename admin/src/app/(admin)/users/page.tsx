"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, List, RefreshCw, WifiOff, X } from "lucide-react";
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
import { REGION_LIST } from "@/lib/region";
import { FULFILLMENT_COUNTRIES, getStatesForCountry } from "@/lib/location";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type UserRow = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  role: string;
  image?: string;
  clerkId?: string;
  marketplaceRegion?: string;
  storeName?: string;
  storeDescription?: string;
  businessGoal?: string;
  storeLogo?: string;
  storeBanner?: string;
  isSellerVerified?: boolean;
  isSellerSuspended?: boolean;
  sellerAppliedAt?: string;
  lastSeenAt?: string;
  lastSeenPlatform?: "web" | "app" | "admin";
  payout?: { bankName?: string; accountName?: string; accountNumber?: string };
  shippingDefaults?: {
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
    deliveryMethod?: string;
    courierCompany?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  productStats?: { total: number; active: number };
};

type UserDetail = {
  user: UserRow;
  products: Array<{
    _id: string;
    name: string;
    price: number;
    isActive?: boolean;
    region?: string;
    stock?: number;
    category?: string;
  }>;
  stats: {
    productCount: number;
    activeProductCount: number;
    orderCountAsBuyer: number;
    orderCountAsSeller: number;
    orderCount: number;
    gmv: number;
  };
  recentOrdersAsBuyer?: any[];
  recentOrdersAsSeller?: any[];
};

type Counts = { all: number; buyer: number; seller: number; admin: number };

type ActivityHealth = {
  score: number;
  label: string;
  tone: "green" | "warn" | "error";
  active24h: number;
  quiet7d: number;
  idle30d: number;
  dormant: number;
  unknown: number;
  total: number;
};

function fmtDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function activityState(lastSeen?: string) {
  if (!lastSeen) return { label: "Unknown", tone: "neutral" as const };
  const hrs = (Date.now() - new Date(lastSeen).getTime()) / 3600000;
  if (Number.isNaN(hrs)) return { label: "Unknown", tone: "neutral" as const };
  if (hrs < 24) return { label: "Active", tone: "green" as const };
  if (hrs < 24 * 7) return { label: "Quiet", tone: "warn" as const };
  if (hrs < 24 * 30) return { label: "Idle", tone: "neutral" as const };
  return { label: "Dormant", tone: "error" as const };
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

function Avatar({
  name,
  image,
  size = "md",
}: {
  name?: string;
  image?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "lg"
      ? "h-14 w-14 text-lg"
      : size === "sm"
        ? "h-8 w-8 text-[11px]"
        : "h-10 w-10 text-sm";
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        className={cn(
          dim,
          "shrink-0 rounded-full border border-[#252A33] object-cover"
        )}
      />
    );
  }
  return (
    <div
      className={cn(
        dim,
        "flex shrink-0 items-center justify-center rounded-full border border-[#252A33] bg-[#171B22] font-semibold text-[#00E575]"
      )}
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function UsersPage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const deepUserId = (searchParams.get("userId") || "").trim();
  const deepRole = (searchParams.get("role") || "").trim();
  const deepOpenedRef = useRef<string | null>(null);

  const [mounted, setMounted] = useState(false);
  const [offline, setOffline] = useState(false);

  const [role, setRole] = useState(
    deepRole === "buyer" || deepRole === "seller" || deepRole === "admin"
      ? deepRole
      : ""
  );
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [sort, setSort] = useState("newest");
  const [spot, setSpot] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [q, setQ] = useState("");

  const [items, setItems] = useState<UserRow[]>([]);
  const [counts, setCounts] = useState<Counts>({
    all: 0,
    buyer: 0,
    seller: 0,
    admin: 0,
  });
  const [health, setHealth] = useState<ActivityHealth | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paneOpen, setPaneOpen] = useState(false);

  const cacheRef = useRef<{
    items: UserRow[];
    counts: Counts;
    health: ActivityHealth | null;
    total: number;
    pages: number;
    page: number;
  } | null>(null);

  const showOffline = mounted && offline;
  const states = useMemo(() => getStatesForCountry(country), [country]);

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

  // Sync role from URL (Orders / Products deep link)
  useEffect(() => {
    if (
      deepRole === "buyer" ||
      deepRole === "seller" ||
      deepRole === "admin"
    ) {
      setRole(deepRole);
    }
  }, [deepRole]);

  const load = useCallback(
    async (p = 1) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setOffline(true);
        if (cacheRef.current) {
          setItems(cacheRef.current.items);
          setCounts(cacheRef.current.counts);
          setHealth(cacheRef.current.health);
          setTotal(cacheRef.current.total);
          setPages(cacheRef.current.pages);
          setPage(cacheRef.current.page);
          setStale(true);
          setError(
            "You’re offline. Showing the last loaded list — reconnect to refresh."
          );
          setLoading(false);
          return;
        }
        setError("You’re offline. Connect to load accounts.");
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
          sort,
        });
        if (role) params.set("role", role);
        if (region) params.set("region", region);
        if (country) params.set("country", country);
        if (state) params.set("state", state);
        if (spot) params.set("spot", spot);
        if (q.trim()) params.set("q", q.trim());

        const json = await adminFetch<any>(`/admin/users?${params}`, token);
        const nextItems = json.data || [];
        const nextCounts = json.counts || {
          all: 0,
          buyer: 0,
          seller: 0,
          admin: 0,
        };
        const nextHealth = json.activityHealth || null;
        const nextTotal = json.pagination?.total || 0;
        const nextPages = json.pagination?.pages || 1;
        const nextPage = json.pagination?.page || p;

        setItems(nextItems);
        setCounts(nextCounts);
        setHealth(nextHealth);
        setTotal(nextTotal);
        setPages(nextPages);
        setPage(nextPage);

        cacheRef.current = {
          items: nextItems,
          counts: nextCounts,
          health: nextHealth,
          total: nextTotal,
          pages: nextPages,
          page: nextPage,
        };
      } catch (e: any) {
        if (cacheRef.current) {
          setItems(cacheRef.current.items);
          setCounts(cacheRef.current.counts);
          setHealth(cacheRef.current.health);
          setTotal(cacheRef.current.total);
          setPages(cacheRef.current.pages);
          setPage(cacheRef.current.page);
          setStale(true);
          setError(
            e?.message
              ? `${e.message} — showing last successful load.`
              : "Request failed — showing last successful load."
          );
        } else {
          setError(e?.message || "Failed to load users");
        }
      } finally {
        setLoading(false);
      }
    },
    [getToken, role, region, country, state, sort, spot, q]
  );

  const loadDetail = useCallback(
    async (id: string) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setError("You’re offline. Account detail needs a connection.");
        setDetailLoading(false);
        return;
      }
      try {
        setDetailLoading(true);
        const token = await getToken();
        if (!token) {
          setError("Session expired. Sign in again.");
          return;
        }
        const json = await adminFetch<{ data: UserDetail }>(
          `/admin/users/${id}`,
          token
        );
        setDetail(json.data);
      } catch (e: any) {
        setError(e?.message || "Could not load account detail");
      } finally {
        setDetailLoading(false);
      }
    },
    [getToken]
  );

  const openPane = useCallback(
    async (id: string) => {
      setOpenId(id);
      setDetail(null);
      setPaneOpen(true);
      await loadDetail(id);
    },
    [loadDetail]
  );

  const closePane = useCallback(() => {
    setPaneOpen(false);
    deepOpenedRef.current = null;
    if (deepUserId) {
      // Drop ?userId so refresh doesn't reopen the same pane
      router.replace(pathname);
    }
    window.setTimeout(() => {
      setOpenId(null);
      setDetail(null);
    }, 280);
  }, [deepUserId, pathname, router]);

  // Auto-open from Orders / Products: /users?userId=xxx&role=buyer|seller
  useEffect(() => {
    if (!mounted || !deepUserId) return;
    if (deepOpenedRef.current === deepUserId) return;
    deepOpenedRef.current = deepUserId;
    void openPane(deepUserId);
  }, [mounted, deepUserId, openPane]);

  useEffect(() => {
    if (!mounted) return;
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, role, region, country, state, sort, spot]);

  const clearFilters = () => {
    setRole("");
    setRegion("");
    setCountry("");
    setState("");
    setSort("newest");
    setSpot("");
    setQ("");
  };

  const u = detail?.user;
  const lastSeen = u?.lastSeenAt || u?.updatedAt;
  const filtersActive = !!(
    role ||
    region ||
    country ||
    state ||
    spot ||
    q.trim()
  );

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
              Search and detail require a connection.
              {stale
                ? " Showing the last list we loaded."
                : " Reconnect to load accounts."}
            </p>
          </div>
        </div>
      )}

      <header className="mb-6 border-b border-[#252A33] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
            Directory
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-medium",
              showOffline
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                : "border-[#00E575]/25 bg-[#00E575]/10 text-[#00E575]"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                showOffline ? "bg-amber-400" : "bg-[#00E575]"
              )}
            />
            {showOffline ? "Offline" : "Live"}
          </span>
        </div>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-semibold leading-none tracking-tight sm:text-[28px]">
              Users & sellers
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#A7ADB8]">
              Search, filter, and inspect accounts. Open from Orders or Products
              to jump straight into a profile.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs tabular-nums text-[#737A86]">
              <span className="text-[#F5F7FA]">{total.toLocaleString()}</span> in
              view ·{" "}
              <span className="text-[#F5F7FA]">
                {counts.all.toLocaleString()}
              </span>{" "}
              total
              {stale ? " · cached" : ""}
            </p>
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
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden border border-[#252A33] bg-[#252A33] sm:grid-cols-4">
        {(
          [
            ["All", "", counts.all],
            ["Buyers", "buyer", counts.buyer],
            ["Sellers", "seller", counts.seller],
            ["Admins", "admin", counts.admin],
          ] as const
        ).map(([label, value, n]) => (
          <button
            key={label}
            type="button"
            disabled={showOffline && !cacheRef.current}
            onClick={() => setRole(value)}
            className={cn(
              "bg-[#11141A] px-3 py-3.5 text-left transition sm:px-4",
              role === value &&
                "bg-[#041412] ring-1 ring-inset ring-[#00E575]/30"
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              {label}
            </p>
            <p className="mt-1.5 text-[22px] font-semibold tabular-nums leading-none">
              {Number(n).toLocaleString()}
            </p>
          </button>
        ))}
      </div>

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
              placeholder="Name, email, store, phone, region, or user ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !showOffline && load(1)}
              className="lg:max-w-md"
              disabled={showOffline && !cacheRef.current}
            />
            <Button onClick={() => load(1)} disabled={loading || showOffline}>
              {loading ? "Searching…" : "Search"}
            </Button>
            <div className="flex gap-1 border border-[#252A33] lg:ml-auto">
              <button
                type="button"
                aria-label="List view"
                onClick={() => setView("list")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center transition",
                  view === "list"
                    ? "bg-[#00E575] text-[#041412]"
                    : "text-[#A7ADB8] hover:text-[#F5F7FA]"
                )}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setView("grid")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center transition",
                  view === "grid"
                    ? "bg-[#00E575] text-[#041412]"
                    : "text-[#A7ADB8] hover:text-[#F5F7FA]"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={showOffline && !cacheRef.current}
            >
              <option value="">All regions</option>
              {REGION_LIST.map((r: any) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
            </Select>

            <Select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setState("");
              }}
              disabled={showOffline && !cacheRef.current}
            >
              <option value="">All countries</option>
              {FULFILLMENT_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>

            <Select
              value={state}
              onChange={(e) => setState(e.target.value)}
              disabled={!country || (showOffline && !cacheRef.current)}
            >
              <option value="">
                {country ? "All states" : "Pick a country first"}
              </option>
              {states.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>

            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              disabled={showOffline && !cacheRef.current}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="lastSeen">Last seen</option>
              <option value="name">Name A–Z</option>
            </Select>

            <Select
              value={spot}
              onChange={(e) => setSpot(e.target.value)}
              disabled={showOffline && !cacheRef.current}
            >
              <option value="">All accounts</option>
              <option value="active">Active (24h)</option>
              <option value="unverified">Unverified sellers</option>
              <option value="suspended">Suspended sellers</option>
              <option value="new">Joined last 7 days</option>
              <option value="dormant">Dormant (30d+)</option>
              <option value="no-region">Missing region</option>
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
          <OrbLoader label="Loading accounts" />
        </div>
      ) : items.length === 0 && !deepUserId ? (
        <EmptyState
          title="No users found"
          body={
            showOffline
              ? "Connect to the internet to load accounts."
              : "Try another search, region, or clear filters."
          }
        />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((row) => {
            const act = activityState(row.lastSeenAt);
            return (
              <button
                key={row._id}
                type="button"
                onClick={() => openPane(row._id)}
                className={cn(
                  "border border-[#252A33] bg-[#11141A] p-4 text-left transition hover:border-[#00E575]/35",
                  openId === row._id &&
                    paneOpen &&
                    "border-[#00E575]/45 bg-[#00E575]/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={row.name} image={row.image} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name || "—"}</p>
                    <p className="truncate text-xs text-[#737A86]">
                      {row.email}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge
                    tone={
                      row.role === "seller"
                        ? "green"
                        : row.role === "admin"
                          ? "blue"
                          : "neutral"
                    }
                  >
                    {row.role}
                  </Badge>
                  <Badge tone="neutral">
                    {row.marketplaceRegion || "No region"}
                  </Badge>
                  <Badge tone={act.tone}>{act.label}</Badge>
                  {row.isSellerSuspended && (
                    <Badge tone="error">Suspended</Badge>
                  )}
                </div>
                <p className="mt-3 text-[11px] text-[#737A86]">
                  Last seen {fmtDate(row.lastSeenAt)}
                  {row.lastSeenPlatform ? ` · ${row.lastSeenPlatform}` : ""}
                </p>
              </button>
            );
          })}
        </div>
      ) : items.length > 0 ? (
        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-[#252A33] text-[11px] uppercase tracking-[0.12em] text-[#737A86]">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Region</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Activity</th>
                <th className="px-4 py-3 font-semibold">Last seen</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const act = activityState(row.lastSeenAt);
                const loc = [
                  row.shippingDefaults?.address?.state,
                  row.shippingDefaults?.address?.country,
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <tr
                    key={row._id}
                    onClick={() => openPane(row._id)}
                    className={cn(
                      "cursor-pointer border-b border-[#252A33]/70 transition-colors hover:bg-[#171B22]/80",
                      openId === row._id &&
                        paneOpen &&
                        "bg-[#00E575]/[0.06]"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.name} image={row.image} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {row.name || "—"}
                          </p>
                          <p className="truncate text-xs text-[#737A86]">
                            {row.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          row.role === "seller"
                            ? "green"
                            : row.role === "admin"
                              ? "blue"
                              : "neutral"
                        }
                      >
                        {row.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[#A7ADB8]">
                      {row.marketplaceRegion || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#A7ADB8]">{loc || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={act.tone}>{act.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#A7ADB8]">
                      {fmtDate(row.lastSeenAt)}
                      {row.lastSeenPlatform
                        ? ` · ${row.lastSeenPlatform}`
                        : ""}
                    </td>
                    <td className="px-4 py-3 text-[#A7ADB8]">
                      {row.createdAt
                        ? new Date(row.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      ) : null}

      {pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            tone="ghost"
            disabled={page <= 1 || loading || showOffline}
            onClick={() => load(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-[#737A86]">
            Page {page} of {pages}
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

      {health && (
        <div
          className={cn(
            "fixed bottom-4 right-4 z-30 max-w-[min(100vw-2rem,280px)] border px-3 py-2.5 shadow-2xl backdrop-blur-md",
            health.tone === "green" &&
              "border-[#00E575]/30 bg-[#041412]/95 text-[#00E575]",
            health.tone === "warn" &&
              "border-amber-500/30 bg-[#1a1408]/95 text-amber-200",
            health.tone === "error" &&
              "border-red-500/30 bg-[#1a0c0c]/95 text-red-200"
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">
            Platform activity
          </p>
          <p className="mt-0.5 text-sm font-semibold">
            {health.label} · {health.score}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed opacity-80">
            {health.active24h} active · {health.quiet7d} quiet ·{" "}
            {health.dormant} dormant · {health.total} accounts
          </p>
        </div>
      )}

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

      <aside
        className={cn(
          poppins.className,
          "fixed top-0 right-0 z-50 flex h-full w-full max-w-[440px] flex-col border-l border-[#252A33] bg-[#0C0F14] shadow-2xl transition-transform duration-300 ease-out",
          paneOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#252A33] px-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00E575]">
              Account
            </p>
            <p className="text-sm font-medium">Profile detail</p>
          </div>
          <button
            type="button"
            onClick={closePane}
            className="flex h-9 w-9 items-center justify-center border border-[#252A33] bg-[#171B22] text-[#A7ADB8] transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {detailLoading && !detail && <OrbLoader label="Loading profile" />}
          {detail && u && (
            <div className="space-y-6">
              <div className="flex gap-3">
                <Avatar name={u.name} image={u.image} size="lg" />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">
                    {u.name || "—"}
                  </h2>
                  <p className="truncate text-sm text-[#A7ADB8]">{u.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge
                      tone={
                        u.role === "seller"
                          ? "green"
                          : u.role === "admin"
                            ? "blue"
                            : "neutral"
                      }
                    >
                      {u.role}
                    </Badge>
                    <Badge tone="neutral">
                      {u.marketplaceRegion || "No region"}
                    </Badge>
                    <Badge tone={activityState(lastSeen).tone}>
                      {activityState(lastSeen).label}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="border border-[#252A33] bg-[#11141A] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                    Last seen
                  </p>
                  <p className="mt-1 text-sm">{fmtDate(lastSeen)}</p>
                  <p className="mt-1 text-[11px] text-[#737A86]">
                    {u.lastSeenPlatform === "app"
                      ? "Mobile app"
                      : u.lastSeenPlatform === "web"
                        ? "Web"
                        : "Profile activity"}
                  </p>
                </div>
                <div className="border border-[#252A33] bg-[#11141A] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                    Joined
                  </p>
                  <p className="mt-1 text-sm">{fmtDate(u.createdAt)}</p>
                </div>
                <div className="border border-[#252A33] bg-[#11141A] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                    Buyer orders
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {detail.stats.orderCountAsBuyer}
                  </p>
                </div>
                <div className="border border-[#252A33] bg-[#11141A] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                    Seller orders
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {detail.stats.orderCountAsSeller}
                  </p>
                </div>
              </div>

              <div className="space-y-3 border-t border-[#252A33] pt-4">
                <SectionLabel>Identity</SectionLabel>
                <Field label="Phone">{u.phone || "—"}</Field>
                <Field label="User ID">
                  <span className="font-mono text-[11px] text-[#A7ADB8]">
                    {u._id}
                  </span>
                </Field>
                <Field label="Clerk ID">
                  <span className="font-mono text-[11px] text-[#A7ADB8]">
                    {u.clerkId || "—"}
                  </span>
                </Field>
                <Field label="Updated">{fmtDate(u.updatedAt)}</Field>
              </div>

              <div className="space-y-3 border-t border-[#252A33] pt-4">
                <SectionLabel>Address</SectionLabel>
                <Field label="Country">
                  {u.shippingDefaults?.address?.country || "—"}
                </Field>
                <Field label="State">
                  {u.shippingDefaults?.address?.state || "—"}
                </Field>
                <Field label="City">
                  {u.shippingDefaults?.address?.city || "—"}
                </Field>
                <Field label="Street">
                  {u.shippingDefaults?.address?.street || "—"}
                </Field>
              </div>

              {u.role === "seller" && (
                <div className="space-y-3 border-t border-[#252A33] pt-4">
                  <SectionLabel>Storefront</SectionLabel>
                  <Field label="Store">{u.storeName || "—"}</Field>
                  <Field label="Goal">{u.businessGoal || "—"}</Field>
                  <Field label="Description">
                    {u.storeDescription || "—"}
                  </Field>
                  <Field label="Bank">{u.payout?.bankName || "—"}</Field>
                  <Field label="Account name">
                    {u.payout?.accountName || "—"}
                  </Field>
                </div>
              )}

              {(detail.recentOrdersAsBuyer?.length || 0) > 0 && (
                <div className="space-y-2 border-t border-[#252A33] pt-4">
                  <SectionLabel>Recent buyer orders</SectionLabel>
                  {detail.recentOrdersAsBuyer!.slice(0, 6).map((o: any) => (
                    <p
                      key={o._id}
                      className="border border-[#252A33] bg-[#11141A] px-3 py-2 text-xs"
                    >
                      {o.orderNumber} · {o.orderStatus} ·{" "}
                      {Number(o.totalAmount || 0).toLocaleString()}
                    </p>
                  ))}
                </div>
              )}

              {(detail.recentOrdersAsSeller?.length || 0) > 0 && (
                <div className="space-y-2 border-t border-[#252A33] pt-4">
                  <SectionLabel>Recent seller orders</SectionLabel>
                  {detail.recentOrdersAsSeller!.slice(0, 6).map((o: any) => (
                    <p
                      key={o._id}
                      className="border border-[#252A33] bg-[#11141A] px-3 py-2 text-xs"
                    >
                      {o.orderNumber} · {o.orderStatus} ·{" "}
                      {Number(o.totalAmount || 0).toLocaleString()}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2 border-t border-[#252A33] pt-4">
                <Link
                  href={`/moderation?userId=${u._id}`}
                  className="inline-flex h-10 items-center justify-center bg-[#00E575] px-4 text-sm font-semibold text-[#041412] transition hover:brightness-105"
                >
                  Open in Moderation
                </Link>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}