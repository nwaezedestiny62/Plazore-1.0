import HeroBanner from '@/components/HeroBanner'
import PlazoreTitleBar from '@/components/PlazoreTitleBar'
import { AdaptiveShowroom } from '@/components/showroom'
import ShowroomRoomNav from '@/components/showroom/ShowroomRoomNav'
import { ShowroomFlyCartProvider } from '@/components/showroom/ShowroomFlyCart'
import api from '@/constants/api'
import { Product } from '@/constants/types'
import { usePlazoreChrome } from '@/context/PlazoreChromeContext'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const TITLE_BAR_H = 56

export default function Home() {
  const { setScrollProgress, setHomeChrome, openHub } = usePlazoreChrome()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { height: windowH } = useWindowDimensions()
  const heroH = Math.max(windowH, 1)

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [scrollProgress, setLocalProgress] = useState(0)
  const [activeRoom, setActiveRoom] = useState(1)
  const [navVisible, setNavVisible] = useState(0)
  const [roomCount, setRoomCount] = useState(4)

  const showroomY = useRef(0)
  const roomYs = useRef<Record<number, number>>({})
  const scrollRef = useRef<ScrollView>(null)
  const scrollY = useRef(0)

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
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const onRoomLayout = useCallback((roomNumber: number, y: number) => {
    roomYs.current[roomNumber] = y
    const keys = Object.keys(roomYs.current).map(Number)
    if (keys.length) setRoomCount(Math.max(...keys))
  }, [])

  const resolveActiveRoom = (y: number) => {
    const base = showroomY.current
    const entries = Object.entries(roomYs.current)
      .map(([n, ry]) => ({ n: Number(n), abs: base + ry }))
      .sort((a, b) => a.abs - b.abs)

    if (!entries.length) return 1

    // Room whose start is just above the midpoint of the viewport
    const probe = y + windowH * 0.28
    let current = entries[0].n
    for (const e of entries) {
      if (e.abs <= probe) current = e.n
      else break
    }
    return current
  }

  const onMainScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y
    scrollY.current = y

    const p = Math.min(1, Math.max(0, y / (heroH * 0.35)))
    setLocalProgress(p)
    setScrollProgress(p)

    // Nav visibility: 0 while in hero, ramps up as showroom enters
    const start = showroomY.current - 80
    const end = showroomY.current + 40
    let v = 0
    if (y >= end) v = 1
    else if (y > start) v = (y - start) / (end - start)
    setNavVisible(v)

    if (v > 0.2) {
      setActiveRoom(resolveActiveRoom(y))
    }
  }

  const scrollToShowroom = () => {
    scrollRef.current?.scrollTo({
      y: Math.max(showroomY.current - 8, 0),
      animated: true,
    })
  }

  const scrollToRoom = useCallback((roomNumber: number) => {
    const rel = roomYs.current[roomNumber]
    if (rel == null) return
    // Leave space under sticky nav + title band
    const offset = insets.top + TITLE_BAR_H + 52
    const target = Math.max(showroomY.current + rel - offset, 0)
    scrollRef.current?.scrollTo({ y: target, animated: true })
    setActiveRoom(roomNumber)
  }, [insets.top])

  return (
    <ShowroomFlyCartProvider>
      <View style={{ flex: 1, backgroundColor: '#0E0E0E' }}>
        <PlazoreTitleBar
          scrollProgress={scrollProgress}
          onMenuPress={openHub}
          onNotificationsPress={() => router.push('/notifications')}
        />

        {/* Sticky room chain — only meaningful once showroom is in view */}
        <ShowroomRoomNav
          activeRoom={activeRoom}
          roomCount={roomCount}
          visible={navVisible}
          onSelectRoom={scrollToRoom}
          topOffset={TITLE_BAR_H}
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