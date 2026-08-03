import React, { useCallback, useState } from 'react'
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
import { ScreenConfigMenu } from '@/components/ScreenConfigMenu'
import api from '@/constants/api'

type NotifType =
  | 'new_order'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'order_reminder'
  | 'order_shipped_reminder'
  | 'general'

function iconForType(type: string): keyof typeof Ionicons.glyphMap {
  switch (type as NotifType) {
    case 'new_order':
      return 'cube-outline'
    case 'order_shipped':
      return 'airplane-outline'
    case 'order_delivered':
      return 'checkmark-circle-outline'
    case 'order_cancelled':
      return 'close-circle-outline'
    case 'order_reminder':
    case 'order_shipped_reminder':
      return 'time-outline'
    default:
      return 'notifications-outline'
  }
}

function accentForType(type: string, isRead: boolean) {
  if (isRead) return { bg: '#1A2F45', icon: '#8EA4B8' }
  switch (type as NotifType) {
    case 'order_cancelled':
      return { bg: '#FF8A9A', icon: '#1A0A0C' }
    case 'order_delivered':
      return { bg: '#8FE3B0', icon: '#07111F' }
    case 'order_shipped':
      return { bg: '#7EB6FF', icon: '#07111F' }
    case 'new_order':
      return { bg: '#DCEBFF', icon: '#07111F' }
    default:
      return { bg: '#DCEBFF', icon: '#07111F' }
  }
}

export default function Notifications() {
  const { getToken } = useAuth()
  const router = useRouter()

  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)

  const fetchNotifications = async () => {
    try {
      const token = await getToken()
      const res = await api.get('/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        setNotifications(res.data.data)
      }
    } catch {
      // keep list
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
    } catch {
      // ignore
    }
  }

  const handlePress = async (item: any) => {
    if (!item.isRead) {
      await markAsRead(item._id)
    }

    if (!item.order) return

    if (
      item.type === 'new_order' ||
      item.type === 'order_reminder' ||
      item.type === 'order_shipped_reminder'
    ) {
      router.push(`/seller/orders/${item.order}` as any)
      return
    }

    router.push(`/orders/${item.order}` as any)
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
    } catch {
      // ignore
    }
  }

  const clearRead = () => {
    Alert.alert(
      'Clear read notifications',
      'Remove notifications you have already read from this list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setNotifications((prev) => prev.filter((n) => !n.isRead))
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
        <View className="flex-row items-center flex-1">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Notifications</Text>
        </View>

        <View className="flex-row items-center">
          {notifications.some((n) => !n.isRead) && (
            <TouchableOpacity onPress={markAllRead} className="mr-2">
              <Text className="text-[#DCEBFF] text-sm font-medium">
                Mark all read
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setConfigOpen(true)}
            className="p-2 -mr-1"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="options-outline" size={22} color="#DCEBFF" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={notifications}
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
        renderItem={({ item }) => {
          const colors = accentForType(item.type, item.isRead)
          return (
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
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: colors.bg }}
                >
                  <Ionicons
                    name={iconForType(item.type)}
                    size={20}
                    color={colors.icon}
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
                  {!!item.orderNumber && (
                    <Text className="text-[#6B8299] text-[11px] mt-1.5">
                      {item.orderNumber}
                    </Text>
                  )}
                  <Text className="text-[#6B8299] text-[11px] mt-1">
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString()
                      : ''}
                  </Text>
                </View>

                {!item.isRead && (
                  <View className="w-2.5 h-2.5 rounded-full bg-[#DCEBFF] mt-2" />
                )}
              </View>
            </TouchableOpacity>
          )
        }}
      />

      <ScreenConfigMenu
        visible={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Notification options"
        options={[
          {
            id: 'mark',
            label: 'Mark All as Read',
            icon: 'checkmark-done-outline',
            onPress: markAllRead,
          },
          {
            id: 'clear',
            label: 'Clear Read Notifications',
            icon: 'trash-outline',
            destructive: true,
            onPress: clearRead,
          },
        ]}
      />
    </SafeAreaView>
  )
}