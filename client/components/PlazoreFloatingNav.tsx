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

const BAR_BG = 'rgba(8, 9, 14, 0.96)'
const TEXT = '#F2F4F8'
const TEXT_MUTED = 'rgba(242,244,248,0.36)'
const ACTIVE = '#FFFFFF'
const CENTER_A = '#00D4C8'   // electric cyan
const CENTER_B = '#3A5BFF'   // deep electric indigo
const CART = '#2DD4BF'       // soft teal — secondary only

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1)

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
  const cartBreath = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const p = Math.min(1, Math.max(0, visibleProgress))
    Animated.timing(anim, {
      toValue: p,
      duration: 240,
      easing: EASE,
      useNativeDriver: true,
    }).start()
  }, [visibleProgress, anim])

  // Extremely quiet ambient breath — never spins, never screams
  useEffect(() => {
    if (itemCount > 0) {
      cartBreath.setValue(0)
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(cartBreath, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(cartBreath, {
            toValue: 0,
            duration: 2200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      )
      loop.start()
      return () => loop.stop()
    }
    cartBreath.setValue(0)
  }, [itemCount, cartBreath])

  const translateY = anim.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [120, 28, 0],
    extrapolate: 'clamp',
  })

  const opacity = anim.interpolate({
    inputRange: [0, 0.12, 0.35, 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  })

  const breathOpacity = cartBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.7],
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
        {/* sharp top light line */}
        <View style={styles.barTopEdge} pointerEvents="none" />
        {/* subtle bottom depth line */}
        <View style={styles.barBottomEdge} pointerEvents="none" />

        {/* 1. Mall */}
        <NavItem
          icon={isHome ? 'storefront' : 'storefront-outline'}
          label="Mall"
          active={!!isHome}
          onPress={() => go('/(tabs)')}
        />

        {/* 2. Search */}
        <NavItem
          icon={isSearch ? 'search' : 'search-outline'}
          label="Search"
          active={!!isSearch}
          onPress={() => go('/(tabs)/search')}
        />

        {/* 3. Lounge — architectural center pillar */}
        <Pressable
          onPress={onMenuPress}
          accessibilityRole="button"
          accessibilityLabel="Open navigation hub"
          style={styles.centerHit}
        >
          <LinearGradient
            colors={[CENTER_A, CENTER_B]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.centerBtn}
          >
            <View style={styles.centerInner}>
              <MaterialCommunityIcons name="pillar" size={22} color="#FFFFFF" />
            </View>
          </LinearGradient>
          <Text style={styles.centerLabel}>Lounge</Text>
        </Pressable>

        {/* 4. Cart — quiet teal accent */}
        <Pressable
          onPress={() => go('/(tabs)/cart')}
          style={styles.item}
          accessibilityRole="button"
          accessibilityLabel="Cart"
        >
          <View style={styles.cartIconWrap}>
            {hasCart && (
              <Animated.View
                pointerEvents="none"
                style={[styles.cartAccent, { opacity: breathOpacity }]}
              />
            )}

            <Ionicons
              name={isCart ? 'bag-handle' : 'bag-handle-outline'}
              size={22}
              color={hasCart ? CART : isCart ? ACTIVE : TEXT_MUTED}
            />

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
          toValue: 0.9,
          duration: 80,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.timing(scale, {
          toValue: 1,
          duration: 150,
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
    // pure rectangle — no radius
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.48,
        shadowRadius: 32,
      },
      android: { elevation: 20 },
    }),
  },
  barTopEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  barBottomEdge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    letterSpacing: 0.5,
  },
  itemLabelActive: {
    color: ACTIVE,
  },
  centerHit: {
    alignItems: 'center',
    marginTop: -28,
    paddingHorizontal: 4,
  },
  centerBtn: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    // sharp — no radius
    ...Platform.select({
      ios: {
        shadowColor: CENTER_B,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.55,
        shadowRadius: 16,
      },
      android: { elevation: 14 },
    }),
  },
  centerInner: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  centerLabel: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: 0.6,
  },
  cartIconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // thin vertical line that gently breathes — lives behind the icon
  cartAccent: {
    position: 'absolute',
    width: 1.5,
    height: 26,
    backgroundColor: CART,
    ...Platform.select({
      ios: {
        shadowColor: CART,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 4,
      },
      android: {},
    }),
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    backgroundColor: CART,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#08090E',
    // sharp rectangle — no radius
  },
  badgeText: {
    color: '#041412',
    fontSize: 9,
    fontWeight: '800',
  },
})