import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import api from '@/constants/api'
import { PLAN_FEES } from '@/constants/productCatalog'
import { DashboardPerformanceBars } from '@/components/DashboardPerformanceBars'

const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#737A86'
const GREEN = '#00E575'
const BLUE = '#3B82F6'

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
  revenue?: number
}

type ActivityItem = {
  id: string
  type: string
  title: string
  subtitle: string
  at: string
}

function getGreeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
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
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
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

function StatPill({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: keyof typeof Ionicons.glyphMap
}) {
  return (
    <View style={styles.statPill}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={SECONDARY} />
      </View>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function ActionTile({
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
      style={styles.actionTile}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={TEXT} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
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
    revenue: 0,
  })
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [tipIndex, setTipIndex] = useState(0)
  const tipOpacity = useRef(new Animated.Value(1)).current
  const hasLoadedOnce = useRef(false)

  const firstName =
    user?.firstName ||
    user?.fullName?.split(' ')[0] ||
    user?.username ||
    'Seller'

  const greeting = useMemo(() => getGreeting(new Date().getHours()), [])

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
      const orders: any[] = Array.isArray(ordersRes?.data?.data)
        ? ordersRes.data.data
        : []
      const products: any[] = Array.isArray(productsRes?.data?.data)
        ? productsRes.data.data
        : []

      const analyticsData =
        analyticsRes?.data?.success && analyticsRes.data.data
          ? analyticsRes.data.data
          : null
      setAnalytics(analyticsData)

      const pending = orders.filter(
        (o) => o?.orderStatus === 'Preparing' || o?.orderStatus === 'Shipped'
      ).length
      const completed = orders.filter(
        (o) => o?.orderStatus === 'Delivered'
      ).length

      const revenue =
        Number(
          dash?.revenue ??
            dash?.totalRevenue ??
            analyticsData?.totals?.revenue
        ) || 0

      setOverview({
        totalProducts: dash?.totalProducts ?? products.length ?? 0,
        pendingOrders: pending,
        completedOrders: completed,
        storeName: dash?.storeName || '',
        isVerified: !!dash?.isVerified,
        plan: dash?.plan || 'free',
        revenue,
      })

      const recent: ActivityItem[] = orders.slice(0, 5).map((o: any) => ({
        id: String(o?._id || Math.random()),
        type:
          o?.orderStatus === 'Shipped'
            ? 'order_shipped'
            : o?.orderStatus === 'Delivered'
              ? 'order_delivered'
              : 'order_received',
        title:
          o?.orderStatus === 'Shipped'
            ? 'Order shipped'
            : o?.orderStatus === 'Delivered'
              ? 'Order delivered'
              : 'New order',
        subtitle: o?.orderNumber || 'Order',
        at: o?.createdAt || '',
      }))
      setActivity(recent)
    } catch (e) {
      console.log('Seller dashboard error:', e)
    } finally {
      hasLoadedOnce.current = true
      setLoading(false)
      setRefreshing(false)
    }
  }, [getToken])

  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn) {
        setLoading(false)
        return
      }
      // Full-screen orb only on first open — pull-to-refresh stays inline
      if (!hasLoadedOnce.current) {
        setLoading(true)
      }
      loadDashboard()
    }, [isSignedIn, loadDashboard])
  )

  useEffect(() => {
    if (loading) return
    const t = setInterval(() => {
      Animated.timing(tipOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(() => {
        setTipIndex((i) => (i + 1) % SELLER_TIPS.length)
        Animated.timing(tipOpacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }).start()
      })
    }, 8000)
    return () => clearInterval(t)
  }, [loading])

  const safeActivity = Array.isArray(activity) ? activity : []
  const safeTopProducts = Array.isArray(analytics?.topProducts)
    ? analytics.topProducts
    : []
  const safeSeries = Array.isArray(analytics?.series) ? analytics.series : []

  const revenueLabel =
    overview.revenue && overview.revenue > 0
      ? `$${Number(overview.revenue).toLocaleString()}`
      : '—'

  // ── ONLY orb — nothing else on screen ──
  if (loading && !refreshing) {
    return (
      <View style={styles.loaderRoot}>
        <PlazoreOrb size={110} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEyebrow}>Seller Lounge</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {overview.storeName || 'Your Store'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {!overview.isVerified && (
            <View style={styles.pendingPill}>
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => router.push('/seller/store' as any)}
            activeOpacity={0.85}
            style={styles.headerBtn}
            accessibilityLabel="Customize storefront"
          >
            <Ionicons name="color-palette-outline" size={20} color={TEXT} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/seller/settings' as any)}
            activeOpacity={0.85}
            style={styles.headerBtn}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={20} color={TEXT} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back()
              } else {
                router.replace('/(tabs)' as any)
              }
            }}
            activeOpacity={0.85}
            style={styles.exitBtn}
            accessibilityLabel="Exit seller lounge"
          >
            <Ionicons name="exit-outline" size={16} color={BLUE} />
            <Text style={styles.exitText}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              loadDashboard()
            }}
            tintColor={GREEN}
          />
        }
      >
        <Text style={styles.greeting}>
          {greeting}, {firstName}
        </Text>
        <Text style={styles.greetingSub}>Your store at a glance.</Text>

        <LinearGradient
          colors={['rgba(0,229,117,0.14)', 'rgba(59,130,246,0.10)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.revenueCard}
        >
          <View style={styles.revenueTop}>
            <Text style={styles.revenueEyebrow}>Revenue</Text>
            <View style={styles.revenueBadge}>
              <Text style={styles.revenueBadgeText}>
                {(overview.plan || 'free').toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.revenueAmount} numberOfLines={1}>
            {revenueLabel}
          </Text>
          <Text style={styles.revenueHint}>
            {overview.revenue && overview.revenue > 0
              ? 'Lifetime from completed orders on Plazore.'
              : 'Payouts and live totals appear here when payments are enabled.'}
          </Text>
          <View style={styles.revenueMeta}>
            <Text style={styles.revenueMetaText}>
              Fee · {feePct}% of product price
            </Text>
            <Pressable
              onPress={() => router.push('/seller/subscription' as any)}
            >
              <Text style={styles.revenueLink}>Plan</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <StatPill
            label="Products"
            value={String(overview.totalProducts)}
            icon="cube-outline"
          />
          <StatPill
            label="Pending"
            value={String(overview.pendingOrders)}
            icon="time-outline"
          />
          <StatPill
            label="Completed"
            value={String(overview.completedOrders)}
            icon="checkmark-done-outline"
          />
        </View>

        <Text style={styles.sectionLabel}>Performance</Text>
        <View style={styles.card}>
          <View style={styles.cardRowBetween}>
            <View>
              <Text style={styles.cardTitle}>Engagement</Text>
              <Text style={styles.cardSub}>
                Last {analytics?.rangeDays || 30} days
              </Text>
            </View>
            <LinearGradient
              colors={[GREEN, BLUE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.scorePill}
            >
              <Text style={styles.scoreText}>
                {analytics?.totals?.score ?? 0} pts
              </Text>
            </LinearGradient>
          </View>

          <View style={{ marginTop: 12 }}>
  <DashboardPerformanceBars data={safeSeries /* or analytics?.series || [] */} />
</View>

          <Text style={[styles.cardTitle, { marginTop: 18, marginBottom: 8 }]}>
            Top products
          </Text>
          {safeTopProducts.length === 0 ? (
            <Text style={styles.emptyHint}>
              Rankings appear as buyers view, cart, and purchase your items.
            </Text>
          ) : (
            safeTopProducts.slice(0, 5).map((p: any, i: number) => (
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
                style={styles.topRow}
              >
                <Text style={styles.topRank}>{i + 1}</Text>
                <Text style={styles.topName} numberOfLines={1}>
                  {p?.name || 'Product'}
                </Text>
                {p?.milestone200 ? (
                  <View style={styles.milestone}>
                    <Text style={styles.milestoneText}>200+</Text>
                  </View>
                ) : null}
                <Text style={styles.topScore}>{p?.score ?? 0}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <Text style={styles.sectionLabel}>Actions</Text>
        <View style={styles.actionsGrid}>
          <ActionTile
            label="Add product"
            icon="add-circle-outline"
            onPress={() => router.push('/seller/products/add' as any)}
          />
          <ActionTile
            label="Products"
            icon="cube-outline"
            onPress={() => router.push('/seller/products' as any)}
          />
          <ActionTile
            label="Orders"
            icon="receipt-outline"
            onPress={() => router.push('/seller/orders' as any)}
          />
          <ActionTile
            label="Storefront"
            icon="storefront-outline"
            onPress={() => router.push('/seller/store' as any)}
          />
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabelInline}>Recent activity</Text>
          {safeActivity.length > 0 && (
            <Pressable onPress={() => router.push('/seller/orders' as any)}>
              <Text style={styles.viewAll}>View all</Text>
            </Pressable>
          )}
        </View>

        {safeActivity.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="pulse-outline" size={26} color={MUTED} />
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptyHint}>
              Orders and shipments will show up here.
            </Text>
          </View>
        ) : (
          safeActivity.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <View style={styles.activityIcon}>
                <Ionicons
                  name={
                    item.type === 'order_shipped'
                      ? 'airplane-outline'
                      : item.type === 'order_delivered'
                        ? 'checkmark-circle-outline'
                        : 'bag-check-outline'
                  }
                  size={18}
                  color={GREEN}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.activitySub}>
                  {item.subtitle}
                  {item.at
                    ? ` · ${new Date(item.at).toLocaleDateString()}`
                    : ''}
                </Text>
              </View>
            </View>
          ))
        )}

        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Tip</Text>
        <View style={styles.tipCard}>
          <View style={styles.tipIcon}>
            <Ionicons name="bulb-outline" size={18} color={GREEN} />
          </View>
          <Animated.Text style={[styles.tipText, { opacity: tipOpacity }]}>
            {SELLER_TIPS[tipIndex]}
          </Animated.Text>
          <View style={styles.tipDots}>
            {SELLER_TIPS.map((_, i) => (
              <View
                key={i}
                style={[styles.tipDot, i === tipIndex && styles.tipDotOn]}
              />
            ))}
          </View>
        </View>

        <View style={styles.planCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.planEyebrow}>Subscription</Text>
            <Text style={styles.planName}>
              {(overview.plan || 'free').charAt(0).toUpperCase() +
                (overview.plan || 'free').slice(1)}
            </Text>
            <Text style={styles.planFee}>{feePct}% product fee</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/seller/subscription' as any)}
            activeOpacity={0.88}
            style={styles.planCta}
          >
            <LinearGradient
              colors={[GREEN, BLUE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.planCtaGrad}
            >
              <Text style={styles.planCtaText}>Manage</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerBrand}>Plazore · Seller Lounge</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  loaderRoot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    backgroundColor: BG,
  },
  headerLeft: { flex: 1, minWidth: 0, marginRight: 12 },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: MUTED,
    textTransform: 'uppercase',
  },
  headerTitle: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: {
    width: 40,
    height: 40,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  pendingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F0C070',
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },

  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.4,
  },
  greetingSub: {
    marginTop: 4,
    marginBottom: 18,
    fontSize: 14,
    color: SECONDARY,
  },

  revenueCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,229,117,0.22)',
    padding: 18,
    marginBottom: 14,
  },
  revenueTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  revenueEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: MUTED,
    textTransform: 'uppercase',
  },
  revenueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  revenueBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: SECONDARY,
    letterSpacing: 0.6,
  },
  revenueAmount: {
    marginTop: 10,
    fontSize: 36,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -1,
  },
  revenueHint: {
    marginTop: 6,
    fontSize: 12.5,
    color: SECONDARY,
    lineHeight: 18,
  },
  revenueMeta: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  revenueMetaText: { fontSize: 12, color: MUTED },
  revenueLink: { fontSize: 13, fontWeight: '700', color: GREEN },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },
  statPill: {
    flex: 1,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 12,
  },
  statIcon: {
    width: 28,
    height: 28,
    backgroundColor: SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionLabelInline: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
    textTransform: 'uppercase',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 8,
  },
  viewAll: { fontSize: 13, fontWeight: '600', color: GREEN },

  card: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    marginBottom: 22,
  },
  cardRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: TEXT },
  cardSub: { fontSize: 11, color: MUTED, marginTop: 2 },
  scorePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  scoreText: { color: '#041412', fontWeight: '800', fontSize: 12 },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  topRank: { width: 22, fontSize: 12, color: MUTED },
  topName: { flex: 1, fontSize: 13, color: TEXT, marginRight: 8 },
  topScore: { fontSize: 13, fontWeight: '700', color: GREEN },
  milestone: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,229,117,0.12)',
    marginRight: 8,
  },
  milestoneText: { fontSize: 9, fontWeight: '800', color: GREEN },

  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 22,
  },
  actionTile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  actionIcon: {
    width: 40,
    height: 40,
    backgroundColor: SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SECONDARY,
  },

  emptyCard: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 28,
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  emptyHint: {
    marginTop: 6,
    fontSize: 12.5,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 18,
  },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 12,
    marginBottom: 8,
  },
  activityIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(0,229,117,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityTitle: { fontSize: 14, fontWeight: '600', color: TEXT },
  activitySub: { fontSize: 12, color: MUTED, marginTop: 2 },

  tipCard: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    marginBottom: 18,
  },
  tipIcon: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(0,229,117,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tipText: {
    fontSize: 14,
    color: SECONDARY,
    lineHeight: 21,
    minHeight: 42,
  },
  tipDots: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 14,
  },
  tipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: LINE,
  },
  tipDotOn: {
    width: 14,
    backgroundColor: GREEN,
  },

  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    marginBottom: 20,
  },
  planEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  planName: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
  },
  planFee: { marginTop: 2, fontSize: 12, color: SECONDARY },
  planCta: { borderRadius: 10, overflow: 'hidden' },
  planCtaGrad: {
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  planCtaText: { color: '#041412', fontWeight: '800', fontSize: 13 },

  footerBrand: {
    textAlign: 'center',
    fontSize: 11,
    color: MUTED,
    letterSpacing: 0.6,
  },
    exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 40,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  exitText: {
    fontSize: 12,
    fontWeight: '700',
    color: BLUE,
  },
})