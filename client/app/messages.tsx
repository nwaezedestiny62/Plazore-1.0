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

export default function MessagesInbox() {
  const router = useRouter()
  const { getToken, isSignedIn } = useAuth()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)

  const isFetching = useRef(false)

  const resolveMyUserId = useCallback(async (token: string) => {
    const endpoints = ['/users/me', '/users/profile', '/user/me']
    for (const endpoint of endpoints) {
      try {
        const res = await api.get(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const id = res.data?.data?._id || res.data?._id
        if (id) {
          setMyUserId(String(id))
          return String(id)
        }
      } catch {
        // try next
      }
    }
    return null
  }, [])

  const fetchConversations = useCallback(
    async (isRefresh = false) => {
      if (!isSignedIn) {
        setConversations([])
        setInitialLoading(false)
        setRefreshing(false)
        return
      }

      if (isFetching.current) return
      isFetching.current = true

      try {
        setError(null)
        if (isRefresh) setRefreshing(true)

        const token = await getToken()
        if (!token) {
          setError('Please sign in again to view your messages.')
          return
        }

        // Resolve current user id (for correct buyer/seller perspective)
        let uid = myUserId
        if (!uid) {
          uid = await resolveMyUserId(token)
        }

        const res = await api.get('/chat/conversations', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.data?.success) {
          const list: Conversation[] = Array.isArray(res.data.data)
            ? res.data.data
            : []

          // Enrich each conversation with correct role + unread if backend didn't
          const enriched = list.map((conv) => {
            if (conv.myRole && typeof conv.unreadCount === 'number') {
              return conv
            }

            const buyerId = String(conv.buyer?._id || conv.buyer || '')
            const sellerId = String(conv.seller?._id || conv.seller || '')
            const me = String(uid || '')

            let myRole: 'buyer' | 'seller' | null = null
            if (me && buyerId === me) myRole = 'buyer'
            else if (me && sellerId === me) myRole = 'seller'

            const unreadCount =
              myRole === 'buyer'
                ? conv.unreadByBuyer || 0
                : myRole === 'seller'
                  ? conv.unreadBySeller || 0
                  : (conv.unreadByBuyer || 0) + (conv.unreadBySeller || 0)

            return {
              ...conv,
              myRole,
              unreadCount,
            }
          })

          setConversations(enriched)
        } else {
          setConversations([])
          setError(res.data?.message || 'Failed to load messages')
        }
      } catch (err: any) {
        console.log('Fetch conversations error:', err?.response?.data || err)
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Network error. Please try again.'

        if (
          msg.toLowerCase().includes('network') ||
          err?.message === 'Network Error'
        ) {
          setError('No internet connection. Check your network and try again.')
        } else {
          setError(msg)
        }
      } finally {
        setInitialLoading(false)
        setRefreshing(false)
        isFetching.current = false
      }
    },
    [getToken, isSignedIn, myUserId, resolveMyUserId]
  )

  useFocusEffect(
    useCallback(() => {
      fetchConversations(false)
    }, [fetchConversations])
  )

  const onRefresh = () => {
    fetchConversations(true)
  }

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

  /** Who the current user is talking to */
  const getOtherParty = (conv: Conversation) => {
    if (conv.myRole === 'seller') {
      return {
        name: conv.buyer?.name || 'Buyer',
        image: conv.buyer?.image,
        label: 'Buyer',
      }
    }

    // buyer (default for this screen)
    return {
      name: conv.seller?.storeName || conv.seller?.name || 'Seller',
      image: conv.seller?.storeLogo || conv.seller?.image,
      label: 'Seller',
    }
  }

  const getUnread = (conv: Conversation) => {
    if (typeof conv.unreadCount === 'number') return conv.unreadCount
    if (conv.myRole === 'buyer') return conv.unreadByBuyer || 0
    if (conv.myRole === 'seller') return conv.unreadBySeller || 0
    return (conv.unreadByBuyer || 0) + (conv.unreadBySeller || 0)
  }

  // ───────── Loading ─────────
  if (initialLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#060B14]" edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#12B76A" />
          <Text className="text-[#6B8299] mt-5 text-[13px] tracking-wide">
            Loading messages…
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#060B14]" edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* ───────── Header with breathing space ───────── */}
      <View className="px-6 pt-6 pb-5">
        <View className="flex-row items-center mb-5">
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.85}
            className="w-11 h-11 rounded-2xl bg-[#0C1520] border border-[#1A2A3A] items-center justify-center mr-4"
          >
            <Ionicons name="arrow-back" size={20} color="#DCEBFF" />
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="text-[#6B8299] text-[11px] font-semibold tracking-[2.5px] uppercase mb-1">
              Lounge
            </Text>
            <Text className="text-white font-extrabold text-[26px] leading-8">
              Messages
            </Text>
          </View>
        </View>

        <Text className="text-[#7A93A8] text-[14px] leading-5 pl-1">
          Your product conversations. Chats auto-clear after 2 days of inactivity.
        </Text>
      </View>

      {/* Error */}
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
            <Text className="text-[#93C5FD] font-semibold text-[13px]">
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
          paddingBottom: 48,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-20 px-8">
            <View className="w-22 h-22 rounded-[28px] bg-[#0C1520] border border-[#1A2A3A] items-center justify-center mb-6"
              style={{ width: 88, height: 88, borderRadius: 28 }}
            >
              <Ionicons name="chatbubbles-outline" size={36} color="#12B76A" />
            </View>

            <Text className="text-white font-bold text-[20px] text-center">
              No messages yet
            </Text>

            <Text className="text-[#7A93A8] text-[14px] mt-3 text-center leading-6 px-2">
              When you message a seller about a product, the conversation will
              appear here.
            </Text>

            <View className="mt-8 px-4 py-3 rounded-2xl bg-[#0C1520] border border-[#1A2A3A]">
              <Text className="text-[#5A7088] text-[12px] text-center leading-5">
                Conversations automatically disappear after 2 days of no activity.
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const unread = getUnread(item)
          const other = getOtherParty(item)
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
              className="bg-[#0C1520] border border-[#1A2A3A] rounded-[24px] px-4 py-4 flex-row items-center"
              style={{
                borderColor: hasUnread ? 'rgba(18,183,106,0.35)' : '#1A2A3A',
              }}
            >
              {/* Avatar / product image */}
              <View className="relative">
                {product?.images?.[0] ? (
                  <Image
                    source={{ uri: product.images[0] }}
                    className="w-14 h-14 rounded-2xl bg-[#13263B]"
                  />
                ) : other.image ? (
                  <Image
                    source={{ uri: other.image }}
                    className="w-14 h-14 rounded-2xl bg-[#13263B]"
                  />
                ) : (
                  <View className="w-14 h-14 rounded-2xl bg-[#13263B] items-center justify-center">
                    <Ionicons name="person-outline" size={22} color="#6B8299" />
                  </View>
                )}

                {hasUnread && (
                  <View
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#12B76A]"
                    style={{ borderWidth: 2, borderColor: '#0C1520' }}
                  />
                )}
              </View>

              {/* Content */}
              <View className="ml-3.5 flex-1">
                <View className="flex-row items-center justify-between">
                  <Text
                    className="text-white font-bold text-[15px] flex-1 pr-2"
                    numberOfLines={1}
                  >
                    {other.name}
                  </Text>
                  <Text className="text-[#5A7088] text-[11px]">{time}</Text>
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
                        ? 'text-[#DCEBFF] font-semibold'
                        : 'text-[#5A7088]'
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
  )
}