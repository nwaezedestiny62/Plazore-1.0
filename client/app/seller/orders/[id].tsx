import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import api from '@/constants/api'

export default function SellerOrderDetails() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { getToken } = useAuth()
  const router = useRouter()

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [trackingNumber, setTrackingNumber] = useState('')
  const [estimatedDelivery, setEstimatedDelivery] = useState('')
  const [sellerNote, setSellerNote] = useState('')

  const loadOrder = async () => {
    try {
      setLoading(true)
      const token = await getToken()
      const res = await api.get(`/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) setOrder(res.data.data)
    } catch (error) {
      console.log(error)
      Alert.alert('Error', 'Could not load order')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrder()
  }, [id])

  const impliedMethod =
    order?.productShipping?.method === 'self' ? 'self' : 'courier'
  const courierName = order?.productShipping?.courierCompany || ''

  const handleShip = async () => {
    if (!estimatedDelivery.trim()) {
      Alert.alert('Required', 'Please enter an estimated delivery date')
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
        Alert.alert('Shipped', 'Order has been marked as Shipped')
      }
    } catch (error: any) {
      console.log(error.response?.data || error.message)
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to ship order'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeliver = async () => {
    Alert.alert(
      'Mark as Delivered',
      'Confirm that this order has been delivered to the buyer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
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
                Alert.alert('Done', 'Order marked as Delivered')
              }
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.response?.data?.message || 'Failed to update status'
              )
            } finally {
              setSubmitting(false)
            }
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-[#060D18]">
        <ActivityIndicator size="large" color="#9EC5FF" />
      </View>
    )
  }

  if (!order) {
    return (
      <View className="flex-1 justify-center items-center bg-[#060D18]">
        <Text className="text-[#7F93A8]">Order not found</Text>
      </View>
    )
  }

  const isPreparing = order.orderStatus === 'Preparing'
  const isShipped = order.orderStatus === 'Shipped'
  const isDelivered = order.orderStatus === 'Delivered'

  return (
    <View className="flex-1 bg-[#060D18]">
      <View className="px-5 pt-4 pb-3 flex-row items-center border-b border-[#1A2D42]">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color="#9EC5FF" />
        </TouchableOpacity>
        <View>
          <Text className="text-white text-xl font-bold">{order.orderNumber}</Text>
          <Text className="text-[#6B8299] text-xs mt-0.5">
            {new Date(order.createdAt).toLocaleString()}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-[#0B1625] border border-[#1A2D42] rounded-[24px] p-5 mb-5">
          <Text className="text-[#6B8299] text-sm mb-1">Current Status</Text>
          <Text className="text-white text-2xl font-extrabold">
            {order.orderStatus}
          </Text>
        </View>

        {/* Buyer — no email */}
        <View className="bg-[#0B1625] border border-[#1A2D42] rounded-[24px] p-5 mb-5">
          <Text className="text-white font-bold text-lg mb-4">
            Buyer Information
          </Text>
          <Text className="text-[#6B8299] text-xs mb-1">Name</Text>
          <Text className="text-[#DCEBFF] text-[15px] font-semibold mb-3">
            {order.buyerContact?.name || order.buyer?.name || 'Buyer'}
          </Text>
          <Text className="text-[#6B8299] text-xs mb-1">Phone</Text>
          <Text className="text-[#DCEBFF] text-[15px] mb-4">
            {order.buyerContact?.phone || order.buyer?.phone || 'Not provided'}
          </Text>
          <View className="bg-[#13263B] border border-[#DCEBFF]/30 rounded-2xl p-4">
            <View className="flex-row items-center mb-2">
              <Ionicons name="location" size={16} color="#9EC5FF" />
              <Text className="text-white font-bold ml-2">Delivery Address</Text>
            </View>
            <Text className="text-white text-[15px] leading-6">
              {order.shippingAddress?.street}
              {'\n'}
              {order.shippingAddress?.city}, {order.shippingAddress?.state}{' '}
              {order.shippingAddress?.zipCode}
              {'\n'}
              {order.shippingAddress?.country}
            </Text>
          </View>
        </View>

        <Text className="text-white font-bold text-lg mb-3">Products</Text>
        {order.items?.map((item: any, index: number) => (
          <View
            key={index}
            className="bg-[#0B1625] border border-[#1A2D42] rounded-[24px] p-4 mb-4"
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
              <View className="ml-3 flex-1 justify-center">
                <Text className="text-white font-semibold" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text className="text-[#6B8299] text-sm mt-1">
                  Qty: {item.quantity} · ${Number(item.price).toFixed(2)}
                </Text>
              </View>
            </View>
            <View className="mt-3 bg-[#13263B] rounded-2xl px-4 py-3">
              <Text className="text-[#6B8299] text-[11px] mb-1">Buyer Note</Text>
              <Text className="text-[#DCEBFF] text-[14px]">
                {item.note?.trim() ? item.note : 'No buyer note.'}
              </Text>
            </View>
          </View>
        ))}

        {/* Ship — method locked from product */}
        {isPreparing && (
          <View className="bg-[#0B1625] border border-[#1A2D42] rounded-[24px] p-5 mt-2 mb-5">
            <Text className="text-white font-bold text-lg mb-1">
              Ship this Order
            </Text>
            <Text className="text-[#6B8299] text-sm mb-4">
              Delivery method was set when the product was published.
            </Text>

            <View className="bg-[#122033] border border-[#1E334A] rounded-2xl px-4 py-3 mb-5 flex-row items-center">
              <Ionicons
                name={impliedMethod === 'self' ? 'walk-outline' : 'car-outline'}
                size={18}
                color="#9EC5FF"
              />
              <Text className="text-[#B8D4FF] font-semibold ml-2">
                {impliedMethod === 'self'
                  ? 'Self Delivery'
                  : `Courier${courierName ? ` · ${courierName}` : ''}`}
              </Text>
            </View>

            <Text className="text-[#7F93A8] text-[11px] mb-1.5 font-semibold uppercase">
              Estimated delivery date *
            </Text>
            <TextInput
              value={estimatedDelivery}
              onChangeText={setEstimatedDelivery}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#3D5268"
              className="bg-[#0A121C] border border-[#1A2D42] rounded-2xl px-4 py-3.5 text-white mb-4"
            />

            {impliedMethod === 'courier' && (
              <>
                <Text className="text-[#7F93A8] text-[11px] mb-1.5 font-semibold uppercase">
                  Tracking number
                </Text>
                <TextInput
                  value={trackingNumber}
                  onChangeText={setTrackingNumber}
                  placeholder="Optional tracking number"
                  placeholderTextColor="#3D5268"
                  className="bg-[#0A121C] border border-[#1A2D42] rounded-2xl px-4 py-3.5 text-white mb-4"
                />
              </>
            )}

            <Text className="text-[#7F93A8] text-[11px] mb-1.5 font-semibold uppercase">
              Note to buyer
            </Text>
            <TextInput
              value={sellerNote}
              onChangeText={(t) => setSellerNote(t.slice(0, 120))}
              placeholder="Optional note"
              placeholderTextColor="#3D5268"
              multiline
              className="bg-[#0A121C] border border-[#1A2D42] rounded-2xl px-4 py-3.5 text-white mb-2 min-h-[80]"
              style={{ textAlignVertical: 'top' }}
            />
            <Text className="text-[#5A7088] text-xs text-right mb-4">
              {sellerNote.length}/120
            </Text>

            <TouchableOpacity
              onPress={handleShip}
              disabled={submitting}
              className="bg-[#DCEBFF] rounded-2xl py-4 items-center"
            >
              {submitting ? (
                <ActivityIndicator color="#060D18" />
              ) : (
                <Text className="text-[#060D18] font-extrabold text-[15px]">
                  Mark as Shipped
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {(isShipped || isDelivered) && order.shipping && (
          <View className="bg-[#0B1625] border border-[#1A2D42] rounded-[24px] p-5 mb-5">
            <Text className="text-white font-bold text-lg mb-3">
              Shipping Info
            </Text>
            <Text className="text-[#6B8299] text-sm mb-1">Method</Text>
            <Text className="text-[#DCEBFF] mb-3">
              {order.shipping.shippingMethod === 'self'
                ? 'Self Delivery'
                : 'Courier'}
            </Text>
            {order.shipping.deliveryCompany ? (
              <>
                <Text className="text-[#6B8299] text-sm mb-1">Courier</Text>
                <Text className="text-[#DCEBFF] mb-3">
                  {order.shipping.deliveryCompany}
                </Text>
              </>
            ) : null}
            {order.shipping.trackingNumber ? (
              <>
                <Text className="text-[#6B8299] text-sm mb-1">Tracking</Text>
                <Text className="text-[#DCEBFF] mb-3">
                  {order.shipping.trackingNumber}
                </Text>
              </>
            ) : null}
            {order.shipping.estimatedDelivery ? (
              <>
                <Text className="text-[#6B8299] text-sm mb-1">
                  Estimated delivery
                </Text>
                <Text className="text-[#DCEBFF] mb-3">
                  {new Date(
                    order.shipping.estimatedDelivery
                  ).toLocaleDateString()}
                </Text>
              </>
            ) : null}
            {order.shipping.selfDeliveryNote ? (
              <>
                <Text className="text-[#6B8299] text-sm mb-1">Note</Text>
                <Text className="text-[#DCEBFF]">
                  {order.shipping.selfDeliveryNote}
                </Text>
              </>
            ) : null}
          </View>
        )}

        {isShipped && (
          <TouchableOpacity
            onPress={handleDeliver}
            disabled={submitting}
            className="bg-[#8FE3B0] rounded-2xl py-4 items-center mb-5"
          >
            {submitting ? (
              <ActivityIndicator color="#060D18" />
            ) : (
              <Text className="text-[#060D18] font-extrabold text-[15px]">
                Mark as Delivered
              </Text>
            )}
          </TouchableOpacity>
        )}

        <View className="bg-[#0B1625] border border-[#1A2D42] rounded-[24px] p-5">
          <View className="flex-row justify-between mb-2">
            <Text className="text-[#6B8299]">Subtotal</Text>
            <Text className="text-white">
              ${Number(order.subtotal).toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-[#6B8299]">Delivery</Text>
            <Text className="text-white">
              ${Number(order.shippingCost || 0).toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between mt-2">
            <Text className="text-[#6B8299]">Total</Text>
            <Text className="text-white font-bold text-xl">
              ${Number(order.totalAmount).toFixed(2)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}