import { COLORS } from '@/constants'
import { Product } from '@/constants/types'
import { useCart } from '@/context/CartContext'
import { useWishlist } from '@/context/WishlistContext'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import api from '@/constants/api'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const { width } = Dimensions.get('window')

export default function ProductDetails() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { toggleWishlist, isInWishlist } = useWishlist()
  const { addToCart, itemCount } = useCart()
  const scrollX = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await api.get(`/products/${id}`)
        if (res.data.success) setProduct(res.data.data)
        else setProduct(null)
      } catch (e) {
        console.log(e)
        setProduct(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center bg-white">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    )
  }

  if (!product) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white px-6">
        <Text className="text-primary text-lg">Product not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-secondary">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const isLiked = isInWishlist(product._id)
  const ship = product.shipping || {}
  const methodLabel =
    ship.method === 'self' ? 'Self Delivery' : 'Courier Delivery'
  const deliveryFee = Number(ship.deliveryFee) || 0
  const seller = product.seller || {}

  const handleAddToCart = () => addToCart(product, '')
  const handleBuyNow = () => {
    addToCart(product, '')
    router.push('/(tabs)/checkout' as any)
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Gallery */}
        <View className="relative h-[420px] bg-gray-50">
          <Animated.ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
          >
            {(product.images?.length ? product.images : ['']).map(
              (img: string, index: number) => (
                <Image
                  key={index}
                  source={{ uri: img }}
                  style={{ width, height: 420 }}
                  resizeMode="cover"
                />
              )
            )}
          </Animated.ScrollView>

          <View className="absolute bottom-4 left-0 right-0 flex-row justify-center">
            {(product.images || []).map((_: any, index: number) => {
              const inputRange = [
                (index - 1) * width,
                index * width,
                (index + 1) * width,
              ]
              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [8, 18, 8],
                extrapolate: 'clamp',
              })
              const opacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.35, 1, 0.35],
                extrapolate: 'clamp',
              })
              return (
                <Animated.View
                  key={index}
                  style={{
                    width: dotWidth,
                    opacity,
                    height: 8,
                    borderRadius: 8,
                    backgroundColor: COLORS.primary,
                    marginHorizontal: 4,
                  }}
                />
              )
            })}
          </View>
        </View>

        <View className="px-5 pt-6">
          <Text className="text-2xl font-bold text-primary leading-8">
            {product.name}
          </Text>
          <Text className="text-3xl font-extrabold text-primary mt-3">
            ${Number(product.price).toFixed(2)}
          </Text>

          <View className="h-[1px] bg-gray-100 my-6" />

          <Text className="text-primary font-bold text-base mb-2">
            Description
          </Text>
          <Text className="text-secondary leading-7 text-[15px]">
            {product.description}
          </Text>

          <View className="flex-row flex-wrap gap-2 mt-6">
            {product.category ? (
              <View className="bg-gray-50 px-3 py-1.5 rounded-full">
                <Text className="text-primary text-[12px] font-medium">
                  {product.category}
                </Text>
              </View>
            ) : null}
            {product.subCategory ? (
              <View className="bg-gray-50 px-3 py-1.5 rounded-full">
                <Text className="text-secondary text-[12px]">
                  {product.subCategory}
                </Text>
              </View>
            ) : null}
            {product.brand ? (
              <View className="bg-gray-50 px-3 py-1.5 rounded-full">
                <Text className="text-secondary text-[12px]">
                  {product.brand}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Shipping */}
          <View className="mt-8 bg-gray-50 rounded-3xl p-5 border border-gray-100">
            <Text className="text-primary font-bold text-base mb-3">
              Shipping
            </Text>
            <View className="flex-row items-center mb-2">
              <Ionicons
                name={
                  ship.method === 'self' ? 'walk-outline' : 'car-outline'
                }
                size={18}
                color={COLORS.primary}
              />
              <Text className="text-primary font-semibold ml-2">
                {methodLabel}
              </Text>
            </View>
            {ship.method === 'courier' && ship.courierCompany ? (
              <Text className="text-secondary text-[14px] mb-1">
                {ship.courierCompany}
              </Text>
            ) : null}
            <Text className="text-secondary text-[14px] mt-1">
              Delivery fee:{' '}
              <Text className="text-primary font-semibold">
                ${deliveryFee.toFixed(2)}
              </Text>
            </Text>
          </View>

          {/* Seller card */}
          <TouchableOpacity
            activeOpacity={0.85}
            className="mt-6 flex-row items-center bg-white border border-gray-100 rounded-3xl p-4"
            // Public storefront route later:
            // onPress={() => router.push(`/store/${seller._id}`)}
          >
            {seller.storeLogo ? (
              <Image
                source={{ uri: seller.storeLogo }}
                className="w-14 h-14 rounded-2xl bg-gray-100"
              />
            ) : (
              <View className="w-14 h-14 rounded-2xl bg-gray-100 items-center justify-center">
                <Ionicons name="storefront-outline" size={22} color="#999" />
              </View>
            )}
            <View className="ml-3 flex-1">
              <Text className="text-primary font-bold text-[15px]">
                {seller.storeName || seller.name || 'Store'}
              </Text>
              {seller.storeDescription ? (
                <Text className="text-secondary text-[12px] mt-1" numberOfLines={2}>
                  {seller.storeDescription}
                </Text>
              ) : (
                <Text className="text-secondary text-[12px] mt-1">
                  View seller on Plazore
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CCC" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sticky actions */}
      <View className="absolute bottom-0 left-0 right-0 px-4 pt-3 pb-8 bg-white border-t border-gray-100 flex-row gap-3">
        <TouchableOpacity
          onPress={handleAddToCart}
          className="flex-1 border border-primary py-4 rounded-2xl items-center"
        >
          <Text className="text-primary font-bold">Add to Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleBuyNow}
          className="flex-1 bg-primary py-4 rounded-2xl items-center"
        >
          <Text className="text-white font-bold">Buy Now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/cart')}
          className="w-14 items-center justify-center relative"
        >
          <Ionicons name="cart-outline" size={24} color={COLORS.primary} />
          {itemCount > 0 && (
            <View className="absolute top-1 right-1 size-4 bg-black rounded-full items-center justify-center">
              <Text className="text-white text-[9px]">{itemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Header */}
      <View className="absolute top-12 left-4 right-4 flex-row justify-between z-10">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-white/90 rounded-xl items-center justify-center"
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => toggleWishlist(product)}
          className="w-10 h-10 bg-white/90 rounded-xl items-center justify-center"
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={22}
            color={isLiked ? COLORS.accent : COLORS.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  )
}