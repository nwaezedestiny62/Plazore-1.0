/**
 * ShowroomRoomNav — Plazore sticky room chain
 * Green → blue active state · continuous fade · no binary flicker
 */

import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useRef } from 'react'
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
const BLUE = '#3B82F6'
const TEXT = '#F5F7FA'
const MUTED = 'rgba(255,255,255,0.32)'
const LINE = 'rgba(255,255,255,0.12)'
const EASE = Easing.bezier(0.22, 0.61, 0.36, 1)

const ROOM_LABELS = ['1', '2', '3', '4'] as const

export const ROOM_NAV_H = 52

type Props = {
  activeRoom: number
  roomCount: number
  /** 0–1 continuous visibility from parent scroll */
  visible: number
  onSelectRoom: (roomNumber: number) => void
  /** Distance from top of screen to sit under title bar (not including safe area) */
  topOffset?: number
}

export default function ShowroomRoomNav({
  activeRoom,
  roomCount,
  visible,
  onSelectRoom,
  topOffset = 0,
}: Props) {
  const insets = useSafeAreaInsets()
  const opacity = useRef(new Animated.Value(0)).current
  const lift = useRef(new Animated.Value(-10)).current
  const visibleRef = useRef(visible)

  // Continuous, no hard threshold flicker
  useEffect(() => {
    visibleRef.current = visible
    const t = Math.min(1, Math.max(0, visible))
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: t,
        duration: 320,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: t > 0.05 ? 0 : -10,
        duration: 320,
        easing: EASE,
        useNativeDriver: true,
      }),
    ]).start()
  }, [visible, opacity, lift])

  const count = Math.min(4, Math.max(1, roomCount))
  const rooms = ROOM_LABELS.slice(0, count)
  const interactive = visible > 0.25

  return (
    <Animated.View
      pointerEvents={interactive ? 'box-none' : 'none'}
      style={[
        styles.wrap,
        {
          top: topOffset + insets.top,
          opacity,
          transform: [{ translateY: lift }],
        },
      ]}
    >
      <View style={styles.band}>
        {/* soft top rule — Plazore chrome */}
        <LinearGradient
          colors={['rgba(0,229,117,0.35)', 'rgba(59,130,246,0.25)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topRule}
        />

        <View style={styles.chain}>
          {rooms.map((label, i) => {
            const roomNum = i + 1
            const isActive = activeRoom === roomNum
            const isLast = i === rooms.length - 1

            return (
              <React.Fragment key={roomNum}>
                <Pressable
                  onPress={() => onSelectRoom(roomNum)}
                  hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                  style={styles.nodeHit}
                  accessibilityRole="button"
                  accessibilityLabel={`Room ${roomNum}`}
                  accessibilityState={{ selected: isActive }}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={[GREEN, '#14B8A6', BLUE]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.nodeActive}
                    >
                      <View style={styles.nodeCore} />
                    </LinearGradient>
                  ) : (
                    <View style={styles.node} />
                  )}
                  <Text
                    style={[
                      styles.nodeLabel,
                      isActive && styles.nodeLabelOn,
                    ]}
                  >
                    {isActive ? `Room ${label}` : label}
                  </Text>
                </Pressable>

                {!isLast && (
                  <View style={styles.connectorTrack}>
                    <View
                      style={[
                        styles.connector,
                        roomNum < activeRoom && styles.connectorPassed,
                      ]}
                    />
                  </View>
                )}
              </React.Fragment>
            )
          })}
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 40,
    alignItems: 'center',
  },
  band: {
    width: '100%',
    height: ROOM_NAV_H,
    backgroundColor: 'rgba(9,11,15,0.88)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRule: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
  },
  chain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  nodeHit: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  node: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: MUTED,
    backgroundColor: 'transparent',
  },
  nodeActive: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#041412',
  },
  connectorTrack: {
    width: 28,
    height: 2,
    marginBottom: 14,
    justifyContent: 'center',
  },
  connector: {
    height: 1.5,
    backgroundColor: LINE,
  },
  connectorPassed: {
    backgroundColor: 'rgba(0,229,117,0.45)',
  },
  nodeLabel: {
    marginTop: 5,
    fontSize: 9,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.6,
  },
  nodeLabelOn: {
    color: TEXT,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
})