"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import {
  cartCount,
  getCart,
  removeFromCart,
  updateItemNote,
  updateQuantity,
  type CartItem,
} from "@/lib/cart";
import {
  convertPrice,
  DEFAULT_REGION,
  formatMoney,
  formatProductPrice,
} from "@/lib/regions";

function productRegion(product: CartItem["product"]) {
  if (product.region) return String(product.region);
  const seller = product.seller;
  if (seller && typeof seller === "object" && "marketplaceRegion" in seller) {
    return String((seller as { marketplaceRegion?: string }).marketplaceRegion || DEFAULT_REGION);
  }
  return DEFAULT_REGION;
}

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const displayRegion = DEFAULT_REGION;

  const sync = () => setItems(getCart());

  useEffect(() => {
    sync();
    window.addEventListener("plazore-cart", sync);
    return () => window.removeEventListener("plazore-cart", sync);
  }, []);

  const fmt = (n: number) => formatMoney(n, displayRegion);
  const fmtProduct = (n: number, region?: string | null) =>
    formatProductPrice(n, region, displayRegion);

  const { productPrice, deliveryFee, totalAmount } = useMemo(() => {
    if (!items.length) return { productPrice: 0, deliveryFee: 0, totalAmount: 0 };
    let productsSum = 0;
    const bySeller: Record<string, number> = {};
    let noSellerMax = 0;

    for (const item of items) {
      const region = productRegion(item.product);
      const unit = Number(item.price ?? item.product?.price) || 0;
      const qty = Number(item.quantity) || 1;
      productsSum += convertPrice(unit * qty, region, displayRegion);

      const feeRaw = Number(item.product?.shipping?.deliveryFee) || 0;
      const feeConverted = convertPrice(feeRaw, region, displayRegion);
      const seller = item.product?.seller as { _id?: string } | string | undefined;
      const sellerId = typeof seller === "string" ? seller : seller?._id ? String(seller._id) : "";

      if (sellerId) bySeller[sellerId] = Math.max(bySeller[sellerId] || 0, feeConverted);
      else noSellerMax = Math.max(noSellerMax, feeConverted);
    }

    const feeSum = Object.values(bySeller).reduce((s, f) => s + f, 0) + noSellerMax;
    return { productPrice: productsSum, deliveryFee: feeSum, totalAmount: productsSum + feeSum };
  }, [items, displayRegion]);

  const count = items.reduce((n, i) => n + (i.quantity || 0), 0);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="flex items-center px-2 py-2.5 md:px-6">
        <button
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center border border-white/8 bg-[#0E1116]"
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-[17px] font-extrabold tracking-tight">Shopping Bag</p>
          {count > 0 && (
            <p className="mt-0.5 text-[11px] font-semibold tracking-wide text-white/38">
              {count} item{count !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <span className="w-11" />
      </header>
      <div
        className="mx-4 h-px md:mx-6"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,229,117,0.45), rgba(37,99,235,0.35), transparent)",
        }}
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-10 py-24 text-center">
          <div className="mb-6 flex h-[88px] w-[88px] items-center justify-center border border-white/8 bg-[#0E1116]">
            <ShoppingBag className="h-9 w-9 text-white/38" />
          </div>
          <p className="text-xl font-extrabold tracking-tight">Your bag is empty</p>
          <p className="mt-2.5 max-w-sm text-sm leading-[21px] text-white/55">
            Items you pick from Plazore will appear here — ready for checkout.
          </p>
          <Link
            href="/"
            className="mt-8 px-8 py-3.5 text-[15px] font-extrabold text-[#041412]"
            style={{ backgroundImage: "linear-gradient(90deg,#00E575,#14B8A6,#2563EB)" }}
          >
            Continue shopping
          </Link>
        </div>
      ) : (
        <>
          <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-32 pt-4 md:grid-cols-[1fr_340px] md:px-6 md:pb-10">
            <div className="space-y-3">
              {items.map((item) => {
                const region = productRegion(item.product);
                const unit = Number(item.price ?? item.product?.price) || 0;
                const qty = Number(item.quantity) || 1;
                const lineFee = Number(item.product?.shipping?.deliveryFee) || 0;
                const note = item.note || "";

                return (
                  <article key={item.id} className="relative overflow-hidden border border-white/8 bg-[#0E1116]">
                    <span className="absolute bottom-0 left-0 top-0 w-0.5 bg-green/55" />
                    <div className="flex gap-3 p-3.5 pl-4">
                      {item.product?.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.product.images[0]}
                          alt=""
                          className="h-[76px] w-[76px] shrink-0 object-cover bg-[#14181F]"
                        />
                      ) : (
                        <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center bg-[#14181F]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-[19px]">{item.product?.name || "Product"}</p>
                        <p className="mt-1 text-sm font-extrabold text-green">{fmtProduct(unit, region)}</p>
                        {lineFee > 0 && (
                          <p className="mt-0.5 text-[11px] font-medium text-white/38">
                            Delivery {fmtProduct(lineFee, region)}
                          </p>
                        )}
                        <div className="mt-3 flex items-center">
                          <div className="flex items-center border border-white/8 bg-[#14181F]">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="flex h-8 w-8 items-center justify-center"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-7 text-center text-[13px] font-bold">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="flex h-8 w-8 items-center justify-center"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="mx-2.5 min-w-0 flex-1 text-right text-sm font-bold">
                            {fmtProduct(unit * qty, region)}
                          </p>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="flex h-[34px] w-[34px] items-center justify-center border border-red-500/20 bg-red-500/8"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-white/8 px-4 pb-3.5 pt-2">
                      <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white/38">
                        Note for seller
                      </p>
                      <textarea
                        value={note}
                        maxLength={120}
                        onChange={(e) => updateItemNote(item.id, e.target.value)}
                        placeholder="e.g. Pack carefully · Gift wrap · Leave at door"
                        className="min-h-14 w-full border border-white/8 bg-[#14181F] px-3 py-2.5 text-[13px] leading-[18px] text-text outline-none placeholder:text-white/38"
                      />
                      <p className="mt-1 text-right text-[10px] font-semibold text-white/38">{note.length}/120</p>
                    </div>
                  </article>
                );
              })}
            </div>

            <aside className="h-fit border border-white/8 bg-[#0E1116] md:sticky md:top-6">
              <div className="border-b border-white/8 bg-[#14181F] px-4 py-3">
                <p className="text-[11px] font-extrabold tracking-[0.14em] text-white/38">ORDER SUMMARY</p>
              </div>
              <div className="space-y-2.5 p-4">
                <div className="flex justify-between text-[13px]">
                  <span className="font-medium text-white/55">Product price</span>
                  <span className="font-bold">{fmt(productPrice)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="font-medium text-white/55">Delivery fee</span>
                  <span className="font-bold">{fmt(deliveryFee)}</span>
                </div>
                <div className="h-px bg-white/8" />
                <div className="flex justify-between">
                  <span className="text-sm font-extrabold">Total</span>
                  <span className="text-[17px] font-extrabold tracking-tight text-green">{fmt(totalAmount)}</span>
                </div>
              </div>
              <div className="hidden border-t border-white/8 p-4 md:block">
                <p className="text-[10px] font-extrabold tracking-[0.11em] text-white/38">AMOUNT DUE</p>
                <p className="mt-1 text-xl font-extrabold tracking-tight">{fmt(totalAmount)}</p>
                <Link
                  href="/checkout"
                  className="mt-4 flex items-center justify-center gap-2 py-3.5 text-[15px] font-extrabold text-[#041412]"
                  style={{ backgroundImage: "linear-gradient(90deg,#00E575,#14B8A6,#2563EB)" }}
                >
                  Checkout <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </aside>
          </div>

          <div className="fixed inset-x-0 bottom-0 border-t border-white/8 bg-[#0E1116] md:hidden">
            <div
              className="h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(0,229,117,0.35), rgba(37,99,235,0.25), transparent)",
              }}
            />
            <div className="flex items-center gap-3.5 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold tracking-[0.11em] text-white/38">AMOUNT DUE</p>
                <p className="text-xl font-extrabold tracking-tight">{fmt(totalAmount)}</p>
              </div>
              <Link
                href="/checkout"
                className="flex items-center gap-2 px-[22px] py-3.5 text-[15px] font-extrabold text-[#041412]"
                style={{ backgroundImage: "linear-gradient(90deg,#00E575,#14B8A6,#2563EB)" }}
              >
                Checkout <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}