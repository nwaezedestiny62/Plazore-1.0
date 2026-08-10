import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useCart } from '@/context/CartContext'
import { LinearGradient } from 'expo-linear-gradient'
import { usePathname, useRouter } from 'expo-router'
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

const BAR_BG = 'rgba(8, 9, 14, 0.97)'
const TEXT = '#F2F4F8'
const TEXT_MUTED = 'rgba(242,244,248,0.38)'
const ACTIVE = '#FFFFFF'
const CENTER_A = '#00D4C8'
const CENTER_B = '#3A5BFF'
const CART = '#2DD4BF'

const EASE = Easing.bezier(0.22, 1, 0.36, 1)

type Props = {
  visibleProgress: number
  onMenuPress: () => void
}

export default function PlazoreFloatingNav({
  visibleProgress,
  onMenuPress,
}: Props) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const pathname = usePathname()
  const { itemCount } = useCart()

  const anim = useRef(new Animated.Value(0)).current
  const cartPulse = useRef(new Animated.Value(0)).current
  const cartScale = useRef(new Animated.Value(1)).current
  const pillarGlow = useRef(new Animated.Value(0)).current
  const prevCount = useRef(itemCount)

  // Entrance / exit
  useEffect(() => {
    const p = Math.min(1, Math.max(0, visibleProgress))
    Animated.timing(anim, {
      toValue: p,
      duration: 280,
      easing: EASE,
      useNativeDriver: true,
    }).start()
  }, [visibleProgress, anim])

  // Soft living glow on the Lounge pillar
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pillarGlow, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pillarGlow, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pillarGlow])

  // Cart add animation — elegant scale + soft pulse
  useEffect(() => {
    if (itemCount > prevCount.current) {
      // Item was added
      cartScale.setValue(1)
      cartPulse.setValue(0)

      Animated.parallel([
        Animated.sequence([
          Animated.timing(cartScale, {
            toValue: 1.22,
            duration: 160,
            easing: Easing.out(Easing.back(1.6)),
            useNativeDriver: true,
          }),
          Animated.timing(cartScale, {
            toValue: 1,
            duration: 280,
            easing: EASE,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(cartPulse, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(cartPulse, {
            toValue: 0,
            duration: 480,
            easing: EASE,
            useNativeDriver: true,
          }),
        ]),
      ]).start()
    }
    prevCount.current = itemCount
  }, [itemCount, cartScale, cartPulse])

  const translateY = anim.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [110, 24, 0],
    extrapolate: 'clamp',
  })

  const opacity = anim.interpolate({
    inputRange: [0, 0.15, 0.4, 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  })

  const pulseScale = cartPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  })

  const pulseOpacity = cartPulse.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.35, 0],
  })

  const pillarGlowOpacity = pillarGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  })

  const go = (href: string) => {
    try {
      router.push(href as any)
    } catch {}
  }

  const isHome =
    pathname === '/' ||
    pathname === '/(tabs)' ||
    pathname === '/(tabs)/' ||
    pathname?.endsWith('/index')

  const isSearch =
    typeof pathname === 'string' && pathname.includes('search')

  const isCart =
    typeof pathname === 'string' && pathname.includes('cart')

  const isProfile =
    typeof pathname === 'string' && pathname.includes('profile')

  const bottomPad = Math.max(insets.bottom, 12)
  const barHidden = visibleProgress < 0.12
  const hasCart = itemCount > 0

  return (
    <Animated.View
      pointerEvents={barHidden ? 'none' : 'box-none'}
      style={[
        styles.wrap,
        {
          paddingBottom: bottomPad,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.bar}>
        <View style={styles.barTopEdge} pointerEvents="none" />
        <View style={styles.barBottomEdge} pointerEvents="none" />

        {/* 1. Mall */}
        <NavItem
          icon={isHome ? 'storefront' : 'storefront-outline'}
          label="Mall"
          active={!!isHome}
          onPress={() => go('/(tabs)')}
        />

        {/* 2. Browse */}
        <NavItem
          icon={isSearch ? 'search' : 'search-outline'}
          label="Browse"
          active={!!isSearch}
          onPress={() => go('/(tabs)/search')}
        />

        {/* 3. Lounge — living center pillar */}
        {/* 3. Lounge — sharp 3D architectural pillar */}
<Pressable
  onPress={onMenuPress}
  accessibilityRole="button"
  accessibilityLabel="Open navigation hub"
  style={styles.centerHit}
>
  <View style={styles.centerOuter}>
    {/* Outer depth layer */}
    <View style={styles.centerDepth} />

    <LinearGradient
      colors={[CENTER_A, CENTER_B]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.centerBtn}
    >
      {/* Top highlight for 3D edge */}
      <View style={styles.centerHighlight} />

      <View style={styles.centerInner}>
        <MaterialCommunityIcons name="pillar" size={22} color="#FFFFFF" />
      </View>
    </LinearGradient>
  </View>
  <Text style={styles.centerLabel}>Lounge</Text>
</Pressable>

        {/* 4. Cart — refined add animation */}
        <Pressable
          onPress={() => go('/(tabs)/cart')}
          style={styles.item}
          accessibilityRole="button"
          accessibilityLabel="Cart"
        >
          <View style={styles.cartIconWrap}>
            {/* Soft expanding ring when item is added */}
            {hasCart && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.cartPulseRing,
                  {
                    opacity: pulseOpacity,
                    transform: [{ scale: pulseScale }],
                  },
                ]}
              />
            )}

            <Animated.View style={{ transform: [{ scale: cartScale }] }}>
              <Ionicons
                name={isCart ? 'bag-handle' : 'bag-handle-outline'}
                size={22}
                color={hasCart ? CART : isCart ? ACTIVE : TEXT_MUTED}
              />
            </Animated.View>

            {hasCart && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {itemCount > 99 ? '99+' : String(itemCount)}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.itemLabel,
              (isCart || hasCart) && styles.itemLabelActive,
              hasCart && { color: CART },
            ]}
          >
            Cart
          </Text>
        </Pressable>

        {/* 5. Profile */}
        <NavItem
          icon={isProfile ? 'person' : 'person-outline'}
          label="Profile"
          active={!!isProfile}
          onPress={() => go('/(tabs)/profile')}
        />
      </View>
    </Animated.View>
  )
}

function NavItem({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  active: boolean
  onPress: () => void
}) {
  const scale = useRef(new Animated.Value(1)).current

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.timing(scale, {
          toValue: 0.88,
          duration: 90,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.timing(scale, {
          toValue: 1,
          duration: 180,
          easing: EASE,
          useNativeDriver: true,
        }).start()
      }
      style={styles.item}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={{ alignItems: 'center', transform: [{ scale }] }}>
        <Ionicons
          name={icon}
          size={22}
          color={active ? ACTIVE : TEXT_MUTED}
        />
        <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: BAR_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 6,
    paddingTop: 14,
    paddingBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.5,
        shadowRadius: 34,
      },
      android: { elevation: 22 },
    }),
  },
  barTopEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  barBottomEdge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  itemLabel: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_MUTED,
    letterSpacing: 0.4,
  },
  itemLabelActive: {
    color: ACTIVE,
  },

  // Center Lounge — 3D architectural
centerHit: {
  alignItems: 'center',
  marginTop: -30,
  paddingHorizontal: 4,
},
centerOuter: {
  width: 56,
  height: 56,
  alignItems: 'center',
  justifyContent: 'center',
},
centerDepth: {
  position: 'absolute',
  width: 56,
  height: 56,
  backgroundColor: 'rgba(0,0,0,0.45)',
  top: 4,
  left: 2,
},
centerBtn: {
  width: 54,
  height: 54,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1.5,
  borderColor: 'rgba(255,255,255,0.28)',
  overflow: 'hidden',
  ...Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.55,
      shadowRadius: 16,
    },
    android: { elevation: 18 },
  }),
},
centerHighlight: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 1.5,
  backgroundColor: 'rgba(255,255,255,0.35)',
},
centerInner: {
  width: 44,
  height: 44,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: 'rgba(255,255,255,0.18)',
  backgroundColor: 'rgba(0,0,0,0.12)',
},
centerLabel: {
  marginTop: 6,
  fontSize: 10,
  fontWeight: '700',
  color: TEXT,
  letterSpacing: 0.5,
},

  // Cart
  cartIconWrap: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartPulseRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: CART,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -11,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    backgroundColor: CART,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#08090E',
  },
  badgeText: {
    color: '#041412',
    fontSize: 9,
    fontWeight: '800',
  },
})