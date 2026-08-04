import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** Soft gold accent — active music / notification dot */
const ACCENT = '#C9A962'
const ICON = '#FFFFFF'
const GLASS = 'rgba(12,12,12,0.82)'

type Props = {
  /** 0 = over hero (transparent), 1 = scrolled (glass) */
  scrollProgress: Animated.Value | number
  /** Unread notifications — shows elegant gold dot only */
  hasUnreadNotifications?: boolean
  onMenuPress?: () => void
  onMusicPress?: () => void
  onNotificationsPress?: () => void
  /** Controlled music visual (optional). If omitted, toggles locally for UI only. */
  musicOn?: boolean
}

function IconButton({
  onPress,
  children,
  accessibilityLabel,
}: {
  onPress?: () => void
  children: React.ReactNode
  accessibilityLabel: string
}) {
  const scale = useRef(new Animated.Value(1)).current
  const opacity = useRef(new Animated.Value(1)).current

  const pressIn = () => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.96,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.72,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const pressOut = () => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start()
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[styles.iconHit, { transform: [{ scale }], opacity }]}
      >
        {children}
      </Animated.View>
    </Pressable>
  )
}

/**
 * Plazore Title Bar — showroom control center
 * Floating over hero → sticky glass after scroll.
 * Architecture only: menu / music / notifications callbacks.
 */
export default function PlazoreTitleBar({
  scrollProgress,
  hasUnreadNotifications = false,
  onMenuPress,
  onMusicPress,
  onNotificationsPress,
  musicOn: musicControlled,
}: Props) {
  const insets = useSafeAreaInsets()
  const [musicLocal, setMusicLocal] = useState(false)
  const musicOn =
    typeof musicControlled === 'boolean' ? musicControlled : musicLocal

  const progress =
    typeof scrollProgress === 'number'
      ? scrollProgress
      : scrollProgress

  // Native-driver friendly interpolations when Animated.Value
  const isAnimated = typeof scrollProgress !== 'number'

  const glassOpacity = isAnimated
    ? (scrollProgress as Animated.Value).interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      })
    : progress

  const handleMusic = () => {
    if (typeof musicControlled !== 'boolean') {
      setMusicLocal((v) => !v)
    }
    onMusicPress?.()
  }

  const topPad = Math.max(insets.top, 12)

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: topPad }]}
    >
      {/* Glass layer — fades in as user leaves the hero */}
      {isAnimated ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: glassOpacity as any }]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS }]} />
          )}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: Platform.OS === 'ios' ? GLASS : 'transparent' },
            ]}
          />
        </Animated.View>
      ) : (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { opacity: glassOpacity as number },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS }]} />
          )}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor:
                  Platform.OS === 'ios' ? GLASS : 'transparent',
              },
            ]}
          />
        </View>
      )}

      {/* Soft top veil so white icons stay readable on bright hero frames */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0)']}
        style={styles.topVeil}
      />

      <View style={styles.row}>
        {/* LEFT — Navigation Hub toggle */}
        <View style={styles.side}>
          <IconButton
            onPress={onMenuPress}
            accessibilityLabel="Open navigation"
          >
            <Ionicons name="menu-outline" size={26} color={ICON} />
          </IconButton>
        </View>

        {/* CENTER — Wordmark (never shifts) */}
        <View style={styles.center} pointerEvents="none">
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* RIGHT — Music + Notifications */}
        <View style={[styles.side, styles.sideRight]}>
          <IconButton
            onPress={handleMusic}
            accessibilityLabel={musicOn ? 'Music on' : 'Music off'}
          >
            <Ionicons
              name={musicOn ? 'musical-notes' : 'musical-notes-outline'}
              size={22}
              color={musicOn ? ACCENT : ICON}
            />
          </IconButton>

          <IconButton
            onPress={onNotificationsPress}
            accessibilityLabel="Notifications"
          >
            <View>
              <Ionicons name="notifications-outline" size={22} color={ICON} />
              {hasUnreadNotifications ? (
                <View style={styles.dot} />
              ) : null}
            </View>
          </IconButton>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    overflow: 'hidden',
  },
  topVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 88,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    minHeight: 48,
  },
  side: {
    width: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sideRight: {
    justifyContent: 'flex-end',
    gap: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    height: 22,
    width: 120,
    tintColor: '#FFFFFF',
  },
  iconHit: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: ACCENT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(12,12,12,0.35)',
  },
})