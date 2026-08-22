/**
 * MarketplaceRegionScreen — Plazore
 *
 * Layout math (8pt base):
 *   H_PAD = 20
 *   GAP   = 12
 *   tileW = (screenW - H_PAD*2 - GAP) / 2
 *   tileH = tileW * 1.22          // fixed aspect
 *   flag  = tileW * 0.34          // proportional to card
 *   radius scale: 14 / 18 / 22
 */

import api from '@/constants/api'
import { getRegion, REGION_LIST } from '@/constants/regions'
import { useMarketplace } from '@/context/MarketplaceContext'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

const BG = '#090B0F'
const SURFACE = '#10141A'
const TEXT = '#F5F7FA'
const MUTED = 'rgba(255,255,255,0.50)'
const QUIET = 'rgba(255,255,255,0.28)'
const LINE = 'rgba(255,255,255,0.10)'
const GREEN = '#00E575'
const TEAL = '#14B8A6'
const BLUE = '#2563EB'
const GRAD = [GREEN, TEAL, BLUE] as const
const EASE = Easing.bezier(0.22, 0.61, 0.36, 1)

/** 8pt grid */
const U = 8
const H_PAD = U * 2.5 // 20
const GAP = U * 1.5 // 12

function PlazoreOrb({ size = 42 }: { size?: number }) {
  const spin = useRef(new Animated.Value(0)).current
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const r = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.07,
          duration: 720,
          easing: EASE,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 720,
          easing: EASE,
          useNativeDriver: true,
        }),
      ])
    )
    r.start()
    b.start()
    return () => {
      r.stop()
      b.stop()
    }
  }, [spin, pulse])

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.18)',
        transform: [{ rotate }, { scale: pulse }],
      }}
    >
      <LinearGradient
        colors={[...GRAD]}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.12,
          left: size * 0.18,
          right: size * 0.18,
          height: size * 0.28,
          borderRadius: size * 0.2,
          backgroundColor: 'rgba(255,255,255,0.22)',
        }}
      />
    </Animated.View>
  )
}

/** Full-width active marketplace card */
function ActiveHero({
  flag,
  name,
  currencyLabel,
}: {
  flag: string
  name: string
  currencyLabel: string
}) {
  return (
    <View style={styles.heroOuter}>
      <LinearGradient
        colors={['rgba(0,229,117,0.55)', 'rgba(20,184,166,0.35)', 'rgba(37,99,235,0.45)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroStroke}
      />
      <View style={styles.heroInner}>
        <LinearGradient
          colors={['rgba(0,229,117,0.12)', 'rgba(16,20,26,0.96)', 'rgba(37,99,235,0.10)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.heroRow}>
          <View style={styles.heroFlag}>
            <Text style={styles.heroFlagText}>{flag}</Text>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>ACTIVE MARKETPLACE</Text>
            <Text style={styles.heroName} numberOfLines={1}>
              {name}
            </Text>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>{currencyLabel}</Text>
            </View>
          </View>

          <View style={styles.heroCheck}>
            <LinearGradient
              colors={[...GRAD]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="checkmark" size={16} color="#041412" />
          </View>
        </View>
      </View>
    </View>
  )
}

/** Grid tile — fixed aspect, centered hierarchy */
function RegionTile({
  flag,
  name,
  currencyLabel,
  selected,
  disabled,
  width,
  height,
  flagSize,
  onPress,
}: {
  flag: string
  name: string
  currencyLabel: string
  selected: boolean
  disabled?: boolean
  width: number
  height: number
  flagSize: number
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || selected}
      style={({ pressed }) => [
        styles.tile,
        { width, height },
        selected && styles.tileOn,
        pressed && !selected && styles.tilePressed,
      ]}
    >
      {/* Selected: gradient stroke frame */}
      {selected && (
        <LinearGradient
          colors={['rgba(0,229,117,0.7)', 'rgba(20,184,166,0.4)', 'rgba(37,99,235,0.55)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.tileStroke}
        />
      )}

      <View style={[styles.tileBody, selected && styles.tileBodyOn]}>
        {selected && (
          <LinearGradient
            colors={['rgba(0,229,117,0.14)', 'rgba(16,20,26,0.98)', 'rgba(37,99,235,0.10)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}

        <View
          style={[
            styles.flagRing,
            {
              width: flagSize,
              height: flagSize,
              borderRadius: flagSize * 0.32,
            },
            selected && styles.flagRingOn,
          ]}
        >
          <Text style={[styles.flagEmoji, { fontSize: flagSize * 0.48 }]}>
            {flag}
          </Text>
        </View>

        <Text
          style={[styles.tileName, selected && styles.tileNameOn]}
          numberOfLines={2}
        >
          {name}
        </Text>

        <View style={[styles.metaPill, selected && styles.metaPillOn]}>
          <Text style={[styles.metaText, selected && styles.metaTextOn]}>
            {currencyLabel}
          </Text>
        </View>

        {selected && (
          <View style={styles.tileCornerCheck}>
            <LinearGradient
              colors={[...GRAD]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="checkmark" size={12} color="#041412" />
          </View>
        )}
      </View>
    </Pressable>
  )
}

export default function MarketplaceRegionScreen() {
  const router = useRouter()
  const { getToken } = useAuth()
  const { region: appRegion, setRegionLocal, refreshRegion } = useMarketplace()
  const { width: winW } = useWindowDimensions()

  const [region, setRegion] = useState(appRegion || 'NG')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Geometry from screen width
  const layout = useMemo(() => {
    const contentW = winW - H_PAD * 2
    const tileW = (contentW - GAP) / 2
    const tileH = tileW * 1.22
    const flagSize = Math.round(tileW * 0.34)
    return { contentW, tileW, tileH, flagSize }
  }, [winW])

  const active = useMemo(() => {
    try {
      return getRegion(region)
    } catch {
      return REGION_LIST.find((r) => r.code === region) ?? REGION_LIST[0]
    }
  }, [region])

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken()
        if (!token) {
          setRegion(appRegion || 'NG')
          return
        }
        const res = await api.get('/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.data.success) {
          const code = res.data.data.marketplaceRegion || appRegion || 'NG'
          setRegion(code)
          setRegionLocal(code)
        }
      } catch {
        setRegion(appRegion || 'NG')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSelect = async (code: string) => {
    if (code === region || saving) return
    setRegion(code)
    setRegionLocal(code)

    try {
      setSaving(true)
      const token = await getToken()
      if (!token) {
        Toast.show({
          type: 'error',
          text1: 'Sign in required',
          text2: 'Region saved on this device only.',
        })
        return
      }
      const res = await api.patch(
        '/users/me',
        { marketplaceRegion: code },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        const saved = res.data.data?.marketplaceRegion || code
        setRegion(saved)
        setRegionLocal(saved)
        await refreshRegion()
        Toast.show({
          type: 'success',
          text1: 'Marketplace updated',
          text2: `${getRegion(saved).name} · prices refresh across the app`,
        })
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Could not save region',
        text2: 'Your local selection still applies for now.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backHit, pressed && { opacity: 0.65 }]}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.title}>Marketplace</Text>
          <Text style={styles.subtitle}>Region & currency</Text>
        </View>

        {saving ? <PlazoreOrb size={26} /> : <View style={{ width: 26 }} />}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <PlazoreOrb size={52} />
          <Text style={styles.loaderLabel}>Loading regions</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
        >
          {/* Active hero */}
          {active && (
            <ActiveHero
              flag={active.flag}
              name={active.name}
              currencyLabel={`${active.currency.symbol}  ${active.currency.code}`}
            />
          )}

          <Text style={styles.sectionLabel}>ALL REGIONS</Text>
          <Text style={styles.sectionHint}>
            Switching updates prices and currency across Plazore.
          </Text>

          {/* Math grid */}
          <View style={styles.grid}>
            {REGION_LIST.map((r) => (
              <RegionTile
                key={r.code}
                flag={r.flag}
                name={r.name}
                currencyLabel={`${r.currency.symbol} · ${r.currency.code}`}
                selected={region === r.code}
                disabled={saving}
                width={layout.tileW}
                height={layout.tileH}
                flagSize={layout.flagSize}
                onPress={() => handleSelect(r.code)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },

  /* ── Header ─────────────────────────────────────────── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: U,
    paddingBottom: U * 1.5,
    gap: U * 1.5,
  },
  backHit: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
    color: MUTED,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  /* ── Loader ─────────────────────────────────────────── */
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: U * 2,
  },
  loaderLabel: {
    color: QUIET,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  /* ── Scroll ─────────────────────────────────────────── */
  scroll: {
    flex: 1,
  },
  scrollBody: {
    paddingHorizontal: H_PAD,
    paddingTop: U,
    paddingBottom: U * 6,
  },

  /* ── Active hero ────────────────────────────────────── */
  heroOuter: {
    borderRadius: 22,
    marginBottom: U * 3,
    ...Platform.select({
      ios: {
        shadowColor: GREEN,
        shadowOpacity: 0.18,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 8 },
    }),
  },
  heroStroke: {
    borderRadius: 22,
    padding: 1.5,
  },
  heroInner: {
    borderRadius: 20.5,
    overflow: 'hidden',
    backgroundColor: SURFACE,
    paddingVertical: U * 2,
    paddingHorizontal: U * 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: U * 1.75,
  },
  heroFlag: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,229,117,0.25)',
  },
  heroFlagText: {
    fontSize: 28,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroEyebrow: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  heroName: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  heroPill: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,229,117,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,229,117,0.28)',
  },
  heroPillText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  heroCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Section ────────────────────────────────────────── */
  sectionLabel: {
    color: QUIET,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  sectionHint: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: U * 2,
  },

  /* ── Grid ───────────────────────────────────────────── */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },

  /* ── Tile ───────────────────────────────────────────── */
  tile: {
    borderRadius: 20,
  },
  tileOn: {
    ...Platform.select({
      ios: {
        shadowColor: GREEN,
        shadowOpacity: 0.22,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 6 },
    }),
  },
  tilePressed: {
    opacity: 0.82,
    transform: [{ scale: 0.975 }],
  },
  tileStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  tileBody: {
    flex: 1,
    margin: 1.5, // reveals stroke when selected
    borderRadius: 18.5,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: U * 1.5,
    paddingVertical: U * 2,
    gap: U,
  },
  tileBodyOn: {
    borderColor: 'transparent',
  },
  flagRing: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  flagRingOn: {
    backgroundColor: 'rgba(0,229,117,0.10)',
    borderColor: 'rgba(0,229,117,0.30)',
  },
  flagEmoji: {
    textAlign: 'center',
  },
  tileName: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
    textAlign: 'center',
    lineHeight: 18,
  },
  tileNameOn: {
    color: GREEN,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  metaPillOn: {
    backgroundColor: 'rgba(0,229,117,0.12)',
    borderColor: 'rgba(0,229,117,0.28)',
  },
  metaText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  metaTextOn: {
    color: GREEN,
  },
  tileCornerCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
})