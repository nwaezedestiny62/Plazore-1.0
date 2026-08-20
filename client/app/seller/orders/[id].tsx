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
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
const MUTED = '#737A86'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const DANGER = '#EF4444'
const WARN = '#F0C070'

const CANCEL_OPTIONS = [
  { code: 'out_of_stock', label: 'Product is out of stock' },
  { code: 'unable_to_deliver', label: 'Unable to deliver to the destination' },
  { code: 'shipping_limitations', label: 'Shipping limitations' },
  { code: 'incorrect_inventory', label: 'Incorrect inventory' },
  { code: 'temporary_closure', label: 'Temporary business closure' },
  { code: 'other', label: 'Other' },
] as const

type OverlayAction = {
  label: string
  onPress: () => void
  primary?: boolean
  destructive?: boolean
}

type OverlayState = {
  title: string
  message?: string
  tone?: 'info' | 'success' | 'danger'
  durationMs?: number
  actions?: OverlayAction[]
} | null

function resolveOrderRegion(order: any, item?: any): string {
  if (item?.product?.region) return String(item.product.region)
  if (item?.region) return String(item.region)
  if (order?.region) return String(order.region)
  if (order?.seller?.marketplaceRegion) {
    return String(order.seller.marketplaceRegion)
  }
  return DEFAULT_REGION
}

function PlazoreOrb({ size = 110 }: { size?: number }) {
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
  const logoBox = size * 0.51
  const logoImg = size * 0.29
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.4,
          borderColor: 'transparent',
          borderTopColor: GREEN,
          borderRightColor: BLUE,
          borderBottomColor: 'transparent',
          borderLeftColor: GREEN,
          transform: [{ rotate }],
        }}
      />
      <View
        style={{
          width: logoBox,
          height: logoBox,
          borderRadius: logoBox / 2,
          backgroundColor: 'rgba(0,229,117,0.1)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={require('@/assets/logo-1.png')}
          style={{ width: logoImg, height: logoImg }}
          resizeMode="contain"
        />
      </View>
    </View>
  )
}

function TopOverlay({
  state,
  onDismiss,
}: {
  state: OverlayState
  onDismiss: () => void
}) {
  const insets = useSafeAreaInsets()
  const translateY = useRef(new Animated.Value(-140)).current
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!state) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -140, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start()
      return
    }
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
    if (!state.actions?.length) {
      timer.current = setTimeout(() => onDismiss(), state.durationMs ?? 3800)
    }
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state])

  if (!state) return null
  const accent =
    state.tone === 'danger' ? DANGER : state.tone === 'success' ? GREEN : BLUE

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 300,
        paddingTop: insets.top + 8,
        paddingHorizontal: 14,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <View style={styles.overlayCard}>
        <View style={{ width: 3, backgroundColor: accent }} />
        <View style={{ flex: 1, padding: 14 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.overlayTitle}>{state.title}</Text>
              {!!state.message && (
                <Text style={styles.overlayMsg}>{state.message}</Text>
              )}
            </View>
            {!state.actions?.length && (
              <Pressable onPress={onDismiss} hitSlop={12}>
                <Ionicons name="close" size={18} color={MUTED} />
              </Pressable>
            )}
          </View>
          {!!state.actions?.length && (
            <View style={styles.overlayActions}>
              {state.actions.map((a) => (
                <TouchableOpacity
                  key={a.label}
                  onPress={() => {
                    onDismiss()
                    setTimeout(() => a.onPress(), 40)
                  }}
                  activeOpacity={0.85}
                  style={[
                    styles.overlayBtn,
                    a.primary && styles.overlayBtnPrimary,
                    a.destructive && styles.overlayBtnDanger,
                  ]}
                >
                  <Text
                    style={[
                      styles.overlayBtnText,
                      a.primary && { color: '#041412' },
                      a.destructive && { color: DANGER },
                    ]}
                  >
                    {a.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  )
}

/** Short, calm “Delivered” celebration — not noisy */
function DeliveredBurst({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const scale = useRef(new Animated.Value(0.6)).current
  const opacity = useRef(new Animated.Value(0)).current
  const check = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) return
    scale.setValue(0.6)
    opacity.setValue(0)
    check.setValue(0)
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]),
      Animated.timing(check, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => onDone())
  }, [visible])

  if (!visible) return null

  return (
    <View style={styles.burstRoot} pointerEvents="none">
      <Animated.View style={[styles.burstCard, { opacity, transform: [{ scale }] }]}>
        <LinearGradient
          colors={[GREEN, BLUE]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.burstRing}
        >
          <View style={styles.burstInner}>
            <Animated.View style={{ opacity: check, transform: [{ scale: check }] }}>
              <Ionicons name="checkmark" size={36} color={GREEN} />
            </Animated.View>
          </View>
        </LinearGradient>
        <Text style={styles.burstTitle}>Delivered</Text>
        <Text style={styles.burstSub}>Buyer will see the update</Text>
      </Animated.View>
    </View>
  )
}

function statusTone(status: string, cancelledBySeller?: boolean) {
  if (status === 'Cancelled') return DANGER
  if (status === 'Delivered') return GREEN
  if (status === 'Shipped') return BLUE
  return WARN
}

export default function SellerOrderDetails() {
  const { id } = useLocalSearchParams<{ id: string }>()
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
  const [submitting, setSubmitting] = useState(false)

  const [trackingNumber, setTrackingNumber] = useState('')
  const [estimatedDelivery, setEstimatedDelivery] = useState('')
  const [sellerNote, setSellerNote] = useState('')

  const [showCancel, setShowCancel] = useState(false)
  const [cancelCode, setCancelCode] = useState('')
  const [cancelNote, setCancelNote] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const [overlay, setOverlay] = useState<OverlayState>(null)
  const [showDeliveredBurst, setShowDeliveredBurst] = useState(false)

  const displayRegion = viewerRegion || DEFAULT_REGION

  const toast = useCallback(
    (
      title: string,
      message?: string,
      tone: 'info' | 'success' | 'danger' = 'info'
    ) => setOverlay({ title, message, tone, durationMs: 3800 }),
    []
  )

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

  const loadOrder = async () => {
    try {
      setLoading(true)
      const token = await getToken()
      const res = await api.get(`/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) setOrder(res.data.data)
    } catch {
      toast('Error', 'Could not load order', 'danger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshRegion()
    loadOrder()
  }, [id])

  const orderMoneyRegion = useMemo(() => {
    if (!order) return DEFAULT_REGION
    return resolveOrderRegion(order, order.items?.[0])
  }, [order])

  const impliedMethod =
    order?.productShipping?.method === 'self' ? 'self' : 'courier'
  const courierName = order?.productShipping?.courierCompany || ''

  const handleShip = async () => {
    if (!estimatedDelivery.trim()) {
      toast('Required', 'Enter an estimated delivery date (YYYY-MM-DD)', 'danger')
      return
    }
    try {
      setSubmitting(true)
      const token = await getToken()
      const body: any = {
        estimatedDelivery: estimatedDelivery.trim(),
        selfDeliveryNote: sellerNote.trim().slice(0, 120),
      }
      if (impliedMethod === 'courier') {
        body.trackingNumber = trackingNumber.trim()
        body.deliveryCompany = courierName
      }
      const res = await api.put(`/orders/${id}/ship`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        setOrder(res.data.data)
        toast('Shipped', 'Order marked as shipped. Buyer has been notified.', 'success')
      }
    } catch (error: any) {
      toast('Error', error.response?.data?.message || 'Failed to ship order', 'danger')
    } finally {
      setSubmitting(false)
    }
  }

  /** Confirm first — Cancel does nothing; Confirm runs deliver + burst */
  const requestDeliver = () => {
    setOverlay({
      title: 'Confirm delivery',
      message:
        'Only confirm if the buyer has received this order.\n\n' +
        '• Status will change to Delivered\n' +
        '• The buyer will be notified\n' +
        '• This cannot be undone from here\n\n' +
        'Is this order really delivered?',
      tone: 'info',
      actions: [
        {
          label: 'Not yet',
          onPress: () => {
            // intentional no-op
          },
        },
        {
          label: 'Yes, delivered',
          primary: true,
          onPress: () => {
            performDeliver()
          },
        },
      ],
    })
  }

  const performDeliver = async () => {
    try {
      setSubmitting(true)
      const token = await getToken()
      const res = await api.put(
        `/orders/${id}/deliver`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setOrder(res.data.data)
        setShowDeliveredBurst(true)
      }
    } catch (error: any) {
      toast(
        'Error',
        error.response?.data?.message || 'Failed to update status',
        'danger'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmCancel = async () => {
    if (!cancelCode) {
      toast('Required', 'Select a cancellation reason', 'danger')
      return
    }
    if (cancelCode === 'other' && !cancelNote.trim()) {
      toast('Required', 'Add a short explanation', 'danger')
      return
    }
    try {
      setCancelling(true)
      const token = await getToken()
      const res = await api.put(
        `/orders/${id}/cancel`,
        {
          reasonCode: cancelCode,
          note: cancelNote.trim().slice(0, 200),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setOrder(res.data.data)
        setShowCancel(false)
        setCancelCode('')
        setCancelNote('')
        toast('Order cancelled', 'The buyer has been notified with your reason.', 'success')
      }
    } catch (error: any) {
      toast(
        'Error',
        error.response?.data?.message || 'Could not cancel order',
        'danger'
      )
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loaderRoot}>
        <PlazoreOrb size={110} />
        <Text style={styles.loaderHint}>Loading order</Text>
      </View>
    )
  }

  if (!order) {
    return (
      <View style={styles.loaderRoot}>
        <Text style={{ color: MUTED }}>Order not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: GREEN, fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const isPreparing = order.orderStatus === 'Preparing'
  const isShipped = order.orderStatus === 'Shipped'
  const isDelivered = order.orderStatus === 'Delivered'
  const isCancelled = order.orderStatus === 'Cancelled'
  const tone = statusTone(order.orderStatus)

  return (
    <View style={styles.root}>
      <TopOverlay state={overlay} onDismiss={() => setOverlay(null)} />
      <DeliveredBurst
        visible={showDeliveredBurst}
        onDone={() => {
          setShowDeliveredBurst(false)
          toast('Delivered', 'Order marked as delivered.', 'success')
        }}
      />

      <View style={styles.topBar}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.orderNo} numberOfLines={1}>
            {order.orderNumber}
          </Text>
          <Text style={styles.orderDate}>
            {new Date(order.createdAt).toLocaleString()}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Status */}
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Current status</Text>
          <Text style={[styles.statusBig, { color: tone }]}>
            {isCancelled && order.cancellation?.cancelledBy === 'seller'
              ? 'Cancelled by Seller'
              : order.orderStatus}
          </Text>
        </View>

        {isCancelled && order.cancellation && (
          <View style={[styles.card, styles.cancelCard]}>
            <Text style={{ color: DANGER, fontWeight: '700', fontSize: 16 }}>
              Cancellation
            </Text>
            {!!order.cancellation.cancelledAt && (
              <Text style={styles.meta}>
                {new Date(order.cancellation.cancelledAt).toLocaleString()}
              </Text>
            )}
            <Text style={[styles.eyebrow, { marginTop: 10 }]}>Reason</Text>
            <Text style={styles.body}>
              {order.cancellation.reasonLabel ||
                order.cancellation.note ||
                '—'}
            </Text>
          </View>
        )}

        {/* Buyer */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Buyer</Text>
          <Text style={styles.eyebrow}>Name</Text>
          <Text style={styles.bodyStrong}>
            {order.buyerContact?.name || order.buyer?.name || 'Buyer'}
          </Text>
          <Text style={[styles.eyebrow, { marginTop: 12 }]}>Phone</Text>
          <Text style={styles.body}>
            {order.buyerContact?.phone || order.buyer?.phone || 'Not provided'}
          </Text>
          <View style={styles.addressBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="location" size={16} color={BLUE} />
              <Text style={[styles.bodyStrong, { marginLeft: 8 }]}>
                Delivery address
              </Text>
            </View>
            <Text style={styles.body}>
              {order.shippingAddress?.street}
              {'\n'}
              {order.shippingAddress?.city}, {order.shippingAddress?.state}{' '}
              {order.shippingAddress?.zipCode}
              {'\n'}
              {order.shippingAddress?.country}
            </Text>
          </View>
        </View>

        {/* Products */}
        <Text style={styles.blockLabel}>Products</Text>
        {order.items?.map((item: any, index: number) => {
          const itemRegion = resolveOrderRegion(order, item)
          const unit = Number(item.price) || 0
          return (
            <View key={index} style={styles.card}>
              <View style={{ flexDirection: 'row' }}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]} />
                )}
                <View style={{ marginLeft: 12, flex: 1, justifyContent: 'center' }}>
                  <Text style={styles.bodyStrong} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.meta}>
                    Qty: {item.quantity} · {fmt(unit, itemRegion)}
                  </Text>
                </View>
              </View>
              <View style={styles.noteBox}>
                <Text style={styles.eyebrow}>Buyer note</Text>
                <Text style={styles.body}>
                  {item.note?.trim() ? item.note : 'No buyer note.'}
                </Text>
              </View>
            </View>
          )
        })}

        {/* Preparing actions */}
        {isPreparing && (
          <>
            <View style={styles.actionRow}>
              <View style={[styles.actionHint, { flex: 1 }]}>
                <Ionicons name="airplane-outline" size={20} color={BLUE} />
                <Text style={styles.actionHintTitle}>Ship order</Text>
                <Text style={styles.actionHintSub}>Use form below</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCancel(true)}
                activeOpacity={0.85}
                style={[styles.actionHint, styles.actionCancel, { flex: 1 }]}
              >
                <Ionicons name="close-circle-outline" size={20} color={DANGER} />
                <Text style={[styles.actionHintTitle, { color: DANGER }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ship this order</Text>
              <Text style={[styles.meta, { marginBottom: 14 }]}>
                Delivery method was set when the product was published.
              </Text>

              <View style={styles.methodPill}>
                <Ionicons
                  name={impliedMethod === 'self' ? 'walk-outline' : 'car-outline'}
                  size={18}
                  color={BLUE}
                />
                <Text style={styles.methodText}>
                  {impliedMethod === 'self'
                    ? 'Self delivery'
                    : `Courier${courierName ? ` · ${courierName}` : ''}`}
                </Text>
              </View>

              <Text style={styles.label}>Estimated delivery date *</Text>
              <TextInput
                value={estimatedDelivery}
                onChangeText={setEstimatedDelivery}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#3D5268"
                style={styles.input}
              />

              {impliedMethod === 'courier' && (
                <>
                  <Text style={styles.label}>Tracking number</Text>
                  <TextInput
                    value={trackingNumber}
                    onChangeText={setTrackingNumber}
                    placeholder="Optional"
                    placeholderTextColor="#3D5268"
                    style={styles.input}
                  />
                </>
              )}

              <Text style={styles.label}>Note to buyer</Text>
              <TextInput
                value={sellerNote}
                onChangeText={(t) => setSellerNote(t.slice(0, 120))}
                placeholder="Optional note"
                placeholderTextColor="#3D5268"
                multiline
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              />
              <Text style={styles.counter}>{sellerNote.length}/120</Text>

              <TouchableOpacity
                onPress={handleShip}
                disabled={submitting}
                activeOpacity={0.9}
                style={{ overflow: 'hidden', marginTop: 8 }}
              >
                <LinearGradient
                  colors={[GREEN, BLUE]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cta}
                >
                  {submitting ? (
                    <ActivityIndicator color="#041412" />
                  ) : (
                    <Text style={styles.ctaText}>Mark as shipped</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}

        {(isShipped || isDelivered) && order.shipping && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Shipping info</Text>
            <Text style={styles.eyebrow}>Method</Text>
            <Text style={styles.body}>
              {order.shipping.shippingMethod === 'self' ? 'Self delivery' : 'Courier'}
            </Text>
            {!!order.shipping.deliveryCompany && (
              <>
                <Text style={[styles.eyebrow, { marginTop: 10 }]}>Courier</Text>
                <Text style={styles.body}>{order.shipping.deliveryCompany}</Text>
              </>
            )}
            {!!order.shipping.trackingNumber && (
              <>
                <Text style={[styles.eyebrow, { marginTop: 10 }]}>Tracking</Text>
                <Text style={styles.body}>{order.shipping.trackingNumber}</Text>
              </>
            )}
            {!!order.shipping.estimatedDelivery && (
              <>
                <Text style={[styles.eyebrow, { marginTop: 10 }]}>
                  Estimated delivery
                </Text>
                <Text style={styles.body}>
                  {new Date(order.shipping.estimatedDelivery).toLocaleDateString()}
                </Text>
              </>
            )}
            {!!order.shipping.selfDeliveryNote && (
              <>
                <Text style={[styles.eyebrow, { marginTop: 10 }]}>Note</Text>
                <Text style={styles.body}>{order.shipping.selfDeliveryNote}</Text>
              </>
            )}
          </View>
        )}

        {isShipped && (
          <TouchableOpacity
            onPress={requestDeliver}
            disabled={submitting}
            activeOpacity={0.9}
            style={{ overflow: 'hidden', marginBottom: 18 }}
          >
            <LinearGradient
              colors={[GREEN, '#14B8A6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              {submitting ? (
                <ActivityIndicator color="#041412" />
              ) : (
                <Text style={styles.ctaText}>Mark as delivered</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Totals */}
        <View style={styles.card}>
          <View style={styles.totalRow}>
            <Text style={styles.meta}>Subtotal</Text>
            <Text style={styles.body}>
              {fmt(Number(order.subtotal) || 0, orderMoneyRegion)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.meta}>Delivery</Text>
            <Text style={styles.body}>
              {fmt(Number(order.shippingCost) || 0, orderMoneyRegion)}
            </Text>
          </View>
          <View style={[styles.totalRow, { marginTop: 8 }]}>
            <Text style={styles.meta}>Total</Text>
            <Text style={styles.totalValue}>
              {fmt(Number(order.totalAmount) || 0, orderMoneyRegion)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Cancel sheet */}
      <Modal
        visible={showCancel}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCancel(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalScrim} onPress={() => setShowCancel(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <Text style={styles.sectionTitle}>Cancel order</Text>
              <TouchableOpacity onPress={() => setShowCancel(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={MUTED} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.meta, { marginBottom: 14 }]}>
              Choose a reason. The buyer will see this on their order.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CANCEL_OPTIONS.map((opt) => {
                const selected = cancelCode === opt.code
                return (
                  <TouchableOpacity
                    key={opt.code}
                    onPress={() => setCancelCode(opt.code)}
                    activeOpacity={0.85}
                    style={[styles.reasonRow, selected && styles.reasonOn]}
                  >
                    <View style={[styles.radio, selected && styles.radioOn]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.reasonText, selected && { color: TEXT, fontWeight: '600' }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
              {cancelCode === 'other' && (
                <TextInput
                  value={cancelNote}
                  onChangeText={(t) => setCancelNote(t.slice(0, 200))}
                  placeholder="Short explanation…"
                  placeholderTextColor="#3D5268"
                  multiline
                  style={[styles.input, { minHeight: 88, textAlignVertical: 'top', marginTop: 8 }]}
                />
              )}
              <TouchableOpacity
                onPress={handleConfirmCancel}
                disabled={cancelling}
                style={styles.cancelCta}
              >
                {cancelling ? (
                  <ActivityIndicator color="#1A0A0C" />
                ) : (
                  <Text style={styles.cancelCtaText}>Confirm cancellation</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  loaderRoot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderHint: { marginTop: 14, fontSize: 13, color: MUTED },

  topBar: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  orderNo: { color: TEXT, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  orderDate: { color: MUTED, fontSize: 12, marginTop: 3 },

  scroll: { padding: 16, paddingBottom: 48 },

  card: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    marginBottom: 14,
  },
  cancelCard: {
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderColor: 'rgba(239,68,68,0.25)',
  },
  eyebrow: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statusBig: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  sectionTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  body: { color: SECONDARY, fontSize: 14, lineHeight: 21 },
  bodyStrong: { color: TEXT, fontSize: 15, fontWeight: '600' },
  meta: { color: MUTED, fontSize: 12, marginTop: 2 },
  blockLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 2,
  },

  addressBox: {
    marginTop: 14,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
  },
  thumb: { width: 64, height: 64, backgroundColor: SURFACE_2 },
  thumbEmpty: {},
  noteBox: {
    marginTop: 12,
    backgroundColor: SURFACE_2,
    padding: 12,
  },

  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionHint: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionCancel: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.28)',
  },
  actionHintTitle: {
    color: TEXT,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 6,
  },
  actionHintSub: { color: MUTED, fontSize: 10, marginTop: 2 },

  methodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
  methodText: { color: TEXT, fontWeight: '600', marginLeft: 8 },

  label: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0A121C',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: TEXT,
    fontSize: 15,
    marginBottom: 12,
  },
  counter: { color: MUTED, fontSize: 11, textAlign: 'right', marginBottom: 8 },

  cta: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#041412', fontWeight: '800', fontSize: 15 },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  totalValue: { color: TEXT, fontWeight: '800', fontSize: 18 },

  // Overlay
  overlayCard: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  overlayTitle: { color: TEXT, fontSize: 15, fontWeight: '700' },
  overlayMsg: {
    color: SECONDARY,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  overlayActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  overlayBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: SURFACE_2,
  },
  overlayBtnPrimary: { backgroundColor: GREEN, borderColor: 'transparent' },
  overlayBtnDanger: { backgroundColor: 'rgba(239,68,68,0.12)' },
  overlayBtnText: { fontWeight: '800', fontSize: 13, color: TEXT },

  // Delivered burst
  burstRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 400,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  burstCard: { alignItems: 'center', paddingHorizontal: 24 },
  burstRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstInner: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstTitle: {
    marginTop: 16,
    color: TEXT,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  burstSub: { marginTop: 4, color: SECONDARY, fontSize: 13 },

  // Cancel modal
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    backgroundColor: SURFACE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    paddingHorizontal: 18,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: LINE,
    marginTop: 10,
    marginBottom: 12,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: '#0A121C',
    marginBottom: 8,
  },
  reasonOn: {
    borderColor: 'rgba(59,130,246,0.45)',
    backgroundColor: SURFACE_2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: MUTED,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioOn: { borderColor: BLUE },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BLUE,
  },
  reasonText: { flex: 1, color: SECONDARY, fontSize: 14 },
  cancelCta: {
    backgroundColor: DANGER,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  cancelCtaText: { color: '#1A0A0C', fontWeight: '800', fontSize: 15 },
})