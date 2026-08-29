import '../global.css'
// if file is globals.css → import '../globals.css'
import { CartProvider } from '@/context/CartContext'
import { MarketplaceProvider } from '@/context/MarketplaceContext'
import { PlazoreChromeProvider } from '@/context/PlazoreChromeContext'
import {
  SoundtrackProvider,
  useSoundtrack,
} from '@/context/SoundtrackContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { WishlistProvider } from '@/context/WishlistContext'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { ClerkProvider } from '@clerk/clerk-expo'
import {
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope'
import { Stack } from 'expo-router'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

const BG = '#090B0F'
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const OPENER_MS = 3300
const EASE = Easing.bezier(0.22, 1, 0.36, 1)

/** Force dark status bar on every platform */
function applyDarkStatusBar() {
  StatusBar.setBarStyle('light-content', true)
  if (Platform.OS === 'android') {
    StatusBar.setBackgroundColor(BG, true)
    StatusBar.setTranslucent(false)
  }
}

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

  // Opener sequence
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
        // Restore + lock dark status bar
        applyDarkStatusBar()
        releaseIntroGate()
      })
    }, OPENER_MS)

    return () => clearTimeout(timer)
  }, [openerOpacity, releaseIntroGate])

  // Keep forcing dark status bar while app is running (handles any later overrides)
  useEffect(() => {
    if (showOpener) return
    applyDarkStatusBar()
  }, [showOpener])

  return (
    <>
      {/* Always light icons on dark bg */}
      <ExpoStatusBar style="light" backgroundColor={BG} translucent={false} />

      {Platform.OS === 'android' && (
        <StatusBar
          barStyle="light-content"
          backgroundColor={BG}
          translucent={false}
          animated
        />
      )}

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: BG },
          // Extra safety for native stack screens
          statusBarStyle: 'light',
          statusBarBackgroundColor: BG,
          statusBarTranslucent: false,
        }}
      />

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

  // Force dark status bar as early as possible
  useEffect(() => {
    applyDarkStatusBar()
  }, [])

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: BG,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor={BG}
          translucent={false}
        />
        <ExpoStatusBar style="light" backgroundColor={BG} />
        <ActivityIndicator color="#FFFFFF" />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: BG }}>
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