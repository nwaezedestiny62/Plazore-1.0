import { Ionicons } from '@expo/vector-icons'
import { usePathname, useRouter } from 'expo-router'
import React, { useEffect, useMemo, useRef } from 'react'
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const BG = '#0F0F0F'
const CARD = '#181818'
const BORDER = 'rgba(255,255,255,0.08)'
const TEXT = '#FFFFFF'
const TEXT_DIM = 'rgba(255,255,255,0.65)'
const ACCENT = '#C9A962'
const ICON = 'rgba(255,255,255,0.78)'

const OPEN_MS = 300
const CLOSE_MS = 260
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1)

type NavItem = {
  id: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
  href?: string
  /** Future: badge, lock, section flags */
  meta?: Record<string, unknown>
}

type NavSection = {
  id: string
  title: string
  items: NavItem[]
}

export type PlazoreNavigationHubProps = {
  visible: boolean
  onClose: () => void
  /** Future: profile, recommendations, recently viewed, music, seller shortcuts */
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
      { id: 'home', label: 'Home', icon: 'home-outline', href: '/(tabs)' },
      { id: 'cart', label: 'Cart', icon: 'bag-outline', href: '/(tabs)/cart' },
      {
        id: 'wishlist',
        label: 'Wishlist',
        icon: 'heart-outline',
        href: '/(tabs)/favorites',
      },
      {
        id: 'profile',
        label: 'Profile',
        icon: 'person-outline',
        href: '/(tabs)/profile',
      },
    ],
  },
  {
    id: 'explore',
    title: 'Explore',
    items: [
      { id: 'categories', label: 'Categories', icon: 'grid-outline', href: '/shop' },
      {
        id: 'new',
        label: 'New Arrivals',
        icon: 'sparkles-outline',
        href: '/shop',
      },
      {
        id: 'trending',
        label: 'Trending',
        icon: 'trending-up-outline',
        href: '/shop',
      },
      {
        id: 'stores',
        label: 'Featured Stores',
        icon: 'storefront-outline',
        href: '/shop',
      },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    items: [
      {
        id: 'help',
        label: 'Help Center',
        icon: 'help-circle-outline',
        href: undefined,
      },
      {
        id: 'contact',
        label: 'Contact Support',
        icon: 'chatbubble-ellipses-outline',
        href: undefined,
      },
      {
        id: 'about',
        label: 'About Plazore',
        icon: 'information-circle-outline',
        href: undefined,
      },
    ],
  },
]

function NavRow({
  item,
  active,
  onPress,
}: {
  item: NavItem
  active: boolean
  onPress: () => void
}) {
  const scale = useRef(new Animated.Value(1)).current
  const bg = useRef(new Animated.Value(0)).current

  const pressIn = () => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.98,
        duration: 120,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(bg, {
        toValue: 1,
        duration: 120,
        easing: EASE,
        useNativeDriver: false,
      }),
    ]).start()
  }

  const pressOut = () => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 160,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(bg, {
        toValue: 0,
        duration: 160,
        easing: EASE,
        useNativeDriver: false,
      }),
    ]).start()
  }

  const backgroundColor = bg.interpolate({
    inputRange: [0, 1],
    outputRange: [
      active ? 'rgba(201,169,98,0.12)' : 'transparent',
      active ? 'rgba(201,169,98,0.18)' : 'rgba(255,255,255,0.06)',
    ],
  })

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
          styles.navRow,
          {
            backgroundColor,
            transform: [{ scale }],
            borderColor: active ? 'rgba(201,169,98,0.28)' : 'transparent',
          },
        ]}
      >
        <Ionicons
          name={item.icon}
          size={20}
          color={active ? ACCENT : ICON}
        />
        <Text
          style={[
            styles.navLabel,
            active && { color: ACCENT },
          ]}
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

  const panelW = Math.round(windowW * 0.84)

  const progress = useRef(new Animated.Value(0)).current
  const [mounted, setMounted] = React.useState(visible)

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
    outputRange: [-panelW * 0.08 - panelW, 0],
  })

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.48],
  })

  const panelOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
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
    return typeof pathname === 'string' && pathname.includes(
      href.replace('/(tabs)', '').replace(/^\//, '') || '___'
    )
      ? pathname.includes(href.split('/').filter(Boolean).pop() || '')
      : pathname === href
  }

  const activeMap = useMemo(() => {
    const map: Record<string, boolean> = {}
    SECTIONS.forEach((s) =>
      s.items.forEach((item) => {
        map[item.id] = isActive(item.href)
      })
    )
    // Prefer home when at root
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

  const navigate = (item: NavItem) => {
    onClose()
    if (!item.href) return
    // slight delay so close animation can start
    requestAnimationFrame(() => {
      try {
        router.push(item.href as any)
      } catch {
        // route may not exist yet
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
      <View style={styles.root} pointerEvents="box-none">
        {/* Dim showroom — not heavy blur */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: '#000', opacity: backdropOpacity },
            ]}
          />
        </Pressable>

        {/* Panel */}
        <Animated.View
          style={[
            styles.panel,
            {
              width: panelW,
              opacity: panelOpacity,
              transform: [{ translateX }],
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.welcome}>Welcome to Plazore</Text>
            <Text style={styles.tagline}>Discover more, quietly.</Text>
          </View>

          {/* Search — UI only */}
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={TEXT_DIM} />
            <TextInput
              placeholder="Search products, stores..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.searchInput}
              editable={false}
              pointerEvents="none"
            />
          </View>

          {/* Future slots (architecture only) */}
          {slots?.profile ? (
            <View style={styles.slot}>{slots.profile}</View>
          ) : null}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {slots?.recommendations ? (
              <View style={styles.slot}>{slots.recommendations}</View>
            ) : null}
            {slots?.recentlyViewed ? (
              <View style={styles.slot}>{slots.recentlyViewed}</View>
            ) : null}
            {slots?.sellerShortcuts ? (
              <View style={styles.slot}>{slots.sellerShortcuts}</View>
            ) : null}

            {SECTIONS.map((section, idx) => (
              <View
                key={section.id}
                style={[styles.section, idx > 0 && styles.sectionGap]}
              >
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionCard}>
                  {section.items.map((item) => (
                    <NavRow
                      key={item.id}
                      item={item}
                      active={!!activeMap[item.id]}
                      onPress={() => navigate(item)}
                    />
                  ))}
                </View>
              </View>
            ))}

            {slots?.musicSettings ? (
              <View style={[styles.slot, { marginTop: 20 }]}>
                {slots.musicSettings}
              </View>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerBrand}>Plazore</Text>
            <Text style={styles.footerVersion}>Version 1.0</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: BG,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 8, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
      android: { elevation: 24 },
    }),
  },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    paddingTop: 4,
  },
  logo: {
    height: 28,
    width: 132,
    tintColor: '#FFFFFF',
    marginBottom: 16,
  },
  welcome: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  tagline: {
    color: TEXT_DIM,
    fontSize: 13,
    letterSpacing: 0.15,
  },
  searchWrap: {
    marginHorizontal: 18,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingHorizontal: 14,
    height: 46,
  },
  searchInput: {
    flex: 1,
    color: TEXT,
    fontSize: 14,
    paddingVertical: 0,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  section: {},
  sectionGap: {
    marginTop: 22,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 2,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  navLabel: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.15,
  },
  slot: {
    marginBottom: 16,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  footerBrand: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  footerVersion: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    marginTop: 2,
  },
})