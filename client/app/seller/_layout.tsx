import { Tabs, useRouter, usePathname } from 'expo-router'
import { useNavigation } from '@react-navigation/native'
import { useCallback, useEffect, useState } from 'react'
import {
  View,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  AppState,
  AppStateStatus,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '@/constants/api'

const BG = '#090B0F'
const SURFACE = '#11141A'
const LINE = 'rgba(255,255,255,0.08)'
const TEXT = '#F5F7FA'
const MUTED = '#5A6F88'
const ACTIVE = '#B8F0D0'
const GREEN = '#00E575'

const PENDING_STATUSES = new Set(['Preparing'])

/**
 * Prefer real history. If Tabs wiped it, go to the parent screen for this route.
 */
function HeaderBack() {
  const router = useRouter()
  const navigation = useNavigation()
  const pathname = usePathname() || ''

  const fallbackParent = () => {
    // Payout / shipping (opened from settings)
    if (pathname.includes('/store/payout')) {
      router.push('/seller/settings' as any)
      return
    }
    // Settings sub-pages
    if (
      pathname.includes('/settings/region') ||
      pathname.includes('/settings/notifications') ||
      pathname.includes('/settings/about')
    ) {
      router.push('/seller/settings' as any)
      return
    }
    // Store setup (usually from settings)
    if (pathname.includes('/store')) {
      router.push('/seller/settings' as any)
      return
    }
    // Product nested screens
    if (
      pathname.includes('/products/add') ||
      pathname.includes('/products/edit') ||
      pathname.includes('/products/performance') ||
      /\/products\/[^/]+$/.test(pathname)
    ) {
      router.push('/seller/products' as any)
      return
    }
    // Order detail
    if (pathname.includes('/orders/')) {
      router.push('/seller/orders' as any)
      return
    }
    // Last resort
    router.push('/seller' as any)
  }

  return (
    <TouchableOpacity
      onPress={() => {
        if (navigation.canGoBack()) {
          navigation.goBack()
          return
        }
        if (router.canGoBack()) {
          router.back()
          return
        }
        const parent = navigation.getParent?.()
        if (parent && typeof parent.canGoBack === 'function' && parent.canGoBack()) {
          parent.goBack()
          return
        }
        // Tabs has no stack history → parent by route
        fallbackParent()
      }}
      style={{ marginLeft: 8, padding: 6 }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      activeOpacity={0.8}
    >
      <Ionicons name="arrow-back" size={24} color={TEXT} />
    </TouchableOpacity>
  )
}

function TabIconWithBadge({
  name,
  color,
  size,
  count,
}: {
  name: keyof typeof Ionicons.glyphMap
  color: string
  size: number
  count: number
}) {
  const label = count > 99 ? '99+' : String(count)
  const wide = count > 9

  return (
    <View style={styles.iconWrap}>
      <Ionicons name={name} size={size - 1} color={color} />
      {count > 0 && (
        <View style={[styles.badge, wide && styles.badgeWide]}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </View>
  )
}

export default function SellerLayout() {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [pendingOrders, setPendingOrders] = useState(0)
  const [unreadChats, setUnreadChats] = useState(0)

  const refreshBadges = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return
      const headers = { Authorization: `Bearer ${token}` }

      const [ordersRes, chatsRes] = await Promise.all([
        api.get('/orders/seller/my', { headers }).catch(() => null),
        api.get('/chat/conversations', { headers }).catch(() => null),
      ])

      if (ordersRes?.data?.success) {
        const list: any[] = Array.isArray(ordersRes.data.data)
          ? ordersRes.data.data
          : []
        setPendingOrders(
          list.filter((o) =>
            PENDING_STATUSES.has(String(o?.orderStatus || ''))
          ).length
        )
      }

      if (chatsRes?.data?.success) {
        const convos: any[] = Array.isArray(chatsRes.data.data)
          ? chatsRes.data.data
          : []
        const total = convos.reduce((sum, c) => {
          const n =
            typeof c.unreadCount === 'number'
              ? c.unreadCount
              : typeof c.unreadBySeller === 'number'
                ? c.unreadBySeller
                : 0
          return sum + (n > 0 ? n : 0)
        }, 0)
        setUnreadChats(total)
      }
    } catch {
      // keep last counts
    }
  }, [getToken])

  useEffect(() => {
    if (!isLoaded) return
    const role = user?.publicMetadata?.role
    if (!user || (role !== 'seller' && role !== 'admin')) return

    refreshBadges()
    const id = setInterval(refreshBadges, 25000)
    return () => clearInterval(id)
  }, [isLoaded, user, refreshBadges])

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') refreshBadges()
    }
    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [refreshBadges])

  useEffect(() => {
    if (!isLoaded) return
    const role = user?.publicMetadata?.role
    if (!user || (role !== 'seller' && role !== 'admin')) {
      router.replace('/(tabs)')
    }
  }, [isLoaded, user])

  if (!isLoaded) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    )
  }

  const role = user?.publicMetadata?.role
  if (!user || (role !== 'seller' && role !== 'admin')) return null

  const tabHeight = 64 + Math.max(insets.bottom, 8)

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: BG,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: LINE,
        },
        headerTintColor: TEXT,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 17,
          letterSpacing: 0.3,
        },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: SURFACE,
          borderTopColor: LINE,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: MUTED,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginTop: 2,
        },
        headerRight: undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size - 1} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size - 1} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIconWithBadge
              name="receipt-outline"
              color={color}
              size={size}
              count={pendingOrders}
            />
          ),
        }}
        listeners={{
          focus: () => {
            refreshBadges()
          },
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Messages',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIconWithBadge
              name="chatbubbles-outline"
              color={color}
              size={size}
              count={unreadChats}
            />
          ),
        }}
        listeners={{
          focus: () => {
            refreshBadges()
          },
        }}
      />
      <Tabs.Screen
        name="subscription"
        options={{
          title: 'Plan',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="diamond-outline" size={size - 1} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          href: null,
          title: 'Plazore AI',
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="store"
        options={{
          href: null,
          title: 'My Store',
          headerLeft: () => <HeaderBack />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          headerShown: false,
          title: 'Seller Settings',
          headerLeft: () => <HeaderBack />,
        }}
      />
      <Tabs.Screen
        name="settings/region"
        options={{
          href: null,
          title: 'Marketplace Region',
          headerLeft: () => <HeaderBack />,
        }}
      />
      <Tabs.Screen
        name="settings/notifications"
        options={{
          href: null,
          title: 'Notifications',
          headerLeft: () => <HeaderBack />,
        }}
      />
      <Tabs.Screen
        name="settings/about"
        options={{
          href: null,
          title: 'About',
          headerLeft: () => <HeaderBack />,
        }}
      />
      <Tabs.Screen
        name="products/add"
        options={{
          href: null,
          title: 'Add Product',
          headerLeft: () => <HeaderBack />,
        }}
      />
      <Tabs.Screen
        name="products/edit/[id]"
        options={{
          href: null,
          title: 'Edit Product',
          headerLeft: () => <HeaderBack />,
        }}
      />
      <Tabs.Screen
        name="products/[id]"
        options={{
          href: null,
          title: 'Product Details',
          headerLeft: () => <HeaderBack />,
        }}
      />
      <Tabs.Screen
        name="products/performance/[id]"
        options={{
          href: null,
          title: 'Performance',
          headerLeft: () => <HeaderBack />,
        }}
      />
      <Tabs.Screen
        name="store/payout"
        options={{
          href: null,
          title: 'Payout',
          headerLeft: () => <HeaderBack />,
        }}
      />
      <Tabs.Screen
        name="orders/[id]"
        options={{
          href: null,
          title: 'Order Details',
          headerLeft: () => <HeaderBack />,
        }}
        listeners={{
          blur: () => {
            refreshBadges()
          },
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG,
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -8,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: SURFACE,
  },
  badgeWide: {
    right: -12,
    minWidth: 20,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#041412',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
})