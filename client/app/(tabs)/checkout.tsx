import api from '@/constants/api'
import {
  convertPrice,
  DEFAULT_REGION,
  formatMoney,
  formatProductPrice,
} from '@/constants/regions'
import { useCart } from '@/context/CartContext'
import { useMarketplace } from '@/context/MarketplaceContext'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

const BG = '#090B0F'
const SURFACE = '#0E1116'
const SURFACE_2 = '#14181F'
const LINE = 'rgba(255,255,255,0.08)'
const TEXT = '#F5F7FA'
const SECONDARY = 'rgba(255,255,255,0.55)'
const MUTED = 'rgba(255,255,255,0.38)'
const GREEN = '#00E575'
const TEAL = '#14B8A6'
const BLUE = '#2563EB'
const DANGER = '#EF4444'
const AMBER = '#F59E0B'
const GRAD = [GREEN, TEAL, BLUE] as const

const U = 8
const H_PAD = 16

type OverlayState = {
  title: string
  message?: string
  tone?: 'info' | 'success' | 'danger'
  durationMs?: number
} | null

type OrderPhase = 'idle' | 'processing' | 'success' | 'error'

type ShipFrom = {
  label: string
  country: string
  hasShipFrom: boolean
  storeName: string
  sellerId: string
}

type RouteGroup = {
  key: string
  ship: ShipFrom
  items: any[]
  productSubtotalDisplay: number
  deliveryFeeDisplay: number
  isInternational: boolean
  missingShipFrom: boolean
  invalidItems: string[]
}

function resolveProductRegion(product: any): string {
  if (!product) return DEFAULT_REGION
  if (product.region) return String(product.region)
  if (product.marketplaceRegion) return String(product.marketplaceRegion)
  const seller = product.seller
  if (seller && typeof seller === 'object' && seller.marketplaceRegion) {
    return String(seller.marketplaceRegion)
  }
  return DEFAULT_REGION
}

function locationLabel(parts: {
  city?: string
  state?: string
  country?: string
}) {
  const city = (parts.city || '').trim()
  const state = (parts.state || '').trim()
  const country = (parts.country || '').trim()
  const left = city || state
  if (left && country) return `${left}, ${country}`
  return left || country || ''
}

function normalizeCountry(c?: string) {
  return (c || '').trim().toLowerCase()
}

function resolveShipFrom(product: any): ShipFrom {
  const seller = product?.seller
  const sellerObj = seller && typeof seller === 'object' ? seller : null
  const sellerId = sellerObj?._id
    ? String(sellerObj._id)
    : typeof seller === 'string'
      ? seller
      : ''
  const storeName =
    sellerObj?.storeName || sellerObj?.name || 'Seller'

  const fl = product?.fulfillmentLocation
  if (fl && (fl.city || fl.state) && fl.country) {
    return {
      label:
        fl.displayLabel ||
        locationLabel({
          city: fl.city,
          state: fl.state,
          country: fl.country,
        }),
      country: String(fl.country || '').trim(),
      hasShipFrom: true,
      storeName,
      sellerId,
    }
  }

  const addr = sellerObj?.shippingDefaults?.address
  if (addr && (addr.city || addr.state) && addr.country) {
    return {
      label: locationLabel({
        city: addr.city,
        state: addr.state,
        country: addr.country,
      }),
      country: String(addr.country || '').trim(),
      hasShipFrom: true,
      storeName,
      sellerId,
    }
  }

  return {
    label: 'Shipping origin not set',
    country: '',
    hasShipFrom: false,
    storeName,
    sellerId,
  }
}

function maskCard(last4?: string) {
  if (!last4) return '••••'
  return `•••• ${last4}`
}

function addressComplete(a: any): boolean {
  if (!a) return false
  return !!(
    String(a.street || '').trim() &&
    String(a.city || '').trim() &&
    String(a.country || '').trim()
  )
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
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [rotation])

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const ring = size
  const logoBox = size * 0.51
  const logoImg = size * 0.29

  return (
    <View
      style={{
        width: ring,
        height: ring,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: ring,
          height: ring,
          borderRadius: ring / 2,
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

function TopToast({
  state,
  onDismiss,
}: {
  state: OverlayState
  onDismiss: () => void
}) {
  const insets = useSafeAreaInsets()
  const translateY = useRef(new Animated.Value(-100)).current
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!state) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
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
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start()
    timer.current = setTimeout(() => onDismiss(), state.durationMs ?? 6000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state, onDismiss, translateY, opacity])

  if (!state) return null
  const accent =
    state.tone === 'danger' ? DANGER : state.tone === 'success' ? GREEN : BLUE

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.toastWrap,
        {
          paddingTop: insets.top + 8,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.toastCard}>
        <View style={[styles.toastAccent, { backgroundColor: accent }]} />
        <View style={{ flex: 1, padding: 12 }}>
          <Text style={styles.toastTitle}>{state.title}</Text>
          {!!state.message && (
            <Text style={styles.toastMsg}>{state.message}</Text>
          )}
        </View>
        <Pressable onPress={onDismiss} hitSlop={12} style={{ padding: 10 }}>
          <Ionicons name="close" size={18} color={MUTED} />
        </Pressable>
      </View>
    </Animated.View>
  )
}

function OrderStatusModal({
  phase,
  errorMessage,
  sellerCount,
  onViewOrders,
  onShowroom,
  onCloseError,
}: {
  phase: OrderPhase
  errorMessage?: string
  sellerCount?: number
  onViewOrders: () => void
  onShowroom: () => void
  onCloseError: () => void
}) {
  const visible =
    phase === 'processing' || phase === 'success' || phase === 'error'
  const tickScale = useRef(new Animated.Value(0)).current
  const contentOpacity = useRef(new Animated.Value(0)).current
  const contentLift = useRef(new Animated.Value(16)).current

  useEffect(() => {
    if (phase === 'success') {
      tickScale.setValue(0)
      contentOpacity.setValue(0)
      contentLift.setValue(16)
      Animated.sequence([
        Animated.spring(tickScale, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(contentLift, {
            toValue: 0,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start()
    }
  }, [phase, tickScale, contentOpacity, contentLift])

  if (!visible) return null

  const sellerHint =
    sellerCount && sellerCount > 1
      ? `${sellerCount} sellers`
      : 'the seller'

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.modalRoot}>
        <View style={styles.modalCard}>
          {phase === 'processing' && (
            <View style={styles.modalCenter}>
              <PlazoreOrb size={120} />
              <Text style={styles.modalProcessingTitle}>Placing your order</Text>
              <Text style={styles.modalProcessingSub}>
                Securing your bag and confirming with {sellerHint}…
              </Text>
            </View>
          )}

          {phase === 'error' && (
            <View style={styles.modalCenter}>
              <View style={styles.errorIconWrap}>
                <Ionicons name="close" size={32} color={DANGER} />
              </View>
              <Text style={styles.modalProcessingTitle}>Order failed</Text>
              <Text style={styles.modalProcessingSub}>
                {errorMessage || 'Something went wrong. Please try again.'}
              </Text>
              <Pressable onPress={onCloseError} style={styles.errorCloseBtn}>
                <Text style={styles.errorCloseText}>Try again</Text>
              </Pressable>
            </View>
          )}

          {phase === 'success' && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.successScroll}
            >
              <View style={styles.modalCenter}>
                <Animated.View
                  style={[
                    styles.tickWrap,
                    { transform: [{ scale: tickScale }] },
                  ]}
                >
                  <LinearGradient
                    colors={[...GRAD]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.tickGradient}
                  >
                    <Ionicons name="checkmark" size={36} color="#041412" />
                  </LinearGradient>
                </Animated.View>

                <Animated.View
                  style={{
                    opacity: contentOpacity,
                    transform: [{ translateY: contentLift }],
                    width: '100%',
                    alignItems: 'center',
                  }}
                >
                  <Text style={styles.successTitle}>Order Successful</Text>
                  <Text style={styles.successSub}>
                    Your order is confirmed on Plazore.
                  </Text>

                  <View style={styles.infoBlock}>
                    <Text style={styles.infoEyebrow}>HOW YOUR ORDER WORKS</Text>
                    {[
                      {
                        n: '1',
                        t: 'Confirmed',
                        d: 'Your bag is locked and each seller is notified for their items.',
                      },
                      {
                        n: '2',
                        t: 'Seller prepares',
                        d: 'Items are packed. International routes may need a short seller review first.',
                      },
                      {
                        n: '3',
                        t: 'Shipped',
                        d: 'Tracking updates appear in Orders as each package moves.',
                      },
                      {
                        n: '4',
                        t: 'Delivered',
                        d: 'You receive your order at the address you selected.',
                      },
                    ].map((step) => (
                      <View key={step.n} style={styles.flowRow}>
                        <LinearGradient
                          colors={[...GRAD]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.flowNum}
                        >
                          <Text style={styles.flowNumText}>{step.n}</Text>
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.flowTitle}>{step.t}</Text>
                          <Text style={styles.flowDesc}>{step.d}</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  <Pressable
                    onPress={onViewOrders}
                    style={styles.primaryCtaWrap}
                  >
                    <LinearGradient
                      colors={[...GRAD]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryCta}
                    >
                      <Text style={styles.primaryCtaText}>View Order</Text>
                      <Ionicons
                        name="arrow-forward"
                        size={16}
                        color="#041412"
                      />
                    </LinearGradient>
                  </Pressable>

                  <Pressable onPress={onShowroom} style={styles.secondaryCta}>
                    <Text style={styles.secondaryCtaText}>
                      Go back to Showroom
                    </Text>
                  </Pressable>
                </Animated.View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )
}

export default function Checkout() {
  const { cartItems, clearCart } = useCart()
  const {
    format,
    formatProduct,
    region: buyerRegion,
    refreshRegion,
  } = useMarketplace()
  const { getToken } = useAuth()
  const router = useRouter()

  const [pageLoading, setPageLoading] = useState(true)
  const [orderPhase, setOrderPhase] = useState<OrderPhase>('idle')
  const [orderError, setOrderError] = useState('')
  const [toast, setToast] = useState<OverlayState>(null)

  const [addresses, setAddresses] = useState<any[]>([])
  const [selectedAddress, setSelectedAddress] = useState<any>(null)
  const [cards, setCards] = useState<any[]>([])
  const [selectedCard, setSelectedCard] = useState<any>(null)

  const placingLock = useRef(false)
  const displayRegion = buyerRegion || DEFAULT_REGION
  const hasItems = (cartItems?.length || 0) > 0

  const fmt = useCallback(
    (amount: number) => {
      try {
        return format ? format(amount) : formatMoney(amount, displayRegion)
      } catch {
        return formatMoney(amount, displayRegion)
      }
    },
    [format, displayRegion],
  )

  const fmtProduct = useCallback(
    (amount: number, productRegion?: string | null) => {
      try {
        return formatProduct
          ? formatProduct(amount, productRegion)
          : formatProductPrice(amount, productRegion, displayRegion)
      } catch {
        return formatProductPrice(amount, productRegion, displayRegion)
      }
    },
    [formatProduct, displayRegion],
  )

  const loadAddresses = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return
      const res = await api.get('/addresses', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        const list = res.data.data || []
        setAddresses(list)
        setSelectedAddress((prev: any) => {
          if (prev) {
            const still = list.find((a: any) => a._id === prev._id)
            if (still) return still
          }
          return list.find((a: any) => a.isDefault) || list[0] || null
        })
      }
    } catch {
      /* keep empty */
    }
  }, [getToken])

  const loadCards = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return
      const res = await api.get('/payment-methods', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        const list = res.data.data || []
        setCards(list)
        setSelectedCard((prev: any) => {
          if (prev) {
            const still = list.find((c: any) => c._id === prev._id)
            if (still) return still
          }
          return list.find((c: any) => c.isDefault) || list[0] || null
        })
      }
    } catch {
      setCards([])
      setSelectedCard(null)
    }
  }, [getToken])

  useFocusEffect(
    useCallback(() => {
      const boot = async () => {
        refreshRegion()
        await Promise.all([loadAddresses(), loadCards()])
        setPageLoading(false)
      }
      boot()
    }, [refreshRegion, loadAddresses, loadCards]),
  )

  const routeGroups: RouteGroup[] = useMemo(() => {
    const map = new Map<string, RouteGroup>()
    const list = cartItems || []

    for (const item of list) {
      const product = item.product
      if (!product) continue

      const ship = resolveShipFrom(product)
      const key = ship.sellerId || `anon-${ship.storeName}`
      const productRegion = resolveProductRegion(product)
      const unit = Number(item.price ?? product.price) || 0
      const qty = Math.max(1, Number(item.quantity) || 1)
      const lineDisplay = convertPrice(unit * qty, productRegion, displayRegion)
      const feeRaw = Number(product.shipping?.deliveryFee) || 0
      const feeDisplay = convertPrice(feeRaw, productRegion, displayRegion)

      const invalid: string[] = []
      if (!(product._id || item.productId)) invalid.push('Missing product id')
      if (!(unit > 0)) invalid.push('Invalid price')
      if (!ship.hasShipFrom) invalid.push('No ship-from')

      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          key,
          ship,
          items: [item],
          productSubtotalDisplay: lineDisplay,
          deliveryFeeDisplay: feeDisplay,
          isInternational: false,
          missingShipFrom: !ship.hasShipFrom,
          invalidItems: invalid,
        })
      } else {
        existing.items.push(item)
        existing.productSubtotalDisplay += lineDisplay
        existing.deliveryFeeDisplay = Math.max(
          existing.deliveryFeeDisplay,
          feeDisplay,
        )
        existing.missingShipFrom =
          existing.missingShipFrom || !ship.hasShipFrom
        existing.invalidItems = [
          ...new Set([...existing.invalidItems, ...invalid]),
        ]
      }
    }

    const destCountry = normalizeCountry(selectedAddress?.country)
    for (const g of map.values()) {
      const origin = normalizeCountry(g.ship.country)
      g.isInternational = !!(
        g.ship.hasShipFrom &&
        origin &&
        destCountry &&
        origin !== destCountry
      )
    }

    return Array.from(map.values())
  }, [cartItems, displayRegion, selectedAddress?.country])

  const { productPrice, deliveryFee, totalAmount } = useMemo(() => {
    let products = 0
    let fees = 0
    for (const g of routeGroups) {
      products += g.productSubtotalDisplay
      fees += g.deliveryFeeDisplay
    }
    return {
      productPrice: products,
      deliveryFee: fees,
      totalAmount: products + fees,
    }
  }, [routeGroups])

  const itemCount = (cartItems || []).reduce(
    (n, i) => n + (Number(i.quantity) || 0),
    0,
  )

  const allRoutesShipReady =
    routeGroups.length > 0 && routeGroups.every((g) => !g.missingShipFrom)
  const noInvalidLines = routeGroups.every((g) => g.invalidItems.length === 0)
  const addressOk = addressComplete(selectedAddress)
  const cardOk = !!selectedCard?._id

  const internationalRoutes = routeGroups.filter((g) => g.isInternational)
  const hasInternational = internationalRoutes.length > 0
  const incompleteSellers = routeGroups.filter((g) => g.missingShipFrom)

  const canPlaceOrder =
    hasItems && allRoutesShipReady && noInvalidLines && addressOk && cardOk

  const blockReason = useMemo(() => {
    if (!hasItems) return 'Your bag is empty. Add products before checkout.'
    if (!allRoutesShipReady)
      return 'One or more sellers have not set a shipping origin. Checkout is blocked until they complete it.'
    if (!noInvalidLines)
      return 'One or more items have invalid price or product data.'
    if (!addressOk)
      return 'Select a complete delivery address (street, city, country).'
    if (!cardOk) return 'Select a payment card.'
    return null
  }, [hasItems, allRoutesShipReady, noInvalidLines, addressOk, cardOk])

  const deliverToLabel = selectedAddress
    ? locationLabel({
        city: selectedAddress.city,
        state: selectedAddress.state,
        country: selectedAddress.country,
      })
    : ''

  const handlePlaceOrder = async () => {
    if (placingLock.current || orderPhase === 'processing') return

    if (!hasItems) {
      setToast({
        title: 'Empty bag',
        message: 'There is nothing to checkout.',
        tone: 'danger',
      })
      return
    }
    if (!canPlaceOrder) {
      setToast({
        title: 'Cannot place order',
        message: blockReason || 'Complete all required steps first.',
        tone: 'danger',
      })
      return
    }

    placingLock.current = true
    setOrderError('')
    setOrderPhase('processing')

    try {
      const token = await getToken()
      if (!token) throw new Error('Sign in required')

      const items = (cartItems || [])
        .map((item) => {
          const id = item.productId || item.product?._id
          const qty = Math.max(1, Number(item.quantity) || 1)
          const price = Number(item.price ?? item.product?.price) || 0
          return {
            productId: id,
            quantity: qty,
            price,
            note: String(item.note || '')
              .trim()
              .slice(0, 120),
          }
        })
        .filter((i) => i.productId && i.price > 0 && i.quantity > 0)

      if (!items.length) throw new Error('No valid products in bag')
      if (!addressComplete(selectedAddress)) {
        throw new Error('Delivery address is incomplete')
      }

      const res = await api.post(
        '/orders',
        {
          shippingAddress: {
            street: selectedAddress.street,
            city: selectedAddress.city,
            state: selectedAddress.state,
            zipCode: selectedAddress.zipCode,
            country: selectedAddress.country,
          },
          paymentMethodId: selectedCard?._id,
          buyerNote: hasInternational
            ? 'International shipment — seller review may apply.'
            : '',
          items,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      if (res.data?.success) {
        clearCart()
        setOrderPhase('success')
      } else {
        setOrderPhase('error')
        setOrderError(
          res.data?.message ||
            'Could not place order. Please review your bag and try again.',
        )
      }
    } catch (e: any) {
      setOrderPhase('error')
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Something went wrong. Please try again.'
      setOrderError(msg)
    } finally {
      placingLock.current = false
    }
  }

  const placing = orderPhase === 'processing'

  /* ── Empty bag: hard stop ── */
  if (!pageLoading && !hasItems && orderPhase === 'idle') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={TEXT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={styles.headerRight} />
        </View>
        <LinearGradient
          colors={[
            'transparent',
            'rgba(0,229,117,0.4)',
            'rgba(37,99,235,0.3)',
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerRule}
        />
        <View style={styles.emptyCheckout}>
          <View style={styles.emptyCheckoutIcon}>
            <Ionicons name="bag-outline" size={28} color={MUTED} />
          </View>
          <Text style={styles.emptyCheckoutTitle}>Your bag is empty</Text>
          <Text style={styles.emptyCheckoutSub}>
            Checkout is only available when there is at least one product in
            your bag. Nothing can be ordered until you add items.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/' as any)}
            activeOpacity={0.88}
            style={{ width: '100%', maxWidth: 280, marginTop: 28 }}
          >
            <LinearGradient
              colors={[...GRAD]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryCta}
            >
              <Text style={styles.primaryCtaText}>Go to Showroom</Text>
              <Ionicons name="arrow-forward" size={16} color="#041412" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (pageLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <PlazoreOrb size={88} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopToast state={toast} onDismiss={() => setToast(null)} />

      <OrderStatusModal
        phase={orderPhase}
        errorMessage={orderError}
        sellerCount={routeGroups.length}
        onViewOrders={() => {
          setOrderPhase('idle')
          router.replace('/orders' as any)
        }}
        onShowroom={() => {
          setOrderPhase('idle')
          router.replace('/' as any)
        }}
        onCloseError={() => setOrderPhase('idle')}
      />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.headerRight} />
      </View>
      <LinearGradient
        colors={[
          'transparent',
          'rgba(0,229,117,0.4)',
          'rgba(37,99,235,0.3)',
          'transparent',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerRule}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.stepHint}>REVIEW · DELIVER · PAY</Text>

        {/* Bag by seller */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconSquare}>
                <Ionicons name="bag-outline" size={15} color={SECONDARY} />
              </View>
              <Text style={styles.cardTitle}>Your Bag</Text>
            </View>
            <Text style={styles.badge}>
              {itemCount} item{itemCount !== 1 ? 's' : ''}
              {routeGroups.length > 1
                ? ` · ${routeGroups.length} sellers`
                : ''}
            </Text>
          </View>

          {routeGroups.map((group) => (
            <View key={group.key}>
              <View style={styles.sellerBar}>
                <Ionicons name="storefront-outline" size={13} color={MUTED} />
                <Text style={styles.sellerBarText}>{group.ship.storeName}</Text>
                {group.isInternational && (
                  <View style={styles.intlPill}>
                    <Ionicons name="globe-outline" size={10} color="#93C5FD" />
                    <Text style={styles.intlPillText}>International</Text>
                  </View>
                )}
                {group.missingShipFrom && (
                  <View style={styles.warnPill}>
                    <Text style={styles.warnPillText}>No ship-from</Text>
                  </View>
                )}
              </View>

              {group.items.map((item: any, i: number) => {
                const productRegion = resolveProductRegion(item.product)
                const unit = Number(item.price ?? item.product?.price) || 0
                const qty = Number(item.quantity) || 1
                const img = item.product?.images?.[0]
                return (
                  <View
                    key={item.id || `${group.key}-${i}`}
                    style={[
                      styles.itemRow,
                      i < group.items.length - 1 && styles.itemBorder,
                    ]}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <Ionicons name="image-outline" size={18} color={MUTED} />
                      </View>
                    )}
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.product?.name || 'Product'}
                      </Text>
                      <Text style={styles.itemMeta}>
                        Qty {qty} · {fmtProduct(unit, productRegion)} each
                      </Text>
                      <Text style={styles.itemFee}>
                        Listed in {productRegion} · shown in your marketplace
                        currency
                      </Text>
                    </View>
                    <Text style={styles.itemTotal}>
                      {fmtProduct(unit * qty, productRegion)}
                    </Text>
                  </View>
                )
              })}

              <View style={styles.routeSubtotal}>
                <Text style={styles.routeSubtotalText}>
                  Route subtotal · delivery {fmt(group.deliveryFeeDisplay)}
                </Text>
                <Text style={styles.routeSubtotalVal}>
                  {fmt(
                    group.productSubtotalDisplay + group.deliveryFeeDisplay,
                  )}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Deliver To */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconSquare}>
                <Ionicons name="home-outline" size={15} color={SECONDARY} />
              </View>
              <Text style={styles.cardTitle}>Deliver To</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/addresses' as any)}>
              <Text style={styles.link}>Change</Text>
            </TouchableOpacity>
          </View>
          {addresses.length > 0 ? (
            <View style={styles.listPad}>
              {addresses.map((addr: any) => {
                const on = selectedAddress?._id === addr._id
                return (
                  <TouchableOpacity
                    key={addr._id}
                    onPress={() => setSelectedAddress(addr)}
                    style={[styles.selectItem, on && styles.selectItemActive]}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.radio, on && styles.radioActive]}>
                      {on && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.selectContent}>
                      <View style={styles.selectTop}>
                        <Text style={styles.selectTitle}>
                          {addr.type || 'Address'}
                        </Text>
                        {addr.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.selectSub}>
                        {addr.street}
                        {'\n'}
                        {addr.city}
                        {addr.state ? `, ${addr.state}` : ''} {addr.zipCode}
                        {'\n'}
                        {addr.country}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
              <TouchableOpacity
                onPress={() => router.push('/addresses' as any)}
                style={styles.addBtn}
              >
                <Ionicons name="add" size={16} color={GREEN} />
                <Text style={styles.addBtnText}>Add new address</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/addresses' as any)}
              style={styles.emptyBlock}
              activeOpacity={0.85}
            >
              <View style={styles.emptyIcon}>
                <Ionicons name="location-outline" size={24} color={MUTED} />
              </View>
              <Text style={styles.emptyTitle}>Add delivery address</Text>
              <Text style={styles.emptySub}>
                Street, city and country are required to place an order.
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Pay with Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconSquare}>
                <Ionicons name="card-outline" size={15} color={SECONDARY} />
              </View>
              <Text style={styles.cardTitle}>Pay with Card</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/payment-methods' as any)}
            >
              <Text style={styles.link}>Change</Text>
            </TouchableOpacity>
          </View>
          {cards.length > 0 ? (
            <View style={styles.listPad}>
              {cards.map((card: any) => {
                const on = selectedCard?._id === card._id
                return (
                  <TouchableOpacity
                    key={card._id}
                    onPress={() => setSelectedCard(card)}
                    style={[styles.selectItem, on && styles.selectItemActive]}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.radio, on && styles.radioActive]}>
                      {on && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.selectContent}>
                      <View style={styles.selectTop}>
                        <Text style={styles.selectTitle}>
                          {card.brand || 'Card'} {maskCard(card.last4)}
                        </Text>
                        {card.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.selectSub}>
                        Expires {card.expMonth}/{card.expYear}
                        {card.name ? ` · ${card.name}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
              <TouchableOpacity
                onPress={() => router.push('/payment-methods' as any)}
                style={styles.addBtn}
              >
                <Ionicons name="add" size={16} color={GREEN} />
                <Text style={styles.addBtnText}>Add new card</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/payment-methods' as any)}
              style={styles.emptyBlock}
              activeOpacity={0.85}
            >
              <View style={styles.emptyIcon}>
                <Ionicons name="card-outline" size={24} color={MUTED} />
              </View>
              <Text style={styles.emptyTitle}>Add a payment card</Text>
              <Text style={styles.emptySub}>
                A saved card is required before you can place an order.
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Shipping routes */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconSquare}>
                <Ionicons name="navigate-outline" size={15} color={SECONDARY} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Shipping routes</Text>
                <Text style={styles.cardSub}>
                  Each seller ships separately from their own origin
                </Text>
              </View>
            </View>
            {routeGroups.length > 1 && (
              <Text style={styles.badge}>{routeGroups.length} routes</Text>
            )}
          </View>

          {incompleteSellers.length > 0 && (
            <View style={styles.warningBox}>
              <Ionicons name="alert-circle" size={18} color={AMBER} />
              <View style={{ flex: 1 }}>
                <Text style={styles.warningTitle}>Shipping incomplete</Text>
                <Text style={styles.warningText}>
                  {incompleteSellers.map((g) => g.ship.storeName).join(', ')}{' '}
                  {incompleteSellers.length === 1 ? 'has' : 'have'} not set a
                  ship-from location. Checkout stays locked until every seller
                  on this order has a complete origin.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.routeBody}>
            {routeGroups.map((group, idx) => (
              <View
                key={group.key}
                style={[
                  styles.routeCard,
                  idx > 0 && { marginTop: 12 },
                  group.missingShipFrom && styles.routeCardWarn,
                  group.isInternational &&
                    !group.missingShipFrom &&
                    styles.routeCardIntl,
                ]}
              >
                <View style={styles.routeHead}>
                  <LinearGradient
                    colors={[...GRAD]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.routeNum}
                  >
                    <Text style={styles.routeNumText}>{idx + 1}</Text>
                  </LinearGradient>
                  <Text style={styles.routeStore}>{group.ship.storeName}</Text>
                  <Text style={styles.routeItemCount}>
                    {group.items.length} item
                    {group.items.length !== 1 ? 's' : ''}
                  </Text>
                  {group.isInternational && (
                    <View style={styles.intlPill}>
                      <Ionicons
                        name="globe-outline"
                        size={10}
                        color="#93C5FD"
                      />
                      <Text style={styles.intlPillText}>Cross-border</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.routeLabel}>Ships from</Text>
                <Text style={styles.routeValue}>
                  {group.ship.hasShipFrom
                    ? group.ship.label
                    : 'Not set by seller'}
                </Text>
                {!!group.ship.country && (
                  <Text style={styles.routeCountry}>
                    Origin country: {group.ship.country}
                  </Text>
                )}

                <View style={styles.routeConnector}>
                  <View style={styles.routeDash} />
                  <Ionicons name="arrow-down" size={12} color={MUTED} />
                  <View style={styles.routeDash} />
                </View>

                <Text style={styles.routeLabel}>Delivering to</Text>
                <Text style={styles.routeValue}>
                  {deliverToLabel || 'Select a delivery address'}
                </Text>
                {!!selectedAddress?.country && (
                  <Text style={styles.routeCountry}>
                    Destination country: {selectedAddress.country}
                  </Text>
                )}

                <View style={styles.routeMoney}>
                  <Text style={styles.routeMoneyText}>
                    Products {fmt(group.productSubtotalDisplay)}
                  </Text>
                  <Text style={styles.routeMoneyText}>
                    Delivery {fmt(group.deliveryFeeDisplay)}
                  </Text>
                </View>

                {group.isInternational && (
                  <Text style={styles.routeIntlNote}>
                    This route crosses countries. The seller may review the
                    order before packing. Delivery times can differ from
                    domestic routes.
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {hasInternational && selectedAddress && (
          <View style={styles.intlBox}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Ionicons name="globe-outline" size={18} color="#93C5FD" />
              <View style={{ flex: 1 }}>
                <Text style={styles.intlTitle}>International order</Text>
                <Text style={styles.intlText}>
                  {internationalRoutes.length === 1
                    ? `${internationalRoutes[0].ship.storeName} ships from ${internationalRoutes[0].ship.country} to ${selectedAddress.country}.`
                    : `${internationalRoutes.length} of ${routeGroups.length} routes are cross-border.`}{' '}
                  Cross-border legs may require seller approval before
                  shipment. Duties or extra carrier fees are not included in
                  the delivery fee unless the seller listed them on the product.
                </Text>
                {internationalRoutes.map((g) => (
                  <Text key={g.key} style={styles.intlRouteLine}>
                    · {g.ship.storeName}: {g.ship.country || '?'} →{' '}
                    {selectedAddress.country}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        )}

        {blockReason && hasItems && (
          <View style={styles.blockBox}>
            <Ionicons name="information-circle-outline" size={18} color={MUTED} />
            <Text style={styles.blockText}>{blockReason}</Text>
          </View>
        )}

        {/* Receipt */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconSquare}>
                <Ionicons name="receipt-outline" size={15} color={SECONDARY} />
              </View>
              <Text style={styles.cardTitle}>Receipt</Text>
            </View>
          </View>
          <View style={styles.receiptBody}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Product price</Text>
              <Text style={styles.receiptValue}>{fmt(productPrice)}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>
                Delivery
                {routeGroups.length > 1
                  ? ` (${routeGroups.length} routes)`
                  : ''}
              </Text>
              <Text style={styles.receiptValue}>{fmt(deliveryFee)}</Text>
            </View>
            {routeGroups.length > 1 && (
              <View style={styles.receiptBreakdown}>
                {routeGroups.map((g) => (
                  <View key={g.key} style={styles.receiptBreakdownRow}>
                    <Text style={styles.receiptBreakdownLabel} numberOfLines={1}>
                      {g.ship.storeName}
                    </Text>
                    <Text style={styles.receiptBreakdownVal}>
                      {fmt(g.productSubtotalDisplay)} +{' '}
                      {fmt(g.deliveryFeeDisplay)} ship
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.receiptDivider} />
            <View style={styles.receiptRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{fmt(totalAmount)}</Text>
            </View>
            <Text style={styles.receiptNote}>
              Prices converted to your marketplace currency ({displayRegion}).
              Each product keeps its original listing region for conversion.
            </Text>
            {hasInternational && (
              <Text style={[styles.receiptNote, { color: 'rgba(147,197,253,0.75)' }]}>
                International routes may take longer and can require seller
                review before ship.
              </Text>
            )}
          </View>
        </View>

        <Text style={styles.footerBrand}>
          Plazore · Digital Mall
        </Text>
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <LinearGradient
          colors={[
            'transparent',
            'rgba(0,229,117,0.35)',
            'rgba(37,99,235,0.25)',
            'transparent',
          ]}
          locations={[0, 0.25, 0.75, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.bottomRule}
        />
        <View style={styles.bottomInner}>
          <View style={styles.bottomLeft}>
            <Text style={styles.amountLabel}>AMOUNT DUE</Text>
            <Text
              style={styles.amountValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {fmt(totalAmount)}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handlePlaceOrder}
            disabled={placing || !canPlaceOrder}
            activeOpacity={0.88}
            style={styles.ctaWrap}
          >
            <LinearGradient
              colors={
                placing || !canPlaceOrder
                  ? ['#2A2F38', '#2A2F38']
                  : [...GRAD]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaBtn}
            >
              <Text
                style={[
                  styles.ctaText,
                  (placing || !canPlaceOrder) && { color: MUTED },
                ]}
              >
                {!hasItems
                  ? 'Empty'
                  : !canPlaceOrder
                    ? 'Unavailable'
                    : placing
                      ? 'Placing…'
                      : 'Place Order'}
              </Text>
              {canPlaceOrder && !placing && (
                <Ionicons name="arrow-forward" size={16} color="#041412" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyCheckout: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emptyCheckoutIcon: {
    width: 64,
    height: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCheckoutTitle: {
    marginTop: 22,
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
  },
  emptyCheckoutSub: {
    marginTop: 10,
    fontSize: 13,
    color: SECONDARY,
    textAlign: 'center',
    lineHeight: 19,
  },

  toastWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingHorizontal: H_PAD,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    overflow: 'hidden',
  },
  toastAccent: { width: 3, alignSelf: 'stretch' },
  toastTitle: { color: TEXT, fontWeight: '700', fontSize: 14 },
  toastMsg: {
    color: SECONDARY,
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 17,
  },

  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(9,11,15,0.94)',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 40,
  },
  modalCard: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  modalCenter: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 36,
  },
  modalProcessingTitle: {
    marginTop: 22,
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  modalProcessingSub: {
    marginTop: 8,
    fontSize: 13,
    color: SECONDARY,
    textAlign: 'center',
    lineHeight: 19,
  },
  errorIconWrap: {
    width: 72,
    height: 72,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239,68,68,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCloseBtn: {
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  errorCloseText: { color: TEXT, fontWeight: '700', fontSize: 14 },

  successScroll: { paddingBottom: 28 },
  tickWrap: { marginBottom: 8 },
  tickGradient: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.4,
  },
  successSub: {
    marginTop: 6,
    fontSize: 13,
    color: SECONDARY,
    textAlign: 'center',
    marginBottom: 20,
  },
  infoBlock: {
    width: '100%',
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
    marginBottom: 12,
  },
  infoEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: MUTED,
    marginBottom: 10,
  },
  flowRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  flowNum: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  flowNumText: { color: '#041412', fontSize: 11, fontWeight: '800' },
  flowTitle: { color: TEXT, fontSize: 13, fontWeight: '700' },
  flowDesc: {
    color: SECONDARY,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  primaryCtaWrap: { width: '100%', marginTop: 8, overflow: 'hidden' },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  primaryCtaText: { color: '#041412', fontWeight: '800', fontSize: 15 },
  secondaryCta: {
    marginTop: 12,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: SURFACE_2,
  },
  secondaryCtaText: { color: TEXT, fontWeight: '600', fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: U,
    paddingVertical: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  headerRight: { width: 44 },
  headerRule: { height: 1, marginHorizontal: H_PAD },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingTop: U * 2,
    paddingBottom: 32,
  },
  stepHint: {
    fontSize: 11,
    color: MUTED,
    letterSpacing: 1.6,
    fontWeight: '700',
    marginBottom: 14,
  },

  card: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    backgroundColor: SURFACE_2,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconSquare: {
    width: 30,
    height: 30,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: TEXT },
  cardSub: { fontSize: 10, color: MUTED, marginTop: 2 },
  badge: { fontSize: 12, color: SECONDARY, fontWeight: '600' },
  link: { fontSize: 13, fontWeight: '700', color: GREEN },

  sellerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(20,24,31,0.85)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  sellerBarText: {
    fontSize: 11,
    fontWeight: '800',
    color: SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flex: 1,
  },
  intlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59,130,246,0.35)',
    backgroundColor: 'rgba(37,99,235,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  intlPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#93C5FD',
    textTransform: 'uppercase',
  },
  warnPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,158,11,0.4)',
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  warnPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: AMBER,
    textTransform: 'uppercase',
  },

  itemRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  itemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  thumb: { width: 56, height: 56, backgroundColor: SURFACE_2 },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1, marginLeft: 12, minWidth: 0 },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
    lineHeight: 18,
  },
  itemMeta: { fontSize: 11, color: SECONDARY, marginTop: 3 },
  itemFee: { fontSize: 10, color: MUTED, marginTop: 2 },
  itemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
    marginLeft: 8,
    maxWidth: 90,
    textAlign: 'right',
  },
  routeSubtotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#0A0C10',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  routeSubtotalText: { fontSize: 11, color: MUTED },
  routeSubtotalVal: { fontSize: 11, fontWeight: '700', color: SECONDARY },

  listPad: { padding: 12 },
  selectItem: {
    flexDirection: 'row',
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    marginBottom: 8,
    backgroundColor: SURFACE,
  },
  selectItemActive: {
    borderColor: 'rgba(0,229,117,0.5)',
    backgroundColor: SURFACE_2,
  },
  radio: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: MUTED,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: GREEN },
  radioDot: { width: 8, height: 8, backgroundColor: GREEN },
  selectContent: { flex: 1, marginLeft: 12 },
  selectTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectTitle: { fontSize: 13, fontWeight: '700', color: TEXT },
  defaultBadge: {
    backgroundColor: SURFACE,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  defaultText: { fontSize: 10, color: SECONDARY, fontWeight: '600' },
  selectSub: {
    fontSize: 12,
    color: SECONDARY,
    lineHeight: 18,
    marginTop: 4,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: SURFACE_2,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: GREEN },

  emptyBlock: { paddingVertical: 28, alignItems: 'center' },
  emptyIcon: {
    width: 52,
    height: 52,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: TEXT },
  emptySub: { fontSize: 12, color: MUTED, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },

  warningBox: {
    margin: 14,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,158,11,0.3)',
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },
  warningTitle: { fontSize: 13, fontWeight: '700', color: AMBER },
  warningText: {
    fontSize: 12,
    color: SECONDARY,
    marginTop: 4,
    lineHeight: 18,
  },

  routeBody: { padding: 14 },
  routeCard: {
    backgroundColor: SURFACE_2,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  routeCardWarn: {
    borderColor: 'rgba(245,158,11,0.35)',
    backgroundColor: 'rgba(245,158,11,0.05)',
  },
  routeCardIntl: {
    borderColor: 'rgba(37,99,235,0.3)',
    backgroundColor: 'rgba(37,99,235,0.05)',
  },
  routeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  routeNum: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeNumText: { color: '#041412', fontSize: 11, fontWeight: '800' },
  routeStore: { fontSize: 12, fontWeight: '800', color: TEXT },
  routeItemCount: { fontSize: 10, color: MUTED },
  routeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: MUTED,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  routeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
    lineHeight: 20,
  },
  routeCountry: { fontSize: 11, color: MUTED, marginTop: 2 },
  routeConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
    marginVertical: 8,
    gap: 4,
  },
  routeDash: { width: 1, height: 10, backgroundColor: LINE },
  routeMoney: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  routeMoneyText: { fontSize: 11, color: MUTED },
  routeIntlNote: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(147,197,253,0.85)',
  },

  receiptBody: { padding: 14 },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  receiptLabel: { fontSize: 13, color: SECONDARY },
  receiptValue: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
    maxWidth: '50%',
    textAlign: 'right',
  },
  receiptBreakdown: {
    backgroundColor: '#0A0C10',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 8,
    marginBottom: 8,
  },
  receiptBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  receiptBreakdownLabel: { fontSize: 10, color: MUTED, flex: 1 },
  receiptBreakdownVal: { fontSize: 10, color: MUTED },
  receiptDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
    marginVertical: 8,
  },
  totalLabel: { fontSize: 14, fontWeight: '800', color: TEXT },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: GREEN,
    maxWidth: '50%',
    textAlign: 'right',
  },
  receiptNote: { fontSize: 11, color: MUTED, marginTop: 10, lineHeight: 16 },

  intlBox: {
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(37,99,235,0.25)',
    padding: 14,
    marginBottom: 12,
  },
  intlTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 6,
  },
  intlText: { fontSize: 12, color: SECONDARY, lineHeight: 18 },
  intlRouteLine: {
    fontSize: 11,
    color: MUTED,
    marginTop: 4,
  },

  blockBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    marginBottom: 12,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  blockText: { flex: 1, fontSize: 12, color: SECONDARY, lineHeight: 18 },

  footerBrand: {
    textAlign: 'center',
    fontSize: 11,
    color: MUTED,
    marginTop: 8,
    letterSpacing: 0.8,
    fontWeight: '600',
  },

  bottomBar: {
    backgroundColor: SURFACE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  bottomRule: { height: 1 },
  bottomInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 14 : 16,
  },
  bottomLeft: { flex: 1, marginRight: 12, minWidth: 0 },
  amountLabel: {
    fontSize: 10,
    color: MUTED,
    marginBottom: 3,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.4,
  },
  ctaWrap: { overflow: 'hidden' },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
    minWidth: 140,
  },
  ctaText: { color: '#041412', fontWeight: '800', fontSize: 15 },
})