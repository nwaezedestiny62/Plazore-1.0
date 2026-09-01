"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
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

type ProductRow = {
  _id: string;
  name: string;
  price: number;
  images?: string[];
  category?: string;
  subCategory?: string;
  brand?: string;
  stock?: number;
  isActive?: boolean;
  region?: string;
  createdAt?: string;
  updatedAt?: string;
  fulfillmentLocation?: {
    city?: string;
    state?: string;
    country?: string;
    countryCode?: string;
    displayLabel?: string;
  };
  seller?: {
    _id?: string;
    name?: string;
    storeName?: string;
    email?: string;
    marketplaceRegion?: string;
    isSellerSuspended?: boolean;
  };
};

const REGION_CITIES: Record<string, string[]> = {
  NG: ["Lagos", "Lekki", "Ikeja", "Abuja", "Port Harcourt", "Ibadan", "Kano"],
  GH: ["Accra", "Kumasi"],
  KE: ["Nairobi", "Mombasa"],
  ZA: ["Johannesburg", "Cape Town"],
  GB: ["London", "Manchester"],
  US: ["New York", "Houston"],
  CA: ["Toronto"],
  EU: ["Berlin", "Paris"],
};

function locLabel(p: ProductRow) {
  return (
    p.fulfillmentLocation?.displayLabel ||
    [p.fulfillmentLocation?.city, p.fulfillmentLocation?.state, p.region]
      .filter(Boolean)
      .join(", ") ||
    p.region ||
    "—"
  );
}

export default function ProductsPage() {
  const { getToken } = useAuth();
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [items, setItems] = useState<ProductRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const cityOptions = useMemo(
    () => (region ? REGION_CITIES[region] || [] : Object.values(REGION_CITIES).flat()),
    [region]
  );

  const selected = items.find((p) => p._id === openId) || null;

  const load = async (p = 1) => {
    try {
      setLoading(true);
      setError("");
      const token = await getToken();
      const params = new URLSearchParams({
        page: String(p),
        limit: "20",
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(active ? { active } : {}),
        ...(region ? { region } : {}),
        ...(city ? { city } : {}),
      });
      const json = await adminFetch<any>(`/admin/products?${params}`, token);
      setItems(json.data || []);
      setPages(json.pagination?.pages || 1);
      setTotal(json.pagination?.total || 0);
      setPage(json.pagination?.page || p);
    } catch (e: any) {
      setError(e.message || "Failed to load products");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, region, city]);

  const toggleRow = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  const toggleActive = async (product: ProductRow) => {
    try {
      setBusyId(product._id);
      const token = await getToken();
      await adminFetch(`/admin/products/${product._id}/active`, token, {
        method: "PATCH",
        body: JSON.stringify({ active: !product.isActive }),
      });
      await load(page);
    } catch (e: any) {
      setError(e.message || "Update failed");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description="Catalog database — product, seller, region, city, stock, availability."
        meta={`${total.toLocaleString()} products`}
      />

      <Panel className="mb-4 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <Input
            placeholder="Search name, brand, category…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            className="lg:max-w-xs"
          />
          <Select value={active} onChange={(e) => setActive(e.target.value)} className="lg:w-36">
            <option value="">All status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
          <Select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setCity("");
            }}
            className="lg:w-36"
          >
            <option value="">All regions</option>
            {Object.keys(REGION_CITIES).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Select value={city} onChange={(e) => setCity(e.target.value)} className="lg:w-44">
            <option value="">All locations</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Button onClick={() => load(1)}>Search</Button>
        </div>
      </Panel>

      {loading && <LoadingBlock label="Loading catalog…" />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState title="No products found" body="Clear filters or wait for listings." />
      )}

      {!loading && items.length > 0 && (
        <>
          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-[#252A33] text-[11px] uppercase tracking-[0.12em] text-[#737A86]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Seller</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Stock</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const sellerQ = encodeURIComponent(
                    p.seller?.storeName || p.seller?.email || p.seller?.name || ""
                  );
                  const isOpen = openId === p._id;
                  return (
                    <tr
                      key={p._id}
                      onClick={() => toggleRow(p._id)}
                      className={`cursor-pointer border-b border-[#252A33]/80 hover:bg-[#171B22]/60 ${
                        isOpen ? "bg-[#00E575]/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden border border-[#252A33] bg-[#171B22]">
                            {p.images?.[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div>
                            <p className="font-medium text-[#F5F7FA]">{p.name}</p>
                            <p className="text-[11px] text-[#737A86]">
                              {p.category}
                              {p.subCategory ? ` · ${p.subCategory}` : ""}
                              {p.brand ? ` · ${p.brand}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[#F5F7FA]">
                          {p.seller?.storeName || p.seller?.name || "—"}
                        </p>
                        <p className="text-[11px] text-[#737A86]">{p.seller?.email}</p>
                      </td>
                      <td className="px-4 py-3 text-[#A7ADB8]">
                        <p>{locLabel(p)}</p>
                        <p className="text-[11px] text-[#737A86]">Region {p.region || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={p.isActive ? "green" : "error"}>
                          {p.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <Badge tone={(p.stock ?? 0) > 0 ? "green" : "warn"}>
                          {p.stock ?? 0}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums">
                        {Number(p.price || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/users?role=seller&q=${sellerQ}`}
                            className="inline-flex h-8 items-center border border-[#252A33] bg-[#171B22] px-2 text-[11px] text-[#A7ADB8] hover:text-[#00E575]"
                          >
                            Seller
                          </Link>
                          <Button
                            tone={p.isActive ? "danger" : "primary"}
                            className="h-8 px-2 text-[11px]"
                            disabled={busyId === p._id}
                            onClick={() => toggleActive(p)}
                          >
                            {p.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>

          {/* Detail panel BELOW the table — toggle by tapping row */}
          {selected && (
            <Panel className="mt-3 p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden border border-[#252A33] bg-[#171B22]">
                    {selected.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selected.images[0]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#737A86]">
                      Product detail
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-[#F5F7FA]">{selected.name}</h2>
                    <p className="mt-1 text-sm text-[#A7ADB8]">
                      {selected.category}
                      {selected.subCategory ? ` · ${selected.subCategory}` : ""}
                      {selected.brand ? ` · ${selected.brand}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone={selected.isActive ? "green" : "error"}>
                        {selected.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge tone="neutral">Region {selected.region || "—"}</Badge>
                      <Badge tone={(selected.stock ?? 0) > 0 ? "green" : "warn"}>
                        Stock {selected.stock ?? 0}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button tone="ghost" className="h-8 text-xs" onClick={() => setOpenId(null)}>
                  Close
                </Button>
              </div>

              <div className="mt-5 grid gap-4 border-t border-[#252A33] pt-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">Seller</p>
                  <p className="mt-1 text-sm font-medium">
                    {selected.seller?.storeName || selected.seller?.name || "—"}
                  </p>
                  <p className="text-xs text-[#737A86]">{selected.seller?.email}</p>
                  {selected.seller?.isSellerSuspended ? (
                    <div className="mt-1">
                      <Badge tone="error">Seller suspended</Badge>
                    </div>
                  ) : null}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">
                    Fulfillment location
                  </p>
                  <p className="mt-1 text-sm text-[#A7ADB8]">{locLabel(selected)}</p>
                  <p className="text-xs text-[#737A86]">
                    {[
                      selected.fulfillmentLocation?.city,
                      selected.fulfillmentLocation?.state,
                      selected.fulfillmentLocation?.country,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">Price</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-[#F5F7FA]">
                    {Number(selected.price || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#252A33] pt-4">
                <Link
                  href={`/users?role=seller&q=${encodeURIComponent(
                    selected.seller?.storeName || selected.seller?.email || ""
                  )}`}
                  className="inline-flex h-9 items-center border border-[#252A33] bg-[#171B22] px-3 text-xs text-[#A7ADB8] hover:text-[#00E575]"
                >
                  Open seller
                </Link>
                <Button
                  tone={selected.isActive ? "danger" : "primary"}
                  className="h-9 text-xs"
                  disabled={busyId === selected._id}
                  onClick={() => toggleActive(selected)}
                >
                  {selected.isActive ? "Deactivate product" : "Activate product"}
                </Button>
              </div>

              <p className="mt-4 text-[11px] text-[#737A86]">
                ID {String(selected._id)}
                {selected.createdAt
                  ? ` · Listed ${new Date(selected.createdAt).toLocaleDateString()}`
                  : ""}
                {selected.updatedAt
                  ? ` · Updated ${new Date(selected.updatedAt).toLocaleDateString()}`
                  : ""}
              </p>
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