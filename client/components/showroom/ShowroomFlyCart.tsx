// client/components/showroom/ShowroomFlyCart.tsx
import { useCart } from '@/context/CartContext'
import { Product } from '@/constants/types'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  View,
} from 'react-native'

type Origin = { x: number; y: number; width: number; height: number }

type FlyJob = {
  id: string
  image?: string
  origin: Origin
  target: { x: number; y: number }
}

type FlyCartContextValue = {
  flyAdd: (product: Product, origin: Origin) => void
  registerTarget: (x: number, y: number) => void
}

const FlyCartContext = createContext<FlyCartContextValue | null>(null)

export function useShowroomFlyCart() {
  return useContext(FlyCartContext)
}

const FLY = 48
const DURATION = 620
const ARC = 90

function fallbackTarget() {
  const { width, height } = Dimensions.get('window')
  // approx Cart tab on the floating pill (right side, above home indicator)
  return {
    x: width - 48,
    y: height - 72,
  }
}

export function ShowroomFlyCartProvider({
  children,
}: {
  children: React.ReactNode
  visibleProgress?: number
}) {
  const { addToCart } = useCart()
  const pos = useRef<{ x: number; y: number } | null>(null)
  const [jobs, setJobs] = useState<FlyJob[]>([])

  const registerTarget = useCallback((x: number, y: number) => {
    if (Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0) {
      pos.current = { x, y }
    }
  }, [])

  const flyAdd = useCallback(
    (product: Product, origin: Origin) => {
      try {
        addToCart(product)
      } catch {
        // still try visual if cart fails
      }

      if (!origin || origin.width < 2 || origin.height < 2) return

      const target = pos.current ?? fallbackTarget()

      const id = `${product._id}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`

      setJobs((prev) => [
        ...prev,
        {
          id,
          image: product.images?.[0],
          origin: {
            x: origin.x,
            y: origin.y,
            width: origin.width,
            height: origin.height,
          },
          target: { x: target.x, y: target.y },
        },
      ])
    },
    [addToCart]
  )

  const onDone = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id))
  }, [])

  return (
    <FlyCartContext.Provider value={{ flyAdd, registerTarget }}>
      {children}
      {/* overlay above tab bar */}
      <View style={styles.layer} pointerEvents="none">
        {jobs.map((job) => (
          <FlyingClone key={job.id} job={job} onComplete={onDone} />
        ))}
      </View>
    </FlyCartContext.Provider>
  )
}

function FlyingClone({
  job,
  onComplete,
}: {
  job: FlyJob
  onComplete: (id: string) => void
}) {
  const progress = useRef(new Animated.Value(0)).current
  const done = useRef(false)

  const path = useMemo(() => {
    const sx = job.origin.x + job.origin.width / 2 - FLY / 2
    const sy = job.origin.y + job.origin.height / 2 - FLY / 2
    const ex = job.target.x - FLY / 2
    const ey = job.target.y - FLY / 2
    const mx = sx + (ex - sx) * 0.4
    const my = Math.min(sy, ey) - ARC
    return { sx, sy, ex, ey, mx, my }
  }, [job.id])

  useEffect(() => {
    progress.setValue(0)
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    })

    anim.start(({ finished }) => {
      if (!finished || done.current) return
      done.current = true
      requestAnimationFrame(() => onComplete(job.id))
    })

    return () => anim.stop()
  }, [job.id])

  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [path.sx, path.mx, path.ex],
  })
  const translateY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [path.sy, path.my, path.ey],
  })
  const scale = progress.interpolate({
    inputRange: [0, 0.12, 0.75, 1],
    outputRange: [1, 1.15, 0.45, 0.12],
  })
  const opacity = progress.interpolate({
    inputRange: [0, 0.82, 1],
    outputRange: [1, 1, 0],
  })
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '18deg'],
  })

  return (
    <Animated.View
      pointerEvents="none"
      collapsable={false}
      style={[
        styles.clone,
        {
          opacity,
          transform: [{ translateX }, { translateY }, { scale }, { rotate }],
        },
      ]}
    >
      {job.image ? (
        <Image
          source={{ uri: job.image }}
          style={styles.img}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
          recyclingKey={job.id}
        />
      ) : (
        <View style={[styles.img, styles.fallback]}>
          <Ionicons name="cube-outline" size={16} color="#fff" />
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
  },
  clone: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: FLY,
    height: FLY,
  },
  img: {
    width: FLY,
    height: FLY,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: 'rgba(0,229,117,0.55)',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})