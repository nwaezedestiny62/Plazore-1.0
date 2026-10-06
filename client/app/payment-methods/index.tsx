/**
 * Payment Methods — list / default / delete only
 * Cards are saved after a successful Paystack payment (no PAN/CVC in-app).
 */

import api from '@/constants/api'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const BG = '#090B0F'
const SURFACE = '#0E1116'
const SURFACE_2 = '#14181F'
const LINE = 'rgba(255,255,255,0.08)'
const TEXT = '#F5F7FA'
const SECONDARY = 'rgba(255,255,255,0.55)'
const MUTED = 'rgba(255,255,255,0.38)'
const GREEN = '#00E575'
const TEAL = '#14B8A6'
const BLUE = '#3B82F6'
const DANGER = '#EF4444'
const GRAD = [GREEN, TEAL, BLUE] as const

const CARD_BRANDS = [
  { key: 'Visa', color: '#1A1F71', short: 'VISA' },
  { key: 'Mastercard', color: '#EB001B', short: 'MC' },
  { key: 'Verve', color: '#004C3F', short: 'VERVE' },
  { key: 'Amex', color: '#2E77BC', short: 'AMEX' },
  { key: 'Discover', color: '#FF6000', short: 'DISC' },
  { key: 'Other', color: '#4B5563', short: 'CARD' },
] as const

function maskCard(last4?: string) {
  if (!last4) return '•••• ••••'
  return `•••• ${last4}`
}

function getBrandMeta(brand?: string) {
  return (
    CARD_BRANDS.find((b) => b.key === brand) ||
    CARD_BRANDS[CARD_BRANDS.length - 1]
  )
}

function StorePreloader() {
  const rotation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
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
      <Text style={styles.loaderLabel}>Loading cards…</Text>
    </View>
  )
}

export default function PaymentMethods() {
  const { getToken } = useAuth()
  const router = useRouter()

  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchCards = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return

      const res = await api.get('/payment-methods', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        setCards(res.data.data || [])
      }
    } catch (error) {
      console.log(error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [getToken])

  useFocusEffect(
    useCallback(() => {
      fetchCards()
    }, [fetchCards]),
  )

  const handleSetDefault = async (id: string) => {
    try {
      const token = await getToken()
      await api.put(
        `/payment-methods/${id}/default`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      fetchCards()
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Could not set default card',
      )
    }
  }

  const handleDelete = (id: string) => {
    Alert.alert('Remove card', 'This card will be removed from your account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getToken()
            await api.delete(`/payment-methods/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            fetchCards()
          } catch {
            Alert.alert('Error', 'Could not remove card')
          }
        },
      },
    ])
  }

  if (loading && !refreshing) {
    return <StorePreloader />
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={22} color={TEXT} />
          </TouchableOpacity>
          <View>
            <Text style={styles.kicker}>Account</Text>
            <Text style={styles.headerTitle}>Payment Methods</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={cards}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              fetchCards()
            }}
            tintColor={GREEN}
          />
        }
        ListHeaderComponent={
          <View style={styles.infoBanner}>
            <View style={styles.infoIcon}>
              <Ionicons name="shield-checkmark" size={18} color={GREEN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Cards stay with Paystack</Text>
              <Text style={styles.infoBody}>
                We never ask for full card numbers here. After you complete a
                payment on checkout, a secure token is saved so future orders
                are faster — only the last 4 digits appear below.
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="card-outline" size={34} color={MUTED} />
            </View>
            <Text style={styles.emptyTitle}>No saved cards yet</Text>
            <Text style={styles.emptySub}>
              Place an order and pay with Paystack. Your card details are
              tokenized securely and will show up here for next time.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)' as any)}
              activeOpacity={0.88}
              style={styles.emptyCtaOuter}
            >
              <LinearGradient
                colors={[...GRAD]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.emptyCta}
              >
                <Text style={styles.emptyCtaText}>Browse Showroom</Text>
                <Ionicons name="arrow-forward" size={16} color="#041412" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const meta = getBrandMeta(item.brand)
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                if (!item.isDefault) handleSetDefault(item._id)
              }}
              style={[
                styles.cardItem,
                item.isDefault && styles.cardItemDefault,
              ]}
            >
              <View style={styles.cardRow}>
                <View
                  style={[
                    styles.brandMark,
                    { backgroundColor: meta.color + '22' },
                  ]}
                >
                  <Text style={[styles.brandMarkText, { color: meta.color }]}>
                    {meta.short}
                  </Text>
                </View>

                <View style={styles.cardInfo}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardBrand} numberOfLines={1}>
                      {item.brand || 'Card'} {maskCard(item.last4)}
                    </Text>
                    {item.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Ionicons
                          name="checkmark-circle"
                          size={11}
                          color={GREEN}
                        />
                        <Text style={styles.defaultText}>DEFAULT</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.cardMeta} numberOfLines={1}>
                    Expires {item.expMonth}/{item.expYear}
                    {item.name ? ` · ${item.name}` : ''}
                  </Text>

                  {item.bank ? (
                    <Text style={styles.cardBank} numberOfLines={1}>
                      {item.bank}
                    </Text>
                  ) : null}

                  {!item.isDefault && (
                    <Text style={styles.tapHint}>Tap to set as default</Text>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => handleDelete(item._id)}
                  style={styles.deleteBtn}
                  hitSlop={10}
                >
                  <Ionicons name="trash-outline" size={18} color={DANGER} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )
        }}
        ListFooterComponent={
          cards.length > 0 ? (
            <Text style={styles.footerNote}>
              Managed securely · Paystack tokenisation · Plazore never stores
              full card numbers
            </Text>
          ) : null
        }
      />
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
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  kicker: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },

  listContent: {
    padding: 16,
    paddingBottom: 48,
    flexGrow: 1,
  },

  infoBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
    marginBottom: 16,
  },
  infoIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(0,229,117,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,229,117,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 4,
  },
  infoBody: {
    fontSize: 12,
    color: SECONDARY,
    lineHeight: 18,
  },

  emptyWrap: {
    alignItems: 'center',
    marginTop: 48,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 80,
    height: 80,
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
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyCtaOuter: { overflow: 'hidden', width: '100%', maxWidth: 280 },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 8,
  },
  emptyCtaText: {
    color: '#041412',
    fontWeight: '800',
    fontSize: 15,
  },

  cardItem: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    marginBottom: 12,
  },
  cardItemDefault: {
    borderColor: 'rgba(0,229,117,0.45)',
    backgroundColor: SURFACE_2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  brandMark: {
    width: 48,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  brandMarkText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  cardBrand: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    maxWidth: '70%',
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,229,117,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    gap: 3,
  },
  defaultText: {
    fontSize: 10,
    fontWeight: '700',
    color: GREEN,
  },
  cardMeta: {
    fontSize: 13,
    color: SECONDARY,
    lineHeight: 18,
  },
  cardBank: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },
  tapHint: {
    fontSize: 11,
    color: MUTED,
    marginTop: 6,
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 4,
  },

  footerNote: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 11,
    color: MUTED,
    lineHeight: 16,
    paddingHorizontal: 12,
  },
})