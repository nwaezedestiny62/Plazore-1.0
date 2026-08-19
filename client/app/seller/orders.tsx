import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMarketplace } from '@/context/MarketplaceContext'
import { ScreenConfigMenu } from '@/components/ScreenConfigMenu'
import api from '@/constants/api'

const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#737A86'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const DANGER = '#EF4444'
const WARN = '#F0C070'

const STATUS_META: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  Preparing: {
    color: WARN,
    bg: 'rgba(240,192,112,0.12)',
    label: 'Preparing',
  },
  Shipped: {
    color: BLUE,
    bg: 'rgba(59,130,246,0.12)',
    label: 'Shipped',
  },
  Delivered: {
    color: GREEN,
    bg: 'rgba(0,229,117,0.12)',
    label: 'Delivered',
  },
  Cancelled: {
    color: DANGER,
    bg: 'rgba(239,68,68,0.12)',
    label: 'Cancelled',
  },
}

const STATUS_ORDER = ['Preparing', 'Shipped', 'Delivered', 'Cancelled']

type OrderSort = 'newest' | 'oldest' | 'status' | 'delivery'

const SORT_LABEL: Record<OrderSort, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  status: 'Status',
  delivery: 'Delivery date',
}

type OverlayAction = {
  label: string
  onPress: () => void
  destructive?: boolean
  primary?: boolean
}

type OverlayState = {
  title: string
  message?: string
  tone?: 'info' | 'success' | 'danger'
  actions?: OverlayAction[]
  durationMs?: number
} | null

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

function toneColor(tone?: NonNullable<OverlayState>['tone']) {
  if (tone === 'danger') return DANGER
  if (tone === 'success') return GREEN
  return BLUE
}

function TopOverlay({
  state,
  onDismiss,
}: {
  state: OverlayState
  onDismiss: () => void
}) {
  const insets = useSafeAreaInsets()
  const translateY = useRef(new Animated.Value(-120)).current
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!state) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start()
      return
    }
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 9,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()
    if (!state.actions?.length) {
      timer.current = setTimeout(() => onDismiss(), state.durationMs ?? 5000)
    }
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state])

  if (!state) return null
  const accent = toneColor(state.tone)
  const hasActions = !!state.actions?.length

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.overlayWrap,
        {
          paddingTop: insets.top + 8,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={[styles.overlayCard, hasActions && styles.overlayCardTall]}>
        <View style={[styles.overlayAccent, { backgroundColor: accent }]} />
        <View style={styles.overlayBody}>
          <View style={styles.overlayTopRow}>
            <View
              style={[styles.overlayIcon, { backgroundColor: `${accent}22` }]}
            >
              <Ionicons
                name={
                  state.tone === 'danger'
                    ? 'warning-outline'
                    : state.tone === 'success'
                      ? 'checkmark-circle-outline'
                      : 'information-circle-outline'
                }
                size={18}
                color={accent}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.overlayTitle}>{state.title}</Text>
              {!!state.message && (
                <Text style={styles.overlayMessage}>{state.message}</Text>
              )}
            </View>
            {!hasActions && (
              <Pressable onPress={onDismiss} hitSlop={12}>
                <Ionicons name="close" size={18} color={MUTED} />
              </Pressable>
            )}
          </View>
          {hasActions && (
            <View style={styles.overlayActions}>
              {state.actions!.map((a, i) => (
                <Pressable
                  key={`${a.label}-${i}`}
                  onPress={() => {
                    onDismiss()
                    requestAnimationFrame(() => a.onPress())
                  }}
                  style={[
                    styles.overlayBtn,
                    a.destructive && styles.overlayBtnDanger,
                    a.primary && styles.overlayBtnPrimary,
                    !a.destructive && !a.primary && styles.overlayBtnGhost,
                  ]}
                >
                  <Text
                    style={[
                      styles.overlayBtnText,
                      a.destructive && { color: '#FFF' },
                      a.primary && { color: BG },
                      !a.destructive && !a.primary && { color: TEXT },
                    ]}
                  >
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  )
}

export default function SellerOrders() {
  const { getToken } = useAuth()
  const router = useRouter()
  const { format } = useMarketplace()

  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sort, setSort] = useState<OrderSort>('newest')
  const [configOpen, setConfigOpen] = useState(false)
  const [hideCompleted, setHideCompleted] = useState(false)
  const [overlay, setOverlay] = useState<OverlayState>(null)

  const dismissOverlay = useCallback(() => setOverlay(null), [])

  const fetchOrders = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await api.get('/orders/seller/my', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) setOrders(res.data.data || [])
    } catch {
      // keep list
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [getToken])

  useFocusEffect(
    useCallback(() => {
      fetchOrders()
    }, [fetchOrders])
  )

  const visible = useMemo(() => {
    if (!hideCompleted) return orders
    return orders.filter(
      (o) => o.orderStatus !== 'Delivered' && o.orderStatus !== 'Cancelled'
    )
  }, [orders, hideCompleted])

  const sorted = useMemo(() => {
    const list = [...visible]
    switch (sort) {
      case 'oldest':
        list.sort(
          (a, b) =>
            new Date(a.createdAt || 0).getTime() -
            new Date(b.createdAt || 0).getTime()
        )
        break
      case 'status':
        list.sort(
          (a, b) =>
            STATUS_ORDER.indexOf(a.orderStatus) -
            STATUS_ORDER.indexOf(b.orderStatus)
        )
        break
      case 'delivery':
        list.sort((a, b) => {
          const da = a.shipping?.estimatedDelivery
            ? new Date(a.shipping.estimatedDelivery).getTime()
            : Number.MAX_SAFE_INTEGER
          const db = b.shipping?.estimatedDelivery
            ? new Date(b.shipping.estimatedDelivery).getTime()
            : Number.MAX_SAFE_INTEGER
          return da - db
        })
        break
      case 'newest':
      default:
        list.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        )
    }
    return list
  }, [visible, sort])

  const applySort = (key: OrderSort) => {
    setSort(key)
    setOverlay({
      title: `Sorted by ${SORT_LABEL[key]}`,
      tone: 'success',
      durationMs: 2200,
    })
  }

  const confirmArchive = () => {
    setOverlay({
      title: hideCompleted ? 'Show all orders?' : 'Hide completed orders?',
      message: hideCompleted
        ? 'Delivered and Cancelled orders will appear in the list again.'
        : 'Delivered and Cancelled orders will be hidden from this list on this device.',
      tone: 'info',
      actions: [
        { label: 'Cancel', onPress: () => {} },
        {
          label: hideCompleted ? 'Show all' : 'Hide them',
          primary: true,
          onPress: () => {
            setHideCompleted((v) => !v)
            setOverlay({
              title: hideCompleted
                ? 'Showing all orders'
                : 'Completed orders hidden',
              tone: 'success',
              durationMs: 2500,
            })
          },
        },
      ],
    })
  }

  const counts = useMemo(() => {
    const c = { Preparing: 0, Shipped: 0, Delivered: 0, Cancelled: 0 }
    for (const o of orders) {
      if (c[o.orderStatus as keyof typeof c] !== undefined) {
        c[o.orderStatus as keyof typeof c]++
      }
    }
    return c
  }, [orders])

  if (loading && !refreshing) {
    return (
      <View style={styles.loaderRoot}>
        <PlazoreOrb size={110} />
        <Text style={styles.loaderHint}>Loading orders…</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopOverlay state={overlay} onDismiss={dismissOverlay} />

      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>Incoming Orders</Text>
          <Text style={styles.subtitle}>
            {sorted.length} shown
            {hideCompleted ? ' · completed hidden' : ''}
            {' · '}
            {SORT_LABEL[sort]}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setConfigOpen(true)}
          style={styles.iconBtn}
        >
          <Ionicons name="options-outline" size={20} color={TEXT} />
        </TouchableOpacity>
      </View>

      {/* Status chips */}
      <View style={styles.chipsRow}>
        {(['Preparing', 'Shipped', 'Delivered'] as const).map((s) => (
          <View
            key={s}
            style={[styles.chip, { backgroundColor: STATUS_META[s].bg }]}
          >
            <Text style={[styles.chipText, { color: STATUS_META[s].color }]}>
              {counts[s]} {STATUS_META[s].label}
            </Text>
          </View>
        ))}
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              fetchOrders()
            }}
            tintColor={GREEN}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={32} color={MUTED} />
            </View>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySub}>
              When buyers place orders, they land here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta =
            STATUS_META[item.orderStatus] || {
              color: MUTED,
              bg: SURFACE_2,
              label: item.orderStatus || 'Order',
            }
          const dateStr = item.createdAt
            ? new Date(item.createdAt).toLocaleDateString()
            : ''

          return (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() =>
                router.push(`/seller/orders/${item._id}` as any)
              }
              style={styles.card}
            >
              <View style={styles.cardTop}>
                <Text style={styles.orderNo} numberOfLines={1}>
                  {item.orderNumber || 'Order'}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.statusText, { color: meta.color }]}>
                    {meta.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.buyerLine} numberOfLines={1}>
                {item.buyer?.name || item.user?.name || 'Buyer'}
                {' · '}
                {item.items?.length || 0} item
                {(item.items?.length || 0) !== 1 ? 's' : ''}
              </Text>

              <View style={styles.cardBottom}>
                <Text style={styles.amount}>
                  {format(Number(item.totalAmount) || 0)}
                </Text>
                {!!dateStr && <Text style={styles.date}>{dateStr}</Text>}
              </View>
            </TouchableOpacity>
          )
        }}
      />

      <ScreenConfigMenu
        visible={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Order options"
        options={[
          {
            id: 'newest',
            label: 'Sort by Newest',
            icon: 'arrow-down-outline',
            selected: sort === 'newest',
            onPress: () => applySort('newest'),
          },
          {
            id: 'oldest',
            label: 'Sort by Oldest',
            icon: 'arrow-up-outline',
            selected: sort === 'oldest',
            onPress: () => applySort('oldest'),
          },
          {
            id: 'status',
            label: 'Sort by Status',
            icon: 'layers-outline',
            selected: sort === 'status',
            onPress: () => applySort('status'),
          },
          {
            id: 'delivery',
            label: 'Sort by Delivery Date',
            icon: 'calendar-outline',
            selected: sort === 'delivery',
            onPress: () => applySort('delivery'),
          },
          {
            id: 'archive',
            label: hideCompleted
              ? 'Show completed orders'
              : 'Hide completed orders',
            icon: 'archive-outline',
            onPress: confirmArchive,
          },
        ]}
      />
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
  loaderHint: { marginTop: 16, color: MUTED, fontSize: 13 },

  overlayWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 100,
    paddingHorizontal: 14,
  },
  overlayCard: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    minHeight: 64,
  },
  overlayCardTall: { minHeight: 88 },
  overlayAccent: { width: 3 },
  overlayBody: { flex: 1, padding: 12 },
  overlayTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  overlayIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTitle: { color: TEXT, fontSize: 14, fontWeight: '700' },
  overlayMessage: {
    color: SECONDARY,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
  },
  overlayActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  overlayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 72,
    alignItems: 'center',
  },
  overlayBtnGhost: {
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  overlayBtnPrimary: { backgroundColor: TEXT },
  overlayBtnDanger: { backgroundColor: DANGER },
  overlayBtnText: { fontSize: 13, fontWeight: '700' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  subtitle: { marginTop: 2, fontSize: 12, color: MUTED },
  iconBtn: {
    width: 40,
    height: 40,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { fontSize: 11, fontWeight: '700' },

  listContent: { paddingHorizontal: 16, paddingBottom: 40 },

  empty: { alignItems: 'center', marginTop: 64, paddingHorizontal: 24 },
  emptyIcon: {
    width: 64,
    height: 64,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: TEXT },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
  },

  card: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  orderNo: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  buyerLine: {
    marginTop: 8,
    fontSize: 13,
    color: SECONDARY,
  },
  cardBottom: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    color: GREEN,
  },
  date: { fontSize: 12, color: MUTED },
})