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

// —— modular building blocks (easy to extend later) ——

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

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <View className="flex-row items-center justify-between mb-4">
      <Text className="text-white text-[17px] font-bold">{title}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction}>
          <Text className="text-[#9EC5FF] text-[13px] font-semibold">
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
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
    <View className="w-[48%] bg-[#0B1625] border border-[#1A2D42] rounded-[22px] p-4 mb-3">
      <View className="w-9 h-9 rounded-xl bg-[#152536] items-center justify-center mb-3">
        <Ionicons name={icon} size={18} color="#9EC5FF" />
      </View>
      <Text className="text-white text-[22px] font-extrabold" numberOfLines={1}>
        {value}
      </Text>
      <Text className="text-[#7F93A8] text-[11px] font-semibold tracking-wide uppercase mt-1">
        {label}
      </Text>
      {hint ? (
        <Text className="text-[#5A7088] text-[11px] mt-1.5 leading-4">{hint}</Text>
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
      <View className="bg-[#0E1826] border border-[#1A2D42] rounded-[20px] py-4 px-2 items-center">
        <View className="w-10 h-10 rounded-full bg-[#152536] items-center justify-center mb-2">
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
    <View className="bg-[#0B1625] border border-[#1A2D42] rounded-[24px] px-6 py-10 items-center">
      <View className="w-14 h-14 rounded-full bg-[#132030] items-center justify-center mb-3">
        <Ionicons name={icon} size={26} color="#4A657A" />
      </View>
      <Text className="text-white font-semibold text-[15px] text-center">
        {title}
      </Text>
      <Text className="text-[#6B8299] text-[13px] text-center mt-2 leading-5">
        {subtitle}
      </Text>
    </View>
  )
}

// —— main dashboard ——

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
  const [tipIndex, setTipIndex] = useState(0)

  const firstName =
    user?.firstName ||
    user?.fullName?.split(' ')[0] ||
    user?.username ||
    'Seller'

  const greeting = useMemo(() => getGreeting(new Date().getHours()), [])
  const feePct = PLAN_FEES[overview.plan] ?? PLAN_FEES.free ?? 8

  const loadDashboard = useCallback(async () => {
    try {
      const token = await getToken()
      const headers = { Authorization: `Bearer ${token}` }

      const [dashRes, ordersRes, productsRes] = await Promise.all([
        api.get('/seller/dashboard', { headers }).catch(() => null),
        api.get('/orders/seller/my', { headers }).catch(() => null),
        api.get('/seller/products', { headers }).catch(() => null),
      ])

      const dash = dashRes?.data?.success ? dashRes.data.data : null
      const orders: any[] = ordersRes?.data?.success
        ? ordersRes.data.data || []
        : []
      const products: any[] = productsRes?.data?.success
        ? productsRes.data.data || []
        : []

      const pending = orders.filter(
        (o) => o.orderStatus === 'Preparing' || o.orderStatus === 'Shipped'
      ).length
      const completed = orders.filter(
        (o) => o.orderStatus === 'Delivered'
      ).length

      setOverview({
        totalProducts:
          dash?.totalProducts ?? products.length ?? 0,
        pendingOrders: pending,
        completedOrders: completed,
        storeName: dash?.storeName || '',
        isVerified: !!dash?.isVerified,
        plan: 'free', // swap when subscription API exists
      })

      // Lightweight activity from real orders (expand later)
      const recent: ActivityItem[] = orders.slice(0, 6).map((o) => ({
        id: o._id,
        type: o.orderStatus === 'Shipped' ? 'order_shipped' : 'order_received',
        title:
          o.orderStatus === 'Shipped'
            ? 'Order Shipped'
            : o.orderStatus === 'Delivered'
              ? 'Order Delivered'
              : 'Order Received',
        subtitle: o.orderNumber || 'Order',
        at: o.createdAt,
      }))
      setActivity(recent)
    } catch (e) {
      console.log('Seller dashboard error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [getToken])

  useFocusEffect(
    useCallback(() => {
      if (isSignedIn) loadDashboard()
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
      <View className="flex-1 justify-center items-center bg-[#060D18]">
        <ActivityIndicator size="large" color="#9EC5FF" />
      </View>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#060D18]" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 36 }}
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
        {/* Welcome */}
        <View className="mb-7">
          <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[2px] uppercase">
            Seller home
          </Text>
          <Text className="text-white text-[28px] font-extrabold mt-2 leading-9">
            {greeting}, {firstName}.
          </Text>
          <Text className="text-[#8EA4B8] text-[15px] mt-1.5">
            Welcome back to your store
            {overview.storeName ? ` · ${overview.storeName}` : ''}.
          </Text>
        </View>

        {/* Business overview */}
        <SectionHeader title="Business overview" />
        <View className="flex-row flex-wrap justify-between mb-2">
          <OverviewCard
            label="Total Products"
            value={String(overview.totalProducts)}
            icon="cube-outline"
            hint={
              overview.totalProducts === 0
                ? 'No products published yet.'
                : undefined
            }
          />
          <OverviewCard
            label="Pending Orders"
            value={String(overview.pendingOrders)}
            icon="time-outline"
            hint={
              overview.pendingOrders === 0
                ? 'Your first order will appear here.'
                : undefined
            }
          />
          <OverviewCard
            label="Completed Orders"
            value={String(overview.completedOrders)}
            icon="checkmark-done-outline"
          />
          <OverviewCard
            label="Plan"
            value={overview.plan.charAt(0).toUpperCase() + overview.plan.slice(1)}
            icon="diamond-outline"
          />
        </View>

        {/* Revenue placeholder — no fake numbers */}
        <View className="bg-[#0B1625] border border-dashed border-[#243B55] rounded-[22px] p-5 mb-8">
          <View className="flex-row items-center mb-1">
            <Ionicons name="wallet-outline" size={18} color="#5A7088" />
            <Text className="text-[#8EA4B8] font-semibold text-[13px] ml-2">
              Revenue
            </Text>
          </View>
          <Text className="text-white font-bold text-[16px] mt-1">
            Available after payments are enabled
          </Text>
          <Text className="text-[#5A7088] text-[12px] mt-1.5 leading-4">
            Charts and payouts will land here when checkout payments go live.
          </Text>
        </View>

        {/* Quick actions */}
        <SectionHeader title="Quick actions" />
        <View className="flex-row flex-wrap justify-between mb-6">
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
        </View>

        {/* Recent activity */}
        <SectionHeader
          title="Recent activity"
          actionLabel={activity.length ? 'Orders' : undefined}
          onAction={() => router.push('/seller/orders' as any)}
        />
        {activity.length === 0 ? (
          <View className="mb-8">
            <EmptyBlock
              icon="pulse-outline"
              title="No activity yet"
              subtitle="When you publish products or receive orders, updates will show up here."
            />
          </View>
        ) : (
          <View className="mb-8">
            {activity.map((item) => (
              <View
                key={item.id}
                className="bg-[#0B1625] border border-[#1A2D42] rounded-[20px] px-4 py-3.5 mb-2.5 flex-row items-center"
              >
                <View className="w-10 h-10 rounded-xl bg-[#152536] items-center justify-center mr-3">
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
                  <Text className="text-[#6B8299] text-[12px] mt-0.5">
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

        {/* Seller tips */}
        <SectionHeader title="Seller tips" />
        <View className="bg-[#0E1826] border border-[#1A2D42] rounded-[22px] p-5 mb-8 overflow-hidden">
          <LinearGradient
            colors={['rgba(158,197,255,0.08)', 'transparent']}
            className="absolute left-0 right-0 top-0 h-20"
          />
          <View className="flex-row items-start">
            <View className="w-9 h-9 rounded-xl bg-[#152536] items-center justify-center mr-3">
              <Ionicons name="bulb-outline" size={18} color="#F0C070" />
            </View>
            <View className="flex-1">
              <Text className="text-[#8EA4B8] text-[11px] font-semibold uppercase tracking-wide mb-1">
                Platform tip
              </Text>
              <Text className="text-[#DCEBFF] text-[14px] leading-5">
                {SELLER_TIPS[tipIndex]}
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

        {/* Current plan */}
        <SectionHeader title="Current plan" />
        <View className="bg-[#0B1625] border border-[#1A2D42] rounded-[24px] p-5 mb-4 overflow-hidden">
          <LinearGradient
            colors={['#152636', '#0B1625']}
            className="absolute left-0 right-0 top-0 bottom-0"
          />
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-[#8EA4B8] text-[12px]">Subscription</Text>
              <Text className="text-white text-[22px] font-extrabold mt-0.5 capitalize">
                {overview.plan}
              </Text>
            </View>
            <View className="w-12 h-12 rounded-2xl bg-[#1A2F4A] items-center justify-center">
              <Ionicons name="diamond" size={22} color="#9EC5FF" />
            </View>
          </View>
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-[#6B8299] text-[13px]">Transaction fee</Text>
            <Text className="text-[#DCEBFF] font-bold text-[15px]">
              {feePct}% of product price
            </Text>
          </View>
          <Text className="text-[#5A7088] text-[11px] leading-4 mb-4">
            Fee applies only to product price — never to the delivery fee.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/seller/subscription' as any)}
            activeOpacity={0.88}
            className="bg-[#DCEBFF] rounded-2xl py-3.5 items-center"
          >
            <Text className="text-[#060D18] font-extrabold text-[14px]">
              Manage Subscription
            </Text>
          </TouchableOpacity>
        </View>

        {/* Future slots (analytics / insights) — reserved layout, not built */}
        {/* <SectionHeader title="Performance" /> ... */}
      </ScrollView>
    </SafeAreaView>
  )
}