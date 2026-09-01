"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  Panel,
  Select,
} from "@/components/ui";

export default function ReportsPage() {
  const { getToken } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [targetType, setTargetType] = useState("");
  const [priority, setPriority] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const params = new URLSearchParams({
        limit: "40",
        ...(status ? { status } : {}),
        ...(targetType ? { targetType } : {}),
        ...(priority ? { priority } : {}),
      });
      const json = await adminFetch<any>(`/admin/reports?${params}`, token);
      setItems(json.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, targetType, priority]);

  const setReportStatus = async (id: string, next: string) => {
    try {
      setBusyId(id);
      const token = await getToken();
      await adminFetch(`/admin/reports/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Product and storefront flags — separate from Contact. Actions use real product/seller fields only."
      />

      <Panel className="mb-4 flex flex-wrap gap-3 p-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="under_review">Under review</option>
          <option value="action_required">Action required</option>
          <option value="no_action">No action</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </Select>
        <Select value={targetType} onChange={(e) => setTargetType(e.target.value)} className="w-40">
          <option value="">All targets</option>
          <option value="product">Product</option>
          <option value="store">Store</option>
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-36">
          <option value="">All priority</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </Select>
      </Panel>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && items.length === 0 && (
        <EmptyState title="No reports yet" body="Reports appear when users flag products or stores." />
      )}

      <div className="space-y-3">
        {items.map((r) => (
          <Panel key={r._id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={r.targetType === "product" ? "blue" : "green"}>
                    {r.targetType}
                  </Badge>
                  <Badge
                    tone={
                      r.priority === "critical"
                        ? "error"
                        : r.priority === "high"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {r.priority}
                  </Badge>
                  <Badge>{r.status}</Badge>
                  <Badge tone="neutral">{r.reason}</Badge>
                </div>
                <p className="mt-2 text-sm text-secondary">
                  Reporter: {r.reporter?.name || "—"} · {r.reporter?.email}
                </p>
                {r.targetType === "product" ? (
                  <p className="mt-1 text-sm">
                    Product: <span className="text-text">{r.product?.name || "—"}</span>
                    {r.product?.isActive === false ? " (inactive)" : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-sm">
                    Store:{" "}
                    <span className="text-text">
                      {r.seller?.storeName || r.seller?.name || "—"}
                    </span>
                    {r.seller?.isSellerSuspended ? " (suspended)" : ""}
                  </p>
                )}
                {r.description ? (
                  <p className="mt-2 text-sm text-secondary">{r.description}</p>
                ) : null}
                <p className="mt-2 text-xs text-muted">
                  {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  tone="ghost"
                  className="h-8 text-xs"
                  disabled={busyId === r._id}
                  onClick={() => setReportStatus(r._id, "under_review")}
                >
                  Review
                </Button>
                <Button
                  tone="ghost"
                  className="h-8 text-xs"
                  disabled={busyId === r._id}
                  onClick={() => setReportStatus(r._id, "resolved")}
                >
                  Resolve
                </Button>
                <Button
                  tone="ghost"
                  className="h-8 text-xs"
                  disabled={busyId === r._id}
                  onClick={() => setReportStatus(r._id, "closed")}
                >
                  Close
                </Button>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}