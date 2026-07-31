import { Product, WishlistContextType } from "@/constants/types";
import api from "@/constants/api";
import { useAuth } from "@clerk/clerk-expo";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const WishlistContext = createContext<WishlistContextType | undefined>(
  undefined
);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Keep latest getToken without putting it in effect deps
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const fetchWishlist = useCallback(async () => {
    if (!isSignedIn) {
      setWishlist([]);
      return;
    }

    try {
      setLoading(true);
      const token = await getTokenRef.current();
      const res = await api.get("/wishlist", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setWishlist(res.data.data || []);
      }
    } catch (error) {
      console.log("Fetch wishlist error:", error);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]); // only when sign-in state changes

  const toggleWishlist = async (product: Product) => {
    if (!isSignedIn) {
      console.log("Must be signed in to use wishlist");
      return;
    }

    // Optimistic update
    setWishlist((prev) => {
      const exists = prev.some((p) => p._id === product._id);
      if (exists) return prev.filter((p) => p._id !== product._id);
      return [...prev, product];
    });

    try {
      const token = await getTokenRef.current();
      const res = await api.post(
        "/wishlist/toggle",
        { productId: product._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setWishlist(res.data.data || []);
      }
    } catch (error) {
      console.log("Toggle wishlist error:", error);
      fetchWishlist();
    }
  };

  const isInWishlist = (productId: string) => {
    return wishlist.some((p) => p._id === productId);
  };

  // Only re-fetch when isSignedIn changes — NOT on every render
  useEffect(() => {
    fetchWishlist();
  }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WishlistContext.Provider
      value={{ wishlist, loading, isInWishlist, toggleWishlist }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error("useWishlist must be within a WishlistProvider");
  }
  return context;
}