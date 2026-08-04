import { Ionicons } from '@expo/vector-icons'
import { useAuth, useClerk, useUser } from '@clerk/clerk-expo'
import { usePathname, useRouter } from 'expo-router'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
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

const BG = '#0B0B0F'
const RAIL = '#121218'
const TEXT = '#FFFFFF'
const TEXT_DIM = 'rgba(255,255,255,0.55)'
const TEXT_MUTED = 'rgba(255,255,255,0.35)'
const ACCENT = '#C9A962'

const OPEN_MS = 780
const CLOSE_MS = 420
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1)

const TILE_TONES = [
  '#1A1A24',
  '#1C1A22',
  '#181C24',
  '#1A1E22',
  '#1C1C20',
  '#1A1822',
  '#181A20',
  '#1C1A20',
  '#1A1C22',
  '#181C22',
  '#1C1822',
]

type NavItem = {
  id: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
  href?: string
  tone?: string
}

type NavSection = {
  id: string
  title: string
  items: NavItem[]
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
    id: 'primary',
    title: 'Primary',
    items: [
      { id: 'home', label: 'Home', icon: 'home-outline', href: '/(tabs)', tone: TILE_TONES[0] },
      { id: 'cart', label: 'Cart', icon: 'bag-outline', href: '/(tabs)/cart', tone: TILE_TONES[1] },
      { id: 'wishlist', label: 'Wishlist', icon: 'heart-outline', href: '/(tabs)/favorites', tone: TILE_TONES[2] },
      { id: 'profile', label: 'Profile', icon: 'person-outline', href: '/(tabs)/profile', tone: TILE_TONES[3] },
    ],
  },
  {
    id: 'explore',
    title: 'Explore',
    items: [
      { id: 'categories', label: 'Categories', icon: 'grid-outline', href: '/shop', tone: TILE_TONES[4] },
      { id: 'new', label: 'New Arrivals', icon: 'sparkles-outline', href: '/shop', tone: TILE_TONES[5] },
      { id: 'trending', label: 'Trending', icon: 'trending-up-outline', href: '/shop', tone: TILE_TONES[6] },
      { id: 'stores', label: 'Stores', icon: 'storefront-outline', href: '/shop', tone: TILE_TONES[7] },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    items: [
      { id: 'help', label: 'Help', icon: 'help-circle-outline', tone: TILE_TONES[8] },
      { id: 'contact', label: 'Contact', icon: 'chatbubble-ellipses-outline', tone: TILE_TONES[9] },
      { id: 'about', label: 'About', icon: 'information-circle-outline', tone: TILE_TONES[10] },
    ],
  },
]

function Tile({
  item,
  active,
  onPress,
  width,
}: {
  item: NavItem
  active: boolean
  onPress: () => void
  width: number
}) {
  const scale = useRef(new Animated.Value(1)).current

  const pressIn = () => {
    Animated.timing(scale, {
      toValue: 0.93,
      duration: 100,
      easing: EASE,
      useNativeDriver: true,
    }).start()
  }

  const pressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 150,
      easing: EASE,
      useNativeDriver: true,
    }).start()
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.label}
    >
      <Animated.View
        style={[
          styles.tile,
          {
            width,
            backgroundColor: active ? '#252530' : item.tone || '#1A1A22',
            borderColor: active ? 'rgba(201,169,98,0.35)' : 'rgba(255,255,255,0.04)',
          },
          { transform: [{ scale }] },
        ]}
      >
        <View
          style={[
            styles.tileIconWrap,
            {
              backgroundColor: active
                ? 'rgba(201,169,98,0.18)'
                : 'rgba(255,255,255,0.06)',
            },
          ]}
        >
          <Ionicons
            name={item.icon}
            size={26}
            color={active ? ACCENT : TEXT}
          />
        </View>
        <Text
          style={[styles.tileLabel, active && styles.tileLabelActive]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </Animated.View>
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

  const { user } = useUser()
  const { signOut } = useClerk()
  const { isSignedIn } = useAuth()

  const role = (user?.publicMetadata?.role as string) || 'buyer'
  const isSeller = role === 'seller' || role === 'admin'

  const [railOpen, setRailOpen] = useState(true)
  const progress = useRef(new Animated.Value(0)).current
  const railAnim = useRef(new Animated.Value(1)).current
  const [mounted, setMounted] = useState(visible)

  const tileW = Math.min(118, Math.floor((windowW - (railOpen ? 72 : 24) - 48) / 3.1))

  // Status bar height (top safe area)
  const topInset = Math.max(insets.top, StatusBar.currentHeight ?? 0, 12)
  const bottomInset = Math.max(insets.bottom, 10)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_MS,
        easing: EASE,
        useNativeDriver: true,
      }).start()
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: CLOSE_MS,
        easing: EASE,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false)
      })
    }
  }, [visible])

  const toggleRail = () => {
    const next = !railOpen
    setRailOpen(next)
    Animated.timing(railAnim, {
      toValue: next ? 1 : 0,
      duration: 280,
      easing: EASE,
      useNativeDriver: false,
    }).start()
  }

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-windowW, 0],
  })

  const railWidth = railAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 56],
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
        map[item.id] = isActive(item.href)
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

  const navigate = (href?: string) => {
    onClose()
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
      if (isSeller) {
        router.push('/seller' as any)
      } else {
        router.push('/seller-register' as any)
      }
    })
  }

  if (!mounted) return null

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.root}>
        <Animated.View
          style={[
            styles.panel,
            {
              transform: [{ translateX }],
              paddingTop: topInset,
              paddingBottom: bottomInset,
            },
          ]}
        >
          {/* ── Left Rail ── */}
          <Animated.View style={[styles.rail, { width: railWidth }]}>
            {railOpen && (
              <>
                {/* Top: brand mark (replaces profile) */}
                <View style={styles.railLogoWrap} pointerEvents="none">
                  <Image
                    source={require('../assets/logo-1.png')}
                    style={styles.railLogo}
                    resizeMode="contain"
                  />
                </View>

                <View style={styles.railSpacer} />

                <Pressable
                  onPress={() => navigate('/(tabs)')}
                  style={[styles.railBtn, isActive('/(tabs)') && styles.railBtnActive]}
                >
                  <Ionicons
                    name="home"
                    size={20}
                    color={isActive('/(tabs)') ? ACCENT : TEXT_DIM}
                  />
                </Pressable>
                <Pressable
                  onPress={() => navigate('/(tabs)/cart')}
                  style={[styles.railBtn, isActive('/(tabs)/cart') && styles.railBtnActive]}
                >
                  <Ionicons
                    name="bag-outline"
                    size={20}
                    color={isActive('/(tabs)/cart') ? ACCENT : TEXT_DIM}
                  />
                </Pressable>
                <Pressable
                  onPress={() => navigate('/(tabs)/favorites')}
                  style={[styles.railBtn, isActive('/(tabs)/favorites') && styles.railBtnActive]}
                >
                  <Ionicons
                    name="heart-outline"
                    size={20}
                    color={isActive('/(tabs)/favorites') ? ACCENT : TEXT_DIM}
                  />
                </Pressable>

                <View style={styles.railSpacer} />

                {/* Profile → then space → Logout */}
                <Pressable
                  onPress={() => navigate('/(tabs)/profile')}
                  style={styles.railProfile}
                  hitSlop={6}
                  accessibilityLabel="Profile"
                >
                  {user?.imageUrl ? (
                    <Image
                      source={{ uri: user.imageUrl }}
                      style={styles.railAvatar}
                    />
                  ) : (
                    <View style={[styles.railAvatar, styles.railAvatarFallback]}>
                      <Ionicons name="person" size={18} color={TEXT_DIM} />
                    </View>
                  )}
                </Pressable>

                <View style={styles.railProfileGap} />

                {isSignedIn ? (
                  <Pressable
                    onPress={handleLogout}
                    style={styles.railBtn}
                    accessibilityLabel="Log out"
                  >
                    <Ionicons name="log-out-outline" size={20} color={TEXT_DIM} />
                  </Pressable>
                ) : null}
              </>
            )}
          </Animated.View>

          {/* ── Main ── */}
          <View style={styles.main}>
            {/* Top bar: rail toggle + close */}
            <View style={styles.topBar}>
              <Pressable
                onPress={toggleRail}
                style={styles.topBarBtn}
                hitSlop={10}
                accessibilityLabel={railOpen ? 'Hide rail' : 'Show rail'}
              >
                <Ionicons
                  name={railOpen ? 'chevron-back' : 'menu-outline'}
                  size={22}
                  color={TEXT}
                />
              </Pressable>

              <Pressable
                onPress={onClose}
                style={styles.topBarBtn}
                hitSlop={10}
                accessibilityLabel="Close navigation"
              >
                <Ionicons name="close" size={24} color={TEXT} />
              </Pressable>
            </View>

            {/* ── Plazore Lounge header (wordmark + faint watermark) ── */}
            <View style={styles.headerTitleArea}>
              {/* Watermark — larger, centered, ~6% opacity */}
              <Image
                source={require('../assets/logo-1.png')}
                style={styles.headerWatermark}
                resizeMode="contain"
              />

              {/* Primary wordmark title */}
              <Image
                source={require('../assets/logo-2.png')}
                style={styles.headerWordmark}
                resizeMode="contain"
              />
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={TEXT_MUTED} />
              <TextInput
                placeholder="Search products, stores..."
                placeholderTextColor={TEXT_MUTED}
                style={styles.searchInput}
                editable={false}
                pointerEvents="none"
              />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {slots?.profile ? (
                <View style={styles.slot}>{slots.profile}</View>
              ) : null}
              {slots?.recommendations ? (
                <View style={styles.slot}>{slots.recommendations}</View>
              ) : null}
              {slots?.recentlyViewed ? (
                <View style={styles.slot}>{slots.recentlyViewed}</View>
              ) : null}
              {slots?.sellerShortcuts ? (
                <View style={styles.slot}>{slots.sellerShortcuts}</View>
              ) : null}

              {SECTIONS.map((section) => (
                <View key={section.id} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.row}
                  >
                    {section.items.map((item) => (
                      <Tile
                        key={item.id}
                        item={item}
                        active={!!activeMap[item.id]}
                        onPress={() => navigate(item.href)}
                        width={tileW}
                      />
                    ))}
                  </ScrollView>
                </View>
              ))}

              <Pressable
                onPress={handleSellerCta}
                style={styles.sellerCta}
                accessibilityRole="button"
              >
                <View style={styles.sellerIconWrap}>
                  <Ionicons
                    name={isSeller ? 'storefront' : 'storefront-outline'}
                    size={22}
                    color={isSeller ? '#0B0B0F' : ACCENT}
                  />
                </View>
                <View style={styles.sellerTextWrap}>
                  <Text style={styles.sellerTitle}>
                    {isSeller ? 'Seller Dashboard' : 'Become a Seller'}
                  </Text>
                  <Text style={styles.sellerSub}>
                    {isSeller
                      ? 'Products, orders & analytics'
                      : 'Open your store on Plazore'}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={TEXT_MUTED}
                />
              </Pressable>

              {slots?.musicSettings ? (
                <View style={[styles.slot, { marginTop: 16 }]}>
                  {slots.musicSettings}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    flexDirection: 'row',
  },

  /* Rail */
  rail: {
    backgroundColor: RAIL,
    alignItems: 'center',
    overflow: 'hidden',
    paddingTop: 4,
    paddingBottom: 8,
  },
  railLogoWrap: {
    marginTop: 6,
    marginBottom: 10,
    width: 40,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railLogo: {
    width: 40,
    height: 100,
  },
  railProfile: {
    marginBottom: 0,
  },
  railProfileGap: {
    height: 14,
  },
  railAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(201,169,98,0.4)',
  },
  railAvatarFallback: {
    backgroundColor: '#1A1A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  railBtnActive: {
    backgroundColor: 'rgba(201,169,98,0.12)',
  },
  railSpacer: {
    flex: 1,
    minHeight: 8,
  },

  /* Main */
  main: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Header — Plazore Lounge */
  headerTitleArea: {
    paddingHorizontal: 20,
    paddingTop: -13,
    paddingBottom: -8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
    position: 'relative',
  },
  headerWatermark: {
    position: 'absolute',
    width: 220,
    height: 200,
    opacity: 0.06,
  },
  headerWordmark: {
    width: 168,
    height: 130,
  },
  headerLoungeLabel: {
    marginTop: 4,
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 3.2,
    textTransform: 'uppercase',
  },

  searchWrap: {
    marginHorizontal: 20,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#14141A',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: TEXT,
    fontSize: 15,
    paddingVertical: 0,
  },

  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    marginBottom: 26,
  },
  sectionTitle: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  row: {
    paddingHorizontal: 20,
    gap: 12,
  },

  tile: {
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileIconWrap: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  tileLabelActive: {
    color: ACCENT,
    fontWeight: '600',
  },

  sellerCta: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161E',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,169,98,0.22)',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  sellerIconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,169,98,0.12)',
  },
  sellerTextWrap: {
    flex: 1,
  },
  sellerTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '600',
  },
  sellerSub: {
    color: TEXT_DIM,
    fontSize: 12,
    marginTop: 2,
  },

  slot: {
    marginBottom: 14,
    paddingHorizontal: 20,
  },
})