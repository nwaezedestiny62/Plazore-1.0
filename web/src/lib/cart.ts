import type { Product, ProductVariant } from "./types";
import {
  getVariantUnitPrice,
  productHasVariants,
} from "./types";

const KEY = "plazore_web_cart";

export type CartItem = {
  /** productId or productId::variantKey */
  id: string;
  product: Product;
  quantity: number;
  note: string;
  price: number;
  variantId?: string;
  variantKey?: string;
  selectedOptions?: Record<string, string>;
};

export type AddToCartSelection = {
  variantId?: string;
  variantKey?: string;
  selectedOptions?: Record<string, string>;
  variant?: ProductVariant | null;
};

function lineId(productId: string, variantKey?: string): string {
  const key = String(variantKey || "").trim();
  return key ? `${productId}::${key}` : productId;
}

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const items: CartItem[] = raw ? JSON.parse(raw) : [];
    // Migrate legacy lines that only had product _id as id
    return items.map((item) => {
      const vk = item.variantKey || "";
      const expected = lineId(item.product?._id || item.id, vk);
      if (item.id !== expected && item.product?._id) {
        return { ...item, id: expected };
      }
      return item;
    });
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("plazore-cart"));
}

export function getCart() {
  return read();
}

export function cartCount() {
  return read().reduce((n, i) => n + (i.quantity || 1), 0);
}

/**
 * Add to cart.
 * - Simple product: no selection needed.
 * - Variant product: pass variant / selectedOptions / variantKey.
 * Same product + same variantKey → increases quantity.
 * Different variant → separate line.
 */
export function addToCart(
  product: Product,
  qty = 1,
  selection?: AddToCartSelection
) {
  const quantity = Math.max(1, Number(qty) || 1);

  if (productHasVariants(product)) {
    const key =
      selection?.variantKey ||
      selection?.variant?.key ||
      "";
    if (!key && !selection?.variantId) {
      throw new Error("Please select product options before adding to cart");
    }
  }

  const variant =
    selection?.variant ||
    (product.variants || []).find(
      (v) =>
        (selection?.variantId && v.variantId === selection.variantId) ||
        (selection?.variantKey && v.key === selection.variantKey)
    ) ||
    null;

  const variantKey =
    selection?.variantKey ||
    variant?.key ||
    "";
  const variantId =
    selection?.variantId ||
    variant?.variantId ||
    "";
  const selectedOptions =
    selection?.selectedOptions ||
    (variant?.options ? { ...variant.options } : {}) ||
    {};

  const unitPrice = getVariantUnitPrice(product, variant);
  const id = lineId(product._id, variantKey);

  const items = read();
  const i = items.findIndex((x) => x.id === id);

  if (i >= 0) {
    items[i].quantity += quantity;
    items[i].price = unitPrice;
    items[i].variantId = variantId;
    items[i].variantKey = variantKey;
    items[i].selectedOptions = selectedOptions;
  } else {
    items.push({
      id,
      product,
      quantity,
      note: "",
      price: unitPrice,
      variantId,
      variantKey,
      selectedOptions,
    });
  }

  write(items);
}

export function updateQuantity(id: string, qty: number) {
  if (qty < 1) return removeFromCart(id);
  write(read().map((x) => (x.id === id ? { ...x, quantity: qty } : x)));
}

export function removeFromCart(id: string) {
  write(read().filter((x) => x.id !== id));
}

export function updateItemNote(id: string, note: string) {
  write(
    read().map((x) =>
      x.id === id ? { ...x, note: note.slice(0, 120) } : x
    )
  );
}

export function clearCart() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify([]));
  window.dispatchEvent(new Event("plazore-cart"));
}

/** Payload rows for POST /orders create (backend-compatible) */
export function cartItemsForCheckout(items?: CartItem[]) {
  const list = items || read();
  return list.map((item) => ({
    productId: item.product._id,
    quantity: item.quantity,
    price: item.price,
    note: item.note || "",
    variantId: item.variantId || "",
    variantKey: item.variantKey || "",
    selectedOptions: item.selectedOptions || {},
  }));
}