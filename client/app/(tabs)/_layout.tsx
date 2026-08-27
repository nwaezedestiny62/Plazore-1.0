import PlazoreNavigationHub from '@/components/PlazoreNavigationHub'
import { ShowroomFlyCartProvider } from '@/components/showroom/ShowroomFlyCart'
import { FloatingCartButton } from '@/components/showroom/ShowroomRoomNav'
import {
  CHROME_DURATION,
  CHROME_IN_END,
  CHROME_IN_START,
  EASE_SMOOTH,
  usePlazoreChrome,
} from '@/context/PlazoreChromeContext'
import { useSoundtrack } from '@/context/SoundtrackContext'
import { Ionicons } from '@expo/vector-icons'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { Tabs } from 'expo-router'
import React, { useEffect, useRef } from 'react'
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const BG_SCREEN = '#090B0F'
const MUTED = 'rgba(255,255,255,0.42)'
const GREEN = '#00E575'
const TEXT = '#F5F7FA'

const NAV_VISIBLE_ROUTES = new Set(['index', 'search'])

function PlazoreTabsBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { scrollProgress, homeChrome } = usePlazoreChrome()
  const { unlock: unlockSoundtrack } = useSoundtrack()

  const anim = useRef(new Animated.Value(0)).current

  const active = state.routes[state.index]?.name ?? ''
  const onAllowedScreen = NAV_VISIBLE_ROUTES.has(active)
  const isHome = active === 'index'
  const showFloatingCart = active === 'search' || active === 'favorites'

  useEffect(() => {
    let target = 0
    if (onAllowedScreen) {
      if (isHome && homeChrome) {
        target = Math.min(1, Math.max(0, scrollProgress))
      } else if (!isHome) {
        target = 1
      }
    }
    anim.stopAnimation()
    Animated.timing(anim, {
      toValue: target,
      duration: CHROME_DURATION,
      easing: EASE_SMOOTH,
      useNativeDriver: true,
    }).start()
  }, [scrollProgress, homeChrome, isHome, onAllowedScreen, anim])

  const go = (name: string) => {
    unlockSoundtrack()
    const route = state.routes.find((r) => r.name === name)
    if (!route) return
    const ev = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    })
    if (!ev.defaultPrevented) navigation.navigate(name as never)
  }

  const bottom = Math.max(insets.bottom, 6) + 4

  const pointerOff =
    !onAllowedScreen ||
    (isHome && (!homeChrome || scrollProgress < CHROME_IN_START))

  const barOpacity = anim.interpolate({
    inputRange: [0, CHROME_IN_START, CHROME_IN_END, 1],
    outputRange: [0, 0.01, 0.54, 1],
    extrapolate: 'clamp',
  })
  const translateY = anim.interpolate({
    inputRange: [0, CHROME_IN_START, CHROME_IN_END, 1],
    outputRange: [22, 20, 6, 0],
    extrapolate: 'clamp',
  })
  const scale = anim.interpolate({
    inputRange: [0, CHROME_IN_START, CHROME_IN_END, 1],
    outputRange: [0.97, 0.98, 0.995, 1],
    extrapolate: 'clamp',
  })

  return (
    <>
      {/* Bottom nav — Mall + Browse only */}
      <Animated.View
        pointerEvents={pointerOff ? 'none' : 'box-none'}
        style={[
          styles.wrap,
          {
            paddingBottom: bottom,
            opacity: barOpacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <View style={styles.pill}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={52}
              tint="dark"
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.pillFill]} />
          )}
          <LinearGradient
            pointerEvents="none"
            colors={[
              'rgba(255,255,255,0.16)',
              'rgba(255,255,255,0.04)',
              'transparent',
            ]}
            locations={[0, 0.4, 1]}
            style={styles.topSheen}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', 'rgba(0,0,0,0.4)']}
            style={styles.bottomShade}
          />
          <View style={styles.row}>
            <TabItem
              label="Mall"
              active={active === 'index'}
              icon={active === 'index' ? 'storefront' : 'storefront-outline'}
              onPress={() => go('index')}
            />
            <View style={styles.divider} />
            <TabItem
              label="Browse"
              active={active === 'search'}
              icon={active === 'search' ? 'search' : 'search-outline'}
              onPress={() => go('search')}
            />
          </View>
        </View>
      </Animated.View>

      {/* Cart only — Browse + Wishlist (no arrow) */}
            {showFloatingCart && (
        <View
          pointerEvents="box-none"
          style={[
            styles.cartDock,
            {
              // Same as ShowroomRoomNav default: bottomOffset 72 + safe area
              bottom: 94 + Math.max(insets.bottom - 4, 0),
            },
          ]}
        >
          <FloatingCartButton />
        </View>
      )}
    </>
  )
}

function TabItem({
  label,
  icon,
  active,
  onPress,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  active: boolean
  onPress: () => void
}) {
  const scale = useRef(new Animated.Value(1)).current
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 90,
          easing: EASE_SMOOTH,
          useNativeDriver: true,
        }).start()
      }}
      onPressOut={() => {
        Animated.timing(scale, {
          toValue: 1,
          duration: 180,
          easing: EASE_SMOOTH,
          useNativeDriver: true,
        }).start()
      }}
      style={styles.item}
      hitSlop={8}
    >
      <Animated.View style={[styles.itemInner, { transform: [{ scale }] }]}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={16} color={active ? GREEN : MUTED} />
        </View>
        <Text
          style={[styles.label, active && styles.labelActive]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <View style={[styles.activeDot, { opacity: active ? 1 : 0 }]} />
      </Animated.View>
    </Pressable>
  )
}

export default function TabLayout() {
  const { hubOpen, closeHub } = usePlazoreChrome()

  return (
    <ShowroomFlyCartProvider>
      <View style={{ flex: 1, backgroundColor: BG_SCREEN }}>
        <Tabs
          tabBar={(props) => <PlazoreTabsBar {...props} />}
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              position: 'absolute',
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              elevation: 0,
              height: 0,
            },
            tabBarShowLabel: false,
          }}
        >
          <Tabs.Screen name="index" options={{ title: 'Mall' }} />
          <Tabs.Screen name="search" options={{ title: 'Browse' }} />
          <Tabs.Screen name="favorites" options={{ title: 'Wishlist' }} />
          <Tabs.Screen name="cart" options={{ title: 'Cart' }} />
          <Tabs.Screen name="profile" options={{ href: null }} />
          <Tabs.Screen name="checkout" options={{ href: null }} />
          <Tabs.Screen name="lounge" options={{ href: null }} />
        </Tabs>
        <PlazoreNavigationHub visible={hubOpen} onClose={closeHub} />
      </View>
    </ShowroomFlyCartProvider>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 52,
    alignItems: 'center',
    zIndex: 100,
    elevation: 100,
  },
  cartDock: {
    position: 'absolute',
    right: 16,
    zIndex: 48,
  },
  pill: {
    width: '100%',
    maxWidth: 210,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(12,14,20,0.94)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.55,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 20 },
    }),
  },
  pillFill: {
    backgroundColor: 'rgba(16,18,26,0.98)',
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 16,
  },
  bottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingTop: 7,
    paddingBottom: 7,
    minHeight: 46,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 26,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.35,
    textAlign: 'center',
  },
  labelActive: {
    color: TEXT,
    fontWeight: '700',
  },
  activeDot: {
    marginTop: 3,
    width: 10,
    height: 2,
    backgroundColor: GREEN,
  },
})