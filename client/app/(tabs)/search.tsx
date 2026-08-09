// client/app/(tabs)/browse.tsx  (or wherever your Browse screen lives)
import ProductCard from '@/components/ProductCard'
import PlazoreFloatingNav from '@/components/PlazoreFloatingNav'
import PlazoreNavigationHub from '@/components/PlazoreNavigationHub'
import api from '@/constants/api'
import { CATEGORY_LIST } from '@/constants/productCatalog'
import { Product } from '@/constants/types'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Dimensions,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  Layout,
  ZoomIn,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/* ── Palette ── */
const BG = '#FFFFFF'
const SURFACE = '#F8FAFC'
const TEXT = '#0F172A'
const MUTED = '#64748B'
const DIM = '#94A3B8'
const LINE = '#E2E8F0'
const ACCENT = '#0F172A'

const RECENT_KEY = 'plazore_recent_searches'
const MAX_RECENT = 8
const DEBOUNCE = 240

const W = Dimensions.get('window').width
const PAD = 20
const GAP = 14
const CARD_W = (W - PAD * 2 - GAP) / 2

/* ── Category floors with 2 backups each ── */
const FLOORS: { id: string; short: string; images: [string, string, string] }[] = [
  {
    id: 'Fashion',
    short: 'Fashion',
    images: [
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&q=80',
      'https://images.unsplash.com/photo-1445205170230-053b83016050?w=500&q=80',
      'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=500&q=80',
    ],
  },
  {
    id: 'Electronics',
    short: 'Tech',
    images: [
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=500&q=80',
      'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500&q=80',
      'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=500&q=80',
    ],
  },
  {
    id: 'Beauty & Personal Care',
    short: 'Beauty',
    images: [
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&q=80',
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&q=80',
      'https://images.unsplash.com/photo-1571781926291-c77df8097c1f?w=500&q=80',
    ],
  },
  {
    id: 'Home & Living',
    short: 'Home',
    images: [
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=500&q=80',
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&q=80',
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=500&q=80',
    ],
  },
  {
    id: 'Sports & Outdoors',
    short: 'Sport',
    images: [
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500&q=80',
      'https://images.unsplash.com/photo-1461896836934-ffe607ba6851?w=500&q=80',
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500&q=80',
    ],
  },
  {
    id: 'Jewelry & Watches',
    short: 'Jewelry',
    images: [
      'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&q=80',
      'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=500&q=80',
      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500&q=80',
    ],
  },
]

type SellerInfo = {
  _id: string
  name?: string
  storeName?: string
  storeLogo?: string
}

/** Floor image with automatic backup */
function FloorImage({ images }: { images: [string, string, string] }) {
  const [idx, setIdx] = useState(0)
  return (
    <Image
      source={{ uri: images[idx] }}
      style={StyleSheet.absoluteFillObject}
      contentFit="cover"
      transition={200}
      onError={() => {
        if (idx < 2) setIdx((i) => i + 1)
      }}
    />
  )
}

export default function BrowseScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const inputRef = useRef<TextInput>(null)

  const [hubOpen, setHubOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [trending, setTrending] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [recent, setRecent] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [serverProducts, setServerProducts] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Filter state (only used when searching)
  const [filterOpen, setFilterOpen] = useState(false)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [inStockOnly, setInStockOnly] = useState(false)

  // Boot
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [res, stored] = await Promise.all([
          api.get('/products?limit=80'),
          AsyncStorage.getItem(RECENT_KEY),
        ])
        if (!alive) return
        if (res.data?.success) {
          const list: Product[] = res.data.data || []
          setAllProducts(list)
          setTrending(list.slice(0, 8))
        }
        if (stored) {
          try {
            const p = JSON.parse(stored)
            if (Array.isArray(p)) setRecent(p.slice(0, MAX_RECENT))
          } catch {}
        }
      } catch (e) {
        console.log('Browse boot:', e)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE)
    return () => clearTimeout(t)
  }, [query])

  // Server search suggest
  useEffect(() => {
    if (debounced.length < 1 || activeCategory) {
      setServerProducts([])
      setSearchLoading(false)
      return
    }

    let cancelled = false
    setSearchLoading(true)

    ;(async () => {
      try {
        const res = await api.get(`/ai/search-suggest?q=${encodeURIComponent(debounced)}`)
        if (cancelled || !res.data?.success) return
        setServerProducts(Array.isArray(res.data.data?.products) ? res.data.data.products : [])
      } catch {
        if (!cancelled) setServerProducts([])
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [debounced, activeCategory])

  const getSeller = (p: any): SellerInfo | null => {
    const s = p.seller
    if (!s) return null
    if (typeof s === 'string') return { _id: s }
    if (!s._id) return null
    return {
      _id: String(s._id),
      name: s.name,
      storeName: s.storeName,
      storeLogo: s.storeLogo,
    }
  }

  const live = useMemo(() => {
    const q = debounced.toLowerCase()
    if (!q && !activeCategory) {
      return {
        products: [] as any[],
        stores: [] as any[],
        brands: [] as string[],
        categories: [] as string[],
      }
    }

    let products = serverProducts.length > 0 ? serverProducts : allProducts

    if (activeCategory) {
      products = products.filter((p: any) => {
        const cat = typeof p.category === 'string' ? p.category : p.category?.name
        return String(cat || '').toLowerCase() === activeCategory.toLowerCase()
      })
    } else if (q) {
      products = products.filter((p: any) => {
        const name = (p.name || '').toLowerCase()
        const brand = (p.brand || '').toLowerCase()
        const cat =
          typeof p.category === 'string'
            ? p.category.toLowerCase()
            : String(p.category?.name || '').toLowerCase()
        return name.includes(q) || brand.includes(q) || cat.includes(q)
      })
    }

    // Apply filters
    const min = Number(minPrice)
    const max = Number(maxPrice)
    if (Number.isFinite(min) && min > 0) {
      products = products.filter((p: any) => Number(p.price) >= min)
    }
    if (Number.isFinite(max) && max > 0) {
      products = products.filter((p: any) => Number(p.price) <= max)
    }
    if (inStockOnly) {
      products = products.filter((p: any) => Number(p.stock ?? 0) > 0)
    }

    const storesMap = new Map<string, SellerInfo>()
    allProducts.forEach((p) => {
      const s = getSeller(p)
      if (!s) return
      const name = (s.storeName || s.name || '').toLowerCase()
      if (name && name.includes(q)) storesMap.set(s._id, s)
    })
    const stores = Array.from(storesMap.values()).slice(0, 8)

    const brandSet = new Set<string>()
    allProducts.forEach((p) => {
      if (p.brand && p.brand.toLowerCase().includes(q)) brandSet.add(p.brand)
    })
    const brands = Array.from(brandSet).slice(0, 10)

    const categories = CATEGORY_LIST.filter((c) => {
      const lower = c.toLowerCase()
      return (
        lower.includes(q) ||
        q.split(' ').some((word) => word.length > 2 && lower.includes(word))
      )
    }).slice(0, 8)

    return {
      products: products.slice(0, 14),
      stores,
      brands,
      categories,
    }
  }, [debounced, activeCategory, serverProducts, allProducts, minPrice, maxPrice, inStockOnly])

  const isSearching = debounced.length > 0 || !!activeCategory
  const hasResults =
    live.products.length > 0 ||
    live.stores.length > 0 ||
    live.brands.length > 0 ||
    live.categories.length > 0

  const pushRecent = useCallback(async (term: string) => {
    const clean = term.trim()
    if (!clean || clean.length < 2) return
    setRecent((prev) => {
      const next = [clean, ...prev.filter((r) => r.toLowerCase() !== clean.toLowerCase())].slice(
        0,
        MAX_RECENT
      )
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [])

  const clearAll = () => {
    setQuery('')
    setDebounced('')
    setActiveCategory(null)
    setServerProducts([])
    setMinPrice('')
    setMaxPrice('')
    setInStockOnly(false)
    inputRef.current?.focus()
  }

  const selectFloor = (cat: string) => {
    setQuery('')
    setDebounced('')
    setActiveCategory(cat)
    Keyboard.dismiss()
  }

  // ── IDLE (Digital Mall home) ───────────────────────────
  const renderIdle = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 150 }}
      onScrollBeginDrag={Keyboard.dismiss}
    >
      {/* Floors / Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>FLOORS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: PAD, gap: 12 }}
        >
          {FLOORS.map((f, i) => (
            <Animated.View key={f.id} entering={FadeInDown.delay(i * 40).springify()}>
              <Pressable onPress={() => selectFloor(f.id)} style={styles.floorCard}>
                <FloorImage images={f.images} />
                <LinearGradient
                  colors={['transparent', 'rgba(15,23,42,0.72)']}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.floorLabel}>{f.short}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      </View>

      {/* Recent */}
      {recent.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>RECENT</Text>
            <Pressable
              onPress={() => {
                setRecent([])
                AsyncStorage.removeItem(RECENT_KEY)
              }}
            >
              <Text style={styles.clearTxt}>Clear</Text>
            </Pressable>
          </View>
          <View style={styles.chipWrap}>
            {recent.map((r) => (
              <Pressable
                key={r}
                onPress={() => {
                  setQuery(r)
                  setDebounced(r)
                  pushRecent(r)
                }}
                style={styles.chip}
              >
                <Text style={styles.chipText}>{r}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Moving now */}
      <View style={[styles.section, { marginTop: 28 }]}>
        <Text style={styles.sectionLabel}>MOVING NOW</Text>
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <Text style={{ color: DIM, fontSize: 13 }}>Loading…</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {trending.map((p, i) => (
              <Animated.View key={p._id} entering={FadeInDown.delay(i * 40).springify()}>
                <ProductCard product={p} cardWidth={CARD_W} />
              </Animated.View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )

  // ── LIVE (search results) ──────────────────────────────
  const renderLive = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 150, paddingTop: 4 }}
      onScrollBeginDrag={Keyboard.dismiss}
    >
      <View style={styles.meta}>
        <View style={{ flex: 1 }}>
          <Text style={styles.metaText} numberOfLines={1}>
            {activeCategory || debounced}
          </Text>
          <Text style={styles.metaCount}>
            {live.products.length + live.stores.length} results
          </Text>
        </View>
        <Pressable onPress={clearAll} hitSlop={10}>
          <Text style={styles.clearTxt}>Clear</Text>
        </Pressable>
      </View>

      {/* Products */}
      {live.products.length > 0 && (
        <Animated.View entering={FadeInDown.duration(320)} layout={Layout.springify()}>
          <Text style={styles.groupTitle}>PRODUCTS</Text>
          <View style={styles.grid}>
            {live.products.map((p: any, i: number) => (
              <Animated.View
                key={p._id}
                entering={FadeInDown.delay(i * 35).springify()}
                layout={Layout.springify()}
              >
                <ProductCard product={p} cardWidth={CARD_W} />
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Storefronts */}
      {live.stores.length > 0 && (
        <Animated.View entering={FadeInDown.delay(60)} style={{ marginTop: 28 }}>
          <Text style={styles.groupTitle}>STOREFRONTS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: PAD, gap: 12 }}
          >
            {live.stores.map((s, i) => (
              <Animated.View key={s._id} entering={FadeInRight.delay(i * 35)}>
                <Pressable
                  onPress={() => router.push(`/store/${s._id}` as any)}
                  style={styles.storeCard}
                >
                  <View style={styles.storeLogo}>
                    {s.storeLogo ? (
                      <Image
                        source={{ uri: s.storeLogo }}
                        style={{ width: 56, height: 56 }}
                        contentFit="cover"
                      />
                    ) : (
                      <Ionicons name="storefront-outline" size={22} color={MUTED} />
                    )}
                  </View>
                  <Text style={styles.storeName} numberOfLines={1}>
                    {s.storeName || s.name || 'Store'}
                  </Text>
                </Pressable>
              </Animated.View>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Brands */}
      {live.brands.length > 0 && (
        <Animated.View entering={FadeInDown.delay(90)} style={{ marginTop: 28 }}>
          <Text style={styles.groupTitle}>BRANDS</Text>
          <View style={styles.chipWrap}>
            {live.brands.map((b, i) => (
              <Animated.View key={b} entering={ZoomIn.delay(i * 25)}>
                <Pressable
                  onPress={() => {
                    setQuery(b)
                    setDebounced(b)
                    pushRecent(b)
                  }}
                  style={styles.brandChip}
                >
                  <Text style={styles.brandText}>{b}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Categories */}
      {live.categories.length > 0 && (
        <Animated.View entering={FadeInDown.delay(110)} style={{ marginTop: 28, marginBottom: 8 }}>
          <Text style={styles.groupTitle}>CATEGORIES</Text>
          <View style={styles.chipWrap}>
            {live.categories.map((c, i) => (
              <Animated.View key={c} entering={ZoomIn.delay(i * 25)}>
                <Pressable onPress={() => selectFloor(c)} style={styles.catChip}>
                  <Text style={styles.catText}>{c}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      )}

      {!hasResults && !searchLoading && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing found</Text>
          <Text style={styles.emptyBody}>Try another term or explore the floors</Text>
        </View>
      )}
    </ScrollView>
  )

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Browse</Text>

        <View style={styles.searchRow}>
          <View style={styles.searchShell}>
            <Ionicons name="search" size={18} color={DIM} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={(t) => {
                setQuery(t)
                if (activeCategory) setActiveCategory(null)
              }}
              onSubmitEditing={() => {
                if (query.trim()) pushRecent(query)
                Keyboard.dismiss()
              }}
              placeholder="Products, stores, brands…"
              placeholderTextColor={DIM}
              style={styles.input}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {(query.length > 0 || !!activeCategory) && (
              <Pressable onPress={clearAll} hitSlop={12}>
                <Ionicons name="close-circle" size={18} color={DIM} />
              </Pressable>
            )}
          </View>

          {/* Filter only appears when searching */}
          {isSearching && (
            <Pressable onPress={() => setFilterOpen(true)} style={styles.filterBtn}>
              <Ionicons name="options-outline" size={20} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.body}>{isSearching ? renderLive() : renderIdle()}</View>

      <PlazoreFloatingNav visibleProgress={1} onMenuPress={() => setHubOpen(true)} />
      <PlazoreNavigationHub visible={hubOpen} onClose={() => setHubOpen(false)} />

      {/* Filter Modal – only relevant when searching */}
      <Modal visible={filterOpen} transparent animationType="slide">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onPress={() => setFilterOpen(false)}
        />
        <View style={styles.filterSheet}>
          <Text style={styles.filterTitle}>Filters</Text>

          <Text style={styles.filterLabel}>Price</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            <TextInput
              style={styles.filterInput}
              placeholder="Min"
              keyboardType="numeric"
              value={minPrice}
              onChangeText={setMinPrice}
              placeholderTextColor={DIM}
            />
            <TextInput
              style={styles.filterInput}
              placeholder="Max"
              keyboardType="numeric"
              value={maxPrice}
              onChangeText={setMaxPrice}
              placeholderTextColor={DIM}
            />
          </View>

          <Pressable
            onPress={() => setInStockOnly((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 }}
          >
            <View
              style={[
                styles.checkBox,
                inStockOnly && { backgroundColor: ACCENT, borderColor: ACCENT },
              ]}
            >
              {inStockOnly && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
            <Text style={{ fontSize: 14, color: TEXT }}>In stock only</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={() => {
                setMinPrice('')
                setMaxPrice('')
                setInStockOnly(false)
                setFilterOpen(false)
              }}
              style={styles.filterReset}
            >
              <Text style={{ fontWeight: '600', color: MUTED }}>Reset</Text>
            </Pressable>
            <Pressable onPress={() => setFilterOpen(false)} style={styles.filterApply}>
              <Text style={{ fontWeight: '600', color: '#FFFFFF' }}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    paddingHorizontal: PAD,
    paddingTop: 6,
    paddingBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.6,
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchShell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: TEXT,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 48,
    height: 48,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { flex: 1 },

  section: { marginTop: 24 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAD,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: DIM,
    paddingHorizontal: PAD,
    marginBottom: 12,
  },
  clearTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },

  floorCard: {
    width: 108,
    height: 136,
    overflow: 'hidden',
    backgroundColor: SURFACE,
  },
  floorLabel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: PAD,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: PAD,
  },

  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: PAD,
    marginBottom: 16,
  },
  metaText: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
  },
  metaCount: {
    fontSize: 12,
    color: DIM,
    marginTop: 2,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: DIM,
    paddingHorizontal: PAD,
    marginBottom: 12,
  },

  storeCard: {
    width: 112,
    backgroundColor: SURFACE,
    padding: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  storeLogo: {
    width: 56,
    height: 56,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  storeName: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT,
    textAlign: 'center',
  },

  brandChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  brandText: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  catText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
  },

  empty: {
    paddingTop: 72,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
  },

  // Filter sheet
  filterSheet: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  filterTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
    marginBottom: 8,
  },
  filterInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 12,
    fontSize: 14,
    color: TEXT,
    backgroundColor: SURFACE,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterReset: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterApply: {
    flex: 1,
    height: 48,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
})