/**
 * ShowroomProductCard — 2030 Premium Edition
 * Completely flicker-free auto image rotation
 * Supports dark mode for text colours
 * Cart button triggers fly-to-cart (never navigates)
 */

import { Product } from '@/constants/types'
import { useCart } from '@/context/CartContext'
import { useMarketplace } from '@/context/MarketplaceContext'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { Link } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useShowroomFlyCart } from './ShowroomFlyCart'

const SCREEN_W = Dimensions.get('window').width
const H_PADDING = 16
const GAP = 4   // was 12 — tight space between cards
const CARD_WIDTH = (SCREEN_W - H_PADDING * 2 - GAP) / 2

const IMAGE_ASPECT = 1.35

const HOLD_MS = 4800
const CROSSFADE_MS = 1600
const EASE = Easing.bezier(0.4, 0.0, 0.2, 1.0)

type Props = {
  product: Product
  style?: any
  dark?: boolean
}

function resolveShipLocation(product: Product): string {
  const fl = product?.fulfillmentLocation
  if (fl?.displayLabel) return fl.displayLabel
  if (fl) {
    const parts = [fl.city, fl.state, fl.country].filter(Boolean)
    if (parts.length) return parts.join(', ')
  }
  return ''
}

function resolveBrand(product: Product): string {
  if (product.brand) return product.brand
  if (typeof product.seller === 'object' && product.seller?.storeName) {
    return product.seller.storeName
  }
  return 'plazore'
}

export default function ShowroomProductCard({
  product,
  style,
  dark = false,
}: Props) {
  const { formatProduct } = useMarketplace()
  const { addToCart } = useCart()
  const flyCart = useShowroomFlyCart()

  const location = useMemo(() => resolveShipLocation(product), [product])
  const brand = useMemo(() => resolveBrand(product), [product])

  const images = product.images?.length ? product.images : []
  const hasMultiple = images.length > 1

  const cartBtnRef = useRef<View>(null)

  const opacities = useRef(
    images.map((_, i) => new Animated.Value(i === 0 ? 1 : 0.01))
  ).current

  const currentRef = useRef(0)
  const busy = useRef(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  const scheduleHold = useCallback(() => {
    clearHold()
    if (!hasMultiple) return
    holdTimer.current = setTimeout(() => goTo(currentRef.current + 1), HOLD_MS)
  }, [hasMultiple])

  const goTo = useCallback(
    (raw: number) => {
      if (busy.current || !hasMultiple) return
      const from = currentRef.current
      const target = ((raw % images.length) + images.length) % images.length
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

        images.forEach((_, i) => {
          opacities[i].setValue(i === target ? 1 : 0.01)
        })

        currentRef.current = target
        busy.current = false
        scheduleHold()
      })
    },
    [hasMultiple, images, opacities, scheduleHold]
  )

  useEffect(() => {
    if (!hasMultiple) return
    scheduleHold()
    return () => clearHold()
  }, [hasMultiple])

  const handleAddToCart = useCallback(() => {
    cartBtnRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        addToCart(product)
        return
      }
      if (flyCart) {
        flyCart.flyAdd(product, { x, y, width, height })
      } else {
        addToCart(product)
      }
    })
  }, [product, flyCart, addToCart])

  // Same width behavior as original: base CARD_WIDTH, style can override
  const imageHeight = CARD_WIDTH * IMAGE_ASPECT

  const textPrimary = dark ? '#FFFFFF' : '#111111'
  const textSecondary = dark ? 'rgba(255,255,255,0.65)' : '#6B7280'
  const textMuted = dark ? 'rgba(255,255,255,0.42)' : '#9CA3AF'

  return (
    <View style={[styles.card, { width: CARD_WIDTH }, style]}>
      <View style={[styles.imageWrap, { height: imageHeight }]}>
        <Link href={`/product/${product._id}` as any} asChild>
          <Pressable style={StyleSheet.absoluteFillObject}>
            {images.length > 0 ? (
              images.map((uri, i) => (
                <Animated.View
                  key={`${product._id}-img-${i}`}
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    { opacity: opacities[i] },
                  ]}
                >
                  <Image
                    source={{ uri }}
                    style={styles.image}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                  />
                </Animated.View>
              ))
            ) : (
              <View style={[styles.image, styles.placeholder]} />
            )}
          </Pressable>
        </Link>

        <Pressable
          ref={cartBtnRef}
          onPress={handleAddToCart}
          style={styles.cartButton}
          hitSlop={12}
        >
          <Ionicons name="cart-outline" size={17} color="#111" />
        </Pressable>
      </View>

      <Link href={`/product/${product._id}` as any} asChild>
        <Pressable style={styles.info}>
          <Text style={[styles.name, { color: textPrimary }]} numberOfLines={1}>
            {product.name}
          </Text>

          <View style={styles.metaRow}>
            <Text
              style={[styles.brand, { color: textSecondary }]}
              numberOfLines={1}
            >
              {brand.toLowerCase()}
            </Text>
            <Text style={[styles.divider, { color: textSecondary }]}> | </Text>
            <Text style={[styles.price, { color: textPrimary }]}>
              {formatProduct(product.price, product.region)}
            </Text>
          </View>

          {!!location && (
            <Text
              style={[styles.location, { color: textMuted }]}
              numberOfLines={1}
            >
              {location}
            </Text>
          )}
        </Pressable>
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
  },
  imageWrap: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F1F1',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#E5E7EB',
  },
  cartButton: {
    position: 'absolute',
    bottom: 11,
    right: 11,
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
    zIndex: 10,
  },
  info: {
    paddingTop: 11,
    paddingHorizontal: 2,
  },
  name: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13.5,
    letterSpacing: 0.15,
    marginBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
  },
  divider: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
  },
  price: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
  },
  location: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 11,
    marginTop: 3,
  },
})