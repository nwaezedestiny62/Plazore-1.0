/**
 * Wishlist — Plazore digital mall private collection
 * Left-aligned title (Browse style), sort config, floor-docked nav.
 */

import ProductCard from '@/components/ProductCard'
import PlazoreFloatingNav from '@/components/PlazoreFloatingNav'
import PlazoreNavigationHub from '@/components/PlazoreNavigationHub'
import { Product } from '@/constants/types'
import { useWishlist } from '@/context/WishlistContext'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
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

const BG = '#FFFFFF'
const TEXT = '#0F172A'
const MUTED = '#64748B'
const DIM = '#94A3B8'
const LINE = '#E2E8F0'
const SURFACE = '#F8FAFC'
const ACCENT = '#0F172A'
const PINK = '#F472B6'

const W = Dimensions.get('window').width
const PAD = 20
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
  { key: 'price_low', label: 'Price · Low to high', hint: 'Budget first' },
  { key: 'price_high', label: 'Price · High to low', hint: 'Premium first' },
]

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
        // Assume array order is newest-last from server; reverse for oldest-first
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
      {/* ── Header (Browse-style) ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Wishlist</Text>

        <View style={styles.metaRow}>
          <Text style={styles.count}>
            {count === 0
              ? 'No pieces saved'
              : `${count} piece${count === 1 ? '' : 's'} in your collection`}
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

      {/* ── Body ── */}
      {loading && count === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingHint}>Opening your collection…</Text>
        </View>
      ) : count > 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Editorial kicker */}
          <View style={styles.kickerRow}>
            <View style={styles.kickerLine} />
            <Text style={styles.kicker}>PRIVATE COLLECTION</Text>
            <View style={styles.kickerLine} />
          </View>

          <View style={styles.grid}>
            {sorted.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                cardWidth={CARD_W}
              />
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
            Double-tap a product image or tap the heart while browsing the
            showroom. Your picks live here — private, sorted, ready.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)' as any)}
            style={styles.emptyCta}
          >
            <Text style={styles.emptyCtaText}>Enter the mall</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {/* Floor-docked nav */}
      <PlazoreFloatingNav
        visibleProgress={1}
        onMenuPress={() => setHubOpen(true)}
      />
      <PlazoreNavigationHub
        visible={hubOpen}
        onClose={() => setHubOpen(false)}
      />

      {/* Sort sheet */}
      <Modal
        visible={sortOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSortOpen(false)}
      >
        <Pressable
          style={styles.sheetScrim}
          onPress={() => setSortOpen(false)}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Sort collection</Text>
          <Text style={styles.sheetSub}>
            Arrange pieces the way you shop
          </Text>

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
                    style={[styles.sortLabel, active && styles.sortLabelActive]}
                  >
                    {opt.label}
                  </Text>
                  <Text style={styles.sortHint}>{opt.hint}</Text>
                </View>
                {active ? (
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
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
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.6,
    marginBottom: 10,
    textAlign: 'left',
  },
  metaRow: {
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
    paddingTop: 4,
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
    backgroundColor: 'rgba(244,114,182,0.1)',
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
    backgroundColor: ACCENT,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
  },
  sheet: {
    backgroundColor: BG,
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
    backgroundColor: SURFACE,
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