import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import api from '@/constants/api'
import { COLORS } from '@/constants'

const { width, height } = Dimensions.get('window')
const H_PAD = 18
const GAP = 16
const CARD_W = (width - H_PAD * 2 - GAP) / 2
const ENTRANCE_H = Math.min(height * 0.34, 280)
const FEATURED_H = width * 0.68
const FEATURED_INTERVAL_MS = 7000

type StorePublic = {
  id: string
  storeName: string
  storeDescription: string
  businessGoal: string
  storeLogo: string
  storeBanner: string
  isVerified?: boolean
}

export default function PublicStorefront() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>()
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()

  const [store, setStore] = useState<StorePublic | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState(false)
  const [featuredIndex, setFeaturedIndex] = useState(0)

  const door = useRef(new Animated.Value(0)).current
  const cool = useRef(new Animated.Value(0)).current
  const content = useRef(new Animated.Value(0)).current
  const featuredRef = useRef<ScrollView>(null)
  const featuredIndexRef = useRef(0)
  const userTouching = useRef(false)

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const res = await api.get(`/seller/store/${id}`)
        if (res.data.success) {
          setStore(res.data.data.store)
          setProducts(res.data.data.products || [])
        } else {
          setStore(null)
        }
      } catch (e) {
        console.log('Storefront load error:', e)
        setStore(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    if (loading || !store) return
    Animated.sequence([
      Animated.timing(door, {
        toValue: 1,
        duration: 480,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(cool, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(content, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
      ]),
    ]).start()
  }, [loading, store])

  // Auto-carousel: every 7s, next product, loop last → first
  useEffect(() => {
    if (products.length <= 1) return

    const timer = setInterval(() => {
      if (userTouching.current) return
      const next = (featuredIndexRef.current + 1) % products.length
      featuredIndexRef.current = next
      setFeaturedIndex(next)
      featuredRef.current?.scrollTo({
        x: next * (width - H_PAD * 2),
        animated: true,
      })
    }, FEATURED_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [products.length])

  const onFeaturedScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x
      const slideW = width - H_PAD * 2
      const idx = Math.round(x / slideW)
      const safe = Math.max(0, Math.min(idx, products.length - 1))
      featuredIndexRef.current = safe
      setFeaturedIndex(safe)
    },
    [products.length]
  )

  if (loading) {
    return (
      <View className="flex-1 bg-[#E8F0F8] items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text className="text-[#6B8299] mt-4 text-[13px]">
          Opening the doors…
        </Text>
      </View>
    )
  }

  if (!store) {
    return (
      <SafeAreaView className="flex-1 bg-[#F4F7FA] items-center justify-center px-8">
        <Ionicons name="storefront-outline" size={44} color="#A1A1AA" />
        <Text className="text-primary font-bold text-lg mt-4 text-center">
          Store not found
        </Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-5">
          <Text className="text-secondary">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const slideW = width - H_PAD * 2

  return (
    <View className="flex-1 bg-[#F0F4F8]">
      <StatusBar barStyle="light-content" />

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: height * 0.3,
          opacity: cool.interpolate({
            inputRange: [0, 1],
            outputRange: [0.45, 0.1],
          }),
          zIndex: 1,
        }}
      >
        <LinearGradient
          colors={['#B8D4F0', 'rgba(232,240,248,0)']}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces
        contentContainerStyle={{ paddingBottom: 56 }}
      >
        {/* ========== ENTRANCE — less zoom ========== */}
        <Animated.View style={{ opacity: door }}>
          <View
            style={{ height: ENTRANCE_H }}
            className="relative bg-[#0C1218] overflow-hidden"
          >
            {store.storeBanner ? (
              <Image
                source={{ uri: store.storeBanner }}
                style={{
                  width: width,
                  height: ENTRANCE_H,
                }}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={['#1A2740', '#0C1218', '#152030']}
                style={{ width, height: ENTRANCE_H }}
              />
            )}

            <LinearGradient
              colors={[
                'rgba(255,255,255,0.22)',
                'rgba(255,255,255,0.04)',
                'transparent',
              ]}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 70,
              }}
            />

            <LinearGradient
              colors={['transparent', 'rgba(240,244,248,0.65)', '#F0F4F8']}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 90,
              }}
            />

            <SafeAreaView
              edges={['top']}
              className="absolute top-0 left-0 right-0"
            >
              <View className="px-4 pt-1 flex-row justify-between items-center">
                <TouchableOpacity
                  onPress={() => router.back()}
                  className="w-11 h-11 rounded-full items-center justify-center overflow-hidden"
                >
                  <BlurView
                    intensity={40}
                    tint="dark"
                    style={{ position: 'absolute', inset: 0 }}
                  />
                  <View className="w-11 h-11 rounded-full bg-black/30 items-center justify-center">
                    <Ionicons name="arrow-back" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
                <View className="px-3 py-1.5 rounded-full bg-black/30 border border-white/15">
                  <Text className="text-white/90 text-[11px] font-semibold tracking-wide">
                    Plazore Mall
                  </Text>
                </View>
              </View>
            </SafeAreaView>

            <View className="absolute bottom-10 left-0 right-0 items-center">
              <Text className="text-white/70 text-[11px] font-semibold tracking-[3px] uppercase">
                You are entering
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ========== STORE IDENTITY ========== */}
        <Animated.View
          style={{
            opacity: content,
            transform: [
              {
                translateY: content.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
              },
            ],
          }}
          className="px-5 -mt-7"
        >
          <View
            className="bg-white rounded-[28px] border border-white p-5"
            style={{
              shadowColor: '#1A3A5C',
              shadowOpacity: 0.08,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 10 },
              elevation: 6,
            }}
          >
            <View className="flex-row items-center">
              <View className="w-[76px] h-[76px] rounded-[22px] bg-[#F0F4F8] overflow-hidden items-center justify-center border border-gray-100">
                {store.storeLogo ? (
                  <Image
                    source={{ uri: store.storeLogo }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="storefront" size={32} color="#9CA3AF" />
                )}
              </View>
              <View className="flex-1 ml-4">
                <View className="flex-row items-center flex-wrap">
                  <Text className="text-[#0F172A] font-extrabold text-[22px] leading-7 mr-2">
                    {store.storeName}
                  </Text>
                  {store.isVerified ? (
                    <View className="flex-row items-center bg-[#EEF4FF] px-2 py-0.5 rounded-full">
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color={COLORS.primary}
                      />
                      <Text className="text-primary text-[10px] font-bold ml-1">
                        Verified
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-[#64748B] text-[12px] mt-1">
                  Open · Walk the aisles
                </Text>
              </View>
            </View>

            {!!store.storeDescription && (
              <Text className="text-[#475569] text-[15px] leading-6 mt-4">
                {store.storeDescription}
              </Text>
            )}

            {!!store.businessGoal && (
              <View className="mt-4 bg-[#F8FAFC] rounded-2xl px-4 py-3 border border-[#EEF2F7]">
                <Text className="text-[#94A3B8] text-[10px] font-bold tracking-[1.5px] uppercase mb-1">
                  Our goal
                </Text>
                <Text className="text-[#1E293B] text-[14px] leading-5">
                  {store.businessGoal}
                </Text>
              </View>
            )}

            <View className="flex-row mt-5 gap-3">
              <TouchableOpacity
                onPress={() => setFollowing((f) => !f)}
                activeOpacity={0.88}
                className={`flex-1 py-3.5 rounded-2xl items-center ${
                  following ? 'bg-primary' : 'bg-[#0F172A]'
                }`}
              >
                <Text className="text-white font-bold text-[14px]">
                  {following ? 'Following' : 'Follow store'}
                </Text>
              </TouchableOpacity>
              <View className="px-4 py-3.5 rounded-2xl bg-[#F1F5F9] items-center justify-center">
                <Text className="text-[#64748B] font-semibold text-[13px]">
                  {products.length} on floor
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ========== FEATURED CAROUSEL (7s loop) ========== */}
        {products.length > 0 && (
          <Animated.View style={{ opacity: content }} className="mt-8">
            <View className="px-5 mb-4">
              <Text className="text-[#94A3B8] text-[11px] font-bold tracking-[2px] uppercase mb-1">
                Front display
              </Text>
              <Text className="text-[#0F172A] font-bold text-[20px]">
                Featured on the floor
              </Text>
            </View>

            <ScrollView
              ref={featuredRef}
              horizontal
              pagingEnabled
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              snapToInterval={slideW}
              snapToAlignment="start"
              disableIntervalMomentum
              contentContainerStyle={{ paddingHorizontal: H_PAD }}
              onScrollBeginDrag={() => {
                userTouching.current = true
              }}
              onScrollEndDrag={() => {
                userTouching.current = false
              }}
              onMomentumScrollEnd={onFeaturedScrollEnd}
            >
              {products.map((p) => (
                <TouchableOpacity
                  key={p._id}
                  activeOpacity={0.92}
                  onPress={() => router.push(`/product/${p._id}` as any)}
                  style={{
                    width: slideW,
                    marginRight: 0,
                  }}
                >
                  <View
                    className="bg-white rounded-[28px] overflow-hidden border border-gray-100 mx-0"
                    style={{
                      shadowColor: '#0F172A',
                      shadowOpacity: 0.06,
                      shadowRadius: 20,
                      shadowOffset: { width: 0, height: 8 },
                    }}
                  >
                    <View style={{ height: FEATURED_H }} className="bg-[#E8EEF4]">
                      {p.images?.[0] ? (
                        <Image
                          source={{ uri: p.images[0] }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="flex-1 items-center justify-center">
                          <Ionicons
                            name="image-outline"
                            size={40}
                            color="#CBD5E1"
                          />
                        </View>
                      )}
                      <LinearGradient
                        colors={['transparent', 'rgba(15,23,42,0.78)']}
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: 110,
                        }}
                      />
                      <View className="absolute bottom-4 left-4 right-4">
                        <Text
                          className="text-white font-bold text-[18px]"
                          numberOfLines={2}
                        >
                          {p.name}
                        </Text>
                        <Text className="text-white/90 font-extrabold text-[20px] mt-1">
                          ${Number(p.price).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {products.length > 1 && (
              <View className="flex-row justify-center items-center mt-3.5 gap-1.5">
                {products.map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: i === featuredIndex ? 18 : 6,
                      height: 6,
                      borderRadius: 6,
                      backgroundColor:
                        i === featuredIndex ? COLORS.primary : '#CBD5E1',
                    }}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* ========== AISLES ========== */}
        <Animated.View style={{ opacity: content }} className="px-5 mt-10">
          <Text className="text-[#94A3B8] text-[11px] font-bold tracking-[2px] uppercase">
            Aisles
          </Text>
          <Text className="text-[#0F172A] font-bold text-[20px] mt-1">
            Walk the collection
          </Text>

          <View className="flex-row items-center my-4">
            <View className="flex-1 h-[1px] bg-[#D8E0EA]" />
            <Text className="text-[#94A3B8] text-[10px] mx-3 tracking-widest uppercase">
              Open floor
            </Text>
            <View className="flex-1 h-[1px] bg-[#D8E0EA]" />
          </View>

          {products.length === 0 ? (
            <View className="py-20 items-center">
              <Ionicons name="cube-outline" size={40} color="#CBD5E1" />
              <Text className="text-[#64748B] mt-3 text-center px-6 leading-5">
                This store is still setting up the shelves. Check back soon.
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {products.map((p) => (
                <TouchableOpacity
                  key={p._id}
                  activeOpacity={0.9}
                  onPress={() => router.push(`/product/${p._id}` as any)}
                  style={{ width: CARD_W, marginBottom: 20 }}
                >
                  <View
                    className="bg-white rounded-[22px] overflow-hidden border border-[#E8EEF4]"
                    style={{
                      shadowColor: '#0F172A',
                      shadowOpacity: 0.04,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 4 },
                    }}
                  >
                    <View
                      className="bg-[#E8EEF4]"
                      style={{ height: CARD_W * 1.2 }}
                    >
                      {p.images?.[0] ? (
                        <Image
                          source={{ uri: p.images[0] }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="flex-1 items-center justify-center">
                          <Ionicons
                            name="image-outline"
                            size={26}
                            color="#CBD5E1"
                          />
                        </View>
                      )}
                    </View>
                    <View className="px-3 pt-3 pb-3.5">
                      <Text
                        className="text-[#0F172A] font-semibold text-[13px] leading-5"
                        numberOfLines={2}
                      >
                        {p.name}
                      </Text>
                      <Text className="text-[#0F172A] font-extrabold text-[15px] mt-1.5">
                        ${Number(p.price).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>

        <View className="items-center mt-10 mb-2">
          <View className="w-12 h-1 rounded-full bg-[#D8E0EA] mb-3" />
          <Text className="text-[#94A3B8] text-[11px] tracking-[1px]">
            Plazore · Premium Digital Mall
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}