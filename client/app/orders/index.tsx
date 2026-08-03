import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMarketplace } from '@/context/MarketplaceContext'
import { ScreenConfigMenu } from '@/components/ScreenConfigMenu'
import api from '@/constants/api'

const statusColor: Record<string, string> = {
  Preparing: '#F0C070',
  Shipped: '#7EB6FF',
  Delivered: '#8FE3B0',
  Cancelled: '#FF8A9A',
}

const STATUS_ORDER = ['Preparing', 'Shipped', 'Delivered', 'Cancelled']

type SortMode = 'newest' | 'oldest' | 'status'

export default function BuyerOrders() {
  const { getToken } = useAuth()
  const router = useRouter()
  const { format } = useMarketplace()

  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sort, setSort] = useState<SortMode>('newest')
  const [configOpen, setConfigOpen] = useState(false)

  const fetchOrders = async () => {
    try {
      const token = await getToken()
      const res = await api.get('/orders', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) setOrders(res.data.data)
    } catch {
      // keep existing list
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

  const sorted = useMemo(() => {
    const list = [...orders]
    if (sort === 'newest') {
      list.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      )
    } else if (sort === 'oldest') {
      list.sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime()
      )
    } else {
      list.sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.orderStatus) -
          STATUS_ORDER.indexOf(b.orderStatus)
      )
    }
    return list
  }, [orders, sort])

  const clearCompleted = () => {
    Alert.alert(
      'Clear completed',
      'Hide Delivered and Cancelled orders from this list? They remain in your history on the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide',
          onPress: () => {
            setOrders((prev) =>
              prev.filter(
                (o) =>
                  o.orderStatus !== 'Delivered' &&
                  o.orderStatus !== 'Cancelled'
              )
            )
          },
        },
      ]
    )
  }

  if (loading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center bg-[#07111F]">
        <ActivityIndicator size="large" color="#DCEBFF" />
      </View>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#07111F]" edges={['top']}>
      <View className="px-5 pt-4 pb-3 flex-row items-center justify-between">
        <Text className="text-white text-2xl font-extrabold">My Orders</Text>
        <TouchableOpacity
          onPress={() => setConfigOpen(true)}
          className="p-2 -mr-1"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="options-outline" size={22} color="#DCEBFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          padding: 20,
          paddingTop: 8,
          paddingBottom: 40,
        }}
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
          <View className="items-center mt-24">
            <Ionicons name="receipt-outline" size={48} color="#4A657A" />
            <Text className="text-[#7F93A8] mt-4">No orders yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const count = item.items?.length || 0
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push(`/orders/${item._id}` as any)}
              className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mb-4"
            >
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-white font-bold">{item.orderNumber}</Text>
                <View
                  className="px-3 py-1 rounded-full"
                  style={{
                    backgroundColor:
                      (statusColor[item.orderStatus] || '#7F93A8') + '22',
                  }}
                >
                  <Text
                    style={{
                      color: statusColor[item.orderStatus] || '#7F93A8',
                    }}
                    className="text-[11px] font-semibold uppercase"
                  >
                    {item.orderStatus}
                  </Text>
                </View>
              </View>

              <Text className="text-[#8EA4B8] text-sm mb-2">
                {item.seller?.storeName || item.seller?.name || 'Seller'}
              </Text>

              <Text className="text-[#AFC3D6] text-sm">
                {count} item{count !== 1 ? 's' : ''} ·{' '}
                {format(Number(item.totalAmount) || 0)}
              </Text>

              <Text className="text-[#6B8299] text-xs mt-2">
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString()
                  : ''}
              </Text>
            </TouchableOpacity>
          )
        }}
      />

      <ScreenConfigMenu
        visible={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Order options"
        options={[
          {
            id: 'newest',
            label: 'Sort by Newest',
            icon: 'arrow-down-outline',
            selected: sort === 'newest',
            onPress: () => setSort('newest'),
          },
          {
            id: 'oldest',
            label: 'Sort by Oldest',
            icon: 'arrow-up-outline',
            selected: sort === 'oldest',
            onPress: () => setSort('oldest'),
          },
          {
            id: 'status',
            label: 'Sort by Status',
            icon: 'layers-outline',
            selected: sort === 'status',
            onPress: () => setSort('status'),
          },
          {
            id: 'clear',
            label: 'Clear Completed Orders',
            icon: 'trash-outline',
            destructive: true,
            onPress: clearCompleted,
          },
        ]}
      />
    </SafeAreaView>
  )
}