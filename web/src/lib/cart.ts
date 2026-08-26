import type { Product } from "./types";

const KEY = "plazore_web_cart";

export type CartItem = {
  id: string;
  product: Product;
  quantity: number;
  note: string;
  price: number;
};

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
  else {
    items.push({
      id: product._id,
      product,
      quantity: qty,
      note: "",
      price: Number(product.price) || 0,
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
  write(read().map((x) => (x.id === id ? { ...x, note: note.slice(0, 120) } : x)));
}

export function clearCart() {
  if (typeof window === "undefined") return;
  localStorage.setItem("plazore_web_cart", JSON.stringify([]));
  window.dispatchEvent(new Event("plazore-cart"));
}