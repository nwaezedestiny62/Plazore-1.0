import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import api from '@/constants/api'
import { PLAN_FEES } from '@/constants/productCatalog'
import { PerformanceChart } from '@/components/PerformanceChart'

const SELLER_TIPS = [
  'Products with high-quality images usually attract more buyers.',
  'Keep your shipping information updated so buyers know what to expect.',
  'Complete your storefront to improve buyer trust.',
  'Update your inventory regularly to avoid cancelled orders.',
  'Clear product titles help shoppers find you faster in the mall.',
]

type Overview = {
  totalProducts: number
  pendingOrders: number
  completedOrders: number
  storeName: string
  isVerified: boolean
  plan: string
}

type ActivityItem = {
  id: string
  type: string
  title: string
  subtitle: string
  at: string
}

function getGreeting(hour: number) {
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function OverviewCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string
  value: string
  icon: keyof typeof Ionicons.glyphMap
  hint?: string
}) {
  return (
    <View className="w-[48%] bg-[#0C1520] border border-[#1A2A3A] rounded-[24px] p-4 mb-3">
      <View className="w-10 h-10 rounded-2xl bg-[#13263B] items-center justify-center mb-3">
        <Ionicons name={icon} size={18} color="#9EC5FF" />
      </View>
      <Text className="text-white text-[22px] font-extrabold" numberOfLines={1}>
        {value}
      </Text>
      <Text className="text-[#6B8299] text-[11px] font-semibold tracking-wide uppercase mt-1">
        {label}
      </Text>
      {hint ? (
        <Text className="text-[#4A6078] text-[11px] mt-1.5 leading-4">{hint}</Text>
      ) : null}
    </View>
  )
}

function QuickAction({
  label,
  icon,
  onPress,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      className="w-[31%] mb-3"
    >
      <View className="bg-[#0C1520] border border-[#1A2A3A] rounded-[22px] py-4 px-2 items-center">
        <View className="w-11 h-11 rounded-2xl bg-[#13263B] items-center justify-center mb-2.5">
          <Ionicons name={icon} size={20} color="#DCEBFF" />
        </View>
        <Text className="text-[#C5D4E3] text-[11px] font-semibold text-center">
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

function EmptyBlock({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
}) {
  return (
    <View className="bg-[#0C1520] border border-[#1A2A3A] rounded-[24px] px-6 py-10 items-center">
      <View className="w-14 h-14 rounded-full bg-[#132030] items-center justify-center mb-3">
        <Ionicons name={icon} size={26} color="#4A657A" />
      </View>
      <Text className="text-white font-semibold text-[15px] text-center">
        {title}
      </Text>
      <Text className="text-[#5A7088] text-[13px] text-center mt-2 leading-5">
        {subtitle}
      </Text>
    </View>
  )
}

export default function SellerDashboard() {
  const { getToken, isSignedIn } = useAuth()
  const { user } = useUser()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [overview, setOverview] = useState<Overview>({
    totalProducts: 0,
    pendingOrders: 0,
    completedOrders: 0,
    storeName: '',
    isVerified: false,
    plan: 'free',
  })
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [tipIndex, setTipIndex] = useState(0)

  const firstName =
    user?.firstName ||
    user?.fullName?.split(' ')[0] ||
    user?.username ||
    'Seller'

  const greeting = useMemo(() => getGreeting(new Date().getHours()), [])

  // Safe access to PLAN_FEES
  const feePct =
    (PLAN_FEES && typeof PLAN_FEES === 'object'
      ? PLAN_FEES[overview.plan] ?? PLAN_FEES.free
      : null) ?? 8

  const loadDashboard = useCallback(async () => {
    try {
      const token = await getToken()
      const headers = { Authorization: `Bearer ${token}` }

      const [dashRes, ordersRes, productsRes, analyticsRes] = await Promise.all([
        api.get('/seller/dashboard', { headers }).catch(() => null),
        api.get('/orders/seller/my', { headers }).catch(() => null),
        api.get('/seller/products', { headers }).catch(() => null),
        api.get('/analytics/seller?range=30', { headers }).catch(() => null),
      ])

      const dash = dashRes?.data?.success ? dashRes.data.data : null

      // Always force arrays
      const orders: any[] = Array.isArray(ordersRes?.data?.data)
        ? ordersRes.data.data
        : []
      const products: any[] = Array.isArray(productsRes?.data?.data)
        ? productsRes.data.data
        : []

      if (analyticsRes?.data?.success && analyticsRes.data.data) {
        setAnalytics(analyticsRes.data.data)
      } else {
        setAnalytics(null)
      }

      const pending = orders.filter(
        (o) => o?.orderStatus === 'Preparing' || o?.orderStatus === 'Shipped'
      ).length

      const completed = orders.filter(
        (o) => o?.orderStatus === 'Delivered'
      ).length

      setOverview({
        totalProducts: dash?.totalProducts ?? products.length ?? 0,
        pendingOrders: pending,
        completedOrders: completed,
        storeName: dash?.storeName || '',
        isVerified: !!dash?.isVerified,
        plan: dash?.plan || 'free',
      })

      const recent: ActivityItem[] = orders.slice(0, 6).map((o: any) => ({
        id: String(o?._id || Math.random()),
        type: o?.orderStatus === 'Shipped' ? 'order_shipped' : 'order_received',
        title:
          o?.orderStatus === 'Shipped'
            ? 'Order Shipped'
            : o?.orderStatus === 'Delivered'
              ? 'Order Delivered'
              : 'Order Received',
        subtitle: o?.orderNumber || 'Order',
        at: o?.createdAt || '',
      }))

      setActivity(recent)
    } catch (e) {
      console.log('Seller dashboard error:', e)
      // Keep previous state on error
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [getToken])

  useFocusEffect(
    useCallback(() => {
      if (isSignedIn) {
        loadDashboard()
      } else {
        setLoading(false)
      }
    }, [isSignedIn, loadDashboard])
  )

  useEffect(() => {
    const t = setInterval(() => {
      setTipIndex((i) => (i + 1) % SELLER_TIPS.length)
    }, 8000)
    return () => clearInterval(t)
  }, [])

  if (loading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center bg-[#060B14]">
        <ActivityIndicator size="large" color="#9EC5FF" />
      </View>
    )
  }

  // Safe arrays for rendering
  const safeActivity = Array.isArray(activity) ? activity : []
  const safeTopProducts = Array.isArray(analytics?.topProducts)
    ? analytics.topProducts
    : []
  const safeSeries = Array.isArray(analytics?.series) ? analytics.series : []

  return (
    <SafeAreaView className="flex-1 bg-[#060B14]" edges={['top']}>
      {/* Top bar */}
      <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[3px] uppercase">
            Seller Lounge
          </Text>
          <Text className="text-white text-[20px] font-extrabold mt-0.5">
            {overview.storeName || 'Your Store'}
          </Text>
        </View>

        <View className="flex-row items-center gap-3">
          {!overview.isVerified && (
            <View className="bg-[#2A1F12] border border-[#5A3A1A] px-2.5 py-1 rounded-full">
              <Text className="text-[#F0C070] text-[10px] font-semibold">
                Pending
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => router.push('/seller/settings' as any)}
            activeOpacity={0.8}
            className="w-11 h-11 rounded-2xl bg-[#0C1520] border border-[#1A2A3A] items-center justify-center"
          >
            <Ionicons name="settings-outline" size={22} color="#DCEBFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              loadDashboard()
            }}
            tintColor="#9EC5FF"
          />
        }
      >
        {/* Greeting */}
        <View className="mb-7">
          <Text className="text-white text-[26px] font-extrabold leading-8">
            {greeting}, {firstName}.
          </Text>
          <Text className="text-[#7A93A8] text-[14px] mt-1.5">
            Here’s what’s happening in your store today.
          </Text>
        </View>

        {/* Overview */}
        <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[2.5px] uppercase mb-3">
          Overview
        </Text>
        <View className="flex-row flex-wrap justify-between mb-2">
          <OverviewCard
            label="Products"
            value={String(overview.totalProducts ?? 0)}
            icon="cube-outline"
            hint={
              overview.totalProducts === 0
                ? 'No products published yet.'
                : undefined
            }
          />
          <OverviewCard
            label="Pending"
            value={String(overview.pendingOrders ?? 0)}
            icon="time-outline"
            hint={
              overview.pendingOrders === 0
                ? 'Orders will appear here.'
                : undefined
            }
          />
          <OverviewCard
            label="Completed"
            value={String(overview.completedOrders ?? 0)}
            icon="checkmark-done-outline"
          />
          <OverviewCard
            label="Plan"
            value={
              (overview.plan || 'free').charAt(0).toUpperCase() +
              (overview.plan || 'free').slice(1)
            }
            icon="diamond-outline"
          />
        </View>

        {/* Performance */}
        <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[2.5px] uppercase mb-3 mt-2">
          Performance
        </Text>
        <View className="bg-[#0C1520] border border-[#1A2A3A] rounded-[24px] p-5 mb-6">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-white font-bold text-[15px]">
              Store engagement
            </Text>
            <Text className="text-[#9EC5FF] font-extrabold text-[16px]">
              {analytics?.totals?.score ?? 0} pts
            </Text>
          </View>
          <Text className="text-[#5A7088] text-[11px] mb-3">
            Views · Cart · Purchases (last {analytics?.rangeDays || 30} days)
          </Text>

          <PerformanceChart data={safeSeries} />

          <Text className="text-white font-semibold text-[13px] mt-5 mb-3">
            Top performing products
          </Text>

          {safeTopProducts.length === 0 ? (
            <Text className="text-[#5A7088] text-[12px] leading-5">
              Rankings appear as buyers view, cart, and purchase your items.
            </Text>
          ) : (
            safeTopProducts.map((p: any, i: number) => (
              <TouchableOpacity
                key={String(p?.productId || i)}
                onPress={() => {
                  if (p?.productId) {
                    router.push(
                      `/seller/products/performance/${p.productId}` as any
                    )
                  }
                }}
                activeOpacity={0.85}
                className="flex-row items-center py-2.5 border-b border-[#152030]"
              >
                <Text className="text-[#5A7088] w-6 text-[12px]">{i + 1}</Text>
                <Text
                  className="text-white flex-1 text-[13px]"
                  numberOfLines={1}
                >
                  {p?.name || 'Product'}
                </Text>
                {p?.milestone200 ? (
                  <View className="bg-[#1A2F28] px-2 py-0.5 rounded-full mr-2">
                    <Text className="text-[#8FE3B0] text-[9px] font-bold">
                      200+
                    </Text>
                  </View>
                ) : null}
                <Text className="text-[#9EC5FF] font-bold text-[13px]">
                  {p?.score ?? 0}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Revenue placeholder */}
        <View className="bg-[#0C1520] border border-dashed border-[#243B55] rounded-[24px] p-5 mb-8 mt-1">
          <View className="flex-row items-center mb-1">
            <Ionicons name="wallet-outline" size={18} color="#5A7088" />
            <Text className="text-[#7A93A8] font-semibold text-[13px] ml-2">
              Revenue
            </Text>
          </View>
          <Text className="text-white font-bold text-[16px] mt-1">
            Available after payments are enabled
          </Text>
          <Text className="text-[#4A6078] text-[12px] mt-1.5 leading-4">
            Charts and payouts will land here when checkout payments go live.
          </Text>
        </View>

        {/* Quick Actions */}
        <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[2.5px] uppercase mb-3">
          Quick Actions
        </Text>
        <View className="flex-row flex-wrap justify-between mb-7">
          <QuickAction
            label="Add Product"
            icon="add-circle-outline"
            onPress={() => router.push('/seller/products/add' as any)}
          />
          <QuickAction
            label="Products"
            icon="cube-outline"
            onPress={() => router.push('/seller/products' as any)}
          />
          <QuickAction
            label="Orders"
            icon="receipt-outline"
            onPress={() => router.push('/seller/orders' as any)}
          />
          <QuickAction
            label="My Store"
            icon="storefront-outline"
            onPress={() => router.push('/seller/store' as any)}
          />
          <QuickAction
            label="Subscription"
            icon="diamond-outline"
            onPress={() => router.push('/seller/subscription' as any)}
          />
          <QuickAction
            label="Settings"
            icon="settings-outline"
            onPress={() => router.push('/seller/settings' as any)}
          />
        </View>

        {/* Recent Activity */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[2.5px] uppercase">
            Recent Activity
          </Text>
          {safeActivity.length > 0 && (
            <TouchableOpacity
              onPress={() => router.push('/seller/orders' as any)}
            >
              <Text className="text-[#9EC5FF] text-[13px] font-semibold">
                View all
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {safeActivity.length === 0 ? (
          <View className="mb-8">
            <EmptyBlock
              icon="pulse-outline"
              title="No activity yet"
              subtitle="When you publish products or receive orders, updates will show up here."
            />
          </View>
        ) : (
          <View className="mb-8">
            {safeActivity.map((item) => (
              <View
                key={item.id}
                className="bg-[#0C1520] border border-[#1A2A3A] rounded-[20px] px-4 py-3.5 mb-2.5 flex-row items-center"
              >
                <View className="w-10 h-10 rounded-xl bg-[#13263B] items-center justify-center mr-3">
                  <Ionicons
                    name={
                      item.type === 'order_shipped'
                        ? 'car-outline'
                        : 'bag-check-outline'
                    }
                    size={18}
                    color="#9EC5FF"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-semibold text-[14px]">
                    {item.title}
                  </Text>
                  <Text className="text-[#5A7088] text-[12px] mt-0.5">
                    {item.subtitle}
                    {item.at
                      ? ` · ${new Date(item.at).toLocaleDateString()}`
                      : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Seller Tips */}
        <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[2.5px] uppercase mb-3">
          Seller Tips
        </Text>
        <View className="bg-[#0C1520] border border-[#1A2A3A] rounded-[24px] p-5 mb-8 overflow-hidden">
          <LinearGradient
            colors={['rgba(158,197,255,0.07)', 'transparent']}
            className="absolute left-0 right-0 top-0 h-20"
          />
          <View className="flex-row items-start">
            <View className="w-10 h-10 rounded-2xl bg-[#13263B] items-center justify-center mr-3">
              <Ionicons name="bulb-outline" size={18} color="#F0C070" />
            </View>
            <View className="flex-1">
              <Text className="text-[#6B8299] text-[11px] font-semibold uppercase tracking-wide mb-1">
                Platform tip
              </Text>
              <Text className="text-[#DCEBFF] text-[14px] leading-5">
                {SELLER_TIPS[tipIndex] || SELLER_TIPS[0]}
              </Text>
            </View>
          </View>
          <View className="flex-row mt-4 gap-1.5">
            {SELLER_TIPS.map((_, i) => (
              <View
                key={i}
                className={`h-1 rounded-full ${
                  i === tipIndex ? 'w-4 bg-[#9EC5FF]' : 'w-1.5 bg-[#2A3D52]'
                }`}
              />
            ))}
          </View>
        </View>

        {/* Current Plan */}
        <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[2.5px] uppercase mb-3">
          Current Plan
        </Text>
        <View className="bg-[#0C1520] border border-[#1A2A3A] rounded-[24px] p-5 mb-4 overflow-hidden">
          <LinearGradient
            colors={['#12243A', '#0C1520']}
            className="absolute left-0 right-0 top-0 bottom-0"
          />
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-[#6B8299] text-[12px]">Subscription</Text>
              <Text className="text-white text-[22px] font-extrabold mt-0.5 capitalize">
                {overview.plan || 'free'}
              </Text>
            </View>
            <View className="w-12 h-12 rounded-2xl bg-[#1A2F4A] items-center justify-center">
              <Ionicons name="diamond" size={22} color="#9EC5FF" />
            </View>
          </View>
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-[#5A7088] text-[13px]">Transaction fee</Text>
            <Text className="text-[#DCEBFF] font-bold text-[15px]">
              {feePct}% of product price
            </Text>
          </View>
          <Text className="text-[#4A6078] text-[11px] leading-4 mb-4">
            Fee applies only to product price — never to the delivery fee.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/seller/subscription' as any)}
            activeOpacity={0.88}
            className="bg-[#DCEBFF] rounded-2xl py-3.5 items-center"
          >
            <Text className="text-[#060B14] font-extrabold text-[14px]">
              Manage Subscription
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}