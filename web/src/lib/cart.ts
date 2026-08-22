import type { Product } from "./types";

const KEY = "plazore_web_cart";

export type CartItem = { product: Product; quantity: number };

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
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

export function addToCart(product: Product, qty = 1) {
  const items = read();
  const i = items.findIndex((x) => x.product._id === product._id);
  if (i >= 0) items[i].quantity += qty;
  else items.push({ product, quantity: qty });
  write(items);
}