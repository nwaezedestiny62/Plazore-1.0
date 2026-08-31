import HeroBanner from '@/components/HeroBanner'
import PlazoreTitleBar from '@/components/PlazoreTitleBar'
import { AdaptiveShowroom } from '@/components/showroom'
import ShowroomRoomNav, {
  ROOM_NAV_H,
} from '@/components/showroom/ShowroomRoomNav'
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
const ROOM_LANDING_GAP = 24
const ROOM_NAV_PIN_CLEARANCE = 220
const ROOM_NAV_HOLD_MS = 1200

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
  const focusedRoom = useRef<number | null>(null)
  const roomNavPinned = useRef(false)
  const roomNavHoldUntil = useRef(0)
  const selectionReleaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastProgress = useRef(-1)

  // Own the chrome while Home is mounted — start fully hidden
  useEffect(() => {
    setHomeChrome(true)
    setScrollProgress(0)
    lastProgress.current = 0
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

    // ── Chrome: fully in by the time showroom is on screen ─────────────
    // start fading when user is halfway through the hero → fully on at showroom
    const showY = Math.max(showroomY.current, heroH * 0.6, 1)
    const start = showY * 0.35
    const end = showY * 0.85
    let p = 0
    if (y >= end) p = 1
    else if (y > start) p = (y - start) / (end - start)

    if (Math.abs(p - lastProgress.current) >= 0.004) {
      lastProgress.current = p
      setLocalProgress(p)
      setScrollProgress(p)
    }

    // Room-nav visibility (unchanged)
    const rStart = showroomY.current - 180
    const rEnd = showroomY.current - 72
    let v = 0
    if (y >= rEnd) v = 1
    else if (y > rStart) v = (y - rStart) / (rEnd - rStart)

    if (roomNavPinned.current && y >= showroomY.current - ROOM_NAV_PIN_CLEARANCE) {
      v = Math.max(v, 0.98)
    } else if (y < showroomY.current - ROOM_NAV_PIN_CLEARANCE) {
      roomNavPinned.current = false
    }

    const nextVisibility =
      Math.round(Math.min(1, Math.max(0, v)) * 100) / 100

    const isHoldingSelection = Date.now() < roomNavHoldUntil.current
    if (isHoldingSelection && focusedRoom.current != null) {
      setActiveRoom(focusedRoom.current)
    } else if (v > 0.2) {
      setActiveRoom(resolveActiveRoom(y))
    }

    setNavVisible(nextVisibility)
  }

  const scrollToShowroom = () => {
    scrollRef.current?.scrollTo({
      y: Math.max(showroomY.current - 8, 0),
      animated: true,
    })
  }

  const scrollToRoom = useCallback(
    (roomNumber: number) => {
      const rel = roomYs.current[roomNumber]
      if (rel == null) return

      focusedRoom.current = roomNumber
      roomNavPinned.current = true
      roomNavHoldUntil.current = Date.now() + ROOM_NAV_HOLD_MS
      setActiveRoom(roomNumber)
      setNavVisible(1)

      const landingOffset =
        insets.top + TITLE_BAR_H + ROOM_NAV_H + ROOM_LANDING_GAP
      const target = Math.max(showroomY.current + rel - landingOffset, 0)
      scrollRef.current?.scrollTo({ y: target, animated: true })
    },
    [insets.top]
  )

  const onRoomScrollSettled = useCallback(() => {
    if (selectionReleaseTimer.current) {
      clearTimeout(selectionReleaseTimer.current)
      selectionReleaseTimer.current = null
    }
    if (focusedRoom.current == null) return
    setActiveRoom(focusedRoom.current)
    roomNavHoldUntil.current = Date.now() + 220
    focusedRoom.current = null
  }, [])

  const onRoomDragEnd = useCallback(() => {
    if (focusedRoom.current == null) return
    if (selectionReleaseTimer.current) clearTimeout(selectionReleaseTimer.current)
    selectionReleaseTimer.current = setTimeout(() => {
      selectionReleaseTimer.current = null
      if (focusedRoom.current == null) return
      setActiveRoom(focusedRoom.current)
      focusedRoom.current = null
      roomNavHoldUntil.current = Date.now() + 220
    }, 820)
  }, [])

  return (
    <ShowroomFlyCartProvider>
      <View style={{ flex: 1, backgroundColor: '#0E0E0E' }}>
        <PlazoreTitleBar
          scrollProgress={scrollProgress}
          onMenuPress={openHub}
          onNotificationsPress={() => router.push('/notifications')}
          onWishlistPress={() => router.push('/favorites')}
        />

        <ShowroomRoomNav
          activeRoom={activeRoom}
          roomCount={roomCount}
          visible={navVisible}
          onSelectRoom={scrollToRoom}
          bottomOffset={94}
        />

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          bounces
          scrollEventThrottle={16}
          decelerationRate="normal"
          onScroll={onMainScroll}
          onMomentumScrollEnd={onRoomScrollSettled}
          onScrollEndDrag={onRoomDragEnd}
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