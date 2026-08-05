import HeroBanner from '@/components/HeroBanner'
import PlazoreTitleBar from '@/components/PlazoreTitleBar'
import PlazoreNavigationHub from '@/components/PlazoreNavigationHub'
import { AdaptiveShowroom } from '@/components/showroom'
import { Product } from '@/constants/types'
import api from '@/constants/api'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
} from 'react-native'

export default function Home() {
  const [hubOpen, setHubOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [scrollProgress, setScrollProgress] = useState(0)

  const showroomY = useRef(0)
  const scrollRef = useRef<ScrollView>(null)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const res = await api.get('/products?limit=24')
      if (res.data.success) setProducts(res.data.data)
    } catch (error) {
      console.log('Home products error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y
    const p = Math.min(1, Math.max(0, y / 400))
    setScrollProgress(p)
  }

  const scrollToShowroom = () => {
    scrollRef.current?.scrollTo({
      y: Math.max(showroomY.current - 8, 0),
      animated: true,
    })
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
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
        onScroll={onScroll}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <HeroBanner
          topChrome={0}
          onScrollToShowroom={scrollToShowroom}
        />

        <View
          onLayout={(e) => {
            showroomY.current = e.nativeEvent.layout.y
          }}
        >
          {loading ? (
              <View style={{ minHeight: 400, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A' }}>
              <ActivityIndicator color="#94A3B8" />
            </View>
          ) : (
            <AdaptiveShowroom
              products={products}
              loading={loading}
            />
          )}
        </View>
      </ScrollView>

      <PlazoreNavigationHub
        visible={hubOpen}
        onClose={() => setHubOpen(false)}
      />
    </View>
  )
}