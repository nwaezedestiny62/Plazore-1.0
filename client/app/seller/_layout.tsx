import { Tabs, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { View, ActivityIndicator, TouchableOpacity, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useUser } from '@clerk/clerk-expo'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

function HeaderBack() {
  const router = useRouter()
  return (
    <TouchableOpacity
      onPress={() => {
        if (router.canGoBack()) router.back()
        else router.replace('/seller' as any)
      }}
      style={{ marginLeft: 8, padding: 6 }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      activeOpacity={0.8}
    >
      <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
    </TouchableOpacity>
  )
}

function HeaderBackToSettings() {
  const router = useRouter()
  return (
    <TouchableOpacity
      onPress={() => router.push('/seller/settings' as any)}
      style={{ marginLeft: 8, padding: 6 }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      activeOpacity={0.8}
    >
      <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
    </TouchableOpacity>
  )
}

export default function SellerLayout() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (!isLoaded) return
    const role = user?.publicMetadata?.role
    if (!user || (role !== 'seller' && role !== 'admin')) {
      router.replace('/(tabs)')
    }
  }, [isLoaded, user])

  if (!isLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#060D18',
        }}
      >
        <ActivityIndicator size="large" color="#9EC5FF" />
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
          backgroundColor: '#060D18',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#152536',
        },
        headerTintColor: '#E8F1FF',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 17,
          letterSpacing: 0.3,
        },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: '#080F1A',
          borderTopColor: '#152536',
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#B8D4FF',
        tabBarInactiveTintColor: '#5A6F88',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginTop: 2,
        },
        headerRight: () => (
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)')}
            style={{
              marginRight: 16,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#121C2B',
              borderWidth: 1,
              borderColor: '#1E334A',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="exit-outline" size={16} color="#9EC5FF" />
            <Text
              style={{
                marginLeft: 6,
                color: '#9EC5FF',
                fontWeight: '600',
                fontSize: 12,
              }}
            >
              Exit
            </Text>
          </TouchableOpacity>
        ),
      }}
    >
      {/* ===== VISIBLE TABS ===== */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size - 1} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size - 1} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size - 1} color={color} />
          ),
        }}
      />
      <Tabs.Screen
  name="chat"
  options={{
    title: 'Chat',
    headerShown: false,
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="chatbubbles-outline" size={size - 1} color={color} />
    ),
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" size={size - 1} color={color} />
          ),
        }}
      />

      {/* ===== HIDDEN (href: null) ===== */}
      <Tabs.Screen
        name="store"
        options={{
          href: null,
          title: 'My Store',
          headerLeft: () => <HeaderBackToSettings />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          title: 'Seller Settings',
          headerLeft: () => <HeaderBack />,
        }}
      />
      <Tabs.Screen
        name="settings/region"
        options={{
          href: null,
          title: 'Marketplace Region',
          headerLeft: () => <HeaderBackToSettings />,
        }}
      />
      <Tabs.Screen
        name="settings/notifications"
        options={{
          href: null,
          title: 'Notifications',
          headerLeft: () => <HeaderBackToSettings />,
        }}
      />
      <Tabs.Screen
        name="settings/about"
        options={{
          href: null,
          title: 'About',
          headerLeft: () => <HeaderBackToSettings />,
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
        name="orders/[id]"
        options={{
          href: null,
          title: 'Order Details',
          headerLeft: () => <HeaderBack />,
        }}
      />
    </Tabs>
  )
}