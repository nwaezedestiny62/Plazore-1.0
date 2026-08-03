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
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

const CANCEL_OPTIONS = [
  { code: 'out_of_stock', label: 'Product is out of stock' },
  { code: 'unable_to_deliver', label: 'Unable to deliver to the destination' },
  { code: 'shipping_limitations', label: 'Shipping limitations' },
  { code: 'incorrect_inventory', label: 'Incorrect inventory' },
  { code: 'temporary_closure', label: 'Temporary business closure' },
  { code: 'other', label: 'Other' },
] as const

function resolveOrderRegion(order: any, item?: any): string {
  if (item?.product?.region) return String(item.product.region)
  if (item?.region) return String(item.region)
  if (order?.region) return String(order.region)
  if (order?.seller?.marketplaceRegion) {
    return String(order.seller.marketplaceRegion)
  }
  return DEFAULT_REGION
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

  const displayRegion = viewerRegion || DEFAULT_REGION

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
      Alert.alert('Error', 'Could not load order')
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

  const handleConfirmCancel = async () => {
    if (!cancelCode) {
      Alert.alert('Required', 'Please select a cancellation reason')
      return
    }
    if (cancelCode === 'other' && !cancelNote.trim()) {
      Alert.alert('Required', 'Please add a short explanation')
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
        Alert.alert(
          'Order cancelled',
          'The buyer has been notified with your reason.'
        )
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Could not cancel order'
      )
    } finally {
      setCancelling(false)
    }
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
  const isCancelled = order.orderStatus === 'Cancelled'

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
          <Text
            className={`text-2xl font-extrabold ${
              isCancelled ? 'text-[#FF8A9A]' : 'text-white'
            }`}
          >
            {isCancelled && order.cancellation?.cancelledBy === 'seller'
              ? 'Cancelled by Seller'
              : order.orderStatus}
          </Text>
        </View>

        {isCancelled && order.cancellation && (
          <View className="bg-[#1A1214] border border-[#3D2228] rounded-[24px] p-5 mb-5">
            <Text className="text-[#FF8A9A] font-bold text-lg mb-1">
              Cancellation
            </Text>
            {order.cancellation.cancelledAt ? (
              <Text className="text-[#6B8299] text-xs mb-3">
                {new Date(order.cancellation.cancelledAt).toLocaleString()}
              </Text>
            ) : null}
            <Text className="text-[#6B8299] text-xs mb-1">Reason</Text>
            <Text className="text-[#DCEBFF] text-[15px] leading-6">
              {order.cancellation.reasonLabel ||
                order.cancellation.note ||
                '—'}
            </Text>
          </View>
        )}

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
        {order.items?.map((item: any, index: number) => {
          const itemRegion = resolveOrderRegion(order, item)
          const unit = Number(item.price) || 0
          return (
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
                    Qty: {item.quantity} · {fmt(unit, itemRegion)}
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
          )
        })}

        {/* Equal actions: Ship | Cancel */}
        {isPreparing && (
          <View className="flex-row gap-3 mb-5">
            <View className="flex-1 bg-[#DCEBFF]/15 border border-[#DCEBFF]/40 rounded-2xl py-3.5 items-center">
              <Ionicons name="airplane-outline" size={20} color="#DCEBFF" />
              <Text className="text-[#DCEBFF] font-bold text-[13px] mt-1">
                Ship Order
              </Text>
              <Text className="text-[#6B8299] text-[10px] mt-0.5">
                Fill form below
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowCancel(true)}
              activeOpacity={0.85}
              className="flex-1 bg-[#2A1518] border border-[#5C2A32] rounded-2xl py-3.5 items-center justify-center"
            >
              <Ionicons name="close-circle-outline" size={20} color="#FF8A9A" />
              <Text className="text-[#FF8A9A] font-bold text-[13px] mt-1">
                Cancel Order
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isPreparing && (
          <View className="bg-[#0B1625] border border-[#1A2D42] rounded-[24px] p-5 mt-1 mb-5">
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
            {!!order.shipping.deliveryCompany && (
              <>
                <Text className="text-[#6B8299] text-sm mb-1">Courier</Text>
                <Text className="text-[#DCEBFF] mb-3">
                  {order.shipping.deliveryCompany}
                </Text>
              </>
            )}
            {!!order.shipping.trackingNumber && (
              <>
                <Text className="text-[#6B8299] text-sm mb-1">Tracking</Text>
                <Text className="text-[#DCEBFF] mb-3">
                  {order.shipping.trackingNumber}
                </Text>
              </>
            )}
            {!!order.shipping.estimatedDelivery && (
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
            )}
            {!!order.shipping.selfDeliveryNote && (
              <>
                <Text className="text-[#6B8299] text-sm mb-1">Note</Text>
                <Text className="text-[#DCEBFF]">
                  {order.shipping.selfDeliveryNote}
                </Text>
              </>
            )}
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
              {fmt(Number(order.subtotal) || 0, orderMoneyRegion)}
            </Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-[#6B8299]">Delivery</Text>
            <Text className="text-white">
              {fmt(Number(order.shippingCost) || 0, orderMoneyRegion)}
            </Text>
          </View>
          <View className="flex-row justify-between mt-2">
            <Text className="text-[#6B8299]">Total</Text>
            <Text className="text-white font-bold text-xl">
              {fmt(Number(order.totalAmount) || 0, orderMoneyRegion)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Cancel confirmation modal */}
      <Modal
        visible={showCancel}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCancel(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#0B1625] rounded-t-[28px] border-t border-[#1A2D42] px-5 pt-5 pb-10 max-h-[90%]">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-white font-bold text-xl">Cancel Order</Text>
              <TouchableOpacity onPress={() => setShowCancel(false)}>
                <Ionicons name="close" size={24} color="#7F93A8" />
              </TouchableOpacity>
            </View>
            <Text className="text-[#7F93A8] text-[13px] mb-5 leading-5">
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
                    className={`flex-row items-center px-4 py-3.5 rounded-2xl mb-2 border ${
                      selected
                        ? 'bg-[#1A2435] border-[#4A7AB5]'
                        : 'bg-[#0A121C] border-[#1A2D42]'
                    }`}
                  >
                    <View
                      className={`w-5 h-5 rounded-full border-2 items-center justify-center mr-3 ${
                        selected ? 'border-[#9EC5FF]' : 'border-[#3D5268]'
                      }`}
                    >
                      {selected ? (
                        <View className="w-2.5 h-2.5 rounded-full bg-[#9EC5FF]" />
                      ) : null}
                    </View>
                    <Text
                      className={`text-[14px] flex-1 ${
                        selected ? 'text-white font-semibold' : 'text-[#AFC3D6]'
                      }`}
                    >
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
                  className="bg-[#0A121C] border border-[#1A2D42] rounded-2xl px-4 py-3.5 text-white mt-2 mb-2 min-h-[88]"
                  style={{ textAlignVertical: 'top' }}
                />
              )}

              <TouchableOpacity
                onPress={handleConfirmCancel}
                disabled={cancelling}
                className="bg-[#FF8A9A] rounded-2xl py-4 items-center mt-4 mb-4"
              >
                {cancelling ? (
                  <ActivityIndicator color="#1A0A0C" />
                ) : (
                  <Text className="text-[#1A0A0C] font-extrabold text-[15px]">
                    Confirm Cancellation
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}