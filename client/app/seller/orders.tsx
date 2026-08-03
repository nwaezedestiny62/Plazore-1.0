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
type OrderSort = 'newest' | 'oldest' | 'status' | 'delivery'

export default function SellerOrders() {
  const { getToken } = useAuth()
  const router = useRouter()
  const { format } = useMarketplace()

  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sort, setSort] = useState<OrderSort>('newest')
  const [configOpen, setConfigOpen] = useState(false)

  const fetchOrders = async () => {
    try {
      const token = await getToken()
      const res = await api.get('/orders/seller/my', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) setOrders(res.data.data)
    } catch {
      // keep list
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
    } else if (sort === 'status') {
      list.sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.orderStatus) -
          STATUS_ORDER.indexOf(b.orderStatus)
      )
    } else if (sort === 'delivery') {
      list.sort((a, b) => {
        const da = a.shipping?.estimatedDelivery
          ? new Date(a.shipping.estimatedDelivery).getTime()
          : Number.MAX_SAFE_INTEGER
        const db = b.shipping?.estimatedDelivery
          ? new Date(b.shipping.estimatedDelivery).getTime()
          : Number.MAX_SAFE_INTEGER
        return da - db
      })
    }
    return list
  }, [orders, sort])

  const archiveCompleted = () => {
    Alert.alert(
      'Archive completed',
      'Hide Delivered and Cancelled orders from this list? (Future-ready — server archive comes later.)',
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
    <View className="flex-1 bg-[#07111F]">
      <View className="px-5 pt-4 pb-3 flex-row items-center justify-between">
        <Text className="text-white text-xl font-bold">Incoming Orders</Text>
        <TouchableOpacity onPress={() => setConfigOpen(true)} className="p-2">
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
                style={{
                  backgroundColor:
                    (statusColor[item.orderStatus] || '#7F93A8') + '22',
                }}
              >
                <Text
                  style={{ color: statusColor[item.orderStatus] || '#7F93A8' }}
                  className="text-[11px] font-semibold uppercase"
                >
                  {item.orderStatus}
                </Text>
              </View>
            </View>
            <Text className="text-[#8EA4B8] text-sm">
              {item.buyer?.name || 'Buyer'} · {item.items?.length || 0} items
            </Text>
            <Text className="text-[#AFC3D6] mt-1">
              {format(Number(item.totalAmount) || 0)}
            </Text>
          </TouchableOpacity>
        )}
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
            id: 'delivery',
            label: 'Sort by Delivery Date',
            icon: 'calendar-outline',
            selected: sort === 'delivery',
            onPress: () => setSort('delivery'),
          },
          {
            id: 'archive',
            label: 'Archive Completed Orders',
            icon: 'archive-outline',
            destructive: true,
            onPress: archiveCompleted,
          },
        ]}
      />
    </View>
  )
}