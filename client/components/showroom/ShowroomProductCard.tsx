import { Product, productHasVariants, effectiveProductStock } from '@/constants/types'
import { useCart, findVariant } from '@/context/CartContext'
import { useMarketplace } from '@/context/MarketplaceContext'
import { trackShowroomEvent } from '@/services/showroomEvents'
import { useAuth, useOAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
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
const GRAD = ['#00E575', '#14B8A6', '#2563EB']

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
  // Derive from variants if options missing
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
    if (matched && matched.price != null && Number.isFinite(Number(matched.price))) {
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
    if (primaryImage) {
      Image.prefetch(primaryImage).catch(() => {})
    }
  }, [primaryImage])

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
    (p: Product, variantPayload?: {
      variantId?: string
      variantKey?: string
      selectedOptions?: Record<string, string>
      price?: number
      image?: string
    }) => {
      trackShowroomEvent({
        productId: String(p._id),
        type: 'cart',
        room,
        position,
        region: p.region,
      })
      cartBtnRef.current?.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) {
          addToCart(p, variantPayload)
          return
        }
        if (flyCart) flyCart.flyAdd(p, { x, y, width, height }, variantPayload)
        else addToCart(p, variantPayload)
      })
    },
    [flyCart, addToCart, room, position],
  )

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    const pending = pendingCartRef.current
    if (!pending) return
    pendingCartRef.current = null
    setAuthOpen(false)
    const t = setTimeout(() => {
      if (productHasVariants(pending)) {
        setVariantOpen(true)
      } else {
        doAddToCart(pending)
      }
    }, 120)
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

    if (hasVar) {
      setSelected({})
      setVariantOpen(true)
      return
    }

    doAddToCart(product)
  }, [isLoaded, isSignedIn, product, doAddToCart, hasVar])

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
    setAuthOpen(false)
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
        setAuthOpen(false)
      }
    } catch {
      // cancelled
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
              {brand.toLowerCase()}
            </Text>
            <Text style={[styles.divider, { color: textMuted }]}> · </Text>
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

      {/* Variant sheet — mall counter, sharp edges */}
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
                          style={[
                            styles.optChip,
                            active && styles.optChipOn,
                          ]}
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

      {/* Auth sheet */}
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

export default React.memo(ShowroomProductCard)

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
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: Platform.OS === 'ios' ? 'flex-end' : 'center',
    paddingHorizontal: Platform.OS === 'ios' ? 0 : 20,
  },
  authSheet: {
    backgroundColor: SURFACE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
  },
  variantSheet: {
    backgroundColor: SURFACE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingTop: 0,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    maxHeight: '88%',
  },
  variantAccent: {
    height: 2,
    marginHorizontal: -20,
    marginBottom: 16,
    backgroundColor: GREEN,
  },
  authHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
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
