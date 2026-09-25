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
import { NetworkStatusBanner } from '@/components/NetworkStatusBanner'
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
  Text,
  View,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

const BG = '#090B0F'
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const OPENER_MS = 3300
const EASE = Easing.bezier(0.22, 1, 0.36, 1)

/**
 * Must appear as process.env.EXPO_PUBLIC_* in app source so EAS inlines it
 * into the release APK. Passing it only via Clerk's internal fallback is not enough.
 */
const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''

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
      <ExpoStatusBar
        style="light"
        hidden={showOpener}
        backgroundColor={showOpener ? 'transparent' : BG}
        translucent={showOpener}
      />

      {Platform.OS === 'android' && !showOpener ? (
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

      {!showOpener ? <NetworkStatusBanner /> : null}

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

function MissingClerkKeyScreen() {
  return (
    <View style={styles.missingKey}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={BG}
        translucent={false}
      />
      <ExpoStatusBar style="light" backgroundColor={BG} />
      <Text style={styles.missingTitle}>Plazore</Text>
      <Text style={styles.missingBody}>
        Missing Clerk key in this build. Rebuild after setting
        EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY on EAS (preview + production).
      </Text>
    </View>
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
      <View style={styles.boot}>
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

  // Visible error instead of native crash when key was not inlined
  if (!CLERK_PUBLISHABLE_KEY) {
    return <MissingClerkKeyScreen />
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: BG }}>
      <ThemeProvider>
        <ClerkProvider
          publishableKey={CLERK_PUBLISHABLE_KEY}
          tokenCache={tokenCache}
        >
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
  boot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingKey: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  missingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },
  missingBody: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  opener: {
    ...FILL,
    zIndex: 9999,
    backgroundColor: '#000',
  },
  openerImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_W,
    height: SCREEN_H,
  },
})