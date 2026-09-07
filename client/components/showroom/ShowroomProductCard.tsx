import { Product } from '@/constants/types'
import { useCart } from '@/context/CartContext'
import { useMarketplace } from '@/context/MarketplaceContext'
import { trackShowroomEvent } from '@/services/showroomEvents'
import { Ionicons } from '@expo/vector-icons'
import { Link } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useShowroomFlyCart } from './ShowroomFlyCart'

const H_PADDING = 16
const GAP = 4
const IMAGE_ASPECT = 1.35
const HOLD_MS = 5200
const CROSSFADE_MS = 1800
const EASE = Easing.bezier(0.4, 0.0, 0.2, 1.0)

type Props = {
  product: Product
  style?: any
  dark?: boolean
  room?: number
  position?: number
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

function imageUri(img: any): string {
  if (!img) return ''
  if (typeof img === 'string') return img.trim()
  if (typeof img.url === 'string') return img.url
  if (typeof img.uri === 'string') return img.uri
  if (typeof img.secure_url === 'string') return img.secure_url
  if (typeof img.src === 'string') return img.src
  return ''
}

function resolvePrice(product: Product): number {
  const p = product as any
  const candidates = [
    p.price,
    p.salePrice,
    p.displayPrice,
    p.amount,
    p.unitPrice,
  ]
  for (const c of candidates) {
    const n = typeof c === 'string' ? parseFloat(c) : Number(c)
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

export default function ShowroomProductCard({
  product,
  style,
  dark = false,
  room,
  position,
}: Props) {
  const { formatProduct } = useMarketplace()
  const { addToCart } = useCart()
  const flyCart = useShowroomFlyCart()
  const { width: screenW } = useWindowDimensions()

  const defaultW = (screenW - H_PADDING * 2 - GAP) / 2
  const cardW = Number(style?.width) > 0 ? Number(style.width) : defaultW
  const imageHeight = cardW * IMAGE_ASPECT

  const location = useMemo(() => resolveShipLocation(product), [product])
  const brand = useMemo(() => resolveBrand(product), [product])
  const priceLabel = useMemo(
    () => formatProduct(resolvePrice(product), product.region),
    [formatProduct, product]
  )

  const images = useMemo(() => {
    const raw = Array.isArray(product.images) ? product.images : []
    const list = raw.map(imageUri).filter(Boolean)
    return Array.from(new Set(list))
  }, [product.images])

  const cartBtnRef = useRef<View>(null)
  const impressed = useRef(false)
  const currentRef = useRef(0)
  const busy = useRef(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const opacities = useRef<Animated.Value[]>([]).current

  if (opacities.length !== images.length) {
    opacities.splice(0, opacities.length)
    images.forEach((_, i) => {
      opacities.push(new Animated.Value(i === 0 ? 1 : 0))
    })
    currentRef.current = 0
  }

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  const goTo = useCallback(
    (raw: number) => {
      if (busy.current || images.length < 2) return
      const from = currentRef.current
      const target = ((raw % images.length) + images.length) % images.length
      if (target === from) return
      if (!opacities[from] || !opacities[target]) return

      busy.current = true
      clearHold()

      Animated.parallel([
        Animated.timing(opacities[from], {
          toValue: 0,
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
        if (finished) {
          images.forEach((_, i) => {
            opacities[i]?.setValue(i === target ? 1 : 0)
          })
          currentRef.current = target
        }
        busy.current = false
        if (finished) {
          holdTimer.current = setTimeout(() => goTo(target + 1), HOLD_MS)
        }
      })
    },
    [images, opacities, clearHold]
  )

  useEffect(() => {
    images.forEach((uri) => {
      Image.prefetch(uri).catch(() => {})
    })
  }, [images])

  useEffect(() => {
    clearHold()
    if (images.length < 2) return
    holdTimer.current = setTimeout(() => goTo(1), HOLD_MS)
    return () => clearHold()
  }, [images, goTo, clearHold])

  useEffect(() => {
    if (impressed.current || !product?._id) return
    impressed.current = true
    trackShowroomEvent({
      productId: String(product._id),
      type: 'impression',
      room,
      position,
      region: product.region,
    })
  }, [product?._id, product?.region, room, position])

  const trackOpen = useCallback(() => {
    if (!product?._id) return
    trackShowroomEvent({
      productId: String(product._id),
      type: 'open',
      room,
      position,
      region: product.region,
    })
  }, [product?._id, product?.region, room, position])

  const handleAddToCart = useCallback(() => {
    trackShowroomEvent({
      productId: String(product._id),
      type: 'cart',
      room,
      position,
      region: product.region,
    })
    cartBtnRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        addToCart(product)
        return
      }
      if (flyCart) flyCart.flyAdd(product, { x, y, width, height })
      else addToCart(product)
    })
  }, [product, flyCart, addToCart, room, position])

  const textPrimary = dark ? '#FFFFFF' : '#111111'
  const textSecondary = dark ? 'rgba(255,255,255,0.65)' : '#6B7280'
  const textMuted = dark ? 'rgba(255,255,255,0.42)' : '#9CA3AF'

  return (
    <View style={[styles.card, { width: cardW }, style]}>
      <View style={[styles.imageWrap, { height: imageHeight }]}>
        <Link href={`/product/${product._id}` as any} asChild>
          <Pressable style={styles.fill} onPress={trackOpen}>
            {images.length > 0 ? (
              images.map((uri, i) => (
                <Animated.Image
                  key={`${product._id}-${i}`}
                  source={{ uri }}
                  resizeMode="cover"
                  style={[
                    styles.image,
                    styles.fill,
                    { opacity: opacities[i] ?? 1 },
                  ]}
                />
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
        <Pressable style={styles.info} onPress={trackOpen}>
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
            <Text style={[styles.divider, { color: textMuted }]}> · </Text>
            <Text style={[styles.price, { color: textSecondary }]}>
              {priceLabel}
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
  card: { backgroundColor: 'transparent' },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  imageWrap: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E8E2D8',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { backgroundColor: '#DDD6CC' },
  cartButton: {
    position: 'absolute',
    bottom: 11,
    right: 11,
    width: 34,
    height: 34,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  info: { paddingTop: 11, paddingHorizontal: 2 },
  name: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13.5,
    letterSpacing: 0.15,
    marginBottom: 3,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  brand: { fontFamily: 'Manrope_400Regular', fontSize: 12, flexShrink: 1 },
  divider: { fontFamily: 'Manrope_400Regular', fontSize: 12 },
  price: { fontFamily: 'Manrope_500Medium', fontSize: 12 },
  location: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 11,
    marginTop: 3,
  },
})