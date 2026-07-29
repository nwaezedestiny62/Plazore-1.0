import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import api from '@/constants/api'

const statusColor: Record<string, string> = {
  Preparing: '#F0C070',
  Shipped: '#7EB6FF',
  Delivered: '#8FE3B0',
  Cancelled: '#FF8A9A',
}

export default function SellerOrders() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchOrders = async () => {
    try {
      const token = await getToken()
      const res = await api.get('/orders/seller/my', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) setOrders(res.data.data)
    } catch (error) {
      console.log(error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchOrders()
    }, [])
  )

  if (loading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center bg-[#07111F]">
        <ActivityIndicator size="large" color="#DCEBFF" />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#07111F]">
      <View className="px-5 pt-4 pb-3">
        <Text className="text-white text-xl font-bold">Incoming Orders</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              fetchOrders()
            }}
            tintColor="#DCEBFF"
          />
        }
        ListEmptyComponent={
          <View className="items-center mt-20">
            <Ionicons name="receipt-outline" size={48} color="#4A657A" />
            <Text className="text-[#7F93A8] mt-4">No orders yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/seller/orders/${item._id}` as any)}
            className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mb-4"
          >
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-white font-bold">{item.orderNumber}</Text>
              <View
                className="px-3 py-1 rounded-full"
                style={{ backgroundColor: statusColor[item.orderStatus] + '22' }}
              >
                <Text
                  style={{ color: statusColor[item.orderStatus] }}
                  className="text-[11px] font-semibold uppercase"
                >
                  {item.orderStatus}
                </Text>
              </View>
            </View>

            <Text className="text-[#8EA4B8] text-sm">
              {item.buyer?.name || 'Buyer'} • {item.items?.length} items
            </Text>
            <Text className="text-[#AFC3D6] mt-1">${item.totalAmount?.toFixed(2)}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}