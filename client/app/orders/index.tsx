import api from '@/constants/api'
import { ScreenConfigMenu } from '@/components/ScreenConfigMenu'
import { useMarketplace } from '@/context/MarketplaceContext'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

/* ── Plazore tokens ── */
const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#6B7280'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const DANGER = '#EF4444'

const HIDDEN_KEY = '@plazore_hidden_completed_orders'

const statusColor: Record<string, string> = {
  Preparing: '#F0C070',
  Shipped: '#3B82F6',
  Delivered: '#00E575',
  Cancelled: '#EF4444',
}

const STATUS_ORDER = ['Preparing', 'Shipped', 'Delivered', 'Cancelled']

type SortMode = 'newest' | 'oldest' | 'status'

function PlazoreOrbPreloader() {
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

  return (
    <View style={styles.loaderRoot}>
      <View style={styles.orbWrapper}>
        <Animated.View style={[styles.orbRing, { transform: [{ rotate }] }]} />
        <View style={styles.orbLogoWrap}>
          <Image
            source={require('@/assets/logo-1.png')}
            style={styles.orbLogo}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  )
}

export default function BuyerOrders() {
  const { getToken } = useAuth()
  const router = useRouter()
  const { format } = useMarketplace()

  const [orders, setOrders] = useState<any[]>([])
  const [hiddenIds, setHiddenIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sort, setSort] = useState<SortMode>('newest')
  const [configOpen, setConfigOpen] = useState(false)

  const loadHidden = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(HIDDEN_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setHiddenIds(parsed.map(String))
      }
    } catch {
      // ignore
    }
  }, [])

  const fetchOrders = async () => {
    try {
      const token = await getToken()
      const res = await api.get('/orders', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) setOrders(res.data.data || [])
    } catch {
      // keep existing list
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadHidden()
      fetchOrders()
    }, [loadHidden])
  )

  const visibleOrders = useMemo(() => {
    const hidden = new Set(hiddenIds)
    return orders.filter((o) => !hidden.has(String(o._id)))
  }, [orders, hiddenIds])

  const sorted = useMemo(() => {
    const list = [...visibleOrders]
    if (sort === 'newest') {
      list.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      )
    } else if (sort === 'oldest') {
      list.sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime()
      )
    } else {
      list.sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.orderStatus) -
          STATUS_ORDER.indexOf(b.orderStatus)
      )
    }
    return list
  }, [visibleOrders, sort])

  const clearCompleted = () => {
    const completed = orders.filter(
      (o) =>
        o.orderStatus === 'Delivered' || o.orderStatus === 'Cancelled'
    )

    if (completed.length === 0) {
      Alert.alert('Nothing to clear', 'No Delivered or Cancelled orders to hide.')
      return
    }

    Alert.alert(
      'Clear completed',
      `Hide ${completed.length} completed order${completed.length !== 1 ? 's' : ''} from this list permanently? They remain in your history on the server.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              const idsToHide = completed.map((o) => String(o._id))
              const next = Array.from(new Set([...hiddenIds, ...idsToHide]))
              setHiddenIds(next)
              await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify(next))
            } catch {
              Alert.alert('Error', 'Could not save preference. Try again.')
            }
          },
        },
      ]
    )
  }

  if (loading && !refreshing) {
    return <PlazoreOrbPreloader />
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={22} color={TEXT} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>My Orders</Text>
            <Text style={styles.headerSub}>
              {sorted.length} order{sorted.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setConfigOpen(true)}
          style={styles.configBtn}
          hitSlop={10}
        >
          <Ionicons name="options-outline" size={20} color={TEXT} />
        </TouchableOpacity>
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
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={36} color={MUTED} />
            </View>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySub}>
              When you place an order, it will show up here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const count = item.items?.length || 0
          const color = statusColor[item.orderStatus] || MUTED

          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push(`/orders/${item._id}` as any)}
              style={styles.card}
            >
              <View style={styles.cardTop}>
                <Text style={styles.orderNumber} numberOfLines={1}>
                  {item.orderNumber}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: color + '18' },
                  ]}
                >
                  <View
                    style={[styles.statusDot, { backgroundColor: color }]}
                  />
                  <Text style={[styles.statusText, { color }]}>
                    {item.orderStatus}
                  </Text>
                </View>
              </View>

              <Text style={styles.seller} numberOfLines={1}>
                {item.seller?.storeName || item.seller?.name || 'Seller'}
              </Text>

              <View style={styles.cardBottom}>
                <Text style={styles.meta}>
                  {count} item{count !== 1 ? 's' : ''} ·{' '}
                  {format(Number(item.totalAmount) || 0)}
                </Text>
                <Text style={styles.date}>
                  {item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString()
                    : ''}
                </Text>
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
            onPress: () => setSort('newest'),
          },
          {
            id: 'oldest',
            label: 'Sort by Oldest',
            icon: 'arrow-up-outline',
            selected: sort === 'oldest',
            onPress: () => setSort('oldest'),
          },
          {
            id: 'status',
            label: 'Sort by Status',
            icon: 'layers-outline',
            selected: sort === 'status',
            onPress: () => setSort('status'),
          },
          {
            id: 'clear',
            label: 'Clear Completed Orders',
            icon: 'trash-outline',
            destructive: true,
            onPress: clearCompleted,
          },
        ]}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },

  /* Orb preloader */
  loaderRoot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbWrapper: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2.4,
    borderColor: 'transparent',
    borderTopColor: GREEN,
    borderRightColor: BLUE,
    borderBottomColor: 'transparent',
    borderLeftColor: GREEN,
  },
  orbLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,229,117,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbLogo: {
    width: 32,
    height: 32,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    color: MUTED,
    marginTop: 1,
  },
  configBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },

  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  emptyWrap: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 28,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },

  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },
  orderNumber: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  seller: {
    fontSize: 13,
    color: SECONDARY,
    marginBottom: 10,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
  },
  date: {
    fontSize: 11,
    color: MUTED,
  },
})