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
import { Animated, Easing, StyleSheet, View } from 'react-native'

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

const FLY = 40
const DURATION = 520
const ARC = 78 // how high the arc goes above the lower of start/end

export function ShowroomFlyCartProvider({
  children,
}: {
  children: React.ReactNode
  /** kept for API compat with home — not required for flight */
  visibleProgress?: number
}) {
  const { addToCart } = useCart()
  const pos = useRef({ x: 0, y: 0 })
  const [jobs, setJobs] = useState<FlyJob[]>([])

  const registerTarget = useCallback((x: number, y: number) => {
    // Floating nav bag center — ignore bad reads
    if (x > 8 && y > 8) {
      pos.current = { x, y }
    }
  }, [])

  const flyAdd = useCallback(
    (product: Product, origin: Origin) => {
      // Always add to cart first
      addToCart(product)

      // No valid origin → silent add only
      if (!origin || origin.width < 2 || origin.height < 2) return

      let tx = pos.current.x
      let ty = pos.current.y

      // Target not registered yet — skip flight, item still in bag
      if (tx < 1 || ty < 1) return

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
          target: { x: tx, y: ty },
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

  // Path locked once per job — never recomputed mid-flight
  const path = useMemo(() => {
    const sx = job.origin.x + job.origin.width / 2 - FLY / 2
    const sy = job.origin.y + job.origin.height / 2 - FLY / 2
    const ex = job.target.x - FLY / 2
    const ey = job.target.y - FLY / 2
    const mx = sx + (ex - sx) * 0.45
    const my = Math.min(sy, ey) - ARC
    return { sx, sy, ex, ey, mx, my }
  }, [job.id])

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.bezier(0.22, 0.82, 0.18, 1),
      useNativeDriver: true,
    })

    anim.start(({ finished }) => {
      if (!finished || done.current) return
      done.current = true
      // Let last opacity frame paint before unmount
      requestAnimationFrame(() => onComplete(job.id))
    })

    return () => anim.stop()
  }, [])

  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [path.sx, path.mx, path.ex],
  })
  const translateY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [path.sy, path.my, path.ey],
  })
  const scale = progress.interpolate({
    inputRange: [0, 0.1, 0.85, 1],
    outputRange: [1, 1.1, 0.28, 0.06],
  })
  const opacity = progress.interpolate({
    inputRange: [0, 0.88, 1],
    outputRange: [1, 1, 0],
  })
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '16deg'],
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
          <Ionicons name="cube-outline" size={15} color="#fff" />
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
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
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})