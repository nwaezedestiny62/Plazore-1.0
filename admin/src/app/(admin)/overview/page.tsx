"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";
import { Card, ErrorBlock, LoadingBlock, PageHeader, Panel } from "@/components/ui";

export default function OverviewPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        setLoading(true);
        const token = await getToken();
        const json = await adminFetch<any>("/admin/stats", token);
        setData(json.data);
      } catch (e: any) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, getToken]);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Operational health of Plazore from live marketplace data."
      />

      {loading && <LoadingBlock label="Loading marketplace health…" />}
      {error && <ErrorBlock message={error} />}

      {data && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Marketplace
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card label="Buyers" value={data.users?.buyers ?? 0} />
              <Card label="Sellers" value={data.users?.sellers ?? 0} />
              <Card label="Active products" value={data.products?.active ?? 0} />
              <Card label="Inactive products" value={data.products?.inactive ?? 0} />
              <Card label="New users (7d)" value={data.users?.new7d ?? 0} />
              <Card label="New sellers (7d)" value={data.users?.newSellers7d ?? 0} />
              <Card label="New products (7d)" value={data.products?.new7d ?? 0} />
              <Card label="Total products" value={data.products?.total ?? 0} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Commerce
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card label="Orders" value={data.orders?.total ?? 0} />
              <Card label="Preparing" value={data.orders?.preparing ?? 0} />
              <Card label="Shipped" value={data.orders?.shipped ?? 0} />
              <Card label="Delivered" value={data.orders?.delivered ?? 0} />
              <Card label="Cancelled" value={data.orders?.cancelled ?? 0} />
              <Card label="Paid" value={data.payments?.paid ?? 0} />
              <Card label="Payment pending" value={data.payments?.pending ?? 0} />
              <Card
                label="GMV"
                value={(data.commerce?.gmv ?? 0).toLocaleString()}
                hint="Sum of non-cancelled order totals"
              />
            </div>
          </section>

          <section>
  <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
    Support queues
  </h2>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
    <Card label="New contacts" value={data.support?.contactNew ?? 0} />
    <Card label="Open contacts" value={data.support?.contactOpen ?? 0} />
    <Card label="New reports" value={data.support?.reportsNew ?? 0} />
    <Card label="Unresolved reports" value={data.support?.reportsUnresolved ?? 0} />
    <Card label="High priority reports" value={data.support?.reportsHigh ?? 0} />
  </div>
</section>

          <Panel className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              App vs Web
            </p>
            <p className="mt-2 text-sm text-secondary">
              {data.platformSource?.note}
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}