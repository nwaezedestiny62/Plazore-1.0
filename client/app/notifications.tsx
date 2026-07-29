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
import { SafeAreaView } from 'react-native-safe-area-context'
import api from '@/constants/api'

export default function Notifications() {
  const { getToken } = useAuth()
  const router = useRouter()

  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchNotifications = async () => {
    try {
      const token = await getToken()
      const res = await api.get('/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        setNotifications(res.data.data)
      }
    } catch (error) {
      console.log(error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchNotifications()
    }, [])
  )

  const markAsRead = async (id: string) => {
    try {
      const token = await getToken()
      await api.patch(
        `/notifications/${id}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      )
    } catch (error) {
      console.log(error)
    }
  }

  const handlePress = async (item: any) => {
    if (!item.isRead) {
      await markAsRead(item._id)
    }

    // If it's an order notification, go to the right place
    if (item.order) {
      // Sellers go to seller order details, buyers to buyer order details
      // Simple approach: try seller path first if type is new_order
      if (item.type === 'new_order') {
        router.push(`/seller/orders/${item.order}` as any)
      } else {
        router.push(`/orders/${item.order}` as any)
      }
    }
  }

  const markAllRead = async () => {
    try {
      const token = await getToken()
      await api.patch(
        '/notifications/read-all',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch (error) {
      console.log(error)
    }
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
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Notifications</Text>
        </View>

        {notifications.some((n) => !n.isRead) && (
          <TouchableOpacity onPress={markAllRead}>
            <Text className="text-[#DCEBFF] text-sm font-medium">
              Mark all read
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              fetchNotifications()
            }}
            tintColor="#DCEBFF"
          />
        }
        ListEmptyComponent={
          <View className="items-center mt-24">
            <Ionicons name="notifications-outline" size={48} color="#4A657A" />
            <Text className="text-[#7F93A8] mt-4">No notifications yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handlePress(item)}
            className={`rounded-[20px] p-4 mb-3 border ${
              item.isRead
                ? 'bg-[#0B1625] border-[#1E334A]'
                : 'bg-[#12243A] border-[#2A4560]'
            }`}
          >
            <View className="flex-row items-start">
              <View
                className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                  item.isRead ? 'bg-[#1A2F45]' : 'bg-[#DCEBFF]'
                }`}
              >
                <Ionicons
                  name={
                    item.type === 'new_order'
                      ? 'cube-outline'
                      : item.type === 'order_shipped'
                      ? 'airplane-outline'
                      : 'notifications-outline'
                  }
                  size={20}
                  color={item.isRead ? '#8EA4B8' : '#07111F'}
                />
              </View>

              <View className="flex-1">
                <Text
                  className={`font-semibold text-[15px] ${
                    item.isRead ? 'text-[#AFC3D6]' : 'text-white'
                  }`}
                >
                  {item.title}
                </Text>
                <Text className="text-[#8EA4B8] text-[13px] mt-1 leading-5">
                  {item.message}
                </Text>
                <Text className="text-[#6B8299] text-[11px] mt-2">
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>

              {!item.isRead && (
                <View className="w-2.5 h-2.5 rounded-full bg-[#DCEBFF] mt-2" />
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}