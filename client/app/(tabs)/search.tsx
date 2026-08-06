import ProductCard from '@/components/ProductCard'
import PlazoreFloatingNav from '@/components/PlazoreFloatingNav'
import PlazoreNavigationHub from '@/components/PlazoreNavigationHub'
import api from '@/constants/api'
import { CATEGORY_LIST } from '@/constants/productCatalog'
import { Product } from '@/constants/types'
import { useMarketplace } from '@/context/MarketplaceContext'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const BG = '#F7F8FA'
const SURFACE = '#FFFFFF'
const TEXT = '#0F172A'
const MUTED = '#64748B'
const DIM = '#94A3B8'
const LINE = '#E8EAED'
const GREEN = '#00B86B'
const BLUE = '#2B5BFF'

const RECENT_KEY = 'plazore_recent_searches'
const MAX_RECENT = 8
const DEBOUNCE = 280

const W = Dimensions.get('window').width
const PAD = 16
const GAP = 12
const CARD_W = (W - PAD * 2 - GAP) / 2
const CAT_SIZE = 78
const THUMB = 44

const FLOORS = [
  {
    id: 'Fashion',
    short: 'Fashion',
    image:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'Electronics',
    short: 'Tech',
    image:
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'Beauty & Personal Care',
    short: 'Beauty',
    image:
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'Home & Living',
    short: 'Home',
    image:
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'Sports & Outdoors',
    short: 'Sport',
    image:
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'Jewelry & Watches',
    short: 'Jewelry',
    image:
      'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=400&q=80',
  },
]

type Mode = 'idle' | 'results' | 'none'

type SellerInfo = {
  _id: string
  name?: string
  storeName?: string
  storeLogo?: string
}

type LocalHit =
  | {
      type: 'product'
      label: string
      id: string
      image?: string
      price: number
      region?: string
      storeName?: string
    }
  | {
      type: 'store'
      label: string
      id: string
      logo?: string
    }
  | {
      type: 'category' | 'brand' | 'ai'
      label: string
      id?: string
    }

export default function SearchScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const inputRef = useRef<TextInput>(null)
  const { formatProduct } = useMarketplace()

  const [hubOpen, setHubOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [focused, setFocused] = useState(false)

  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [trending, setTrending] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [recent, setRecent] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const [aiPhrases, setAiPhrases] = useState<string[]>([])
  const [aiFloors, setAiFloors] = useState<string[]>([])
  const [pinOpen, setPinOpen] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [res, stored] = await Promise.all([
          api.get('/products?limit=40'),
          AsyncStorage.getItem(RECENT_KEY),
        ])
        if (!alive) return
        if (res.data?.success) {
          const list: Product[] = res.data.data || []
          setAllProducts(list)
          setTrending(list.slice(0, 6))
        }
        if (stored) {
          try {
            const p = JSON.parse(stored)
            if (Array.isArray(p)) setRecent(p.slice(0, MAX_RECENT))
          } catch {}
        }
      } catch (e) {
        console.log('Search boot:', e)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (debounced.length < 2 || activeCategory) {
      setAiPhrases([])
      setAiFloors([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get(
          `/ai/search-suggest?q=${encodeURIComponent(debounced)}`
        )
        if (cancelled || !res.data?.success) return
        const d = res.data.data
        setAiPhrases(Array.isArray(d?.suggestions) ? d.suggestions : [])
        setAiFloors(Array.isArray(d?.floors) ? d.floors : [])
      } catch {
        if (!cancelled) {
          setAiPhrases([])
          setAiFloors([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [debounced, activeCategory])

  const getSeller = (p: Product): SellerInfo | null => {
    const s = p.seller
    if (!s || typeof s === 'string') {
      return typeof s === 'string' ? { _id: s } : null
    }
    if (!s._id) return null
    return {
      _id: String(s._id),
      name: s.name,
      storeName: s.storeName,
      storeLogo: s.storeLogo,
    }
  }

  // ── Rich suggestion hits ──
  const localHits = useMemo((): LocalHit[] => {
    const q = query.trim().toLowerCase()
    if (q.length < 1) return []

    const hits: LocalHit[] = []
    const seen = new Set<string>()

    const push = (h: LocalHit) => {
      const key =
        h.type === 'product' || h.type === 'store'
          ? `${h.type}:${h.id}`
          : `${h.type}:${h.label.toLowerCase()}`
      if (seen.has(key) || hits.length >= 10) return
      seen.add(key)
      hits.push(h)
    }

    // Products first (rich rows)
    allProducts.forEach((p) => {
      if ((p.name || '').toLowerCase().includes(q)) {
        const seller = getSeller(p)
        push({
          type: 'product',
          label: p.name,
          id: p._id,
          image: p.images?.[0],
          price: p.price,
          region: p.region,
          storeName: seller?.storeName || seller?.name,
        })
      }
    })

    // Storefronts (from product sellers)
    const stores = new Map<string, SellerInfo>()
    allProducts.forEach((p) => {
      const s = getSeller(p)
      if (!s) return
      const name = (s.storeName || s.name || '').toLowerCase()
      if (name && name.includes(q)) stores.set(s._id, s)
    })
    stores.forEach((s) => {
      push({
        type: 'store',
        label: s.storeName || s.name || 'Store',
        id: s._id,
        logo: s.storeLogo,
      })
    })

    // Categories
    CATEGORY_LIST.forEach((c) => {
      if (c.toLowerCase().includes(q)) push({ type: 'category', label: c })
    })
    FLOORS.forEach((f) => {
      if (f.id.toLowerCase().includes(q) || f.short.toLowerCase().includes(q)) {
        push({ type: 'category', label: f.id })
      }
    })
    aiFloors.forEach((f) => push({ type: 'category', label: f }))

    // Brands
    allProducts.forEach((p) => {
      if (p.brand && p.brand.toLowerCase().includes(q)) {
        push({ type: 'brand', label: p.brand })
      }
    })

    // AI phrases
    aiPhrases.forEach((s) => push({ type: 'ai', label: s }))

    return hits
  }, [query, allProducts, aiPhrases, aiFloors])

  const results = useMemo(() => {
    const q = debounced.toLowerCase()
    let list = allProducts

    if (activeCategory) {
      list = list.filter((p) => {
        const cat =
          typeof p.category === 'string' ? p.category : (p.category as any)?.name
        return String(cat || '').toLowerCase() === activeCategory.toLowerCase()
      })
    }

    if (!q) return activeCategory ? list : []

    return list.filter((p) => {
      const name = (p.name || '').toLowerCase()
      const desc = (p.description || '').toLowerCase()
      const brand = (p.brand || '').toLowerCase()
      const cat =
        typeof p.category === 'string'
          ? p.category.toLowerCase()
          : String((p.category as any)?.name || '').toLowerCase()
      const sub = (p.subCategory || '').toLowerCase()
      const seller = getSeller(p)
      const store = (seller?.storeName || seller?.name || '').toLowerCase()
      return (
        name.includes(q) ||
        desc.includes(q) ||
        brand.includes(q) ||
        cat.includes(q) ||
        sub.includes(q) ||
        store.includes(q)
      )
    })
  }, [allProducts, debounced, activeCategory])

  const mode: Mode = useMemo(() => {
    if (!debounced && !activeCategory) return 'idle'
    if (results.length === 0) return 'none'
    return 'results'
  }, [debounced, activeCategory, results.length])

  const pushRecent = useCallback(async (term: string) => {
    const clean = term.trim()
    if (!clean || clean.length < 2) return
    setRecent((prev) => {
      const next = [
        clean,
        ...prev.filter((r) => r.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, MAX_RECENT)
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [])

  const clearRecent = useCallback(async () => {
    setRecent([])
    await AsyncStorage.removeItem(RECENT_KEY)
  }, [])

  const runSearch = useCallback(
    (term: string) => {
      setPinOpen(false)
      setFocused(false)
      setActiveCategory(null)
      setQuery(term)
      setDebounced(term.trim())
      pushRecent(term)
      Keyboard.dismiss()
    },
    [pushRecent]
  )

  const clearAll = () => {
    setQuery('')
    setDebounced('')
    setActiveCategory(null)
    setAiPhrases([])
    setAiFloors([])
    setPinOpen(false)
    inputRef.current?.focus()
  }

  const selectFloor = (cat: string) => {
    setPinOpen(false)
    setFocused(false)
    setQuery('')
    setDebounced('')
    setActiveCategory(cat)
    Keyboard.dismiss()
  }

  const showSuggestions =
    (focused || pinOpen) &&
    query.trim().length >= 1 &&
    localHits.length > 0 &&
    !activeCategory

  const onHitPress = (h: LocalHit) => {
    setPinOpen(false)
    setFocused(false)
    Keyboard.dismiss()

    if (h.type === 'product') {
      pushRecent(h.label)
      router.push(`/product/${h.id}` as any)
      return
    }
    if (h.type === 'store') {
      pushRecent(h.label)
      router.push(`/store/${h.id}` as any)
      return
    }
    if (h.type === 'category') {
      selectFloor(h.label)
      return
    }
    runSearch(h.label)
  }

  const renderSuggestRow = (h: LocalHit, i: number, last: boolean) => {
    // ── Product: image + name + price ──
    if (h.type === 'product') {
      const priceText = formatProduct(h.price, h.region)
      return (
        <Pressable
          key={`p-${h.id}`}
          onPressIn={() => setPinOpen(true)}
          onPress={() => onHitPress(h)}
          style={({ pressed }) => [
            styles.sugRow,
            pressed && styles.sugPressed,
            last && styles.sugLast,
          ]}
        >
          <View style={styles.thumb}>
            {h.image ? (
              <Image
                source={{ uri: h.image }}
                style={styles.thumbImg}
                contentFit="cover"
              />
            ) : (
              <View style={styles.thumbFallback}>
                <Ionicons name="bag-handle-outline" size={18} color={DIM} />
              </View>
            )}
          </View>
          <View style={styles.sugBody}>
            <Text style={styles.sugTitle} numberOfLines={1}>
              {h.label}
            </Text>
            <View style={styles.sugMeta}>
              <Text style={styles.sugPrice}>{priceText}</Text>
              {h.storeName ? (
                <>
                  <Text style={styles.sugDot}>·</Text>
                  <Text style={styles.sugStore} numberOfLines={1}>
                    {h.storeName}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={14} color={DIM} />
        </Pressable>
      )
    }

    // ── Storefront ──
    if (h.type === 'store') {
      return (
        <Pressable
          key={`s-${h.id}`}
          onPressIn={() => setPinOpen(true)}
          onPress={() => onHitPress(h)}
          style={({ pressed }) => [
            styles.sugRow,
            pressed && styles.sugPressed,
            last && styles.sugLast,
          ]}
        >
          <View style={[styles.thumb, styles.storeThumb]}>
            {h.logo ? (
              <Image
                source={{ uri: h.logo }}
                style={styles.thumbImg}
                contentFit="cover"
              />
            ) : (
              <View style={styles.thumbFallback}>
                <Ionicons name="storefront-outline" size={18} color={BLUE} />
              </View>
            )}
          </View>
          <View style={styles.sugBody}>
            <Text style={styles.sugTitle} numberOfLines={1}>
              {h.label}
            </Text>
            <Text style={styles.sugKind}>Storefront</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={DIM} />
        </Pressable>
      )
    }

    // ── Category / brand / ai ──
    const icon =
      h.type === 'category'
        ? 'grid-outline'
        : h.type === 'brand'
          ? 'pricetag-outline'
          : 'sparkles-outline'
    const kind =
      h.type === 'category' ? 'floor' : h.type === 'brand' ? 'brand' : 'try'

    return (
      <Pressable
        key={`${h.type}-${h.label}-${i}`}
        onPressIn={() => setPinOpen(true)}
        onPress={() => onHitPress(h)}
        style={({ pressed }) => [
          styles.sugRow,
          pressed && styles.sugPressed,
          last && styles.sugLast,
        ]}
      >
        <View style={[styles.thumb, styles.iconThumb]}>
          <Ionicons name={icon as any} size={18} color={MUTED} />
        </View>
        <View style={styles.sugBody}>
          <Text style={styles.sugTitle} numberOfLines={1}>
            {h.label}
          </Text>
          <Text style={styles.sugKind}>{kind}</Text>
        </View>
        <Ionicons name="arrow-forward" size={14} color={DIM} />
      </Pressable>
    )
  }

  // ── IDLE ──
  const renderIdle = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 140 }}
      onScrollBeginDrag={() => {
        setFocused(false)
        setPinOpen(false)
        Keyboard.dismiss()
      }}
    >
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Categories</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catScroll}
        >
          {FLOORS.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => selectFloor(f.id)}
              style={({ pressed }) => [
                styles.catItem,
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={styles.catImgWrap}>
                <Image
                  source={{ uri: f.image }}
                  style={styles.catImg}
                  contentFit="cover"
                  transition={160}
                />
              </View>
              <Text style={styles.catLabel} numberOfLines={1}>
                {f.short}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {recent.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <Pressable onPress={clearRecent} hitSlop={10}>
              <Text style={styles.viewAll}>Clear</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
          >
            {recent.map((r) => (
              <Pressable
                key={r}
                onPress={() => runSearch(r)}
                style={({ pressed }) => [
                  styles.chip,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons name="time-outline" size={13} color={MUTED} />
                <Text style={styles.chipText} numberOfLines={1}>
                  {r}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Moving Now</Text>
        </View>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={GREEN} />
          </View>
        ) : trending.length === 0 ? (
          <Text style={styles.emptyHint}>No products yet</Text>
        ) : (
          <View style={styles.grid}>
            {trending.map((p) => (
              <ProductCard key={p._id} product={p} cardWidth={CARD_W} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )

  const renderResults = () => (
    <FlatList
      data={results}
      keyExtractor={(item) => item._id}
      numColumns={2}
      columnWrapperStyle={{ gap: GAP }}
      contentContainerStyle={{
        paddingHorizontal: PAD,
        paddingTop: 8,
        paddingBottom: 140,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={() => {
        setFocused(false)
        setPinOpen(false)
        Keyboard.dismiss()
      }}
      ListHeaderComponent={
        <View style={styles.metaRow}>
          <Text style={styles.metaText} numberOfLines={1}>
            {activeCategory || debounced}
            <Text style={{ color: DIM }}>  ·  {results.length}</Text>
          </Text>
          <Pressable onPress={clearAll} hitSlop={12}>
            <Text style={styles.viewAll}>Clear</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item }) => (
        <ProductCard product={item} cardWidth={CARD_W} />
      )}
    />
  )

  const renderNone = () => (
    <View style={styles.none}>
      <Text style={styles.noneTitle}>No matches</Text>
      <Text style={styles.noneBody}>
        Nothing for “{debounced || activeCategory}”. Try another term or a
        category.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 4 }}
      >
        {FLOORS.slice(0, 5).map((f) => (
          <Pressable
            key={f.id}
            onPress={() => selectFloor(f.id)}
            style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.chipText}>{f.short}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[GREEN, BLUE]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 12 }]}
      >
        <Text style={styles.heroTitle}>Search</Text>

        <View style={styles.searchWrap}>
          <View style={styles.shell}>
            <Ionicons name="search" size={18} color={DIM} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={(t) => {
                setQuery(t)
                if (activeCategory) setActiveCategory(null)
              }}
              onFocus={() => {
                setFocused(true)
                setPinOpen(true)
              }}
              onBlur={() => {
                setTimeout(() => {
                  setFocused(false)
                  setPinOpen(false)
                }, 200)
              }}
              onSubmitEditing={() => {
                if (query.trim()) {
                  pushRecent(query)
                  setFocused(false)
                  setPinOpen(false)
                  Keyboard.dismiss()
                }
              }}
              placeholder="Search products, stores, brands…"
              placeholderTextColor={DIM}
              style={styles.input}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {(query.length > 0 || !!activeCategory) && (
              <Pressable onPress={clearAll} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={DIM} />
              </Pressable>
            )}
          </View>

          {/* Rich floating suggestions */}
          {showSuggestions && (
            <View style={styles.suggestBox}>
              <ScrollView
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled
                style={{ maxHeight: 340 }}
              >
                {localHits.map((h, i) =>
                  renderSuggestRow(h, i, i === localHits.length - 1)
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </LinearGradient>

      {activeCategory && !query ? (
        <View style={styles.pillBar}>
          <View style={styles.pill}>
            <View style={styles.pillDot} />
            <Text style={styles.pillText}>{activeCategory}</Text>
            <Pressable onPress={clearAll} hitSlop={8}>
              <Ionicons name="close" size={14} color={BLUE} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.body}>
        {mode === 'idle' && renderIdle()}
        {mode === 'results' && renderResults()}
        {mode === 'none' && renderNone()}
      </View>

      <PlazoreFloatingNav
        visibleProgress={1}
        onMenuPress={() => setHubOpen(true)}
      />
      <PlazoreNavigationHub visible={hubOpen} onClose={() => setHubOpen(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  hero: {
    paddingHorizontal: PAD,
    paddingBottom: 18,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  searchWrap: {
    zIndex: 50,
    elevation: 50,
  },
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: SURFACE,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: TEXT,
    paddingVertical: 0,
  },

  /* ── suggestion panel ── */
  suggestBox: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderTopWidth: 0,
    zIndex: 100,
    elevation: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
  },
  sugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  sugPressed: { backgroundColor: '#F1F5F9' },
  sugLast: { borderBottomWidth: 0 },
  thumb: {
    width: THUMB,
    height: THUMB,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  storeThumb: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(43,91,255,0.25)',
  },
  iconThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sugBody: {
    flex: 1,
    minWidth: 0,
  },
  sugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
  },
  sugMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
  },
  sugPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: GREEN,
  },
  sugDot: {
    fontSize: 12,
    color: DIM,
  },
  sugStore: {
    flex: 1,
    fontSize: 12,
    color: MUTED,
  },
  sugKind: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: DIM,
  },

  pillBar: {
    paddingHorizontal: PAD,
    paddingTop: 10,
    backgroundColor: BG,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(43,91,255,0.35)',
    backgroundColor: 'rgba(43,91,255,0.06)',
  },
  pillDot: { width: 5, height: 5, backgroundColor: BLUE },
  pillText: { fontSize: 12, fontWeight: '600', color: BLUE },

  body: { flex: 1, backgroundColor: BG },

  section: { marginTop: 22 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: TEXT },
  viewAll: { fontSize: 13, fontWeight: '600', color: GREEN },

  catScroll: { paddingHorizontal: PAD, gap: 14 },
  catItem: { width: CAT_SIZE, alignItems: 'center' },
  catImgWrap: {
    width: CAT_SIZE,
    height: CAT_SIZE,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    marginBottom: 8,
  },
  catImg: { width: '100%', height: '100%' },
  catLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT,
    textAlign: 'center',
  },

  chipScroll: { paddingHorizontal: PAD, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT,
    maxWidth: 130,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: PAD,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metaText: { flex: 1, fontSize: 13, fontWeight: '600', color: TEXT },
  loader: { paddingVertical: 36, alignItems: 'center' },
  emptyHint: {
    fontSize: 13,
    color: DIM,
    textAlign: 'center',
    paddingVertical: 24,
  },
  none: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 10,
  },
  noneTitle: { fontSize: 17, fontWeight: '700', color: TEXT },
  noneBody: {
    fontSize: 13,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 8,
  },
})