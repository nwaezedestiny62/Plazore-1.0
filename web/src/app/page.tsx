import { fetchMallProducts } from "@/lib/api";
import { Mall } from "@/components/mall/Mall";

export default async function MallPage() {
  const products = await fetchMallProducts();
  return <Mall products={products} loading={false} />;
}