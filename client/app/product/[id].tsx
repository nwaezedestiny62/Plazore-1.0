import { useCart } from '@/context/CartContext'
import { useMarketplace } from '@/context/MarketplaceContext'
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
const GALLERY_H = Math.min(width * 1.18, 480)

export default function ProductDetails() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>()
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()

  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [wishlistCount, setWishlistCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [busy, setBusy] = useState(false)

  const { toggleWishlist, isInWishlist } = useWishlist()
  const { addToCart, itemCount } = useCart()
  const { formatProduct } = useMarketplace()

  const scrollX = useRef(new Animated.Value(0)).current
  const fadeIn = useRef(new Animated.Value(0)).current
  const heartScale = useRef(new Animated.Value(1)).current
  const lastTap = useRef(0)

  const [floatingHearts, setFloatingHearts] = useState<
    { id: number; x: number; anim: Animated.Value }[]
  >([])

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
          const data = res.data.data
          setProduct(data)
          setWishlistCount(data.wishlistCount ?? 0)
          setLiked(isInWishlist(data._id))
          Animated.timing(fadeIn, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }).start()
        } else {
          setProduct(null)
        }
      } catch {
        setProduct(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    if (product) {
      setLiked(isInWishlist(product._id))
    }
  }, [product, isInWishlist])

  const pulseHeart = () => {
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.3,
        duration: 110,
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const performAddOrToggle = async (forceAddOnly = false) => {
    if (!product || busy) return
    if (forceAddOnly && liked) return

    setBusy(true)
    pulseHeart()

    const wasLiked = liked
    setLiked(!wasLiked)
    setWishlistCount((prev) =>
      wasLiked ? Math.max(0, prev - 1) : prev + 1
    )

    try {
      await toggleWishlist(product)
    } catch {
      setLiked(wasLiked)
      setWishlistCount((prev) =>
        wasLiked ? prev + 1 : Math.max(0, prev - 1)
      )
    } finally {
      setTimeout(() => setBusy(false), 400)
    }
  }

  const handleImagePress = (evt: any) => {
    const now = Date.now()
    if (now - lastTap.current < 280) {
      performAddOrToggle(true)

      const { locationX } = evt.nativeEvent
      const hearts = Array.from({ length: 7 }).map((_, i) => ({
        id: Date.now() + i,
        x: locationX + (Math.random() - 0.5) * 70,
        anim: new Animated.Value(0),
      }))

      setFloatingHearts((prev) => [...prev, ...hearts])

      hearts.forEach((h, i) => {
        Animated.timing(h.anim, {
          toValue: 1,
          duration: 900 + i * 60,
          useNativeDriver: true,
        }).start(() => {
          setFloatingHearts((prev) => prev.filter((x) => x.id !== h.id))
        })
      })
    }
    lastTap.current = now
  }

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-[#070B12]">
        <ActivityIndicator size="large" color="#7EC8FF" />
      </View>
    )
  }

  if (!product) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-[#070B12] px-6">
        <Text className="text-white text-lg mb-3">Product not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-[#7A93A8]">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const images: string[] = product.images?.length > 0 ? product.images : []
  const ship = product.shipping || {}
  const methodLabel = ship.method === 'self' ? 'Self Delivery' : 'Courier Delivery'
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

  const productRegion = product.region

  return (
    <View className="flex-1 bg-[#070B12]">
      <StatusBar barStyle="light-content" />

      <Animated.View style={{ flex: 1, opacity: fadeIn }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 150 }}
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
                  <TouchableOpacity
                    key={index}
                    activeOpacity={1}
                    onPress={handleImagePress}
                    style={{ width, height: GALLERY_H }}
                  >
                    <Image
                      source={{ uri: img }}
                      style={{ width, height: GALLERY_H }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </Animated.ScrollView>
            ) : (
              <View className="flex-1 bg-[#0F1620] items-center justify-center">
                <Ionicons name="image-outline" size={48} color="#2A3A4C" />
              </View>
            )}

            <LinearGradient
              colors={['transparent', 'rgba(7,11,18,0.6)', '#070B12']}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 140,
              }}
            />

            {floatingHearts.map((h) => {
              const translateY = h.anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -230],
              })
              const opacity = h.anim.interpolate({
                inputRange: [0, 0.15, 0.8, 1],
                outputRange: [0, 1, 1, 0],
              })
              const scale = h.anim.interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: [0.4, 1.3, 0.7],
              })

              return (
                <Animated.View
                  key={h.id}
                  style={{
                    position: 'absolute',
                    left: h.x,
                    bottom: 170,
                    transform: [{ translateY }, { scale }],
                    opacity,
                  }}
                >
                  <Ionicons name="heart" size={36} color="#FF6B8A" />
                </Animated.View>
              )
            })}

            {images.length > 1 && (
              <View className="absolute bottom-7 left-0 right-0 flex-row justify-center">
                {images.map((_, index) => {
                  const inputRange = [
                    (index - 1) * width,
                    index * width,
                    (index + 1) * width,
                  ]
                  const dotWidth = scrollX.interpolate({
                    inputRange,
                    outputRange: [6, 22, 6],
                    extrapolate: 'clamp',
                  })
                  const opacity = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.3, 1, 0.3],
                    extrapolate: 'clamp',
                  })
                  return (
                    <Animated.View
                      key={index}
                      style={{
                        width: dotWidth,
                        opacity,
                        height: 5,
                        borderRadius: 5,
                        backgroundColor: '#A8D8FF',
                        marginHorizontal: 3,
                      }}
                    />
                  )
                })}
              </View>
            )}
          </View>

          {/* Body */}
          <View className="px-5 -mt-1">
            <View className="mb-6">
              <Text className="text-[#5B7A94] text-[11px] font-semibold tracking-[3px] uppercase mb-2">
                Showroom
              </Text>
              <Text className="text-white font-extrabold text-[26px] leading-8 mb-4">
                {product.name}
              </Text>
              <Text className="text-[#E8F4FF] font-extrabold text-[34px]">
                {formatProduct(Number(product.price), productRegion)}
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-2 mb-7">
              {!!categoryLabel && (
                <View className="bg-[#0F1A26] border border-[#1C2E42] px-4 py-2 rounded-full">
                  <Text className="text-[#9ECFFF] text-[12px] font-medium">
                    {categoryLabel}
                  </Text>
                </View>
              )}
              {!!product.subCategory && (
                <View className="bg-[#0F1A26] border border-[#1C2E42] px-4 py-2 rounded-full">
                  <Text className="text-[#7A93A8] text-[12px]">
                    {product.subCategory}
                  </Text>
                </View>
              )}
              {!!product.brand && (
                <View className="bg-[#0F1A26] border border-[#1C2E42] px-4 py-2 rounded-full">
                  <Text className="text-[#7A93A8] text-[12px]">
                    {product.brand}
                  </Text>
                </View>
              )}
            </View>

            <View className="mb-8">
              <Text className="text-[#5B7A94] text-[11px] font-semibold tracking-[2.5px] uppercase mb-3">
                About this piece
              </Text>
              <Text className="text-[#B8CDDF] text-[15.5px] leading-7">
                {product.description}
              </Text>
            </View>

            {/* Delivery */}
            <View className="bg-[#0C1520] border border-[#172636] rounded-[26px] p-5 mb-5">
              <View className="flex-row items-center mb-4">
                <View className="w-11 h-11 rounded-2xl bg-[#132232] items-center justify-center mr-3.5">
                  <Ionicons
                    name={ship.method === 'self' ? 'walk-outline' : 'car-outline'}
                    size={20}
                    color="#7EC8FF"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[#5B7A94] text-[11px] font-semibold uppercase tracking-wide">
                    Delivery
                  </Text>
                  <Text className="text-white font-semibold text-[16px] mt-0.5">
                    {methodLabel}
                  </Text>
                </View>
              </View>

              {ship.method === 'courier' && !!ship.courierCompany && (
                <Text className="text-[#7A93A8] text-[13px] mb-3 ml-[58px]">
                  {ship.courierCompany}
                </Text>
              )}

              <View className="flex-row justify-between items-center pt-3.5 border-t border-[#172636]">
                <Text className="text-[#7A93A8] text-[14px]">Delivery Fee</Text>
                <Text className="text-[#D4ECFF] font-bold text-[17px]">
                  {formatProduct(deliveryFee, productRegion)}
                </Text>
              </View>
            </View>

            {/* Seller */}
            <TouchableOpacity
              activeOpacity={0.88}
              disabled={!sellerId}
              onPress={() => {
                if (sellerId) router.push(`/store/${sellerId}` as any)
              }}
              className="bg-[#0C1520] border border-[#172636] rounded-[26px] p-4 mb-8 flex-row items-center"
            >
              {seller.storeLogo ? (
                <Image
                  source={{ uri: seller.storeLogo }}
                  className="w-14 h-14 rounded-2xl bg-[#132232]"
                />
              ) : (
                <View className="w-14 h-14 rounded-2xl bg-[#132232] items-center justify-center">
                  <Ionicons name="storefront-outline" size={24} color="#4A657A" />
                </View>
              )}
              <View className="ml-3.5 flex-1">
                <Text className="text-[#5B7A94] text-[10px] font-semibold tracking-wide uppercase">
                  Visit store
                </Text>
                <Text className="text-white font-bold text-[16px] mt-0.5">
                  {seller.storeName || seller.name || 'Store'}
                </Text>
                <Text className="text-[#7A93A8] text-[12.5px] mt-1" numberOfLines={1}>
                  {seller.storeDescription || 'Open this seller’s showroom'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#3D5568" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom bar */}
        <View className="absolute bottom-0 left-0 right-0 px-4 pt-3.5 pb-9 border-t border-[#121C28] bg-[#070B12]/96 flex-row gap-3 items-center">
          <TouchableOpacity
            onPress={() => addToCart(product, '')}
            className="flex-1 border border-[#2A4560] py-[17px] rounded-2xl items-center bg-[#0C1520]"
            activeOpacity={0.85}
          >
            <Text className="text-[#C8E4FF] font-bold text-[14.5px]">Add to Bag</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              addToCart(product, '')
              router.push('/(tabs)/checkout' as any)
            }}
            activeOpacity={0.9}
            className="flex-1 overflow-hidden rounded-2xl"
          >
            <LinearGradient
              colors={['#B8DFFF', '#7EC8FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="py-[17px] items-center"
            >
              <Text className="text-[#071018] font-extrabold text-[14.5px]">Buy Now</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/cart')}
            className="w-[52px] h-[52px] rounded-2xl bg-[#0C1520] border border-[#172636] items-center justify-center relative"
          >
            <Ionicons name="bag-handle-outline" size={23} color="#C8E4FF" />
            {itemCount > 0 && (
              <View className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#7EC8FF] rounded-full items-center justify-center">
                <Text className="text-[#071018] text-[10px] font-bold">{itemCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Header */}
        <SafeAreaView
          edges={['top']}
          className="absolute top-0 left-0 right-0 z-10"
          pointerEvents="box-none"
        >
          <View className="px-4 pt-1.5 flex-row justify-between items-start">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-12 h-12 rounded-2xl bg-black/40 items-center justify-center border border-white/10"
            >
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>

            <View className="items-center">
              <TouchableOpacity
                onPress={() => performAddOrToggle(false)}
                activeOpacity={0.85}
                disabled={busy}
              >
                <Animated.View
                  style={{ transform: [{ scale: heartScale }] }}
                  className={`w-12 h-12 rounded-2xl items-center justify-center border ${
                    liked
                      ? 'bg-[#FF6B8A]/15 border-[#FF6B8A]/40'
                      : 'bg-black/40 border-white/10'
                  }`}
                >
                  <Ionicons
                    name={liked ? 'heart' : 'heart-outline'}
                    size={23}
                    color={liked ? '#FF6B8A' : '#fff'}
                  />
                </Animated.View>
              </TouchableOpacity>

              {wishlistCount > 0 && (
                <View className="mt-2 items-center">
                  <Text className="text-white text-[13px] font-bold tracking-wide">
                    {wishlistCount.toLocaleString()}
                  </Text>
                  <Text className="text-[#7A93A8] text-[10px] font-medium tracking-wider mt-0.5">
                    WISHLISTED
                  </Text>
                </View>
              )}
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  )
}