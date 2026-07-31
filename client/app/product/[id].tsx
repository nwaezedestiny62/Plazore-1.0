import { COLORS } from '@/constants'
import { useCart } from '@/context/CartContext'
import { useWishlist } from '@/context/WishlistContext'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import api from '@/constants/api'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const { width } = Dimensions.get('window')
const GALLERY_H = Math.min(width * 1.15, 460)

export default function ProductDetails() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>()
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()

  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const { toggleWishlist, isInWishlist } = useWishlist()
  const { addToCart, itemCount } = useCart()
  const scrollX = useRef(new Animated.Value(0)).current
  const fadeIn = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const res = await api.get(`/products/${id}`)
        if (res.data.success) {
          setProduct(res.data.data)
          Animated.timing(fadeIn, {
            toValue: 1,
            duration: 380,
            useNativeDriver: true,
          }).start()
        } else {
          setProduct(null)
        }
      } catch (error) {
        console.log('Product fetch error:', error)
        setProduct(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-[#0A0E14]">
        <ActivityIndicator size="large" color="#9EC5FF" />
      </View>
    )
  }

  if (!product) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-[#0A0E14] px-6">
        <Text className="text-white text-lg mb-3">Product not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-[#8EA4B8]">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const isLiked = isInWishlist(product._id)
  const images: string[] = product.images?.length > 0 ? product.images : []
  const ship = product.shipping || {}
  const methodLabel =
    ship.method === 'self' ? 'Self Delivery' : 'Courier Delivery'
  const deliveryFee = Number(ship.deliveryFee) || 0
  const seller = product.seller || {}
  const sellerId =
    typeof seller === 'object' && seller?._id
      ? String(seller._id)
      : typeof seller === 'string'
        ? seller
        : null

  const categoryLabel =
    typeof product.category === 'string'
      ? product.category
      : product.category?.name

  const handleAddToCart = () => addToCart(product, '')
  const handleBuyNow = () => {
    addToCart(product, '')
    router.push('/(tabs)/checkout' as any)
  }

  return (
    <View className="flex-1 bg-[#0A0E14]">
      <StatusBar barStyle="light-content" />

      <Animated.View style={{ flex: 1, opacity: fadeIn }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Gallery */}
          <View className="relative" style={{ height: GALLERY_H }}>
            {images.length > 0 ? (
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
                {images.map((img, index) => (
                  <Image
                    key={index}
                    source={{ uri: img }}
                    style={{ width, height: GALLERY_H }}
                    resizeMode="cover"
                  />
                ))}
              </Animated.ScrollView>
            ) : (
              <View className="flex-1 bg-[#121820] items-center justify-center">
                <Ionicons name="image-outline" size={44} color="#3D5268" />
              </View>
            )}

            <LinearGradient
              colors={['transparent', 'rgba(10,14,20,0.85)', '#0A0E14']}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 120,
              }}
            />

            {images.length > 1 && (
              <View className="absolute bottom-6 left-0 right-0 flex-row justify-center">
                {images.map((_, index) => {
                  const inputRange = [
                    (index - 1) * width,
                    index * width,
                    (index + 1) * width,
                  ]
                  const dotWidth = scrollX.interpolate({
                    inputRange,
                    outputRange: [6, 20, 6],
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
                        height: 6,
                        borderRadius: 6,
                        backgroundColor: '#DCEBFF',
                        marginHorizontal: 3,
                      }}
                    />
                  )
                })}
              </View>
            )}
          </View>

          {/* Body */}
          <View className="px-5 -mt-2">
            {/* Title + price glass card */}
            <View className="bg-[#121A24] border border-[#1E2A38] rounded-[28px] p-5 mb-4">
              <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[2px] uppercase mb-2">
                Showroom piece
              </Text>
              <Text className="text-white font-extrabold text-[24px] leading-8">
                {product.name}
              </Text>
              <View className="flex-row items-end mt-4">
                <Text className="text-[#DCEBFF] font-extrabold text-[32px]">
                  ${Number(product.price).toFixed(2)}
                </Text>
                <Text className="text-[#5A7088] text-[13px] mb-1.5 ml-2">
                  product price
                </Text>
              </View>
            </View>

            {/* Meta chips */}
            <View className="flex-row flex-wrap gap-2 mb-5">
              {!!categoryLabel && (
                <View className="bg-[#152030] border border-[#243447] px-3.5 py-1.5 rounded-full">
                  <Text className="text-[#B8D4FF] text-[12px] font-medium">
                    {categoryLabel}
                  </Text>
                </View>
              )}
              {!!product.subCategory && (
                <View className="bg-[#152030] border border-[#243447] px-3.5 py-1.5 rounded-full">
                  <Text className="text-[#8EA4B8] text-[12px]">
                    {product.subCategory}
                  </Text>
                </View>
              )}
              {!!product.brand && (
                <View className="bg-[#152030] border border-[#243447] px-3.5 py-1.5 rounded-full">
                  <Text className="text-[#8EA4B8] text-[12px]">
                    {product.brand}
                  </Text>
                </View>
              )}
            </View>

            {/* Description */}
            <View className="mb-5">
              <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[2px] uppercase mb-2">
                About
              </Text>
              <Text className="text-[#C5D4E3] text-[15px] leading-7">
                {product.description}
              </Text>
            </View>

            {/* Delivery */}
            <View className="bg-[#121A24] border border-[#1E2A38] rounded-[24px] p-5 mb-5">
              <View className="flex-row items-center mb-3">
                <View className="w-9 h-9 rounded-xl bg-[#1A2838] items-center justify-center mr-3">
                  <Ionicons
                    name={
                      ship.method === 'self' ? 'walk-outline' : 'car-outline'
                    }
                    size={18}
                    color="#9EC5FF"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[#5A7088] text-[11px] font-semibold uppercase tracking-wide">
                    Delivery
                  </Text>
                  <Text className="text-white font-semibold text-[15px] mt-0.5">
                    {methodLabel}
                  </Text>
                </View>
              </View>

              {ship.method === 'courier' && !!ship.courierCompany && (
                <Text className="text-[#8EA4B8] text-[13px] mb-2 ml-12">
                  {ship.courierCompany}
                </Text>
              )}

              <View className="flex-row justify-between items-center mt-1 pt-3 border-t border-[#1E2A38]">
                <Text className="text-[#8EA4B8] text-[14px]">Delivery Fee</Text>
                <Text className="text-[#DCEBFF] font-bold text-[16px]">
                  ${deliveryFee.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Seller → public store */}
            <TouchableOpacity
              activeOpacity={0.88}
              disabled={!sellerId}
              onPress={() => {
                if (sellerId) router.push(`/store/${sellerId}` as any)
              }}
              className="bg-[#121A24] border border-[#1E2A38] rounded-[24px] p-4 mb-6 flex-row items-center"
            >
              {seller.storeLogo ? (
                <Image
                  source={{ uri: seller.storeLogo }}
                  className="w-14 h-14 rounded-2xl bg-[#1A2838]"
                />
              ) : (
                <View className="w-14 h-14 rounded-2xl bg-[#1A2838] items-center justify-center">
                  <Ionicons name="storefront-outline" size={22} color="#6B8299" />
                </View>
              )}
              <View className="ml-3 flex-1">
                <Text className="text-[#5A7088] text-[10px] font-semibold tracking-wide uppercase">
                  Visit store
                </Text>
                <Text className="text-white font-bold text-[15px] mt-0.5">
                  {seller.storeName || seller.name || 'Store'}
                </Text>
                {seller.storeDescription ? (
                  <Text
                    className="text-[#8EA4B8] text-[12px] mt-1"
                    numberOfLines={2}
                  >
                    {seller.storeDescription}
                  </Text>
                ) : (
                  <Text className="text-[#8EA4B8] text-[12px] mt-1">
                    Open this seller’s showroom
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#4A657A" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Sticky actions */}
        <View className="absolute bottom-0 left-0 right-0 px-4 pt-3 pb-8 border-t border-[#1A2430] bg-[#0A0E14]/98 flex-row gap-2.5 items-center">
          <TouchableOpacity
            onPress={handleAddToCart}
            className="flex-1 border border-[#3D5A80] py-4 rounded-2xl items-center bg-[#121A24]"
            activeOpacity={0.85}
          >
            <Text className="text-[#DCEBFF] font-bold text-[14px]">
              Add to Bag
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleBuyNow}
            activeOpacity={0.9}
            className="flex-1 overflow-hidden rounded-2xl"
          >
            <LinearGradient
              colors={['#C5DCFF', '#9EC5FF']}
              className="py-4 items-center"
            >
              <Text className="text-[#0A0E14] font-extrabold text-[14px]">
                Buy Now
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/cart')}
            className="w-12 h-12 rounded-2xl bg-[#121A24] border border-[#1E2A38] items-center justify-center relative"
          >
            <Ionicons name="bag-handle-outline" size={22} color="#DCEBFF" />
            {itemCount > 0 && (
              <View className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[#9EC5FF] rounded-full items-center justify-center">
                <Text className="text-[#0A0E14] text-[9px] font-bold">
                  {itemCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Floating header */}
        <SafeAreaView
          edges={['top']}
          className="absolute top-0 left-0 right-0 z-10"
          pointerEvents="box-none"
        >
          <View className="px-4 pt-1 flex-row justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-11 h-11 rounded-2xl bg-black/45 items-center justify-center border border-white/10"
            >
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleWishlist(product)}
              className="w-11 h-11 rounded-2xl bg-black/45 items-center justify-center border border-white/10"
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={22}
                color={isLiked ? '#FF6B8A' : '#fff'}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  )
}