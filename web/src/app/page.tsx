import { fetchShowroom } from "@/lib/api";
import { Mall } from "@/components/mall/Mall";

export default async function MallPage() {
  // SSR first paint (no browser session yet).
  // Client will re-fetch with sessionId + region for adaptive ranking.
  const { products, rooms } = await fetchShowroom({ region: "NG" });

  return <Mall products={products} rooms={rooms} loading={false} />;
}