import { Stack } from 'expo-router'
import '../global.css'
import { CartProvider } from '@/context/CartContext'
import { WishlistProvider } from '@/context/WishlistContext'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { MarketplaceProvider } from '@/context/MarketplaceContext'
import { ThemeProvider } from '@/context/ThemeContext'
import {
  useFonts,
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope'
import { View, ActivityIndicator } from 'react-native'

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_300Light,
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
  })

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0E0E0E',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color="#FFFFFF" />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ClerkProvider tokenCache={tokenCache}>
          <MarketplaceProvider>
            <CartProvider>
              <WishlistProvider>
                <Stack screenOptions={{ headerShown: false }} />
              </WishlistProvider>
            </CartProvider>
          </MarketplaceProvider>
        </ClerkProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}