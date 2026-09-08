import { Product } from '@/constants/types'
import { useCart } from '@/context/CartContext'
import { useMarketplace } from '@/context/MarketplaceContext'
import { trackShowroomEvent } from '@/services/showroomEvents'
import { useAuth, useOAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import { Link, usePathname, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useShowroomFlyCart } from './ShowroomFlyCart'

WebBrowser.maybeCompleteAuthSession()

const H_PADDING = 16
const GAP = 4
/** Was 1.35 — shorter product cards */
const IMAGE_ASPECT = 1.08
const HOLD_MS = 5200
const CROSSFADE_MS = 1800
const EASE = Easing.bezier(0.4, 0.0, 0.2, 1.0)

const BG = '#090B0F'
const SURFACE = '#11141A'
const LINE = 'rgba(255,255,255,0.1)'
const TEXT = '#F5F7FA'
const SECONDARY = 'rgba(255,255,255,0.55)'
const GREEN = '#00E575'

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
  const { isSignedIn, isLoaded } = useAuth()
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' })
  const router = useRouter()
  const pathname = usePathname()

  const [authOpen, setAuthOpen] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

  /** Product waiting to be added after successful auth */
  const pendingCartRef = useRef<Product | null>(null)

  const defaultW = (screenW - H_PADDING * 2 - GAP) / 2
  const cardW = Number(style?.width) > 0 ? Number(style.width) : defaultW
  const imageHeight = cardW * IMAGE_ASPECT

  const location = useMemo(() => resolveShipLocation(product), [product])
  const brand = useMemo(() => resolveBrand(product), [product])
  const priceLabel = useMemo(
    () => formatProduct(resolvePrice(product), product.region),
    [formatProduct, product],
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
    [images, opacities, clearHold],
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

  const doAddToCart = useCallback(
    (p: Product) => {
      trackShowroomEvent({
        productId: String(p._id),
        type: 'cart',
        room,
        position,
        region: p.region,
      })
      cartBtnRef.current?.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) {
          addToCart(p)
          return
        }
        if (flyCart) flyCart.flyAdd(p, { x, y, width, height })
        else addToCart(p)
      })
    },
    [flyCart, addToCart, room, position],
  )

  /** After sign-in / Google OAuth succeeds → add pending product */
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    const pending = pendingCartRef.current
    if (!pending) return
    pendingCartRef.current = null
    setAuthOpen(false)
    // small delay so session is fully ready
    const t = setTimeout(() => doAddToCart(pending), 120)
    return () => clearTimeout(t)
  }, [isLoaded, isSignedIn, doAddToCart])

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
    if (!isLoaded) return

    if (!isSignedIn) {
      pendingCartRef.current = product
      setAuthOpen(true)
      return
    }

    doAddToCart(product)
  }, [isLoaded, isSignedIn, product, doAddToCart])

  const returnPath = pathname || '/'

  const onSignIn = useCallback(() => {
    setAuthOpen(false)
    // Keep pending product so useEffect adds it after return
    router.push({
      pathname: '/(auth)/sign-in' as any,
      params: { redirect_url: returnPath },
    })
  }, [router, returnPath])

  const onContinueGoogle = useCallback(async () => {
    try {
      setGoogleBusy(true)
      const { createdSessionId, setActive } = await startOAuthFlow()
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId })
        // pending product stays in ref → useEffect will add to cart
        setAuthOpen(false)
      }
    } catch {
      // user cancelled or error — keep sheet open
    } finally {
      setGoogleBusy(false)
    }
  }, [startOAuthFlow])

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

      {/* Auth sheet — same idea as web */}
      <Modal
        visible={authOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          pendingCartRef.current = null
          setAuthOpen(false)
        }}
      >
        <Pressable
          style={styles.authScrim}
          onPress={() => {
            pendingCartRef.current = null
            setAuthOpen(false)
          }}
        >
          <Pressable
            style={styles.authSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.authHead}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.authTitle}>Continue on Plazore</Text>
                <Text style={styles.authSub}>
                  Sign in to add this product to your cart. You’ll return here
                  after.
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  pendingCartRef.current = null
                  setAuthOpen(false)
                }}
                hitSlop={12}
                style={styles.authClose}
              >
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>

            <View style={styles.authActions}>
              <Pressable
                onPress={onSignIn}
                style={styles.authPrimary}
                disabled={googleBusy}
              >
                <Text style={styles.authPrimaryText}>Sign in</Text>
              </Pressable>

              <Pressable
                onPress={onContinueGoogle}
                style={styles.authGoogle}
                disabled={googleBusy}
              >
                {googleBusy ? (
                  <ActivityIndicator color={TEXT} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={18} color={TEXT} />
                    <Text style={styles.authGoogleText}>
                      Continue with Google
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  pendingCartRef.current = product
                  setAuthOpen(false)
                  router.push({
                    pathname: '/(auth)/sign-in' as any,
                    params: {
                      mode: 'signup',
                      redirect_url: returnPath,
                    },
                  })
                }}
                disabled={googleBusy}
              >
                <Text style={styles.authSignup}>Create a Plazore account</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  info: { paddingTop: 9, paddingHorizontal: 2, paddingBottom: 2 },
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

  authScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: Platform.OS === 'ios' ? 'flex-end' : 'center',
    paddingHorizontal: Platform.OS === 'ios' ? 0 : 24,
  },
  authSheet: {
    backgroundColor: SURFACE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    ...(Platform.OS === 'ios'
      ? {}
      : { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth }),
  },
  authHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  authTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  authSub: {
    color: SECONDARY,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  authClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authActions: { gap: 10 },
  authPrimary: {
    height: 48,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  authPrimaryText: {
    color: '#1F1F1F',
    fontSize: 14,
    fontWeight: '800',
  },
  authGoogle: {
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  authGoogleText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  authSignup: {
    textAlign: 'center',
    color: GREEN,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 12,
  },
})