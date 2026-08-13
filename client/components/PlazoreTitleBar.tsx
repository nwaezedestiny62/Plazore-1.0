import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useRef, useState } from 'react'
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const ACCENT = '#C9A962'
const ICON = '#FFFFFF'
const GLASS = 'rgba(8,8,10,0.55)'

type Props = {
  scrollProgress: number
  hasUnreadNotifications?: boolean
  onMenuPress?: () => void
  onMusicPress?: () => void
  onNotificationsPress?: () => void
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
      Animated.timing(scale, { toValue: 0.94, duration: 120, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.7, duration: 120, useNativeDriver: true }),
    ]).start()
  }

  const pressOut = () => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start()
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.iconHit, { transform: [{ scale }], opacity }]}>
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
        Animated.timing(scale, { toValue: 0.9, duration: 90, useNativeDriver: true }).start()
      }
      onPressOut={() =>
        Animated.timing(scale, { toValue: 1, duration: 160, useNativeDriver: true }).start()
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
  const [logoLoaded, setLogoLoaded] = useState(false)
  const musicOn =
    typeof musicControlled === 'boolean' ? musicControlled : musicLocal

  const anim = useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    const p = Math.min(1, Math.max(0, scrollProgress))
    Animated.timing(anim, {
      toValue: p,
      duration: 180,
      useNativeDriver: true,
    }).start()
  }, [scrollProgress, anim])

  const slideUp = anim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, -24, -130],
    extrapolate: 'clamp',
  })

  const barOpacity = anim.interpolate({
    inputRange: [0, 0.2, 0.5],
    outputRange: [1, 0.7, 0],
    extrapolate: 'clamp',
  })

  const glassOpacity = anim.interpolate({
    inputRange: [0, 0.15, 0.45],
    outputRange: [0.35, 0.55, 0],
    extrapolate: 'clamp',
  })

  const handleMusic = () => {
    if (typeof musicControlled !== 'boolean') {
      setMusicLocal((v) => !v)
    }
    onMusicPress?.()
  }

  const topPad = Math.max(insets.top - 6, 4)
  const hidden = scrollProgress > 0.55

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={[
        styles.wrap,
        {
          paddingTop: topPad,
          opacity: barOpacity,
          transform: [{ translateY: slideUp }],
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: glassOpacity }]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS }]} />
        )}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.28)' },
          ]}
        />
      </Animated.View>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0)']}
        style={styles.topVeil}
      />

      {/* Logo + PLAZORE text fallback underneath */}
      <View style={styles.logoWrap} pointerEvents="none">
        <Text style={[styles.logoFallback, logoLoaded && styles.logoFallbackHidden]}>
          PLAZORE
        </Text>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          onLoad={() => setLogoLoaded(true)}
          onError={() => setLogoLoaded(false)}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.side}>
          <MenuToggle onPress={onMenuPress} />
        </View>

        <View style={styles.center} />

        <View style={[styles.side, styles.sideRight]}>
          <IconButton
            onPress={handleMusic}
            accessibilityLabel={musicOn ? 'Music on' : 'Music off'}
          >
            <Ionicons
              name={musicOn ? 'headset' : 'headset-outline'}
              size={22}
              color={musicOn ? ACCENT : ICON}
            />
          </IconButton>

          <IconButton
            onPress={onNotificationsPress}
            accessibilityLabel="Notifications"
          >
            <View>
              <Ionicons
                name={
                  hasUnreadNotifications
                    ? 'notifications'
                    : 'notifications-outline'
                }
                size={22}
                color={ICON}
              />
              {hasUnreadNotifications ? <View style={styles.dot} /> : null}
            </View>
          </IconButton>
        </View>
      </View>

      <View style={styles.bottomRule} pointerEvents="none">
        <LinearGradient
          colors={[
            'transparent',
            'rgba(255,255,255,0.55)',
            'rgba(255,255,255,0.9)',
            'rgba(255,255,255,0.55)',
            'transparent',
          ]}
          locations={[0, 0.18, 0.5, 0.82, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.bottomLine}
        />
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
    overflow: 'visible',
  },
  topVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 88,
  },
  logoWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 40,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  logoFallback: {
    position: 'absolute',
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 6,
    opacity: 0.95,
  },
  logoFallbackHidden: {
    opacity: 0,
  },
  logo: {
    height: 99,
    width: 280,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 0,
    height: 70,
    zIndex: 2,
  },
  side: {
    width: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  center: {
    flex: 1,
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
  dot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: ACCENT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(12,12,12,0.4)',
  },
  bottomRule: {
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 0,
  },
  bottomLine: {
    height: 1,
    borderRadius: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.4,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
})