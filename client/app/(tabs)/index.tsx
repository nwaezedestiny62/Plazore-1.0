import HeroBanner from '@/components/HeroBanner'
import PlazoreFloatingNav from '@/components/PlazoreFloatingNav'
import PlazoreNavigationHub from '@/components/PlazoreNavigationHub'
import PlazoreTitleBar from '@/components/PlazoreTitleBar'
import { AdaptiveShowroom } from '@/components/showroom'
import api from '@/constants/api'
import { Product } from '@/constants/types'
import React, { useEffect, useRef, useState } from 'react'
import {
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

  const showroomY = useRef(0)
  const scrollRef = useRef<ScrollView>(null)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const res = await api.get('/products?limit=24')
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
    // 0 at top → 1 after ~35% of hero height
    const p = Math.min(1, Math.max(0, y / (heroH * 0.35)))
    setScrollProgress(p)
  }

  const scrollToShowroom = () => {
    scrollRef.current?.scrollTo({
      y: Math.max(showroomY.current - 8, 0),
      animated: true,
    })
  }

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
        {/* HERO */}
        <HeroBanner topChrome={0} onScrollToShowroom={scrollToShowroom} />

        {/* SHOWROOM */}
        <View
          onLayout={(e) => {
            showroomY.current = e.nativeEvent.layout.y
          }}
          style={{ width: '100%' }}
        >
          <AdaptiveShowroom products={products} loading={loading} />
        </View>
      </ScrollView>

      {/* Floating Nav — still here */}
      <PlazoreFloatingNav
        visibleProgress={scrollProgress}
        onMenuPress={() => setHubOpen(true)}
      />

      <PlazoreNavigationHub
        visible={hubOpen}
        onClose={() => setHubOpen(false)}
      />
    </View>
  )
}