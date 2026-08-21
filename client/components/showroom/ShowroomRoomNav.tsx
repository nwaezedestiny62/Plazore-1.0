/**
 * ShowroomRoomNav — PLAZORE floating room launcher.
 *
 * The rail stays out of the way until the user asks for it. The launcher is
 * anchored above the bottom navbar; the rail grows out of that same point and
 * the showroom dims softly behind it.
 *
 * Visibility fade/slide is locked to the same chrome curve as PlazoreTitleBar
 * and the bottom tabs bar (CHROME_IN_START / END + 520 ms + shared easing).
 */

import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const GREEN = '#00E575'
const TEAL = '#14B8A6'
const BLUE = '#2563EB'
const TEXT = '#F5F7FA'
const MUTED = 'rgba(255,255,255,0.58)'
const OPEN_EASE = Easing.bezier(0.22, 0.61, 0.36, 1)
const CLOSE_EASE = Easing.bezier(0.33, 0.0, 0.2, 1) // slightly softer decelerate

/** Must match PlazoreTitleBar + PlazoreTabsBar exactly */
const CHROME_IN_START = 0.02
const CHROME_IN_END = 0.72
const CHROME_DURATION = 520
const EASE_SMOOTH = Easing.bezier(0.22, 0.61, 0.36, 1)

const ROOM_META = [
  { title: 'Horizon', icon: 'compass-outline' },
  { title: 'Edit', icon: 'layers-outline' },
  { title: 'Signal', icon: 'flash-outline' },
  { title: 'Locale', icon: 'location-outline' },
] as const

type RoomIcon = (typeof ROOM_META)[number]['icon']

export const ROOM_NAV_H = 64

export type ShowroomRoomNavProps = {
  activeRoom: number
  roomCount: number
  /** 0–1 visibility of the launcher as the showroom enters the viewport. */
  visible: number
  onSelectRoom: (roomNumber: number) => void
  /** Kept for compatibility with the previous top rail API. */
  topOffset?: number
  /** Distance from the bottom edge, above the tab navbar. */
  bottomOffset?: number
}

function scrollToNavVisibility(progress: number) {
  const p = Math.min(1, Math.max(0, progress))
  if (p <= CHROME_IN_START) return 0
  if (p >= CHROME_IN_END) return 1
  return (p - CHROME_IN_START) / (CHROME_IN_END - CHROME_IN_START)
}

export default function ShowroomRoomNav({
  activeRoom,
  roomCount,
  visible,
  onSelectRoom,
  bottomOffset = 94,
}: ShowroomRoomNavProps) {
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const openProgress = useRef(new Animated.Value(0)).current
  const activePosition = useRef(new Animated.Value(activeRoom)).current
  const chromeVisibility = useRef(new Animated.Value(0)).current

  const lastTarget = useRef(0)
  const isContinuous = useRef(true)

  const count = Math.min(ROOM_META.length, Math.max(1, roomCount))
  const rooms = ROOM_META.slice(0, count)
  const active = Math.min(count, Math.max(1, activeRoom))
  const bottom = bottomOffset + Math.max(insets.bottom - 6, 0)

  // Drive chrome visibility with the exact same curve as title bar + tabs
  useEffect(() => {
    const t = scrollToNavVisibility(visible)
    const delta = Math.abs(t - lastTarget.current)
    const continuous = delta < 0.08

    isContinuous.current = continuous
    lastTarget.current = t

    if (continuous) {
      chromeVisibility.setValue(t)
    } else {
      chromeVisibility.stopAnimation()
      Animated.timing(chromeVisibility, {
        toValue: t,
        duration: CHROME_DURATION,
        easing: EASE_SMOOTH,
        useNativeDriver: true,
      }).start()
    }
  }, [visible, chromeVisibility])

  useEffect(() => {
    activePosition.stopAnimation()
    Animated.timing(activePosition, {
      toValue: active,
      duration: 520,
      easing: OPEN_EASE,
      useNativeDriver: true,
    }).start()
  }, [active, activePosition])

  const animateOpen = () => {
    setOpen(true)
    openProgress.stopAnimation()
    Animated.timing(openProgress, {
      toValue: 1,
      duration: 380,
      easing: OPEN_EASE,
      useNativeDriver: true,
    }).start()
  }

  const animateClose = (after?: () => void) => {
    openProgress.stopAnimation()
    Animated.timing(openProgress, {
      toValue: 0,
      duration: 340,               // almost same length as open → feels reversible
      easing: CLOSE_EASE,         // soft decelerate so it never pops
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setOpen(false)
        after?.()
      }
    })
  }

  const toggle = () => {
    if (open) animateClose()
    else animateOpen()
  }

  const selectRoom = (roomNumber: number) => {
    onSelectRoom(roomNumber)
    animateClose()
  }

  // When the rail is open we force full opacity; otherwise follow chrome
  const launcherOpacity = open ? 1 : chromeVisibility

  // Gentle rise that pairs with the bottom tabs’ 16 → 0 translate
  const launcherTranslateY = chromeVisibility.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  })

  // ── Smoother, more symmetric interpolations ──────────────────────────────
  const dimOpacity = openProgress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.18, 0.34],
  })

  // Opacity holds longer then fades cleanly — no early cut-off
  const railOpacity = openProgress.interpolate({
    inputRange: [0, 0.12, 0.85, 1],
    outputRange: [0, 0.7, 1, 1],
  })

  const railTranslateX = openProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [36, 0],          // slightly less travel = less “snap”
  })

  const railScale = openProgress.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.88, 0.98, 1],
  })

  // Extra soft vertical settle on close
  const railTranslateY = openProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  })

  const launcherScale = openProgress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [1, 1.05, 1],
  })

  const launcherRotate = openProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  })

  const connectorOpacity = openProgress.interpolate({
    inputRange: [0, 0.25, 0.7, 1],
    outputRange: [0, 0.55, 0.9, 1],
  })

  // Hide pointer events while fully faded out
  const pointerOff = !open && (visible as number) < CHROME_IN_START + 0.01

  return (
    <>
      {/* Dim stays mounted while openProgress > 0 so the fade can finish cleanly */}
      {open && (
  <Animated.View
    pointerEvents="auto"
    style={[StyleSheet.absoluteFillObject, styles.dimLayer, { opacity: dimOpacity }]}
  >
    <Pressable style={StyleSheet.absoluteFillObject} onPress={() => animateClose()} />
  </Animated.View>
)}

      {open && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.railDock,
            {
              right: 18,
              bottom: bottom + 78,
              opacity: railOpacity,
              transform: [
                { translateX: railTranslateX },
                { translateY: railTranslateY },
                { scale: railScale },
              ],
            },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.originLine, { opacity: connectorOpacity }]}
          >
            <LinearGradient
              colors={['transparent', GREEN, BLUE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>

          <View style={styles.rail}>
            {rooms.map((room, index) => {
              const roomNumber = index + 1
              const isActive = active === roomNumber
              const activeIntensity = activePosition.interpolate({
                inputRange: [roomNumber - 1, roomNumber, roomNumber + 1],
                outputRange: [0, 1, 0],
                extrapolate: 'clamp',
              })

              return (
                <React.Fragment key={room.title}>
                  <Pressable
                    onPress={() => selectRoom(roomNumber)}
                    style={({ pressed }) => [
                      styles.roomCard,
                      pressed && styles.roomCardPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Room ${roomNumber}, ${room.title}`}
                    accessibilityState={{ selected: isActive }}
                  >
                    <View style={styles.cardFace}>
                      <LinearGradient
                        colors={
                          isActive
                            ? [GREEN, TEAL, BLUE]
                            : ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.08)']
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <View style={styles.cardSheen} />
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.activeRing, { opacity: activeIntensity }]}
                      />
                      <Ionicons
                        name={room.icon as RoomIcon}
                        size={isActive ? 21 : 19}
                        color={isActive ? '#041412' : TEXT}
                      />
                    </View>
                    <Text style={[styles.cardIndex, isActive && styles.cardIndexOn]}>
                      0{roomNumber}
                    </Text>
                    <Text style={[styles.cardTitle, isActive && styles.cardTitleOn]}>
                      {room.title}
                    </Text>
                  </Pressable>

                  {index < rooms.length - 1 && <View style={styles.cardGap} />}
                </React.Fragment>
              )
            })}
          </View>
        </Animated.View>
      )}

      <Animated.View
        pointerEvents={pointerOff ? 'none' : 'box-none'}
        style={[
          styles.launcherDock,
          {
            right: 18,
            bottom,
            opacity: launcherOpacity,
            transform: [{ translateY: launcherTranslateY }],
          },
        ]}
      >
        <Pressable
          onPress={toggle}
          style={({ pressed }) => [
            styles.launcherHit,
            pressed && styles.launcherPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Close room selector' : 'Open room selector'}
          accessibilityState={{ expanded: open }}
        >
          <Animated.View
            style={[
              styles.launcher,
              {
                transform: [
                  { scale: launcherScale },
                  { rotate: launcherRotate },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={[GREEN, TEAL, BLUE]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.launcherSheen} />
            <Ionicons name="add" size={24} color="#041412" />
          </Animated.View>
          <Text style={styles.launcherLabel}>Spaces</Text>
        </Pressable>
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  dimLayer: {
    zIndex: 44,
    backgroundColor: '#000000',
  },
  launcherDock: {
    position: 'absolute',
    zIndex: 48,
    alignItems: 'center',
  },
  launcherHit: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
  },
  launcherPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
  launcher: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    shadowColor: GREEN,
    shadowOpacity: 0.42,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  launcherSheen: {
    position: 'absolute',
    top: 4,
    left: 8,
    right: 8,
    height: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  launcherLabel: {
    marginTop: 5,
    color: TEXT,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 5,
  },
  railDock: {
    position: 'absolute',
    zIndex: 47,
    alignItems: 'flex-end',
  },
  originLine: {
    position: 'absolute',
    right: -18,
    bottom: 28,
    width: 38,
    height: 1,
    overflow: 'hidden',
  },
  rail: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingRight: 0,
  },
  roomCard: {
    width: 62,
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  roomCardPressed: {
    opacity: 0.74,
    transform: [{ translateY: 2 }, { scale: 0.97 }],
  },
  cardFace: {
    width: 48,
    height: 48,
    borderRadius: 15,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    shadowColor: '#000000',
    shadowOpacity: 0.48,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 7 },
    elevation: 10,
  },
  cardSheen: {
    position: 'absolute',
    top: 4,
    left: 7,
    right: 7,
    height: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  activeRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  cardIndex: {
    marginTop: 6,
    color: MUTED,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  cardIndexOn: {
    color: GREEN,
  },
  cardTitle: {
    marginTop: 1,
    color: MUTED,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardTitleOn: {
    color: TEXT,
  },
  cardGap: {
    width: 10,
  },
})