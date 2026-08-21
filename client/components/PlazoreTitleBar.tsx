/**
 * PlazoreTitleBar
 * - Unread count badge (no jiggle)
 * - Tap bell → /notifications
 * - Ambient soundtrack from SoundtrackContext
 */

import api from '@/constants/api'
import { useSoundtrack } from '@/context/SoundtrackContext'
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
const MUTED_ICON = 'rgba(255,255,255,0.42)'
const GLASS = 'rgba(8,8,10,0.55)'
const EASE_SMOOTH = Easing.bezier(0.22, 0.61, 0.36, 1)

export const CHROME_IN_START = 0.02
export const CHROME_IN_END = 0.72
export const CHROME_DURATION = 520

const BAR_H = 56
const UNREAD_POLL_MS = 45000

type Props = {
  scrollProgress: number
  /** Optional override count — if omitted, loads from API */
  unreadCount?: number
  onMenuPress?: () => void
  onNotificationsPress?: () => void
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
      hitSlop={14}
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
}: Props) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { getToken, isSignedIn } = useAuth()
  const { enabled, setEnabled, unlock } = useSoundtrack()

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
      const n = arr.filter(isUnreadNotif).length
      setCountFromApi(n)
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

  const slideUp = anim.interpolate({
    inputRange: [0, CHROME_IN_START, CHROME_IN_END, 1],
    outputRange: [0, 0, -12, -28],
    extrapolate: 'clamp',
  })

  // Keep a soft overlap with the room chain so the top chrome never blinks
  // off before the next layer is visually established.
  const barOpacity = anim.interpolate({
    inputRange: [0, CHROME_IN_START, CHROME_IN_END, 1],
    outputRange: [1, 0.99, 0.46, 0],
    extrapolate: 'clamp',
  })

  const glassOpacity = anim.interpolate({
    inputRange: [0, CHROME_IN_START, CHROME_IN_END, 1],
    outputRange: [0.22, 0.25, 0.12, 0],
    extrapolate: 'clamp',
  })

  const handleMusic = () => {
    unlock()
    setEnabled(!enabled)
  }

  const handleNotifications = () => {
    if (onNotificationsPress) {
      onNotificationsPress()
      return
    }
    router.push('/notifications' as any)
  }

  const statusTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 20,
    20
  )
  const hidden = scrollProgress > 0.86
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={[
        styles.wrap,
        {
          paddingTop: statusTop,
          opacity: barOpacity,
          transform: [{ translateY: slideUp }],
        },
      ]}
    >
      <View style={styles.band}>
        <Animated.View
          pointerEvents="none"
          style={[styles.glass, { opacity: glassOpacity }]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={36}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: GLASS }]}
            />
          )}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.18)' },
            ]}
          />
        </Animated.View>

        <View style={styles.row}>
          <View style={styles.side}>
            <MenuToggle onPress={onMenuPress} />
          </View>

          <View style={styles.center} pointerEvents="none">
            <Animated.View style={[styles.logoLayer, { opacity: textOpacity }]}>
              <Text style={styles.logoFallback}>PLAZORE</Text>
            </Animated.View>
            <Animated.View style={[styles.logoLayer, { opacity: logoOpacity }]}>
              <Image
                source={require('../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
                onLoad={() => setLogoLoaded(true)}
                onError={() => setLogoLoaded(false)}
              />
            </Animated.View>
          </View>

          <View style={[styles.side, styles.sideRight]}>
            <IconButton
              onPress={handleMusic}
              accessibilityLabel={
                enabled ? 'Ambient Soundtrack On' : 'Ambient Soundtrack Off'
              }
            >
              <Ionicons
                name={enabled ? 'musical-notes' : 'musical-notes-outline'}
                size={20}
                color={enabled ? ACCENT : MUTED_ICON}
              />
            </IconButton>

            <IconButton
              onPress={handleNotifications}
              accessibilityLabel={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : 'Notifications'
              }
            >
              <View style={styles.bellWrap}>
                <Ionicons
                  name={
                    unreadCount > 0 ? 'notifications' : 'notifications-outline'
                  }
                  size={22}
                  color={ICON}
                />
                {unreadCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badgeLabel}</Text>
                  </View>
                ) : null}
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
    </Animated.View>
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
    paddingHorizontal: 10,
    zIndex: 2,
  },
  side: {
    width: 96,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    justifyContent: 'flex-end',
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
    height: 83,
    width: 200,
  },
  iconHit: {
    width: 40,
    height: 40,
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
    borderRadius: 2,
  },
  bellWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(12,12,12,0.55)',
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