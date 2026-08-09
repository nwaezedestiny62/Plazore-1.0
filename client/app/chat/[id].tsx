import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@clerk/clerk-expo'
import api from '@/constants/api'
import { useMarketplace } from '@/context/MarketplaceContext'

const BRAND = {
  green: '#12B76A',
  blue: '#1570EF',
  dark: '#0B1220',
  darkCard: '#111827',
  bubbleMine: '#1570EF',
  bubbleOther: '#1F2937',
  bg: '#0B1220',
  inputBg: '#111827',
  border: '#1F2A37',
  muted: '#9CA3AF',
  subtle: '#6B7280',
  danger: '#F97066',
}

type Message = {
  _id: string
  text: string
  sender: { _id: string; name?: string; image?: string }
  createdAt: string
  readBy?: string[]
  status?: 'sending' | 'sent' | 'failed'
  localId?: string
}

type Conversation = {
  _id: string
  product?: {
    _id: string
    name?: string
    images?: string[]
    price?: number
    region?: string
  }
  buyer?: { _id: string; name?: string; image?: string }
  seller?: {
    _id: string
    name?: string
    storeName?: string
    storeLogo?: string
    image?: string
  }
  lastMessage?: { text?: string; createdAt?: string }
  updatedAt?: string
  myRole?: 'buyer' | 'seller' | null
}

export default function ChatScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>()
  const conversationId = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()
  const { getToken, isSignedIn } = useAuth()
  const { formatProduct } = useMarketplace()

  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const flatListRef = useRef<FlatList>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // ─────────────────────────────────────────────
  // Load chat — simple, no hanging side calls
  // ─────────────────────────────────────────────
  const loadChat = useCallback(async () => {
    if (!conversationId) {
      setLoading(false)
      setError('Invalid chat.')
      return
    }

    if (!isSignedIn) {
      setLoading(false)
      setError('Please sign in to view this chat.')
      return
    }

    try {
      setError(null)

      const token = await getToken()
      if (!token) {
        if (mountedRef.current) {
          setError('Please sign in again.')
          setLoading(false)
        }
        return
      }

      // 1) Messages first (main content)
      const messagesRes = await api.get(`/chat/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      })

      if (messagesRes.data?.success) {
        const list: Message[] = (messagesRes.data.data || []).map((m: Message) => ({
          ...m,
          status: 'sent' as const,
        }))
        if (mountedRef.current) setMessages(list)
      }

      // 2) Conversation details (non-blocking if fails)
      try {
        const convRes = await api.get('/chat/conversations', {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        })

        if (convRes.data?.success) {
          const found =
            (convRes.data.data || []).find((c: any) => c._id === conversationId) ||
            null

          if (found && mountedRef.current) {
            // Infer role if backend didn't send myRole
            let myRole = found.myRole as 'buyer' | 'seller' | null | undefined
            if (!myRole && myUserId) {
              if (String(found.buyer?._id) === String(myUserId)) myRole = 'buyer'
              else if (String(found.seller?._id) === String(myUserId)) myRole = 'seller'
            }
            setConversation({ ...found, myRole: myRole || found.myRole || null })
          }
        }
      } catch {
        // conversation meta failed — still show messages
      }

      // 3) Mark read (fire and forget)
      api
        .patch(
          `/chat/${conversationId}/read`,
          {},
          { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 }
        )
        .catch(() => {})
    } catch (err: any) {
      console.log('Load chat error:', err?.response?.data || err?.message || err)
      if (mountedRef.current) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Could not load this chat.'
        if (msg === 'Network Error' || String(msg).toLowerCase().includes('network')) {
          setError('No internet connection. Check your network and try again.')
        } else if (err?.code === 'ECONNABORTED') {
          setError('Request timed out. Try again.')
        } else {
          setError(msg)
        }
      }
    } finally {
      // ALWAYS clear loading
      if (mountedRef.current) setLoading(false)
    }
  }, [conversationId, getToken, isSignedIn, myUserId])

  // Run once when conversationId / auth ready — NOT on every loadChat identity change
  useEffect(() => {
    setLoading(true)
    loadChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, isSignedIn])

  // ─────────────────────────────────────────────
  // Send
  // ─────────────────────────────────────────────
  const handleSend = async () => {
    if (!text.trim() || sending || !conversationId) return

    const messageText = text.trim()
    const localId = `local_${Date.now()}`
    setText('')
    setSending(true)
    setError(null)

    const optimistic: Message = {
      _id: localId,
      localId,
      text: messageText,
      sender: { _id: myUserId || 'me' },
      createdAt: new Date().toISOString(),
      status: 'sending',
      readBy: myUserId ? [myUserId] : [],
    }
    setMessages((prev) => [...prev, optimistic])
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 40)

    try {
      const token = await getToken()
      if (!token) throw new Error('No auth token')

      const res = await api.post(
        `/chat/${conversationId}/messages`,
        { text: messageText },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
      )

      if (res.data?.success && res.data.data) {
        const real: Message = { ...res.data.data, status: 'sent' }
        if (real.sender?._id) setMyUserId(String(real.sender._id))
        setMessages((prev) => prev.map((m) => (m.localId === localId ? real : m)))
      } else {
        throw new Error(res.data?.message || 'Failed to send')
      }
    } catch (err: any) {
      console.log('Send error:', err?.response?.data || err)
      setMessages((prev) =>
        prev.map((m) => (m.localId === localId ? { ...m, status: 'failed' } : m))
      )
      setText(messageText)
      setError(
        err?.message === 'Network Error'
          ? 'Message not sent. Check your connection.'
          : err?.response?.data?.message || 'Message failed to send.'
      )
    } finally {
      setSending(false)
    }
  }

  const retryFailed = (localId?: string) => {
    if (!localId) return
    const failed = messages.find((m) => m.localId === localId)
    if (!failed) return
    setText(failed.text)
    setMessages((prev) => prev.filter((m) => m.localId !== localId))
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  const isMine = useCallback(
    (message: Message) => {
      if (message.status === 'sending' || message.status === 'failed') return true
      if (myUserId && message.sender?._id) {
        return String(message.sender._id) === String(myUserId)
      }
      if (conversation?.myRole === 'buyer' && conversation.buyer?._id) {
        return String(message.sender?._id) === String(conversation.buyer._id)
      }
      if (conversation?.myRole === 'seller' && conversation.seller?._id) {
        return String(message.sender?._id) === String(conversation.seller._id)
      }
      return false
    },
    [myUserId, conversation]
  )

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  const otherParty = useMemo(() => {
    if (!conversation) {
      return { name: 'Chat', image: undefined as string | undefined }
    }
    if (conversation.myRole === 'seller') {
      return {
        name: conversation.buyer?.name || 'Buyer',
        image: conversation.buyer?.image,
      }
    }
    return {
      name:
        conversation.seller?.storeName ||
        conversation.seller?.name ||
        'Seller',
      image: conversation.seller?.storeLogo || conversation.seller?.image,
    }
  }, [conversation])

  const getTicks = (message: Message) => {
    if (!isMine(message)) return null
    if (message.status === 'sending') {
      return <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.7)" />
    }
    if (message.status === 'failed') {
      return <Ionicons name="alert-circle" size={14} color="#FECACA" />
    }

    const otherId =
      conversation?.myRole === 'buyer'
        ? conversation?.seller?._id
        : conversation?.buyer?._id

    const readByOther =
      !!otherId &&
      Array.isArray(message.readBy) &&
      message.readBy.some((id) => String(id) === String(otherId))

    return (
      <Ionicons
        name="checkmark-done"
        size={15}
        color={readByOther ? '#93C5FD' : 'rgba(255,255,255,0.55)'}
      />
    )
  }

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: BRAND.bg,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={BRAND.blue} />
        <Text style={{ color: BRAND.muted, marginTop: 14, fontSize: 13 }}>
          Opening chat…
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 24, paddingHorizontal: 16, paddingVertical: 10 }}
        >
          <Text style={{ color: '#93C5FD', fontSize: 13, fontWeight: '600' }}>
            Go back
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  const product = conversation?.product

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <StatusBar barStyle="light-content" />

      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140 }}
      >
        <LinearGradient
          colors={['#0B1B2B', 'rgba(11,18,32,0)']}
          style={{ flex: 1 }}
        />
      </View>

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 14,
            paddingTop: 6,
            paddingBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: BRAND.border,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.85}
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: BRAND.darkCard,
              borderWidth: 1,
              borderColor: BRAND.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <Ionicons name="arrow-back" size={20} color="#E5E7EB" />
          </TouchableOpacity>

          {otherParty.image ? (
            <Image
              source={{ uri: otherParty.image }}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: BRAND.darkCard,
                marginRight: 10,
              }}
            />
          ) : (
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: BRAND.darkCard,
                borderWidth: 1,
                borderColor: BRAND.border,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <Ionicons name="person" size={18} color={BRAND.muted} />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ color: '#F9FAFB', fontSize: 16, fontWeight: '700' }}
            >
              {otherParty.name}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: BRAND.subtle, fontSize: 12, marginTop: 2 }}
            >
              Product conversation
            </Text>
          </View>
        </View>

        {/* Product card */}
        {product && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() =>
              product._id && router.push(`/product/${product._id}` as any)
            }
            style={{
              marginHorizontal: 14,
              marginTop: 12,
              marginBottom: 8,
              backgroundColor: BRAND.darkCard,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: BRAND.border,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            {product.images?.[0] ? (
              <Image
                source={{ uri: product.images[0] }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  backgroundColor: '#0F172A',
                }}
              />
            ) : (
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  backgroundColor: '#0F172A',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="image-outline" size={20} color={BRAND.subtle} />
              </View>
            )}

            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{ color: '#F3F4F6', fontSize: 14, fontWeight: '600' }}
              >
                {product.name || 'Product'}
              </Text>
              <Text
                style={{
                  color: BRAND.green,
                  fontSize: 15,
                  fontWeight: '700',
                  marginTop: 4,
                }}
              >
                {formatProduct(Number(product.price || 0), product.region)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={BRAND.subtle} />
          </TouchableOpacity>
        )}

        {/* Error */}
        {!!error && (
          <View
            style={{
              marginHorizontal: 14,
              marginBottom: 8,
              backgroundColor: 'rgba(249,112,102,0.12)',
              borderColor: 'rgba(249,112,102,0.35)',
              borderWidth: 1,
              borderRadius: 14,
              padding: 12,
            }}
          >
            <Text style={{ color: '#FECACA', fontSize: 13, textAlign: 'center' }}>
              {error}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setLoading(true)
                loadChat()
              }}
              style={{ marginTop: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#93C5FD', fontWeight: '600', fontSize: 13 }}>
                Try again
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.localId || item._id}
            contentContainerStyle={{
              paddingHorizontal: 14,
              paddingBottom: 12,
              paddingTop: 8,
              flexGrow: 1,
            }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: 60,
                  paddingHorizontal: 28,
                }}
              >
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 24,
                    backgroundColor: BRAND.darkCard,
                    borderWidth: 1,
                    borderColor: BRAND.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={30}
                    color={BRAND.blue}
                  />
                </View>
                <Text style={{ color: '#F9FAFB', fontSize: 17, fontWeight: '700' }}>
                  Start the conversation
                </Text>
                <Text
                  style={{
                    color: BRAND.muted,
                    fontSize: 13,
                    textAlign: 'center',
                    marginTop: 8,
                    lineHeight: 20,
                  }}
                >
                  Ask about condition, shipping, paperwork or anything else about
                  this piece.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const mine = isMine(item)
              return (
                <TouchableOpacity
                  activeOpacity={item.status === 'failed' ? 0.8 : 1}
                  onPress={() => {
                    if (item.status === 'failed') retryFailed(item.localId)
                  }}
                  style={{
                    marginBottom: 10,
                    maxWidth: '82%',
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 18,
                      borderBottomRightRadius: mine ? 6 : 18,
                      borderBottomLeftRadius: mine ? 18 : 6,
                      backgroundColor: mine
                        ? BRAND.bubbleMine
                        : BRAND.bubbleOther,
                      borderWidth: mine ? 0 : 1,
                      borderColor: BRAND.border,
                    }}
                  >
                    <Text style={{ color: '#F9FAFB', fontSize: 15, lineHeight: 21 }}>
                      {item.text}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: mine ? 'flex-end' : 'flex-start',
                      marginTop: 4,
                      gap: 4,
                    }}
                  >
                    <Text style={{ color: BRAND.subtle, fontSize: 10 }}>
                      {formatTime(item.createdAt)}
                    </Text>
                    {mine && getTicks(item)}
                    {item.status === 'failed' && (
                      <Text
                        style={{
                          color: BRAND.danger,
                          fontSize: 10,
                          marginLeft: 4,
                        }}
                      >
                        Tap to retry
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )
            }}
          />

          {/* Input */}
          <View
            style={{
              paddingHorizontal: 12,
              paddingTop: 8,
              paddingBottom: Platform.OS === 'ios' ? 10 : 12,
              borderTopWidth: 1,
              borderTopColor: BRAND.border,
              backgroundColor: BRAND.bg,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                backgroundColor: BRAND.inputBg,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: BRAND.border,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Message…"
                placeholderTextColor={BRAND.subtle}
                multiline
                maxLength={2000}
                style={{
                  flex: 1,
                  color: '#F9FAFB',
                  fontSize: 15,
                  maxHeight: 110,
                  paddingTop: Platform.OS === 'ios' ? 8 : 6,
                  paddingBottom: Platform.OS === 'ios' ? 8 : 6,
                  textAlignVertical: 'center',
                }}
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={!text.trim() || sending}
                activeOpacity={0.85}
                style={{
                  marginLeft: 8,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    text.trim() && !sending ? BRAND.green : '#1F2937',
                }}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons
                    name="send"
                    size={18}
                    color={text.trim() ? '#fff' : BRAND.subtle}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}