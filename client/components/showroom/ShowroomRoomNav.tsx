/**
 * ShowroomRoomNav — PLAZORE
 * Floating Cart + optional ↓ next-room.
 * Cart: solid 3D tile, fly-to-cart target, minimal motion.
 */

import { useShowroomFlyCart } from '@/components/showroom/ShowroomFlyCart'
import { useCart } from '@/context/CartContext'
import {
  CHROME_DURATION,
  CHROME_IN_END,
  CHROME_IN_START,
  EASE_SMOOTH,
} from '@/context/PlazoreChromeContext'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
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

const GREEN = '#00E575'
const MUTED = 'rgba(255,255,255,0.45)'
const TEXT = '#F5F7FA'

export const ROOM_NAV_H = 56

export type ShowroomRoomNavProps = {
  activeRoom: number
  roomCount: number
  visible: number
  onSelectRoom: (roomNumber: number) => void
  topOffset?: number
  bottomOffset?: number
  showNextRoom?: boolean
}

function toChrome(progress: number) {
  const p = Math.min(1, Math.max(0, progress))
  if (p <= CHROME_IN_START) return 0
  if (p >= CHROME_IN_END) return 1
  return (p - CHROME_IN_START) / (CHROME_IN_END - CHROME_IN_START)
}

/** Shared Cart — Mall, Browse, Wishlist */
export function FloatingCartButton() {
  const router = useRouter()
  const fly = useShowroomFlyCart()
  const cartCtx = useCart() as any
  const itemCount = Number(cartCtx?.itemCount ?? 0)
  const hasItems = itemCount > 0

  const scale = useRef(new Animated.Value(1)).current
  const badgeScale = useRef(new Animated.Value(1)).current
  const bagRef = useRef<View>(null)
  const prev = useRef(itemCount)

  useEffect(() => {
    if (itemCount > prev.current) {
      scale.setValue(1)
      badgeScale.setValue(0.6)
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.12,
            duration: 110,
            easing: EASE_SMOOTH,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 150,
            easing: EASE_SMOOTH,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(badgeScale, {
          toValue: 1,
          duration: 160,
          easing: EASE_SMOOTH,
          useNativeDriver: true,
        }),
      ]).start()
    }
    prev.current = itemCount
  }, [itemCount, scale, badgeScale])

  const registerBag = () => {
    requestAnimationFrame(() => {
      bagRef.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) fly?.registerTarget?.(x + w / 2, y + h / 2)
      })
    })
  }

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/cart' as any)}
      accessibilityRole="button"
      accessibilityLabel="Cart"
      hitSlop={6}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Animated.View
        ref={bagRef}
        collapsable={false}
        onLayout={registerBag}
        style={[styles.tile, { transform: [{ scale }] }]}
      >
        {/* Base */}
        <View style={styles.tileFill} />

        {/* Top light edge */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.04)', 'transparent']}
          locations={[0, 0.45, 1]}
          style={styles.tileSheen}
        />

        {/* Bottom depth */}
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', 'rgba(0,0,0,0.45)']}
          style={styles.tileShade}
        />

        {/* Active left accent bar */}
        {hasItems && <View style={styles.accentBar} />}

        <Ionicons
          name={hasItems ? 'bag-handle' : 'bag-handle-outline'}
          size={18}
          color={hasItems ? GREEN : MUTED}
        />

        {hasItems && (
          <Animated.View
            style={[styles.badge, { transform: [{ scale: badgeScale }] }]}
          >
            <Text style={styles.badgeText}>
              {itemCount > 99 ? '99+' : itemCount}
            </Text>
          </Animated.View>
        )}
      </Animated.View>

      <Text style={[styles.label, hasItems && styles.labelOn]}>Bag</Text>
    </Pressable>
  )
}

export default function ShowroomRoomNav({
  activeRoom,
  roomCount,
  visible,
  onSelectRoom,
  bottomOffset = 72,
  showNextRoom = true,
}: ShowroomRoomNavProps) {
  const insets = useSafeAreaInsets()
  const chrome = useRef(new Animated.Value(0)).current
  const last = useRef(0)

  const count = Math.max(1, roomCount)
  const active = Math.min(count, Math.max(1, activeRoom))
  const bottom = bottomOffset + Math.max(insets.bottom - 4, 0)

  useEffect(() => {
    const t = toChrome(visible)
    if (Math.abs(t - last.current) < 0.06) {
      chrome.setValue(t)
    } else {
      chrome.stopAnimation()
      Animated.timing(chrome, {
        toValue: t,
        duration: CHROME_DURATION,
        easing: EASE_SMOOTH,
        useNativeDriver: true,
      }).start()
    }
    last.current = t
  }, [visible, chrome])

  const goNextRoom = () => {
    onSelectRoom(active >= count ? 1 : active + 1)
  }

  const pointerOff = visible < CHROME_IN_START + 0.01

  return (
    <Animated.View
      pointerEvents={pointerOff ? 'none' : 'box-none'}
      style={[
        styles.dock,
        {
          left: 16,
          right: 16,
          bottom,
          opacity: chrome,
          transform: [
            {
              translateY: chrome.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.row}>
        {showNextRoom ? (
          <Pressable
            onPress={goNextRoom}
            hitSlop={10}
            style={({ pressed }) => pressed && { opacity: 0.6 }}
            accessibilityRole="button"
            accessibilityLabel="Next room"
          >
            <View style={styles.arrow}>
              <Ionicons name="chevron-down" size={14} color="#FFFFFF" />
            </View>
          </Pressable>
        ) : (
          <View style={styles.arrowSpacer} />
        )}

        <FloatingCartButton />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    zIndex: 48,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
  },
  arrowSpacer: {
    width: 26,
    height: 26,
  },
  arrow: {
    width: 26,
    height: 26,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,14,20,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 8 },
    }),
  },
  pressed: {
    opacity: 0.88,
  },
  tile: {
    width: 44,
    height: 44,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.55,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 14 },
    }),
  },
  tileFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14,16,22,0.96)',
  },
  tileSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 16,
  },
  tileShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 12,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#1D4ED8',
  },
  label: {
    marginTop: 5,
    color: MUTED,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  labelOn: {
    color: '#FFFFFF',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -6,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
    borderWidth: 2,
    borderColor: '#090B0F',
  },
  badgeText: {
    color: '#041412',
    fontSize: 9,
    fontWeight: '900',
  },
})