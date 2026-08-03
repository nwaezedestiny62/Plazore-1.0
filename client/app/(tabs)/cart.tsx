import Header from '@/components/Header'
import { COLORS } from '@/constants'
import {
  convertPrice,
  DEFAULT_REGION,
  formatMoney,
  formatProductPrice,
} from '@/constants/regions'
import { useCart } from '@/context/CartContext'
import { useMarketplace } from '@/context/MarketplaceContext'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Animated,
  Image,
  LayoutAnimation,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
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

export default function Cart() {
  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    updateItemNote,
  } = useCart()
  const {
    format,
    formatProduct,
    region: buyerRegion,
    refreshRegion,
  } = useMarketplace()
  const router = useRouter()

  // Always re-sync region when opening bag
  useFocusEffect(
    useCallback(() => {
      refreshRegion()
    }, [refreshRegion])
  )

  const displayRegion = buyerRegion || DEFAULT_REGION

  // Bulletproof formatters (never rely on stale closures alone)
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

  const bagAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(bagAnim, {
      toValue: 1,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start()
  }, [])

  const onQty = (id: string, qty: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    if (qty < 1) {
      removeFromCart(id)
      return
    }
    updateQuantity(id, qty)
  }

  const onRemove = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    removeFromCart(id)
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F4F5F7]" edges={['top']}>
      <Header title="Shopping Bag" showBack />

      {cartItems.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-24 h-24 rounded-full bg-white border border-gray-200 items-center justify-center mb-5">
            <Ionicons name="bag-handle-outline" size={40} color="#9CA3AF" />
          </View>
          <Text className="text-primary font-bold text-xl text-center">
            Your bag is empty
          </Text>
          <Text className="text-secondary text-center mt-2 leading-5">
            Items you pick from Plazore will show up here — like a real shopping
            bag.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/')}
            className="mt-7 bg-primary px-8 py-3.5 rounded-xl"
            activeOpacity={0.9}
          >
            <Text className="text-white font-bold">Continue shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={{
                opacity: bagAnim,
                transform: [
                  {
                    translateY: bagAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              }}
            >
              <View className="flex-row items-center justify-between mb-3 px-1">
                <View className="flex-row items-center">
                  <Ionicons name="bag-handle" size={20} color={COLORS.primary} />
                  <Text className="text-primary font-bold text-base ml-2">
                    Your Bag
                  </Text>
                </View>
                <Text className="text-secondary text-sm">
                  {itemCount} item{itemCount !== 1 ? 's' : ''}
                </Text>
              </View>

              {cartItems.map((item) => {
                const productRegion = resolveProductRegion(item.product)
                const unit = Number(item.price ?? item.product?.price) || 0
                const qty = Number(item.quantity) || 1
                const lineTotal = unit * qty
                const lineFee =
                  Number(item.product?.shipping?.deliveryFee) || 0
                const note = item.note || ''

                return (
                  <View
                    key={item.id}
                    className="bg-white rounded-2xl border border-gray-200 mb-3 overflow-hidden"
                  >
                    <View className="p-3.5 flex-row">
                      {item.product?.images?.[0] ? (
                        <Image
                          source={{ uri: item.product.images[0] }}
                          className="w-[72px] h-[72px] rounded-xl bg-gray-100"
                        />
                      ) : (
                        <View className="w-[72px] h-[72px] rounded-xl bg-gray-100 items-center justify-center">
                          <Ionicons name="image-outline" size={22} color="#CCC" />
                        </View>
                      )}

                      <View className="flex-1 ml-3">
                        <Text
                          className="text-primary font-semibold text-[14px] leading-5"
                          numberOfLines={2}
                        >
                          {item.product?.name || 'Product'}
                        </Text>
                        <Text className="text-primary font-bold text-[15px] mt-1">
                          {fmtProduct(unit, productRegion)}
                        </Text>
                        {lineFee > 0 && (
                          <Text className="text-secondary text-[11px] mt-0.5">
                            Delivery Fee {fmtProduct(lineFee, productRegion)}
                          </Text>
                        )}

                        <View className="flex-row items-center mt-2.5">
                          <View className="flex-row items-center bg-gray-50 rounded-full border border-gray-200">
                            <TouchableOpacity
                              onPress={() => onQty(item.id, item.quantity - 1)}
                              className="w-8 h-8 items-center justify-center"
                            >
                              <Ionicons name="remove" size={16} color="#111" />
                            </TouchableOpacity>
                            <Text className="w-8 text-center font-semibold text-[13px]">
                              {item.quantity}
                            </Text>
                            <TouchableOpacity
                              onPress={() => onQty(item.id, item.quantity + 1)}
                              className="w-8 h-8 items-center justify-center"
                            >
                              <Ionicons name="add" size={16} color="#111" />
                            </TouchableOpacity>
                          </View>

                          <Text className="text-primary font-bold text-[14px] ml-auto mr-3">
                            {fmtProduct(lineTotal, productRegion)}
                          </Text>

                          <TouchableOpacity
                            onPress={() => onRemove(item.id)}
                            className="w-9 h-9 items-center justify-center"
                          >
                            <Ionicons
                              name="trash-outline"
                              size={18}
                              color="#EF4444"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    <View className="px-3.5 pb-3.5 pt-1 border-t border-gray-50">
                      <TextInput
                        value={note}
                        onChangeText={(t) => updateItemNote(item.id, t)}
                        placeholder="Note for seller (optional)…"
                        placeholderTextColor="#9CA3AF"
                        multiline
                        maxLength={120}
                        className="bg-[#F9FAFB] rounded-xl px-3 py-2.5 text-primary text-[13px] min-h-[52]"
                        style={{ textAlignVertical: 'top' }}
                      />
                      <Text className="text-[10px] text-gray-400 text-right mt-1">
                        {note.length}/120
                      </Text>
                    </View>
                  </View>
                )
              })}

              <View className="bg-white rounded-2xl border border-gray-200 mt-1 overflow-hidden">
                <View className="px-4 py-3 border-b border-dashed border-gray-200">
                  <Text className="text-primary font-bold text-[14px]">
                    Bag summary
                  </Text>
                </View>
                <View className="px-4 py-3.5">
                  <View className="flex-row justify-between mb-2.5">
                    <Text className="text-secondary text-[14px]">
                      Product Price
                    </Text>
                    <Text className="text-primary font-semibold text-[14px]">
                      {fmt(productPrice)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between mb-2.5">
                    <Text className="text-secondary text-[14px]">
                      Delivery Fee
                    </Text>
                    <Text className="text-primary font-semibold text-[14px]">
                      {fmt(deliveryFee)}
                    </Text>
                  </View>
                  <View className="border-t border-dashed border-gray-200 my-2" />
                  <View className="flex-row justify-between items-center">
                    <Text className="text-primary font-bold text-[15px]">
                      Total Amount
                    </Text>
                    <Text className="text-primary font-extrabold text-lg">
                      {fmt(totalAmount)}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          </ScrollView>

          <View
            className="bg-white border-t border-gray-200 px-4 pt-3 pb-4"
            style={{ marginBottom: Platform.OS === 'ios' ? 0 : 4 }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-secondary text-[12px]">Amount due</Text>
                <Text className="text-primary font-extrabold text-xl">
                  {fmt(totalAmount)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/checkout' as any)}
                className="bg-primary px-8 py-3.5 rounded-xl flex-row items-center"
                activeOpacity={0.9}
              >
                <Text className="text-white font-bold text-[15px] mr-2">
                  Checkout
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text className="text-secondary text-[11px] text-center">
              Prices shown in your marketplace currency
            </Text>
          </View>
        </>
      )}
    </SafeAreaView>
  )
}