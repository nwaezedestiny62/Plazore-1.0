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
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const ACCENT = '#C9A962'
const ICON = '#FFFFFF'
const GLASS = 'rgba(12,12,12,0.82)'

type Props = {
  scrollProgress: Animated.Value | number
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
      Animated.timing(scale, {
        toValue: 0.94,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.7,
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

  const isAnimated = typeof scrollProgress !== 'number'

  const glassOpacity = isAnimated
    ? (scrollProgress as Animated.Value).interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      })
    : scrollProgress

  const handleMusic = () => {
    if (typeof musicControlled !== 'boolean') {
      setMusicLocal((v) => !v)
    }
    onMusicPress?.()
  }

  const topPad = Math.max(insets.top - 6, 4)

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: topPad }]}
    >
      {/* Glass */}
      {isAnimated ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: glassOpacity as any }]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={52} tint="dark" style={StyleSheet.absoluteFill} />
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
          style={[StyleSheet.absoluteFill, { opacity: glassOpacity as number }]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={52} tint="dark" style={StyleSheet.absoluteFill} />
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

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.32)', 'rgba(0,0,0,0)']}
        style={styles.topVeil}
      />

      {/* Big logo — absolute so it does NOT stretch bar height */}
      <View style={styles.logoWrap} pointerEvents="none">
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Tight icon row — this sets the real navbar height */}
      <View style={styles.row}>
        <View style={styles.side}>
          <IconButton
            onPress={onMenuPress}
            accessibilityLabel="Open navigation"
          >
            <Ionicons name="menu" size={26} color={ICON} />
          </IconButton>
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

      {/* Line flush with the bottom edge of the bar */}
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
  logo: {
    height: 99,
    width: 280,
  },
row: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 10,
  paddingTop: 16,   // keep — this is your content position
  paddingBottom: 0,
  height: 70,      // was 44 — brings bar bottom down under the logo
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