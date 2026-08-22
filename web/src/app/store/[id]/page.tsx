import type { Metadata } from "next";
import { fetchStore } from "@/lib/api";
import { Storefront, StoreMissing } from "@/components/store/Storefront";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { store } = await fetchStore(id);
  if (!store) return { title: "Store not found · Plazore" };
  return {
    title: `${store.storeName} · Plazore`,
    description: store.storeDescription?.slice(0, 160) || "Shop this storefront on Plazore",
    openGraph: {
      title: store.storeName,
      description: store.storeDescription,
      images: store.storeBanner || store.storeLogo ? [store.storeBanner || store.storeLogo] : [],
    },
  };
}

export default async function StorePage({ params }: Props) {
  const { id } = await params;
  const { store, products } = await fetchStore(id);
  if (!store) return <StoreMissing />;
  return <Storefront store={store} products={products} />;
}