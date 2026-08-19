import api from '@/constants/api'
import {
  DEFAULT_REGION,
  formatMoney,
  getRegion,
} from '@/constants/regions'
import { useMarketplace } from '@/context/MarketplaceContext'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#737A86'
const GREEN = '#00E575'
const BLUE = '#3B82F6'

const PLAN_PRICE_USD: Record<string, number | null> = {
  free: null,
  global: 12,
  business: 30,
  dominant: 75,
}

const PLAN_PRICE_NGN: Record<string, number | null> = {
  free: null,
  global: 12000,
  business: 30000,
  dominant: 75000,
}

type PlanId = 'free' | 'global' | 'business' | 'dominant'

type PlanDef = {
  id: PlanId
  name: string
  feePct: number
  features: string[]
  limited?: boolean
  icon: keyof typeof Ionicons.glyphMap
}

const PLANS: PlanDef[] = [
  {
    id: 'free',
    name: 'Free Seller',
    feePct: 8,
    icon: 'leaf-outline',
    features: [
      'Up to 6 images per product',
      'Standard showroom visibility',
      'Seller dashboard & orders',
      'Personal storefront',
    ],
  },
  {
    id: 'global',
    name: 'Global Reach',
    feePct: 5,
    icon: 'globe-outline',
    features: [
      'Up to 12 images per product',
      'Increased showroom visibility',
    ],
  },
  {
    id: 'business',
    name: 'Business Plus',
    feePct: 3.5,
    icon: 'rocket-outline',
    features: [
      'Up to 20 images per product',
      'High showroom visibility',
      'Priority product discovery',
    ],
  },
  {
    id: 'dominant',
    name: 'Dominant Visibility',
    feePct: 2,
    limited: true,
    icon: 'diamond-outline',
    features: [
      'Up to 20 images per product',
      'Maximum showroom visibility',
      'Eligible for Plazore banner',
      'Highest discovery priority',
    ],
  },
]

const PLAN_LABEL: Record<string, string> = {
  free: 'Free Seller',
  global: 'Global Reach',
  pro: 'Global Reach',
  business: 'Business Plus',
  dominant: 'Dominant Visibility',
}

function resolvePlanPrice(planId: PlanId, regionCode: string): string {
  if (planId === 'free') return 'Free'

  const region = getRegion(regionCode)

  if (region.code === 'NG' && PLAN_PRICE_NGN[planId] != null) {
    return formatMoney(PLAN_PRICE_NGN[planId]!, 'NG')
  }

  const usd = PLAN_PRICE_USD[planId]
  if (usd == null) return 'Free'

  const { convertPrice } = require('@/constants/regions') as typeof import('@/constants/regions')
  const local = convertPrice(usd, 'US', regionCode)
  const rounded = Math.round(local)
  return formatMoney(rounded, regionCode)
}

function PlazoreOrb({ size = 110 }: { size?: number }) {
  const rotation = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [])
  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })
  const logoBox = size * 0.51
  const logoImg = size * 0.29
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.4,
          borderColor: 'transparent',
          borderTopColor: GREEN,
          borderRightColor: BLUE,
          borderBottomColor: 'transparent',
          borderLeftColor: GREEN,
          transform: [{ rotate }],
        }}
      />
      <View
        style={{
          width: logoBox,
          height: logoBox,
          borderRadius: logoBox / 2,
          backgroundColor: 'rgba(0,229,117,0.1)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={require('@/assets/logo-1.png')}
          style={{ width: logoImg, height: logoImg }}
          resizeMode="contain"
        />
      </View>
    </View>
  )
}

function normalizePlan(raw: string): PlanId | string {
  const p = String(raw || 'free').toLowerCase()
  if (p === 'pro') return 'global'
  return p
}

export default function SellerSubscription() {
  const { getToken } = useAuth()
  const { region: appRegion } = useMarketplace()

  const [loading, setLoading] = useState(true)
  const [sellerRegion, setSellerRegion] = useState(appRegion || DEFAULT_REGION)
  const [currentPlan, setCurrentPlan] = useState<string>('free')

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return
      const res = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        const u = res.data.data
        setSellerRegion(u.marketplaceRegion || appRegion || DEFAULT_REGION)
        setCurrentPlan(
          normalizePlan(
            String(u.sellerPlan || u.subscriptionPlan || u.plan || 'free')
          )
        )
      }
    } catch {
      setSellerRegion(appRegion || DEFAULT_REGION)
    } finally {
      setLoading(false)
    }
  }, [getToken, appRegion])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const regionMeta = useMemo(() => getRegion(sellerRegion), [sellerRegion])
  const currentLabel = PLAN_LABEL[currentPlan] || PLAN_LABEL.free
  const currentFee =
    PLANS.find(
      (p) => p.id === currentPlan || (currentPlan === 'pro' && p.id === 'global')
    )?.feePct ?? 8

  if (loading) {
    return (
      <View style={styles.loaderRoot}>
        <PlazoreOrb size={110} />
        <Text style={styles.loaderHint}>Loading plans…</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>Growth</Text>
        <Text style={styles.title}>Seller plans</Text>
        <Text style={styles.intro}>
          Lower fees and stronger visibility as your store grows. Fees apply to
          product price only — never delivery.
        </Text>

        {/* Current plan hero */}
        <LinearGradient
          colors={['rgba(0,229,117,0.12)', 'rgba(59,130,246,0.08)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.currentCard}
        >
          <Text style={styles.currentEyebrow}>Your plan</Text>
          <Text style={styles.currentName}>{currentLabel}</Text>
          <View style={styles.currentRow}>
            <View>
              <Text style={styles.currentFeeLabel}>Transaction fee</Text>
              <Text style={styles.currentFee}>{currentFee}%</Text>
            </View>
            <View style={styles.regionPill}>
              <Text style={styles.regionText}>
                {regionMeta.flag} {regionMeta.name}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <Text style={styles.section}>
          Plans · {regionMeta.currency.code}
        </Text>

        {PLANS.map((plan) => {
          const isCurrent =
            plan.id === currentPlan ||
            (currentPlan === 'pro' && plan.id === 'global')
          const priceLabel = resolvePlanPrice(plan.id, sellerRegion)

          return (
            <View
              key={plan.id}
              style={[styles.planCard, isCurrent && styles.planCardCurrent]}
            >
              {isCurrent && <View style={styles.currentBar} />}

              <View style={styles.planTop}>
                <View style={styles.planIcon}>
                  <Ionicons name={plan.icon} size={18} color={GREEN} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.planNameRow}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    {isCurrent && (
                      <View style={styles.badgeCurrent}>
                        <Text style={styles.badgeCurrentText}>Current</Text>
                      </View>
                    )}
                    {plan.limited && (
                      <View style={styles.badgeLimited}>
                        <Text style={styles.badgeLimitedText}>Limited</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.planPrice}>{priceLabel}</Text>
                  <Text style={styles.planPriceHint}>
                    {plan.id === 'free'
                      ? 'No monthly charge'
                      : `per month · ${regionMeta.name}`}
                  </Text>
                </View>
              </View>

              <View style={styles.planDivider} />

              {plan.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Ionicons name="checkmark" size={14} color={GREEN} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}

              <View style={styles.feeBox}>
                <Text style={styles.feeBoxLabel}>Transaction fee</Text>
                <Text style={styles.feeBoxValue}>{plan.feePct}%</Text>
              </View>
            </View>
          )
        })}

        <Text style={styles.footnote}>
          Payments and plan changes will open in a later update. Until then,
          this screen shows your current tier and what each plan unlocks.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  loaderRoot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderHint: { marginTop: 16, fontSize: 13, color: MUTED },

  scroll: { padding: 18, paddingBottom: 48 },

  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: MUTED,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.5,
  },
  intro: {
    marginTop: 10,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 21,
    color: SECONDARY,
  },

  currentCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,229,117,0.22)',
    padding: 18,
    marginBottom: 24,
  },
  currentEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
    textTransform: 'uppercase',
  },
  currentName: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
  },
  currentRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  currentFeeLabel: { fontSize: 12, color: MUTED },
  currentFee: {
    marginTop: 2,
    fontSize: 28,
    fontWeight: '800',
    color: GREEN,
  },
  regionPill: {
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  regionText: { fontSize: 12, color: SECONDARY, fontWeight: '600' },

  section: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  planCard: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  planCardCurrent: {
    borderColor: 'rgba(0,229,117,0.35)',
  },
  currentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: GREEN,
  },

  planTop: { flexDirection: 'row', gap: 12 },
  planIcon: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0,229,117,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planNameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  planName: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT,
  },
  badgeCurrent: {
    backgroundColor: 'rgba(0,229,117,0.14)',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeCurrentText: {
    fontSize: 10,
    fontWeight: '800',
    color: GREEN,
  },
  badgeLimited: {
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeLimitedText: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
  },
  planPrice: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
  },
  planPriceHint: {
    marginTop: 2,
    fontSize: 11,
    color: MUTED,
  },

  planDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
    marginVertical: 14,
  },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: SECONDARY,
  },

  feeBox: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  feeBoxLabel: { fontSize: 12, color: MUTED },
  feeBoxValue: { fontSize: 15, fontWeight: '800', color: TEXT },

  footnote: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: MUTED,
    paddingHorizontal: 8,
  },
})