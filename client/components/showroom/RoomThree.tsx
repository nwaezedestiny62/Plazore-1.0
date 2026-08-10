/**
 * RoomThree — THE SIGNAL
 * Single-product focus stage.
 * Dark, deliberate, almost ceremonial.
 * Cart button is rendered only once (no stacking).
 */

import { Product } from '@/constants/types'
import { Image } from 'expo-image'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useShowroomFlyCart } from './ShowroomFlyCart'
import { useCart } from '@/context/CartContext'
import { useMarketplace } from '@/context/MarketplaceContext'
import { Link } from 'expo-router'
import ScrollFadeUp from './ScrollFadeUp'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

const HOLD_MS = 5200
const CROSSFADE_MS = 1800
const EASE = Easing.bezier(0.4, 0.0, 0.2, 1.0)

interface RoomThreeProps {
  products: Product[]
  title?: string
  subtitle?: string
}

export default function RoomThree({
  products,
  title = 'THE SIGNAL',
  subtitle = 'Worth Your Attention',
}: RoomThreeProps) {
  const { formatProduct } = useMarketplace()
  const [current, setCurrent] = useState(0)
  const currentRef = useRef(0)
  const busy = useRef(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const opacities = useRef(
    products.map((_, i) => new Animated.Value(i === 0 ? 1 : 0.01))
  ).current

  useEffect(() => {
    currentRef.current = current
  }, [current])

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  // inside component:
const flyCart = useShowroomFlyCart()
const { addToCart } = useCart()
const cartBtnRef = useRef<View>(null)

const handleAddToCart = () => {
  const product = products[currentRef.current]
  if (!product) return

  cartBtnRef.current?.measureInWindow((x, y, width, height) => {
    if (flyCart) {
      flyCart.flyAdd(product, { x, y, width, height })
    } else {
      addToCart(product)
    }
  })
}

  const scheduleHold = useCallback(() => {
    clearHold()
    if (products.length < 2) return
    holdTimer.current = setTimeout(() => {
      goTo(currentRef.current + 1)
    }, HOLD_MS)
  }, [products.length])

  const goTo = useCallback(
    (raw: number) => {
      if (busy.current || products.length < 2) return
      const from = currentRef.current
      const target = ((raw % products.length) + products.length) % products.length
      if (target === from) return

      busy.current = true
      clearHold()

      Animated.parallel([
        Animated.timing(opacities[from], {
          toValue: 0.01,
          duration: CROSSFADE_MS,
          easing: EASE,
          useNativeDriver: true,
        }),
        Animated.timing(opacities[target], {
          toValue: 1,
          duration: CROSSFADE_MS,
          easing: EASE,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          busy.current = false
          return
        }

        products.forEach((_, i) => {
          opacities[i].setValue(i === target ? 1 : 0.01)
        })

        currentRef.current = target
        setCurrent(target)
        busy.current = false
        scheduleHold()
      })
    },
    [products, opacities, scheduleHold]
  )

  useEffect(() => {
    if (products.length < 2) return
    scheduleHold()
    return () => clearHold()
  }, [products.length])

  if (!products.length) return null

  const active = products[current]

  return (
    <View style={styles.room}>
      {/* Header */}
      <View style={styles.header}>
        <ScrollFadeUp delay={40} duration={600} distance={16}>
          <Text style={styles.kicker}>{title}</Text>
        </ScrollFadeUp>
        <ScrollFadeUp delay={100} duration={650} distance={18}>
          <Text style={styles.title}>{subtitle}</Text>
        </ScrollFadeUp>
      </View>

      {/* Main Stage */}
      <View style={styles.stage}>
        {/* Product layers (images + text only) */}
        {products.map((product, i) => (
          <Animated.View
            key={product._id}
            pointerEvents={i === current ? 'auto' : 'none'}
            style={[
              StyleSheet.absoluteFillObject,
              { opacity: opacities[i] },
            ]}
          >
            <Link href={`/product/${product._id}` as any} asChild>
              <Pressable style={styles.stageInner}>
                <View style={styles.imageWrap}>
                  {product.images?.[0] ? (
                    <Image
                      source={{ uri: product.images[0] }}
                      style={styles.image}
                      contentFit="cover"
                      transition={0}
                    />
                  ) : (
                    <View style={[styles.image, styles.placeholder]} />
                  )}
                </View>

                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.brand}>
                      {(product.brand || 'plazore').toLowerCase()}
                    </Text>
                    <Text style={styles.divider}> | </Text>
                    <Text style={styles.price}>
                      {formatProduct(product.price, product.region)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </Link>
          </Animated.View>
        ))}

        {/* SINGLE cart button — lives outside the layers so it never stacks */}
        {/* SINGLE cart button — outside layers so it never stacks */}
<Pressable
  ref={cartBtnRef}
  onPress={handleAddToCart}
  style={styles.cartButton}
  hitSlop={12}
>
  <Ionicons name="cart-outline" size={17} color="#111" />
</Pressable>
      </View>

      {/* Dots */}
      {products.length > 1 && (
        <View style={styles.dots}>
          {products.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => goTo(i)}
              style={[styles.dot, i === current && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  room: {
    backgroundColor: '#07080C',
    paddingTop: 52,
    paddingBottom: 64,
    width: SCREEN_W,
    minHeight: SCREEN_H * 0.92,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 36,
  },
  kicker: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    letterSpacing: 4,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  stage: {
    width: SCREEN_W,
    height: SCREEN_H * 0.58,
    position: 'relative',
  },
  stageInner: {
    flex: 1,
  },
  imageWrap: {
    width: SCREEN_W - 48,
    height: '78%',
    marginHorizontal: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#111',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#1A1A1A',
  },
  // Single cart button — same design as product cards
  cartButton: {
    position: 'absolute',
    // Position it relative to the image area
    top: (SCREEN_H * 0.58 * 0.78) - 11 - 34, // bottom of image area
    right: 24 + 11,
    width: 34,
    height: 34,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.13,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 20,
  },
  info: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  name: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
  divider: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  price: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: '#FFFFFF',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  dotActive: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    width: 18,
  },
})