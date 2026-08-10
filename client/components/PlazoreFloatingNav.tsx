/**
 * PlazoreBottomNav — floor pill + symmetric fade (mirrors title bar)
 * Tabs: Mall · Browse · Lounge · Wishlist · Profile
 */

import { Ionicons } from '@expo/vector-icons'
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

const BAR_BG = '#0C0D12'
const TEXT = '#F2F4F8'
const TEXT_MUTED = 'rgba(242,244,248,0.38)'
const ACTIVE = '#FFFFFF'
const WISH = '#F472B6'
const CENTER_A = '#00D4C8'
const CENTER_B = '#3A5BFF'

const EASE = Easing.bezier(0.22, 1, 0.36, 1)

type Props = {
  visibleProgress: number
  /** Shared Animated.Value from Home — locks fade to scroll frames */
  progressAnim?: Animated.Value
  onMenuPress: () => void
}

export default function PlazoreFloatingNav({
  visibleProgress,
  progressAnim,
  onMenuPress,
}: Props) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const pathname = usePathname()

  const localAnim = useRef(new Animated.Value(0)).current
  const anim = progressAnim ?? localAnim

  // Only drive local anim when parent did not pass progressAnim
  useEffect(() => {
    if (progressAnim) return
    const p = Math.min(1, Math.max(0, visibleProgress))
    localAnim.setValue(p)
  }, [visibleProgress, progressAnim, localAnim])

  // Feathered curve: mirrors the title bar for a balanced, weightless entrance
  const opacity = anim.interpolate({
    inputRange: [0, 0.25, 0.75, 1],
    outputRange: [0, 0.1, 0.75, 1],
    extrapolate: 'clamp',
  })
  const translateY = anim.interpolate({
    inputRange: [0, 0.25, 0.75, 1],
    outputRange: [80, 60, 20, 0],
    extrapolate: 'clamp',
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

  const isWishlist =
    typeof pathname === 'string' &&
    (pathname.includes('favorites') || pathname.includes('wishlist'))

  const isProfile =
    typeof pathname === 'string' && pathname.includes('profile')

  const barHidden = visibleProgress < 0.08
  const floorPad = Math.max(insets.bottom, 8)

  return (
    <Animated.View
      pointerEvents={barHidden ? 'none' : 'box-none'}
      style={[
        styles.wrap,
        {
          paddingBottom: floorPad,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.pill}>
        <View style={styles.row}>
          <NavItem
            icon={isHome ? 'storefront' : 'storefront-outline'}
            label="Mall"
            active={!!isHome}
            onPress={() => go('/(tabs)')}
          />

          <NavItem
            icon={isSearch ? 'search' : 'search-outline'}
            label="Browse"
            active={!!isSearch}
            onPress={() => go('/(tabs)/search')}
          />

          <Pressable
            onPress={onMenuPress}
            accessibilityRole="button"
            accessibilityLabel="Open mall lounge"
            style={styles.centerHit}
          >
            <LinearGradient
              colors={[CENTER_A, CENTER_B]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={styles.centerBtn}
            >
              <Ionicons name="grid" size={22} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.centerLabel}>Lounge</Text>
          </Pressable>

          <NavItem
            icon={isWishlist ? 'heart' : 'heart-outline'}
            label="Wishlist"
            active={!!isWishlist}
            activeColor={WISH}
            onPress={() => go('/(tabs)/favorites')}
          />

          <NavItem
            icon={isProfile ? 'person' : 'person-outline'}
            label="Profile"
            active={!!isProfile}
            onPress={() => go('/(tabs)/profile')}
          />
        </View>
      </View>
    </Animated.View>
  )
}

function NavItem({
  icon,
  label,
  active,
  onPress,
  activeColor = ACTIVE,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  active: boolean
  onPress: () => void
  activeColor?: string
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
          duration: 160,
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
          size={20}
          color={active ? activeColor : TEXT_MUTED}
        />
        <Text style={[styles.itemLabel, active && { color: activeColor }]}>
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
  pill: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: BAR_BG,
    borderRadius: 28,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
      },
      android: { elevation: 18 },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
  },
  itemLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '600',
    color: TEXT_MUTED,
    letterSpacing: 0.3,
  },
  centerHit: {
    alignItems: 'center',
    marginTop: -22,
    paddingHorizontal: 4,
    minWidth: 64,
  },
  centerBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: BAR_BG,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 12 },
    }),
  },
  centerLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: 0.35,
  },
})