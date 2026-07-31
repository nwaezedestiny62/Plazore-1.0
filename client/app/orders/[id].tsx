import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import api from '@/constants/api'

const steps = ['Preparing', 'Shipped', 'Delivered']

export default function BuyerOrderDetails() {
  const rawId = useLocalSearchParams<{ id: string | string[] }>().id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const { getToken } = useAuth()
  const router = useRouter()

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false)
        return
      }
      try {
        const token = await getToken()
        const res = await api.get(`/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.data.success) {
          setOrder(res.data.data)
        }
      } catch (error) {
        console.log('Buyer order load error:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const copyTracking = async (value: string) => {
    try {
      await Clipboard.setStringAsync(value)
      Alert.alert('Copied', 'Tracking number copied to clipboard')
    } catch {
      Alert.alert('Error', 'Could not copy tracking number')
    }
  }

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-[#07111F]">
        <ActivityIndicator size="large" color="#DCEBFF" />
      </View>
    )
  }

  if (!order) {
    return (
      <View className="flex-1 justify-center items-center bg-[#07111F]">
        <Text className="text-[#7F93A8]">Order not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-[#DCEBFF]">Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const currentStep = Math.max(0, steps.indexOf(order.orderStatus))
  const shipping = order.shipping || {}
  const method =
    shipping.shippingMethod ||
    order.productShipping?.method ||
    (shipping.deliveryCompany ? 'courier' : undefined)

  const isSelf = method === 'self'
  const isCourier = method === 'courier' || (!isSelf && !!shipping.deliveryCompany)

  const sellerNote = (shipping.selfDeliveryNote || '').trim()
  const tracking = (shipping.trackingNumber || '').trim()
  const hasShippingBlock =
    order.orderStatus === 'Shipped' ||
    order.orderStatus === 'Delivered' ||
    !!shipping.shippedAt

  return (
    <SafeAreaView className="flex-1 bg-[#07111F]" edges={['top']}>
      <View className="px-5 pt-3 pb-3 flex-row items-center border-b border-[#1E334A]">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
        </TouchableOpacity>
        <View className="flex-1">
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
        <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mb-5">
          <Text className="text-white font-bold text-lg mb-5">
            Order Progress
          </Text>
          {steps.map((step, index) => {
            const isActive = index <= currentStep
            const isCurrent = index === currentStep
            return (
              <View key={step} className="flex-row items-center mb-4 last:mb-0">
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
        <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mb-5">
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
                  Qty: {item.quantity} · ${Number(item.price).toFixed(2)}
                </Text>
              </View>
            </View>
            <View className="mt-4 bg-[#13263B] rounded-2xl px-4 py-3">
              <Text className="text-[#8EA4B8] text-[11px] mb-1">Your Note</Text>
              <Text className="text-[#DCEBFF] text-[14px] leading-5">
                {item.note?.trim() ? item.note : 'No note added.'}
              </Text>
            </View>
          </View>
        ))}

        {/* Shipping details — after ship */}
        {hasShippingBlock && (
          <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mt-1 mb-5">
            <Text className="text-white font-bold text-lg mb-4">
              Shipping Details
            </Text>

            <View className="mb-4">
              <Text className="text-[#8EA4B8] text-xs mb-1">Method</Text>
              <Text className="text-[#DCEBFF] text-[15px] font-medium">
                {isSelf ? 'Self Delivery' : 'Courier'}
              </Text>
            </View>

            {(isCourier || shipping.deliveryCompany) &&
              !!shipping.deliveryCompany && (
                <View className="mb-4">
                  <Text className="text-[#8EA4B8] text-xs mb-1">
                    Courier Company
                  </Text>
                  <Text className="text-[#DCEBFF] text-[15px]">
                    {shipping.deliveryCompany}
                  </Text>
                </View>
              )}

            {/* Tracking — copyable */}
            {!!tracking && (
              <View className="mb-4">
                <Text className="text-[#8EA4B8] text-xs mb-1.5">
                  Tracking Number
                </Text>
                <TouchableOpacity
                  onPress={() => copyTracking(tracking)}
                  activeOpacity={0.8}
                  className="flex-row items-center bg-[#13263B] border border-[#1E334A] rounded-2xl px-4 py-3.5"
                >
                  <Text
                    className="text-[#DCEBFF] text-[15px] font-semibold flex-1"
                    selectable
                  >
                    {tracking}
                  </Text>
                  <View className="flex-row items-center ml-3 pl-3 border-l border-[#1E334A]">
                    <Ionicons name="copy-outline" size={18} color="#9EC5FF" />
                    <Text className="text-[#9EC5FF] text-[12px] font-semibold ml-1.5">
                      Copy
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Seller note — show whenever present (self or courier) */}
            {!!sellerNote && (
              <View className="mb-4 bg-[#13263B] rounded-2xl px-4 py-3.5 border border-[#1E334A]">
                <View className="flex-row items-center mb-1.5">
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={14}
                    color="#8EA4B8"
                  />
                  <Text className="text-[#8EA4B8] text-xs ml-1.5">
                    Note from seller
                  </Text>
                </View>
                <Text className="text-[#DCEBFF] text-[15px] leading-6">
                  {sellerNote}
                </Text>
              </View>
            )}

            {shipping.estimatedDelivery ? (
              <View>
                <Text className="text-[#8EA4B8] text-xs mb-1">
                  Estimated Delivery
                </Text>
                <Text className="text-[#DCEBFF] text-[15px]">
                  {new Date(shipping.estimatedDelivery).toLocaleDateString()}
                </Text>
              </View>
            ) : null}

            {!sellerNote &&
              !tracking &&
              !shipping.deliveryCompany &&
              !shipping.estimatedDelivery && (
                <Text className="text-[#6B8299] text-[13px]">
                  Shipping details will appear here once the seller ships your
                  order.
                </Text>
              )}
          </View>
        )}

        {order.orderStatus === 'Preparing' && (
          <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mb-5">
            <Text className="text-white font-bold text-base mb-1">
              Preparing your order
            </Text>
            <Text className="text-[#8EA4B8] text-[13px] leading-5">
              The seller is packing your items. Tracking and seller notes appear
              after they mark it as shipped.
            </Text>
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

        {/* Totals */}
        <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5">
          <View className="flex-row justify-between mb-2">
            <Text className="text-[#8EA4B8]">Subtotal</Text>
            <Text className="text-white">
              ${Number(order.subtotal || 0).toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-[#8EA4B8]">Delivery</Text>
            <Text className="text-white">
              ${Number(order.shippingCost || 0).toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between items-center pt-2 border-t border-[#1E334A]">
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