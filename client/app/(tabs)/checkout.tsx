import Header from '@/components/Header'
import { COLORS } from '@/constants'
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
import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'

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

function resolveShipFrom(product: any): {
  label: string
  country: string
  hasShipFrom: boolean
  storeName: string
  sellerId: string
} {
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

  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'stripe'>('cash')
  const [addresses, setAddresses] = useState<any[]>([])
  const [selectedAddress, setSelectedAddress] = useState<any>(null)

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
      if (!token) {
        setPageLoading(false)
        return
      }
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
    } finally {
      setPageLoading(false)
    }
  }, [getToken])

  useFocusEffect(
    useCallback(() => {
      refreshRegion()
      loadAddresses()
    }, [refreshRegion, loadAddresses])
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
      Alert.alert(
        'Unavailable',
        'This seller has not completed their shipping information yet. Please try again later.'
      )
      return
    }
    if (!selectedAddress) {
      Alert.alert('Address needed', 'Please add or select a delivery address')
      return
    }
    if (!cartItems?.length) {
      Alert.alert('Empty bag', 'Your bag is empty')
      return
    }
    if (paymentMethod === 'stripe') {
      Alert.alert('Coming soon', 'Card payment is not available yet')
      return
    }

    try {
      setLoading(true)
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
        Alert.alert('Error', 'No valid products in bag')
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
        Alert.alert('Order placed', 'Your order is confirmed.', [
          {
            text: 'View Orders',
            onPress: () => router.replace('/orders' as any),
          },
        ])
      }
    } catch (error: any) {
      Alert.alert(
        'Order failed',
        error.response?.data?.message || 'Something went wrong'
      )
    } finally {
      setLoading(false)
    }
  }

  if (pageLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#EEF3F8] justify-center items-center">
        <ActivityIndicator size="large" color="#0F172A" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F8]" edges={['top']}>
      <Header title="Checkout" showBack />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Quiet mall step hint */}
        <Text className="text-[#94A3B8] text-[11px] tracking-[1.2px] uppercase mb-4 ml-1">
          Review · Deliver · Pay
        </Text>

        {/* ── Your Bag ── */}
        <View className="bg-white rounded-[22px] border border-[#E2E8F0] overflow-hidden mb-5 shadow-sm">
          <View className="px-5 py-4 border-b border-[#F1F5F9] flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-[#F1F5F9] items-center justify-center mr-2.5">
                <Ionicons name="bag-handle-outline" size={16} color="#475569" />
              </View>
              <Text className="text-[#0F172A] font-bold text-[16px]">Your Bag</Text>
            </View>
            <View className="bg-[#F1F5F9] px-2.5 py-1 rounded-full">
              <Text className="text-[#64748B] text-[12px] font-semibold">
                {itemCount} item{itemCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {cartItems.length === 0 ? (
            <View className="px-5 py-12 items-center">
              <Ionicons name="bag-outline" size={36} color="#CBD5E1" />
              <Text className="text-[#94A3B8] mt-3 text-[14px]">Your bag is empty</Text>
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
                  className={`px-5 py-4 flex-row ${
                    index < cartItems.length - 1 ? 'border-b border-[#F8FAFC]' : ''
                  }`}
                >
                  {item.product?.images?.[0] ? (
                    <Image
                      source={{ uri: item.product.images[0] }}
                      className="w-16 h-16 rounded-2xl bg-[#F1F5F9]"
                    />
                  ) : (
                    <View className="w-16 h-16 rounded-2xl bg-[#F1F5F9] items-center justify-center">
                      <Ionicons name="image-outline" size={22} color="#CBD5E1" />
                    </View>
                  )}
                  <View className="flex-1 ml-3.5 justify-center">
                    <Text
                      className="text-[#0F172A] font-semibold text-[14px] leading-5"
                      numberOfLines={2}
                    >
                      {item.product?.name || 'Product'}
                    </Text>
                    <Text className="text-[#64748B] text-[12px] mt-1">
                      Qty {item.quantity} · {fmtProduct(unit, productRegion)} each
                    </Text>
                    {lineFee > 0 && (
                      <Text className="text-[#94A3B8] text-[11px] mt-0.5">
                        Delivery {fmtProduct(lineFee, productRegion)}
                      </Text>
                    )}
                  </View>
                  <Text className="text-[#0F172A] font-bold text-[15px] self-center ml-2">
                    {fmtProduct(lineTotal, productRegion)}
                  </Text>
                </View>
              )
            })
          )}
        </View>

        {/* ── Deliver To ── */}
        <View className="bg-white rounded-[22px] border border-[#E2E8F0] overflow-hidden mb-5">
          <View className="px-5 py-4 border-b border-[#F1F5F9] flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-[#F1F5F9] items-center justify-center mr-2.5">
                <Ionicons name="home-outline" size={16} color="#475569" />
              </View>
              <Text className="text-[#0F172A] font-bold text-[16px]">Deliver To</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/addresses' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className="text-[#0284C7] font-semibold text-[13px]">Change</Text>
            </TouchableOpacity>
          </View>

          {addresses.length > 0 ? (
            <View className="p-3.5">
              {addresses.map((addr) => {
                const isSelected = selectedAddress?._id === addr._id
                return (
                  <TouchableOpacity
                    key={addr._id}
                    activeOpacity={0.85}
                    onPress={() => setSelectedAddress(addr)}
                    className={`rounded-2xl p-4 mb-2.5 border ${
                      isSelected
                        ? 'border-[#0F172A] bg-[#F8FAFC]'
                        : 'border-[#F1F5F9] bg-white'
                    }`}
                  >
                    <View className="flex-row items-start">
                      <View
                        className={`w-5 h-5 rounded-full border-2 mt-0.5 items-center justify-center ${
                          isSelected ? 'border-[#0F172A]' : 'border-[#CBD5E1]'
                        }`}
                      >
                        {isSelected ? (
                          <View className="w-2.5 h-2.5 rounded-full bg-[#0F172A]" />
                        ) : null}
                      </View>
                      <View className="flex-1 ml-3">
                        <View className="flex-row items-center flex-wrap">
                          <Text className="text-[#0F172A] font-bold text-[14px]">
                            {addr.type}
                          </Text>
                          {addr.isDefault ? (
                            <View className="ml-2 bg-[#F1F5F9] px-2 py-0.5 rounded-md">
                              <Text className="text-[#64748B] text-[10px] font-medium">
                                Default
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text className="text-[#64748B] text-[13px] leading-5 mt-1.5">
                          {addr.street}
                          {'\n'}
                          {addr.city}, {addr.state} {addr.zipCode}
                          {'\n'}
                          {addr.country}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              })}
              <TouchableOpacity
                onPress={() => router.push('/addresses' as any)}
                className="flex-row items-center justify-center py-3"
              >
                <Ionicons name="add-circle-outline" size={18} color="#0284C7" />
                <Text className="text-[#0284C7] font-medium ml-1.5 text-[13px]">
                  Add new address
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/addresses' as any)}
              className="px-5 py-10 items-center"
              activeOpacity={0.85}
            >
              <View className="w-14 h-14 rounded-full bg-[#F1F5F9] items-center justify-center mb-3">
                <Ionicons name="location-outline" size={26} color="#94A3B8" />
              </View>
              <Text className="text-[#0F172A] font-semibold text-[15px]">
                Add delivery address
              </Text>
              <Text className="text-[#94A3B8] text-[12px] mt-1">
                Where should we send your order?
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Pay With ── */}
        <View className="bg-white rounded-[22px] border border-[#E2E8F0] overflow-hidden mb-5">
          <View className="px-5 py-4 border-b border-[#F1F5F9] flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-[#F1F5F9] items-center justify-center mr-2.5">
              <Ionicons name="wallet-outline" size={16} color="#475569" />
            </View>
            <Text className="text-[#0F172A] font-bold text-[16px]">Pay With</Text>
          </View>

          <TouchableOpacity
            onPress={() => setPaymentMethod('cash')}
            activeOpacity={0.85}
            className={`px-5 py-4 flex-row items-center border-b border-[#F8FAFC] ${
              paymentMethod === 'cash' ? 'bg-[#F8FAFC]' : ''
            }`}
          >
            <View className="w-11 h-11 rounded-2xl bg-emerald-50 items-center justify-center">
              <Ionicons name="cash-outline" size={22} color="#059669" />
            </View>
            <View className="flex-1 ml-3.5">
              <Text className="text-[#0F172A] font-semibold text-[14px]">
                Cash on Delivery
              </Text>
              <Text className="text-[#64748B] text-[12px] mt-0.5">
                Pay when you receive
              </Text>
            </View>
            {paymentMethod === 'cash' ? (
              <Ionicons name="checkmark-circle" size={22} color="#0F172A" />
            ) : (
              <View className="w-5 h-5 rounded-full border-2 border-[#CBD5E1]" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPaymentMethod('stripe')}
            activeOpacity={0.85}
            className={`px-5 py-4 flex-row items-center ${
              paymentMethod === 'stripe' ? 'bg-[#F8FAFC]' : ''
            }`}
          >
            <View className="w-11 h-11 rounded-2xl bg-sky-50 items-center justify-center">
              <Ionicons name="card-outline" size={22} color="#0284C7" />
            </View>
            <View className="flex-1 ml-3.5">
              <Text className="text-[#0F172A] font-semibold text-[14px]">Card</Text>
              <Text className="text-[#94A3B8] text-[12px] mt-0.5">Coming soon</Text>
            </View>
            {paymentMethod === 'stripe' ? (
              <Ionicons name="checkmark-circle" size={22} color="#0F172A" />
            ) : (
              <View className="w-5 h-5 rounded-full border-2 border-[#CBD5E1]" />
            )}
          </TouchableOpacity>
        </View>

        {/* ── Receipt ── */}
        <View className="bg-white rounded-[22px] border border-[#E2E8F0] overflow-hidden mb-5">
          <View className="px-5 py-4 border-b border-dashed border-[#E2E8F0] flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-[#F1F5F9] items-center justify-center mr-2.5">
              <Ionicons name="receipt-outline" size={16} color="#475569" />
            </View>
            <Text className="text-[#0F172A] font-bold text-[16px]">Receipt</Text>
          </View>

          <View className="px-5 py-5">
            <View className="flex-row justify-between mb-3.5">
              <Text className="text-[#64748B] text-[15px]">Product Price</Text>
              <Text className="text-[#0F172A] font-semibold text-[15px]">
                {fmt(productPrice)}
              </Text>
            </View>

            <View className="flex-row justify-between mb-3.5">
              <Text className="text-[#64748B] text-[15px]">Delivery Fee</Text>
              <Text className="text-[#0F172A] font-semibold text-[15px]">
                {fmt(deliveryFee)}
              </Text>
            </View>

            <View className="border-t border-dashed border-[#E2E8F0] my-2" />

            <View className="flex-row justify-between items-center mt-2">
              <Text className="text-[#0F172A] font-bold text-[17px]">Total</Text>
              <Text className="text-[#0F172A] font-extrabold text-[24px] tracking-tight">
                {fmt(totalAmount)}
              </Text>
            </View>

            <Text className="text-[#94A3B8] text-[11px] mt-4 leading-[16px]">
              Product price + delivery only · shown in your marketplace currency
            </Text>
          </View>
        </View>

        {/* ── Shipping Route ── */}
        {cartItems.length > 0 && (
          <View className="bg-white rounded-[22px] border border-[#E2E8F0] overflow-hidden mb-5">
            <View className="px-5 py-4 border-b border-[#F1F5F9] flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-[#F1F5F9] items-center justify-center mr-2.5">
                <Ionicons name="navigate-outline" size={16} color="#475569" />
              </View>
              <Text className="text-[#0F172A] font-bold text-[16px]">
                Shipping Route
              </Text>
            </View>

            {!canCheckout ? (
              <View className="px-5 py-5">
                <View className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl px-4 py-4">
                  <Text className="text-[#92400E] font-semibold text-[14px]">
                    Shipping not available yet
                  </Text>
                  <Text className="text-[#A16207]/90 text-[13px] leading-5 mt-1.5">
                    This seller has not completed their shipping information
                    yet. Please try again later.
                  </Text>
                </View>
              </View>
            ) : (
              <View className="px-5 py-5">
                {shippingRoutes.map((route, idx) => (
                  <View
                    key={route.sellerId}
                    className={
                      idx > 0 ? 'mt-5 pt-5 border-t border-[#F1F5F9]' : ''
                    }
                  >
                    {shippingRoutes.length > 1 && (
                      <Text className="text-[#94A3B8] text-[11px] font-semibold uppercase tracking-wide mb-3">
                        {route.storeName}
                      </Text>
                    )}

                    <View className="flex-row">
                      <View className="items-center mr-3.5 w-9">
                        <View className="w-9 h-9 rounded-full bg-sky-50 items-center justify-center">
                          <Ionicons
                            name="location-outline"
                            size={17}
                            color="#0284C7"
                          />
                        </View>
                        <View className="w-[2px] flex-1 min-h-[36px] bg-[#E2E8F0] my-1.5 rounded-full" />
                        <View className="w-9 h-9 rounded-full bg-emerald-50 items-center justify-center">
                          <Ionicons
                            name="flag-outline"
                            size={17}
                            color="#059669"
                          />
                        </View>
                      </View>

                      <View className="flex-1 justify-between py-0.5">
                        <View className="mb-5">
                          <Text className="text-[#94A3B8] text-[11px] font-semibold uppercase tracking-wide">
                            Ships From
                          </Text>
                          <Text className="text-[#0F172A] font-semibold text-[15px] mt-1">
                            {route.fromLabel}
                          </Text>
                        </View>
                        <View>
                          <Text className="text-[#94A3B8] text-[11px] font-semibold uppercase tracking-wide">
                            Delivering To
                          </Text>
                          <Text className="text-[#0F172A] font-semibold text-[15px] mt-1">
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

        {/* ── International ── */}
        {canCheckout && hasInternational && selectedAddress ? (
          <View className="rounded-[22px] border border-indigo-100 overflow-hidden mb-4 bg-indigo-50/70">
            <View className="px-5 py-4">
              <View className="flex-row items-center mb-2">
                <Text className="text-[17px] mr-2">🌍</Text>
                <Text className="text-indigo-950 font-bold text-[15px]">
                  International Order
                </Text>
              </View>
              <Text className="text-indigo-900/80 text-[13px] leading-5">
                This order will be reviewed by the seller before shipment
                begins. Once approved, the seller will prepare the shipment and
                continue the delivery process.
              </Text>
            </View>
          </View>
        ) : null}

        <View className="items-center mt-2 mb-1">
          <View className="w-10 h-1 rounded-full bg-[#D8E0EA] mb-3" />
          <Text className="text-[#94A3B8] text-[11px] tracking-[1px]">
            Plazore · Premium Digital Mall
          </Text>
        </View>
      </ScrollView>

      {/* Sticky pay bar */}
      <View className="bg-white border-t border-[#E2E8F0] px-5 pt-3.5 pb-5">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-[#64748B] text-[13px]">Amount due</Text>
          <Text className="text-[#0F172A] font-extrabold text-[20px]">
            {fmt(totalAmount)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handlePlaceOrder}
          disabled={loading || !canCheckout || !cartItems.length}
          activeOpacity={0.9}
          className="overflow-hidden rounded-2xl"
        >
          <LinearGradient
            colors={
              loading || !canCheckout || !cartItems.length
                ? ['#94A3B8', '#94A3B8']
                : ['#1E293B', '#0F172A']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="py-[15px] items-center"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-[16px] tracking-wide">
                {!canCheckout
                  ? 'Shipping unavailable'
                  : `Place Order · ${fmt(totalAmount)}`}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}