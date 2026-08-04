import HeroBanner from '@/components/HeroBanner'
import PlazoreTitleBar from '@/components/PlazoreTitleBar'
import { Product } from '@/constants/types'
import api from '@/constants/api'
import PlazoreNavigationHub from '@/components/PlazoreNavigationHub'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
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
      const res = await api.get('/products?limit=8')
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
    // 0 → 1 as user leaves the hero
    const p = Math.min(1, Math.max(0, y / (heroH * 0.9)))
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
        scrollProgress={scrollProgress}   // ← plain number 0–1
        hasUnreadNotifications={false}
        onMenuPress={() => {}}
        onMusicPress={() => {}}
        onNotificationsPress={() => {}}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        bounces
        scrollEventThrottle={16}
        onScroll={onScroll}
      >
        <HeroBanner
          topChrome={0}
          onScrollToShowroom={scrollToShowroom}
        />

        <View
          onLayout={(e) => {
            showroomY.current = e.nativeEvent.layout.y
          }}
          style={{
            minHeight: 320,
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 20,
            paddingTop: 40,
            paddingBottom: 64,
          }}
        >
          <Text
            style={{
              color: '#94A3B8',
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Showroom
          </Text>
          <Text
            style={{
              color: '#0F172A',
              fontSize: 20,
              fontWeight: '600',
              marginBottom: 8,
            }}
          >
            Adaptive Showroom
          </Text>
          <Text
            style={{
              color: '#64748B',
              fontSize: 14,
              lineHeight: 20,
              marginBottom: 24,
            }}
          >
            Curated discovery will live here next.
          </Text>
          {loading ? (
            <ActivityIndicator color="#94A3B8" />
          ) : (
            <Text style={{ color: '#94A3B8', fontSize: 13 }}>
              {products.length} products ready for the showroom.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  )
}