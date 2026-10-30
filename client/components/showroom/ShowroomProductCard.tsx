import { Product, productHasVariants, effectiveProductStock } from '@/constants/types'
import { useCart, findVariant } from '@/context/CartContext'
import { useMarketplace } from '@/context/MarketplaceContext'
import { trackShowroomEvent } from '@/services/showroomEvents'
import { useAuth, useOAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { Link, usePathname, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useShowroomFlyCart } from './ShowroomFlyCart'

WebBrowser.maybeCompleteAuthSession()

const H_PADDING = 16
const GAP = 4
const IMAGE_ASPECT = 1.08
const SURFACE = '#11141A'
const LINE = 'rgba(255,255,255,0.1)'
const TEXT = '#F5F7FA'
const SECONDARY = 'rgba(255,255,255,0.55)'
const GREEN = '#00E575'
const PENDING_KEY = 'plazore_pending_action'
const RETURN_KEY = 'plazore_return_to'

// Official Google "G" (multi-color)
const GOOGLE_G =
  'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg'

async function savePending(productId: string, returnPath: string) {
  try {
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default
    await AsyncStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        type: 'add_to_cart',
        productId: String(productId),
        at: Date.now(),
      }),
    )
    await AsyncStorage.setItem(RETURN_KEY, returnPath || '/')
  } catch {
    /* optional */
  }
}

async function readPending(): Promise<{
  type?: string
  productId?: string
  at?: number
} | null> {
  try {
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default
    const raw = await AsyncStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.type !== 'add_to_cart' || !parsed?.productId) return null
    if (Date.now() - Number(parsed.at || 0) > 30 * 60 * 1000) {
      await AsyncStorage.removeItem(PENDING_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

async function clearPending() {
  try {
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default
    await AsyncStorage.removeItem(PENDING_KEY)
  } catch {
    /* optional */
  }
}

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

/**
 * Brand shown on the card = the seller who listed the product.
 * Priority: seller.storeName → product.brand → "plazore"
 */
function resolveBrand(product: Product): string {
  const seller = product.seller
  if (seller && typeof seller === 'object') {
    const store =
      (seller as any).storeName ||
      (seller as any).name ||
      (seller as any).store?.name
    if (typeof store === 'string' && store.trim()) return store.trim()
  }
  if (product.brand && String(product.brand).trim()) {
    return String(product.brand).trim()
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

function normalizeOptions(product: Product) {
  const raw = product.options
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((o) => ({
        id: String(o.id || o.name || ''),
        name: String(o.name || '').trim(),
        values: Array.isArray(o.values)
          ? o.values.map((v) => String(v).trim()).filter(Boolean)
          : [],
      }))
      .filter((o) => o.name && o.values.length)
  }
  const map: Record<string, Set<string>> = {}
  for (const v of product.variants || []) {
    const o = v.options || {}
    for (const [k, val] of Object.entries(o)) {
      if (!map[k]) map[k] = new Set()
      if (val) map[k].add(String(val))
    }
  }
  return Object.entries(map).map(([name, set]) => ({
    id: name,
    name,
    values: Array.from(set),
  }))
}

function ShowroomProductCard({
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
  const [variantOpen, setVariantOpen] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)

  const pendingCartRef = useRef<Product | null>(null)
  const cartBtnRef = useRef<View>(null)
  const impressed = useRef(false)
  const addLockRef = useRef(false)

  const defaultW = (screenW - H_PADDING * 2 - GAP) / 2
  const cardW = Number(style?.width) > 0 ? Number(style.width) : defaultW
  const imageHeight = cardW * IMAGE_ASPECT

  const hasVar = productHasVariants(product)
  const optionGroups = useMemo(() => normalizeOptions(product), [product])

  const matched = useMemo(() => {
    if (!hasVar) return null
    return findVariant(product, selected)
  }, [hasVar, product, selected])

  const allPicked =
    !hasVar ||
    (optionGroups.length > 0 &&
      optionGroups.every((g) => !!selected[g.name]))

  const unitPrice = useMemo(() => {
    if (
      matched &&
      matched.price != null &&
      Number.isFinite(Number(matched.price))
    ) {
      return Number(matched.price)
    }
    return resolvePrice(product)
  }, [matched, product])

  const inStock = useMemo(() => {
    if (matched) return Number(matched.stock) > 0 && matched.isActive !== false
    return effectiveProductStock(product) > 0
  }, [matched, product])

  const location = useMemo(() => resolveShipLocation(product), [product])
  const brand = useMemo(() => resolveBrand(product), [product])

  const priceLabel = useMemo(
    () => formatProduct(unitPrice, product.region),
    [formatProduct, unitPrice, product.region],
  )
  const basePriceLabel = useMemo(
    () => formatProduct(resolvePrice(product), product.region),
    [formatProduct, product],
  )

  const primaryImage = useMemo(() => {
    if (matched?.image) return matched.image
    const raw = Array.isArray(product.images) ? product.images : []
    for (const img of raw) {
      const uri = imageUri(img)
      if (uri) return uri
    }
    return ''
  }, [product.images, matched])

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
    (
      p: Product,
      variantPayload?: {
        variantId?: string
        variantKey?: string
        selectedOptions?: Record<string, string>
        price?: number
        image?: string
      },
    ) => {
      trackShowroomEvent({
        productId: String(p._id),
        type: 'cart',
        room,
        position,
        region: p.region,
      })
      if (!flyCart) {
        addToCart(p, variantPayload)
        return
      }
      let added = false
      const safeAdd = () => {
        if (added) return
        added = true
        addToCart(p, variantPayload)
      }
      cartBtnRef.current?.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) {
          safeAdd()
          return
        }
        flyCart.flyAdd(p, { x, y, width, height }, variantPayload)
      })
    },
    [flyCart, addToCart, room, position],
  )

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    const run = async () => {
      let pending = pendingCartRef.current
      if (!pending) {
        const stored = await readPending()
        if (
          stored?.productId &&
          String(stored.productId) === String(product._id)
        ) {
          pending = product
        }
      }
      if (!pending) return
      if (String(pending._id) !== String(product._id)) return
      pendingCartRef.current = null
      await clearPending()
      setAuthOpen(false)
      setTimeout(() => {
        if (productHasVariants(pending!)) {
          setSelected({})
          setVariantOpen(true)
        } else {
          doAddToCart(pending!)
        }
      }, 120)
    }
    void run()
  }, [isLoaded, isSignedIn, doAddToCart, product])

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
    if (addLockRef.current) return
    addLockRef.current = true
    setTimeout(() => {
      addLockRef.current = false
    }, 400)

    if (!isSignedIn) {
      pendingCartRef.current = product
      void savePending(String(product._id), pathname || '/')
      setAuthOpen(true)
      return
    }
    if (hasVar) {
      setSelected({})
      setVariantOpen(true)
      return
    }
    doAddToCart(product)
  }, [isLoaded, isSignedIn, product, doAddToCart, hasVar, pathname])

  const confirmVariantAdd = useCallback(() => {
    if (!allPicked || !matched || !inStock || adding) return
    setAdding(true)
    doAddToCart(product, {
      variantId: matched.variantId,
      variantKey: matched.variantKey,
      selectedOptions: { ...selected },
      price: unitPrice,
      image: matched.image || product.images?.[0],
    })
    setVariantOpen(false)
    setAdding(false)
  }, [
    allPicked,
    matched,
    inStock,
    adding,
    doAddToCart,
    product,
    selected,
    unitPrice,
  ])

  const returnPath = pathname || '/'

  const onSignIn = useCallback(() => {
    pendingCartRef.current = product
    void savePending(String(product._id), pathname || '/')
    setAuthOpen(false)
    router.push({
      pathname: '/(auth)/sign-in' as any,
      params: { redirect_url: pathname || '/' },
    })
  }, [product, pathname, router])

  const onContinueGoogle = useCallback(async () => {
    try {
      setGoogleBusy(true)
      pendingCartRef.current = product
      await savePending(String(product._id), pathname || '/')
      const redirectUrl = Linking.createURL('/', { scheme: 'plazore' })
      const { createdSessionId, setActive } = await startOAuthFlow({
        redirectUrl,
      })
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId })
        setAuthOpen(false)
      }
    } catch {
      // cancelled
    } finally {
      setGoogleBusy(false)
    }
  }, [startOAuthFlow, product, pathname])

  const textPrimary = dark ? '#FFFFFF' : '#111111'
  const textSecondary = dark ? 'rgba(255,255,255,0.65)' : '#6B7280'
  const textMuted = dark ? 'rgba(255,255,255,0.42)' : '#9CA3AF'

  return (
    <View style={[styles.card, { width: cardW }, style]}>
      <View style={[styles.imageWrap, { height: imageHeight }]}>
        <Link href={`/product/${product._id}` as any} asChild>
          <Pressable style={styles.fill} onPress={trackOpen}>
            {primaryImage ? (
              <Image
                source={{ uri: primaryImage }}
                resizeMode="cover"
                style={[styles.image, styles.fill]}
              />
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
              {brand}
            </Text>
            <Text style={[styles.divider, { color: textMuted }]}> | </Text>
            <Text style={[styles.price, { color: textSecondary }]}>
              {basePriceLabel}
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

      {/* ── Variant picker ── */}
      <Modal
        visible={variantOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setVariantOpen(false)}
      >
        <Pressable
          style={styles.authScrim}
          onPress={() => setVariantOpen(false)}
        >
          <Pressable
            style={styles.variantSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.variantAccent} />
            <View style={styles.authHead}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.authTitle}>Choose options</Text>
                <Text style={styles.authSub} numberOfLines={2}>
                  {product.name}
                </Text>
              </View>
              <Pressable
                onPress={() => setVariantOpen(false)}
                hitSlop={12}
                style={styles.authClose}
              >
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
            <ScrollView
              style={{ maxHeight: 340 }}
              showsVerticalScrollIndicator={false}
            >
              {optionGroups.map((group) => (
                <View key={group.id || group.name} style={styles.optGroup}>
                  <Text style={styles.optLabel}>{group.name}</Text>
                  <View style={styles.optRow}>
                    {group.values.map((val) => {
                      const active = selected[group.name] === val
                      return (
                        <Pressable
                          key={val}
                          onPress={() =>
                            setSelected((prev) => ({
                              ...prev,
                              [group.name]: val,
                            }))
                          }
                          style={[styles.optChip, active && styles.optChipOn]}
                        >
                          <Text
                            style={[
                              styles.optChipText,
                              active && styles.optChipTextOn,
                            ]}
                          >
                            {val}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.variantFooter}>
              <View style={{ flex: 1 }}>
                <Text style={styles.variantPriceLabel}>
                  {allPicked && matched ? 'Price' : 'From'}
                </Text>
                <Text style={styles.variantPrice}>{priceLabel}</Text>
                {allPicked && matched ? (
                  <Text style={styles.variantStock}>
                    {inStock
                      ? `${matched.stock} in stock`
                      : 'Out of stock'}
                  </Text>
                ) : (
                  <Text style={styles.variantStock}>Select all options</Text>
                )}
              </View>
              <Pressable
                onPress={confirmVariantAdd}
                disabled={!allPicked || !matched || !inStock || adding}
                style={[
                  styles.variantAdd,
                  (!allPicked || !matched || !inStock) && styles.variantAddOff,
                ]}
              >
                {adding ? (
                  <ActivityIndicator color="#041412" />
                ) : (
                  <Text style={styles.variantAddText}>Add</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Auth popup (smooth + Google branded) ── */}
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
            {/* subtle top accent */}
            <View style={styles.authTopAccent} />

            <View style={styles.authHead}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.authKicker}>Account required</Text>
                <Text style={styles.authTitle}>Sign in to add to your bag</Text>
                <Text style={styles.authSub}>
                  Your bag stays with your Plazore account across devices.
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
              {/* Google button — official white + multi-color G */}
              <Pressable
                onPress={onContinueGoogle}
                style={({ pressed }) => [
                  styles.googleBtn,
                  pressed && styles.googleBtnPressed,
                  googleBusy && styles.googleBtnDisabled,
                ]}
                disabled={googleBusy}
              >
                {googleBusy ? (
                  <ActivityIndicator color="#4285F4" />
                ) : (
                  <>
                    <View style={styles.googleIconWrap}>
                      <Image
                        source={{ uri: GOOGLE_G }}
                        style={styles.googleIcon}
                        resizeMode="contain"
                      />
                    </View>
                    <Text style={styles.googleBtnText}>
                      Continue with Google
                    </Text>
                  </>
                )}
              </Pressable>

              {/* Email / password sign-in */}
              <Pressable
                onPress={onSignIn}
                style={({ pressed }) => [
                  styles.authSecondaryBtn,
                  pressed && styles.authSecondaryBtnPressed,
                ]}
                disabled={googleBusy}
              >
                <Text style={styles.authSecondaryBtnText}>Sign in</Text>
              </Pressable>

              {/* Create account */}
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
                style={styles.authSignupWrap}
              >
                <Text style={styles.authSignup}>
                  Create a Plazore account
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

export default React.memo(ShowroomProductCard, (a, b) => {
  return (
    a.product?._id === b.product?._id &&
    a.product?.price === b.product?.price &&
    a.product?.images?.[0] === b.product?.images?.[0] &&
    a.dark === b.dark &&
    a.room === b.room &&
    a.position === b.position &&
    a.style?.width === b.style?.width
  )
})

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

  /* ── Shared modal scrim ── */
  authScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: Platform.OS === 'ios' ? 'flex-end' : 'center',
    paddingHorizontal: Platform.OS === 'ios' ? 0 : 20,
  },

  /* ── Auth sheet ── */
  authSheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: Platform.OS === 'ios' ? 20 : 16,
    borderTopRightRadius: Platform.OS === 'ios' ? 20 : 16,
    borderRadius: Platform.OS === 'ios' ? 0 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingTop: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingHorizontal: 22,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
      android: { elevation: 24 },
    }),
  },
  authTopAccent: {
    height: 3,
    marginHorizontal: -22,
    marginBottom: 18,
    backgroundColor: GREEN,
    opacity: 0.9,
  },
  authHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 22,
  },
  authKicker: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  authTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  authSub: {
    color: SECONDARY,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 6,
  },
  authClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authActions: { gap: 12 },

  /* Google button — official look */
  googleBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    // subtle Google-blue glow on the edge
    borderWidth: 1.5,
    borderColor: 'rgba(66,133,244,0.35)',
    ...Platform.select({
      ios: {
        shadowColor: '#4285F4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  googleBtnPressed: {
    backgroundColor: '#F7F9FC',
    transform: [{ scale: 0.985 }],
  },
  googleBtnDisabled: {
    opacity: 0.7,
  },
  googleIconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleBtnText: {
    color: '#1F1F1F',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  /* Secondary Sign in */
  authSecondaryBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authSecondaryBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  authSecondaryBtnText: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '700',
  },

  authSignupWrap: {
    paddingVertical: 6,
  },
  authSignup: {
    textAlign: 'center',
    color: GREEN,
    fontSize: 14.5,
    fontWeight: '700',
    paddingVertical: 8,
  },

  /* ── Variant sheet (unchanged logic, slight polish) ── */
  variantSheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: Platform.OS === 'ios' ? 20 : 16,
    borderTopRightRadius: Platform.OS === 'ios' ? 20 : 16,
    borderRadius: Platform.OS === 'ios' ? 0 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingTop: 0,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  variantAccent: {
    height: 3,
    marginHorizontal: -20,
    marginBottom: 16,
    backgroundColor: GREEN,
  },
  optGroup: { marginBottom: 18 },
  optLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  optChipOn: {
    borderColor: GREEN,
    backgroundColor: 'rgba(0,229,117,0.12)',
  },
  optChipText: {
    color: SECONDARY,
    fontSize: 13,
    fontWeight: '600',
  },
  optChipTextOn: {
    color: GREEN,
    fontWeight: '800',
  },
  variantFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  variantPriceLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  variantPrice: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  variantStock: {
    color: SECONDARY,
    fontSize: 12,
    marginTop: 2,
  },
  variantAdd: {
    minWidth: 108,
    height: 48,
    borderRadius: 12,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  variantAddOff: {
    backgroundColor: '#2A2F38',
  },
  variantAddText: {
    color: '#041412',
    fontSize: 15,
    fontWeight: '800',
  },
})