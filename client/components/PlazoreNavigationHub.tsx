/**
 * Plazore Navigation Hub (Lounge) — mobile
 * Layout aligned with web lounge; HubLogo (lounge image) kept as-is.
 */
import api from '@/constants/api'
import { CATEGORY_LIST } from '@/constants/productCatalog'
import { Product } from '@/constants/types'
import { useCart } from '@/context/CartContext'
import { useMarketplace } from '@/context/MarketplaceContext'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, useClerk, useUser } from '@clerk/clerk-expo'
import { Image as ExpoImage } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { usePathname, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  Modal,
  Platform,
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

const BG = '#050508'
const SURFACE = '#0B0C12'
const SURFACE_2 = '#11131C'
const TEXT = '#F5F7FA'
const TEXT_DIM = 'rgba(245,247,250,0.65)'
const TEXT_MUTED = 'rgba(245,247,250,0.35)'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const LINE = 'rgba(255,255,255,0.08)'
const STATUS_BG = '#090B0F'

/** Keep status bar solid dark — never transparent (avoids fight with title bar) */
function applySolidDarkStatusBar() {
  StatusBar.setBarStyle('light-content', true)
  StatusBar.setHidden(false, 'fade')
  if (Platform.OS === 'android') {
    StatusBar.setBackgroundColor(STATUS_BG, true)
    StatusBar.setTranslucent(false)
  }
}


const OPEN_MS = 920
const CLOSE_MS = 520
const EASE = Easing.bezier(0.16, 1, 0.3, 1)
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1)
const DEBOUNCE = 280
const CART_SLIDE_MS = 3200

const SELL_POSTER =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80'

const CATEGORY_IMAGES: Record<string, string> = {
  Electronics: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=300&fit=crop',
  'Phones & Accessories': 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=300&fit=crop',
  Computers: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop',
  Fashion: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=300&fit=crop',
  'Beauty & Personal Care': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=300&fit=crop',
  'Home & Living': 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400&h=300&fit=crop',
  Furniture: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop',
  'Kitchen & Dining': 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400&h=300&fit=crop',
  Groceries: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=300&fit=crop',
  Health: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400&h=300&fit=crop',
  'Sports & Outdoors': 'https://images.unsplash.com/photo-1461896836934-ffe607ba6851?w=400&h=300&fit=crop',
  Automotive: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&h=300&fit=crop',
  'Toys & Games': 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=400&h=300&fit=crop',
  'Jewelry & Watches': 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=300&fit=crop',
}

const FALLBACK_CAT =
  'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=300&fit=crop'

const TILE_COLORS: Record<string, { bg: string; accent: string; glow: string }> = {
  home: { bg: '#0A1C14', accent: '#00E575', glow: 'rgba(0,229,117,0.25)' },
  browse: { bg: '#0B1E28', accent: '#22D3EE', glow: 'rgba(34,211,238,0.22)' },
  cart: { bg: '#0D172A', accent: '#3B82F6', glow: 'rgba(59,130,246,0.28)' },
  wishlist: { bg: '#1A0F14', accent: '#F472B6', glow: 'rgba(244,114,182,0.25)' },
  saved_stores: { bg: '#1A160E', accent: '#D4A853', glow: 'rgba(212,168,83,0.25)' },
  profile: { bg: '#1A0E2A', accent: '#A78BFA', glow: 'rgba(167,139,250,0.25)' },
  messages: { bg: '#0E1A22', accent: '#38BDF8', glow: 'rgba(56,189,248,0.22)' },
  categories: { bg: '#0B1E28', accent: '#22D3EE', glow: 'rgba(34,211,238,0.22)' },
  new: { bg: '#251A0A', accent: '#FBBF24', glow: 'rgba(251,191,36,0.25)' },
  trending: { bg: '#28120A', accent: '#FB923C', glow: 'rgba(251,146,60,0.25)' },
  stores: { bg: '#121430', accent: '#6366F1', glow: 'rgba(99,102,241,0.25)' },
  help: { bg: '#0D2623', accent: '#2DD4BF', glow: 'rgba(45,212,191,0.22)' },
  contact: { bg: '#181230', accent: '#818CF8', glow: 'rgba(129,140,248,0.22)' },
  about: { bg: '#0C1C18', accent: '#34D399', glow: 'rgba(52,211,153,0.22)' },
  orders: { bg: '#0F1A24', accent: '#60A5FA', glow: 'rgba(96,165,250,0.22)' },
}

type NavItem = {
  id: string
  label: string
  subtitle?: string
  icon: keyof typeof Ionicons.glyphMap
  href?: string
}

type NavSection = { id: string; title: string; items: NavItem[] }

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
  | { type: 'store'; label: string; id: string; logo?: string }
  | { type: 'category' | 'brand' | 'ai'; label: string; id?: string }

type SellerInfo = {
  _id: string
  name?: string
  storeName?: string
  storeLogo?: string
}

export type PlazoreNavigationHubProps = {
  visible: boolean
  onClose: () => void
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
    id: 'floors',
    title: 'Main Hubs',
    items: [
      { id: 'home', label: 'Mall', subtitle: 'Home showroom', icon: 'storefront', href: '/(tabs)' },
      { id: 'browse', label: 'Browse', subtitle: 'Search the mall', icon: 'search', href: '/(tabs)/search' },
      { id: 'cart', label: 'Cart', subtitle: 'Checkout bag', icon: 'bag-handle', href: '/(tabs)/cart' },
      { id: 'wishlist', label: 'Wishlist', subtitle: 'Saved products', icon: 'heart', href: '/(tabs)/favorites' },
    ],
  },
  {
    id: 'account',
    title: 'Your space',
    items: [
      { id: 'profile', label: 'Profile', subtitle: 'Account & prefs', icon: 'person', href: '/(tabs)/profile' },
      { id: 'orders', label: 'Orders', subtitle: 'Track deliveries', icon: 'cube-outline', href: '/orders' },
      { id: 'saved_stores', label: 'Saved stores', subtitle: 'Followed brands', icon: 'bookmark', href: '/saved-stores' },
      { id: 'messages', label: 'Messages', subtitle: 'Product chats', icon: 'chatbubble', href: '/messages' },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    items: [
      { id: 'help', label: 'Help', subtitle: 'Guides & FAQs', icon: 'help-buoy', href: '/help' },
      { id: 'contact', label: 'Contact', subtitle: 'Reach Plazore', icon: 'chatbubbles', href: '/contact' },
      { id: 'about', label: 'About', subtitle: 'The Digital Mall', icon: 'information-circle', href: '/settings/about' },
    ],
  },
]

const EXPLORE_CHIPS = [
  { id: 'categories', label: 'Categories', mode: 'categories' },
  { id: 'new', label: 'New', mode: 'new' },
  { id: 'trending', label: 'Trending', mode: 'trending' },
  { id: 'stores', label: 'Stores', mode: 'stores' },
]

function FadeSlideIn({
  index,
  children,
  delayBase = 0,
  duration = 480,
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
      delay: delayBase + Math.min(index, 8) * 28,
      easing: EASE,
      useNativeDriver: true,
    }).start()
  }, [anim, delayBase, duration, index])

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  )
}

function CartImageRail({
  uris,
  width,
  height,
}: {
  uris: string[]
  width: number
  height: number
}) {
  const panelW = Math.round(width * 0.42)
  const slide = useRef(new Animated.Value(0)).current
  const indexRef = useRef(0)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    indexRef.current = 0
    setIndex(0)
    slide.setValue(0)
    if (uris.length < 2) return
    let alive = true
    let timeout: ReturnType<typeof setTimeout> | null = null
    const tick = () => {
      if (!alive) return
      const next = (indexRef.current + 1) % uris.length
      Animated.timing(slide, {
        toValue: -next * panelW,
        duration: 480,
        easing: EASE,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || !alive) return
        indexRef.current = next
        setIndex(next)
        timeout = setTimeout(tick, CART_SLIDE_MS)
      })
    }
    timeout = setTimeout(tick, CART_SLIDE_MS)
    return () => {
      alive = false
      if (timeout) clearTimeout(timeout)
      slide.stopAnimation()
    }
  }, [uris, panelW, slide])

  if (uris.length === 0) return null

  return (
    <View
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: panelW,
        overflow: 'hidden',
      }}
      pointerEvents="none"
    >
      <Animated.View
        style={{
          flexDirection: 'row',
          height,
          width: panelW * uris.length,
          transform: [{ translateX: slide }],
        }}
      >
        {uris.map((uri, i) => (
          <ExpoImage
            key={`${uri}-${i}`}
            source={{ uri }}
            style={{ width: panelW, height }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
          />
        ))}
      </Animated.View>
      <LinearGradient
        colors={['rgba(13,23,42,0.95)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
}

function MallTile({
  item,
  active,
  onPress,
  width,
  height,
  index,
  cartImages,
  cartCount,
}: {
  item: NavItem
  active: boolean
  onPress: () => void
  width: number
  height: number
  index: number
  cartImages?: string[]
  cartCount?: number
}) {
  const scale = useRef(new Animated.Value(1)).current
  const palette = TILE_COLORS[item.id] || {
    bg: SURFACE_2,
    accent: GREEN,
    glow: 'rgba(0,229,117,0.2)',
  }
  const isCart = item.id === 'cart'
  const hasCartMedia = isCart && (cartImages?.length ?? 0) > 0

  return (
    <FadeSlideIn index={index} delayBase={80} duration={500}>
      <Pressable
        onPress={onPress}
        onPressIn={() =>
          Animated.timing(scale, {
            toValue: 0.97,
            duration: 90,
            useNativeDriver: true,
          }).start()
        }
        onPressOut={() =>
          Animated.timing(scale, {
            toValue: 1,
            duration: 160,
            easing: EASE,
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
            padding: 13,
            justifyContent: 'space-between',
            overflow: 'hidden',
            transform: [{ scale }],
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -28,
              right: -28,
              width: 80,
              height: 80,
              backgroundColor: palette.glow,
              opacity: active ? 0.5 : 0.18,
            }}
          />
          {hasCartMedia && (
            <CartImageRail uris={cartImages!} width={width} height={height} />
          )}
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
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View
              style={{
                width: 38,
                height: 38,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${palette.accent}18`,
                borderWidth: 1,
                borderColor: `${palette.accent}35`,
              }}
            >
              <Ionicons
                name={item.icon}
                size={19}
                color={active ? palette.accent : TEXT}
              />
            </View>
            {isCart && (cartCount ?? 0) > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {(cartCount ?? 0) > 99 ? '99+' : cartCount}
                </Text>
              </View>
            )}
          </View>
          <View style={{ maxWidth: hasCartMedia ? '55%' : '100%' }}>
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
                style={{ color: TEXT_MUTED, fontSize: 11, marginTop: 2 }}
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

/** LOUNGE logo — keep as on mobile (user request) */
function HubLogo() {
  const [phase, setPhase] = useState<'loading' | 'ok' | 'fallback'>('loading')
  const logoOp = useRef(new Animated.Value(0)).current
  const textOp = useRef(new Animated.Value(1)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timer.current = setTimeout(() => {
      setPhase((p) => (p === 'loading' ? 'fallback' : p))
    }, 2800)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    if (phase === 'ok') {
      Animated.parallel([
        Animated.timing(logoOp, {
          toValue: 1,
          duration: 360,
          easing: EASE,
          useNativeDriver: true,
        }),
        Animated.timing(textOp, {
          toValue: 0,
          duration: 280,
          easing: EASE,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [phase, logoOp, textOp])

  return (
    <View style={styles.logoWrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.loungeFallback, { opacity: textOp }]}
      >
        <Text style={styles.loungeText}>LOUNGE</Text>
      </Animated.View>
      {phase !== 'fallback' && (
        <Animated.View style={{ opacity: logoOp }}>
          <Image
            source={require('../assets/logo-2.png')}
            style={{ width: 128, height: 76 }}
            resizeMode="contain"
            onLoad={() => {
              if (timer.current) clearTimeout(timer.current)
              setPhase('ok')
            }}
            onError={() => setPhase('fallback')}
          />
        </Animated.View>
      )}
    </View>
  )
}

function PosterCard({
  image,
  kicker,
  title,
  cta,
  onPress,
}: {
  image?: string | null
  kicker: string
  title: string
  cta: string
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={styles.poster}>
      {image ? (
        <ExpoImage
          source={{ uri: image }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: SURFACE_2 }]} />
      )}
      <LinearGradient
        colors={[
          'rgba(5,5,8,0.15)',
          'rgba(5,5,8,0.55)',
          'rgba(5,5,8,0.92)',
        ]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.posterCopy}>
        <Text style={styles.posterKicker}>{kicker}</Text>
        <Text style={styles.posterTitle}>{title}</Text>
        <View style={styles.posterCtaRow}>
          <Text style={styles.posterCta}>{cta}</Text>
          <Ionicons name="arrow-forward" size={13} color={GREEN} />
        </View>
      </View>
    </Pressable>
  )
}

export default function PlazoreNavigationHub({
  visible,
  onClose,
  slots,
}: PlazoreNavigationHubProps) {
  const insets = useSafeAreaInsets()
  const { width: windowW } = useWindowDimensions()
  const router = useRouter()
  const pathname = usePathname()
  const { formatProduct } = useMarketplace()
  const cartCtx = useCart() as any
  const cartItems = cartCtx?.cart ?? cartCtx?.items ?? cartCtx?.cartItems ?? []
  const cartCount = Number(
    cartCtx?.itemCount ??
      cartItems.reduce(
        (n: number, i: any) => n + (Number(i.quantity) || 1),
        0,
      ),
  )

  const cartImages = useMemo(() => {
    const uris: string[] = []
    for (const item of cartItems) {
      const img =
        item?.product?.images?.[0] || item?.image || item?.product?.image || null
      if (img && typeof img === 'string' && !uris.includes(img)) uris.push(img)
      if (uris.length >= 6) break
    }
    return uris
  }, [cartItems])

  const { user } = useUser()
  const { signOut } = useClerk()
  const { isSignedIn, getToken } = useAuth()
  const role = (user?.publicMetadata?.role as string) || 'buyer'
  const isSeller = role === 'seller' || role === 'admin'

  const progress = useRef(new Animated.Value(0)).current
  const contentFade = useRef(new Animated.Value(0)).current
  const backdropOp = useRef(new Animated.Value(0)).current
  const [mounted, setMounted] = useState(false)
  const [contentKey, setContentKey] = useState(0)
  const [storeLogo, setStoreLogo] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string>('')
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

  const pad = 14
  const gap = 9
  const tileW = Math.floor((windowW - pad * 2 - gap) / 2)
  const tileH = Math.round(tileW * 0.86)
  // Solid (non-translucent) status bar already reserves space on Android —
  // only pad real safe-area inset so we don't double-offset vs the title bar.
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 12 : 0)
  const bottomInset = Math.max(insets.bottom, 12)
  const isSearching = query.trim().length >= 1

  useEffect(() => {
    if (!visible || !isSeller || !isSignedIn) {
      setStoreLogo(null)
      setStoreName('')
      return
    }
    let alive = true
    ;(async () => {
      try {
        const token = await getTokenRef.current()
        if (!token) return
        for (const ep of ['/seller/store', '/seller/me', '/users/me']) {
          try {
            const res = await api.get(ep, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 8000,
            })
            const data = res.data?.data || res.data
            const logo =
              data?.storeLogo || data?.store?.storeLogo || data?.logo || null
            const name =
              data?.storeName || data?.store?.storeName || data?.name || ''
            if (alive) {
              if (logo) setStoreLogo(String(logo))
              if (name) setStoreName(String(name))
              if (logo || name) return
            }
          } catch {
            /* next */
          }
        }
      } catch {
        /* ignore */
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
        const res = await api.get('/products?limit=48')
        if (alive && res.data?.success) setAllProducts(res.data.data || [])
      } catch {
        /* ignore */
      }
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
          `/ai/search-suggest?q=${encodeURIComponent(debounced)}`,
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

  const newest = useMemo(() => {
    return [...allProducts]
      .sort((a, b) => {
        const ta = new Date((a as any).createdAt || 0).getTime()
        const tb = new Date((b as any).createdAt || 0).getTime()
        return tb - ta
      })
      .slice(0, 10)
  }, [allProducts])

  const trending = useMemo(() => {
    return [...allProducts]
      .sort((a, b) => {
        const va = Number((a as any).wishlistCount || (a as any).viewCount || 0)
        const vb = Number((b as any).wishlistCount || (b as any).viewCount || 0)
        return vb - va
      })
      .slice(0, 10)
  }, [allProducts])

  const storePicks = useMemo(() => {
    const map = new Map<string, { id: string; name: string; logo?: string; cover?: string }>()
    for (const p of allProducts) {
      const s = (p as any).seller
      if (!s || typeof s === 'string' || !s._id) continue
      const id = String(s._id)
      if (map.has(id)) continue
      map.set(id, {
        id,
        name: s.storeName || s.name || 'Store',
        logo: s.storeLogo,
        cover: p.images?.[0],
      })
      if (map.size >= 8) break
    }
    return Array.from(map.values())
  }, [allProducts])

  const categoryStrip = useMemo(() => {
    const list = (CATEGORY_LIST || []).slice(0, 12)
    return list.map((c: string) => ({
      name: c,
      image: CATEGORY_IMAGES[c] || FALLBACK_CAT,
    }))
  }, [])

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
      return {
        products: [] as LocalHit[],
        stores: [] as LocalHit[],
        categories: [] as LocalHit[],
        ai: [] as LocalHit[],
      }
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
    return { products, stores, categories, ai: [] as LocalHit[] }
  }, [query, serverProducts, allProducts])

  const totalHitsCount =
    groupedHits.products.length +
    groupedHits.stores.length +
    groupedHits.categories.length

  const resetSearch = useCallback(() => {
    setQuery('')
    setDebounced('')
    setServerProducts([])
    setAiPhrases([])
    setAiFloors([])
  }, [])

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
      applySolidDarkStatusBar()
      setMounted(true)
      setContentKey((k) => k + 1)
      progress.setValue(0)
      contentFade.setValue(0)
      backdropOp.setValue(0)
      Animated.parallel([
        Animated.timing(backdropOp, {
          toValue: 1,
          duration: Math.round(OPEN_MS * 0.85),
          easing: EASE,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 1,
          duration: OPEN_MS,
          easing: EASE,
          useNativeDriver: true,
        }),
        Animated.timing(contentFade, {
          toValue: 1,
          duration: Math.round(OPEN_MS * 0.72),
          delay: 90,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
      ]).start()
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 0,
          duration: CLOSE_MS,
          easing: EASE,
          useNativeDriver: true,
        }),
        Animated.timing(contentFade, {
          toValue: 0,
          duration: Math.round(CLOSE_MS * 0.55),
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOp, {
          toValue: 0,
          duration: CLOSE_MS,
          easing: EASE,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setMounted(false)
          resetSearch()
          applySolidDarkStatusBar()
        }
      })
    }
  }, [visible])

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-windowW, 0],
  })

  const isActive = (href?: string, itemId?: string) => {
    if (!href && !itemId) return false
    if (!href) return false
    if (href === '/(tabs)' || href === '/(tabs)/') {
      return (
        pathname === '/' ||
        pathname === '/(tabs)' ||
        pathname === '/(tabs)/' ||
        pathname?.endsWith('/index')
      )
    }
    const key = href.split('/').filter(Boolean).pop()?.split('?')[0] || ''
    return typeof pathname === 'string' && pathname.includes(key)
  }

  const activeMap = useMemo(() => {
    const map: Record<string, boolean> = {}
    SECTIONS.forEach((s) =>
      s.items.forEach((item) => {
        map[item.id] = isActive(item.href, item.id)
      }),
    )
    return map
  }, [pathname])

  const navigate = (href?: string, itemId?: string) => {
    onClose()
    if (!href) return
    requestAnimationFrame(() => {
      try {
        router.push(href.split('?')[0] as any)
      } catch {
        /* ignore */
      }
    })
  }

  const goShop = (mode: string) => {
    onClose()
    requestAnimationFrame(() => {
      router.push({ pathname: '/shop', params: { mode } } as any)
    })
  }

  const handleLogout = async () => {
    onClose()
    try {
      await signOut()
      router.replace('/(auth)/sign-in' as any)
    } catch {
      /* ignore */
    }
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
      statusBarTranslucent={false}
      onRequestClose={onClose}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={STATUS_BG}
        translucent={false}
        hidden={false}
      />
      <View style={{ flex: 1, backgroundColor: BG }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.62)', opacity: backdropOp },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: BG,
            transform: [{ translateX }],
            paddingTop: topInset,
            paddingBottom: bottomInset,
          }}
        >
          <View style={styles.topBar}>
            <Text style={styles.topLabel}>LOUNGE</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Ionicons name="close" size={18} color={TEXT} />
            </Pressable>
          </View>

          <Animated.View style={{ opacity: contentFade }}>
            <HubLogo />
          </Animated.View>

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
            contentContainerStyle={{ paddingBottom: 36 }}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => Keyboard.dismiss()}
            removeClippedSubviews
          >
            {isSearching ? (
              <View style={{ paddingHorizontal: 14, paddingTop: 6 }}>
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
                    {groupedHits.products.map((h, i) => {
                      if (h.type !== 'product') return null
                      return (
                        <Pressable
                          key={h.id}
                          onPress={() => onHitPress(h)}
                          style={styles.resultRow}
                        >
                          <View style={styles.resultThumb}>
                            {h.image ? (
                              <ExpoImage
                                source={{ uri: h.image }}
                                style={{ width: 60, height: 60 }}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                transition={0}
                              />
                            ) : null}
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.resultTitle} numberOfLines={2}>
                              {h.label}
                            </Text>
                            <Text style={styles.resultPrice}>
                              {formatProduct(h.price, h.region)}
                            </Text>
                          </View>
                        </Pressable>
                      )
                    })}
                    {groupedHits.stores.map((h) => {
                      if (h.type !== 'store') return null
                      return (
                        <Pressable
                          key={h.id}
                          onPress={() => onHitPress(h)}
                          style={styles.resultRow}
                        >
                          <View style={styles.resultThumb}>
                            {h.logo ? (
                              <ExpoImage
                                source={{ uri: h.logo }}
                                style={{ width: 60, height: 60 }}
                                contentFit="cover"
                                transition={0}
                              />
                            ) : (
                              <Ionicons name="storefront" size={20} color={BLUE} />
                            )}
                          </View>
                          <Text style={styles.resultTitle}>{h.label}</Text>
                        </Pressable>
                      )
                    })}
                  </>
                )}
              </View>
            ) : (
              <>
                {/* Posters */}
                <View style={{ paddingHorizontal: 14, gap: 8, marginBottom: 12 }}>
                  <PosterCard
                    image={SELL_POSTER}
                    kicker="MALL"
                    title="Discover"
                    cta="Browse"
                    onPress={() => {
                      onClose()
                      requestAnimationFrame(() =>
                        router.push('/(tabs)/search' as any),
                      )
                    }}
                  />
                  <PosterCard
                    image={isSeller ? storeLogo || SELL_POSTER : SELL_POSTER}
                    kicker={isSeller ? 'STORE' : 'SELL'}
                    title={isSeller ? storeName || 'Dashboard' : 'Open a store'}
                    cta={isSeller ? 'Manage' : 'Start'}
                    onPress={handleSellerCta}
                  />
                </View>

                {/* Explore chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {EXPLORE_CHIPS.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => goShop(c.mode)}
                      style={styles.chip}
                    >
                      <Text style={styles.chipText}>{c.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Categories */}
                <Text style={styles.sectionHeader}>Categories</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}
                >
                  {categoryStrip.map((c) => (
                    <Pressable
                      key={c.name}
                      onPress={() => {
                        onClose()
                        requestAnimationFrame(() =>
                          router.push({
                            pathname: '/shop',
                            params: { mode: 'categories', q: c.name },
                          } as any),
                        )
                      }}
                      style={styles.catCard}
                    >
                      <ExpoImage
                        source={{ uri: c.image }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={0}
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.85)']}
                        style={StyleSheet.absoluteFill}
                      />
                      <Text style={styles.catLabel} numberOfLines={2}>
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* New arrivals */}
                {newest.length > 0 && (
                  <>
                    <View style={styles.railHead}>
                      <Text style={styles.sectionHeaderInline}>New arrivals</Text>
                      <Pressable onPress={() => goShop('new')}>
                        <Text style={styles.seeAll}>See all</Text>
                      </Pressable>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}
                    >
                      {newest.map((p) => (
                        <Pressable
                          key={String(p._id)}
                          onPress={() => {
                            onClose()
                            requestAnimationFrame(() =>
                              router.push(`/product/${p._id}` as any),
                            )
                          }}
                          style={styles.productCard}
                        >
                          <ExpoImage
                            source={{ uri: p.images?.[0] }}
                            style={styles.productImg}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            transition={0}
                          />
                          <Text style={styles.productName} numberOfLines={2}>
                            {p.name}
                          </Text>
                          <Text style={styles.productPrice}>
                            {formatProduct(p.price, p.region)}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Trending */}
                {trending.length > 0 && (
                  <>
                    <View style={styles.railHead}>
                      <Text style={styles.sectionHeaderInline}>Trending</Text>
                      <Pressable onPress={() => goShop('trending')}>
                        <Text style={styles.seeAll}>See all</Text>
                      </Pressable>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}
                    >
                      {trending.map((p) => (
                        <Pressable
                          key={`t-${String(p._id)}`}
                          onPress={() => {
                            onClose()
                            requestAnimationFrame(() =>
                              router.push(`/product/${p._id}` as any),
                            )
                          }}
                          style={styles.productCard}
                        >
                          <ExpoImage
                            source={{ uri: p.images?.[0] }}
                            style={styles.productImg}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            transition={0}
                          />
                          <Text style={styles.productName} numberOfLines={2}>
                            {p.name}
                          </Text>
                          <Text style={styles.productPrice}>
                            {formatProduct(p.price, p.region)}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Stores */}
                {storePicks.length > 0 && (
                  <>
                    <View style={styles.railHead}>
                      <Text style={styles.sectionHeaderInline}>Stores to visit</Text>
                      <Pressable onPress={() => goShop('stores')}>
                        <Text style={styles.seeAll}>See all</Text>
                      </Pressable>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}
                    >
                      {storePicks.map((s) => (
                        <Pressable
                          key={s.id}
                          onPress={() => {
                            onClose()
                            requestAnimationFrame(() =>
                              router.push(`/store/${s.id}` as any),
                            )
                          }}
                          style={styles.storeCard}
                        >
                          {s.cover ? (
                            <ExpoImage
                              source={{ uri: s.cover }}
                              style={StyleSheet.absoluteFill}
                              contentFit="cover"
                              transition={0}
                            />
                          ) : null}
                          <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.9)']}
                            style={StyleSheet.absoluteFill}
                          />
                          <View style={styles.storeFoot}>
                            {s.logo ? (
                              <ExpoImage
                                source={{ uri: s.logo }}
                                style={styles.storeLogo}
                                contentFit="cover"
                              />
                            ) : (
                              <View style={styles.storeLogo}>
                                <Ionicons name="storefront" size={14} color={TEXT} />
                              </View>
                            )}
                            <Text style={styles.storeName} numberOfLines={1}>
                              {s.name}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}

                {slots?.musicSettings ? (
                  <View style={styles.slotWrap}>{slots.musicSettings}</View>
                ) : null}

                {/* Main hub tiles */}
                {SECTIONS.map((section) => (
                  <View key={section.id} style={{ marginBottom: 18, marginTop: 8 }}>
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
                            cartImages={item.id === 'cart' ? cartImages : undefined}
                            cartCount={item.id === 'cart' ? cartCount : undefined}
                          />
                        )
                      })}
                    </View>
                  </View>
                ))}

                <View style={styles.footerCard}>
                  <Pressable
                    style={styles.footerProfile}
                    onPress={() => navigate('/(tabs)/profile')}
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
                          ? 'This profile is currently active'
                          : 'Sign in to sync your account'}
                      </Text>
                    </View>
                  </Pressable>
                  {isSignedIn && (
                    <Pressable onPress={handleLogout} style={styles.logoutBtn}>
                      <Ionicons name="log-out-outline" size={15} color={TEXT_DIM} />
                      <Text style={styles.logoutText}>Log out</Text>
                    </Pressable>
                  )}
                </View>
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
    paddingHorizontal: 14,
    minHeight: 42,
    marginBottom: 2,
  },
  topLabel: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
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
    minHeight: 72,
    marginBottom: 4,
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
    marginHorizontal: 14,
    marginBottom: 12,
    marginTop: 2,
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
  poster: {
    height: 132,
    overflow: 'hidden',
    backgroundColor: SURFACE_2,
    justifyContent: 'flex-end',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  posterCopy: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 20,
  },
  posterKicker: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginBottom: 6,
  },
  posterTitle: {
    color: TEXT,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  posterCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  posterCta: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  chipRow: {
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
  },
  chipText: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 9,
    marginTop: 6,
    paddingHorizontal: 14,
  },
  sectionHeaderInline: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  railHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginTop: 16,
    marginBottom: 10,
  },
  seeAll: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  catCard: {
    width: 120,
    height: 90,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: SURFACE_2,
  },
  catLabel: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '700',
    padding: 8,
  },
  productCard: {
    width: 132,
  },
  productImg: {
    width: 132,
    height: 132,
    backgroundColor: SURFACE_2,
    marginBottom: 6,
  },
  productName: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '600',
  },
  productPrice: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  storeCard: {
    width: 200,
    height: 132,
    overflow: 'hidden',
    backgroundColor: SURFACE_2,
    justifyContent: 'flex-end',
  },
  storeFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  storeLogo: {
    width: 28,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeName: {
    flex: 1,
    color: TEXT,
    fontSize: 12,
    fontWeight: '700',
  },
  tileGrid: {
    paddingHorizontal: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  cartBadge: {
    marginLeft: 7,
    minWidth: 20,
    height: 18,
    paddingHorizontal: 5,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: '#041412',
    fontSize: 10,
    fontWeight: '800',
  },
  slotWrap: { marginBottom: 10, paddingHorizontal: 14 },
  emptySearch: { paddingVertical: 40, alignItems: 'center' },
  emptySearchText: { color: TEXT_DIM, fontSize: 14, marginTop: 10 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  resultThumb: {
    width: 60,
    height: 60,
    backgroundColor: SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  resultTitle: { color: TEXT, fontSize: 14, fontWeight: '500' },
  resultPrice: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  footerCard: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    padding: 13,
    gap: 11,
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
  footerName: { color: TEXT, fontSize: 14, fontWeight: '700' },
  footerMeta: { color: TEXT_MUTED, fontSize: 11, marginTop: 1 },
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
  logoutText: { color: TEXT_DIM, fontSize: 12, fontWeight: '600' },
})