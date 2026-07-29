import { Product } from "@/constants/types";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  size?: string;
  price: number;
  note?: string; // NEW
}

type CartContextType = {
  cartItems: CartItem[];
  addToCart: (product: Product, size?: string) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  updateItemNote: (itemId: string, note: string) => void; // NEW
  clearCart: () => Promise<void>;
  cartTotal: number;
  itemCount: number;
  isLoading: boolean;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading] = useState(false);
  const [cartTotal, setCartTotal] = useState(0);

  const addToCart = async (product: Product, size?: string) => {
    setCartItems((prev) => {
      const existing = prev.find(
        (item) => item.productId === product._id && item.size === size
      );

      if (existing) {
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      const newItem: CartItem = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        productId: product._id,
        product,
        quantity: 1,
        size,
        price: product.price,
        note: "",
      };

      return [...prev, newItem];
    });
  };

  const removeFromCart = async (itemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  // NEW: update note for a specific cart item
  const updateItemNote = (itemId: string, note: string) => {
    const cleanNote = note.slice(0, 120); // hard limit
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, note: cleanNote } : item
      )
    );
  };

  const clearCart = async () => {
    setCartItems([]);
    setCartTotal(0);
  };

  const calculatedTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    setCartTotal(calculatedTotal);
  }, [cartItems]);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateItemNote,
        clearCart,
        cartTotal,
        itemCount,
        isLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}