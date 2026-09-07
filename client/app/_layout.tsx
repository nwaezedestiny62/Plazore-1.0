import '../global.css'
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

const FILL = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
}

function applyDarkStatusBar() {
  StatusBar.setBarStyle('light-content', true)
  if (Platform.OS === 'android') {
    StatusBar.setBackgroundColor(BG, true)
    StatusBar.setTranslucent(false)
  }
}

function AppShell() {
  const { holdIntroGate, releaseIntroGate } = useSoundtrack()
  const [showOpener, setShowOpener] = useState(true)
  const openerOpacity = useRef(new Animated.Value(1)).current
  const heldRef = useRef(false)

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
        applyDarkStatusBar()
        releaseIntroGate()
      })
    }, OPENER_MS)

    return () => clearTimeout(timer)
  }, [openerOpacity, releaseIntroGate])

  useEffect(() => {
    if (showOpener) return
    applyDarkStatusBar()
  }, [showOpener])

  return (
    <>
      <ExpoStatusBar style="light" backgroundColor={BG} translucent={false} />

      {Platform.OS === 'android' ? (
        <StatusBar
          barStyle="light-content"
          backgroundColor={BG}
          translucent={false}
          animated
        />
      ) : null}

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: BG },
          statusBarStyle: 'light',
          statusBarBackgroundColor: BG,
          statusBarTranslucent: false,
        }}
      />

      {showOpener ? (
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
      ) : null}
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
    ...FILL,
    zIndex: 9999,
    backgroundColor: '#000',
  },
  openerImage: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
})