// ============================================================
// FILE: client/components/PlazoreNavigationHub.tsx
// ============================================================

import api from '@/constants/api'
import { CATEGORY_LIST } from '@/constants/productCatalog'
import { Product } from '@/constants/types'
import { useMarketplace } from '@/context/MarketplaceContext'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, useClerk, useUser } from '@clerk/clerk-expo'
import { Image as ExpoImage } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { usePathname, useRouter } from 'expo-router'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/* ── 2070 Luxury Lounge Palette ── */
const BG = '#050508'
const SURFACE = '#0B0C12'
const SURFACE_2 = '#11131C'
const SURFACE_CARD = '#161826'
const TEXT = '#F5F7FA'
const TEXT_DIM = 'rgba(245,247,250,0.65)'
const TEXT_MUTED = 'rgba(245,247,250,0.35)'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const PURPLE = '#A78BFA'
const CYAN = '#22D3EE'
const LINE = 'rgba(255,255,255,0.08)'

/* ── Animation Speeds (slow & calm) ── */
const OPEN_MS = 900
const CLOSE_MS = 480
const EASE_LUXURY = Easing.bezier(0.22, 1, 0.36, 1)
const DEBOUNCE = 280

const TILE_COLORS: Record<string, { bg: string; accent: string; glow: string }> = {
  home:             { bg: '#0A1C14', accent: '#00E575', glow: 'rgba(0,229,117,0.25)' },
  cart:             { bg: '#0D172A', accent: '#3B82F6', glow: 'rgba(59,130,246,0.25)' },
  wishlist:         { bg: '#230E19', accent: '#F43F5E', glow: 'rgba(244,63,94,0.25)' },
  profile:          { bg: '#1A0E2A', accent: '#A78BFA', glow: 'rgba(167,139,250,0.25)' },
  showroom_horizon: { bg: '#091520', accent: '#38BDF8', glow: 'rgba(56,189,248,0.25)' },
  showroom_chamber: { bg: '#1F180F', accent: '#F59E0B', glow: 'rgba(245,158,11,0.25)' },
  showroom_signal:  { bg: '#1E0E28', accent: '#C084FC', glow: 'rgba(192,132,252,0.25)' },
  showroom_locale:  { bg: '#1E1710', accent: '#FB923C', glow: 'rgba(251,146,60,0.25)' },
  showroom_atelier: { bg: '#1D1810', accent: '#C5A880', glow: 'rgba(197,168,128,0.25)' },
  categories:       { bg: '#0B1E28', accent: '#22D3EE', glow: 'rgba(34,211,238,0.25)' },
  new:              { bg: '#251A0A', accent: '#FBBF24', glow: 'rgba(251,191,36,0.25)' },
  trending:         { bg: '#28120A', accent: '#FB923C', glow: 'rgba(251,146,60,0.25)' },
  stores:           { bg: '#121430', accent: '#6366F1', glow: 'rgba(99,102,241,0.25)' },
  help:             { bg: '#0D2623', accent: '#2DD4BF', glow: 'rgba(45,212,191,0.25)' },
  contact:          { bg: '#181230', accent: '#818CF8', glow: 'rgba(129,140,248,0.25)' },
  about:            { bg: '#0C1C18', accent: '#34D399', glow: 'rgba(52,211,153,0.25)' },
}

/* ── Showroom tile ID → room number mapping ── */
const SHOWROOM_ID_TO_ROOM: Record<string, number> = {
  showroom_horizon: 1,
  showroom_chamber: 2,
  showroom_signal: 3,
  showroom_locale: 4,
  showroom_atelier: 5,
}

type NavItem = {
  id: string
  label: string
  subtitle?: string
  icon: keyof typeof Ionicons.glyphMap
  href?: string
}

type NavSection = {
  id: string
  title: string
  items: NavItem[]
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

type SellerInfo = {
  _id: string
  name?: string
  storeName?: string
  storeLogo?: string
}

export type PlazoreNavigationHubProps = {
  visible: boolean
  onClose: () => void
  onScrollToRoom?: (roomNumber: number) => void
  slots?: {
    profile?: React.ReactNode
    recommendations?: React.ReactNode
    recentlyViewed?: React.ReactNode
    musicSettings?: React.ReactNode
    sellerShortcuts?: React.ReactNode
  }
}

const SECTIONS: NavSection[] = [
  {
    id: 'primary',
    title: 'Floors',
    items: [
      { id: 'home', label: 'Home', subtitle: 'Main showroom', icon: 'home', href: '/(tabs)' },
      { id: 'cart', label: 'Cart', subtitle: 'Your bag', icon: 'bag-handle', href: '/(tabs)/cart' },
      { id: 'wishlist', label: 'Wishlist', subtitle: 'Saved pieces', icon: 'heart', href: '/(tabs)/favorites' },
      { id: 'profile', label: 'Profile', subtitle: 'Account', icon: 'person', href: '/(tabs)/profile' },
    ],
  },
  {
    id: 'showroom_rooms',
    title: 'Showroom Floors & Rooms',
    items: [
      { id: 'showroom_horizon', label: '01. Horizon', subtitle: 'Expanded view', icon: 'eye-outline', href: '/(tabs)' },
      { id: 'showroom_chamber', label: '02. Chamber', subtitle: 'Private selection', icon: 'key-outline', href: '/(tabs)' },
      { id: 'showroom_signal', label: '03. Signal', subtitle: 'Spotlight focus', icon: 'radio-outline', href: '/(tabs)' },
      { id: 'showroom_locale', label: '04. Locale', subtitle: 'Regional walk', icon: 'location-outline', href: '/(tabs)' },
      { id: 'showroom_atelier', label: '05. Atelier', subtitle: 'Curated gallery', icon: 'sparkles-outline', href: '/(tabs)' },
    ],
  },
{
    id: 'explore',
    title: 'Explore the Mall',
    items: [
      { id: 'categories', label: 'Categories', subtitle: 'Browse by room', icon: 'apps' },
      { id: 'new', label: 'New Arrivals', subtitle: 'Just in', icon: 'sparkles' },
      { id: 'trending', label: 'Trending', subtitle: 'Moving now', icon: 'flame' },
      { id: 'stores', label: 'Stores', subtitle: 'Seller floors', icon: 'storefront' },
    ],
  },
  {
    id: 'support',
    title: 'Service Desk',
    items: [
      { id: 'help', label: 'Help', subtitle: 'Guides', icon: 'help-buoy' },
      { id: 'contact', label: 'Contact', subtitle: 'Talk to us', icon: 'chatbubbles' },
      { id: 'about', label: 'About', subtitle: 'Plazore', icon: 'information-circle' },
    ],
  },
]

/* ── Calm Fade + Slide ── */
function FadeSlideIn({
  index,
  children,
  delayBase = 0,
  duration = 700,
}: {
  index: number
  children: React.ReactNode
  delayBase?: number
  duration?: number
}) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    anim.setValue(0)
    Animated.timing(anim, {
      toValue: 1,
      duration,
      delay: delayBase + index * 55,
      easing: EASE_LUXURY,
      useNativeDriver: true,
    }).start()
  }, [])

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [18, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  )
}

function MallTile({
  item,
  active,
  onPress,
  width,
  height,
  index,
}: {
  item: NavItem
  active: boolean
  onPress: () => void
  width: number
  height: number
  index: number
}) {
  const scale = useRef(new Animated.Value(1)).current
  const palette = TILE_COLORS[item.id] || {
    bg: SURFACE_2,
    accent: GREEN,
    glow: 'rgba(0,229,117,0.2)',
  }

  return (
    <FadeSlideIn index={index} delayBase={180} duration={750}>
      <Pressable
        onPress={onPress}
        onPressIn={() =>
          Animated.timing(scale, {
            toValue: 0.96,
            duration: 120,
            useNativeDriver: true,
          }).start()
        }
        onPressOut={() =>
          Animated.timing(scale, {
            toValue: 1,
            duration: 220,
            easing: EASE_LUXURY,
            useNativeDriver: true,
          }).start()
        }
      >
        <Animated.View
          style={{
            width,
            height,
            backgroundColor: palette.bg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: active ? palette.accent : LINE,
            padding: 14,
            justifyContent: 'space-between',
            overflow: 'hidden',
            transform: [{ scale }],
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -24,
              right: -24,
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: palette.glow,
              opacity: active ? 0.55 : 0.22,
            }}
          />

          {active && (
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 3.5,
                backgroundColor: palette.accent,
              }}
            />
          )}

          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${palette.accent}16`,
              borderWidth: 1,
              borderColor: `${palette.accent}35`,
            }}
          >
            <Ionicons
              name={item.icon}
              size={22}
              color={active ? palette.accent : TEXT}
            />
          </View>

          <View>
            <Text
              style={{
                color: active ? palette.accent : TEXT,
                fontSize: 14,
                fontWeight: '700',
              }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            {!!item.subtitle && (
              <Text style={{ color: TEXT_MUTED, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                {item.subtitle}
              </Text>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </FadeSlideIn>
  )
}

export default function PlazoreNavigationHub({
  visible,
  onClose,
  onScrollToRoom,
  slots,
}: PlazoreNavigationHubProps) {
  const insets = useSafeAreaInsets()
  const { width: windowW } = useWindowDimensions()
  const router = useRouter()
  const pathname = usePathname()
  const { formatProduct } = useMarketplace()

  const { user } = useUser()
  const { signOut } = useClerk()
  const { isSignedIn } = useAuth()

  const role = (user?.publicMetadata?.role as string) || 'buyer'
  const isSeller = role === 'seller' || role === 'admin'

  const progress = useRef(new Animated.Value(0)).current
  const contentFade = useRef(new Animated.Value(0)).current
  const [mounted, setMounted] = useState(visible)
  const [contentKey, setContentKey] = useState(0)
  const inputRef = useRef<TextInput>(null)

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [serverProducts, setServerProducts] = useState<any[]>([])
  const [aiPhrases, setAiPhrases] = useState<string[]>([])
  const [aiFloors, setAiFloors] = useState<string[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [allProducts, setAllProducts] = useState<Product[]>([])

  const pad = 16
  const gap = 12
  const tileW = Math.floor((windowW - pad * 2 - gap) / 2)
  const tileH = Math.round(tileW * 0.92)

  const topInset = Math.max(insets.top, StatusBar.currentHeight ?? 0, 12)
  const bottomInset = Math.max(insets.bottom, 12)
  const isSearching = query.trim().length >= 1

  // Prefetch products for store matching
  useEffect(() => {
    if (!visible) return
    let alive = true
    ;(async () => {
      try {
        const res = await api.get('/products?limit=80')
        if (!alive) return
        if (res.data?.success) setAllProducts(res.data.data || [])
      } catch {}
    })()
    return () => {
      alive = false
    }
  }, [visible])

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE)
    return () => clearTimeout(t)
  }, [query])

  // Server search-suggest
  useEffect(() => {
    if (debounced.length < 1) {
      setServerProducts([])
      setAiPhrases([])
      setAiFloors([])
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

        const d = res.data.data
        setServerProducts(Array.isArray(d?.products) ? d.products : [])
        setAiPhrases(Array.isArray(d?.suggestions) ? d.suggestions : [])
        setAiFloors(Array.isArray(d?.floors) ? d.floors : [])
      } catch {
        if (!cancelled) {
          setServerProducts([])
          setAiPhrases([])
          setAiFloors([])
        }
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [debounced])

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

  const groupedHits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 1) {
      return { products: [], stores: [], categories: [], ai: [] }
    }

    // Products from server
    const products: LocalHit[] = (serverProducts || []).slice(0, 8).map((p: any) => {
      const seller = getSeller(p)
      return {
        type: 'product' as const,
        label: p.name,
        id: p._id,
        image: p.images?.[0],
        price: p.price,
        region: p.region,
        storeName: seller?.storeName || seller?.name,
      }
    })

    // Stores
    const storesMap = new Map<string, SellerInfo>()
    allProducts.forEach((p) => {
      const s = getSeller(p)
      if (!s) return
      const name = (s.storeName || s.name || '').toLowerCase()
      if (name && name.includes(q)) storesMap.set(s._id, s)
    })

    const stores: LocalHit[] = []
    storesMap.forEach((s) => {
      if (stores.length < 4) {
        stores.push({
          type: 'store',
          label: s.storeName || s.name || 'Store',
          id: s._id,
          logo: s.storeLogo,
        })
      }
    })

    // Categories + AI floors
    const categories: LocalHit[] = []
    CATEGORY_LIST.forEach((c) => {
      if (c.toLowerCase().includes(q) && categories.length < 4) {
        categories.push({ type: 'category', label: c })
      }
    })
    aiFloors.forEach((f) => {
      if (categories.length < 6 && !categories.some((c) => c.label === f)) {
        categories.push({ type: 'category', label: f })
      }
    })

    // AI phrases
    const aiHits: LocalHit[] = aiPhrases.slice(0, 5).map((phrase) => ({
      type: 'ai' as const,
      label: phrase,
    }))

    return { products, stores, categories, ai: aiHits }
  }, [query, serverProducts, allProducts, aiPhrases, aiFloors])

  const totalHitsCount =
    groupedHits.products.length +
    groupedHits.stores.length +
    groupedHits.categories.length +
    groupedHits.ai.length

  const resetSearch = () => {
    setQuery('')
    setDebounced('')
    setServerProducts([])
    setAiPhrases([])
    setAiFloors([])
  }

  const onHitPress = (h: LocalHit) => {
    Keyboard.dismiss()
    resetSearch()
    onClose()
    requestAnimationFrame(() => {
      if (h.type === 'product') {
        router.push(`/product/${h.id}` as any)
        return
      }
      if (h.type === 'store') {
        router.push(`/store/${h.id}` as any)
        return
      }
      router.push({
        pathname: '/(tabs)/search',
        params: { q: h.label },
      } as any)
    })
  }

  const submitSearch = () => {
    const term = query.trim()
    if (!term) return
    Keyboard.dismiss()
    resetSearch()
    onClose()
    requestAnimationFrame(() => {
      router.push({
        pathname: '/(tabs)/search',
        params: { q: term },
      } as any)
    })
  }

  // Smooth open / close
  useEffect(() => {
    if (visible) {
      setMounted(true)
      setContentKey((k) => k + 1)
      progress.setValue(0)
      contentFade.setValue(0)

      Animated.parallel([
        Animated.timing(progress, {
          toValue: 1,
          duration: OPEN_MS,
          easing: EASE_LUXURY,
          useNativeDriver: true,
        }),
        Animated.timing(contentFade, {
          toValue: 1,
          duration: OPEN_MS * 0.85,
          delay: 80,
          easing: EASE_LUXURY,
          useNativeDriver: true,
        }),
      ]).start()
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 0,
          duration: CLOSE_MS,
          easing: EASE_LUXURY,
          useNativeDriver: true,
        }),
        Animated.timing(contentFade, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setMounted(false)
          resetSearch()
        }
      })
    }
  }, [visible])

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-windowW * 0.96, 0],
  })

  const isActive = (href?: string) => {
    if (!href) return false
    if (href === '/(tabs)' || href === '/(tabs)/') {
      return (
        pathname === '/' ||
        pathname === '/(tabs)' ||
        pathname === '/(tabs)/' ||
        pathname.endsWith('/index')
      )
    }
    const key = href.split('/').filter(Boolean).pop() || ''
    return typeof pathname === 'string' && pathname.includes(key)
  }

  const activeMap = useMemo(() => {
    const map: Record<string, boolean> = {}
    SECTIONS.forEach((s) =>
      s.items.forEach((item) => {
        // Showroom room tiles are scroll targets, not separate routes —
        // don't mark them active just because we're on the home page
        if (SHOWROOM_ID_TO_ROOM[item.id]) {
          map[item.id] = false
        } else {
          map[item.id] = isActive(item.href)
        }
      })
    )
    if (
      pathname === '/' ||
      pathname === '/(tabs)' ||
      pathname === '/(tabs)/' ||
      pathname?.endsWith('/index')
    ) {
      map.home = true
    }
    return map
  }, [pathname])

const navigate = (href?: string, itemId?: string) => {
  // Showroom room tiles → scroll instead of route
  if (itemId && SHOWROOM_ID_TO_ROOM[itemId]) {
    onClose()
    requestAnimationFrame(() => {
      onScrollToRoom?.(SHOWROOM_ID_TO_ROOM[itemId])
    })
    return
  }

  onClose()

  // Explore the Mall tiles
  if (itemId === 'categories') {
    requestAnimationFrame(() => {
      router.push({ pathname: '/shop', params: { mode: 'categories' } } as any)
    })
    return
  }
  if (itemId === 'new') {
    requestAnimationFrame(() => {
      router.push({ pathname: '/shop', params: { mode: 'new' } } as any)
    })
    return
  }
  if (itemId === 'trending') {
    requestAnimationFrame(() => {
      router.push({ pathname: '/shop', params: { mode: 'trending' } } as any)
    })
    return
  }
  if (itemId === 'stores') {
    requestAnimationFrame(() => {
      router.push({ pathname: '/shop', params: { mode: 'stores' } } as any)
    })
    return
  }

  // Everything else
  if (!href) return
  requestAnimationFrame(() => {
    try {
      router.push(href as any)
    } catch {}
  })
}

  const handleLogout = async () => {
    onClose()
    try {
      await signOut()
      router.replace('/sign-in' as any)
    } catch {}
  }

  const handleSellerCta = () => {
    onClose()
    requestAnimationFrame(() => {
      if (isSeller) router.push('/seller' as any)
      else router.push('/seller-register' as any)
    })
  }

  if (!mounted) return null

  let tileIndex = 0

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: BG,
            transform: [{ translateX }],
            paddingTop: topInset,
            paddingBottom: bottomInset,
          }}
        >
          {/* Close */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              paddingHorizontal: 16,
              minHeight: 44,
            }}
          >
            <Pressable
              onPress={onClose}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: SURFACE_2,
                borderWidth: 1,
                borderColor: LINE,
              }}
              hitSlop={12}
            >
              <Ionicons name="close" size={20} color={TEXT} />
            </Pressable>
          </View>

          {/* Logo */}
          <Animated.View
            style={{
              paddingHorizontal: 20,
              alignItems: 'center',
              minHeight: 64,
              opacity: contentFade,
            }}
          >
            <Image
              source={require('../assets/logo-2.png')}
              style={{ width: 190, height: 140 }}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Search Bar */}
          <Animated.View
            style={{
              marginHorizontal: 16,
              marginBottom: 16,
              marginTop: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: SURFACE,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: query.length > 0 ? GREEN : LINE,
              paddingHorizontal: 14,
              height: 50,
              opacity: contentFade,
            }}
          >
            <Ionicons name="search" size={18} color={query.length > 0 ? GREEN : TEXT_MUTED} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => {
                Keyboard.dismiss()
              }}
              placeholder="Search products, stores, categories…"
              placeholderTextColor={TEXT_MUTED}
              style={{
                flex: 1,
                color: TEXT,
                fontSize: 15,
                fontWeight: '500',
                paddingVertical: 0,
              }}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => {
                  resetSearch()
                  inputRef.current?.focus()
                }}
                hitSlop={10}
              >
                <Ionicons name="close-circle" size={18} color={TEXT_MUTED} />
              </Pressable>
            )}
          </Animated.View>

          <ScrollView
            key={contentKey}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => Keyboard.dismiss()}
          >
            {isSearching ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                {searchLoading && totalHitsCount === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <Text style={{ color: TEXT_DIM, fontSize: 14 }}>Searching Plazore…</Text>
                  </View>
                ) : totalHitsCount === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <Ionicons name="search-outline" size={30} color={TEXT_MUTED} />
                    <Text style={{ color: TEXT_DIM, fontSize: 14, marginTop: 10 }}>
                      No results for "{query.trim()}"
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* PRODUCTS */}
                    {groupedHits.products.length > 0 && (
                      <View style={{ marginBottom: 24 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginBottom: 14,
                          }}
                        >
                          <Text style={[styles.sectionHeader, { paddingHorizontal: 0 }]}>
                            PRODUCTS
                          </Text>
                          <Text style={{ color: TEXT_MUTED, fontSize: 12 }}>
                            {groupedHits.products.length}
                          </Text>
                        </View>

                        {groupedHits.products.map((h, i) => {
                          if (h.type !== 'product') return null
                          const priceText = formatProduct(h.price, h.region)

                          return (
                            <FadeSlideIn key={h.id} index={i} delayBase={80} duration={650}>
                              <Pressable
                                onPress={() => onHitPress(h)}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  marginBottom: 16,
                                }}
                              >
                                <View
                                  style={{
                                    width: 70,
                                    height: 70,
                                    borderRadius: 10,
                                    backgroundColor: SURFACE_2,
                                    overflow: 'hidden',
                                    marginRight: 14,
                                  }}
                                >
                                  {h.image ? (
                                    <ExpoImage
                                      source={{ uri: h.image }}
                                      style={{ width: 70, height: 70 }}
                                      contentFit="cover"
                                    />
                                  ) : (
                                    <View
                                      style={{
                                        flex: 1,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <Ionicons
                                        name="image-outline"
                                        size={22}
                                        color={TEXT_MUTED}
                                      />
                                    </View>
                                  )}
                                </View>

                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={{ color: TEXT, fontSize: 15, fontWeight: '500' }}
                                    numberOfLines={2}
                                  >
                                    {h.label}
                                  </Text>
                                  <Text
                                    style={{
                                      color: GREEN,
                                      fontSize: 14,
                                      fontWeight: '600',
                                      marginTop: 4,
                                    }}
                                  >
                                    {priceText}
                                  </Text>
                                </View>
                              </Pressable>
                            </FadeSlideIn>
                          )
                        })}
                      </View>
                    )}

                    {/* STORES */}
                    {groupedHits.stores.length > 0 && (
                      <View style={{ marginBottom: 16 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginBottom: 14,
                          }}
                        >
                          <Text style={[styles.sectionHeader, { paddingHorizontal: 0 }]}>
                            STORES
                          </Text>
                          <Text style={{ color: TEXT_MUTED, fontSize: 12 }}>
                            {groupedHits.stores.length}
                          </Text>
                        </View>

                        {groupedHits.stores.map((h, i) => {
                          if (h.type !== 'store') return null
                          return (
                            <FadeSlideIn key={h.id} index={i} delayBase={60} duration={600}>
                              <Pressable
                                onPress={() => onHitPress(h)}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  marginBottom: 14,
                                }}
                              >
                                <View
                                  style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 10,
                                    backgroundColor: SURFACE_2,
                                    overflow: 'hidden',
                                    marginRight: 14,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {h.logo ? (
                                    <ExpoImage
                                      source={{ uri: h.logo }}
                                      style={{ width: 56, height: 56 }}
                                      contentFit="cover"
                                    />
                                  ) : (
                                    <Ionicons name="storefront" size={20} color={BLUE} />
                                  )}
                                </View>

                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={{ color: TEXT, fontSize: 15, fontWeight: '500' }}
                                    numberOfLines={1}
                                  >
                                    {h.label}
                                  </Text>
                                  <Text
                                    style={{
                                      color: BLUE,
                                      fontSize: 12,
                                      marginTop: 3,
                                      fontWeight: '600',
                                    }}
                                  >
                                    Official Storefront
                                  </Text>
                                </View>
                              </Pressable>
                            </FadeSlideIn>
                          )
                        })}
                      </View>
                    )}
                  </>
                )}
              </View>
            ) : (
              <>
                {/* Seller CTA */}
                <FadeSlideIn index={0} delayBase={100}>
                  <Pressable
                    onPress={handleSellerCta}
                    style={{
                      marginHorizontal: 16,
                      marginBottom: 22,
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: SURFACE,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: 'rgba(0,229,117,0.3)',
                      paddingVertical: 14,
                      paddingHorizontal: 14,
                      gap: 12,
                      overflow: 'hidden',
                    }}
                  >
                    <LinearGradient
                      colors={['rgba(0,229,117,0.12)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                      pointerEvents="none"
                    />
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0,229,117,0.14)',
                        borderWidth: 1,
                        borderColor: 'rgba(0,229,117,0.35)',
                      }}
                    >
                      <Ionicons
                        name={isSeller ? 'storefront' : 'storefront-outline'}
                        size={22}
                        color={GREEN}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: TEXT, fontSize: 15, fontWeight: '700' }}>
                        {isSeller ? 'Seller Dashboard' : 'Open a Store'}
                      </Text>
                      <Text style={{ color: TEXT_DIM, fontSize: 12, marginTop: 2 }}>
                        {isSeller
                          ? 'Manage inventory, orders & floor'
                          : 'Become an official seller on Plazore'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
                  </Pressable>
                </FadeSlideIn>

                {slots?.profile && (
                  <View style={{ marginBottom: 12, paddingHorizontal: 16 }}>{slots.profile}</View>
                )}
                {slots?.recommendations && (
                  <View style={{ marginBottom: 12, paddingHorizontal: 16 }}>
                    {slots.recommendations}
                  </View>
                )}
                {slots?.recentlyViewed && (
                  <View style={{ marginBottom: 12, paddingHorizontal: 16 }}>
                    {slots.recentlyViewed}
                  </View>
                )}
                {slots?.sellerShortcuts && (
                  <View style={{ marginBottom: 12, paddingHorizontal: 16 }}>
                    {slots.sellerShortcuts}
                  </View>
                )}

                {SECTIONS.map((section) => (
                  <View key={section.id} style={{ marginBottom: 24 }}>
                    <Text style={styles.sectionHeader}>{section.title}</Text>
                    <View
                      style={{
                        paddingHorizontal: 16,
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      {section.items.map((item) => {
                        const idx = tileIndex++
                        return (
                          <MallTile
                            key={item.id}
                            item={item}
                            active={!!activeMap[item.id]}
                            onPress={() => navigate(item.href, item.id)}
                            width={tileW}
                            height={tileH}
                            index={idx}
                          />
                        )
                      })}
                    </View>
                  </View>
                ))}

                {slots?.musicSettings && (
                  <View style={{ marginTop: 4, marginBottom: 12, paddingHorizontal: 16 }}>
                    {slots.musicSettings}
                  </View>
                )}

                {/* Profile footer */}
                <FadeSlideIn index={12} delayBase={160}>
                  <View
                    style={{
                      marginHorizontal: 16,
                      marginBottom: 8,
                      backgroundColor: SURFACE,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: LINE,
                      padding: 14,
                      gap: 12,
                    }}
                  >
                    <Pressable
                      onPress={() => navigate('/(tabs)/profile')}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                    >
                      {user?.imageUrl ? (
                        <Image
                          source={{ uri: user.imageUrl }}
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            borderWidth: 1.5,
                            borderColor: GREEN,
                          }}
                        />
                      ) : (
                        <View
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            backgroundColor: SURFACE_2,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1.5,
                            borderColor: 'rgba(0,229,117,0.3)',
                          }}
                        >
                          <Ionicons name="person" size={18} color={TEXT_DIM} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ color: TEXT, fontSize: 14, fontWeight: '700' }}
                          numberOfLines={1}
                        >
                          {user?.firstName || user?.username || 'Guest'}
                        </Text>
                        <Text
                          style={{ color: TEXT_MUTED, fontSize: 11, marginTop: 1 }}
                          numberOfLines={1}
                        >
                          {isSignedIn ? 'View profile details' : 'Sign in to sync saved items'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={15} color={TEXT_MUTED} />
                    </Pressable>

                    {isSignedIn && (
                      <Pressable
                        onPress={handleLogout}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          alignSelf: 'flex-start',
                          paddingVertical: 7,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: LINE,
                          backgroundColor: 'rgba(255,255,255,0.03)',
                        }}
                      >
                        <Ionicons name="log-out-outline" size={16} color={TEXT_DIM} />
                        <Text style={{ color: TEXT_DIM, fontSize: 12, fontWeight: '600' }}>
                          Log out
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </FadeSlideIn>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  sectionHeader: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
})