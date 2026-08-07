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
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const BG = '#FFFFFF'
const SURFACE = '#F8FAFC'
const TEXT = '#0F172A'
const MUTED = '#64748B'
const DIM = '#94A3B8'
const LINE = '#E2E8F0'
const GREEN = '#00B86B'
const BLUE = '#2B5BFF'

const RECENT_KEY = 'plazore_recent_searches'
const MAX_RECENT = 8
const DEBOUNCE = 240

const W = Dimensions.get('window').width
const PAD = 20
const GAP = 14
const CARD_W = (W - PAD * 2 - GAP) / 2

const FLOORS = [
  { id: 'Fashion', short: 'Fashion', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=500&q=80' },
  { id: 'Electronics', short: 'Tech', image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=500&q=80' },
  { id: 'Beauty & Personal Care', short: 'Beauty', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=500&q=80' },
  { id: 'Home & Living', short: 'Home', image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=500&q=80' },
  { id: 'Sports & Outdoors', short: 'Sport', image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=500&q=80' },
  { id: 'Jewelry & Watches', short: 'Jewelry', image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=500&q=80' },
]

type SellerInfo = {
  _id: string
  name?: string
  storeName?: string
  storeLogo?: string
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
  const [focused, setFocused] = useState(false)

  const focusScale = useSharedValue(1)

  const searchStyle = useAnimatedStyle(() => ({
    transform: [{ scale: focusScale.value }],
  }))

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
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE)
    return () => clearTimeout(t)
  }, [query])

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

    return () => { cancelled = true }
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
      return { products: [] as any[], stores: [] as any[], brands: [] as string[], categories: [] as string[] }
    }

    // 1. Products
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
        const cat = typeof p.category === 'string' ? p.category.toLowerCase() : String(p.category?.name || '').toLowerCase()
        return name.includes(q) || brand.includes(q) || cat.includes(q)
      })
    }

    // 2. Storefronts
    const storesMap = new Map<string, SellerInfo>()
    allProducts.forEach((p) => {
      const s = getSeller(p)
      if (!s) return
      const name = (s.storeName || s.name || '').toLowerCase()
      if (name && name.includes(q)) storesMap.set(s._id, s)
    })
    const stores = Array.from(storesMap.values()).slice(0, 8)

    // 3. Brands
    const brandSet = new Set<string>()
    allProducts.forEach((p) => {
      if (p.brand && p.brand.toLowerCase().includes(q)) brandSet.add(p.brand)
    })
    const brands = Array.from(brandSet).slice(0, 10)

    // 4. Categories
    const categories = CATEGORY_LIST.filter((c) => {
      const lower = c.toLowerCase()
      return lower.includes(q) || q.split(' ').some((word) => word.length > 2 && lower.includes(word))
    }).slice(0, 8)

    return {
      products: products.slice(0, 14),
      stores,
      brands,
      categories,
    }
  }, [debounced, activeCategory, serverProducts, allProducts])

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
      const next = [clean, ...prev.filter((r) => r.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT)
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [])

  const clearAll = () => {
    setQuery('')
    setDebounced('')
    setActiveCategory(null)
    setServerProducts([])
    inputRef.current?.focus()
  }

  const selectFloor = (cat: string) => {
    setQuery('')
    setDebounced('')
    setActiveCategory(cat)
    Keyboard.dismiss()
  }

  const onFocus = () => {
    setFocused(true)
    focusScale.value = withSpring(1.02, { damping: 15 })
  }

  const onBlur = () => {
    setFocused(false)
    focusScale.value = withSpring(1)
  }

  // ── IDLE ──
  const renderIdle = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 150 }}
      onScrollBeginDrag={Keyboard.dismiss}
    >
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>CATEGORIES</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: PAD, gap: 14 }}
        >
          {FLOORS.map((f, i) => (
            <Animated.View key={f.id} entering={FadeInDown.delay(i * 40).springify()}>
              <Pressable onPress={() => selectFloor(f.id)} style={styles.floorCard}>
                <Image source={{ uri: f.image }} style={styles.floorImg} contentFit="cover" />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.6)']}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.floorLabel}>{f.short}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      </View>

      {recent.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>RECENT</Text>
            <Pressable onPress={() => { setRecent([]); AsyncStorage.removeItem(RECENT_KEY) }}>
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

      <View style={[styles.section, { marginTop: 32 }]}>
        <Text style={styles.sectionLabel}>MOVING NOW</Text>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ color: DIM }}>Loading…</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {trending.map((p, i) => (
              <Animated.View key={p._id} entering={FadeInDown.delay(i * 45).springify()}>
                <ProductCard product={p} cardWidth={CARD_W} />
              </Animated.View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )

  // ── LIVE (strict order) ──
  const renderLive = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 150, paddingTop: 6 }}
      onScrollBeginDrag={Keyboard.dismiss}
    >
      <View style={styles.meta}>
        <View>
          <Text style={styles.metaText}>{activeCategory || debounced}</Text>
          <Text style={styles.metaCount}>
            {live.products.length + live.stores.length} results
          </Text>
        </View>
        <Pressable onPress={clearAll}>
          <Text style={styles.clearTxt}>Clear</Text>
        </Pressable>
      </View>

      {/* 1. PRODUCTS */}
      {live.products.length > 0 && (
        <Animated.View entering={FadeInDown.duration(340)} layout={Layout.springify()}>
          <Text style={styles.groupTitle}>PRODUCTS</Text>
          <View style={styles.grid}>
            {live.products.map((p: any, i: number) => (
              <Animated.View
                key={p._id}
                entering={FadeInDown.delay(i * 38).springify()}
                layout={Layout.springify()}
              >
                <ProductCard product={p} cardWidth={CARD_W} />
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      )}

      {/* 2. STOREFRONTS */}
      {live.stores.length > 0 && (
        <Animated.View entering={FadeInDown.delay(70)} style={{ marginTop: 32 }}>
          <Text style={styles.groupTitle}>STOREFRONTS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: PAD, gap: 12 }}
          >
            {live.stores.map((s, i) => (
              <Animated.View key={s._id} entering={FadeInRight.delay(i * 40)}>
                <Pressable
                  onPress={() => router.push(`/store/${s._id}` as any)}
                  style={styles.storeCard}
                >
                  <View style={styles.storeLogo}>
                    {s.storeLogo ? (
                      <Image source={{ uri: s.storeLogo }} style={{ width: 64, height: 64 }} contentFit="cover" />
                    ) : (
                      <Ionicons name="storefront-outline" size={26} color={BLUE} />
                    )}
                  </View>
                  <Text style={styles.storeName} numberOfLines={1}>
                    {s.storeName || s.name || 'Store'}
                  </Text>
                  <Text style={styles.storeSub}>Official</Text>
                </Pressable>
              </Animated.View>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* 3. BRANDS */}
      {live.brands.length > 0 && (
        <Animated.View entering={FadeInDown.delay(100)} style={{ marginTop: 28 }}>
          <Text style={styles.groupTitle}>BRANDS</Text>
          <View style={styles.chipWrap}>
            {live.brands.map((b, i) => (
              <Animated.View key={b} entering={ZoomIn.delay(i * 28)}>
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

      {/* 4. CATEGORIES */}
      {live.categories.length > 0 && (
        <Animated.View entering={FadeInDown.delay(130)} style={{ marginTop: 28, marginBottom: 12 }}>
          <Text style={styles.groupTitle}>CATEGORIES</Text>
          <View style={styles.chipWrap}>
            {live.categories.map((c, i) => (
              <Animated.View key={c} entering={ZoomIn.delay(i * 28)}>
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
          <Text style={styles.emptyBody}>Try another term or explore the categories</Text>
        </View>
      )}
    </ScrollView>
  )

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Browse</Text>

        <Animated.View style={[styles.searchShell, searchStyle]}>
          <Ionicons name="search" size={18} color={focused ? GREEN : DIM} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={(t) => {
              setQuery(t)
              if (activeCategory) setActiveCategory(null)
            }}
            onFocus={onFocus}
            onBlur={onBlur}
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
        </Animated.View>
      </View>

      <View style={styles.body}>
        {isSearching ? renderLive() : renderIdle()}
      </View>

      <PlazoreFloatingNav visibleProgress={1} onMenuPress={() => setHubOpen(true)} />
      <PlazoreNavigationHub visible={hubOpen} onClose={() => setHubOpen(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: PAD,
    paddingTop: 8,
    paddingBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.6,
    marginBottom: 16,
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    paddingHorizontal: 14,
    backgroundColor: SURFACE,
    borderRadius: 14,
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
  body: { flex: 1 },

  section: { marginTop: 26 },
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
    letterSpacing: 1.1,
    color: DIM,
    paddingHorizontal: PAD,
    marginBottom: 12,
  },
  clearTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: GREEN,
  },

  floorCard: {
    width: 110,
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: SURFACE,
  },
  floorImg: { ...StyleSheet.absoluteFillObject },
  floorLabel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
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
    borderRadius: 20,
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
    marginBottom: 18,
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
    letterSpacing: 1.1,
    color: DIM,
    paddingHorizontal: PAD,
    marginBottom: 12,
  },

  storeCard: {
    width: 120,
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  storeLogo: {
    width: 64,
    height: 64,
    borderRadius: 0,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  storeName: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
    textAlign: 'center',
  },
  storeSub: {
    fontSize: 11,
    fontWeight: '600',
    color: BLUE,
    marginTop: 2,
  },

  brandChip: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,184,107,0.09)',
    borderRadius: 12,
  },
  brandText: {
    fontSize: 13,
    fontWeight: '600',
    color: GREEN,
  },
  catChip: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'rgba(43,91,255,0.09)',
    borderRadius: 12,
  },
  catText: {
    fontSize: 13,
    fontWeight: '600',
    color: BLUE,
  },

  empty: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
  },
})