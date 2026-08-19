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
import { LinearGradient } from 'expo-linear-gradient'
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

type ProductSort = 'newest' | 'oldest' | 'price' | 'stock' | 'edited'

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
            <View style={[styles.overlayIcon, { backgroundColor: `${accent}22` }]}>
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

const SORT_LABEL: Record<ProductSort, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  price: 'Price',
  stock: 'Stock',
  edited: 'Recently edited',
}

export default function SellerProducts() {
  const { getToken } = useAuth()
  const router = useRouter()
  const { formatProduct } = useMarketplace()

  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sort, setSort] = useState<ProductSort>('newest')
  const [configOpen, setConfigOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [overlay, setOverlay] = useState<OverlayState>(null)

  const dismissOverlay = useCallback(() => setOverlay(null), [])

  const fetchProducts = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await api.get('/seller/products', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) setProducts(res.data.data || [])
    } catch {
      // keep list
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [getToken])

  useFocusEffect(
    useCallback(() => {
      fetchProducts()
    }, [fetchProducts])
  )

  const sorted = useMemo(() => {
    const list = [...products]
    switch (sort) {
      case 'oldest':
        list.sort(
          (a, b) =>
            new Date(a.createdAt || 0).getTime() -
            new Date(b.createdAt || 0).getTime()
        )
        break
      case 'price':
        list.sort((a, b) => Number(a.price) - Number(b.price))
        break
      case 'stock':
        list.sort((a, b) => Number(a.stock) - Number(b.stock))
        break
      case 'edited':
        list.sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0).getTime() -
            new Date(a.updatedAt || a.createdAt || 0).getTime()
        )
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
  }, [products, sort])

  const applySort = (key: ProductSort) => {
    setSort(key)
    setOverlay({
      title: `Sorted by ${SORT_LABEL[key]}`,
      tone: 'success',
      durationMs: 2500,
    })
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleHide = async (id: string, isActive: boolean) => {
  const next = !isActive

  setProducts((prev) =>
    prev.map((p) => (p._id === id ? { ...p, isActive: next } : p))
  )

  try {
    const token = await getToken()
    const res = await api.patch(
      `/seller/products/${id}/visibility`,
      { isActive: next },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!res.data?.success) {
      setProducts((prev) =>
        prev.map((p) => (p._id === id ? { ...p, isActive } : p))
      )
      setOverlay({
        title: 'Could not update visibility',
        message: res.data?.message || 'Please try again.',
        tone: 'danger',
        durationMs: 4000,
      })
      return
    }

    // Trust the intended value; only sync if server sent a real boolean
    const serverActive = res.data?.data?.isActive
    if (typeof serverActive === 'boolean') {
      setProducts((prev) =>
        prev.map((p) =>
          p._id === id ? { ...p, isActive: serverActive } : p
        )
      )
    }

    setOverlay({
      title: next ? 'Product is live' : 'Product hidden',
      message: next
        ? 'Buyers can see this item in the mall.'
        : 'Hidden from the mall. Still in your list.',
      tone: 'success',
      durationMs: 2500,
    })
  } catch (err: any) {
    setProducts((prev) =>
      prev.map((p) => (p._id === id ? { ...p, isActive } : p))
    )
    setOverlay({
      title: 'Could not update visibility',
      message: err?.response?.data?.message || 'Please try again.',
      tone: 'danger',
      durationMs: 4000,
    })
  }
}

const bulkHide = async () => {
  if (selected.size === 0) return

  const ids = Array.from(selected)
  const prev = products.map((p) => ({ ...p }))

  // Optimistic UI
  setProducts((list) =>
    list.map((p) =>
      ids.includes(String(p._id)) ? { ...p, isActive: false } : p
    )
  )

  try {
    const token = await getToken()
    if (!token) throw new Error('Not signed in')

    const headers = { Authorization: `Bearer ${token}` }

    for (const id of ids) {
      const res = await api.patch(
        `/seller/products/${id}/visibility`,
        { isActive: false },
        { headers }
      )
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || 'Hide failed')
      }
    }

    setSelected(new Set())
    setSelectMode(false)
    setOverlay({
      title: 'Products hidden',
      message: `${ids.length} item${ids.length === 1 ? '' : 's'} hidden from the mall.`,
      tone: 'success',
      durationMs: 3000,
    })
  } catch (e: any) {
    setProducts(prev)
    setOverlay({
      title: 'Could not hide products',
      message:
        e?.response?.data?.message ||
        e?.message ||
        'Server route missing or failed. Restart API after adding /visibility.',
      tone: 'danger',
      durationMs: 5000,
    })
  }
}

  const runDelete = async (id: string) => {
    try {
      const token = await getToken()
      await api.delete(`/seller/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setProducts((prev) => prev.filter((p) => p._id !== id))
      setOverlay({
        title: 'Product deleted',
        tone: 'success',
        durationMs: 2500,
      })
    } catch {
      setOverlay({
        title: 'Could not delete product',
        tone: 'danger',
        durationMs: 4000,
      })
    }
  }

  const handleDelete = (id: string, name: string) => {
    setOverlay({
      title: 'Delete product?',
      message: `Remove “${name}” from your store? This can’t be undone.`,
      tone: 'danger',
      actions: [
        { label: 'Cancel', onPress: () => {} },
        {
          label: 'Delete',
          destructive: true,
          onPress: () => runDelete(id),
        },
      ],
    })
  }

  const runBulkDelete = async () => {
    try {
      const token = await getToken()
      const ids = [...selected]
      for (const id of ids) {
        await api.delete(`/seller/products/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      }
      setProducts((prev) => prev.filter((p) => !selected.has(p._id)))
      setSelected(new Set())
      setSelectMode(false)
      setOverlay({
        title: 'Products deleted',
        tone: 'success',
        durationMs: 3000,
      })
    } catch {
      setOverlay({
        title: 'Could not delete products',
        tone: 'danger',
        durationMs: 4000,
      })
    }
  }

  const bulkDelete = () => {
    if (selected.size === 0) return
    setOverlay({
      title: 'Delete products?',
      message: `Remove ${selected.size} product${selected.size !== 1 ? 's' : ''} from your store?`,
      tone: 'danger',
      actions: [
        { label: 'Cancel', onPress: () => {} },
        {
          label: 'Delete',
          destructive: true,
          onPress: runBulkDelete,
        },
      ],
    })
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.loaderRoot}>
        <PlazoreOrb size={110} />
        <Text style={styles.loaderHint}>Loading products…</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopOverlay state={overlay} onDismiss={dismissOverlay} />

      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>My Products</Text>
          <Text style={styles.subtitle}>
            {products.length} product{products.length !== 1 ? 's' : ''}
            {' · '}
            {SORT_LABEL[sort]}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {selectMode && selected.size > 0 && (
            <>
              <TouchableOpacity onPress={bulkHide} style={styles.bulkBtn}>
                <Text style={styles.bulkBtnText}>Hide</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={bulkDelete}
                style={[styles.bulkBtn, styles.bulkBtnDanger]}
              >
                <Text style={[styles.bulkBtnText, { color: DANGER }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            onPress={() => setConfigOpen(true)}
            style={styles.iconBtn}
          >
            <Ionicons name="options-outline" size={20} color={TEXT} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/seller/products/add' as any)}
            activeOpacity={0.88}
            style={styles.addWrap}
          >
            <LinearGradient
              colors={[GREEN, BLUE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={18} color="#041412" />
              <Text style={styles.addText}>Add</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
              fetchProducts()
            }}
            tintColor={GREEN}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="cube-outline" size={32} color={MUTED} />
            </View>
            <Text style={styles.emptyTitle}>No products yet</Text>
            <Text style={styles.emptySub}>
              Publish your first item to the mall.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/seller/products/add' as any)}
              style={styles.emptyCtaWrap}
            >
              <LinearGradient
                colors={[GREEN, BLUE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.emptyCta}
              >
                <Text style={styles.emptyCtaText}>Add product</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const isSel = selected.has(item._id)
          return (
            <View style={styles.card}>
              {selectMode && (
                <TouchableOpacity
                  onPress={() => toggleSelect(item._id)}
                  style={styles.checkHit}
                >
                  <View style={[styles.check, isSel && styles.checkOn]}>
                    {isSel && (
                      <Ionicons name="checkmark" size={14} color={BG} />
                    )}
                  </View>
                </TouchableOpacity>
              )}

              {item.images?.[0] ? (
                <Image source={{ uri: item.images[0] }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Ionicons name="image-outline" size={20} color={MUTED} />
                </View>
              )}

              <View style={styles.cardBody}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardPrice}>
                  {formatProduct(Number(item.price) || 0, item.region)}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>Stock {item.stock}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      item.isActive ? styles.statusActive : styles.statusHidden,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: item.isActive ? GREEN : DANGER },
                      ]}
                    >
                      {item.isActive ? 'Active' : 'Hidden'}
                    </Text>
                  </View>
                </View>
              </View>

              {!selectMode && (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() =>
                      router.push(
                        `/seller/products/performance/${item._id}` as any
                      )
                    }
                    hitSlop={8}
                  >
                    <Ionicons
                      name="analytics-outline"
                      size={19}
                      color={SECONDARY}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: '/seller/products/edit/[id]' as any,
                        params: { id: item._id },
                      })
                    }
                    hitSlop={8}
                  >
                    <Ionicons name="create-outline" size={19} color={TEXT} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleHide(item._id, !!item.isActive)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={item.isActive ? 'eye-off-outline' : 'eye-outline'}
                      size={19}
                      color={SECONDARY}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item._id, item.name)}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={19} color={DANGER} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )
        }}
      />

      <ScreenConfigMenu
        visible={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Product options"
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
            id: 'price',
            label: 'Sort by Price',
            icon: 'pricetag-outline',
            selected: sort === 'price',
            onPress: () => applySort('price'),
          },
          {
            id: 'stock',
            label: 'Sort by Stock',
            icon: 'layers-outline',
            selected: sort === 'stock',
            onPress: () => applySort('stock'),
          },
          {
            id: 'edited',
            label: 'Sort by Recently Edited',
            icon: 'time-outline',
            selected: sort === 'edited',
            onPress: () => applySort('edited'),
          },
          {
            id: 'bulk',
            label: selectMode ? 'Done selecting' : 'Select for bulk actions',
            icon: 'checkbox-outline',
            onPress: () => {
              setSelectMode((v) => !v)
              setSelected(new Set())
            },
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
    paddingBottom: 12,
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  bulkBtnDanger: {
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  bulkBtnText: { fontSize: 12, fontWeight: '700', color: TEXT },
  addWrap: { overflow: 'hidden' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addText: { fontSize: 14, fontWeight: '800', color: '#041412' },

  listContent: { padding: 16, paddingBottom: 40 },

  empty: { alignItems: 'center', marginTop: 72, paddingHorizontal: 24 },
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
  emptyCtaWrap: { marginTop: 20, overflow: 'hidden' },
  emptyCta: { paddingHorizontal: 22, paddingVertical: 12 },
  emptyCtaText: { fontWeight: '800', color: '#041412', fontSize: 14 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 12,
    marginBottom: 10,
  },
  checkHit: { marginRight: 10, justifyContent: 'center' },
  check: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: GREEN, borderColor: GREEN },
  thumb: { width: 72, height: 72, backgroundColor: SURFACE_2 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, marginLeft: 12, minWidth: 0 },
  cardName: { fontSize: 14, fontWeight: '700', color: TEXT },
  cardPrice: { marginTop: 4, fontSize: 14, fontWeight: '600', color: GREEN },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  metaText: { fontSize: 11, color: MUTED },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2 },
  statusActive: { backgroundColor: 'rgba(0,229,117,0.12)' },
  statusHidden: { backgroundColor: 'rgba(239,68,68,0.12)' },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardActions: { justifyContent: 'center', gap: 14, paddingLeft: 8 },
})