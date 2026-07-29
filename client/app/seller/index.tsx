import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import api from '@/constants/api'

export default function SellerDashboard() {
  const { getToken, isSignedIn } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    storeName: '',
    isVerified: false,
    recentOrders: [] as any[],
  })

  const fetchStats = async () => {
    try {
      const token = await getToken()
      const res = await api.get('/seller/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        setStats(res.data.data)
      }
    } catch (error) {
      console.log('Seller dashboard error:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (isSignedIn) fetchStats()
  }, [isSignedIn])

  if (loading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center bg-[#07111F]">
        <ActivityIndicator size="large" color="#DCEBFF" />
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-[#07111F]"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true)
            fetchStats()
          }}
          tintColor="#DCEBFF"
        />
      }
    >
      {/* Header */}
      <View className="mb-8">
        <Text className="text-[#8EA4B8] text-[13px] tracking-widest uppercase">Seller Lounge</Text>
        <Text className="text-white text-3xl font-extrabold mt-1">
          {stats.storeName || 'Your Store'}
        </Text>
        {!stats.isVerified && (
          <View className="mt-3 self-start bg-[#2A1F12] border border-[#5A3A1A] px-3 py-1.5 rounded-full">
            <Text className="text-[#F0C070] text-[11px] font-semibold">Pending Verification</Text>
          </View>
        )}
      </View>

      {/* Stats Grid */}
      <View className="flex-row flex-wrap justify-between mb-8">
        <StatCard label="Revenue" value={`$${stats.totalRevenue.toFixed(0)}`} icon="cash-outline" />
        <StatCard label="Orders" value={String(stats.totalOrders)} icon="receipt-outline" />
        <StatCard label="Products" value={String(stats.totalProducts)} icon="cube-outline" />
        <StatCard label="Active" value={String(stats.activeProducts)} icon="checkmark-circle-outline" />
      </View>

      {/* Quick Actions */}
      <View className="mb-8">
        <Text className="text-white text-lg font-bold mb-4">Quick Actions</Text>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => router.push('/seller/products')}
            activeOpacity={0.85}
            className="flex-1"
          >
            <LinearGradient
              colors={['#152636', '#0D1A28']}
              className="rounded-[24px] border border-[#1E334A] p-5 items-center"
            >
              <Ionicons name="add-circle-outline" size={28} color="#DCEBFF" />
              <Text className="text-[#DCEBFF] font-semibold mt-2 text-[14px]">Add Product</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/seller/orders')}
            activeOpacity={0.85}
            className="flex-1"
          >
            <LinearGradient
              colors={['#152636', '#0D1A28']}
              className="rounded-[24px] border border-[#1E334A] p-5 items-center"
            >
              <Ionicons name="list-outline" size={28} color="#DCEBFF" />
              <Text className="text-[#DCEBFF] font-semibold mt-2 text-[14px]">View Orders</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Orders */}
      <View>
        <Text className="text-white text-lg font-bold mb-4">Recent Orders</Text>
        {stats.recentOrders.length === 0 ? (
          <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-8 items-center">
            <Ionicons name="receipt-outline" size={36} color="#4A657A" />
            <Text className="text-[#7F93A8] mt-3">No orders yet</Text>
          </View>
        ) : (
          stats.recentOrders.map((order: any) => (
            <View
              key={order._id}
              className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mb-3"
            >
              <View className="flex-row justify-between items-center">
                <Text className="text-white font-semibold">{order.orderNumber}</Text>
                <Text className="text-[#8EA4B8] text-xs">
                  {new Date(order.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text className="text-[#AFC3D6] mt-2 text-sm">
                {order.items?.length || 0} items • ${order.totalAmount?.toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: any
}) {
  return (
    <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 w-[48%] mb-4">
      <Ionicons name={icon} size={22} color="#DCEBFF" />
      <Text className="text-white text-2xl font-extrabold mt-3">{value}</Text>
      <Text className="text-[#7F93A8] text-[12px] mt-1 uppercase tracking-wide">{label}</Text>
    </View>
  )
}