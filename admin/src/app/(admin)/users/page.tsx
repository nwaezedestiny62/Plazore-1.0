"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Input,
  LoadingBlock,
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
  marketplaceRegion?: string;
  storeName?: string;
  storeDescription?: string;
  isSellerVerified?: boolean;
  isSellerSuspended?: boolean;
  createdAt?: string;
  updatedAt?: string;
  productStats?: { total: number; active: number };
  shippingDefaults?: {
    address?: {
      city?: string;
      state?: string;
      country?: string;
    };
  };
};

type UserDetail = {
  user: UserRow;
  products: Array<{
    _id: string;
    name: string;
    price: number;
    images?: string[];
    isActive?: boolean;
    region?: string;
    stock?: number;
  }>;
  stats: { orderCount: number; productCount: number };
};

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
  const [busyId, setBusyId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async (p = 1) => {
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
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, region]);

  const toggleRow = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    try {
      setDetailLoading(true);
      const token = await getToken();
      const json = await adminFetch<{ data: UserDetail }>(`/admin/users/${id}`, token);
      setDetail(json.data);
    } catch (e: any) {
      // still show list row data if detail fails
      const row = items.find((u) => u._id === id);
      if (row) {
        setDetail({
          user: row,
          products: [],
          stats: { orderCount: 0, productCount: row.productStats?.total || 0 },
        });
      }
      setError(e.message || "Could not load account detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleSuspend = async (user: UserRow) => {
    try {
      setBusyId(user._id);
      const token = await getToken();
      await adminFetch(`/admin/sellers/${user._id}/suspend`, token, {
        method: "PATCH",
        body: JSON.stringify({ suspended: !user.isSellerSuspended }),
      });
      await load(page);
      if (openId === user._id) {
        await toggleRow(user._id);
        await toggleRow(user._id);
      }
    } catch (e: any) {
      setError(e.message || "Action failed");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div>
      <PageHeader
        title="Users & Sellers"
        description="Account database — role, region, storefront, catalog counts, suspend controls."
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
          <Select value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-40">
            <option value="">All roles</option>
            <option value="buyer">Buyers</option>
            <option value="seller">Sellers</option>
            <option value="admin">Admins</option>
          </Select>
          <Select value={region} onChange={(e) => setRegion(e.target.value)} className="sm:w-36">
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

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState title="No users found" body="Try another search or role filter." />
      )}

      {!loading && items.length > 0 && (
        <>
          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-[#252A33] text-[11px] uppercase tracking-[0.12em] text-[#737A86]">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Region</th>
                  <th className="px-4 py-3 font-semibold">Store / products</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => {
                  const isOpen = openId === u._id;
                  return (
                    <tr
                      key={u._id}
                      onClick={() => toggleRow(u._id)}
                      className={`cursor-pointer border-b border-[#252A33]/80 hover:bg-[#171B22]/60 ${
                        isOpen ? "bg-[#00E575]/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#F5F7FA]">{u.name || "—"}</p>
                        <p className="text-xs text-[#737A86]">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
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
                      </td>
                      <td className="px-4 py-3 text-[#A7ADB8]">
                        {u.marketplaceRegion || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {u.role === "seller" ? (
                          <>
                            <p className="text-[#F5F7FA]">{u.storeName || "Untitled store"}</p>
                            <p className="text-xs text-[#737A86]">
                              {u.productStats?.active ?? 0} active /{" "}
                              {u.productStats?.total ?? 0} total
                            </p>
                          </>
                        ) : (
                          <span className="text-[#737A86]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.role === "seller" ? (
                          u.isSellerSuspended ? (
                            <Badge tone="error">Suspended</Badge>
                          ) : u.isSellerVerified ? (
                            <Badge tone="green">Verified</Badge>
                          ) : (
                            <Badge tone="warn">Unverified</Badge>
                          )
                        ) : (
                          <Badge tone="neutral">Active</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#A7ADB8]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {u.role === "seller" ? (
                          <Button
                            tone={u.isSellerSuspended ? "primary" : "danger"}
                            disabled={busyId === u._id}
                            onClick={() => toggleSuspend(u)}
                            className="h-8 px-3 text-xs"
                          >
                            {u.isSellerSuspended ? "Reactivate" : "Suspend"}
                          </Button>
                        ) : (
                          <span className="text-[#737A86]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>

          {/* Detail panel BELOW list */}
          {openId && (
            <Panel className="mt-3 p-4 md:p-5">
              {detailLoading && (
                <p className="text-sm text-[#737A86]">Loading account detail…</p>
              )}
              {!detailLoading && detail && (
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#737A86]">
                        Account detail
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-[#F5F7FA]">
                        {detail.user.name || "—"}
                      </h2>
                      <p className="text-sm text-[#A7ADB8]">{detail.user.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge
                          tone={
                            detail.user.role === "seller"
                              ? "green"
                              : detail.user.role === "admin"
                                ? "blue"
                                : "neutral"
                          }
                        >
                          {detail.user.role}
                        </Badge>
                        <Badge tone="neutral">
                          {detail.user.marketplaceRegion || "—"}
                        </Badge>
                        {detail.user.role === "seller" ? (
                          detail.user.isSellerSuspended ? (
                            <Badge tone="error">Suspended</Badge>
                          ) : detail.user.isSellerVerified ? (
                            <Badge tone="green">Verified</Badge>
                          ) : (
                            <Badge tone="warn">Unverified</Badge>
                          )
                        ) : null}
                      </div>
                    </div>
                    <Button tone="ghost" className="h-8 text-xs" onClick={() => {
                      setOpenId(null);
                      setDetail(null);
                    }}>
                      Close
                    </Button>
                  </div>

                  <div className="mt-5 grid gap-4 border-t border-[#252A33] pt-4 sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                        Contact
                      </p>
                      <p className="mt-1 text-sm text-[#A7ADB8]">
                        {detail.user.phone || "No phone"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                        Orders linked
                      </p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">
                        {detail.stats.orderCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                        Products listed
                      </p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">
                        {detail.stats.productCount}
                      </p>
                    </div>
                  </div>

                  {detail.user.role === "seller" && (
                    <div className="mt-4 border-t border-[#252A33] pt-4">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                        Storefront
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {detail.user.storeName || "Untitled store"}
                      </p>
                      {detail.user.storeDescription ? (
                        <p className="mt-1 text-sm text-[#A7ADB8]">
                          {detail.user.storeDescription}
                        </p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          tone={detail.user.isSellerSuspended ? "primary" : "danger"}
                          className="h-9 text-xs"
                          disabled={busyId === detail.user._id}
                          onClick={() => toggleSuspend(detail.user)}
                        >
                          {detail.user.isSellerSuspended
                            ? "Reactivate seller"
                            : "Suspend seller"}
                        </Button>
                        <Link
                          href={`/products?q=${encodeURIComponent(
                            detail.user.storeName || detail.user.name || ""
                          )}`}
                          className="inline-flex h-9 items-center border border-[#252A33] bg-[#171B22] px-3 text-xs text-[#A7ADB8] hover:text-[#00E575]"
                        >
                          View products
                        </Link>
                      </div>

                      {detail.products?.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                            Recent products
                          </p>
                          {detail.products.slice(0, 8).map((p) => (
                            <div
                              key={p._id}
                              className="flex items-center justify-between gap-3 border border-[#252A33] bg-[#171B22] px-3 py-2 text-sm"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">{p.name}</p>
                                <p className="text-[11px] text-[#737A86]">
                                  {p.region || "—"} · stock {p.stock ?? 0}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge tone={p.isActive ? "green" : "error"}>
                                  {p.isActive ? "Live" : "Off"}
                                </Badge>
                                <span className="tabular-nums text-[#F5F7FA]">
                                  {Number(p.price || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="mt-4 text-[11px] text-[#737A86]">
                    ID {detail.user._id}
                    {detail.user.createdAt
                      ? ` · Joined ${new Date(detail.user.createdAt).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
              )}
            </Panel>
          )}
        </>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center gap-2">
          <Button tone="ghost" disabled={page <= 1} onClick={() => load(page - 1)}>
            Previous
          </Button>
          <span className="text-xs text-[#737A86]">
            Page {page} of {pages}
          </span>
          <Button tone="ghost" disabled={page >= pages} onClick={() => load(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}