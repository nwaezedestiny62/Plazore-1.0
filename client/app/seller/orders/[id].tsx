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

type ShippingMethod = 'courier' | 'self' | null

export default function SellerOrderDetails() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { getToken } = useAuth()
  const router = useRouter()

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Shipping form
  const [method, setMethod] = useState<ShippingMethod>(null)
  const [deliveryCompany, setDeliveryCompany] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [estimatedDelivery, setEstimatedDelivery] = useState('')
  const [selfNote, setSelfNote] = useState('')

  const loadOrder = async () => {
    try {
      setLoading(true)
      const token = await getToken()
      const res = await api.get(`/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        setOrder(res.data.data)
      }
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

  const handleShip = async () => {
    if (!method) {
      Alert.alert('Required', 'Please choose a shipping method')
      return
    }

    if (method === 'courier') {
      // company & tracking are optional, but estimated date is nice to have
    }

    if (method === 'self' && !estimatedDelivery.trim()) {
      Alert.alert('Required', 'Please enter an estimated delivery date for Self Delivery')
      return
    }

    try {
      setSubmitting(true)
      const token = await getToken()

const body: any = {
  shippingMethod: method,               // "courier" or "self"
  estimatedDelivery: estimatedDelivery || undefined,
}

if (method === 'courier') {
  body.deliveryCompany = deliveryCompany.trim()
  body.trackingNumber = trackingNumber.trim()
} else {
  body.selfDeliveryNote = selfNote.trim().slice(0, 120)
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
      <View className="flex-1 justify-center items-center bg-[#07111F]">
        <ActivityIndicator size="large" color="#DCEBFF" />
      </View>
    )
  }

  if (!order) {
    return (
      <View className="flex-1 justify-center items-center bg-[#07111F]">
        <Text className="text-[#7F93A8]">Order not found</Text>
      </View>
    )
  }

  const isPreparing = order.orderStatus === 'Preparing'
  const isShipped = order.orderStatus === 'Shipped'
  const isDelivered = order.orderStatus === 'Delivered'

  return (
    <View className="flex-1 bg-[#07111F]">
      {/* Header */}
      <View className="px-5 pt-4 pb-3 flex-row items-center border-b border-[#1E334A]">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
        </TouchableOpacity>
        <View>
          <Text className="text-white text-xl font-bold">{order.orderNumber}</Text>
          <Text className="text-[#8EA4B8] text-xs mt-0.5">
            {new Date(order.createdAt).toLocaleString()}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status */}
        <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mb-6">
          <Text className="text-[#8EA4B8] text-sm mb-1">Current Status</Text>
          <Text className="text-white text-2xl font-extrabold">
            {order.orderStatus}
          </Text>
        </View>

        {/* Buyer Details */}
        <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mb-6">
          <Text className="text-white font-bold text-lg mb-4">Buyer Details</Text>

          <View className="mb-3">
            <Text className="text-[#8EA4B8] text-xs mb-1">Name</Text>
            <Text className="text-[#DCEBFF] text-[15px]">
              {order.buyer?.name || 'Buyer'}
            </Text>
          </View>

          <View className="mb-3">
            <Text className="text-[#8EA4B8] text-xs mb-1">Email</Text>
            <Text className="text-[#DCEBFF] text-[15px]">
              {order.buyer?.email || '—'}
            </Text>
          </View>

          <View className="h-[1px] bg-[#1E334A] my-3" />

          <Text className="text-[#8EA4B8] text-xs mb-2">Shipping Address</Text>
          <Text className="text-[#DCEBFF] text-[15px] leading-6">
            {order.shippingAddress?.street}
            {'\n'}
            {order.shippingAddress?.city}, {order.shippingAddress?.state}{' '}
            {order.shippingAddress?.zipCode}
            {'\n'}
            {order.shippingAddress?.country}
          </Text>
        </View>

        {/* Products */}
        <Text className="text-white font-bold text-lg mb-3">Products</Text>

        {order.items?.map((item: any, index: number) => (
          <View
            key={index}
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

              <View className="ml-3 flex-1 justify-center">
                <Text className="text-white font-semibold" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text className="text-[#8EA4B8] text-sm mt-1">
                  Qty: {item.quantity}  •  ${Number(item.price).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Buyer Note */}
            <View className="mt-4 bg-[#13263B] rounded-2xl px-4 py-3">
              <Text className="text-[#8EA4B8] text-[11px] mb-1">Buyer Note</Text>
              <Text className="text-[#DCEBFF] text-[14px] leading-5">
                {item.note && item.note.trim()
                  ? item.note
                  : 'No buyer note.'}
              </Text>
            </View>
          </View>
        ))}

        {/* ========== SHIP SECTION (only when Preparing) ========== */}
        {isPreparing && (
          <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mt-2 mb-6">
            <Text className="text-white font-bold text-lg mb-1">
              Ship this Order
            </Text>
            <Text className="text-[#8EA4B8] text-sm mb-5">
              Choose how you will deliver this order
            </Text>

            {/* Method selection */}
            <View className="flex-row gap-3 mb-5">
              <TouchableOpacity
                onPress={() => setMethod('courier')}
                className={`flex-1 py-3.5 rounded-2xl border items-center ${
                  method === 'courier'
                    ? 'bg-[#DCEBFF] border-[#DCEBFF]'
                    : 'bg-[#13263B] border-[#21374D]'
                }`}
              >
                <Text
                  className={`font-semibold ${
                    method === 'courier' ? 'text-[#07111F]' : 'text-[#AFC3D6]'
                  }`}
                >
                  Courier
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMethod('self')}
                className={`flex-1 py-3.5 rounded-2xl border items-center ${
                  method === 'self'
                    ? 'bg-[#DCEBFF] border-[#DCEBFF]'
                    : 'bg-[#13263B] border-[#21374D]'
                }`}
              >
                <Text
                  className={`font-semibold ${
                    method === 'self' ? 'text-[#07111F]' : 'text-[#AFC3D6]'
                  }`}
                >
                  Self Delivery
                </Text>
              </TouchableOpacity>
            </View>

            {/* Courier fields */}
            {method === 'courier' && (
              <View>
                <Text className="text-[#AFC3D6] text-sm mb-2">
                  Delivery Company (optional)
                </Text>
                <TextInput
                  value={deliveryCompany}
                  onChangeText={setDeliveryCompany}
                  placeholder="e.g. DHL, GIG, FedEx"
                  placeholderTextColor="#5A7088"
                  className="bg-[#13263B] border border-[#21374D] rounded-2xl px-4 py-3.5 text-white mb-4"
                />

                <Text className="text-[#AFC3D6] text-sm mb-2">
                  Tracking Number (optional)
                </Text>
                <TextInput
                  value={trackingNumber}
                  onChangeText={setTrackingNumber}
                  placeholder="Tracking number"
                  placeholderTextColor="#5A7088"
                  className="bg-[#13263B] border border-[#21374D] rounded-2xl px-4 py-3.5 text-white mb-4"
                />

                <Text className="text-[#AFC3D6] text-sm mb-2">
                  Estimated Delivery Date
                </Text>
                <TextInput
                  value={estimatedDelivery}
                  onChangeText={setEstimatedDelivery}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#5A7088"
                  className="bg-[#13263B] border border-[#21374D] rounded-2xl px-4 py-3.5 text-white mb-2"
                />
              </View>
            )}

            {/* Self Delivery fields */}
            {method === 'self' && (
              <View>
                <Text className="text-[#AFC3D6] text-sm mb-2">
                  Estimated Delivery Date *
                </Text>
                <TextInput
                  value={estimatedDelivery}
                  onChangeText={setEstimatedDelivery}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#5A7088"
                  className="bg-[#13263B] border border-[#21374D] rounded-2xl px-4 py-3.5 text-white mb-4"
                />

                <Text className="text-[#AFC3D6] text-sm mb-2">
                  Note to Buyer (optional)
                </Text>
                <TextInput
                  value={selfNote}
                  onChangeText={(t) => setSelfNote(t.slice(0, 120))}
                  placeholder="e.g. I will call you 30 minutes before arrival"
                  placeholderTextColor="#5A7088"
                  multiline
                  className="bg-[#13263B] border border-[#21374D] rounded-2xl px-4 py-3.5 text-white mb-2 min-h-[80]"
                  style={{ textAlignVertical: 'top' }}
                />
                <Text className="text-[#6B8299] text-xs text-right mb-2">
                  {selfNote.length}/120
                </Text>
              </View>
            )}

            {/* Ship button */}
            {method && (
              <TouchableOpacity
                onPress={handleShip}
                disabled={submitting}
                activeOpacity={0.9}
                className="bg-[#DCEBFF] rounded-2xl py-4 items-center mt-4"
              >
                {submitting ? (
                  <ActivityIndicator color="#07111F" />
                ) : (
                  <Text className="text-[#07111F] font-extrabold text-[16px]">
                    Mark as Shipped
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Already shipped info */}
        {(isShipped || isDelivered) && order.shipping && (
          <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mb-6">
            <Text className="text-white font-bold text-lg mb-3">Shipping Info</Text>

            <Text className="text-[#8EA4B8] text-sm mb-1">Method</Text>
            <Text className="text-[#DCEBFF] mb-3 capitalize">
              {order.shipping.shippingMethod || 'Courier'}
            </Text>

            {order.shipping.deliveryCompany ? (
              <>
                <Text className="text-[#8EA4B8] text-sm mb-1">Courier</Text>
                <Text className="text-[#DCEBFF] mb-3">
                  {order.shipping.deliveryCompany}
                </Text>
              </>
            ) : null}

            {order.shipping.trackingNumber ? (
              <>
                <Text className="text-[#8EA4B8] text-sm mb-1">Tracking</Text>
                <Text className="text-[#DCEBFF] mb-3">
                  {order.shipping.trackingNumber}
                </Text>
              </>
            ) : null}

            {order.shipping.estimatedDelivery ? (
              <>
                <Text className="text-[#8EA4B8] text-sm mb-1">
                  Estimated Delivery
                </Text>
                <Text className="text-[#DCEBFF] mb-3">
                  {new Date(order.shipping.estimatedDelivery).toLocaleDateString()}
                </Text>
              </>
            ) : null}

            {order.shipping.selfDeliveryNote ? (
              <>
                <Text className="text-[#8EA4B8] text-sm mb-1">Your Note</Text>
                <Text className="text-[#DCEBFF]">
                  {order.shipping.selfDeliveryNote}
                </Text>
              </>
            ) : null}
          </View>
        )}

        {/* Mark as Delivered */}
        {isShipped && (
          <TouchableOpacity
            onPress={handleDeliver}
            disabled={submitting}
            activeOpacity={0.9}
            className="bg-[#8FE3B0] rounded-2xl py-4 items-center mb-6"
          >
            {submitting ? (
              <ActivityIndicator color="#07111F" />
            ) : (
              <Text className="text-[#07111F] font-extrabold text-[16px]">
                Mark as Delivered
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Order total */}
        <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5">
          <View className="flex-row justify-between">
            <Text className="text-[#8EA4B8]">Total</Text>
            <Text className="text-white font-bold text-xl">
              ${Number(order.totalAmount).toFixed(2)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}