import Link from "next/link";
import { formatProductPrice } from "@/lib/regions";
import type { Product } from "@/lib/types";

function storeName(product: Product) {
  if (typeof product.seller === "object" && product.seller?.storeName) {
    return product.seller.storeName;
  }
  return product.brand || "plazore";
}

export function ProductCard({
  product,
  tone = "dark",
}: {
  product: Product;
  tone?: "dark" | "light";
}) {
  const image = product.images?.[0];
  const light = tone === "light";

  return (
    <Link
      href={`/product/${product._id}`}
      className={`group block min-w-[220px] max-w-[280px] ${
        light ? "text-chamber-ink" : "text-text"
      }`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-2">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-[1600ms] ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="h-full w-full bg-surface" />
        )}
      </div>
      <p className="mt-3 text-[10px] tracking-[0.18em] uppercase text-muted">
        {storeName(product)}
      </p>
      <p className="mt-1 font-medium leading-snug">{product.name}</p>
      <p className="mt-1 text-sm text-secondary">
        {formatProductPrice(product.price, product.region, "NG")}
      </p>
    </Link>
  );
}