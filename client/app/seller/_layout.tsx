import { Tabs, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { View, ActivityIndicator, TouchableOpacity, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useUser } from '@clerk/clerk-expo'

export default function SellerLayout() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

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
      <View className="flex-1 justify-center items-center bg-[#07111F]">
        <ActivityIndicator size="large" color="#DCEBFF" />
      </View>
    )
  }

  const role = user?.publicMetadata?.role
  if (!user || (role !== 'seller' && role !== 'admin')) return null

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0A1422' },
        headerTintColor: '#DCEBFF',
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: '#0A1422',
          borderTopColor: '#1E334A',
          height: 70,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: '#DCEBFF',
        tabBarInactiveTintColor: '#6B8299',
        headerRight: () => (
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)')}
            className="mr-4 flex-row items-center"
          >
            <Ionicons name="exit-outline" size={22} color="#DCEBFF" />
            <Text className="ml-1.5 text-[#DCEBFF] font-medium text-[13px]">Exit</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}