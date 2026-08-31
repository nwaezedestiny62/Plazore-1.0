/**
 * Wishlist / Saved Products — Plazore dark
 * Stacked cards · 2 per row · no cart · top overlay sort
 * Custom bar left of title → opens Navigation Hub
 */

import PlazoreNavigationHub from '@/components/PlazoreNavigationHub'
import { Product } from '@/constants/types'
import { useMarketplace } from '@/context/MarketplaceContext'
import { useWishlist } from '@/context/WishlistContext'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { Link, useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const TEXT = '#F5F7FA'
const MUTED = '#A7ADB8'
const DIM = '#737A86'
const LINE = '#252A33'
const ACCENT = '#10B981'
const PINK = '#F472B6'
const GREEN = '#00E575'
const BLUE = '#3B82F6'

const W = Dimensions.get('window').width
const PAD = 16
const GAP = 14
const CARD_W = (W - PAD * 2 - GAP) / 2

type SortKey =
  | 'newest'
  | 'oldest'
  | 'name_az'
  | 'name_za'
  | 'price_low'
  | 'price_high'

const SORT_OPTIONS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'newest', label: 'Latest first', hint: 'Most recently saved' },
  { key: 'oldest', label: 'Oldest first', hint: 'First saved' },
  { key: 'name_az', label: 'Name A → Z', hint: 'Alphabetical' },
  { key: 'name_za', label: 'Name Z → A', hint: 'Reverse alpha' },
  { key: 'price_low', label: 'Price · Low to high', hint: 'Lowest price first' },
  { key: 'price_high', label: 'Price · High to low', hint: 'Highest price first' },
]

type OverlayAction = {
  label: string
  onPress: () => void
  destructive?: boolean
  primary?: boolean
  selected?: boolean
}

type OverlayState = {
  title: string
  message?: string
  tone?: 'info' | 'success' | 'danger'
  actions?: OverlayAction[]
  durationMs?: number
} | null

/** Same 3-line custom bar as PlazoreTitleBar (22 / 15 / 22) */
function CustomBarIcon() {
  return (
    <View style={styles.menuLines}>
      <View style={[styles.line, { width: 22 }]} />
      <View style={[styles.line, { width: 15 }]} />
      <View style={[styles.line, { width: 22 }]} />
    </View>
  )
}

function TopOverlay({
  state,
  onDismiss,
}: {
  state: OverlayState
  onDismiss: () => void
}) {
  const insets = useSafeAreaInsets()
  const translateY = useRef(new Animated.Value(-140)).current
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!state) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -140,
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
      timer.current = setTimeout(() => onDismiss(), state.durationMs ?? 3800)
    }

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state])

  if (!state) return null

  const accent =
    state.tone === 'danger'
      ? '#EF4444'
      : state.tone === 'success'
        ? GREEN
        : BLUE

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.overlayWrap,
        {
          paddingTop: Math.max(insets.top, 10) + 6,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.overlayCard}>
        <View style={[styles.overlayAccent, { backgroundColor: accent }]} />
        <View style={styles.overlayBody}>
          <View style={styles.overlayTop}>
            <View style={[styles.overlayIcon, { backgroundColor: `${accent}22` }]}>
              <Ionicons
                name={
                  state.tone === 'danger'
                    ? 'warning-outline'
                    : state.tone === 'success'
                      ? 'checkmark-circle-outline'
                      : 'swap-vertical-outline'
                }
                size={18}
                color={accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.overlayTitle}>{state.title}</Text>
              {!!state.message && (
                <Text style={styles.overlayMsg}>{state.message}</Text>
              )}
            </View>
            <Pressable onPress={onDismiss} hitSlop={12}>
              <Ionicons name="close" size={18} color={DIM} />
            </Pressable>
          </View>

          {!!state.actions?.length && (
            <View style={styles.overlayActions}>
              {state.actions.map((a, i) => (
                <Pressable
                  key={`${a.label}-${i}`}
                  onPress={() => {
                    a.onPress()
                    onDismiss()
                  }}
                  style={[
                    styles.overlayActionRow,
                    a.selected && styles.overlayActionSelected,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.overlayActionLabel,
                        a.destructive && { color: '#EF4444' },
                        a.selected && { color: ACCENT },
                      ]}
                    >
                      {a.label}
                    </Text>
                  </View>
                  {a.selected ? (
                    <View style={styles.check}>
                      <Ionicons name="checkmark" size={13} color={BG} />
                    </View>
                  ) : a.primary ? (
                    <Ionicons name="chevron-forward" size={16} color={MUTED} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  )
}

function SavedStackCard({ product }: { product: Product }) {
  const { formatProduct } = useMarketplace()

  const images = useMemo(() => {
    const list = product.images?.filter(Boolean) ?? []
    return list.slice(0, 3)
  }, [product.images])

  const brand = useMemo(() => {
    if (product.brand) return product.brand
    if (typeof product.seller === 'object' && product.seller?.storeName) {
      return product.seller.storeName
    }
    return 'plazore'
  }, [product])

  const price = useMemo(
    () => formatProduct(product.price, product.region),
    [product.price, product.region, formatProduct]
  )

  const location = useMemo(() => {
    const fl = product.fulfillmentLocation
    if (fl?.displayLabel) return fl.displayLabel
    if (fl) {
      const parts = [fl.city, fl.state, fl.country].filter(Boolean)
      if (parts.length) return parts.join(', ')
    }
    return ''
  }, [product])

  const hasImages = images.length > 0

  return (
    <Link href={`/product/${product._id}` as any} asChild>
      <Pressable style={styles.card} accessibilityRole="button">
        <View style={styles.stackStage}>
          {hasImages ? (
            images.map((uri, i) => {
              const depth = images.length - 1 - i
              const rotate = depth === 2 ? -8 : depth === 1 ? 7 : 0
              const offsetX = depth === 2 ? -14 : depth === 1 ? 14 : 0
              const offsetY = depth > 0 ? 6 : 0
              const scale = depth === 0 ? 1 : 0.92
              const zIndex = 10 - depth

              return (
                <View
                  key={`${product._id}-stack-${i}`}
                  style={[
                    styles.stackCard,
                    {
                      zIndex,
                      transform: [
                        { translateX: offsetX },
                        { translateY: offsetY },
                        { rotate: `${rotate}deg` },
                        { scale },
                      ],
                    },
                  ]}
                >
                  <Image
                    source={{ uri }}
                    style={styles.stackImg}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                  />
                </View>
              )
            })
          ) : (
            <View style={[styles.stackCard, styles.stackPlaceholder]}>
              <Ionicons name="image-outline" size={28} color={DIM} />
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.brand} numberOfLines={1}>
              {brand.toLowerCase()}
            </Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.price} numberOfLines={1}>
              {price}
            </Text>
          </View>

          {!!location && (
            <Text style={styles.location} numberOfLines={1}>
              {location}
            </Text>
          )}
        </View>
      </Pressable>
    </Link>
  )
}

export default function Favorites() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { wishlist, loading, fetchWishlist } = useWishlist() as {
    wishlist: Product[]
    loading: boolean
    fetchWishlist?: () => void
  }

  const [hubOpen, setHubOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [overlay, setOverlay] = useState<OverlayState>(null)

  useFocusEffect(
    useCallback(() => {
      if (typeof fetchWishlist === 'function') fetchWishlist()
    }, [fetchWishlist])
  )

  const sorted = useMemo(() => {
    const list = [...(wishlist || [])]

    switch (sortKey) {
      case 'oldest':
        return list.slice().reverse()
      case 'name_az':
        return list.sort((a, b) =>
          String(a.name || '').localeCompare(String(b.name || ''), undefined, {
            sensitivity: 'base',
          })
        )
      case 'name_za':
        return list.sort((a, b) =>
          String(b.name || '').localeCompare(String(a.name || ''), undefined, {
            sensitivity: 'base',
          })
        )
      case 'price_low':
        return list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
      case 'price_high':
        return list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0))
      case 'newest':
      default:
        return list
    }
  }, [wishlist, sortKey])

  const activeSortLabel =
    SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? 'Latest first'

  const count = wishlist?.length ?? 0

  const openSortOverlay = () => {
    setOverlay({
      title: 'Sort your picks',
      message: 'Organize your saved products',
      tone: 'info',
      actions: SORT_OPTIONS.map((opt) => ({
        label: opt.label,
        selected: opt.key === sortKey,
        onPress: () => {
          setSortKey(opt.key)
          setTimeout(() => {
            setOverlay({
              title: opt.label,
              message: opt.hint,
              tone: 'success',
              durationMs: 2200,
            })
          }, 80)
        },
      })),
    })
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <TopOverlay state={overlay} onDismiss={() => setOverlay(null)} />

      {/* Title bar: custom bar (left) + Saved Products */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Pressable
            onPress={() => setHubOpen(true)}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel="Open navigation"
            style={styles.barHit}
          >
            <CustomBarIcon />
          </Pressable>

          <Text style={styles.title} numberOfLines={1}>
            Saved Products
          </Text>
        </View>

        <View style={styles.metaRowHeader}>
          <Text style={styles.count}>
            {count === 0
              ? 'Your showroom is waiting'
              : `${count} product${count === 1 ? '' : 's'} saved`}
          </Text>

          {count > 0 && (
            <Pressable
              onPress={openSortOverlay}
              style={styles.sortChip}
              hitSlop={8}
            >
              <Ionicons name="swap-vertical" size={14} color={TEXT} />
              <Text style={styles.sortChipText} numberOfLines={1}>
                {activeSortLabel}
              </Text>
              <Ionicons name="chevron-down" size={12} color={DIM} />
            </Pressable>
          )}
        </View>
      </View>

      {loading && count === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingHint}>Opening your saved picks…</Text>
        </View>
      ) : count > 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.kickerRow}>
            <View style={styles.kickerLine} />
            <Text style={styles.kicker}>YOUR SAVED PICKS</Text>
            <View style={styles.kickerLine} />
          </View>

          <View style={styles.grid}>
            {sorted.map((product) => (
              <SavedStackCard key={product._id} product={product} />
            ))}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="heart-outline" size={28} color={PINK} />
          </View>
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptyBody}>
            Save products while exploring the showroom. Your picks will be
            waiting here.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)' as any)}
            style={styles.emptyCta}
          >
            <Text style={styles.emptyCtaText}>Explore the showroom</Text>
            <Ionicons name="arrow-forward" size={16} color={BG} />
          </Pressable>
        </View>
      )}

      <PlazoreNavigationHub
        visible={hubOpen}
        onClose={() => setHubOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  menuLines: {
    width: 22,
    gap: 5.5,
    alignItems: 'flex-start',
  },
  line: {
    height: 2.6,
    backgroundColor: TEXT,
  },
  barHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },

  overlayWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    elevation: 200,
    paddingHorizontal: 14,
  },
  overlayCard: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  overlayAccent: {
    width: 3,
  },
  overlayBody: {
    flex: 1,
    padding: 12,
  },
  overlayTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  overlayIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  overlayMsg: {
    color: MUTED,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
  },
  overlayActions: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    paddingTop: 4,
  },
  overlayActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 4,
    gap: 10,
  },
  overlayActionSelected: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    marginHorizontal: -4,
    paddingHorizontal: 8,
  },
  overlayActionLabel: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '600',
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    paddingHorizontal: PAD,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.6,
  },
  metaRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  count: {
    flex: 1,
    fontSize: 13,
    color: MUTED,
    fontWeight: '500',
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    maxWidth: '52%',
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT,
    flexShrink: 1,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingHint: {
    fontSize: 13,
    color: DIM,
  },

  scrollContent: {
    paddingHorizontal: PAD,
    paddingBottom: 48,
    paddingTop: 12,
  },

  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },
  kickerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: DIM,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 28,
  },

  card: {
    width: CARD_W,
    alignItems: 'center',
  },
  stackStage: {
    width: CARD_W,
    height: CARD_W * 1.22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  stackCard: {
    position: 'absolute',
    width: CARD_W * 0.78,
    height: CARD_W * 0.95,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  stackImg: {
    width: '100%',
    height: '100%',
  },
  stackPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: LINE,
  },

  info: {
    width: '100%',
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  name: {
    fontSize: 13.5,
    fontWeight: '600',
    color: TEXT,
    letterSpacing: -0.2,
    lineHeight: 18,
    marginBottom: 4,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  brand: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '500',
    flexShrink: 1,
  },
  dot: {
    fontSize: 12,
    color: DIM,
  },
  price: {
    fontSize: 12.5,
    fontWeight: '600',
    color: ACCENT,
  },
  location: {
    fontSize: 11,
    color: DIM,
    marginTop: 3,
    textAlign: 'center',
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 40,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,114,182,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244,114,182,0.25)',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 28,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TEXT,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  emptyCtaText: {
    color: BG,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
})