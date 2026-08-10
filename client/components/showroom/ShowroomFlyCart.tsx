import { useCart } from '@/context/CartContext'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Product } from '@/constants/types'

/* ── Types ── */
type Origin = { x: number; y: number; width: number; height: number }

type FlyJob = {
  id: string
  image?: string
  origin: Origin
}

type FlyCartContextValue = {
  flyAdd: (product: Product, origin: Origin) => void
}

const FlyCartContext = createContext<FlyCartContextValue | null>(null)

export function useShowroomFlyCart() {
  return useContext(FlyCartContext)
}

/* ── Provider + Floating UI ── */
type ProviderProps = {
  children: React.ReactNode
  /** 0 = hidden (hero), 1 = fully in showroom */
  visibleProgress: number
}

const CART_SIZE = 58
const FLY_SIZE = 44
const EASE = Easing.bezier(0.22, 1, 0.36, 1)
const GREEN = '#00E575'

export function ShowroomFlyCartProvider({
  children,
  visibleProgress,
}: ProviderProps) {
  const { addToCart, itemCount } = useCart()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const cartRef = useRef<View>(null)
  const cartWindowPos = useRef({ x: 0, y: 0 })

  // Entrance
  const appear = useRef(new Animated.Value(0)).current

  // Bounce / pulse on receive
  const bounce = useRef(new Animated.Value(1)).current
  const pulse = useRef(new Animated.Value(0)).current
  const badgePop = useRef(new Animated.Value(1)).current

  const [flyJobs, setFlyJobs] = useState<FlyJob[]>([])

  // Show/hide based on scroll into showroom
  useEffect(() => {
    const p = Math.min(1, Math.max(0, visibleProgress))
    Animated.timing(appear, {
      toValue: p > 0.08 ? 1 : 0,
      duration: p > 0.08 ? 520 : 260,
      easing: EASE,
      useNativeDriver: true,
    }).start()
  }, [visibleProgress, appear])

  const measureCart = useCallback(() => {
    cartRef.current?.measureInWindow((x, y, w, h) => {
      cartWindowPos.current = { x: x + w / 2, y: y + h / 2 }
    })
  }, [])

  const playReceive = useCallback(() => {
    bounce.setValue(1)
    pulse.setValue(0)
    badgePop.setValue(0.7)

    Animated.parallel([
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1.22,
          duration: 120,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 1,
          duration: 220,
          easing: EASE,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 350,
          easing: EASE,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(badgePop, {
        toValue: 1,
        friction: 3,
        tension: 180,
        useNativeDriver: true,
      }),
    ]).start()
  }, [bounce, pulse, badgePop])

  const flyAdd = useCallback(
    (product: Product, origin: Origin) => {
      if (origin.width < 2 || origin.height < 2) {
        addToCart(product)
        playReceive()
        return
      }

      // Measure cart position immediately before spawning clone
      cartRef.current?.measureInWindow((cx, cy, cw, ch) => {
        cartWindowPos.current = { x: cx + cw / 2, y: cy + ch / 2 }

        const job: FlyJob = {
          id: `${product._id}-${Date.now()}`,
          image: product.images?.[0],
          origin,
        }
        setFlyJobs((prev) => [...prev, job])
      })

      // Add to cart state immediately so badge increments seamlessly as item lands
      addToCart(product)
    },
    [addToCart, playReceive]
  )

  const onFlyComplete = useCallback(
    (id: string) => {
      setFlyJobs((prev) => prev.filter((j) => j.id !== id))
      playReceive()
    },
    [playReceive]
  )

  // Shifted much higher so it floats cleanly above the nav and preserves the same timing curve.
  const bottomOffset = Math.max(insets.bottom, 12) + 150

  const translateY = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  })
  const scaleIn = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1],
  })

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.0],
  })
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.45, 0],
  })

  const badgeLabel =
    itemCount > 99 ? '99+' : itemCount > 0 ? String(itemCount) : ''

  const hidden = visibleProgress < 0.02

  return (
    <FlyCartContext.Provider value={{ flyAdd }}>
      {children}

      {/* Floating cart */}
      <Animated.View
        pointerEvents={hidden ? 'none' : 'box-none'}
        style={[
          styles.floatWrap,
          {
            bottom: bottomOffset,
            opacity: appear,
            transform: [{ translateY }, { scale: scaleIn }],
          },
        ]}
      >
        <Pressable
          onPress={() => {
            try {
              router.push('/(tabs)/cart' as any)
            } catch {}
          }}
          onLayout={measureCart}
          style={styles.hit}
        >
          <View ref={cartRef} collapsable={false}>
            <Animated.View
              style={[styles.cartBtn, { transform: [{ scale: bounce }] }]}
            >
              {/* Green pulse ring */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pulseRing,
                  {
                    opacity: pulseOpacity,
                    transform: [{ scale: pulseScale }],
                  },
                ]}
              />

              <Ionicons name="bag-handle" size={24} color="#0A0A0A" />

              {itemCount > 0 && (
                <Animated.View
                  style={[
                    styles.badge,
                    itemCount >= 10 && styles.badgeWide,
                    { transform: [{ scale: badgePop }] },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      itemCount >= 100 && styles.badgeTextSmall,
                    ]}
                    numberOfLines={1}
                  >
                    {badgeLabel}
                  </Text>
                </Animated.View>
              )}
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>

      {/* Flying clones */}
      {flyJobs.map((job) => (
        <FlyingClone
          key={job.id}
          job={job}
          target={cartWindowPos.current}
          onComplete={() => onFlyComplete(job.id)}
        />
      ))}
    </FlyCartContext.Provider>
  )
}

/* ── Single flying product clone ── */
function FlyingClone({
  job,
  target,
  onComplete,
}: {
  job: FlyJob
  target: { x: number; y: number }
  onComplete: () => void
}) {
  const progress = useRef(new Animated.Value(0)).current
  const done = useRef(false)

  const startX = job.origin.x + job.origin.width / 2 - FLY_SIZE / 2
  const startY = job.origin.y + job.origin.height / 2 - FLY_SIZE / 2
  const endX = target.x - FLY_SIZE / 2
  const endY = target.y - FLY_SIZE / 2

  const midX = startX + (endX - startX) * 0.45
  const midY = Math.min(startY, endY) - 80

  useEffect(() => {
    progress.setValue(0)
    Animated.timing(progress, {
      toValue: 1,
      duration: 520, // Snappy & ultra smooth
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if ((finished || !finished) && !done.current) {
        done.current = true
        onComplete()
      }
    })
  }, [])

  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [startX, midX, endX],
  })
  const translateY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [startY, midY, endY],
  })
  const scale = progress.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [1, 1.1, 0.5, 0.2],
  })
  const opacity = progress.interpolate({
    inputRange: [0, 0.85, 1],
    outputRange: [1, 1, 0],
  })
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '20deg'],
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.flyClone,
        {
          opacity,
          transform: [
            { translateX },
            { translateY },
            { scale },
            { rotate },
          ],
        },
      ]}
    >
      {job.image ? (
        <Image
          source={{ uri: job.image }}
          style={styles.flyImage}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.flyImage, styles.flyFallback]}>
          <Ionicons name="cube-outline" size={18} color="#fff" />
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  floatWrap: {
    position: 'absolute',
    right: 20,
    zIndex: 80,
  },
  hit: {
    padding: 6,
  },
  cartBtn: {
    width: CART_SIZE,
    height: CART_SIZE,
    borderRadius: CART_SIZE / 2,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: GREEN,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 18,
      },
      android: { elevation: 14 },
    }),
  },
  pulseRing: {
    position: 'absolute',
    width: CART_SIZE,
    height: CART_SIZE,
    borderRadius: CART_SIZE / 2,
    borderWidth: 2,
    borderColor: GREEN,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWide: {
    minWidth: 28,
    paddingHorizontal: 6,
  },
  badgeText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  badgeTextSmall: {
    fontSize: 9,
  },
  flyClone: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: FLY_SIZE,
    height: FLY_SIZE,
    zIndex: 90,
  },
  flyImage: {
    width: FLY_SIZE,
    height: FLY_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  flyFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
