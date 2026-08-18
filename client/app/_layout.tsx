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
import { View, ActivityIndicator, StatusBar, Platform } from 'react-native'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { PlazoreChromeProvider } from '@/context/PlazoreChromeContext'

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
          backgroundColor: '#090B0F',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor="#090B0F"
          translucent={false}
        />
        <ActivityIndicator color="#FFFFFF" />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#090B0F' }}>
      <ExpoStatusBar style="light" backgroundColor="#090B0F" />
      {Platform.OS === 'android' && (
        <StatusBar
          barStyle="light-content"
          backgroundColor="#090B0F"
          translucent={false}
        />
      )}

      <ThemeProvider>
        <ClerkProvider tokenCache={tokenCache}>
          <MarketplaceProvider>
            <CartProvider>
              <WishlistProvider>
                <PlazoreChromeProvider>
                  <Stack screenOptions={{ headerShown: false }} />
                </PlazoreChromeProvider>
              </WishlistProvider>
            </CartProvider>
          </MarketplaceProvider>
        </ClerkProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}