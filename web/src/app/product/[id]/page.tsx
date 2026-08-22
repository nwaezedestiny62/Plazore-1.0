import type { Metadata } from "next";
import { fetchProduct } from "@/lib/api";
import { ProductMissing, ProductView } from "@/components/product/ProductView";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProduct(id);
  if (!product) return { title: "Piece not found · Plazore" };
  return {
    title: `${product.name} · Plazore`,
    description: product.description?.slice(0, 160) || "On Plazore",
    openGraph: {
      title: product.name,
      images: product.images?.[0] ? [product.images[0]] : [],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await fetchProduct(id);
  if (!product) return <ProductMissing />;
  return <ProductView product={product} />;
}