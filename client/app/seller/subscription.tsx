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
import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

/**
 * Base prices in USD. Converted to the seller's marketplace currency.
 * Nigeria uses the local tier amounts you specified.
 */
const PLAN_PRICE_USD: Record<string, number | null> = {
  free: null,
  global: 12,
  business: 30,
  dominant: 75,
}

/** Explicit NGN monthly prices (prefer over FX for NG sellers) */
const PLAN_PRICE_NGN: Record<string, number | null> = {
  free: null,
  global: 12000,
  business: 30000,
  dominant: 75000,
}

type PlanId = 'free' | 'global' | 'business' | 'dominant'

type PlanDef = {
  id: PlanId
  emoji: string
  name: string
  feePct: number
  features: string[]
  limited?: boolean
}

const PLANS: PlanDef[] = [
  {
    id: 'free',
    emoji: '🌱',
    name: 'Free Seller',
    feePct: 8,
    features: [
      'Upload up to 6 images per product',
      'Standard showroom visibility',
      'Seller Dashboard',
      'Product Management',
      'Order Management',
      'Personal Storefront',
    ],
  },
  {
    id: 'global',
    emoji: '🌍',
    name: 'Global Reach',
    feePct: 5,
    features: [
      'Upload up to 12 images',
      'Increased showroom visibility',
    ],
  },
  {
    id: 'business',
    emoji: '🚀',
    name: 'Business Plus',
    feePct: 3.5,
    features: [
      'Upload up to 20 images',
      'High showroom visibility',
      'Priority product discovery',
    ],
  },
  {
    id: 'dominant',
    emoji: '👑',
    name: 'Dominant Visibility',
    feePct: 2,
    limited: true,
    features: [
      'Upload up to 20 images',
      'Maximum showroom visibility',
      'Eligible for Plazore General Banner',
      'Highest product discovery priority',
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

  // Store USD amount in US region, convert to seller marketplace
  const { convertPrice } = require('@/constants/regions') as typeof import('@/constants/regions')
  const local = convertPrice(usd, 'US', regionCode)
  // Whole numbers for subscriptions look cleaner
  const rounded =
    region.currency.code === 'USD' || region.currency.code === 'GBP'
      ? Math.round(local)
      : Math.round(local)
  return formatMoney(rounded, regionCode)
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
          String(u.sellerPlan || u.subscriptionPlan || u.plan || 'free').toLowerCase()
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
  const currentLabel =
    PLAN_LABEL[currentPlan] || PLAN_LABEL.free
  const currentFee =
    PLANS.find((p) => p.id === currentPlan || (currentPlan === 'pro' && p.id === 'global'))
      ?.feePct ?? 8

  if (loading) {
    return (
      <View className="flex-1 bg-[#060B14] items-center justify-center">
        <ActivityIndicator color="#9EC5FF" />
      </View>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#060B14]" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[3px] uppercase">
          Growth
        </Text>
        <Text className="text-white text-[26px] font-extrabold mt-1 mb-6">
          Seller Subscription
        </Text>

        {/* Current plan */}
        <View className="rounded-[28px] overflow-hidden border border-[#2A4560] mb-5">
          <LinearGradient
            colors={['#12243A', '#0C1520']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="p-6"
          >
            <Text className="text-[#7A93A8] text-[11px] font-semibold tracking-[2px] uppercase mb-2">
              Current Plan
            </Text>
            <Text className="text-white text-[22px] font-extrabold">
              {PLANS.find((p) => p.id === currentPlan)?.emoji || '🌱'}{' '}
              {currentLabel}
            </Text>
            <View className="flex-row items-end mt-4">
              <View className="flex-1">
                <Text className="text-[#6B8299] text-[12px]">
                  Current Transaction Fee
                </Text>
                <Text className="text-[#9EC5FF] text-[28px] font-extrabold mt-0.5">
                  {currentFee}%
                </Text>
              </View>
              <View className="bg-[#1A2F45] px-3 py-1.5 rounded-full border border-[#2A4560]">
                <Text className="text-[#AFC3D6] text-[11px] font-medium">
                  {regionMeta.flag} {regionMeta.name}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <Text className="text-[#7A93A8] text-[14px] leading-6 mb-8 px-1">
          Choose a plan that supports your business growth. Unlock higher image upload limits, stronger showroom visibility, and lower transaction fees as your store grows.
        </Text>

        <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[2.5px] uppercase mb-3">
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
              className={`rounded-[26px] border p-5 mb-4 ${
                isCurrent
                  ? 'bg-[#0F1C2E] border-[#3A5A7A]'
                  : 'bg-[#0C1520] border-[#1A2A3A]'
              }`}
            >
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center flex-wrap gap-2">
                    <Text className="text-white text-[18px] font-extrabold">
                      {plan.emoji} {plan.name}
                    </Text>
                    {plan.limited ? (
                      <View className="bg-[#1A1A28] border border-[#3A3A50] px-2 py-0.5 rounded-full">
                        <Text className="text-[#A8A8C0] text-[10px] font-semibold">
                          Limited Availability
                        </Text>
                      </View>
                    ) : null}
                    {isCurrent ? (
                      <View className="bg-[#1A2F28] px-2 py-0.5 rounded-full">
                        <Text className="text-[#8FE3B0] text-[10px] font-bold">
                          Current
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-[#9EC5FF] text-[22px] font-extrabold mt-2">
                    {priceLabel}
                  </Text>
                  {plan.id !== 'free' ? (
                    <Text className="text-[#5A7088] text-[11px] mt-0.5">
                      per month · {regionMeta.name} marketplace
                    </Text>
                  ) : (
                    <Text className="text-[#5A7088] text-[11px] mt-0.5">
                      No monthly charge
                    </Text>
                  )}
                </View>
                <View className="w-11 h-11 rounded-2xl bg-[#13263B] items-center justify-center">
                  <Ionicons
                    name={
                      plan.id === 'free'
                        ? 'leaf-outline'
                        : plan.id === 'global'
                          ? 'globe-outline'
                          : plan.id === 'business'
                            ? 'rocket-outline'
                            : 'diamond-outline'
                    }
                    size={20}
                    color="#DCEBFF"
                  />
                </View>
              </View>

              <View className="h-px bg-[#1A2A3A] my-3" />

              {plan.features.map((f) => (
                <View key={f} className="flex-row items-start mb-2">
                  <Text className="text-[#5A7088] mr-2 mt-0.5">•</Text>
                  <Text className="text-[#C5D4E3] text-[13px] leading-5 flex-1">
                    {f}
                  </Text>
                </View>
              ))}

              <View className="mt-3 flex-row items-center justify-between bg-[#0A121C] rounded-2xl px-4 py-3 border border-[#152030]">
                <Text className="text-[#6B8299] text-[12px]">
                  Transaction fee
                </Text>
                <Text className="text-white font-bold text-[15px]">
                  {plan.feePct}%
                </Text>
              </View>
            </View>
          )
        })}

        <Text className="text-[#4A6078] text-[12px] leading-5 text-center mt-2 px-4">
          Payments and plan changes will be available in a later update. Fees
          apply to product price only — never to delivery.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}