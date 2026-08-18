// ============================================================
// FILE: client/components/PlazoreNavigationHub.tsx
// ============================================================

import api from '@/constants/api'
import { CATEGORY_LIST } from '@/constants/productCatalog'
import { Product } from '@/constants/types'
import { useMarketplace } from '@/context/MarketplaceContext'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuth, useClerk, useUser } from '@clerk/clerk-expo'
import { Image as ExpoImage } from 'expo-image'
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

/* ── Plazore Lounge Palette ── */
const BG = '#050508'
const SURFACE = '#0B0C12'
const SURFACE_2 = '#11131C'
const TEXT = '#F5F7FA'
const TEXT_DIM = 'rgba(245,247,250,0.65)'
const TEXT_MUTED = 'rgba(245,247,250,0.35)'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const LINE = 'rgba(255,255,255,0.08)'

const OPEN_MS = 900
const CLOSE_MS = 480
const EASE_LUXURY = Easing.bezier(0.22, 1, 0.36, 1)
const DEBOUNCE = 280

const TILE_COLORS: Record<string, { bg: string; accent: string; glow: string }> = {
  home:             { bg: '#0A1C14', accent: '#00E575', glow: 'rgba(0,229,117,0.22)' },
  cart:             { bg: '#0D172A', accent: '#3B82F6', glow: 'rgba(59,130,246,0.22)' },
  saved_stores:     { bg: '#1A160E', accent: '#D4A853', glow: 'rgba(212,168,83,0.22)' },
  profile:          { bg: '#1A0E2A', accent: '#A78BFA', glow: 'rgba(167,139,250,0.22)' },
  showroom_horizon: { bg: '#091520', accent: '#38BDF8', glow: 'rgba(56,189,248,0.22)' },
  showroom_chamber: { bg: '#0A1818', accent: '#2DD4BF', glow: 'rgba(45,212,191,0.22)' },
  showroom_signal:  { bg: '#1E0E28', accent: '#C084FC', glow: 'rgba(192,132,252,0.22)' },
  showroom_locale:  { bg: '#1E1710', accent: '#FB923C', glow: 'rgba(251,146,60,0.22)' },
  showroom_atelier: { bg: '#1A0F14', accent: '#F472B6', glow: 'rgba(244,114,182,0.22)' },
  categories:       { bg: '#0B1E28', accent: '#22D3EE', glow: 'rgba(34,211,238,0.22)' },
  new:              { bg: '#251A0A', accent: '#FBBF24', glow: 'rgba(251,191,36,0.22)' },
  trending:         { bg: '#28120A', accent: '#FB923C', glow: 'rgba(251,146,60,0.22)' },
  stores:           { bg: '#121430', accent: '#6366F1', glow: 'rgba(99,102,241,0.22)' },
  help:             { bg: '#0D2623', accent: '#2DD4BF', glow: 'rgba(45,212,191,0.22)' },
  contact:          { bg: '#181230', accent: '#818CF8', glow: 'rgba(129,140,248,0.22)' },
  about:            { bg: '#0C1C18', accent: '#34D399', glow: 'rgba(52,211,153,0.22)' },
}

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
      { id: 'saved_stores', label: 'Saved Stores', subtitle: 'Your floors', icon: 'bookmark', href: '/saved-stores' },
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
            toValue: 0.97,
            duration: 100,
            useNativeDriver: true,
          }).start()
        }
        onPressOut={() =>
          Animated.timing(scale, {
            toValue: 1,
            duration: 200,
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
            borderWidth: 1,
            borderColor: active ? palette.accent : LINE,
            padding: 14,
            justifyContent: 'space-between',
            overflow: 'hidden',
            transform: [{ scale }],
          }}
        >
          {/* Soft glow orb */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 90,
              height: 90,
              backgroundColor: palette.glow,
              opacity: active ? 0.5 : 0.18,
            }}
          />

          {/* Active edge bar */}
          {active && (
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                backgroundColor: palette.accent,
              }}
            />
          )}

          <View
            style={{
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${palette.accent}14`,
              borderWidth: 1,
              borderColor: `${palette.accent}30`,
            }}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={active ? palette.accent : TEXT}
            />
          </View>

          <View>
            <Text
              style={{
                color: active ? palette.accent : TEXT,
                fontSize: 13,
                fontWeight: '700',
                letterSpacing: -0.2,
              }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            {!!item.subtitle && (
              <Text
                style={{ color: TEXT_MUTED, fontSize: 11, marginTop: 3 }}
                numberOfLines={1}
              >
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
  const { isSignedIn, getToken } = useAuth()

  const role = (user?.publicMetadata?.role as string) || 'buyer'
  const isSeller = role === 'seller' || role === 'admin'

  const progress = useRef(new Animated.Value(0)).current
  const contentFade = useRef(new Animated.Value(0)).current
  const logoOpacity = useRef(new Animated.Value(0)).current
  const loungeOpacity = useRef(new Animated.Value(1)).current
  const [mounted, setMounted] = useState(visible)
  const [contentKey, setContentKey] = useState(0)
  const [logoLoaded, setLogoLoaded] = useState(false)
  const [storeLogo, setStoreLogo] = useState<string | null>(null)
  const inputRef = useRef<TextInput>(null)
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [serverProducts, setServerProducts] = useState<any[]>([])
  const [aiPhrases, setAiPhrases] = useState<string[]>([])
  const [aiFloors, setAiFloors] = useState<string[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [allProducts, setAllProducts] = useState<Product[]>([])

  const pad = 16
  const gap = 10
  const tileW = Math.floor((windowW - pad * 2 - gap) / 2)
  const tileH = Math.round(tileW * 0.9)

  const topInset = Math.max(insets.top, StatusBar.currentHeight ?? 0, 12)
  const bottomInset = Math.max(insets.bottom, 12)
  const isSearching = query.trim().length >= 1

  useEffect(() => {
    if (logoLoaded) {
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 420,
          easing: EASE_LUXURY,
          useNativeDriver: true,
        }),
        Animated.timing(loungeOpacity, {
          toValue: 0,
          duration: 320,
          easing: EASE_LUXURY,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      logoOpacity.setValue(0)
      loungeOpacity.setValue(1)
    }
  }, [logoLoaded])

  useEffect(() => {
    if (!visible || !isSeller || !isSignedIn) {
      setStoreLogo(null)
      return
    }

    let alive = true

    ;(async () => {
      try {
        const token = await getTokenRef.current()
        if (!token) return

        const endpoints = ['/seller/store', '/seller/me', '/users/me', '/users/profile']

        for (const ep of endpoints) {
          try {
            const res = await api.get(ep, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 10000,
            })
            const data = res.data?.data || res.data
            const logo =
              data?.storeLogo || data?.store?.storeLogo || data?.logo || null
            if (logo && alive) {
              setStoreLogo(String(logo))
              return
            }
          } catch {
            // try next
          }
        }
        if (alive) setStoreLogo(null)
      } catch {
        if (alive) setStoreLogo(null)
      }
    })()

    return () => {
      alive = false
    }
  }, [visible, isSeller, isSignedIn])

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

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE)
    return () => clearTimeout(t)
  }, [query])

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

  useEffect(() => {
    if (visible) {
      setMounted(true)
      setContentKey((k) => k + 1)
      setLogoLoaded(false)
      logoOpacity.setValue(0)
      loungeOpacity.setValue(1)
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
          setLogoLoaded(false)
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
    if (itemId && SHOWROOM_ID_TO_ROOM[itemId]) {
      onClose()
      requestAnimationFrame(() => {
        onScrollToRoom?.(SHOWROOM_ID_TO_ROOM[itemId])
      })
      return
    }

    onClose()

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
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: BG,
            transform: [{ translateX }],
            paddingTop: topInset,
            paddingBottom: bottomInset,
          }}
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <Text style={styles.topLabel}>NAVIGATION</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Ionicons name="close" size={18} color={TEXT} />
            </Pressable>
          </View>

          {/* Logo / LOUNGE */}
          <Animated.View style={[styles.logoWrap, { opacity: contentFade }]}>
            <Animated.View
              pointerEvents="none"
              style={[styles.loungeFallback, { opacity: loungeOpacity }]}
            >
              <Text style={styles.loungeText}>LOUNGE</Text>
            </Animated.View>

            <Animated.View style={{ opacity: logoOpacity }}>
              <Image
                source={require('../assets/logo-2.png')}
                style={{ width: 132, height: 80 }}
                resizeMode="contain"
                onLoad={() => setLogoLoaded(true)}
                onError={() => setLogoLoaded(false)}
              />
            </Animated.View>
          </Animated.View>

          {/* Search */}
          <Animated.View
            style={[
              styles.searchBar,
              {
                borderColor: query.length > 0 ? GREEN : LINE,
                opacity: contentFade,
              },
            ]}
          >
            <Ionicons
              name="search"
              size={17}
              color={query.length > 0 ? GREEN : TEXT_MUTED}
            />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => Keyboard.dismiss()}
              placeholder="Search products, stores, categories…"
              placeholderTextColor={TEXT_MUTED}
              style={styles.searchInput}
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
                <Ionicons name="close-circle" size={17} color={TEXT_MUTED} />
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
                  <View style={styles.emptySearch}>
                    <Text style={{ color: TEXT_DIM, fontSize: 14 }}>
                      Searching Plazore…
                    </Text>
                  </View>
                ) : totalHitsCount === 0 ? (
                  <View style={styles.emptySearch}>
                    <Ionicons name="search-outline" size={28} color={TEXT_MUTED} />
                    <Text style={styles.emptySearchText}>
                      No results for “{query.trim()}”
                    </Text>
                  </View>
                ) : (
                  <>
                    {groupedHits.products.length > 0 && (
                      <View style={{ marginBottom: 22 }}>
                        <View style={styles.resultHeader}>
                          <Text style={styles.sectionHeaderInline}>PRODUCTS</Text>
                          <Text style={styles.resultCount}>
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
                                style={styles.resultRow}
                              >
                                <View style={styles.resultThumb}>
                                  {h.image ? (
                                    <ExpoImage
                                      source={{ uri: h.image }}
                                      style={{ width: 64, height: 64 }}
                                      contentFit="cover"
                                    />
                                  ) : (
                                    <Ionicons
                                      name="image-outline"
                                      size={20}
                                      color={TEXT_MUTED}
                                    />
                                  )}
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={styles.resultTitle} numberOfLines={2}>
                                    {h.label}
                                  </Text>
                                  <Text style={styles.resultPrice}>{priceText}</Text>
                                </View>
                              </Pressable>
                            </FadeSlideIn>
                          )
                        })}
                      </View>
                    )}

                    {groupedHits.stores.length > 0 && (
                      <View style={{ marginBottom: 16 }}>
                        <View style={styles.resultHeader}>
                          <Text style={styles.sectionHeaderInline}>STORES</Text>
                          <Text style={styles.resultCount}>
                            {groupedHits.stores.length}
                          </Text>
                        </View>

                        {groupedHits.stores.map((h, i) => {
                          if (h.type !== 'store') return null
                          return (
                            <FadeSlideIn key={h.id} index={i} delayBase={60} duration={600}>
                              <Pressable
                                onPress={() => onHitPress(h)}
                                style={styles.resultRow}
                              >
                                <View style={styles.resultThumb}>
                                  {h.logo ? (
                                    <ExpoImage
                                      source={{ uri: h.logo }}
                                      style={{ width: 64, height: 64 }}
                                      contentFit="cover"
                                    />
                                  ) : (
                                    <Ionicons name="storefront" size={20} color={BLUE} />
                                  )}
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={styles.resultTitle} numberOfLines={1}>
                                    {h.label}
                                  </Text>
                                  <Text style={styles.resultStoreMeta}>
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
  <Pressable onPress={handleSellerCta}>
    {isSeller ? (
      <LinearGradient
        colors={[GREEN, BLUE]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.sellerCtaActive}
      >
        <View style={styles.sellerIconActive}>
          {storeLogo ? (
            <Image
              source={{ uri: storeLogo }}
              style={{ width: 42, height: 42 }}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="storefront" size={18} color={BG} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sellerTitleActive}>Storefront</Text>
          <Text style={styles.sellerSubActive}>
            Products, orders & chats
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color={BG} />
      </LinearGradient>
    ) : (
      <View style={styles.sellerCta}>
        <View style={styles.sellerIcon}>
          <Ionicons name="storefront-outline" size={20} color={TEXT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sellerTitle}>Open a Store</Text>
          <Text style={styles.sellerSub}>
            Become an official seller on Plazore
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
      </View>
    )}
  </Pressable>
</FadeSlideIn>

                {slots?.profile && (
                  <View style={styles.slotWrap}>{slots.profile}</View>
                )}
                {slots?.recommendations && (
                  <View style={styles.slotWrap}>{slots.recommendations}</View>
                )}
                {slots?.recentlyViewed && (
                  <View style={styles.slotWrap}>{slots.recentlyViewed}</View>
                )}
                {slots?.sellerShortcuts && (
                  <View style={styles.slotWrap}>{slots.sellerShortcuts}</View>
                )}

                {SECTIONS.map((section) => (
                  <View key={section.id} style={{ marginBottom: 22 }}>
                    <Text style={styles.sectionHeader}>{section.title}</Text>
                    <View style={styles.tileGrid}>
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
                  <View style={[styles.slotWrap, { marginTop: 4 }]}>
                    {slots.musicSettings}
                  </View>
                )}

                {/* Profile footer */}
                <FadeSlideIn index={12} delayBase={160}>
                  <View style={styles.footerCard}>
                    <Pressable
                      onPress={() => navigate('/(tabs)/profile')}
                      style={styles.footerProfile}
                    >
                      {user?.imageUrl ? (
                        <Image
                          source={{ uri: user.imageUrl }}
                          style={styles.footerAvatar}
                        />
                      ) : (
                        <View style={styles.footerAvatarFallback}>
                          <Ionicons name="person" size={16} color={TEXT_DIM} />
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.footerName} numberOfLines={1}>
                          {user?.firstName || user?.username || 'Guest'}
                        </Text>
                        <Text style={styles.footerMeta} numberOfLines={1}>
                          {isSignedIn
                            ? 'View profile details'
                            : 'Sign in to sync saved items'}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={TEXT_MUTED}
                      />
                    </Pressable>

                    {isSignedIn && (
                      <Pressable onPress={handleLogout} style={styles.logoutBtn}>
                        <Ionicons
                          name="log-out-outline"
                          size={15}
                          color={TEXT_DIM}
                        />
                        <Text style={styles.logoutText}>Log out</Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 44,
    marginBottom: 2,
  },
  topLabel: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE_2,
    borderWidth: 1,
    borderColor: LINE,
  },

  logoWrap: {
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 68,
    marginBottom: 6,
  },
  loungeFallback: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loungeText: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 7,
  },

  searchBar: {
    marginHorizontal: 16,
    marginBottom: 14,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SURFACE,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: TEXT,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },

  sectionHeader: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  sectionHeaderInline: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  tileGrid: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  sellerCta: {
  marginHorizontal: 16,
  marginBottom: 20,
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: SURFACE,
  borderWidth: 1,
  borderColor: LINE,
  paddingVertical: 13,
  paddingHorizontal: 13,
  gap: 12,
},
sellerCtaActive: {
  marginHorizontal: 16,
  marginBottom: 20,
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 13,
  paddingHorizontal: 13,
  gap: 12,
},
sellerIcon: {
  width: 42,
  height: 42,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: SURFACE_2,
},
sellerIconActive: {
  width: 42,
  height: 42,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(9,11,15,0.12)',
  overflow: 'hidden',
},
sellerTitle: {
  color: TEXT,
  fontSize: 14,
  fontWeight: '700',
},
sellerSub: {
  color: TEXT_DIM,
  fontSize: 12,
  marginTop: 2,
},
sellerTitleActive: {
  color: BG,
  fontSize: 14,
  fontWeight: '700',
},
sellerSubActive: {
  color: 'rgba(9,11,15,0.65)',
  fontSize: 12,
  marginTop: 2,
},

  slotWrap: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },

  emptySearch: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptySearchText: {
    color: TEXT_DIM,
    fontSize: 14,
    marginTop: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultCount: {
    color: TEXT_MUTED,
    fontSize: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  resultThumb: {
    width: 64,
    height: 64,
    backgroundColor: SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  resultTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '500',
  },
  resultPrice: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  resultStoreMeta: {
    color: BLUE,
    fontSize: 12,
    marginTop: 3,
    fontWeight: '600',
  },

  footerCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    padding: 14,
    gap: 12,
  },
  footerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerAvatar: {
    width: 40,
    height: 40,
    borderWidth: 1.5,
    borderColor: GREEN,
  },
  footerAvatarFallback: {
    width: 40,
    height: 40,
    backgroundColor: SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,229,117,0.3)',
  },
  footerName: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  footerMeta: {
    color: TEXT_MUTED,
    fontSize: 11,
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  logoutText: {
    color: TEXT_DIM,
    fontSize: 12,
    fontWeight: '600',
  },
})