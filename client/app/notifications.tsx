import api from '@/constants/api'
import { ScreenConfigMenu } from '@/components/ScreenConfigMenu'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#6B7280'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const DANGER = '#EF4444'

/** Locally dismissed notification ids — survive refresh / focus */
const CLEARED_KEY = 'plazore_cleared_notification_ids'

type NotifType =
  | 'new_order'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'order_reminder'
  | 'order_shipped_reminder'
  | 'general'

type OverlayAction = {
  label: string
  onPress: () => void
  destructive?: boolean
  primary?: boolean
}

type OverlayState = {
  title: string
  message?: string
  tone?: 'info' | 'success' | 'danger'
  actions?: OverlayAction[]
  durationMs?: number
} | null

async function loadClearedIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(CLEARED_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr.map(String) : [])
  } catch {
    return new Set()
  }
}

async function saveClearedIds(ids: Set<string>) {
  try {
    await AsyncStorage.setItem(CLEARED_KEY, JSON.stringify([...ids]))
  } catch {
    // ignore storage errors
  }
}

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
  if (isRead) return { bg: SURFACE_2, icon: MUTED }
  switch (type as NotifType) {
    case 'order_cancelled':
      return { bg: 'rgba(239,68,68,0.18)', icon: DANGER }
    case 'order_delivered':
      return { bg: 'rgba(0,229,117,0.15)', icon: GREEN }
    case 'order_shipped':
      return { bg: 'rgba(59,130,246,0.15)', icon: BLUE }
    case 'new_order':
      return { bg: 'rgba(0,229,117,0.12)', icon: GREEN }
    default:
      return { bg: SURFACE_2, icon: TEXT }
  }
}

function toneColor(
  tone?: NonNullable<OverlayState>['tone']
) {
  if (tone === 'danger') return DANGER
  if (tone === 'success') return GREEN
  return BLUE
}

function TopOverlay({
  state,
  onDismiss,
}: {
  state: OverlayState
  onDismiss: () => void
}) {
  const insets = useSafeAreaInsets()
  const translateY = useRef(new Animated.Value(-120)).current
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  useEffect(() => {
    clearTimer()
    if (!state) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start()
      return
    }

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 9,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()

    if (!state.actions?.length) {
      const ms = state.durationMs ?? 4 * 60 * 1000
      timer.current = setTimeout(() => onDismiss(), ms)
    }

    return clearTimer
  }, [state])

  if (!state) return null

  const accent = toneColor(state.tone)
  const hasActions = !!state.actions?.length

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.overlayWrap,
        {
          paddingTop: insets.top + 8,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={[styles.overlayCard, hasActions && styles.overlayCardTall]}>
        <View style={[styles.overlayAccent, { backgroundColor: accent }]} />

        <View style={styles.overlayBody}>
          <View style={styles.overlayTopRow}>
            <View
              style={[styles.overlayIcon, { backgroundColor: `${accent}22` }]}
            >
              <Ionicons
                name={
                  state.tone === 'danger'
                    ? 'warning-outline'
                    : state.tone === 'success'
                      ? 'checkmark-circle-outline'
                      : 'information-circle-outline'
                }
                size={18}
                color={accent}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.overlayTitle} numberOfLines={2}>
                {state.title}
              </Text>
              {!!state.message && (
                <Text style={styles.overlayMessage} numberOfLines={4}>
                  {state.message}
                </Text>
              )}
            </View>
            {!hasActions && (
              <Pressable
                onPress={onDismiss}
                hitSlop={12}
                style={styles.overlayClose}
              >
                <Ionicons name="close" size={18} color={MUTED} />
              </Pressable>
            )}
          </View>

          {hasActions && (
            <View style={styles.overlayActions}>
              {state.actions!.map((a, i) => (
                <Pressable
                  key={`${a.label}-${i}`}
                  onPress={() => {
                    onDismiss()
                    requestAnimationFrame(() => a.onPress())
                  }}
                  style={[
                    styles.overlayBtn,
                    a.destructive && styles.overlayBtnDanger,
                    a.primary && styles.overlayBtnPrimary,
                    !a.destructive && !a.primary && styles.overlayBtnGhost,
                  ]}
                >
                  <Text
                    style={[
                      styles.overlayBtnText,
                      a.destructive && { color: '#FFF' },
                      a.primary && { color: BG },
                      !a.destructive && !a.primary && { color: TEXT },
                    ]}
                  >
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  )
}

function PlazoreOrbPreloader() {
  const rotation = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [])
  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })
  return (
    <View style={styles.loaderRoot}>
      <View style={styles.orbWrapper}>
        <Animated.View style={[styles.orbRing, { transform: [{ rotate }] }]} />
        <View style={styles.orbLogoWrap}>
          <Image
            source={require('@/assets/logo-1.png')}
            style={styles.orbLogo}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  )
}

export default function Notifications() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [overlay, setOverlay] = useState<OverlayState>(null)
  const clearedRef = useRef<Set<string>>(new Set())

  const dismissOverlay = useCallback(() => setOverlay(null), [])

  const applyClearedFilter = useCallback((list: any[]) => {
    const cleared = clearedRef.current
    if (!cleared.size) return list
    return list.filter((n) => !cleared.has(String(n._id)))
  }, [])

  const fetchNotifications = async () => {
    try {
      // Always load local dismiss list first
      clearedRef.current = await loadClearedIds()

      const token = await getToken()
      const res = await api.get('/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        const raw = res.data.data || []
        setNotifications(applyClearedFilter(raw))
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
    // Optimistic local
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
    )
    try {
      const token = await getToken()
      await api.patch(
        `/notifications/${id}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch {
      // stay local
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
    // Local first — always works
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setOverlay({
      title: 'All caught up',
      message: 'Every notification is marked as read.',
      tone: 'success',
      durationMs: 5000,
    })
    try {
      const token = await getToken()
      await api.patch(
        '/notifications/read-all',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch {
      // already updated locally
    }
  }

  /** Wipe read items from UI + remember ids so refetch won't bring them back */
  const runClearRead = async () => {
    if (clearing) return
    setClearing(true)

    const toClear = notifications.filter((n) => n.isRead)
    const ids = toClear.map((n) => String(n._id))

    // 1) Vanish immediately in UI
    setNotifications((prev) => prev.filter((n) => !n.isRead))

    // 2) Persist so they stay gone after pull-to-refresh / focus
    const next = new Set(clearedRef.current)
    ids.forEach((id) => next.add(id))
    clearedRef.current = next
    await saveClearedIds(next)

    setOverlay({
      title: 'Read notifications cleared',
      message: 'They’re gone from this list on your device.',
      tone: 'success',
      durationMs: 5000,
    })

    // 3) Best-effort server (optional — local already done)
    try {
      const token = await getToken()
      try {
        await api.delete('/notifications/read', {
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {
        try {
          await api.post(
            '/notifications/clear-read',
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          )
        } catch {
          // fine — local clear is the source of truth
        }
      }
    } catch {
      // fine
    } finally {
      setClearing(false)
    }
  }

  const clearRead = () => {
    const readCount = notifications.filter((n) => n.isRead).length
    if (readCount === 0) {
      setOverlay({
        title: 'Nothing to clear',
        message: 'You have no read notifications yet.',
        tone: 'info',
        durationMs: 8000,
      })
      return
    }

    setOverlay({
      title: 'Clear read notifications?',
      message: `Remove ${readCount} read notification${readCount !== 1 ? 's' : ''} from this list?`,
      tone: 'danger',
      actions: [
        { label: 'Cancel', onPress: () => {} },
        {
          label: clearing ? 'Clearing…' : 'Clear',
          destructive: true,
          onPress: runClearRead,
        },
      ],
    })
  }

  if (loading && !refreshing) {
    return <PlazoreOrbPreloader />
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopOverlay state={overlay} onDismiss={dismissOverlay} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={22} color={TEXT} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSub}>
              {unreadCount > 0
                ? `${unreadCount} unread`
                : `${notifications.length} total`}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} hitSlop={8}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setConfigOpen(true)}
            style={styles.configBtn}
            hitSlop={10}
          >
            <Ionicons name="options-outline" size={18} color={TEXT} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              fetchNotifications()
            }}
            tintColor={GREEN}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-outline" size={34} color={MUTED} />
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySub}>
              Order updates and alerts will show up here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const colors = accentForType(item.type, item.isRead)
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handlePress(item)}
              style={[styles.card, !item.isRead && styles.cardUnread]}
            >
              <View style={styles.cardRow}>
                <View
                  style={[styles.iconWrap, { backgroundColor: colors.bg }]}
                >
                  <Ionicons
                    name={iconForType(item.type)}
                    size={18}
                    color={colors.icon}
                  />
                </View>
                <View style={styles.cardBody}>
                  <Text
                    style={[
                      styles.cardTitle,
                      item.isRead && styles.cardTitleRead,
                    ]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <Text style={styles.cardMessage} numberOfLines={3}>
                    {item.message}
                  </Text>
                  {!!item.orderNumber && (
                    <Text style={styles.cardOrder}>{item.orderNumber}</Text>
                  )}
                  <Text style={styles.cardDate}>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString()
                      : ''}
                  </Text>
                </View>
                {!item.isRead && <View style={styles.unreadDot} />}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  overlayWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 100,
    paddingHorizontal: 14,
  },
  overlayCard: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    minHeight: 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  overlayCardTall: { minHeight: 88 },
  overlayAccent: { width: 3 },
  overlayBody: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  overlayTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  overlayIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  overlayMessage: {
    color: SECONDARY,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
  },
  overlayClose: { padding: 2 },
  overlayActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  overlayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 72,
    alignItems: 'center',
  },
  overlayBtnGhost: {
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  overlayBtnPrimary: { backgroundColor: TEXT },
  overlayBtnDanger: { backgroundColor: DANGER },
  overlayBtnText: { fontSize: 13, fontWeight: '700' },

  loaderRoot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbWrapper: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2.4,
    borderColor: 'transparent',
    borderTopColor: GREEN,
    borderRightColor: BLUE,
    borderBottomColor: 'transparent',
    borderLeftColor: GREEN,
  },
  orbLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,229,117,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbLogo: { width: 32, height: 32 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  headerSub: { fontSize: 11, color: MUTED, marginTop: 1 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: SECONDARY,
  },
  configBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  listContent: { padding: 16, paddingBottom: 40 },
  emptyWrap: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 28,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },

  card: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
    marginBottom: 10,
  },
  cardUnread: {
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: SURFACE_2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
    lineHeight: 19,
  },
  cardTitleRead: { color: SECONDARY, fontWeight: '600' },
  cardMessage: {
    fontSize: 13,
    color: SECONDARY,
    marginTop: 4,
    lineHeight: 18,
  },
  cardOrder: { fontSize: 11, color: MUTED, marginTop: 6 },
  cardDate: { fontSize: 11, color: MUTED, marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
    marginTop: 6,
    marginLeft: 8,
  },
})