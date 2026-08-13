import { useCart } from '@/context/CartContext'
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
import { Product } from '@/constants/types'

type Origin = { x: number; y: number; width: number; height: number }

type FlyJob = {
  id: string
  image?: string
  origin: Origin
  /** locked at spawn — never changes mid-flight */
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
const DURATION = 500

export function ShowroomFlyCartProvider({
  children,
}: {
  children: React.ReactNode
  visibleProgress?: number
}) {
  const { addToCart } = useCart()
  const pos = useRef({ x: 0, y: 0 })
  const [jobs, setJobs] = useState<FlyJob[]>([])

  const registerTarget = useCallback((x: number, y: number) => {
    if (x > 0 && y > 0) {
      pos.current = { x, y }
    }
  }, [])

  const flyAdd = useCallback(
    (product: Product, origin: Origin) => {
      addToCart(product)

      if (origin.width < 2 || origin.height < 2) return

      const tx = pos.current.x
      const ty = pos.current.y
      if (tx < 1 || ty < 1) return

      const id = `${product._id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

      // snapshot target + origin once — no mid-flight updates
      setJobs((p) => [
        ...p,
        {
          id,
          image: product.images?.[0],
          origin: { ...origin },
          target: { x: tx, y: ty },
        },
      ])
    },
    [addToCart]
  )

  const onDone = useCallback((id: string) => {
    // remove only after fully faded — avoids pop/flicker
    setJobs((p) => p.filter((j) => j.id !== id))
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
  // create value once, start at 0 — no setValue mid-mount
  const progress = useRef(new Animated.Value(0)).current
  const done = useRef(false)

  const path = useMemo(() => {
    const sx = job.origin.x + job.origin.width / 2 - FLY / 2
    const sy = job.origin.y + job.origin.height / 2 - FLY / 2
    const ex = job.target.x - FLY / 2
    const ey = job.target.y - FLY / 2
    const mx = sx + (ex - sx) * 0.42
    const my = Math.min(sy, ey) - 72
    return { sx, sy, ex, ey, mx, my }
  }, [job.id]) // locked to this job only

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.bezier(0.22, 0.82, 0.18, 1),
      useNativeDriver: true,
    })

    anim.start(({ finished }) => {
      if (!done.current) {
        done.current = true
        // small delay so last opacity frame paints before unmount
        requestAnimationFrame(() => {
          onComplete(job.id)
        })
      }
    })

    return () => {
      anim.stop()
    }
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
    inputRange: [0, 0.12, 0.82, 1],
    outputRange: [1, 1.08, 0.32, 0.08],
  })
  // stay fully visible until the very end, then soft fade — no mid-flight blink
  const opacity = progress.interpolate({
    inputRange: [0, 0.9, 1],
    outputRange: [1, 1, 0],
  })
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '14deg'],
  })

  return (
    <Animated.View
      pointerEvents="none"
      collapsable={false}
      style={[
        styles.clone,
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
    zIndex: 999,
    elevation: 999,
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
    borderColor: 'rgba(255,255,255,0.25)',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})