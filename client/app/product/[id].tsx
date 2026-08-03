import { useCart } from '@/context/CartContext'
import { useMarketplace } from '@/context/MarketplaceContext'
import { useWishlist } from '@/context/WishlistContext'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/constants/api'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '@/constants'

const { width, height } = Dimensions.get('window')
const GALLERY_H = Math.min(width * 1.12, 460)

export default function ProductDetails() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>()
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()

  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [wishlistCount, setWishlistCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [busy, setBusy] = useState(false)

  const wishlistApi = useWishlist() as any
  const { isInWishlist, toggleWishlist, addToWishlist, mutateWishlist } =
    wishlistApi

  const { addToCart, itemCount } = useCart()
  const { formatProduct } = useMarketplace()

  const scrollX = useRef(new Animated.Value(0)).current
  const fadeIn = useRef(new Animated.Value(0)).current
  const lift = useRef(new Animated.Value(22)).current
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
          setWishlistCount(Number(data.wishlistCount) || 0)
          setLiked(!!isInWishlist?.(data._id))

          Animated.parallel([
            Animated.timing(fadeIn, {
              toValue: 1,
              duration: 520,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(lift, {
              toValue: 0,
              duration: 580,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]).start()
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

  // Keep heart in sync when context wishlist changes
  useEffect(() => {
    if (!product?._id) return
    setLiked(!!isInWishlist?.(product._id))
  }, [product?._id, wishlistApi.wishlist])

  const pulseHeart = () => {
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.28,
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

  /**
   * Heart button → full toggle (add OR remove)
   * Double-tap image → add only (never remove, never +2)
   */
  const runWishlist = useCallback(
    async (mode: 'toggle' | 'add') => {
      if (!product || busy) return

      setBusy(true)
      pulseHeart()

      const wasLiked = liked

      try {
        let result: { ok: boolean; inWishlist: boolean; changed: boolean }

        if (typeof mutateWishlist === 'function') {
          result = await mutateWishlist(product, mode)
        } else if (mode === 'add' && typeof addToWishlist === 'function') {
          if (wasLiked) {
            result = { ok: true, inWishlist: true, changed: false }
          } else {
            await addToWishlist(product)
            result = { ok: true, inWishlist: true, changed: true }
          }
        } else {
          // Fallback: toggle only; for add mode skip if already liked
          if (mode === 'add' && wasLiked) {
            result = { ok: true, inWishlist: true, changed: false }
          } else {
            await toggleWishlist(product)
            const nowIn = mode === 'add' ? true : !wasLiked
            result = { ok: true, inWishlist: nowIn, changed: true }
          }
        }

        setLiked(result.inWishlist)

        // Count moves only when membership actually changed
        if (result.changed) {
          setWishlistCount((c) =>
            result.inWishlist ? c + 1 : Math.max(0, c - 1)
          )
        }
      } catch {
        setLiked(wasLiked)
      } finally {
        setTimeout(() => setBusy(false), 280)
      }
    },
    [product, busy, liked, mutateWishlist, addToWishlist, toggleWishlist]
  )

  const handleHeartPress = () => {
    // Only heart can remove (toggle)
    runWishlist('toggle')
  }

  const handleImagePress = (evt: any) => {
    const now = Date.now()
    if (now - lastTap.current < 280) {
      // Double-tap → ADD only
      runWishlist('add')

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
      <View className="flex-1 justify-center items-center bg-[#EAF1F7]">
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text className="text-[#6B8299] mt-5 text-[13px] tracking-wide">
          Unwrapping this piece…
        </Text>
      </View>
    )
  }

  if (!product) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-[#F4F7FA] px-8">
        <View className="w-16 h-16 rounded-full bg-[#EEF2F7] items-center justify-center">
          <Ionicons name="cube-outline" size={28} color="#94A3B8" />
        </View>
        <Text className="text-[#0F172A] font-bold text-lg mt-5 text-center">
          Product not found
        </Text>
        <Text className="text-[#64748B] text-[13px] mt-2 text-center leading-5">
          This piece may have left the floor.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-7 px-6 py-3 rounded-full bg-[#0F172A]"
          activeOpacity={0.88}
        >
          <Text className="text-white font-semibold text-[13px]">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

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

  const productRegion = product.region

  const shipsFrom =
    product.fulfillmentLocation?.displayLabel ||
    [product.fulfillmentLocation?.city, product.fulfillmentLocation?.country]
      .filter(Boolean)
      .join(', ') ||
    [
      seller?.shippingDefaults?.address?.state,
      seller?.shippingDefaults?.address?.country,
    ]
      .filter(Boolean)
      .join(', ')

  return (
    <View className="flex-1 bg-[#EEF3F8]">
      <StatusBar barStyle="dark-content" />

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: height * 0.28,
          zIndex: 0,
        }}
      >
        <LinearGradient
          colors={['#C5DBF0', 'rgba(238,243,248,0)']}
          style={{ flex: 1 }}
        />
      </View>

      <Animated.View
        style={{
          flex: 1,
          opacity: fadeIn,
          transform: [{ translateY: lift }],
        }}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          bounces
        >
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
              <View className="flex-1 bg-[#E8EEF4] items-center justify-center">
                <Ionicons name="image-outline" size={48} color="#CBD5E1" />
              </View>
            )}

            <LinearGradient
              colors={['transparent', 'rgba(238,243,248,0.55)', '#EEF3F8']}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 90,
              }}
            />

            {floatingHearts.map((h) => {
              const translateY = h.anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -220],
              })
              const opacity = h.anim.interpolate({
                inputRange: [0, 0.15, 0.8, 1],
                outputRange: [0, 1, 1, 0],
              })
              const scale = h.anim.interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: [0.4, 1.25, 0.7],
              })

              return (
                <Animated.View
                  key={h.id}
                  style={{
                    position: 'absolute',
                    left: h.x,
                    bottom: 160,
                    transform: [{ translateY }, { scale }],
                    opacity,
                  }}
                >
                  <Ionicons name="heart" size={34} color="#FF6B8A" />
                </Animated.View>
              )
            })}

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
                    outputRange: [6, 18, 6],
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
                        height: 5,
                        borderRadius: 5,
                        backgroundColor: COLORS.primary,
                        marginHorizontal: 3,
                      }}
                    />
                  )
                })}
              </View>
            )}
          </View>

          <View className="px-5 -mt-2">
            <View
              className="bg-white rounded-[28px] border border-white/80 p-6 mb-5"
              style={{
                shadowColor: '#1A3A5C',
                shadowOpacity: 0.06,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 10 },
                elevation: 5,
              }}
            >
              <Text className="text-[#94A3B8] text-[11px] font-bold tracking-[2.2px] uppercase mb-2">
                Showroom
              </Text>
              <Text className="text-[#0F172A] font-extrabold text-[24px] leading-8 mb-3">
                {product.name}
              </Text>
              <Text className="text-[#0F172A] font-extrabold text-[30px]">
                {formatProduct(Number(product.price), productRegion)}
              </Text>

              <View className="flex-row flex-wrap gap-2 mt-5">
                {!!categoryLabel && (
                  <View className="bg-[#F1F5F9] px-3.5 py-1.5 rounded-full">
                    <Text className="text-[#334155] text-[12px] font-medium">
                      {categoryLabel}
                    </Text>
                  </View>
                )}
                {!!product.subCategory && (
                  <View className="bg-[#F1F5F9] px-3.5 py-1.5 rounded-full">
                    <Text className="text-[#64748B] text-[12px]">
                      {product.subCategory}
                    </Text>
                  </View>
                )}
                {!!product.brand && (
                  <View className="bg-[#F1F5F9] px-3.5 py-1.5 rounded-full">
                    <Text className="text-[#64748B] text-[12px]">
                      {product.brand}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {!!product.description && (
              <View className="mb-6 px-1">
                <Text className="text-[#94A3B8] text-[11px] font-bold tracking-[2px] uppercase mb-3">
                  About this piece
                </Text>
                <Text className="text-[#475569] text-[15px] leading-7">
                  {product.description}
                </Text>
              </View>
            )}

            <View
              className="bg-white rounded-[26px] border border-[#E8EEF4] p-5 mb-4"
              style={{
                shadowColor: '#0F172A',
                shadowOpacity: 0.03,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <View className="flex-row items-center mb-4">
                <View className="w-11 h-11 rounded-2xl bg-[#F1F5F9] items-center justify-center mr-3.5">
                  <Ionicons
                    name={
                      ship.method === 'self' ? 'walk-outline' : 'car-outline'
                    }
                    size={20}
                    color={COLORS.primary}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[#94A3B8] text-[10px] font-bold uppercase tracking-wide">
                    Delivery
                  </Text>
                  <Text className="text-[#0F172A] font-semibold text-[15px] mt-0.5">
                    {methodLabel}
                  </Text>
                </View>
              </View>

              {ship.method === 'courier' && !!ship.courierCompany && (
                <Text className="text-[#64748B] text-[13px] mb-3 ml-[58px]">
                  {ship.courierCompany}
                </Text>
              )}

              <View className="flex-row justify-between items-center pt-3.5 border-t border-[#EEF2F7]">
                <Text className="text-[#64748B] text-[14px]">Delivery fee</Text>
                <Text className="text-[#0F172A] font-bold text-[16px]">
                  {formatProduct(deliveryFee, productRegion)}
                </Text>
              </View>
            </View>

            {!!shipsFrom && (
              <View
                className="bg-white rounded-[26px] border border-[#E8EEF4] p-5 mb-4 flex-row items-center"
                style={{
                  shadowColor: '#0F172A',
                  shadowOpacity: 0.03,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                }}
              >
                <View className="w-11 h-11 rounded-2xl bg-[#F1F5F9] items-center justify-center mr-3.5">
                  <Ionicons
                    name="location-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[#94A3B8] text-[10px] font-bold uppercase tracking-wide">
                    Ships from
                  </Text>
                  <Text className="text-[#0F172A] font-semibold text-[15px] mt-0.5">
                    {shipsFrom}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.88}
              disabled={!sellerId}
              onPress={() => {
                if (sellerId) router.push(`/store/${sellerId}` as any)
              }}
              className="bg-white rounded-[26px] border border-[#E8EEF4] p-4 mb-8 flex-row items-center"
              style={{
                shadowColor: '#0F172A',
                shadowOpacity: 0.03,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              {seller.storeLogo ? (
                <Image
                  source={{ uri: seller.storeLogo }}
                  className="w-14 h-14 rounded-[18px] bg-[#F1F5F9]"
                />
              ) : (
                <View className="w-14 h-14 rounded-[18px] bg-[#F1F5F9] items-center justify-center">
                  <Ionicons
                    name="storefront-outline"
                    size={24}
                    color="#94A3B8"
                  />
                </View>
              )}

              <View className="ml-3.5 flex-1">
                <Text className="text-[#94A3B8] text-[10px] font-bold tracking-wide uppercase">
                  Visit store
                </Text>
                <Text className="text-[#0F172A] font-bold text-[15px] mt-0.5">
                  {seller.storeName || seller.name || 'Store'}
                </Text>
                <Text
                  className="text-[#64748B] text-[12.5px] mt-1"
                  numberOfLines={1}
                >
                  {seller.storeDescription || 'Open this seller’s showroom'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 px-4 pt-3.5 pb-9 border-t border-[#E2E8F0] bg-white/95 flex-row gap-3 items-center"
          style={{
            shadowColor: '#0F172A',
            shadowOpacity: 0.06,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: -4 },
          }}
        >
          <TouchableOpacity
            onPress={() => addToCart(product, '')}
            className="flex-1 border border-[#CBD5E1] py-[16px] rounded-2xl items-center bg-[#F8FAFC]"
            activeOpacity={0.85}
          >
            <Text className="text-[#0F172A] font-bold text-[14.5px]">
              Add to Bag
            </Text>
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
              colors={[COLORS.primary, '#5B9FE8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="py-[16px] items-center"
            >
              <Text className="text-white font-extrabold text-[14.5px]">
                Buy Now
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/cart')}
            className="w-[52px] h-[52px] rounded-2xl bg-[#F1F5F9] border border-[#E2E8F0] items-center justify-center relative"
            activeOpacity={0.85}
          >
            <Ionicons name="bag-handle-outline" size={22} color="#0F172A" />
            {itemCount > 0 && (
              <View className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-primary rounded-full items-center justify-center">
                <Text className="text-white text-[10px] font-bold">
                  {itemCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <SafeAreaView
          edges={['top']}
          className="absolute top-0 left-0 right-0 z-10"
          pointerEvents="box-none"
        >
          <View className="px-4 pt-1.5 flex-row justify-between items-start">
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.85}
              className="w-11 h-11 rounded-full overflow-hidden items-center justify-center"
            >
              <BlurView
                intensity={40}
                tint="light"
                style={{ position: 'absolute', inset: 0 }}
              />
              <View className="w-11 h-11 rounded-full bg-white/70 items-center justify-center border border-white/60">
                <Ionicons name="arrow-back" size={20} color="#0F172A" />
              </View>
            </TouchableOpacity>

            <View className="items-center">
              <TouchableOpacity
                onPress={handleHeartPress}
                activeOpacity={0.85}
                disabled={busy}
              >
                <Animated.View
                  style={{ transform: [{ scale: heartScale }] }}
                  className={`w-11 h-11 rounded-full items-center justify-center border ${
                    liked
                      ? 'bg-[#FFF1F3] border-[#FFB3C1]'
                      : 'bg-white/70 border-white/60'
                  }`}
                >
                  <Ionicons
                    name={liked ? 'heart' : 'heart-outline'}
                    size={22}
                    color={liked ? '#FF6B8A' : '#0F172A'}
                  />
                </Animated.View>
              </TouchableOpacity>

              {wishlistCount > 0 && (
                <View className="mt-2 items-center">
                  <Text className="text-[#0F172A] text-[12px] font-bold tracking-wide">
                    {wishlistCount.toLocaleString()}
                  </Text>
                  <Text className="text-[#94A3B8] text-[9px] font-semibold tracking-wider mt-0.5">
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