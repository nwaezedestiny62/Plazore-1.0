import HeroBanner from '@/components/HeroBanner'
import PlazoreTitleBar from '@/components/PlazoreTitleBar'
import { AdaptiveShowroom } from '@/components/showroom'
import { ShowroomFlyCartProvider } from '@/components/showroom/ShowroomFlyCart'
import api from '@/constants/api'
import { Product } from '@/constants/types'
import { usePlazoreChrome } from '@/context/PlazoreChromeContext'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native'

export default function Home() {
  const { setScrollProgress, setHomeChrome, openHub } = usePlazoreChrome()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [scrollProgress, setLocalProgress] = useState(0)

  const { height: windowH } = useWindowDimensions()
  const heroH = Math.max(windowH, 1)

  const showroomY = useRef(0)
  const roomYs = useRef<Record<number, number>>({})
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    setHomeChrome(true)
    return () => {
      setHomeChrome(false)
      setScrollProgress(0)
    }
  }, [setHomeChrome, setScrollProgress])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const res = await api.get('/products?limit=24')
      if (res.data.success) setProducts(res.data.data || [])
      else setProducts([])
    } catch {
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
    const p = Math.min(1, Math.max(0, y / (heroH * 0.35)))
    setLocalProgress(p)
    setScrollProgress(p)
  }

  const scrollToShowroom = () => {
    scrollRef.current?.scrollTo({
      y: Math.max(showroomY.current - 8, 0),
      animated: true,
    })
  }

  const onRoomLayout = useCallback((roomNumber: number, y: number) => {
    roomYs.current[roomNumber] = y
  }, [])

  return (
    <ShowroomFlyCartProvider>
      <View style={{ flex: 1, backgroundColor: '#0E0E0E' }}>
        <PlazoreTitleBar
          scrollProgress={scrollProgress}
          hasUnreadNotifications={false}
          onMenuPress={openHub}
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
          <HeroBanner topChrome={0} onScrollToShowroom={scrollToShowroom} />

          <View
            onLayout={(e) => {
              showroomY.current = e.nativeEvent.layout.y
            }}
            style={{ width: '100%' }}
          >
            <AdaptiveShowroom
              products={products}
              loading={loading}
              onRoomLayout={onRoomLayout}
            />
          </View>
        </ScrollView>
      </View>
    </ShowroomFlyCartProvider>
  )
}