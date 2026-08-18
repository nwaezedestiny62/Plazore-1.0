// client/app/(tabs)/search.tsx
import PlazoreFloatingNav from '@/components/PlazoreFloatingNav'
import PlazoreNavigationHub from '@/components/PlazoreNavigationHub'
import ShowroomProductCard from '@/components/showroom/ShowroomProductCard'
import { ShowroomFlyCartProvider } from '@/components/showroom/ShowroomFlyCart'
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
  Animated,
  Easing,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/* ── Plazore dark ── */
const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const TEXT = '#F5F7FA'
const MUTED = '#A7ADB8'
const DIM = '#737A86'
const LINE = '#252A33'
const ACCENT = '#10B981'
const AI_BLUE = '#3B82F6'

const RECENT_KEY = 'plazore_recent_searches'
const MAX_RECENT = 8
const DEBOUNCE = 240

const PAD = 16
const GAP = 4

/**
 * Floors = human labels.
 * Each floor owns one or more real CATEGORY_LIST keys.
 */
const FLOORS: {
  id: string
  short: string
  hint: string
  match: string[]
  images: [string, string, string]
}[] = [
  {
    id: 'Fashion',
    short: 'Fashion',
    hint: 'Clothing, shoes, bags',
    match: ['Fashion', 'Luxury Goods'],
    images: [
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&q=80',
      'https://images.unsplash.com/photo-1445205170230-053b83016050?w=500&q=80',
      'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=500&q=80',
    ],
  },
  {
    id: 'Tech',
    short: 'Tech',
    hint: 'Phones, computers, gadgets',
    match: ['Electronics', 'Phones & Accessories', 'Computers'],
    images: [
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=500&q=80',
      'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500&q=80',
      'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=500&q=80',
    ],
  },
  {
    id: 'Beauty',
    short: 'Beauty',
    hint: 'Skincare, makeup, fragrance',
    match: ['Beauty & Personal Care'],
    images: [
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&q=80',
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&q=80',
      'https://images.unsplash.com/photo-1571781926291-c77df8097c1f?w=500&q=80',
    ],
  },
  {
    id: 'Home',
    short: 'Home',
    hint: 'Living, furniture, kitchen',
    match: ['Home & Living', 'Furniture', 'Kitchen & Dining'],
    images: [
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=500&q=80',
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&q=80',
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=500&q=80',
    ],
  },
  {
    id: 'Sport',
    short: 'Sport',
    hint: 'Fitness, outdoor, cycling',
    match: ['Sports & Outdoors'],
    images: [
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500&q=80',
      'https://images.unsplash.com/photo-1461896836934-ffe607ba6851?w=500&q=80',
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500&q=80',
    ],
  },
  {
    id: 'Jewelry',
    short: 'Jewelry',
    hint: 'Jewelry & watches',
    match: ['Jewelry & Watches'],
    images: [
      'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&q=80',
      'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=500&q=80',
      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500&q=80',
    ],
  },
  {
    id: 'Health',
    short: 'Health',
    hint: 'Wellness & medical',
    match: ['Health'],
    images: [
      'https://images.unsplash.com/photo-1505751172876-fa206803aee1?w=500&q=80',
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=500&q=80',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&q=80',
    ],
  },
  {
    id: 'Kids',
    short: 'Kids',
    hint: 'Toys, baby, play',
    match: ['Toys & Games', 'Baby Products'],
    images: [
      'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=500&q=80',
      'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=500&q=80',
      'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=500&q=80',
    ],
  },
  {
    id: 'Pets',
    short: 'Pets',
    hint: 'Pet supplies',
    match: ['Pet Supplies'],
    images: [
      'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=500&q=80',
      'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500&q=80',
      'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=500&q=80',
    ],
  },
  {
    id: 'Auto',
    short: 'Auto',
    hint: 'Parts & tools',
    match: ['Automotive'],
    images: [
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=500&q=80',
      'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=500&q=80',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=500&q=80',
    ],
  },
  {
    id: 'Food',
    short: 'Food',
    hint: 'Groceries & pantry',
    match: ['Groceries'],
    images: [
      'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&q=80',
      'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=500&q=80',
      'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&q=80',
    ],
  },
  {
    id: 'Work',
    short: 'Work',
    hint: 'Office, books, craft',
    match: ['Books', 'Office Supplies', 'Art & Crafts', 'Musical Instruments'],
    images: [
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=500&q=80',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&q=80',
      'https://images.unsplash.com/photo-14565130808af5207b36797abb?w=500&q=80',
    ],
  },
  {
    id: 'Build',
    short: 'Build',
    hint: 'Tools, industrial, farm',
    match: ['Industrial Equipment', 'Agriculture', 'Building Materials'],
    images: [
      'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=500&q=80',
      'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=500&q=80',
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=500&q=80',
    ],
  },
  {
    id: 'Collect',
    short: 'Collect',
    hint: 'Collectibles & more',
    match: ['Collectibles', 'Others'],
    images: [
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500&q=80',
      'https://images.unsplash.com/photo-1607083206869-4c797ed044a?w=500&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80',
    ],
  },
]

const CATEGORY_TO_FLOOR = (() => {
  const map: Record<string, string> = {}
  FLOORS.forEach((f) => {
    f.match.forEach((c) => {
      map[c.toLowerCase()] = f.id
    })
  })
  return map
})()

type SellerInfo = {
  _id: string
  name?: string
  storeName?: string
  storeLogo?: string
}

function getProductCategory(p: any): string {
  if (typeof p.category === 'string') return p.category
  return String(p.category?.name || '')
}

function FloorImage({ images }: { images: [string, string, string] }) {
  const [idx, setIdx] = useState(0)
  return (
    <Image
      source={{ uri: images[idx] }}
      style={StyleSheet.absoluteFillObject}
      contentFit="cover"
      transition={0}
      cachePolicy="memory-disk"
      onError={() => {
        if (idx < 2) setIdx((i) => i + 1)
      }}
    />
  )
}

function toStaticProduct(p: Product): Product {
  const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : []
  return {
    ...p,
    images: imgs.length ? [imgs[0]] : [],
  }
}

/** Same orb preloader as product page entry */
function StorePreloader() {
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
  }, [rotation])

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
            contentFit="contain"
          />
        </View>
      </View>
    </View>
  )
}

/** Smooth fade + slight lift when a product list appears */
function FadeInGrid({
  children,
  animKey,
}: {
  children: React.ReactNode
  animKey: string
}) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(14)).current

  useEffect(() => {
    opacity.setValue(0)
    translateY.setValue(14)
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()
  }, [animKey, opacity, translateY])

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
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
  /** Category/floor selection loading (product-page style preloader) */
  const [categoryLoading, setCategoryLoading] = useState(false)

  const [filterOpen, setFilterOpen] = useState(false)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [inStockOnly, setInStockOnly] = useState(false)

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
        const res = await api.get(
          `/ai/search-suggest?q=${encodeURIComponent(debounced)}`
        )
        if (cancelled || !res.data?.success) return
        setServerProducts(
          Array.isArray(res.data.data?.products) ? res.data.data.products : []
        )
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

  const matchesActive = useCallback((p: any, active: string) => {
    const cat = getProductCategory(p)
    const catL = cat.toLowerCase()

    if (catL === active.toLowerCase()) return true

    const floor = FLOORS.find((f) => f.id === active)
    if (floor) {
      return floor.match.some((m) => m.toLowerCase() === catL)
    }

    const floorId = CATEGORY_TO_FLOOR[active.toLowerCase()]
    if (floorId) {
      const f = FLOORS.find((x) => x.id === floorId)
      return !!f?.match.some((m) => m.toLowerCase() === catL)
    }

    return false
  }, [])

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
      products = products.filter((p: any) => matchesActive(p, activeCategory))
    } else if (q) {
      products = products.filter((p: any) => {
        const name = (p.name || '').toLowerCase()
        const brand = (p.brand || '').toLowerCase()
        const cat = getProductCategory(p).toLowerCase()
        return name.includes(q) || brand.includes(q) || cat.includes(q)
      })
    }

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
    if (q) {
      allProducts.forEach((p) => {
        const s = getSeller(p)
        if (!s) return
        const name = (s.storeName || s.name || '').toLowerCase()
        if (name && name.includes(q)) storesMap.set(s._id, s)
      })
    }
    const stores = Array.from(storesMap.values()).slice(0, 8)

    const brandSet = new Set<string>()
    if (q) {
      allProducts.forEach((p) => {
        if (p.brand && p.brand.toLowerCase().includes(q)) brandSet.add(p.brand)
      })
    }
    const brands = Array.from(brandSet).slice(0, 10)

    const categories = CATEGORY_LIST.filter((c) => {
      if (!q) return false
      const lower = c.toLowerCase()
      return (
        lower.includes(q) ||
        q.split(' ').some((word) => word.length > 2 && lower.includes(word))
      )
    }).slice(0, 10)

    return {
      products: products.slice(0, 24),
      stores,
      brands,
      categories,
    }
  }, [
    debounced,
    activeCategory,
    serverProducts,
    allProducts,
    minPrice,
    maxPrice,
    inStockOnly,
    matchesActive,
  ])

  const isSearching = debounced.length > 0 || !!activeCategory
  const hasResults =
    live.products.length > 0 ||
    live.stores.length > 0 ||
    live.brands.length > 0 ||
    live.categories.length > 0

  const activeLabel = useMemo(() => {
    if (!activeCategory) return debounced
    const floor = FLOORS.find((f) => f.id === activeCategory)
    return floor ? floor.short : activeCategory
  }, [activeCategory, debounced])

  /** Key so FadeInGrid re-runs when results change */
  const gridAnimKey = useMemo(
    () =>
      `${activeCategory || debounced || 'idle'}-${live.products
        .map((p: any) => p._id)
        .join(',')
        .slice(0, 80)}`,
    [activeCategory, debounced, live.products]
  )

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

  const clearAll = () => {
    setQuery('')
    setDebounced('')
    setActiveCategory(null)
    setServerProducts([])
    setCategoryLoading(false)
    setMinPrice('')
    setMaxPrice('')
    setInStockOnly(false)
    inputRef.current?.focus()
  }

  /** Floor / category tap → same preloader as product page, then results */
  const selectFloor = (floorId: string) => {
    setQuery('')
    setDebounced('')
    setCategoryLoading(true)
    setActiveCategory(floorId)
    Keyboard.dismiss()
    // Brief hold so the orb is visible (filter is sync from cache)
    setTimeout(() => setCategoryLoading(false), 650)
  }

  const selectExactCategory = (cat: string) => {
    setQuery('')
    setDebounced('')
    setCategoryLoading(true)
    setActiveCategory(cat)
    Keyboard.dismiss()
    setTimeout(() => setCategoryLoading(false), 650)
  }

  const renderProductGrid = (items: Product[], key: string) => (
    <FadeInGrid animKey={key}>
      <View style={styles.grid}>
        {items.map((p) => (
          <ShowroomProductCard key={p._id} product={toStaticProduct(p)} dark />
        ))}
      </View>
    </FadeInGrid>
  )

  const renderIdle = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 150 }}
      onScrollBeginDrag={Keyboard.dismiss}
    >
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>EXPLORE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: PAD, gap: 12 }}
        >
          {FLOORS.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => selectFloor(f.id)}
              style={styles.floorCard}
            >
              <FloorImage images={f.images} />
              <LinearGradient
                colors={['transparent', 'rgba(9,11,15,0.88)']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.floorLabel}>{f.short}</Text>
              <Text style={styles.floorHint} numberOfLines={1}>
                {f.hint}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {recent.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text
              style={[
                styles.sectionLabel,
                { marginBottom: 0, paddingHorizontal: 0 },
              ]}
            >
              RECENT SEARCHES
            </Text>
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

      <View style={[styles.section, { marginTop: 28 }]}>
        <Text style={styles.sectionLabel}>MOVING NOW</Text>
        {loading ? (
          <View style={{ height: 220 }}>
            <StorePreloader />
          </View>
        ) : (
          renderProductGrid(trending, 'trending')
        )}
      </View>
    </ScrollView>
  )

  const renderLive = () => {
    if (categoryLoading) {
      return (
        <View style={{ flex: 1 }}>
          <StorePreloader />
        </View>
      )
    }

    if (searchLoading && live.products.length === 0) {
      return (
        <View style={{ flex: 1, minHeight: 280 }}>
          <StorePreloader />
        </View>
      )
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 150, paddingTop: 4 }}
        onScrollBeginDrag={Keyboard.dismiss}
      >
        <View style={styles.meta}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.metaText} numberOfLines={1}>
              {activeLabel}
            </Text>
            <Text style={styles.metaCount}>
  {[
    live.products.length > 0
      ? `${live.products.length} ${live.products.length === 1 ? 'product' : 'products'}`
      : null,
    live.stores.length > 0
      ? `${live.stores.length} ${live.stores.length === 1 ? 'storefront' : 'storefronts'}`
      : null,
    live.brands.length > 0
      ? `${live.brands.length} ${live.brands.length === 1 ? 'brand' : 'brands'}`
      : null,
    live.categories.length > 0
      ? `${live.categories.length} ${live.categories.length === 1 ? 'category' : 'categories'}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')}
</Text>
          </View>
          <Pressable onPress={clearAll} hitSlop={10}>
            <Text style={styles.clearTxt}>Clear</Text>
          </Pressable>
        </View>

        {live.products.length > 0 && (
          <View>
            <Text style={styles.groupTitle}>PRODUCTS</Text>
            {renderProductGrid(live.products as Product[], gridAnimKey)}
          </View>
        )}

        {live.stores.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <Text style={styles.groupTitle}>STOREFRONTS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: PAD, gap: 12 }}
            >
              {live.stores.map((s) => (
                <Pressable
                  key={s._id}
                  onPress={() => router.push(`/store/${s._id}` as any)}
                  style={styles.storeCard}
                >
                  <View style={styles.storeLogo}>
                    {s.storeLogo ? (
                      <Image
                        source={{ uri: s.storeLogo }}
                        style={{ width: 56, height: 56 }}
                        contentFit="cover"
                        transition={0}
                      />
                    ) : (
                      <Ionicons
                        name="storefront-outline"
                        size={22}
                        color={MUTED}
                      />
                    )}
                  </View>
                  <Text style={styles.storeName} numberOfLines={1}>
                    {s.storeName || s.name || 'Store'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {live.brands.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <Text style={styles.groupTitle}>BRANDS</Text>
            <View style={styles.chipWrap}>
              {live.brands.map((b) => (
                <Pressable
                  key={b}
                  onPress={() => {
                    setQuery(b)
                    setDebounced(b)
                    pushRecent(b)
                  }}
                  style={styles.brandChip}
                >
                  <Text style={styles.brandText}>{b}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {live.categories.length > 0 && (
          <View style={{ marginTop: 28, marginBottom: 8 }}>
            <Text style={styles.groupTitle}>CATEGORIES</Text>
            <View style={styles.chipWrap}>
              {live.categories.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => selectExactCategory(c)}
                  style={styles.catChip}
                >
                  <Text style={styles.catText}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {!hasResults && !searchLoading && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing found</Text>
            <Text style={styles.emptyBody}>
              Try another search or browse by category.
            </Text>
          </View>
        )}
      </ScrollView>
    )
  }

  return (
    <ShowroomFlyCartProvider>
      <View style={[styles.root, { paddingTop: insets.top }]}>
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
                  setCategoryLoading(false)
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
                selectionColor={ACCENT}
              />
              {(query.length > 0 || !!activeCategory) && (
                <Pressable onPress={clearAll} hitSlop={12}>
                  <Ionicons name="close-circle" size={18} color={DIM} />
                </Pressable>
              )}
            </View>

            {isSearching && (
              <Pressable
                onPress={() => setFilterOpen(true)}
                style={styles.filterBtn}
              >
                <Ionicons name="options-outline" size={20} color={TEXT} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.body}>
          {isSearching ? renderLive() : renderIdle()}
        </View>

        <PlazoreNavigationHub
          visible={hubOpen}
          onClose={() => setHubOpen(false)}
        />

        <Modal visible={filterOpen} transparent animationType="fade">
          <Pressable
            style={styles.modalScrim}
            onPress={() => setFilterOpen(false)}
          />
          <View style={styles.filterSheet}>
            <Text style={styles.filterTitle}>Filters</Text>

            <Text style={styles.filterLabel}>Price range</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <TextInput
                style={styles.filterInput}
                placeholder="Min"
                keyboardType="numeric"
                value={minPrice}
                onChangeText={setMinPrice}
                placeholderTextColor={DIM}
                selectionColor={ACCENT}
              />
              <TextInput
                style={styles.filterInput}
                placeholder="Max"
                keyboardType="numeric"
                value={maxPrice}
                onChangeText={setMaxPrice}
                placeholderTextColor={DIM}
                selectionColor={ACCENT}
              />
            </View>

            <Pressable
              onPress={() => setInStockOnly((v) => !v)}
              style={styles.checkRow}
            >
              <View
                style={[styles.checkBox, inStockOnly && styles.checkBoxOn]}
              >
                {inStockOnly && (
                  <Ionicons name="checkmark" size={14} color={BG} />
                )}
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
              <Pressable
                onPress={() => setFilterOpen(false)}
                style={styles.filterApply}
              >
                <Text style={{ fontWeight: '700', color: BG }}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </ShowroomFlyCartProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  /* Product-page orb preloader */
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
    borderTopColor: ACCENT,
    borderRightColor: AI_BLUE,
    borderBottomColor: 'transparent',
    borderLeftColor: ACCENT,
  },
  orbLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16,185,129,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbLogo: { width: 32, height: 32 },

  header: {
    paddingHorizontal: PAD,
    paddingTop: 6,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
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
    width: 112,
    height: 148,
    overflow: 'hidden',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  floorLabel: {
    position: 'absolute',
    bottom: 28,
    left: 12,
    right: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  floorHint: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
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
    justifyContent: 'space-between',
  },

  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: PAD,
    marginBottom: 16,
    gap: 12,
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
    backgroundColor: SURFACE_2,
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
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(16,185,129,0.25)',
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

  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  filterSheet: {
    backgroundColor: SURFACE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
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
    color: MUTED,
    marginBottom: 8,
  },
  filterInput: {
    flex: 1,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 12,
    fontSize: 14,
    color: TEXT,
    backgroundColor: SURFACE_2,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  filterReset: {
    flex: 1,
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE_2,
  },
  filterApply: {
    flex: 1,
    height: 48,
    backgroundColor: TEXT,
    alignItems: 'center',
    justifyContent: 'center',
  },
})