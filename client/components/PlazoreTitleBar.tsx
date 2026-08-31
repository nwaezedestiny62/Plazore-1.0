/**
 * PlazoreTitleBar
 * - Always visible (no fade out / slide away)
 * - Background darkens smoothly with scrollProgress
 * - Menu + logo + wishlist (count) + notifications (count)
 */

import api from '@/constants/api'
import { useWishlist } from '@/context/WishlistContext'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const ACCENT = '#C9A962'
const ICON = '#FFFFFF'
const EASE_SMOOTH = Easing.bezier(0.22, 0.61, 0.36, 1)

export const CHROME_IN_START = 0.02
export const CHROME_IN_END = 0.72
export const CHROME_DURATION = 520

const BAR_H = 56
const UNREAD_POLL_MS = 45000

type Props = {
  scrollProgress: number
  unreadCount?: number
  onMenuPress?: () => void
  onNotificationsPress?: () => void
  onWishlistPress?: () => void
}

function formatBadge(n: number) {
  if (!n || n < 1) return ''
  if (n > 99) return '99+'
  return String(n)
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

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0.92,
            duration: 140,
            easing: EASE_SMOOTH,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.72,
            duration: 140,
            easing: EASE_SMOOTH,
            useNativeDriver: true,
          }),
        ]).start()
      }}
      onPressOut={() => {
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 220,
            easing: EASE_SMOOTH,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 220,
            easing: EASE_SMOOTH,
            useNativeDriver: true,
          }),
        ]).start()
      }}
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

function MenuToggle({ onPress }: { onPress?: () => void }) {
  const scale = useRef(new Animated.Value(1)).current
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 120,
          easing: EASE_SMOOTH,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.timing(scale, {
          toValue: 1,
          duration: 200,
          easing: EASE_SMOOTH,
          useNativeDriver: true,
        }).start()
      }
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel="Open navigation"
      style={styles.iconHit}
    >
      <Animated.View style={[styles.menuLines, { transform: [{ scale }] }]}>
        <View style={[styles.line, { width: 22 }]} />
        <View style={[styles.line, { width: 15 }]} />
        <View style={[styles.line, { width: 22 }]} />
      </Animated.View>
    </Pressable>
  )
}

function CountBadge({ count }: { count: number }) {
  const label = formatBadge(count)
  if (!label) return null
  const wide = label.length >= 3
  return (
    <View style={[styles.badge, wide && styles.badgeWide]}>
      <Text style={styles.badgeText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

function isUnreadNotif(n: any): boolean {
  if (!n) return false
  if (typeof n.isRead === 'boolean') return n.isRead === false
  if (typeof n.read === 'boolean') return n.read === false
  if (typeof n.unread === 'boolean') return n.unread === true
  return false
}

export default function PlazoreTitleBar({
  scrollProgress,
  unreadCount: unreadProp,
  onMenuPress,
  onNotificationsPress,
  onWishlistPress,
}: Props) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { getToken, isSignedIn } = useAuth()

  // Wishlist count from shared context (live when items toggle)
  let wishlistCount = 0
  try {
    const wl = useWishlist() as { wishlist?: unknown[] } | undefined
    wishlistCount = Array.isArray(wl?.wishlist) ? wl!.wishlist!.length : 0
  } catch {
    wishlistCount = 0
  }

  const [logoLoaded, setLogoLoaded] = useState(false)
  const [countFromApi, setCountFromApi] = useState(0)

  const unreadCount =
    typeof unreadProp === 'number' ? unreadProp : countFromApi

  const anim = useRef(new Animated.Value(0)).current
  const logoOpacity = useRef(new Animated.Value(0)).current
  const textOpacity = useRef(new Animated.Value(1)).current

  const refreshUnread = useCallback(async () => {
    if (!isSignedIn) {
      setCountFromApi(0)
      return
    }
    try {
      const token = await getToken()
      if (!token) {
        setCountFromApi(0)
        return
      }
      const res = await api.get('/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const list = res.data?.data || res.data?.notifications || res.data || []
      const arr = Array.isArray(list) ? list : []
      setCountFromApi(arr.filter(isUnreadNotif).length)
    } catch {
      /* keep last */
    }
  }, [getToken, isSignedIn])

  useFocusEffect(
    useCallback(() => {
      refreshUnread()
    }, [refreshUnread])
  )

  useEffect(() => {
    refreshUnread()
    const id = setInterval(refreshUnread, UNREAD_POLL_MS)
    return () => clearInterval(id)
  }, [refreshUnread])

  useEffect(() => {
    StatusBar.setBarStyle('light-content', true)
    if (Platform.OS === 'android') {
      StatusBar.setTranslucent(true)
      StatusBar.setBackgroundColor('transparent', true)
      StatusBar.setHidden(false)
    }
  }, [])

  useEffect(() => {
    if (logoLoaded) {
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 480,
          easing: EASE_SMOOTH,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 360,
          easing: EASE_SMOOTH,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      logoOpacity.setValue(0)
      textOpacity.setValue(1)
    }
  }, [logoLoaded, logoOpacity, textOpacity])

  useEffect(() => {
    const p = Math.min(1, Math.max(0, scrollProgress))
    anim.stopAnimation()
    Animated.timing(anim, {
      toValue: p,
      duration: CHROME_DURATION,
      easing: EASE_SMOOTH,
      useNativeDriver: true,
    }).start()
  }, [scrollProgress, anim])

  // transparent until ~6% scroll, then lock to solid glass
const glassOpacity = anim.interpolate({
  inputRange: [0, 0.04, 0.08, 1],
  outputRange: [0, 0, 0.88, 0.92],
  extrapolate: 'clamp',
})

const veilOpacity = anim.interpolate({
  inputRange: [0, 0.04, 0.08, 1],
  outputRange: [0, 0, 0.55, 0.72],
  extrapolate: 'clamp',
})

const borderOpacity = anim.interpolate({
  inputRange: [0, 0.05, 0.1, 1],
  outputRange: [0, 0, 1, 1],
  extrapolate: 'clamp',
})

  const handleNotifications = () => {
    if (onNotificationsPress) {
      onNotificationsPress()
      return
    }
    router.push('/notifications' as any)
  }

  const handleWishlist = () => {
    if (onWishlistPress) {
      onWishlistPress()
      return
    }
    router.push('/favorites' as any)
  }

  const statusTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 20,
    20
  )

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: statusTop }]}
    >
      <View style={styles.band}>
        <Animated.View
          pointerEvents="none"
          style={[styles.glass, { opacity: glassOpacity }]}
        >
          {Platform.OS === 'ios' ? (
  <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
) : (
  <View
    style={[
      StyleSheet.absoluteFill,
      { backgroundColor: 'rgba(9,11,15,0.88)' }, // was 8,8,10
    ]}
  />
)}
        </Animated.View>

        <Animated.View
  pointerEvents="none"
  style={[
    StyleSheet.absoluteFill,
    { backgroundColor: '#090B0F', opacity: veilOpacity },
  ]}
/>
<Animated.View
  style={[styles.bottomRule, { opacity: borderOpacity }]}
  pointerEvents="none"
>
  <LinearGradient
    colors={[
      'transparent',
      'rgba(255,255,255,0.2)',
      'rgba(255,255,255,0.35)',
      'rgba(255,255,255,0.2)',
      'transparent',
    ]}
    locations={[0, 0.18, 0.5, 0.82, 1]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={styles.bottomLine}
  />
</Animated.View>
        <View style={styles.row}>
          <View style={styles.sideLeft}>
            <MenuToggle onPress={onMenuPress} />
          </View>

          <View style={styles.center} pointerEvents="none">
            <Animated.View style={[styles.logoLayer, { opacity: textOpacity }]}>
              <Text style={styles.logoFallback}>PLAZORE</Text>
            </Animated.View>
            <Animated.View style={[styles.logoLayer, { opacity: logoOpacity }]}>
              <Image
                source={require('../assets/logo-1.png')}
                style={styles.logo}
                resizeMode="contain"
                onLoad={() => setLogoLoaded(true)}
                onError={() => setLogoLoaded(false)}
              />
            </Animated.View>
          </View>

          <View style={styles.sideRight}>
            <IconButton
              onPress={handleWishlist}
              accessibilityLabel={
                wishlistCount > 0
                  ? `Wishlist, ${wishlistCount} items`
                  : 'Wishlist'
              }
            >
              <View style={styles.iconWrap}>
                <Ionicons
                  name={wishlistCount > 0 ? 'heart' : 'heart-outline'}
                  size={22}
                  color={ICON}
                />
                <CountBadge count={wishlistCount} />
              </View>
            </IconButton>

            <IconButton
              onPress={handleNotifications}
              accessibilityLabel={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : 'Notifications'
              }
            >
              <View style={styles.iconWrap}>
                <Ionicons
                  name={
                    unreadCount > 0 ? 'notifications' : 'notifications-outline'
                  }
                  size={22}
                  color={ICON}
                />
                <CountBadge count={unreadCount} />
              </View>
            </IconButton>
          </View>
        </View>

        <View style={styles.bottomRule} pointerEvents="none">
          <LinearGradient
            colors={[
              'transparent',
              'rgba(255,255,255,0.45)',
              'rgba(255,255,255,0.9)',
              'rgba(255,255,255,0.45)',
              'transparent',
            ]}
            locations={[0, 0.18, 0.5, 0.82, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bottomLine}
          />
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
  },
  band: {
    height: BAR_H,
    justifyContent: 'flex-end',
  },
  glass: {
    ...StyleSheet.absoluteFillObject,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    zIndex: 2,
  },
  sideLeft: {
    width: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    minWidth: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: BAR_H,
  },
  logoLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallback: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
  },
  logo: {
    height: 52,
    width: 140,
  },
  iconHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLines: {
    width: 22,
    gap: 5.5,
    alignItems: 'flex-start',
  },
  line: {
    height: 2.6,
    backgroundColor: ICON,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(12,12,12,0.55)',
  },
  badgeWide: {
    minWidth: 22,
    paddingHorizontal: 3,
    right: -12,
  },
  badgeText: {
    color: '#0C0C0C',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  bottomRule: {
    height: 1,
    marginHorizontal: 16,
  },
  bottomLine: {
    height: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.35,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
    }),
  },
})