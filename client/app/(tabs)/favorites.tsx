/**
 * Wishlist / Saved Products — Plazore dark
 * Stacked cards match Plazore AI ProductImageStack exactly
 * 2 per row · no cart button · currency via formatProduct
 */

import PlazoreFloatingNav from '@/components/PlazoreFloatingNav'
import PlazoreNavigationHub from '@/components/PlazoreNavigationHub'
import { Product } from '@/constants/types'
import { useMarketplace } from '@/context/MarketplaceContext'
import { useWishlist } from '@/context/WishlistContext'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { Link, useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Modal,
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

/* ── Exact Plazore AI ProductImageStack math ── */
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
  const [sortOpen, setSortOpen] = useState(false)

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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved Products</Text>

        <View style={styles.metaRowHeader}>
          <Text style={styles.count}>
            {count === 0
              ? 'Your showroom is waiting'
              : `${count} product${count === 1 ? '' : 's'} saved`}
          </Text>

          {count > 0 && (
            <Pressable
              onPress={() => setSortOpen(true)}
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

      <Modal
        visible={sortOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortOpen(false)}
      >
        <Pressable
          style={styles.sheetScrim}
          onPress={() => setSortOpen(false)}
        />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Sort your picks</Text>
          <Text style={styles.sheetSub}>Organize your saved products</Text>

          {SORT_OPTIONS.map((opt) => {
            const active = opt.key === sortKey
            return (
              <Pressable
                key={opt.key}
                onPress={() => {
                  setSortKey(opt.key)
                  setSortOpen(false)
                }}
                style={[styles.sortRow, active && styles.sortRowActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.sortLabel,
                      active && styles.sortLabelActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text style={styles.sortHint}>{opt.hint}</Text>
                </View>
                {active ? (
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={14} color={BG} />
                  </View>
                ) : (
                  <View style={styles.checkEmpty} />
                )}
              </Pressable>
            )
          })}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  header: {
    paddingHorizontal: PAD,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.6,
    marginBottom: 10,
    textAlign: 'left',
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
    paddingBottom: 140,
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

  /* ── Stack mirrors Plazore AI ProductImageStack ── */
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
    paddingBottom: 80,
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

  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    backgroundColor: SURFACE,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: LINE,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontSize: 13,
    color: MUTED,
    marginTop: 4,
    marginBottom: 18,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    gap: 12,
  },
  sortRowActive: {
    backgroundColor: SURFACE_2,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  sortLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT,
  },
  sortLabelActive: {
    color: ACCENT,
  },
  sortHint: {
    fontSize: 12,
    color: DIM,
    marginTop: 2,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: LINE,
  },
})