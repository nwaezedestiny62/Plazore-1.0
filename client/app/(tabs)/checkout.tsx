import Header from '@/components/Header'
import { COLORS } from '@/constants'
import { useCart } from '@/context/CartContext'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@clerk/clerk-expo'
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
import api from '@/constants/api'

export default function Checkout() {
  const { cartItems, cartTotal, clearCart } = useCart()
  const { getToken } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'stripe'>('cash')
  const [addresses, setAddresses] = useState<any[]>([])
  const [selectedAddress, setSelectedAddress] = useState<any>(null)

  // Exact delivery fee the seller set on product.shipping.deliveryFee
  const deliveryFee = useMemo(() => {
    if (!cartItems?.length) return 0

    const bySeller: Record<string, number> = {}
    let noSellerMax = 0

    for (const item of cartItems) {
      const fee = Number(item.product?.shipping?.deliveryFee) || 0
      const seller = item.product?.seller as any
      const sellerId =
        typeof seller === 'string'
          ? seller
          : seller && seller._id
            ? String(seller._id)
            : ''

      if (sellerId) {
        bySeller[sellerId] = Math.max(bySeller[sellerId] || 0, fee)
      } else {
        noSellerMax = Math.max(noSellerMax, fee)
      }
    }

    return (
      Object.values(bySeller).reduce((sum, fee) => sum + fee, 0) + noSellerMax
    )
  }, [cartItems])

  const productPrice = Number(cartTotal) || 0
  const totalAmount = productPrice + deliveryFee
  const itemCount = cartItems.reduce((n, i) => n + (i.quantity || 0), 0)

  const loadAddresses = useCallback(async () => {
    try {
      const token = await getToken()
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
    } catch (error) {
      console.log('Checkout addresses error:', error)
    } finally {
      setPageLoading(false)
    }
  }, [getToken])

  useFocusEffect(
    useCallback(() => {
      loadAddresses()
    }, [loadAddresses])
  )

  const handlePlaceOrder = async () => {
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
      console.log('Place order error:', error.response?.data || error.message)
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
      <SafeAreaView className="flex-1 bg-[#F4F5F7] justify-center items-center">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F4F5F7]" edges={['top']}>
      <Header title="Checkout" showBack />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Your bag — mall counter style */}
        <View className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
          <View className="px-4 py-3 border-b border-gray-100 flex-row items-center justify-between">
            <Text className="text-primary font-bold text-base">Your Bag</Text>
            <Text className="text-secondary text-sm">
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </Text>
          </View>

          {cartItems.length === 0 ? (
            <View className="px-4 py-8 items-center">
              <Text className="text-secondary">Your bag is empty</Text>
            </View>
          ) : (
            cartItems.map((item, index) => {
              const lineTotal = (item.price || 0) * (item.quantity || 1)
              const lineFee = Number(item.product?.shipping?.deliveryFee) || 0
              return (
                <View
                  key={item.id}
                  className={`px-4 py-3.5 flex-row ${
                    index < cartItems.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  {item.product?.images?.[0] ? (
                    <Image
                      source={{ uri: item.product.images[0] }}
                      className="w-14 h-14 rounded-xl bg-gray-100"
                    />
                  ) : (
                    <View className="w-14 h-14 rounded-xl bg-gray-100" />
                  )}
                  <View className="flex-1 ml-3 justify-center">
                    <Text
                      className="text-primary font-semibold text-[14px]"
                      numberOfLines={1}
                    >
                      {item.product?.name || 'Product'}
                    </Text>
                    <Text className="text-secondary text-[12px] mt-0.5">
                      Qty {item.quantity} · ${Number(item.price).toFixed(2)} each
                    </Text>
                    {lineFee > 0 && (
                      <Text className="text-secondary text-[11px] mt-0.5">
                        Delivery Fee ${lineFee.toFixed(2)}
                      </Text>
                    )}
                  </View>
                  <Text className="text-primary font-bold text-[14px] self-center">
                    ${lineTotal.toFixed(2)}
                  </Text>
                </View>
              )
            })
          )}
        </View>

        {/* Deliver to */}
        <View className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
          <View className="px-4 py-3 border-b border-gray-100 flex-row items-center justify-between">
            <Text className="text-primary font-bold text-base">Deliver To</Text>
            <TouchableOpacity onPress={() => router.push('/addresses' as any)}>
              <Text className="text-accent font-semibold text-sm">Change</Text>
            </TouchableOpacity>
          </View>

          {addresses.length > 0 ? (
            <View className="p-3">
              {addresses.map((addr) => {
                const isSelected = selectedAddress?._id === addr._id
                return (
                  <TouchableOpacity
                    key={addr._id}
                    activeOpacity={0.85}
                    onPress={() => setSelectedAddress(addr)}
                    className={`rounded-xl p-3.5 mb-2 border ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-100 bg-white'
                    }`}
                  >
                    <View className="flex-row items-start">
                      <View
                        className={`w-5 h-5 rounded-full border-2 mt-0.5 items-center justify-center ${
                          isSelected ? 'border-primary' : 'border-gray-300'
                        }`}
                      >
                        {isSelected ? (
                          <View className="w-2.5 h-2.5 rounded-full bg-primary" />
                        ) : null}
                      </View>
                      <View className="flex-1 ml-3">
                        <View className="flex-row items-center">
                          <Text className="text-primary font-bold text-[14px]">
                            {addr.type}
                          </Text>
                          {addr.isDefault ? (
                            <View className="ml-2 bg-gray-100 px-2 py-0.5 rounded">
                              <Text className="text-secondary text-[10px] font-medium">
                                Default
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text className="text-secondary text-[13px] leading-5 mt-1">
                          {addr.street}, {addr.city}, {addr.state} {addr.zipCode}
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
                className="flex-row items-center justify-center py-2"
              >
                <Ionicons name="add" size={18} color={COLORS.accent} />
                <Text className="text-accent font-medium ml-1 text-sm">
                  Add new address
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/addresses' as any)}
              className="px-4 py-8 items-center"
            >
              <Ionicons name="location-outline" size={28} color="#9CA3AF" />
              <Text className="text-primary font-semibold mt-2">
                Add delivery address
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Pay with */}
        <View className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
          <View className="px-4 py-3 border-b border-gray-100">
            <Text className="text-primary font-bold text-base">Pay With</Text>
          </View>

          <TouchableOpacity
            onPress={() => setPaymentMethod('cash')}
            className={`px-4 py-4 flex-row items-center border-b border-gray-50 ${
              paymentMethod === 'cash' ? 'bg-primary/5' : ''
            }`}
          >
            <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center">
              <Ionicons name="cash-outline" size={22} color="#059669" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-primary font-semibold text-[14px]">
                Cash on Delivery
              </Text>
              <Text className="text-secondary text-[12px]">
                Pay when you receive
              </Text>
            </View>
            {paymentMethod === 'cash' ? (
              <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
            ) : (
              <View className="w-5 h-5 rounded-full border-2 border-gray-300" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPaymentMethod('stripe')}
            className={`px-4 py-4 flex-row items-center ${
              paymentMethod === 'stripe' ? 'bg-primary/5' : ''
            }`}
          >
            <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center">
              <Ionicons name="card-outline" size={22} color="#2563EB" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-primary font-semibold text-[14px]">
                Card
              </Text>
              <Text className="text-secondary text-[12px]">Coming soon</Text>
            </View>
            {paymentMethod === 'stripe' ? (
              <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
            ) : (
              <View className="w-5 h-5 rounded-full border-2 border-gray-300" />
            )}
          </TouchableOpacity>
        </View>

        {/* Receipt */}
        <View className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-2">
          <View className="px-4 py-3 border-b border-dashed border-gray-200">
            <Text className="text-primary font-bold text-base">Receipt</Text>
          </View>

          <View className="px-4 py-4">
            <View className="flex-row justify-between mb-3">
              <Text className="text-secondary text-[15px]">Product Price</Text>
              <Text className="text-primary font-semibold text-[15px]">
                ${productPrice.toFixed(2)}
              </Text>
            </View>

            <View className="flex-row justify-between mb-3">
              <Text className="text-secondary text-[15px]">Delivery Fee</Text>
              <Text className="text-primary font-semibold text-[15px]">
                ${deliveryFee.toFixed(2)}
              </Text>
            </View>

            <View className="border-t border-dashed border-gray-200 my-2" />

            <View className="flex-row justify-between items-center mt-1">
              <Text className="text-primary font-bold text-lg">Total Amount</Text>
              <Text className="text-primary font-extrabold text-2xl">
                ${totalAmount.toFixed(2)}
              </Text>
            </View>

            <Text className="text-secondary text-[11px] mt-3 leading-4">
              You pay Product Price + Delivery Fee only. No extra platform charges
              at checkout.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom pay bar */}
      <View className="bg-white border-t border-gray-200 px-4 pt-3 pb-5">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-secondary text-sm">Amount due</Text>
          <Text className="text-primary font-extrabold text-xl">
            ${totalAmount.toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          className={`py-4 rounded-xl items-center ${
            loading ? 'bg-gray-400' : 'bg-primary'
          }`}
          onPress={handlePlaceOrder}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-[16px]">
              Place Order · ${totalAmount.toFixed(2)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}