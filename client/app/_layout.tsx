import { Stack } from "expo-router";
import '../global.css';
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { MarketplaceProvider } from "@/context/MarketplaceContext";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider tokenCache={tokenCache}>
  <MarketplaceProvider>
    <CartProvider>
      <WishlistProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </WishlistProvider>
    </CartProvider>
  </MarketplaceProvider>
</ClerkProvider>
      
    </GestureHandlerRootView>
  );
}