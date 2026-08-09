import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@clerk/clerk-expo'
import api from '@/constants/api'

type Conversation = {
  _id: string
  product?: {
    _id: string
    name?: string
    images?: string[]
    price?: number
  }
  buyer?: {
    _id: string
    name?: string
    image?: string
  }
  seller?: {
    _id: string
    name?: string
    storeName?: string
    storeLogo?: string
    image?: string
  }
  lastMessage?: {
    text?: string
    createdAt?: string
  }
  unreadByBuyer?: number
  unreadBySeller?: number
  unreadCount?: number
  myRole?: 'buyer' | 'seller' | null
  updatedAt?: string
  createdAt?: string
}

export default function SellerChat() {
  const router = useRouter()
  const { getToken, isSignedIn } = useAuth()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFetching = useRef(false)
  const mountedRef = useRef(true)

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchConversations = useCallback(
    async (isRefresh = false) => {
      if (!isSignedIn) {
        if (mountedRef.current) {
          setConversations([])
          setInitialLoading(false)
          setRefreshing(false)
        }
        return
      }

      if (isFetching.current) return
      isFetching.current = true

      try {
        if (mountedRef.current) {
          setError(null)
          if (isRefresh) setRefreshing(true)
        }

        const token = await getToken()
        if (!token) {
          if (mountedRef.current) setError('Please sign in again.')
          return
        }

        const res = await api.get('/chat/conversations', {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        })

        if (res.data?.success) {
          const list: Conversation[] = Array.isArray(res.data.data)
            ? res.data.data
            : []

          // Seller only: keep chats where we are the seller, use unreadBySeller
          const sellerChats = list
            .map((conv) => {
              const unread =
                typeof conv.unreadCount === 'number' && conv.myRole === 'seller'
                  ? conv.unreadCount
                  : conv.unreadBySeller || 0

              return {
                ...conv,
                myRole: 'seller' as const,
                unreadCount: unread,
              }
            })

          if (mountedRef.current) setConversations(sellerChats)
        } else {
          if (mountedRef.current) {
            setConversations([])
            setError(res.data?.message || 'Failed to load chats')
          }
        }
      } catch (err: any) {
        console.log('Seller chat fetch error:', err?.response?.data || err)
        if (mountedRef.current) {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            'Network error. Please try again.'
          if (msg === 'Network Error' || String(msg).toLowerCase().includes('network')) {
            setError('No internet connection. Check your network and try again.')
          } else {
            setError(msg)
          }
        }
      } finally {
        if (mountedRef.current) {
          setInitialLoading(false)
          setRefreshing(false)
        }
        isFetching.current = false
      }
    },
    [getToken, isSignedIn]
  )

  useFocusEffect(
    useCallback(() => {
      fetchConversations(false)
    }, [fetchConversations])
  )

  const onRefresh = () => fetchConversations(true)

  const formatTime = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    if (days === 1) return 'Yesterday'
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' })
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
  }

  const getUnread = (conv: Conversation) =>
    typeof conv.unreadCount === 'number'
      ? conv.unreadCount
      : conv.unreadBySeller || 0

  const getBuyerName = (conv: Conversation) => conv.buyer?.name || 'Buyer'

  if (initialLoading) {
    return (
      <View className="flex-1 bg-[#060D18] justify-center items-center">
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#12B76A" />
        <Text className="text-[#5A6F88] mt-5 text-[13px]">Loading chats…</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#060D18]">
      <StatusBar barStyle="light-content" />

      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header — breathing space */}
        <View className="px-6 pt-6 pb-5">
          <Text className="text-[#5A6F88] text-[11px] font-semibold tracking-[2.5px] uppercase mb-1">
            Seller Lounge
          </Text>
          <Text className="text-[#E8F1FF] font-extrabold text-[26px] leading-8">
            Chats
          </Text>
          <Text className="text-[#5A6F88] text-[14px] mt-2 leading-5">
            Messages from buyers about your products. Chats clear after 2 days of inactivity.
          </Text>
        </View>

        {!!error && (
          <View className="mx-6 mb-4 bg-[#140E12] border border-[#3A1F2A] rounded-2xl px-5 py-4">
            <Text className="text-[#FF8A9A] text-[13px] text-center leading-5">
              {error}
            </Text>
            <TouchableOpacity
              onPress={() => fetchConversations(false)}
              activeOpacity={0.8}
              className="mt-3 items-center"
            >
              <Text className="text-[#9EC5FF] font-semibold text-[13px]">
                Try again
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: 120,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-20 px-8">
              <View
                className="bg-[#0C1520] border border-[#1A2A3A] items-center justify-center mb-6"
                style={{ width: 88, height: 88, borderRadius: 28 }}
              >
                <Ionicons name="chatbubbles-outline" size={36} color="#12B76A" />
              </View>

              <Text className="text-[#E8F1FF] font-bold text-[20px] text-center">
                No chats yet
              </Text>

              <Text className="text-[#5A6F88] text-[14px] mt-3 text-center leading-6">
                When a buyer messages you about one of your products, it will show up here.
              </Text>

              <View className="mt-8 px-4 py-3 rounded-2xl bg-[#0C1520] border border-[#1A2A3A]">
                <Text className="text-[#3A4A5C] text-[12px] text-center leading-5">
                  Conversations automatically disappear after 2 days of no activity.
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const unread = getUnread(item)
            const product = item.product
            const lastText = item.lastMessage?.text || 'No messages yet'
            const time = formatTime(
              item.lastMessage?.createdAt || item.updatedAt || item.createdAt
            )
            const hasUnread = unread > 0

            return (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => router.push(`/chat/${item._id}` as any)}
                className="bg-[#0C1520] border rounded-[24px] px-4 py-4 flex-row items-center"
                style={{
                  borderColor: hasUnread ? 'rgba(18,183,106,0.4)' : '#1A2A3A',
                }}
              >
                <View className="relative">
                  {product?.images?.[0] ? (
                    <Image
                      source={{ uri: product.images[0] }}
                      className="w-14 h-14 rounded-2xl bg-[#13263B]"
                    />
                  ) : item.buyer?.image ? (
                    <Image
                      source={{ uri: item.buyer.image }}
                      className="w-14 h-14 rounded-2xl bg-[#13263B]"
                    />
                  ) : (
                    <View className="w-14 h-14 rounded-2xl bg-[#13263B] items-center justify-center">
                      <Ionicons name="person-outline" size={22} color="#5A6F88" />
                    </View>
                  )}
                  {hasUnread && (
                    <View
                      className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#12B76A]"
                      style={{ borderWidth: 2, borderColor: '#0C1520' }}
                    />
                  )}
                </View>

                <View className="ml-3.5 flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text
                      className="text-[#E8F1FF] font-bold text-[15px] flex-1 pr-2"
                      numberOfLines={1}
                    >
                      {getBuyerName(item)}
                    </Text>
                    <Text className="text-[#5A6F88] text-[11px]">{time}</Text>
                  </View>

                  <Text
                    className="text-[#7A93A8] text-[12.5px] mt-1"
                    numberOfLines={1}
                  >
                    {product?.name || 'Product conversation'}
                  </Text>

                  <View className="flex-row items-center mt-2">
                    <Text
                      className={`text-[13px] flex-1 leading-5 ${
                        hasUnread
                          ? 'text-[#B8D4FF] font-semibold'
                          : 'text-[#5A6F88]'
                      }`}
                      numberOfLines={1}
                    >
                      {lastText}
                    </Text>

                    {hasUnread && (
                      <View className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#12B76A] items-center justify-center ml-2">
                        <Text className="text-[#04140C] text-[10px] font-bold">
                          {unread > 99 ? '99+' : unread}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      </SafeAreaView>
    </View>
  )
}