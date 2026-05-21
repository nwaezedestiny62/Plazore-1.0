import { dummyCart } from "@/assets/assets";
import { Product } from "@/constants/types";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

// ==================== TYPES ====================
export interface CartItem {
    id: string;           // Cart item ID
    productId: string;
    product: Product;
    quantity: number;
    size?: string;
    price: number;        // Price at time of adding to cart
}

type CartContextType = {
    cartItems: CartItem[];
    addToCart: (product: Product, size?: string) => Promise<void>;
    removeFromCart: (itemId: string) => Promise<void>;
    updateQuantity: (itemId: string, quantity: number) => Promise<void>;
    clearCart: () => Promise<void>;
    cartTotal: number;
    itemCount: number;
    isLoading: boolean;
};

// ==================== CONTEXT ====================
const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {

    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [cartTotal, setCartTotal] = useState(0);

    // Fetch cart from dummy data (later replace with API)
    const fetchCart = async () => {
        setIsLoading(true);
        
        try {
            const serverCart = dummyCart;

            const mappedItems: CartItem[] = serverCart.items.map((item: any) => ({
                id: item._id || item.product._id,           // Cart item ID
                productId: item.product._id,
                product: item.product,
                quantity: item.quantity,
                size: item.size,
                price: item.price || item.product.price,
            }));

            setCartItems(mappedItems);
            setCartTotal(serverCart.totalAmount || 0);
        } catch (error) {
            console.error("Failed to fetch cart:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const addToCart = async (product: Product, size?: string) => {
        // TODO: Implement API call later
        console.log("Added to cart:", product.name, size);
        
        // Temporary local update
        const existingItem = cartItems.find(item => 
            item.productId === product._id && item.size === size
        );

        if (existingItem) {
            await updateQuantity(existingItem.id, existingItem.quantity + 1);
        } else {
            const newItem: CartItem = {
                id: Date.now().toString(), // temporary ID
                productId: product._id,
                product,
                quantity: 1,
                size,
                price: product.price,
            };
            setCartItems(prev => [...prev, newItem]);
        }
    };

    const removeFromCart = async (itemId: string) => {
        setCartItems(prev => prev.filter(item => item.id !== itemId));
    };

    const updateQuantity = async (itemId: string, quantity: number) => {
        if (quantity < 1) return;

        setCartItems(prev =>
            prev.map(item =>
                item.id === itemId ? { ...item, quantity } : item
            )
        );
    };

    const clearCart = async () => {
        setCartItems([]);
        setCartTotal(0);
    };

    // Calculate total
    const calculatedTotal = cartItems.reduce((sum, item) => {
        return sum + item.price * item.quantity;
    }, 0);

    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    useEffect(() => {
        fetchCart();
    }, []);

    // Update cartTotal whenever cartItems change
    useEffect(() => {
        setCartTotal(calculatedTotal);
    }, [cartItems]);

    return (
        <CartContext.Provider value={{
            cartItems,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            cartTotal,
            itemCount,
            isLoading
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}