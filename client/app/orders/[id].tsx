import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import api from '@/constants/api'

const steps = ['Preparing', 'Shipped', 'Delivered']

export default function BuyerOrderDetails() {
  const params = useLocalSearchParams<{ id: string | string[] }>()
  const rawId = params.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId

  const { getToken } = useAuth()
  const router = useRouter()

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setErrorMsg('Missing order id')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setErrorMsg(null)
        const token = await getToken()
        console.log('Fetching order id →', id)

        const res = await api.get(`/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.data.success) {
          setOrder(res.data.data)
        } else {
          setErrorMsg(res.data.message || 'Order not found')
        }
      } catch (error: any) {
        console.log(
          'Order details error:',
          error.response?.status,
          error.response?.data || error.message
        )
        setErrorMsg(
          error.response?.data?.message ||
            error.message ||
            'Could not load order'
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-[#07111F]">
        <ActivityIndicator size="large" color="#DCEBFF" />
      </View>
    )
  }

  if (!order) {
    return (
      <View className="flex-1 justify-center items-center bg-[#07111F] px-6">
        <Text className="text-[#7F93A8] text-center text-base">
          {errorMsg || 'Order not found'}
        </Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-6">
          <Text className="text-[#DCEBFF] font-semibold">Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const currentStep = steps.indexOf(order.orderStatus)

  const shipping = order.shipping || {}
  const method = shipping.shippingMethod // "courier" | "self" | undefined

  const isSelf = method === 'self'
  const isCourier =
    method === 'courier' || (!method && !!shipping.deliveryCompany)

  return (
    <SafeAreaView className="flex-1 bg-[#07111F]" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-3 pb-3 flex-row items-center border-b border-[#1E334A]">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
        </TouchableOpacity>
        <View>
          <Text className="text-white text-xl font-bold">
            {order.orderNumber}
          </Text>
          <Text className="text-[#8EA4B8] text-xs mt-0.5">
            {new Date(order.createdAt).toLocaleString()}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress */}
        <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mb-6">
          <Text className="text-white font-bold text-lg mb-5">
            Order Progress
          </Text>

          {steps.map((step, index) => {
            const isActive = index <= currentStep
            const isCurrent = index === currentStep

            return (
              <View
                key={step}
                className="flex-row items-center mb-5 last:mb-0"
              >
                <View
                  className={`w-9 h-9 rounded-full items-center justify-center ${
                    isActive ? 'bg-[#DCEBFF]' : 'bg-[#1A2F45]'
                  }`}
                >
                  {isActive ? (
                    <Ionicons name="checkmark" size={18} color="#07111F" />
                  ) : (
                    <Text className="text-[#6B8299] text-xs font-medium">
                      {index + 1}
                    </Text>
                  )}
                </View>

                <Text
                  className={`ml-3.5 text-[15px] font-medium ${
                    isCurrent
                      ? 'text-[#DCEBFF]'
                      : isActive
                      ? 'text-white'
                      : 'text-[#6B8299]'
                  }`}
                >
                  {step}
                </Text>
              </View>
            )
          })}
        </View>

        {/* Seller */}
        <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mb-6">
          <Text className="text-[#8EA4B8] text-sm mb-1">Sold by</Text>
          <Text className="text-white font-bold text-lg">
            {order.seller?.storeName || order.seller?.name || 'Seller'}
          </Text>
        </View>

        {/* Items */}
        <Text className="text-white font-bold text-lg mb-3">Items</Text>

        {order.items?.map((item: any, idx: number) => (
          <View
            key={idx}
            className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-4 mb-4"
          >
            <View className="flex-row">
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  className="w-16 h-16 rounded-xl bg-[#13263B]"
                />
              ) : (
                <View className="w-16 h-16 rounded-xl bg-[#13263B]" />
              )}

              <View className="ml-3.5 flex-1 justify-center">
                <Text className="text-white font-semibold" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text className="text-[#8EA4B8] text-sm mt-1">
                  Qty: {item.quantity} • ${Number(item.price).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Your Note */}
            <View className="mt-4 bg-[#13263B] rounded-2xl px-4 py-3">
              <Text className="text-[#8EA4B8] text-[11px] mb-1">Your Note</Text>
              <Text className="text-[#DCEBFF] text-[14px] leading-5">
                {item.note && item.note.trim()
                  ? item.note
                  : 'No note added.'}
              </Text>
            </View>
          </View>
        ))}

        {/* ========== SHIPPING INFO ========== */}
        {order.orderStatus !== 'Preparing' && (
          <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mt-2 mb-6">
            <Text className="text-white font-bold text-lg mb-4">
              Shipping Details
            </Text>

            {/* Method */}
<Text className="text-[#8EA4B8] text-sm mb-1">Method</Text>
<Text className="text-[#DCEBFF] mb-3">
  {order.shipping.shippingMethod === "self"
    ? "Self Delivery"
    : "Courier"}
</Text>

            {/* Courier details */}
            {isCourier && (
              <>
                {shipping.deliveryCompany ? (
                  <View className="mb-3">
                    <Text className="text-[#8EA4B8] text-xs mb-1">
                      Courier Company
                    </Text>
                    <Text className="text-[#DCEBFF] text-[15px]">
                      {shipping.deliveryCompany}
                    </Text>
                  </View>
                ) : null}

                {shipping.trackingNumber ? (
                  <View className="mb-3">
                    <Text className="text-[#8EA4B8] text-xs mb-1">
                      Tracking Number
                    </Text>
                    <Text className="text-[#DCEBFF] text-[15px]">
                      {shipping.trackingNumber}
                    </Text>
                  </View>
                ) : null}
              </>
            )}

            {/* Self Delivery note */}
            {isSelf && shipping.selfDeliveryNote ? (
              <View className="mb-3">
                <Text className="text-[#8EA4B8] text-xs mb-1">Seller Note</Text>
                <Text className="text-[#DCEBFF] text-[15px] leading-5">
                  {shipping.selfDeliveryNote}
                </Text>
              </View>
            ) : null}

            {/* Estimated delivery */}
            {shipping.estimatedDelivery ? (
              <View className="mb-1">
                <Text className="text-[#8EA4B8] text-xs mb-1">
                  Estimated Delivery
                </Text>
                <Text className="text-[#DCEBFF] text-[15px]">
                  {new Date(
                    shipping.estimatedDelivery
                  ).toLocaleDateString()}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Address */}
        <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mb-4">
          <Text className="text-white font-bold text-lg mb-3">
            Shipping Address
          </Text>
          <Text className="text-[#AFC3D6] leading-6 text-[15px]">
            {order.shippingAddress?.street}
            {'\n'}
            {order.shippingAddress?.city}, {order.shippingAddress?.state}{' '}
            {order.shippingAddress?.zipCode}
            {'\n'}
            {order.shippingAddress?.country}
          </Text>
        </View>

        {/* Total */}
        <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5">
          <View className="flex-row justify-between items-center">
            <Text className="text-[#8EA4B8]">Order Total</Text>
            <Text className="text-white font-bold text-xl">
              ${Number(order.totalAmount).toFixed(2)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}