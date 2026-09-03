"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Input,
  PageHeader,
  Panel,
  Select,
} from "@/components/ui";

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
  payout?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
  };
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
  recentOrdersAsBuyer?: Array<{
    _id: string;
    orderNumber?: string;
    orderStatus?: string;
    totalAmount?: number;
    createdAt?: string;
    seller?: { name?: string; storeName?: string };
  }>;
  recentOrdersAsSeller?: Array<{
    _id: string;
    orderNumber?: string;
    orderStatus?: string;
    totalAmount?: number;
    createdAt?: string;
    buyer?: { name?: string; email?: string };
  }>;
};

function fmtDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
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
      <div className="mt-1 break-words text-sm text-[#F5F7FA]">{children ?? "—"}</div>
    </div>
  );
}

export default function UsersPage() {
  const { getToken } = useAuth();
  const [role, setRole] = useState("");
  const [region, setRegion] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<UserRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paneOpen, setPaneOpen] = useState(false);

  const load = useCallback(
    async (p = 1) => {
      try {
        setLoading(true);
        setError("");
        const token = await getToken();
        const params = new URLSearchParams({
          page: String(p),
          limit: "20",
          ...(role ? { role } : {}),
          ...(region ? { region } : {}),
          ...(q.trim() ? { q: q.trim() } : {}),
        });
        const json = await adminFetch<any>(`/admin/users?${params}`, token);
        setItems(json.data || []);
        setPages(json.pagination?.pages || 1);
        setTotal(json.pagination?.total || 0);
        setPage(json.pagination?.page || p);
      } catch (e: any) {
        setError(e.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    },
    [getToken, role, region, q]
  );

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        setDetailLoading(true);
        const token = await getToken();
        const json = await adminFetch<{ data: UserDetail }>(
          `/admin/users/${id}`,
          token
        );
        setDetail(json.data);
        setItems((prev) =>
          prev.map((u) =>
            u._id === id
              ? {
                  ...u,
                  ...json.data.user,
                  productStats: {
                    total: json.data.stats.productCount,
                    active: json.data.stats.activeProductCount,
                  },
                }
              : u
          )
        );
      } catch (e: any) {
        setError(e.message || "Could not load account detail");
      } finally {
        setDetailLoading(false);
      }
    },
    [getToken]
  );

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, region]);

  const openPane = async (id: string) => {
    setOpenId(id);
    setDetail(null);
    setPaneOpen(true);
    await loadDetail(id);
  };

  const closePane = () => {
    setPaneOpen(false);
    // wait for slide-out then clear
    window.setTimeout(() => {
      setOpenId(null);
      setDetail(null);
    }, 280);
  };

  const u = detail?.user;

  return (
    <div className="relative">
      <PageHeader
        title="Users & Sellers"
        description="Account directory — profiles, storefronts, and activity. Enforcement lives in Moderation."
        meta={`${total.toLocaleString()} accounts`}
      />

      <Panel className="mb-4 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Input
            placeholder="Search name, email, store, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            className="sm:max-w-xs"
          />
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="sm:w-40"
          >
            <option value="">All roles</option>
            <option value="buyer">Buyers</option>
            <option value="seller">Sellers</option>
            <option value="admin">Admins</option>
          </Select>
          <Select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="sm:w-36"
          >
            <option value="">All regions</option>
            {["NG", "GH", "KE", "ZA", "GB", "US", "CA", "EU"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Button onClick={() => load(1)}>Search</Button>
        </div>
      </Panel>

      {error && (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      )}

      {loading ? (
        <OrbLoader label="Loading accounts" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No users found"
          body="Try another search or role filter."
        />
      ) : (
        <>
          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-[#252A33] text-[11px] uppercase tracking-[0.12em] text-[#737A86]">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Region</th>
                  <th className="px-4 py-3 font-semibold">Store / products</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const active = openId === row._id && paneOpen;
                  return (
                    <tr
                      key={row._id}
                      onClick={() => openPane(row._id)}
                      className={`cursor-pointer border-b border-[#252A33]/70 transition-colors hover:bg-[#171B22]/70 ${
                        active ? "bg-[#00E575]/[0.06]" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {row.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.image}
                              alt=""
                              className="h-8 w-8 rounded-full border border-[#252A33] object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#252A33] bg-[#171B22] text-[11px] font-semibold text-[#737A86]">
                              {(row.name || "?").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#F5F7FA]">
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
                      <td className="px-4 py-3">
                        {row.role === "seller" ? (
                          <>
                            <p className="text-[#F5F7FA]">
                              {row.storeName || "Untitled store"}
                            </p>
                            <p className="text-xs text-[#737A86]">
                              {row.productStats?.active ?? 0} active /{" "}
                              {row.productStats?.total ?? 0} total
                            </p>
                          </>
                        ) : (
                          <span className="text-[#737A86]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.role === "seller" ? (
                          row.isSellerSuspended ? (
                            <Badge tone="error">Suspended</Badge>
                          ) : row.isSellerVerified ? (
                            <Badge tone="green">Verified</Badge>
                          ) : (
                            <Badge tone="warn">Unverified</Badge>
                          )
                        ) : (
                          <Badge tone="neutral">Active</Badge>
                        )}
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

          {pages > 1 && (
            <div className="mt-4 flex items-center gap-2">
              <Button
                tone="ghost"
                disabled={page <= 1}
                onClick={() => load(page - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-[#737A86]">
                Page {page} of {pages}
              </span>
              <Button
                tone="ghost"
                disabled={page >= pages}
                onClick={() => load(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Dim — list stays readable; pane is the focus */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          paneOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={closePane}
        aria-hidden
      />

      {/* Right detail pane — does not replace the list */}
      <aside
        className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-[420px] flex-col border-l border-[#252A33] bg-[#0C0F14] shadow-2xl transition-transform duration-300 ease-out md:max-w-[440px] ${
          paneOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#252A33] px-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00E575]">
              Account
            </p>
            <p className="text-sm font-medium text-[#F5F7FA]">Profile detail</p>
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
                {u.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={u.image}
                    alt=""
                    className="h-14 w-14 rounded-full border border-[#252A33] object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#252A33] bg-[#171B22] text-lg font-semibold text-[#737A86]">
                    {(u.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-[#F5F7FA]">
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
                    <Badge tone="neutral">{u.marketplaceRegion || "—"}</Badge>
                    {u.role === "seller" &&
                      (u.isSellerSuspended ? (
                        <Badge tone="error">Suspended</Badge>
                      ) : u.isSellerVerified ? (
                        <Badge tone="green">Verified</Badge>
                      ) : (
                        <Badge tone="warn">Unverified</Badge>
                      ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                <div className="border border-[#252A33] bg-[#11141A] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                    Products
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {detail.stats.activeProductCount}/{detail.stats.productCount}
                  </p>
                </div>
                <div className="border border-[#252A33] bg-[#11141A] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                    GMV paid
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {Number(detail.stats.gmv || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-3 border-t border-[#252A33] pt-4">
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
                <Field label="Joined">{fmtDate(u.createdAt)}</Field>
                <Field label="Updated">{fmtDate(u.updatedAt)}</Field>
              </div>

              {u.role === "seller" && (
                <div className="space-y-3 border-t border-[#252A33] pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
                    Storefront
                  </p>
                  <Field label="Store">{u.storeName || "—"}</Field>
                  <Field label="Goal">{u.businessGoal || "—"}</Field>
                  <Field label="Description">
                    {u.storeDescription || "—"}
                  </Field>
                  {(u.storeLogo || u.storeBanner) && (
                    <div className="flex gap-3">
                      {u.storeLogo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.storeLogo}
                          alt=""
                          className="h-12 w-12 rounded border border-[#252A33] object-cover"
                        />
                      )}
                      {u.storeBanner && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.storeBanner}
                          alt=""
                          className="h-12 max-w-[140px] rounded border border-[#252A33] object-cover"
                        />
                      )}
                    </div>
                  )}
                  <div className="space-y-2 pt-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
                      Payout
                    </p>
                    <Field label="Bank">{u.payout?.bankName || "—"}</Field>
                    <Field label="Account name">
                      {u.payout?.accountName || "—"}
                    </Field>
                    <Field label="Account number">
                      {u.payout?.accountNumber || "—"}
                    </Field>
                  </div>
                </div>
              )}

              <div className="space-y-2 border-t border-[#252A33] pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
                  Shipping defaults
                </p>
                <Field label="Street">
                  {u.shippingDefaults?.address?.street || "—"}
                </Field>
                <Field label="City">
                  {u.shippingDefaults?.address?.city || "—"}
                </Field>
                <Field label="State / country">
                  {[
                    u.shippingDefaults?.address?.state,
                    u.shippingDefaults?.address?.country,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </Field>
                <Field label="Method">
                  {u.shippingDefaults?.deliveryMethod || "—"}
                  {u.shippingDefaults?.courierCompany
                    ? ` · ${u.shippingDefaults.courierCompany}`
                    : ""}
                </Field>
              </div>

              {detail.products?.length > 0 && (
                <div className="space-y-2 border-t border-[#252A33] pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
                    Recent products
                  </p>
                  {detail.products.slice(0, 6).map((p) => (
                    <div
                      key={p._id}
                      className="flex items-center justify-between gap-2 border border-[#252A33] bg-[#11141A] px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[#F5F7FA]">
                          {p.name}
                        </p>
                        <p className="text-[#737A86]">
                          {p.region || "—"} · stock {p.stock ?? 0}
                        </p>
                      </div>
                      <Badge tone={p.isActive ? "green" : "error"}>
                        {p.isActive ? "Live" : "Off"}
                      </Badge>
                    </div>
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
                {u.role === "seller" && (
                  <Link
                    href={`/products?seller=${u._id}`}
                    className="inline-flex h-10 items-center justify-center border border-[#252A33] bg-[#171B22] px-4 text-sm text-[#A7ADB8] transition hover:text-[#00E575]"
                  >
                    View products
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}