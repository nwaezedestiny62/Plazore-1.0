import Header from '@/components/Header'
import { COLORS } from '@/constants'
import { Address } from '@/constants/types'
import { useCart } from '@/context/CartContext'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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

  const shipping = 2.0
  const tax = 0
  const total = cartTotal + shipping + tax

const [addresses, setAddresses] = useState<any[]>([])
const [selectedAddress, setSelectedAddress] = useState<any>(null)

useEffect(() => {
  const loadAddresses = async () => {
    try {
      const token = await getToken()
      const res = await api.get('/addresses', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        const list = res.data.data
        setAddresses(list)
        const def = list.find((a: any) => a.isDefault) || list[0]
        setSelectedAddress(def || null)
      }
    } catch (error) {
      console.log(error)
    } finally {
      setPageLoading(false)
    }
  }
  loadAddresses()
}, [])

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      Alert.alert('Error', 'Please add a shipping address')
      return
    }

    if (cartItems.length === 0) {
      Alert.alert('Error', 'Your cart is empty')
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
    price: Number(item.price) || 0,
    note: (item.note || '').trim().slice(0, 120),
  }))
  .filter((item) => item.productId)

      if (items.length === 0) {
        Alert.alert('Error', 'No valid products in cart')
        return
      }

      const payload = {
        shippingAddress: {
          street: selectedAddress.street,
          city: selectedAddress.city,
          state: selectedAddress.state,
          zipCode: selectedAddress.zipCode,
          country: selectedAddress.country,
        },
        buyerNote: '',
        items,
      }

      console.log('Sending order payload:', JSON.stringify(payload, null, 2))

      const res = await api.post('/orders', payload, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.data.success) {
        await clearCart()
        Alert.alert('Success', 'Order placed successfully!', [
          {
            text: 'View Orders',
            onPress: () => router.replace('/orders' as any),
          },
        ])
      }
    } catch (error: any) {
      console.log('Place order error:', error.response?.data || error.message)
      Alert.alert(
        'Order Failed',
        error.response?.data?.message || 'Something went wrong'
      )
    } finally {
      setLoading(false)
    }
  }

  if (pageLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface justify-center items-center">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <Header title="Checkout" showBack />

      <ScrollView className="flex-1 px-4 pt-2">
{/* Shipping Address */}
<Text className="text-xl font-bold text-primary mb-3">Shipping Address</Text>

{addresses.length > 0 ? (
  <View className="mb-6">
    {addresses.map((addr) => {
      const isSelected = selectedAddress?._id === addr._id

      return (
        <TouchableOpacity
          key={addr._id}
          activeOpacity={0.85}
          onPress={() => setSelectedAddress(addr)}
          className={`bg-white p-5 rounded-3xl mb-3 border-2 ${
            isSelected ? 'border-primary' : 'border-transparent'
          }`}
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              {/* Type + Default badge */}
              <View className="flex-row items-center mb-1.5">
                <Text className="text-base font-bold text-primary">
                  {addr.type}
                </Text>
              </View>

              <Text className="text-secondary leading-5">
                {addr.street}
                {'\n'}
                {addr.city}, {addr.state} {addr.zipCode}
                {'\n'}
                {addr.country}
              </Text>
            </View>

            {/* Selected indicator */}
            {isSelected ? (
              <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
            ) : (
              <View className="w-6 h-6 rounded-full border-2 border-gray-300 mt-0.5" />
            )}
          </View>
        </TouchableOpacity>
      )
    })}

    {/* Add new address */}
    <TouchableOpacity
      onPress={() => router.push('/addresses' as any)}
      className="flex-row items-center justify-center py-3"
    >
      <Ionicons name="add-circle-outline" size={20} color={COLORS.accent} />
      <Text className="text-accent font-medium ml-2">Add new address</Text>
    </TouchableOpacity>
  </View>
) : (
  <TouchableOpacity
    className="bg-white p-8 rounded-3xl mb-8 items-center justify-center border-2 border-dashed border-gray-200"
    onPress={() => router.push('/addresses' as any)}
  >
    <Ionicons name="location-outline" size={32} color={COLORS.secondary} />
    <Text className="text-primary font-bold mt-3">Add Shipping Address</Text>
  </TouchableOpacity>
)}

        <Text className="text-xl font-bold text-primary mb-4">Payment Method</Text>

        <TouchableOpacity
          onPress={() => setPaymentMethod('cash')}
          className={`bg-white p-5 rounded-3xl mb-4 flex-row items-center border-2 ${
            paymentMethod === 'cash' ? 'border-primary' : 'border-transparent'
          }`}
        >
          <View className="w-12 h-12 bg-green-50 rounded-2xl items-center justify-center">
            <Ionicons name="cash-outline" size={28} color="#10b981" />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-base font-bold text-primary">Cash on Delivery</Text>
            <Text className="text-secondary text-sm">Pay when you receive the order</Text>
          </View>
          {paymentMethod === 'cash' && (
            <Ionicons name="checkmark-circle" size={26} color={COLORS.primary} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setPaymentMethod('stripe')}
          className={`bg-white p-5 rounded-3xl mb-8 flex-row items-center border-2 ${
            paymentMethod === 'stripe' ? 'border-primary' : 'border-transparent'
          }`}
        >
          <View className="w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center">
            <Ionicons name="card-outline" size={28} color="#3b82f6" />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-base font-bold text-primary">Pay with Card</Text>
            <Text className="text-secondary text-sm">Coming soon</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <View className="bg-white p-5 border-t border-gray-100">
        <Text className="text-lg font-bold text-primary mb-4">Order Summary</Text>

        <View className="mb-6">
          <View className="flex-row justify-between mb-2">
            <Text className="text-secondary">Subtotal</Text>
            <Text className="font-medium">${cartTotal.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-secondary">Shipping</Text>
            <Text className="font-medium">${shipping.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-secondary">Tax</Text>
            <Text className="font-medium">${tax.toFixed(2)}</Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-xl font-bold text-primary">Total</Text>
          <Text className="text-2xl font-bold text-primary">${total.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          className={`py-4 rounded-2xl items-center ${
            loading ? 'bg-gray-400' : 'bg-primary'
          }`}
          onPress={handlePlaceOrder}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-lg">Place Order</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}