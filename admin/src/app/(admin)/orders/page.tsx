"use client";

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

type OrderRow = {
  _id: string;
  orderNumber?: string;
  orderStatus?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  totalAmount?: number;
  subtotal?: number;
  shippingCost?: number;
  createdAt?: string;
  deliveredAt?: string;
  buyer?: { _id?: string; name?: string; email?: string; phone?: string; marketplaceRegion?: string };
  seller?: { _id?: string; name?: string; storeName?: string; email?: string; marketplaceRegion?: string };
  buyerContact?: { name?: string; phone?: string };
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  items?: Array<{
    name?: string;
    quantity?: number;
    price?: number;
    image?: string;
  }>;
  shipping?: {
    shippingMethod?: string;
    deliveryCompany?: string;
    trackingNumber?: string;
  };
  cancellation?: {
    cancelledBy?: string;
    reasonLabel?: string;
    note?: string;
  };
};

/** Always show Plazore order code: PLZ#48291 */
function formatPlz(order: OrderRow) {
  const raw = (order.orderNumber || "").trim();
  if (raw) {
    // stored as PLZ#12345 already
    if (raw.toUpperCase().startsWith("PLZ#")) return raw.toUpperCase();
    if (raw.toUpperCase().startsWith("PLZ")) return raw.replace(/^PLZ/i, "PLZ#");
    return `PLZ#${raw.replace(/^#/, "")}`;
  }
  // fallback from mongo id (should rarely happen)
  return `PLZ#${String(order._id).slice(-5).toUpperCase()}`;
}

export default function OrdersPage() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async (p = 1) => {
    try {
      setLoading(true);
      setError("");
      const token = await getToken();
      const params = new URLSearchParams({
        page: String(p),
        limit: "20",
        ...(status ? { status } : {}),
        ...(payment ? { payment } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
      });
      const json = await adminFetch<{
        data: OrderRow[];
        pagination: { page: number; pages: number; total: number };
      }>(`/admin/orders?${params}`, token);
      setItems(json.data || []);
      setPage(json.pagination?.page || p);
      setPages(json.pagination?.pages || 1);
      setTotal(json.pagination?.total || 0);
    } catch (e: any) {
      setError(e.message || "Failed to load orders");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, payment]);

  const openDetail = async (row: OrderRow) => {
    setSelected(row);
    try {
      setDetailLoading(true);
      const token = await getToken();
      const json = await adminFetch<{ data: OrderRow }>(`/admin/orders/${row._id}`, token);
      setSelected(json.data);
    } catch {
      // list row still usable if detail fails
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Commerce database — PLZ# codes, buyer, seller, ship-to city, payment, and fulfillment."
        meta={`${total.toLocaleString()} orders`}
      />

      <Panel className="mb-4 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <Input
            placeholder="Search PLZ#48291, buyer, seller, city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            className="lg:max-w-sm"
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="lg:w-40">
            <option value="">All statuses</option>
            <option value="Preparing">Preparing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </Select>
          <Select value={payment} onChange={(e) => setPayment(e.target.value)} className="lg:w-40">
            <option value="">All payments</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </Select>
          <Input
            placeholder="Ship-to city (Lagos, Accra…)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            className="lg:max-w-[180px]"
          />
          <Button onClick={() => load(1)}>Search</Button>
        </div>
      </Panel>

      {loading && <LoadingBlock label="Loading orders…" />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState title="No orders found" body="Try another PLZ# code or clear filters." />
      )}

      {!loading && items.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-[#252A33] text-[11px] uppercase tracking-[0.12em] text-[#737A86]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Buyer</th>
                  <th className="px-4 py-3 font-semibold">Seller</th>
                  <th className="px-4 py-3 font-semibold">Ship to</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => {
                  const plz = formatPlz(o);
                  const active = selected?._id === o._id;
                  return (
                    <tr
                      key={o._id}
                      onClick={() => openDetail(o)}
                      className={`cursor-pointer border-b border-[#252A33]/80 hover:bg-[#171B22]/70 ${
                        active ? "bg-[#00E575]/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-mono text-[13px] font-semibold tracking-wide text-[#00E575]">
                          {plz}
                        </p>
                        <p className="text-[10px] text-[#737A86]">
                          {o.items?.length || 0} item{(o.items?.length || 0) === 1 ? "" : "s"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[#F5F7FA]">{o.buyer?.name || o.buyerContact?.name || "—"}</p>
                        <p className="text-[11px] text-[#737A86]">{o.buyer?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[#F5F7FA]">{o.seller?.storeName || o.seller?.name || "—"}</p>
                        <p className="text-[11px] text-[#737A86]">{o.seller?.email}</p>
                      </td>
                      <td className="px-4 py-3 text-[#A7ADB8]">
                        {o.shippingAddress?.city || "—"}
                        {o.shippingAddress?.state ? (
                          <span className="text-[#737A86]"> · {o.shippingAddress.state}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            o.orderStatus === "Delivered"
                              ? "green"
                              : o.orderStatus === "Cancelled"
                                ? "error"
                                : o.orderStatus === "Shipped"
                                  ? "blue"
                                  : "warn"
                          }
                        >
                          {o.orderStatus || "—"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            o.paymentStatus === "paid"
                              ? "green"
                              : o.paymentStatus === "failed"
                                ? "error"
                                : o.paymentStatus === "refunded"
                                  ? "blue"
                                  : "warn"
                          }
                        >
                          {o.paymentStatus || "—"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums">
                        {Number(o.totalAmount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-[#A7ADB8]">
                        {o.createdAt ? new Date(o.createdAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>

          {/* Detail panel — full tools */}
          <Panel className="p-4">
            {!selected ? (
              <p className="text-sm text-[#737A86]">Select an order to inspect PLZ# details.</p>
            ) : detailLoading ? (
              <p className="text-sm text-[#737A86]">Loading {formatPlz(selected)}…</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#737A86]">
                    Order code
                  </p>
                  <p className="mt-1 font-mono text-xl font-semibold tracking-wide text-[#00E575]">
                    {formatPlz(selected)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge
                      tone={
                        selected.orderStatus === "Delivered"
                          ? "green"
                          : selected.orderStatus === "Cancelled"
                            ? "error"
                            : "neutral"
                      }
                    >
                      {selected.orderStatus}
                    </Badge>
                    <Badge
                      tone={
                        selected.paymentStatus === "paid"
                          ? "green"
                          : selected.paymentStatus === "failed"
                            ? "error"
                            : "warn"
                      }
                    >
                      {selected.paymentStatus}
                    </Badge>
                    {selected.paymentMethod ? (
                      <Badge tone="neutral">{selected.paymentMethod}</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 border-t border-[#252A33] pt-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">Buyer</p>
                    <p className="mt-1 text-sm font-medium">
                      {selected.buyer?.name || selected.buyerContact?.name || "—"}
                    </p>
                    <p className="text-xs text-[#737A86]">{selected.buyer?.email}</p>
                    <p className="text-xs text-[#737A86]">
                      {selected.buyerContact?.phone || selected.buyer?.phone || ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">Seller</p>
                    <p className="mt-1 text-sm font-medium">
                      {selected.seller?.storeName || selected.seller?.name || "—"}
                    </p>
                    <p className="text-xs text-[#737A86]">{selected.seller?.email}</p>
                  </div>
                </div>

                <div className="border-t border-[#252A33] pt-4">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">Ship to</p>
                  {selected.shippingAddress ? (
                    <p className="mt-1 text-sm text-[#A7ADB8]">
                      {[
                        selected.shippingAddress.street,
                        selected.shippingAddress.city,
                        selected.shippingAddress.state,
                        selected.shippingAddress.zipCode,
                        selected.shippingAddress.country,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-[#737A86]">No address on record</p>
                  )}
                  {selected.shipping?.trackingNumber ? (
                    <p className="mt-2 text-xs text-[#A7ADB8]">
                      Tracking · {selected.shipping.deliveryCompany || "Courier"} ·{" "}
                      <span className="font-mono text-[#F5F7FA]">
                        {selected.shipping.trackingNumber}
                      </span>
                    </p>
                  ) : null}
                </div>

                <div className="border-t border-[#252A33] pt-4">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#737A86]">Line items</p>
                  <div className="mt-2 space-y-2">
                    {(selected.items || []).map((it, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 border border-[#252A33] bg-[#171B22] px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{it.name || "Item"}</p>
                          <p className="text-[11px] text-[#737A86]">Qty {it.quantity ?? 1}</p>
                        </div>
                        <p className="shrink-0 tabular-nums">
                          {Number(it.price || 0).toLocaleString()}
                        </p>
                      </div>
                    ))}
                    {!selected.items?.length ? (
                      <p className="text-xs text-[#737A86]">No line items returned.</p>
                    ) : null}
                  </div>
                </div>

                <div className="border-t border-[#252A33] pt-4 text-sm">
                  <div className="flex justify-between text-[#A7ADB8]">
                    <span>Subtotal</span>
                    <span className="tabular-nums">
                      {Number(selected.subtotal || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-[#A7ADB8]">
                    <span>Shipping</span>
                    <span className="tabular-nums">
                      {Number(selected.shippingCost || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between font-semibold text-[#F5F7FA]">
                    <span>Total</span>
                    <span className="tabular-nums">
                      {Number(selected.totalAmount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {selected.orderStatus === "Cancelled" && selected.cancellation ? (
                  <div className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                    Cancelled by {selected.cancellation.cancelledBy || "—"}
                    {selected.cancellation.reasonLabel
                      ? ` · ${selected.cancellation.reasonLabel}`
                      : ""}
                    {selected.cancellation.note ? (
                      <p className="mt-1 text-xs opacity-80">{selected.cancellation.note}</p>
                    ) : null}
                  </div>
                ) : null}

                <p className="text-[11px] text-[#737A86]">
                  Placed{" "}
                  {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "—"}
                  {selected.deliveredAt
                    ? ` · Delivered ${new Date(selected.deliveredAt).toLocaleString()}`
                    : ""}
                </p>
              </div>
            )}
          </Panel>
        </div>
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