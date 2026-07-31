import { Tabs, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { View, ActivityIndicator, TouchableOpacity, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useUser } from '@clerk/clerk-expo'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function SellerLayout() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (isLoaded) {
      const role = user?.publicMetadata?.role
      if (!user || (role !== 'seller' && role !== 'admin')) {
        router.replace('/(tabs)')
      }
    }
  }, [isLoaded, user])

  if (!isLoaded) {
    return (
      <View className="flex-1 justify-center items-center bg-[#060D18]">
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
            className="mr-4 flex-row items-center bg-[#121C2B] border border-[#1E334A] px-3 py-1.5 rounded-full"
            activeOpacity={0.8}
          >
            <Ionicons name="exit-outline" size={16} color="#9EC5FF" />
            <Text className="ml-1.5 text-[#9EC5FF] font-semibold text-[12px]">
              Exit
            </Text>
          </TouchableOpacity>
        ),
      }}
    >
      {/* ===== VISIBLE TABS ONLY ===== */}
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
        name="store"
        options={{
          title: 'My Store',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size - 1} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="subscription"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="diamond-outline" size={size - 1} color={color} />
          ),
        }}
      />

      {/* ===== HIDE nested routes from tab bar ===== */}
      <Tabs.Screen
        name="products/add"
        options={{ href: null, headerShown: true, title: 'Add Product' }}
      />
      <Tabs.Screen
        name="products/edit/[id]"
        options={{ href: null, headerShown: true, title: 'Edit Product' }}
      />
      <Tabs.Screen
        name="orders/[id]"
        options={{ href: null, headerShown: true, title: 'Order Details' }}
      />
      <Tabs.Screen
        name="products/[id]"
        options={{ href: null, headerShown: true, title: 'Product Details' }}
      />
    </Tabs>
  )
}