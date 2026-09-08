import api from '@/constants/api'
import {
  AnnouncementCard,
  type AnnouncementData,
} from '@/components/AnnouncementCard'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const BG = '#090B0F'
const SURFACE = '#11141A'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#6B7280'
const GREEN = '#00E575'
const BLUE = '#3B82F6'

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
  }, [rotation])

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
      <Text style={styles.loaderLabel}>Loading announcement</Text>
    </View>
  )
}

export default function AnnouncementDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>()
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()
  const { getToken } = useAuth()

  // Stable ref so getToken is never a useEffect dependency
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  const [item, setItem] = useState<AnnouncementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Load once per id — do NOT put getToken / load in the dependency array
  useEffect(() => {
    if (!id) {
      setLoading(false)
      setError('Missing announcement id')
      return
    }

    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError('')
      setItem(null)

      try {
        const res = await api.get('/announcements?limit=30')
        if (cancelled) return

        const list: AnnouncementData[] = res.data?.data || []
        const found = list.find((a) => String(a._id) === String(id))

        if (found) {
          setItem(found)
          return
        }

        // Optional detail route
        try {
          const token = await getTokenRef.current()
          if (cancelled) return
          const one = await api.get(`/announcements/${id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
          if (cancelled) return
          if (one.data?.data) {
            setItem(one.data.data)
          } else {
            setError('Announcement not found or no longer available.')
          }
        } catch {
          if (!cancelled) {
            setError('Announcement not found or no longer available.')
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Could not load announcement')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [id]) // ← only id

  const retry = () => {
    // Force re-run by toggling — simplest: remount logic via id
    setLoading(true)
    setError('')
    setItem(null)
    ;(async () => {
      try {
        const res = await api.get('/announcements?limit=30')
        const list: AnnouncementData[] = res.data?.data || []
        const found = list.find((a) => String(a._id) === String(id))
        if (found) {
          setItem(found)
          return
        }
        setError('Announcement not found or no longer available.')
      } catch (e: any) {
        setError(e?.message || 'Could not load announcement')
      } finally {
        setLoading(false)
      }
    })()
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Announcement</Text>
          <Text style={styles.headerSub}>From Plazore</Text>
        </View>
      </View>

      {loading ? (
        <PlazoreOrbPreloader />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={retry} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : item ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <AnnouncementCard
            data={item}
            onAction={(route) => {
              if (route.startsWith('/')) router.push(route as any)
            }}
          />
          <View style={styles.footNote}>
            <Ionicons name="lock-closed-outline" size={14} color={MUTED} />
            <Text style={styles.footText}>
              This is a one-way notice. You can’t reply to announcements.
            </Text>
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

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
  loaderLabel: {
    marginTop: 18,
    fontSize: 13,
    color: MUTED,
    fontWeight: '600',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    gap: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.2,
  },
  headerSub: { fontSize: 11, color: MUTED, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: { color: SECONDARY, textAlign: 'center', marginBottom: 12 },
  retry: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  retryText: { color: GREEN, fontWeight: '700' },
  footNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  footText: { flex: 1, fontSize: 12, color: MUTED, lineHeight: 17 },
})