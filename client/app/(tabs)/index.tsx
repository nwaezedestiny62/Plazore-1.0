import HeroBanner from '@/components/HeroBanner'
import PlazoreNavigationHub from '@/components/PlazoreNavigationHub'
import PlazoreTitleBar from '@/components/PlazoreTitleBar'
import ProductCard from '@/components/ProductCard'
import api from '@/constants/api'
import { Product } from '@/constants/types'
import { Ionicons } from '@expo/vector-icons'
import { Link } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'

const SCREEN_WIDTH = Dimensions.get('window').width

export default function Home() {
  const [hubOpen, setHubOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [carouselProgress, setCarouselProgress] = useState(0)
  const { height: windowH } = useWindowDimensions()
  const heroH = Math.max(windowH, 1)
  const showroomY = useRef(0)
  const scrollRef = useRef<ScrollView>(null)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const res = await api.get('/products?limit=12')
      if (res.data.success) {
        setProducts(res.data.data || [])
      } else {
        setProducts([])
      }
    } catch (error) {
      console.log('Home products error:', error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const onMainScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y
    const p = Math.min(1, Math.max(0, y / (heroH * 0.9)))
    setScrollProgress(p)
  }

  const onHorizontalCarouselScroll = (
    e: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    const maxScroll = contentSize.width - layoutMeasurement.width
    if (maxScroll > 0) {
      const progress = Math.min(1, Math.max(0, contentOffset.x / maxScroll))
      setCarouselProgress(progress)
    }
  }

  const scrollToShowroom = () => {
    scrollRef.current?.scrollTo({
      y: Math.max(showroomY.current - 8, 0),
      animated: true,
    })
  }

  const cardWidth = Math.min(170, SCREEN_WIDTH * 0.44)

  return (
    <View style={{ flex: 1, backgroundColor: '#0E0E0E' }}>
      <PlazoreTitleBar
        scrollProgress={scrollProgress}
        hasUnreadNotifications={false}
        onMenuPress={() => setHubOpen(true)}
        onMusicPress={() => {}}
        onNotificationsPress={() => {}}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        bounces
        scrollEventThrottle={16}
        decelerationRate="fast"
        onScroll={onMainScroll}
        style={{ flex: 1 }}
      >
        {/* HERO BANNER */}
        <HeroBanner topChrome={0} onScrollToShowroom={scrollToShowroom} />

        {/* SHOWROOM ROOT CONTAINER */}
        <View
          onLayout={(e) => {
            showroomY.current = e.nativeEvent.layout.y
          }}
          style={{ width: '100%' }}
        >
          {/* SECTION 1: PURE WHITE BG - HORIZONTAL PRODUCT CAROUSEL */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              paddingTop: 36,
              paddingBottom: 28,
            }}
          >
            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
              <Text
                style={{
                  color: '#94A3B8',
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                New Arrivals Showcase
              </Text>
              <Text
                style={{
                  color: '#0F172A',
                  fontSize: 20,
                  fontWeight: '700',
                  letterSpacing: -0.3,
                }}
              >
                Featured Collection
              </Text>
            </View>

            {loading ? (
              <View
                style={{
                  height: 260,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <ActivityIndicator color="#0F172A" size="small" />
              </View>
            ) : products.length === 0 ? (
              <View
                style={{
                  height: 120,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                }}
              >
                <Text style={{ color: '#64748B', fontSize: 14 }}>
                  No products available
                </Text>
              </View>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  onScroll={onHorizontalCarouselScroll}
                  scrollEventThrottle={16}
                  decelerationRate="fast"
                  contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingRight: 10,
                    gap: 16,
                  }}
                >
                  {products.slice(0, 6).map((item) => (
                    <View key={item._id} style={{ width: cardWidth }}>
                      <ProductCard product={item} cardWidth={cardWidth} />
                    </View>
                  ))}
                </ScrollView>

                <View
                  style={{
                    alignItems: 'center',
                    marginTop: 12,
                    paddingHorizontal: 20,
                  }}
                >
                  <View
                    style={{
                      width: 140,
                      height: 3,
                      backgroundColor: '#E2E8F0',
                      borderRadius: 1.5,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: '35%',
                        height: '100%',
                        backgroundColor: '#64748B',
                        borderRadius: 1.5,
                        transform: [
                          {
                            translateX: carouselProgress * (140 * 0.65),
                          },
                        ],
                      }}
                    />
                  </View>
                </View>
              </>
            )}
          </View>

          {/* SECTION 2: SOFT COOL CREAM BG - LANDSCAPE SCREEN FEATURE */}
          <View
            style={{
              backgroundColor: '#F7F5F0',
              paddingVertical: 36,
              paddingHorizontal: 20,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: '100%',
                height: 240,
                backgroundColor: '#E5E0D8',
                borderRadius: 0,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <Image
                source={{
                  uri:
                    products[0]?.images?.[0] ||
                    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80',
                }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
              <View
                style={{
                  position: 'absolute',
                  top: '55%',
                  left: '46%',
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: 'rgba(15, 23, 42, 0.4)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </View>
            </View>
            <View style={{ marginTop: 24, alignItems: 'center' }}>
              <Text
                style={{
                  color: '#0F172A',
                  fontSize: 14,
                  fontWeight: '700',
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                }}
              >
                A SUMMER STAPLE
              </Text>
              <View
                style={{
                  width: 32,
                  height: 2,
                  backgroundColor: '#94A3B8',
                  marginTop: 10,
                  borderRadius: 1,
                }}
              />
            </View>
          </View>

          {/* SECTION 3: COOL SLATE BG - CURATED SHOWROOM GRID */}
          <View
            style={{
              backgroundColor: '#F0F4F8',
              paddingTop: 36,
              paddingBottom: 40,
              paddingHorizontal: 20,
            }}
          >
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  color: '#64748B',
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                Curated Catalog
              </Text>
              <Text
                style={{
                  color: '#0F172A',
                  fontSize: 20,
                  fontWeight: '700',
                  letterSpacing: -0.3,
                }}
              >
                Showroom Staples
              </Text>
            </View>

            {products.length > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                }}
              >
                {products.slice(0, 6).map((item) => (
                  <View key={item._id} style={{ width: '48%' }}>
                    <ProductCard product={item} />
                  </View>
                ))}
              </View>
            ) : (
              <View
                style={{
                  height: 100,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#64748B', fontSize: 14 }}>
                  No products available
                </Text>
              </View>
            )}

            <Link href="/shop" asChild>
              <TouchableOpacity
                activeOpacity={0.88}
                style={{
                  marginTop: 16,
                  width: '100%',
                  height: 48,
                  backgroundColor: '#0F172A',
                  borderRadius: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: '700',
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                  }}
                >
                  Explore Full Catalog
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </Link>
          </View>

          {/* SECTION 4: SOFT MINT / SAGE BG - EDITORIAL SPOTLIGHT */}
          <View
            style={{
              backgroundColor: '#ECEFF1',
              paddingVertical: 40,
              paddingHorizontal: 20,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: '#475569',
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 2.5,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Regional Marketplaces
            </Text>
            <Text
              style={{
                color: '#0F172A',
                fontSize: 22,
                fontWeight: '700',
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              Seamless Global Conversion
            </Text>
            <Text
              style={{
                color: '#64748B',
                fontSize: 13,
                textAlign: 'center',
                lineHeight: 20,
                maxWidth: 300,
                marginBottom: 24,
              }}
            >
              Automatic currency & location matching across Nigeria, UK, US, and
              Europe.
            </Text>
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                width: '100%',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  flex: 1,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                }}
              >
                <Text style={{ fontSize: 16, marginBottom: 2 }}>🇳🇬</Text>
                <Text
                  style={{ fontSize: 11, fontWeight: '700', color: '#0F172A' }}
                >
                  NGN (₦)
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  flex: 1,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                }}
              >
                <Text style={{ fontSize: 16, marginBottom: 2 }}>🇪🇺</Text>
                <Text
                  style={{ fontSize: 11, fontWeight: '700', color: '#0F172A' }}
                >
                  EUR (€)
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  flex: 1,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                }}
              >
                <Text style={{ fontSize: 16, marginBottom: 2 }}>🇺🇸</Text>
                <Text
                  style={{ fontSize: 11, fontWeight: '700', color: '#0F172A' }}
                >
                  USD ($)
                </Text>
              </View>
            </View>
          </View>

          {/* SECTION 5: OBSIDIAN DARK FOOTER */}
          <View
            style={{
              backgroundColor: '#0E0E0E',
              paddingVertical: 48,
              paddingHorizontal: 20,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: '#F8FAFC',
                fontSize: 16,
                fontWeight: '800',
                letterSpacing: 4,
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              PLAZORE SHOWROOM
            </Text>
            <Text
              style={{
                color: '#64748B',
                fontSize: 12,
                textAlign: 'center',
                lineHeight: 18,
              }}
            >
              Crafted for modern mobile mobility & ultra-fluid scrolling.
            </Text>
          </View>
        </View>
      </ScrollView>

      <PlazoreNavigationHub
        visible={hubOpen}
        onClose={() => setHubOpen(false)}
      />
    </View>
  )
}