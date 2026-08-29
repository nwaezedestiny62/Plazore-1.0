import api from '@/constants/api'
import { PerformanceChart } from '@/components/PerformanceChart'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const BG = '#090B0F'
const SURFACE = '#0C1520'
const LINE = '#1A2A3A'
const TEXT = '#F5F7FA'
const MUTED = '#6B8299'
const DIM = '#4A6078'
const GREEN = '#00E575'
const TEAL = '#14B8A6'
const BLUE = '#3B82F6'

export default function ProductPerformanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { getToken } = useAuth()
  const router = useRouter()

  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!id) {
      if (mountedRef.current) {
        setError('Missing product')
        setLoading(false)
      }
      return
    }

    try {
      if (mountedRef.current) {
        setLoading(true)
        setError(null)
      }

      const token = await getTokenRef.current()
      const res = await api.get(`/analytics/seller/product/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!mountedRef.current) return

      if (res.data?.success) {
        setData(res.data.data)
        setError(null)
      } else {
        setData(null)
        setError(res.data?.message || 'Could not load analytics')
      }
    } catch {
      if (mountedRef.current) {
        setData(null)
        setError('Could not load analytics')
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [id]) // ✅ only id — never getToken

  useEffect(() => {
    load()
  }, [load])

  const views = Number(data?.views) || 0
  const cartAdds = Number(data?.cartAdds) || 0
  const purchases = Number(data?.purchases) || 0
  const score = Number(data?.score) || 0

  const rates = useMemo(() => {
    const viewToCart = views > 0 ? ((cartAdds / views) * 100).toFixed(1) : '—'
    const cartToBuy = cartAdds > 0 ? ((purchases / cartAdds) * 100).toFixed(1) : '—'
    const viewToBuy = views > 0 ? ((purchases / views) * 100).toFixed(1) : '—'
    return { viewToCart, cartToBuy, viewToBuy }
  }, [views, cartAdds, purchases])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    )
  }

  if (error || !data) {
    return (
      <View style={[styles.center, { paddingHorizontal: 24 }]}>
        <Text style={styles.errorText}>{error || 'Could not load analytics'}</Text>
        <TouchableOpacity onPress={load} style={{ marginTop: 12 }}>
          <Text style={styles.link}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Analytics</Text>
          <Text style={styles.headerTitle}>Performance</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.productRow}>
          {data.product?.image ? (
            <Image source={{ uri: data.product.image }} style={styles.productImg} />
          ) : (
            <View style={[styles.productImg, styles.productImgEmpty]}>
              <Ionicons name="cube-outline" size={22} color={DIM} />
            </View>
          )}
          <Text style={styles.productName} numberOfLines={2}>
            {data.product?.name || 'Product'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Performance score</Text>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.scoreHint}>Views ×1 · Cart ×5 · Purchases ×15</Text>
          {data.milestones?.p200 ? (
            <View style={styles.milestone}>
              <Text style={styles.milestoneText}>Milestone · 200 pts</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.kpiRow}>
          {[
            { label: 'Views', value: views, pts: '×1', color: BLUE },
            { label: 'Cart adds', value: cartAdds, pts: '×5', color: TEAL },
            { label: 'Purchases', value: purchases, pts: '×15', color: GREEN },
          ].map((s) => (
            <View key={s.label} style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>{s.label}</Text>
              <Text style={[styles.kpiValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.kpiPts}>{s.pts} pts</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Conversion</Text>
          <View style={styles.convRow}>
            <View style={styles.convCell}>
              <Text style={styles.convValue}>{rates.viewToCart}%</Text>
              <Text style={styles.convHint}>View → Cart</Text>
            </View>
            <View style={styles.convCell}>
              <Text style={styles.convValue}>{rates.cartToBuy}%</Text>
              <Text style={styles.convHint}>Cart → Buy</Text>
            </View>
            <View style={styles.convCell}>
              <Text style={[styles.convValue, { color: GREEN }]}>{rates.viewToBuy}%</Text>
              <Text style={styles.convHint}>View → Buy</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.chartHead}>
            <Text style={styles.chartTitle}>Last 30 days</Text>
            <Text style={styles.chartSub}>Daily funnel</Text>
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: BLUE }]} />
              <Text style={styles.legendText}>Views</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: TEAL }]} />
              <Text style={styles.legendText}>Cart</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: GREEN }]} />
              <Text style={styles.legendText}>Purchases</Text>
            </View>
          </View>

          <PerformanceChart data={data.series || []} />

          <Text style={styles.chartFoot}>
            How many people saw this product, added it to cart, and completed a
            purchase.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  center: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: MUTED, textAlign: 'center', fontSize: 14 },
  link: { color: BLUE, fontWeight: '600', fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.2,
  },

  scroll: { padding: 16, paddingBottom: 48 },

  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  productImg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#13263B',
  },
  productImgEmpty: { alignItems: 'center', justifyContent: 'center' },
  productName: {
    flex: 1,
    color: TEXT,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 22,
  },

  card: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 24,
    padding: 18,
    marginBottom: 12,
  },
  label: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  score: {
    color: TEXT,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  scoreHint: {
    marginTop: 4,
    color: DIM,
    fontSize: 12,
  },
  milestone: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#1A2F28',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  milestoneText: {
    color: '#8FE3B0',
    fontSize: 11,
    fontWeight: '700',
  },

  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 20,
    padding: 12,
  },
  kpiLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  kpiValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '800',
  },
  kpiPts: {
    marginTop: 2,
    color: DIM,
    fontSize: 10,
  },

  convRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  convCell: {
    flex: 1,
    alignItems: 'center',
  },
  convValue: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '800',
  },
  convHint: {
    marginTop: 4,
    color: DIM,
    fontSize: 10,
  },

  chartHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  chartTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '700',
  },
  chartSub: {
    color: DIM,
    fontSize: 11,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '600',
  },
  chartFoot: {
    marginTop: 12,
    color: DIM,
    fontSize: 11,
    lineHeight: 16,
  },
})