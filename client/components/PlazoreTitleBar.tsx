import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useRef, useState } from 'react'
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
const GLASS = 'rgba(8,8,10,0.55)'
const EASE = Easing.out(Easing.cubic)

/** Shared with bottom tab bar */
const CHROME_IN_START = 0.1
const CHROME_IN_END = 0.48
const CHROME_DURATION = 200

/** Single chrome band height — glass, row, and bottom rule all share this end edge */
const BAR_H = 56

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

function MenuToggle({ onPress }: { onPress?: () => void }) {
  const scale = useRef(new Animated.Value(1)).current

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 90,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.timing(scale, {
          toValue: 1,
          duration: 160,
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
  const logoOpacity = useRef(new Animated.Value(0)).current
  const textOpacity = useRef(new Animated.Value(1)).current

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
          duration: 420,
          easing: EASE,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 320,
          easing: EASE,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      logoOpacity.setValue(0)
      textOpacity.setValue(1)
    }
  }, [logoLoaded])

  useEffect(() => {
    const p = Math.min(1, Math.max(0, scrollProgress))
    Animated.timing(anim, {
      toValue: p,
      duration: CHROME_DURATION,
      easing: EASE,
      useNativeDriver: true,
    }).start()
  }, [scrollProgress, anim])

  const slideUp = anim.interpolate({
    inputRange: [0, CHROME_IN_START, CHROME_IN_END, 1],
    outputRange: [0, 0, -110, -130],
    extrapolate: 'clamp',
  })

  const barOpacity = anim.interpolate({
    inputRange: [0, CHROME_IN_START, CHROME_IN_END],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  })

  const glassOpacity = anim.interpolate({
    inputRange: [0, CHROME_IN_START, CHROME_IN_END],
    outputRange: [0.22, 0.3, 0],
    extrapolate: 'clamp',
  })

  const handleMusic = () => {
    if (typeof musicControlled !== 'boolean') {
      setMusicLocal((v) => !v)
    }
    onMusicPress?.()
  }

  const statusTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 20,
    20
  )
  const hidden = scrollProgress > CHROME_IN_END

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
      {/*
        Architecture:
        [ statusTop safe gap ]
        [ BAR_H chrome band ]
          ├ glass (absolute, same height)
          ├ row (menu | logo | actions)  height BAR_H
          └ bottom rule  ← ends the nav bar
      */}
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

          {/* Logo / PLAZORE centered in the band */}
          <View style={styles.center} pointerEvents="none">
            <Animated.View
              style={[styles.logoLayer, { opacity: textOpacity }]}
            >
              <Text style={styles.logoFallback}>PLAZORE</Text>
            </Animated.View>
            <Animated.View
              style={[styles.logoLayer, { opacity: logoOpacity }]}
            >
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

        {/* Bottom edge of the nav bar — same line ends the chrome */}
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

  /** One chrome band — glass + row + rule share this box */
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
    height: 100,
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

  /** Rule is the last pixel of the band */
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
      android: {
        elevation: 1,
      },
    }),
  },
})