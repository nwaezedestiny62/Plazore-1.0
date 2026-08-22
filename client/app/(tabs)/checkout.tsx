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
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#6B7280'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const DANGER = '#EF4444'

type OverlayState = {
  title: string
  message?: string
  tone?: 'info' | 'success' | 'danger'
  durationMs?: number
} | null

type OrderPhase = 'idle' | 'processing' | 'success' | 'error'

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

function resolveShipFrom(product: any) {
  const seller = product?.seller
  const sellerObj = seller && typeof seller === 'object' ? seller : null
  const sellerId = sellerObj?._id
    ? String(sellerObj._id)
    : typeof seller === 'string'
      ? seller
      : ''

  const fl = product?.fulfillmentLocation
  if (fl && (fl.city || fl.state) && fl.country) {
    return {
      label:
        fl.displayLabel ||
        locationLabel({ city: fl.city, state: fl.state, country: fl.country }),
      country: fl.country,
      hasShipFrom: true,
      storeName: sellerObj?.storeName || sellerObj?.name || 'Seller',
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
      country: addr.country,
      hasShipFrom: true,
      storeName: sellerObj?.storeName || sellerObj?.name || 'Seller',
      sellerId,
    }
  }

  return {
    label: 'Not set',
    country: '',
    hasShipFrom: false,
    storeName: sellerObj?.storeName || sellerObj?.name || 'Seller',
    sellerId,
  }
}

function maskCard(last4?: string) {
  if (!last4) return '••••'
  return `•••• ${last4}`
}

/* ── Plazore orb (page preloader + order modal) ── */
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

  const ring = size
  const logoBox = size * 0.51
  const logoImg = size * 0.29

  return (
    <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
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
  }, [state])

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

/** Full-screen order status modal: orb → tick → success content */
function OrderStatusModal({
  phase,
  errorMessage,
  onViewOrders,
  onShowroom,
  onCloseError,
}: {
  phase: OrderPhase
  errorMessage?: string
  onViewOrders: () => void
  onShowroom: () => void
  onCloseError: () => void
}) {
  const visible = phase === 'processing' || phase === 'success' || phase === 'error'
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
  }, [phase])

  if (!visible) return null

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.modalRoot}>
        <View style={styles.modalCard}>
          {phase === 'processing' && (
            <View style={styles.modalCenter}>
              <PlazoreOrb size={120} />
              <Text style={styles.modalProcessingTitle}>Placing your order</Text>
              <Text style={styles.modalProcessingSub}>
                Securing your bag and confirming with the seller…
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
                    colors={[GREEN, BLUE]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.tickGradient}
                  >
                    <Ionicons name="checkmark" size={36} color="#fff" />
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

                  {/* Order flow */}
                  <View style={styles.infoBlock}>
                    <Text style={styles.infoEyebrow}>HOW YOUR ORDER WORKS</Text>
                    {[
                      {
                        n: '1',
                        t: 'Confirmed',
                        d: 'Your bag is locked and the seller is notified.',
                      },
                      {
                        n: '2',
                        t: 'Seller prepares',
                        d: 'Items are packed. International orders may need a short seller review first.',
                      },
                      {
                        n: '3',
                        t: 'Shipped',
                        d: 'Tracking updates appear in Orders as the package moves.',
                      },
                      {
                        n: '4',
                        t: 'Delivered',
                        d: 'You receive your order at the address you selected.',
                      },
                    ].map((step) => (
                      <View key={step.n} style={styles.flowRow}>
                        <LinearGradient
                          colors={[GREEN, BLUE]}
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

                  {/* CTAs */}
                  <Pressable
                    onPress={onViewOrders}
                    style={styles.primaryCtaWrap}
                  >
                    <LinearGradient
                      colors={[GREEN, BLUE]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryCta}
                    >
                      <Text style={styles.primaryCtaText}>View Order</Text>
                      <Ionicons name="arrow-forward" size={16} color="#fff" />
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

  const displayRegion = buyerRegion || DEFAULT_REGION

  const fmt = useCallback(
    (amount: number) => {
      try {
        return format ? format(amount) : formatMoney(amount, displayRegion)
      } catch {
        return formatMoney(amount, displayRegion)
      }
    },
    [format, displayRegion]
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
    [formatProduct, displayRegion]
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
      // keep empty
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
    }, [refreshRegion, loadAddresses, loadCards])
  )

  const { productPrice, deliveryFee, totalAmount } = useMemo(() => {
    if (!cartItems?.length) {
      return { productPrice: 0, deliveryFee: 0, totalAmount: 0 }
    }
    let productsSum = 0
    const bySeller: Record<string, number> = {}
    let noSellerMax = 0

    for (const item of cartItems) {
      const productRegion = resolveProductRegion(item.product)
      const unit = Number(item.price ?? item.product?.price) || 0
      const qty = Number(item.quantity) || 1
      productsSum += convertPrice(unit * qty, productRegion, displayRegion)
      const feeRaw = Number(item.product?.shipping?.deliveryFee) || 0
      const feeConverted = convertPrice(feeRaw, productRegion, displayRegion)
      const seller = item.product?.seller as any
      const sellerId =
        typeof seller === 'string'
          ? seller
          : seller?._id
            ? String(seller._id)
            : ''
      if (sellerId) {
        bySeller[sellerId] = Math.max(bySeller[sellerId] || 0, feeConverted)
      } else {
        noSellerMax = Math.max(noSellerMax, feeConverted)
      }
    }
    const feeSum =
      Object.values(bySeller).reduce((sum, fee) => sum + fee, 0) + noSellerMax
    return {
      productPrice: productsSum,
      deliveryFee: feeSum,
      totalAmount: productsSum + feeSum,
    }
  }, [cartItems, displayRegion])

  const itemCount = cartItems.reduce((n, i) => n + (i.quantity || 0), 0)

  const shippingRoutes = useMemo(() => {
    const map = new Map<
      string,
      {
        sellerId: string
        storeName: string
        fromLabel: string
        fromCountry: string
        hasShipFrom: boolean
      }
    >()
    for (const item of cartItems) {
      const ship = resolveShipFrom(item.product)
      const key = ship.sellerId || `anon-${ship.storeName}`
      if (map.has(key)) continue
      map.set(key, {
        sellerId: key,
        storeName: ship.storeName,
        fromLabel: ship.label,
        fromCountry: ship.country,
        hasShipFrom: ship.hasShipFrom,
      })
    }
    return Array.from(map.values())
  }, [cartItems])

  const canCheckout =
    cartItems.length > 0 &&
    shippingRoutes.length > 0 &&
    shippingRoutes.every((r) => r.hasShipFrom)

  const deliverToLabel = selectedAddress
    ? locationLabel({
        city: selectedAddress.city,
        state: selectedAddress.state,
        country: selectedAddress.country,
      })
    : ''

  const hasInternational = useMemo(() => {
    if (!selectedAddress) return false
    const toCountry = normalizeCountry(selectedAddress.country)
    if (!toCountry) return false
    return shippingRoutes.some(
      (r) =>
        r.hasShipFrom &&
        normalizeCountry(r.fromCountry) &&
        normalizeCountry(r.fromCountry) !== toCountry
    )
  }, [shippingRoutes, selectedAddress])

  const handlePlaceOrder = async () => {
    if (!canCheckout) {
      setToast({
        title: 'Unavailable',
        message:
          'This seller has not completed their shipping information yet.',
        tone: 'danger',
      })
      return
    }
    if (!selectedAddress) {
      setToast({
        title: 'Address needed',
        message: 'Please add or select a delivery address.',
        tone: 'info',
      })
      return
    }
    if (!selectedCard) {
      setToast({
        title: 'Card needed',
        message: 'Please add or select a payment card.',
        tone: 'info',
      })
      return
    }
    if (!cartItems?.length) {
      setToast({
        title: 'Empty bag',
        message: 'Your bag is empty.',
        tone: 'info',
      })
      return
    }

    setOrderError('')
    setOrderPhase('processing')

    try {
      const token = await getToken()
      const items = cartItems
        .map((item) => ({
          productId: (item.productId || item.product?._id)?.toString(),
          quantity: Number(item.quantity) || 1,
          price: Number(item.price ?? item.product?.price) || 0,
          note: (item.note || '').trim().slice(0, 120),
        }))
        .filter((item) => item.productId)

      if (items.length === 0) {
        setOrderPhase('error')
        setOrderError('No valid products in bag')
        return
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
          buyerNote: '',
          items,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.data.success) {
        await clearCart()
        setOrderPhase('success')
      } else {
        setOrderPhase('error')
        setOrderError(res.data?.message || 'Could not place order')
      }
    } catch (error: any) {
      setOrderPhase('error')
      setOrderError(
        error.response?.data?.message || 'Something went wrong'
      )
    }
  }

  if (pageLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <PlazoreOrb size={110} />
        </View>
      </SafeAreaView>
    )
  }

  const placing = orderPhase === 'processing'

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopToast state={toast} onDismiss={() => setToast(null)} />

      <OrderStatusModal
        phase={orderPhase}
        errorMessage={orderError}
        onViewOrders={() => {
          setOrderPhase('idle')
          router.replace('/orders' as any)
        }}
        onShowroom={() => {
          setOrderPhase('idle')
          router.replace('/(tabs)' as any)
        }}
        onCloseError={() => setOrderPhase('idle')}
      />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepHint}>Review · Deliver · Pay</Text>

        {/* Bag */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="bag-handle-outline" size={15} color={SECONDARY} />
              </View>
              <Text style={styles.cardTitle}>Your Bag</Text>
            </View>
            <Text style={styles.badge}>
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </Text>
          </View>

          {cartItems.length === 0 ? (
            <View style={styles.emptyBag}>
              <Ionicons name="bag-outline" size={28} color={MUTED} />
              <Text style={styles.emptyBagText}>Your bag is empty</Text>
            </View>
          ) : (
            cartItems.map((item, index) => {
              const productRegion = resolveProductRegion(item.product)
              const unit = Number(item.price ?? item.product?.price) || 0
              const lineTotal = unit * (item.quantity || 1)
              const lineFee = Number(item.product?.shipping?.deliveryFee) || 0
              return (
                <View
                  key={item.id}
                  style={[
                    styles.itemRow,
                    index < cartItems.length - 1 && styles.itemBorder,
                  ]}
                >
                  {item.product?.images?.[0] ? (
                    <Image
                      source={{ uri: item.product.images[0] }}
                      style={styles.thumb}
                    />
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
                      Qty {item.quantity} · {fmtProduct(unit, productRegion)} each
                    </Text>
                    {lineFee > 0 && (
                      <Text style={styles.itemFee}>
                        Delivery {fmtProduct(lineFee, productRegion)}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.itemTotal} numberOfLines={1}>
                    {fmtProduct(lineTotal, productRegion)}
                  </Text>
                </View>
              )
            })
          )}
        </View>

        {/* Deliver To */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="home-outline" size={15} color={SECONDARY} />
              </View>
              <Text style={styles.cardTitle}>Deliver To</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/addresses' as any)}
              hitSlop={10}
            >
              <Text style={styles.link}>Change</Text>
            </TouchableOpacity>
          </View>
          {addresses.length > 0 ? (
            <View style={styles.listPad}>
              {addresses.map((addr) => {
                const isSelected = selectedAddress?._id === addr._id
                return (
                  <TouchableOpacity
                    key={addr._id}
                    activeOpacity={0.85}
                    onPress={() => setSelectedAddress(addr)}
                    style={[
                      styles.selectItem,
                      isSelected && styles.selectItemActive,
                    ]}
                  >
                    <View
                      style={[styles.radio, isSelected && styles.radioActive]}
                    >
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.selectContent}>
                      <View style={styles.selectTop}>
                        <Text style={styles.selectTitle}>{addr.type}</Text>
                        {addr.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.selectSub}>
                        {addr.street}
                        {'\n'}
                        {addr.city}, {addr.state} {addr.zipCode}
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
                <Ionicons name="add-circle-outline" size={17} color={GREEN} />
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
                Where should we send your order?
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Pay with Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="card-outline" size={15} color={SECONDARY} />
              </View>
              <Text style={styles.cardTitle}>Pay with Card</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/payment-methods' as any)}
              hitSlop={10}
            >
              <Text style={styles.link}>Change</Text>
            </TouchableOpacity>
          </View>
          {cards.length > 0 ? (
            <View style={styles.listPad}>
              {cards.map((card) => {
                const isSelected = selectedCard?._id === card._id
                return (
                  <TouchableOpacity
                    key={card._id}
                    activeOpacity={0.85}
                    onPress={() => setSelectedCard(card)}
                    style={[
                      styles.selectItem,
                      isSelected && styles.selectItemActive,
                    ]}
                  >
                    <View
                      style={[styles.radio, isSelected && styles.radioActive]}
                    >
                      {isSelected && <View style={styles.radioDot} />}
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
                <Ionicons name="add-circle-outline" size={17} color={GREEN} />
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
                Save a card to pay securely at checkout
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Shipping Route */}
        {cartItems.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons name="navigate-outline" size={15} color={SECONDARY} />
                </View>
                <Text style={styles.cardTitle}>Shipping Route</Text>
              </View>
            </View>
            {!canCheckout ? (
              <View style={styles.warningBox}>
                <Ionicons name="alert-circle" size={18} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningTitle}>
                    Shipping not available yet
                  </Text>
                  <Text style={styles.warningText}>
                    This seller has not completed their shipping information
                    yet. Please try again later.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.routeBody}>
                {shippingRoutes.map((route, idx) => (
                  <View
                    key={route.sellerId}
                    style={idx > 0 ? styles.routeDivider : undefined}
                  >
                    {shippingRoutes.length > 1 && (
                      <Text style={styles.storeLabel}>{route.storeName}</Text>
                    )}
                    <View style={styles.routeCard}>
                      <View style={styles.routePoint}>
                        <View style={[styles.routeDotOuter, styles.routeDotBlue]}>
                          <View style={styles.routeDotInnerBlue} />
                        </View>
                        <View style={styles.routePointText}>
                          <Text style={styles.routeLabel}>Ships From</Text>
                          <Text style={styles.routeValue} numberOfLines={2}>
                            {route.fromLabel}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.routeConnector}>
                        <View style={styles.routeDash} />
                        <Ionicons name="arrow-down" size={12} color={MUTED} />
                        <View style={styles.routeDash} />
                      </View>
                      <View style={styles.routePoint}>
                        <View
                          style={[styles.routeDotOuter, styles.routeDotGreen]}
                        >
                          <View style={styles.routeDotInnerGreen} />
                        </View>
                        <View style={styles.routePointText}>
                          <Text style={styles.routeLabel}>Delivering To</Text>
                          <Text style={styles.routeValue} numberOfLines={2}>
                            {deliverToLabel || 'Select a delivery address'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {canCheckout && hasInternational && selectedAddress && (
          <View style={styles.intlBox}>
            <Text style={styles.intlTitle}>International Order</Text>
            <Text style={styles.intlText}>
              This order will be reviewed by the seller before shipment begins.
              Once approved, the seller will prepare and continue delivery.
            </Text>
          </View>
        )}

        {/* Receipt */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="receipt-outline" size={15} color={SECONDARY} />
              </View>
              <Text style={styles.cardTitle}>Receipt</Text>
            </View>
          </View>
          <View style={styles.receiptBody}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Product Price</Text>
              <Text style={styles.receiptValue}>{fmt(productPrice)}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Delivery Fee</Text>
              <Text style={styles.receiptValue}>{fmt(deliveryFee)}</Text>
            </View>
            <View style={styles.receiptDivider} />
            <View style={styles.receiptRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{fmt(totalAmount)}</Text>
            </View>
            <Text style={styles.receiptNote}>
              Prices shown in your marketplace currency
            </Text>
          </View>
        </View>


        <Text style={styles.footerBrand}>Plazore · Premium Digital Mall</Text>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.bottomLeft}>
          <Text style={styles.amountLabel}>Amount due</Text>
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
          disabled={placing || !canCheckout || !cartItems.length}
          activeOpacity={0.88}
          style={styles.ctaWrap}
        >
          <LinearGradient
            colors={
              placing || !canCheckout || !cartItems.length
                ? ['#374151', '#374151']
                : [GREEN, BLUE]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaBtn}
          >
            <Text style={styles.ctaText}>
              {!canCheckout ? 'Unavailable' : 'Place Order'}
            </Text>
            {canCheckout && (
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  toastWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingHorizontal: 14,
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
  toastMsg: { color: SECONDARY, fontSize: 12.5, marginTop: 3, lineHeight: 17 },

  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(9,11,15,0.92)',
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
    borderRadius: 36,
    backgroundColor: 'rgba(239,68,68,0.12)',
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
    borderRadius: 36,
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
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
    marginBottom: 8,
  },
  infoBody: {
    fontSize: 13,
    color: SECONDARY,
    lineHeight: 20,
  },
  flowRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  flowNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  flowNumText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  flowTitle: { color: TEXT, fontSize: 13, fontWeight: '700' },
  flowDesc: {
    color: SECONDARY,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  primaryCtaWrap: {
    width: '100%',
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  primaryCtaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryCta: {
    marginTop: 12,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: SURFACE_2,
  },
  secondaryCtaText: {
    color: TEXT,
    fontWeight: '600',
    fontSize: 14,
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.3,
  },
  headerRight: { width: 42 },

  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 32 },
  stepHint: {
    fontSize: 11,
    color: MUTED,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 14,
    marginLeft: 2,
  },

  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
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
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: TEXT },
  badge: { fontSize: 12, color: SECONDARY, fontWeight: '500' },
  link: { fontSize: 13, fontWeight: '600', color: GREEN },

  emptyBag: { paddingVertical: 28, alignItems: 'center' },
  emptyBagText: { marginTop: 8, fontSize: 13, color: MUTED },
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
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: SURFACE_2,
  },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1, marginLeft: 12, minWidth: 0 },
  itemName: { fontSize: 13, fontWeight: '600', color: TEXT, lineHeight: 18 },
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

  listPad: { padding: 12 },
  selectItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    marginBottom: 8,
    backgroundColor: SURFACE,
  },
  selectItemActive: {
    borderColor: GREEN,
    backgroundColor: SURFACE_2,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: MUTED,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: GREEN },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
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
    borderRadius: 6,
  },
  defaultText: { fontSize: 10, color: SECONDARY, fontWeight: '500' },
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
    paddingVertical: 10,
    gap: 6,
  },
  addBtnText: { fontSize: 13, fontWeight: '600', color: GREEN },

  emptyBlock: { paddingVertical: 28, alignItems: 'center' },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: TEXT },
  emptySub: { fontSize: 12, color: MUTED, marginTop: 4 },

  warningBox: {
    margin: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },
  warningTitle: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  warningText: {
    fontSize: 12,
    color: SECONDARY,
    marginTop: 4,
    lineHeight: 18,
  },
  routeBody: { padding: 14 },
  routeDivider: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  storeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  routeCard: {
    backgroundColor: SURFACE_2,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  routePoint: { flexDirection: 'row', alignItems: 'flex-start' },
  routeDotOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 12,
  },
  routeDotBlue: { backgroundColor: BLUE + '33' },
  routeDotGreen: { backgroundColor: GREEN + '33' },
  routeDotInnerBlue: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BLUE,
  },
  routeDotInnerGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
  routePointText: { flex: 1, minWidth: 0 },
  routeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  routeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
    lineHeight: 20,
  },
  routeConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    marginVertical: 6,
    gap: 4,
  },
  routeDash: { width: 1, height: 10, backgroundColor: LINE },

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
    fontWeight: '600',
    color: TEXT,
    maxWidth: '50%',
    textAlign: 'right',
  },
  receiptDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
    marginVertical: 8,
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: TEXT },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: GREEN,
    maxWidth: '50%',
    textAlign: 'right',
  },
  receiptNote: { fontSize: 11, color: MUTED, marginTop: 10 },

  intlBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  intlTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 6,
  },
  intlText: { fontSize: 12, color: SECONDARY, lineHeight: 18 },

  footerBrand: {
    textAlign: 'center',
    fontSize: 11,
    color: MUTED,
    marginTop: 8,
    letterSpacing: 0.6,
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 14 : 16,
  },
  bottomLeft: { flex: 1, marginRight: 12, minWidth: 0 },
  amountLabel: { fontSize: 11, color: SECONDARY, marginBottom: 2 },
  amountValue: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  ctaWrap: { borderRadius: 14, overflow: 'hidden' },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
    minWidth: 140,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})