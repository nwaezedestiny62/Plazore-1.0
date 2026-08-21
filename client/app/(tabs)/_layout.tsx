import PlazoreNavigationHub from '@/components/PlazoreNavigationHub'
import {
  ShowroomFlyCartProvider,
  useShowroomFlyCart,
} from '@/components/showroom/ShowroomFlyCart'
import { useCart } from '@/context/CartContext'
import { usePlazoreChrome } from '@/context/PlazoreChromeContext'
import { useSoundtrack } from '@/context/SoundtrackContext'
import { Ionicons } from '@expo/vector-icons'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { Tabs } from 'expo-router'
import React, { useEffect, useRef } from 'react'
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const BG_SCREEN = '#090B0F'
const MUTED = 'rgba(255,255,255,0.42)'
const TEXT = '#F5F7FA'
const GREEN = '#00E575'
const BLUE = '#2563EB'
const PINK = '#F472B6'
const LOGO_GRADIENT = [GREEN, '#14B8A6', BLUE] as const

/** Must match PlazoreTitleBar exactly */
const CHROME_IN_START = 0.02
const CHROME_IN_END = 0.55
const CHROME_DURATION = 420
const EASE_SMOOTH = Easing.bezier(0.22, 0.61, 0.36, 1)

const NAV_VISIBLE_ROUTES = new Set(['index', 'search', 'favorites'])

function scrollToNavVisibility(progress: number) {
  const p = Math.min(1, Math.max(0, progress))
  if (p <= CHROME_IN_START) return 0
  if (p >= CHROME_IN_END) return 1
  return (p - CHROME_IN_START) / (CHROME_IN_END - CHROME_IN_START)
}

function PlazoreTabsBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { scrollProgress, homeChrome, openHub } = usePlazoreChrome()
  const fly = useShowroomFlyCart()
  const cartCtx = useCart() as any
  const itemCount = Number(cartCtx?.itemCount ?? 0)
  const { unlock: unlockSoundtrack } = useSoundtrack()

  const visibility = useRef(new Animated.Value(0)).current
  const bagScale = useRef(new Animated.Value(1)).current
  const bagRotate = useRef(new Animated.Value(0)).current
  const pulse = useRef(new Animated.Value(0)).current
  const badgePop = useRef(new Animated.Value(1)).current
  const bagRef = useRef<View>(null)
  const prevCount = useRef(itemCount)

  const active = state.routes[state.index]?.name
  const onAllowedScreen = NAV_VISIBLE_ROUTES.has(active)

  useEffect(() => {
    let t = 0
    if (onAllowedScreen) {
      if (active === 'index' && homeChrome) {
        t = scrollToNavVisibility(scrollProgress)
      } else {
        t = 1
      }
    }
    Animated.timing(visibility, {
      toValue: t,
      duration: CHROME_DURATION,
      easing: EASE_SMOOTH,
      useNativeDriver: true,
    }).start()
  }, [scrollProgress, homeChrome, active, onAllowedScreen, visibility])

  useEffect(() => {
    if (itemCount > prevCount.current) {
      bagScale.setValue(1)
      bagRotate.setValue(0)
      pulse.setValue(0)
      badgePop.setValue(0.4)

      Animated.parallel([
        Animated.sequence([
          Animated.timing(bagScale, {
            toValue: 1.28,
            duration: 140,
            easing: Easing.out(Easing.back(2)),
            useNativeDriver: true,
          }),
          Animated.timing(bagScale, {
            toValue: 1,
            duration: 220,
            easing: EASE_SMOOTH,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(bagRotate, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(bagRotate, {
            toValue: -1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(bagRotate, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 280,
            easing: EASE_SMOOTH,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(badgePop, {
          toValue: 1,
          friction: 4,
          tension: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
    prevCount.current = itemCount
  }, [itemCount, bagScale, bagRotate, pulse, badgePop])

  const registerBag = () => {
    requestAnimationFrame(() => {
      bagRef.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) fly?.registerTarget?.(x + w / 2, y + h / 2)
      })
    })
  }

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

  const onLounge = () => {
    unlockSoundtrack()
    openHub()
  }

  const bottom = Math.max(insets.bottom, 6) + 4
  const cartOn = active === 'cart' || itemCount > 0
  const pointerOff =
    !onAllowedScreen ||
    (active === 'index' && homeChrome && scrollProgress < CHROME_IN_START)

  /** Gentle rise — pairs with title bar’s soft fade */
  const translateY = visibility.interpolate({
    inputRange: [0, 1],
    outputRange: [22, 0],
  })

  const bagWiggle = bagRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-12deg', '0deg', '12deg'],
  })
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.1],
  })
  const pulseOp = pulse.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.45, 0],
  })

  return (
    <Animated.View
      pointerEvents={pointerOff ? 'none' : 'box-none'}
      style={[
        styles.wrap,
        {
          paddingBottom: bottom,
          opacity: visibility,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.pill}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={48}
            tint="dark"
            style={[StyleSheet.absoluteFillObject, styles.pillRadius]}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.pillFill]} />
        )}
        <View style={styles.pillTint} />

        <View style={styles.row}>
          <TabItem
            label="Mall"
            active={active === 'index'}
            icon={active === 'index' ? 'storefront' : 'storefront-outline'}
            onPress={() => go('index')}
          />

          <TabItem
            label="Browse"
            active={active === 'search'}
            icon={active === 'search' ? 'search' : 'search-outline'}
            onPress={() => go('search')}
          />

          <Pressable
            onPress={onLounge}
            style={styles.loungeSlot}
            accessibilityRole="button"
            accessibilityLabel="Lounge"
          >
            <View style={styles.loungeOrb}>
              <LinearGradient
                colors={[...LOGO_GRADIENT]}
                locations={[0, 0.45, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.loungeShine} />
              <Ionicons name="grid" size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.loungeLabel}>Lounge</Text>
          </Pressable>

          <TabItem
            label="Wishlist"
            active={active === 'favorites'}
            icon={active === 'favorites' ? 'heart' : 'heart-outline'}
            color={PINK}
            onPress={() => go('favorites')}
          />

          <Pressable
            onPress={() => go('cart')}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel="Cart"
          >
            <View
              ref={bagRef}
              collapsable={false}
              onLayout={registerBag}
              style={styles.cartIconBox}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.cartPulse,
                  {
                    opacity: pulseOp,
                    transform: [{ scale: pulseScale }],
                  },
                ]}
              >
                <LinearGradient
                  colors={[GREEN, BLUE]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>

              <Animated.View
                style={{
                  transform: [{ scale: bagScale }, { rotate: bagWiggle }],
                }}
              >
                {cartOn ? (
                  <View style={styles.cartActiveWrap}>
                    <LinearGradient
                      colors={[...LOGO_GRADIENT]}
                      locations={[0, 0.5, 1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cartActiveBg}
                    />
                    <Ionicons name="bag-handle" size={15} color="#FFFFFF" />
                  </View>
                ) : (
                  <Ionicons name="bag-handle-outline" size={18} color={MUTED} />
                )}
              </Animated.View>

              {itemCount > 0 && (
                <Animated.View
                  style={[styles.badge, { transform: [{ scale: badgePop }] }]}
                >
                  <LinearGradient
                    colors={['#00E575', '#14B8A6', '#2563EB']}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text style={styles.badgeText}>
                    {itemCount > 99 ? '99+' : itemCount}
                  </Text>
                </Animated.View>
              )}
            </View>

            <Text
              style={[
                styles.label,
                cartOn && { color: GREEN, fontWeight: '700' },
              ]}
            >
              Cart
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  )
}

function TabItem({
  label,
  icon,
  active,
  onPress,
  color = GREEN,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  active: boolean
  onPress: () => void
  color?: string
}) {
  return (
    <Pressable onPress={onPress} style={styles.item} hitSlop={6}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={18} color={active ? color : MUTED} />
      </View>
      <Text style={[styles.label, active && { color, fontWeight: '700' }]}>
        {label}
      </Text>
      {active && (
        <View style={[styles.activeDot, { backgroundColor: color }]} />
      )}
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
          screenOptions={{ headerShown: false }}
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
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  pill: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'visible',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(12,14,20,0.94)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 14 },
    }),
  },
  pillRadius: { borderRadius: 24 },
  pillFill: {
    backgroundColor: 'rgba(18,20,28,0.96)',
    borderRadius: 24,
  },
  pillTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 20,
    paddingBottom: 8,
    minHeight: 62,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 1,
    height: 44,
  },
  iconBox: {
    width: 24,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.15,
  },
  activeDot: {
    marginTop: 3,
    width: 12,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: GREEN,
  },
  loungeSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: -22,
    paddingBottom: 1,
  },
  loungeOrb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.16)',
    ...Platform.select({
      ios: {
        shadowColor: GREEN,
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 10 },
    }),
  },
  loungeShine: {
    position: 'absolute',
    top: 3,
    left: 7,
    right: 7,
    height: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  loungeLabel: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: 0.15,
  },
  cartIconBox: {
    width: 34,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  cartActiveWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartActiveBg: {
    ...StyleSheet.absoluteFillObject,
  },
  cartPulse: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0B0D12',
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#00E575',
        shadowOpacity: 0.5,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 6 },
    }),
  },
  badgeText: {
    color: '#041412',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: -0.2,
    zIndex: 1,
  },
})