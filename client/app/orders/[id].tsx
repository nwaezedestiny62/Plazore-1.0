import api from '@/constants/api'
import {
  convertPrice,
  DEFAULT_REGION,
  formatMoney,
  formatProductPrice,
} from '@/constants/regions'
import { useMarketplace } from '@/context/MarketplaceContext'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#6B7280'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const DANGER = '#EF4444'

const steps = ['Preparing', 'Shipped', 'Delivered']

function resolveOrderRegion(order: any, item?: any): string {
  if (item?.product?.region) return String(item.product.region)
  if (item?.region) return String(item.region)
  if (order?.region) return String(order.region)
  if (order?.seller?.marketplaceRegion) {
    return String(order.seller.marketplaceRegion)
  }
  return DEFAULT_REGION
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

export default function BuyerOrderDetails() {
  const rawId = useLocalSearchParams<{ id: string | string[] }>().id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const { getToken } = useAuth()
  const router = useRouter()
  const {
    format,
    formatProduct,
    region: viewerRegion,
    refreshRegion,
  } = useMarketplace()

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [toastVisible, setToastVisible] = useState(false)

  const toastAnim = useRef(new Animated.Value(0)).current
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const displayRegion = viewerRegion || DEFAULT_REGION

  const fmt = useCallback(
    (amount: number, fromRegion?: string | null) => {
      try {
        if (fromRegion && fromRegion !== displayRegion) {
          return formatProduct
            ? formatProduct(amount, fromRegion)
            : formatProductPrice(amount, fromRegion, displayRegion)
        }
        return format ? format(amount) : formatMoney(amount, displayRegion)
      } catch {
        const converted = convertPrice(
          amount,
          fromRegion || displayRegion,
          displayRegion
        )
        return formatMoney(converted, displayRegion)
      }
    },
    [format, formatProduct, displayRegion]
  )

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false)
        return
      }
      try {
        await refreshRegion()
        const token = await getToken()
        const res = await api.get(`/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.data.success) setOrder(res.data.data)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const orderMoneyRegion = useMemo(() => {
    if (!order) return DEFAULT_REGION
    return resolveOrderRegion(order, order.items?.[0])
  }, [order])

  const showToast = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToastVisible(true)
    toastAnim.setValue(0)

    Animated.spring(toastAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 80,
    }).start()

    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setToastVisible(false)
      })
    }, 2200)
  }

  const copyTracking = async (value: string) => {
    try {
      await Clipboard.setStringAsync(value)
      showToast()
    } catch {
      // silent
    }
  }

  if (loading) {
    return <PlazoreOrbPreloader />
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={36} color={MUTED} />
          <Text style={styles.emptyTitle}>Order not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const isCancelled = order.orderStatus === 'Cancelled'
  const currentStep = Math.max(0, steps.indexOf(order.orderStatus))
  const shipping = order.shipping || {}
  const method =
    shipping.shippingMethod ||
    order.productShipping?.method ||
    (shipping.deliveryCompany ? 'courier' : undefined)

  const isSelf = method === 'self'
  const sellerNote = (shipping.selfDeliveryNote || '').trim()
  const tracking = (shipping.trackingNumber || '').trim()
  const hasShippingBlock =
    !isCancelled &&
    (order.orderStatus === 'Shipped' ||
      order.orderStatus === 'Delivered' ||
      !!shipping.shippedAt)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top toast */}
      {toastVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toastWrap,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.toast}>
            <Ionicons name="checkmark-circle" size={18} color={GREEN} />
            <Text style={styles.toastText}>Tracking Number Copied</Text>
          </View>
        </Animated.View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {order.orderNumber}
          </Text>
          <Text style={styles.headerSub}>
            {new Date(order.createdAt).toLocaleString()}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isCancelled ? (
          <View style={styles.cancelCard}>
            <View style={styles.cancelTop}>
              <View style={styles.cancelIcon}>
                <Ionicons name="close-circle" size={22} color={DANGER} />
              </View>
              <Text style={styles.cancelTitle}>
                {order.cancellation?.cancelledBy === 'seller'
                  ? 'Cancelled by Seller'
                  : 'Order Cancelled'}
              </Text>
            </View>
            <Text style={styles.cancelBody}>
              Unfortunately, the seller was unable to fulfill your order.
            </Text>
            {(order.cancellation?.reasonLabel || order.cancellation?.note) && (
              <View style={styles.cancelReason}>
                <Text style={styles.cancelReasonLabel}>Reason</Text>
                <Text style={styles.cancelReasonText}>
                  “
                  {order.cancellation.reasonLabel || order.cancellation.note}
                  ”
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Order Progress</Text>
            <View style={styles.stepsWrap}>
              {steps.map((step, index) => {
                const isActive = index <= currentStep
                const isCurrent = index === currentStep
                const isLast = index === steps.length - 1
                return (
                  <View key={step} style={styles.stepRow}>
                    <View style={styles.stepLeft}>
                      {isActive ? (
                        <LinearGradient
                          colors={[GREEN, BLUE]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.stepDotGradient}
                        >
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        </LinearGradient>
                      ) : (
                        <View style={styles.stepDot}>
                          <Text style={styles.stepNum}>{index + 1}</Text>
                        </View>
                      )}
                      {!isLast &&
                        (index < currentStep ? (
                          <LinearGradient
                            colors={[GREEN, BLUE]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.stepLineGradient}
                          />
                        ) : (
                          <View style={styles.stepLine} />
                        ))}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        isCurrent && styles.stepLabelCurrent,
                        isActive && !isCurrent && styles.stepLabelDone,
                      ]}
                    >
                      {step}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.metaLabel}>Sold by</Text>
          <Text style={styles.sellerName}>
            {order.seller?.storeName || order.seller?.name || 'Seller'}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Items</Text>
        {order.items?.map((item: any, idx: number) => {
          const itemRegion = resolveOrderRegion(order, item)
          const unit = Number(item.price) || 0
          return (
            <View key={idx} style={styles.itemCard}>
              <View style={styles.itemRow}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="image-outline" size={20} color={MUTED} />
                  </View>
                )}
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemMeta}>
                    Qty {item.quantity} · {fmt(unit, itemRegion)}
                  </Text>
                </View>
              </View>
              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>Your note</Text>
                <Text style={styles.noteText}>
                  {item.note?.trim() ? item.note : 'No note added.'}
                </Text>
              </View>
            </View>
          )
        })}

        {hasShippingBlock && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Shipping Details</Text>

            <View style={styles.detailBlock}>
              <Text style={styles.metaLabel}>Method</Text>
              <Text style={styles.detailValue}>
                {isSelf ? 'Self Delivery' : 'Courier'}
              </Text>
            </View>

            {!!shipping.deliveryCompany && (
              <View style={styles.detailBlock}>
                <Text style={styles.metaLabel}>Courier Company</Text>
                <Text style={styles.detailValue}>
                  {shipping.deliveryCompany}
                </Text>
              </View>
            )}

            {!!tracking && (
              <View style={styles.detailBlock}>
                <Text style={styles.metaLabel}>Tracking Number</Text>
                <TouchableOpacity
                  onPress={() => copyTracking(tracking)}
                  activeOpacity={0.8}
                  style={styles.trackingBox}
                >
                  <Text style={styles.trackingText} selectable numberOfLines={1}>
                    {tracking}
                  </Text>
                  <View style={styles.copyBtn}>
                    <Ionicons name="copy-outline" size={15} color={SECONDARY} />
                    <Text style={styles.copyText}>Copy</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {!!sellerNote && (
              <View style={styles.sellerNoteBox}>
                <Text style={styles.metaLabel}>Note from seller</Text>
                <Text style={styles.detailValue}>{sellerNote}</Text>
              </View>
            )}

            {!!shipping.estimatedDelivery && (
              <View style={styles.detailBlock}>
                <Text style={styles.metaLabel}>Estimated Delivery</Text>
                <Text style={styles.detailValue}>
                  {new Date(shipping.estimatedDelivery).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        )}

        {!isCancelled && order.orderStatus === 'Preparing' && (
          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons name="cube-outline" size={18} color={BLUE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Preparing your order</Text>
              <Text style={styles.infoBody}>
                The seller is packing your items. Tracking and seller notes
                appear after they mark it as shipped.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Address</Text>
          <Text style={styles.addressText}>
            {order.shippingAddress?.street}
            {'\n'}
            {order.shippingAddress?.city}, {order.shippingAddress?.state}
            {'\n'}
            {order.shippingAddress?.country}
            {'\n'}
            {order.shippingAddress?.zipCode}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Receipt</Text>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Subtotal</Text>
            <Text style={styles.receiptValue}>
              {fmt(Number(order.subtotal) || 0, orderMoneyRegion)}
            </Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Delivery</Text>
            <Text style={styles.receiptValue}>
              {fmt(Number(order.shippingCost) || 0, orderMoneyRegion)}
            </Text>
          </View>
          <View style={styles.receiptDivider} />
          <View style={styles.receiptRow}>
            <Text style={styles.totalLabel}>Order Total</Text>
            <Text style={styles.totalValue}>
              {fmt(Number(order.totalAmount) || 0, orderMoneyRegion)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: { color: SECONDARY, fontSize: 15, marginTop: 12 },
  emptyBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  emptyBtnText: { color: TEXT, fontWeight: '600', fontSize: 14 },

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

  toastWrap: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 20,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  toastText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  backBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.2,
  },
  headerSub: { fontSize: 11, color: MUTED, marginTop: 2 },
  headerRight: { width: 42 },

  scrollContent: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 14,
  },

  cancelCard: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239,68,68,0.25)',
    padding: 16,
    marginBottom: 12,
  },
  cancelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  cancelIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelTitle: { fontSize: 16, fontWeight: '700', color: DANGER },
  cancelBody: { fontSize: 13, color: SECONDARY, lineHeight: 20 },
  cancelReason: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(239,68,68,0.2)',
  },
  cancelReasonLabel: { fontSize: 11, color: MUTED, marginBottom: 4 },
  cancelReasonText: { fontSize: 14, color: TEXT, lineHeight: 20 },

  stepsWrap: {},
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 48,
  },
  stepLeft: {
    alignItems: 'center',
    width: 30,
    marginRight: 12,
  },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotGradient: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 11, fontWeight: '600', color: MUTED },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 18,
    backgroundColor: LINE,
    marginVertical: 3,
  },
  stepLineGradient: {
    width: 2,
    flex: 1,
    minHeight: 18,
    marginVertical: 3,
  },
  stepLabel: {
    fontSize: 14,
    color: MUTED,
    fontWeight: '500',
    paddingTop: 5,
  },
  stepLabelCurrent: { color: TEXT, fontWeight: '700' },
  stepLabelDone: { color: SECONDARY },

  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sellerName: { fontSize: 17, fontWeight: '700', color: TEXT },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
    marginLeft: 2,
  },

  itemCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
    marginBottom: 10,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: SURFACE_2,
  },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1, marginLeft: 12, minWidth: 0 },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
    lineHeight: 19,
  },
  itemMeta: { fontSize: 12, color: SECONDARY, marginTop: 3 },
  noteBox: {
    marginTop: 12,
    backgroundColor: SURFACE_2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  noteText: { fontSize: 13, color: SECONDARY, lineHeight: 18 },

  detailBlock: { marginBottom: 14 },
  detailValue: { fontSize: 15, fontWeight: '600', color: TEXT },
  trackingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE_2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  trackingText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 12,
    paddingLeft: 12,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: LINE,
  },
  copyText: { fontSize: 12, fontWeight: '600', color: SECONDARY },
  sellerNoteBox: {
    backgroundColor: SURFACE_2,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },

  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59,130,246,0.2)',
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 3,
  },
  infoBody: { fontSize: 12, color: SECONDARY, lineHeight: 18 },

  addressText: { fontSize: 14, color: SECONDARY, lineHeight: 22 },

  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  receiptLabel: { fontSize: 13, color: SECONDARY },
  receiptValue: { fontSize: 13, fontWeight: '600', color: TEXT },
  receiptDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
    marginVertical: 8,
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: TEXT },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.4,
  },
})