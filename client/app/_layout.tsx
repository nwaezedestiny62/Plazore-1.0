import { Stack } from 'expo-router'
import { CartProvider } from '@/context/CartContext'
import { WishlistProvider } from '@/context/WishlistContext'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { MarketplaceProvider } from '@/context/MarketplaceContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { PlazoreChromeProvider } from '@/context/PlazoreChromeContext'
import {
  SoundtrackProvider,
  useSoundtrack,
} from '@/context/SoundtrackContext'
import {
  useFonts,
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const OPENER_MS = 3000
const EASE = Easing.bezier(0.22, 1, 0.36, 1)

/** Opener + intro gate — must sit inside SoundtrackProvider */
function AppShell() {
  const { holdIntroGate, releaseIntroGate } = useSoundtrack()
  const [showOpener, setShowOpener] = useState(true)
  const openerOpacity = useRef(new Animated.Value(1)).current
  const heldRef = useRef(false)

  // Hold music for the entire opener
  useEffect(() => {
    if (heldRef.current) return
    heldRef.current = true
    holdIntroGate()
  }, [holdIntroGate])

  useEffect(() => {
    StatusBar.setHidden(true, 'fade')
    if (Platform.OS === 'android') {
      StatusBar.setTranslucent(true)
      StatusBar.setBackgroundColor('transparent', true)
    }

    const timer = setTimeout(() => {
      Animated.timing(openerOpacity, {
        toValue: 0,
        duration: 420,
        easing: EASE,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return
        setShowOpener(false)
        StatusBar.setHidden(false, 'fade')
        // Opener done → allow music (preloader can hold again if needed)
        releaseIntroGate()
      })
    }, OPENER_MS)

    return () => clearTimeout(timer)
  }, [openerOpacity, releaseIntroGate])

  return (
    <>
      <ExpoStatusBar style="light" backgroundColor="#090B0F" />
      {Platform.OS === 'android' && (
        <StatusBar
          barStyle="light-content"
          backgroundColor="#090B0F"
          translucent={false}
        />
      )}

      <Stack screenOptions={{ headerShown: false }} />

      {showOpener && (
        <Animated.View
          pointerEvents="none"
          style={[styles.opener, { opacity: openerOpacity }]}
        >
          <Image
            source={require('@/assets/opener.png')}
            style={styles.openerImage}
            resizeMode="cover"
          />
        </Animated.View>
      )}
    </>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_300Light,
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
  })

  if (!fontsLoaded) {
    return (
      <View style={styles.boot}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#090B0F"
          translucent={false}
        />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <ClerkProvider tokenCache={tokenCache}>
          <MarketplaceProvider>
            <CartProvider>
              <WishlistProvider>
                <PlazoreChromeProvider>
                  <SoundtrackProvider>
                    <AppShell />
                  </SoundtrackProvider>
                </PlazoreChromeProvider>
              </WishlistProvider>
            </CartProvider>
          </MarketplaceProvider>
        </ClerkProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#090B0F',
  },
  boot: {
    flex: 1,
    backgroundColor: '#090B0F',
  },
  opener: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: '#000',
  },
  openerImage: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
})