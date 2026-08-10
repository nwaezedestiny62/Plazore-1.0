import HeroBanner from '@/components/HeroBanner'
import PlazoreFloatingNav from '@/components/PlazoreFloatingNav'
import PlazoreNavigationHub from '@/components/PlazoreNavigationHub'
import PlazoreTitleBar from '@/components/PlazoreTitleBar'
import { AdaptiveShowroom } from '@/components/showroom'
import { ShowroomFlyCartProvider } from '@/components/showroom/ShowroomFlyCart'
import api from '@/constants/api'
import { Product } from '@/constants/types'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native'

export default function Home() {
  const [hubOpen, setHubOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [scrollProgress, setScrollProgress] = useState(0)

  const { height: windowH } = useWindowDimensions()
  const heroH = Math.max(windowH, 1)

  // 100% Native animated value for buttery smooth performance
  const scrollY = useRef(new Animated.Value(0)).current
  const progress = useRef(new Animated.Value(0)).current

  const showroomY = useRef(0)
  const scrollRef = useRef<ScrollView>(null)
  const lastP = useRef(0)

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/products?limit=24')
      if (res.data?.success) {
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
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Fully native scroll listener with zero friction
  const onMainScroll = useRef(
    Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const y = Math.max(0, e.nativeEvent.contentOffset.y)
          const distance = Math.max(heroH * 0.4, 1) // 40% threshold for elegant transition
          const p = Math.min(1, Math.max(0, y / distance))

          progress.setValue(p)

          if (Math.abs(p - lastP.current) >= 0.01) {
            lastP.current = p
            setScrollProgress(p)
          }
        },
      }
    )
  ).current

  const scrollToShowroom = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: Math.max(showroomY.current - 8, 0),
      animated: true,
    })
  }, [])

  return (
    <ShowroomFlyCartProvider visibleProgress={scrollProgress}>
      <View style={{ flex: 1, backgroundColor: '#0E0E0E' }}>
        <PlazoreTitleBar
          scrollProgress={scrollProgress}
          progressAnim={progress}
          hasUnreadNotifications={false}
          onMenuPress={() => setHubOpen(true)}
          onMusicPress={() => {}}
          onNotificationsPress={() => {}}
        />

        <Animated.ScrollView
          ref={scrollRef as any}
          showsVerticalScrollIndicator={false}
          bounces
          scrollEventThrottle={16}
          decelerationRate="fast"
          onScroll={onMainScroll}
          style={{ flex: 1 }}
        >
          <HeroBanner topChrome={0} onScrollToShowroom={scrollToShowroom} />

          <View
            onLayout={(e) => {
              showroomY.current = e.nativeEvent.layout.y
            }}
            style={{ width: '100%' }}
          >
            <AdaptiveShowroom products={products} loading={loading} />
          </View>
        </Animated.ScrollView>

        <PlazoreFloatingNav
          visibleProgress={scrollProgress}
          progressAnim={progress}
          onMenuPress={() => setHubOpen(true)}
        />

        <PlazoreNavigationHub
          visible={hubOpen}
          onClose={() => setHubOpen(false)}
        />
      </View>
    </ShowroomFlyCartProvider>
  )
}
