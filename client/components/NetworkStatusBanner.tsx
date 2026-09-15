import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  AppState,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import NetInfo, {
  type NetInfoCellularGeneration,
  type NetInfoState,
} from '@react-native-community/netinfo'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const BG = '#0E1116'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = 'rgba(255,255,255,0.4)'
const GREEN = '#00E575'
const TEAL = '#14B8A6'
const BLUE = '#2563EB'
const RED = '#F87171'
const AMBER = '#FBBF24'

type Kind = 'online' | 'offline' | 'slow'

function classify(state: NetInfoState | null): Kind {
  if (!state) return 'online'

  if (state.isConnected === false) return 'offline'
  if (state.isInternetReachable === false) return 'offline'

  if (state.type === 'cellular' && state.details) {
    const gen = (
      state.details as { cellularGeneration?: NetInfoCellularGeneration }
    ).cellularGeneration
    if (gen === '2g' || gen === '3g') return 'slow'
  }

  return 'online'
}

export function NetworkStatusBanner() {
  const insets = useSafeAreaInsets()
  const [kind, setKind] = useState<Kind>('online')
  const anim = useRef(new Animated.Value(0)).current

  const apply = useCallback(
    (next: Kind) => {
      setKind(next)
      Animated.timing(anim, {
        toValue: next === 'online' ? 0 : 1,
        duration: 220,
        useNativeDriver: true,
      }).start()
    },
    [anim],
  )

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      apply(classify(state))
    })

    NetInfo.fetch().then((state) => apply(classify(state)))

    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        NetInfo.fetch().then((state) => apply(classify(state)))
      }
    })

    return () => {
      unsub()
      appSub.remove()
    }
  }, [apply])

  if (kind === 'online') return null

  const isOffline = kind === 'offline'

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 8,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-16, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.card} accessibilityRole="alert">
        <LinearGradient
          colors={[GREEN, TEAL, BLUE]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.rule}
        />
        <View style={styles.row}>
          <View
            style={[
              styles.iconBox,
              isOffline ? styles.iconOffline : styles.iconSlow,
            ]}
          >
            <Ionicons
              name={isOffline ? 'cloud-offline-outline' : 'wifi-outline'}
              size={18}
              color={isOffline ? RED : AMBER}
            />
          </View>
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>CONNECTION</Text>
            <Text style={styles.title}>
              {isOffline ? 'No internet connection' : 'Connection is slow'}
            </Text>
            <Text style={styles.body}>
              {isOffline
                ? "Plazore can't reach the network right now. Check your connection — we'll reconnect automatically."
                : 'Your network is responding slowly. Some actions may take longer than usual.'}
            </Text>
          </View>
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
    zIndex: 9999,
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 8 },
    }),
  },
  rule: { height: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 2,
  },
  iconOffline: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderColor: 'rgba(248,113,113,0.3)',
  },
  iconSlow: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderColor: 'rgba(251,191,36,0.3)',
  },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 2,
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    marginTop: 4,
    color: SECONDARY,
    fontSize: 12.5,
    lineHeight: 18,
  },
})