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

const BG = '#08080A'
const SURFACE = '#121218'
const TEXT = '#FFFFFF'
const TEXT_DIM = 'rgba(255,255,255,0.58)'
const TEXT_MUTED = 'rgba(255,255,255,0.34)'
const ACCENT = '#C9A962'
const TILE_BORDER = 'rgba(255,255,255,0.07)'
const TILE_BORDER_ACTIVE = 'rgba(201,169,98,0.5)'

const OPEN_MS = 780
const CLOSE_MS = 420
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1)

const TILE_TONES = [
  '#14141A',
  '#16141A',
  '#12161C',
  '#14181A',
  '#181614',
  '#14121A',
  '#12141A',
  '#181416',
  '#16121A',
  '#12161A',
  '#181412',
]

type NavItem = {
  id: string
  label: string
  subtitle?: string
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
    title: 'Floors',
    items: [
      {
        id: 'home',
        label: 'Home',
        subtitle: 'Main showroom',
        icon: 'home',
        href: '/(tabs)',
        tone: TILE_TONES[0],
      },
      {
        id: 'cart',
        label: 'Cart',
        subtitle: 'Your bag',
        icon: 'bag-handle',
        href: '/(tabs)/cart',
        tone: TILE_TONES[1],
      },
      {
        id: 'wishlist',
        label: 'Wishlist',
        subtitle: 'Saved pieces',
        icon: 'heart',
        href: '/(tabs)/favorites',
        tone: TILE_TONES[2],
      },
      {
        id: 'profile',
        label: 'Profile',
        subtitle: 'Account',
        icon: 'person',
        href: '/(tabs)/profile',
        tone: TILE_TONES[3],
      },
    ],
  },
  {
    id: 'explore',
    title: 'Explore the Mall',
    items: [
      {
        id: 'categories',
        label: 'Categories',
        subtitle: 'Browse by room',
        icon: 'apps',
        href: '/shop',
        tone: TILE_TONES[4],
      },
      {
        id: 'new',
        label: 'New Arrivals',
        subtitle: 'Just in',
        icon: 'sparkles',
        href: '/shop',
        tone: TILE_TONES[5],
      },
      {
        id: 'trending',
        label: 'Trending',
        subtitle: 'Moving now',
        icon: 'flame',
        href: '/shop',
        tone: TILE_TONES[6],
      },
      {
        id: 'stores',
        label: 'Stores',
        subtitle: 'Seller floors',
        icon: 'storefront',
        href: '/shop',
        tone: TILE_TONES[7],
      },
    ],
  },
  {
    id: 'support',
    title: 'Service Desk',
    items: [
      {
        id: 'help',
        label: 'Help',
        subtitle: 'Guides',
        icon: 'help-buoy',
        tone: TILE_TONES[8],
      },
      {
        id: 'contact',
        label: 'Contact',
        subtitle: 'Talk to us',
        icon: 'chatbubbles',
        tone: TILE_TONES[9],
      },
      {
        id: 'about',
        label: 'About',
        subtitle: 'Plazore',
        icon: 'information-circle',
        tone: TILE_TONES[10],
      },
    ],
  },
]

function MallTile({
  item,
  active,
  onPress,
  width,
  height,
}: {
  item: NavItem
  active: boolean
  onPress: () => void
  width: number
  height: number
}) {
  const scale = useRef(new Animated.Value(1)).current

  const pressIn = () => {
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 90,
      easing: EASE,
      useNativeDriver: true,
    }).start()
  }

  const pressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 160,
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
            height,
            backgroundColor: active ? '#1C1C26' : item.tone || '#14141A',
            borderColor: active ? TILE_BORDER_ACTIVE : TILE_BORDER,
          },
          { transform: [{ scale }] },
        ]}
      >
        {active ? <View style={styles.tileFocusBar} /> : null}

        <View style={styles.tileTop}>
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
        </View>

        <View style={styles.tileBottom}>
          <Text
            style={[styles.tileLabel, active && styles.tileLabelActive]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
          {!!item.subtitle && (
            <Text style={styles.tileSub} numberOfLines={1}>
              {item.subtitle}
            </Text>
          )}
        </View>
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

  const progress = useRef(new Animated.Value(0)).current
  const [mounted, setMounted] = useState(visible)

  const pad = 20
  const gap = 12
  const tileW = Math.floor((windowW - pad * 2 - gap) / 2)
  const tileH = Math.round(tileW * 0.88)

  const topInset = Math.max(insets.top, StatusBar.currentHeight ?? 0, 12)
  const bottomInset = Math.max(insets.bottom, 12)

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

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-windowW, 0],
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
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
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
          {/* Top bar: spacer left · close top-right (easy thumb reach) */}
          <View style={styles.topBar}>
            <View style={{ width: 48 }} />
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={14}
              accessibilityLabel="Close navigation"
            >
              <Ionicons name="close" size={22} color={TEXT} />
            </Pressable>
          </View>

          {/* Logo header */}
          <View style={styles.headerTitleArea}>
            <Image
              source={require('../assets/logo-1.png')}
              style={styles.headerWatermark}
              resizeMode="contain"
            />
            <Image
              source={require('../assets/logo-2.png')}
              style={styles.headerWordmark}
              resizeMode="contain"
            />
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={TEXT_MUTED} />
            <TextInput
              placeholder="Search the mall…"
              placeholderTextColor={TEXT_MUTED}
              style={styles.searchInput}
              editable={false}
              pointerEvents="none"
            />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Seller CTA — high priority, near top */}
            <Pressable
              onPress={handleSellerCta}
              style={styles.sellerCta}
              accessibilityRole="button"
            >
              <View style={styles.sellerIconWrap}>
                <Ionicons
                  name={isSeller ? 'storefront' : 'storefront-outline'}
                  size={22}
                  color={ACCENT}
                />
              </View>
              <View style={styles.sellerTextWrap}>
                <Text style={styles.sellerTitle}>
                  {isSeller ? 'Seller Dashboard' : 'Open a Store'}
                </Text>
                <Text style={styles.sellerSub}>
                  {isSeller
                    ? 'Products, orders & analytics'
                    : 'Become a seller on Plazore'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
            </Pressable>

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
                <View style={styles.grid}>
                  {section.items.map((item) => (
                    <MallTile
                      key={item.id}
                      item={item}
                      active={!!activeMap[item.id]}
                      onPress={() => navigate(item.href)}
                      width={tileW}
                      height={tileH}
                    />
                  ))}
                </View>
              </View>
            ))}

            {slots?.musicSettings ? (
              <View style={[styles.slot, { marginTop: 8 }]}>
                {slots.musicSettings}
              </View>
            ) : null}

                        {/* Profile + logout — clean account strip */}
            <View style={styles.accountStrip}>
              <Pressable
                onPress={() => navigate('/(tabs)/profile')}
                style={styles.profileRow}
                accessibilityLabel="Profile"
              >
                {user?.imageUrl ? (
                  <Image
                    source={{ uri: user.imageUrl }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Ionicons name="person" size={18} color={TEXT_DIM} />
                  </View>
                )}
                <View style={styles.profileText}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {user?.firstName || user?.username || 'Guest'}
                  </Text>
                  <Text style={styles.profileMeta} numberOfLines={1}>
                    {isSignedIn ? 'View profile' : 'Sign in to continue'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
              </Pressable>

              {isSignedIn ? (
                <Pressable
                  onPress={handleLogout}
                  style={styles.logoutBtn}
                  accessibilityLabel="Log out"
                  hitSlop={8}
                >
                  <Ionicons name="log-out-outline" size={18} color={TEXT_DIM} />
                  <Text style={styles.logoutLabel}>Log out</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
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
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 2,
    minHeight: 44,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  headerTitleArea: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
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
    height: 110,
  },

  searchWrap: {
    marginHorizontal: 20,
    marginBottom: 16,
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SURFACE,
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
    paddingBottom: 36,
  },

  /* Account strip */
  accountStrip: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TILE_BORDER,
    padding: 12,
    gap: 10,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: 'rgba(201,169,98,0.5)',
  },
  avatarFallback: {
    backgroundColor: '#1A1A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '600',
  },
  profileMeta: {
    color: TEXT_MUTED,
    fontSize: 12,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  logoutLabel: {
    color: TEXT_DIM,
    fontSize: 13,
    fontWeight: '500',
  },

  /* Seller — moved up */
  sellerCta: {
    marginHorizontal: 20,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12121A',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,169,98,0.35)',
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 12,
  },
  sellerIconWrap: {
    width: 46,
    height: 46,
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

  section: {
    marginBottom: 26,
  },
  sectionTitle: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingHorizontal: 20,
  },

  grid: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  tile: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  tileFocusBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: ACCENT,
  },
  tileTop: {
    marginBottom: 12,
  },
  tileIconWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBottom: {},
  tileLabel: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  tileLabelActive: {
    color: ACCENT,
  },
  tileSub: {
    color: TEXT_MUTED,
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 0.15,
  },

  slot: {
    marginBottom: 14,
    paddingHorizontal: 20,
  },
})