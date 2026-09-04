"use client";

import { useAuth } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import { Badge, Button, ErrorBlock, Panel, Select, cn } from "@/components/ui";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="border border-[#252A33] bg-[#11141A] px-3 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">{label}</p>
      <p className="mt-1.5 text-[22px] font-semibold tabular-nums leading-none">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint ? <p className="mt-1.5 text-[11px] text-[#737A86]">{hint}</p> : null}
    </div>
  );
}

function Bars({
  values,
  color = "#00E575",
}: {
  values: number[];
  color?: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-20 items-end gap-px">
      {values.map((v, i) => (
        <div
          key={i}
          className="min-w-0 flex-1"
          style={{
            height: `${Math.max(v ? 6 : 0, (v / max) * 100)}%`,
            background: color,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { getToken } = useAuth();
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const token = await getToken();
      const json = await adminFetch<any>(`/admin/analytics?days=${days}`, token);
      setData(json.data);
    } catch (e: any) {
      setError(e.message || "Failed to load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, days]);

  useEffect(() => {
    load();
  }, [load]);

  const c = data?.commerce;
  const series = c?.series || [];

  return (
    <div className={cn(poppins.className, "relative min-h-[70vh] pb-24 text-[#F5F7FA]")}>
      <header className="mb-6 border-b border-[#252A33] pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
          Intelligence
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight sm:text-[28px]">Analytics</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#A7ADB8]">
              Is Plazore becoming a functioning marketplace? Commerce first. No vanity placeholders.
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </Select>
            <Button tone="ghost" className="h-9 gap-1.5 text-xs" disabled={loading} onClick={load}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {error ? <div className="mb-4"><ErrorBlock message={error} /></div> : null}

      {loading && !data ? (
        <div className="border border-[#252A33] bg-[#11141A]">
          <OrbLoader label="Loading analytics" />
        </div>
      ) : data ? (
        <div className="space-y-8">
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Commerce
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              <Stat label="GMV" value={c.gmv} hint="Non-cancelled order totals" />
              <Stat label="Orders" value={c.orders} />
              <Stat label="Delivered" value={c.completedDelivered} />
              <Stat label="AOV" value={c.averageOrderValue} />
              <Stat label="Cancelled" value={c.cancelled} />
              <Stat label="Refunded payments" value={c.refunds} />
              <Stat label="Failed payments" value={c.failedPayments} />
              <Stat label="Carts with items" value={c.cartsWithItems} />
              <Stat label="Catalog views" value={c.catalogViews} />
              <Stat
                label="View → purchase"
                value={c.conversionRatePct == null ? "—" : `${c.conversionRatePct}%`}
                hint="From ProductPerformance"
              />
            </div>
            <Panel className="mt-3 p-4">
              <p className="mb-2 text-[11px] text-[#737A86]">GMV over time</p>
              <Bars values={series.map((r: any) => r.gmv)} />
              <p className="mt-4 mb-2 text-[11px] text-[#737A86]">Orders over time</p>
              <Bars values={series.map((r: any) => r.orders)} color="#3B82F6" />
            </Panel>
          </section>

          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              App vs web
            </p>
            <Panel className="p-4">
              <p className="text-sm text-[#A7ADB8]">{data.appVsWeb.note}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Last seen web" value={data.appVsWeb.presence.web} />
                <Stat label="Last seen app" value={data.appVsWeb.presence.app} />
                <Stat label="Last seen admin" value={data.appVsWeb.presence.admin} />
                <Stat label="Unknown / unset" value={data.appVsWeb.presence.unknown} />
              </div>
            </Panel>
          </section>

          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Sellers
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Sellers" value={data.sellers.total} />
              <Stat label="New sellers 7d" value={data.sellers.new7d} />
              <Stat label="Active listings" value={data.sellers.productsListed} />
              <Stat
                label="Campaign remaining"
                value={data.sellers.campaign.remaining}
                hint={`${data.sellers.campaign.recruited} / ${data.sellers.campaign.cap}`}
              />
            </div>
            <div className="mt-3">
              <Badge tone={data.sellers.campaign.status === "open" ? "green" : "warn"}>
                First 200 · {data.sellers.campaign.status === "open" ? "open" : "cap reached"}
              </Badge>
            </div>
          </section>

          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Buyers / users
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              <Stat label="Registered" value={data.buyers.registered} />
              <Stat label="Buyer-only" value={data.buyers.buyerOnly} />
              <Stat label="Seller accounts" value={data.buyers.sellerAccounts} />
              <Stat label="New 7d" value={data.buyers.new7d} />
              <Stat label="Active 7d" value={data.buyers.active7d} hint="lastSeenAt" />
              <Stat label="Repeat shoppers" value={data.buyers.repeatShoppers} hint="2+ orders in range" />
            </div>
            <p className="mt-2 text-xs text-[#737A86]">{data.buyers.referralAttribution.note}</p>
          </section>

          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Discovery funnel
            </p>
            <p className="mb-2 text-xs text-[#737A86]">
              Adaptive Showroom → open → cart → purchase (from ShowroomEvent)
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              <Stat label="Impressions" value={data.discovery.funnel.impression} />
              <Stat label="Opens" value={data.discovery.funnel.open} />
              <Stat label="Showroom carts" value={data.discovery.funnel.cart} />
              <Stat label="Wishlist" value={data.discovery.funnel.wishlist} />
              <Stat label="Showroom purchase" value={data.discovery.funnel.purchase} />
              <Stat label="Skips" value={data.discovery.funnel.skip} />
            </div>
          </section>

          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Product intelligence
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Ready" value={data.intelligence.productsReady} />
              <Stat label="Pending" value={data.intelligence.pending} />
              <Stat label="Failed" value={data.intelligence.failed} />
            </div>
            <p className="mt-2 text-xs text-[#737A86]">{data.intelligence.views.note}</p>
          </section>

          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737A86]">
              Platform health
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Failed payments" value={data.platformHealth.failedPayments} />
              <Stat label="Cancelled orders" value={data.platformHealth.cancelledOrders} />
              <Stat label="AI failures" value={data.platformHealth.intelligenceFailures} />
              <Stat label="AI pending" value={data.platformHealth.intelligencePending} />
            </div>
            <p className="mt-2 text-xs text-[#737A86]">
              No synthetic health score. Missing logs: {data.platformHealth.unavailable.join(" · ")}
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}