import api from '@/constants/api'
import {
  buildFulfillmentLocation,
  FULFILLMENT_COUNTRIES,
  getCitiesForState,
  getStatesForCountry,
} from '@/constants/locations'
import {
  CATEGORY_LIST,
  PLAN_FEES,
  PLAN_IMAGE_LIMITS,
  PRODUCT_CATEGORIES,
} from '@/constants/productCatalog'
import {
  categoryNeedsDocs,
  getDocTypes,
  getSpecFields,
} from '@/constants/productSpecs'
import { getRegion } from '@/constants/regions'
import { useMarketplace } from '@/context/MarketplaceContext'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const CURRENT_PLAN: keyof typeof PLAN_IMAGE_LIMITS = 'free'
const WIN_W = Dimensions.get('window').width
const PHONE_W = Math.min(WIN_W - 56, 320)
const PHONE_H = Math.min(PHONE_W * 2.12, 600)
const CARD_W = Math.min((WIN_W - 56) * 0.48, 150)
const IMAGE_ASPECT = 1.35

const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = '#252A33'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#737A86'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const AI_GREEN = '#10B981'

type LocalDoc = {
  uri: string
  name: string
  type: string
  mimeType?: string
}

export type ProductPreviewData = {
  name: string
  brand: string
  price: number
  description: string
  images: string[]
  stock: number
  category: string
  subCategory: string
  region: string
  storeName: string
  shipsFrom: string | null
  shippingMethod: 'self' | 'courier' | null
  courierCompany: string
  deliveryFee: number
  specifications: Record<string, string>
}

type OverlayAction = {
  label: string
  onPress: () => void
  destructive?: boolean
  primary?: boolean
}

type OverlayState = {
  title: string
  message?: string
  tone?: 'info' | 'success' | 'danger'
  actions?: OverlayAction[]
  durationMs?: number
} | null

/* ── Top overlay (replaces Alert) ── */
function TopOverlay({
  state,
  onDismiss,
}: {
  state: OverlayState
  onDismiss: () => void
}) {
  const insets = useSafeAreaInsets()
  const translateY = useRef(new Animated.Value(-120)).current
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!state) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start()
      return
    }
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 9,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()
    if (!state.actions?.length) {
      timer.current = setTimeout(
        () => onDismiss(),
        state.durationMs ?? 4000
      )
    }
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state])

  if (!state) return null
  const accent =
    state.tone === 'danger' ? '#EF4444' : state.tone === 'success' ? GREEN : BLUE
  const hasActions = !!state.actions?.length

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        paddingTop: insets.top + 8,
        paddingHorizontal: 14,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: SURFACE,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
          minHeight: 64,
        }}
      >
        <View style={{ width: 3, backgroundColor: accent }} />
        <View style={{ flex: 1, padding: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                backgroundColor: `${accent}22`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={
                  state.tone === 'danger'
                    ? 'warning-outline'
                    : state.tone === 'success'
                      ? 'checkmark-circle-outline'
                      : 'information-circle-outline'
                }
                size={18}
                color={accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: TEXT, fontSize: 14, fontWeight: '700' }}>
                {state.title}
              </Text>
              {!!state.message && (
                <Text
                  style={{
                    color: SECONDARY,
                    fontSize: 12.5,
                    lineHeight: 18,
                    marginTop: 3,
                  }}
                >
                  {state.message}
                </Text>
              )}
            </View>
            {!hasActions && (
              <Pressable onPress={onDismiss} hitSlop={12}>
                <Ionicons name="close" size={18} color={MUTED} />
              </Pressable>
            )}
          </View>
          {hasActions && (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 12,
              }}
            >
              {state.actions!.map((a, i) => (
                <Pressable
                  key={`${a.label}-${i}`}
                  onPress={() => {
                    onDismiss()
                    requestAnimationFrame(() => a.onPress())
                  }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    backgroundColor: a.primary
                      ? TEXT
                      : a.destructive
                        ? '#EF4444'
                        : SURFACE_2,
                    borderWidth: a.primary || a.destructive ? 0 : StyleSheet.hairlineWidth,
                    borderColor: LINE,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: a.primary ? BG : a.destructive ? '#FFF' : TEXT,
                    }}
                  >
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  )
}

function Section({
  step,
  title,
  subtitle,
  children,
}: {
  step: string
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <LinearGradient
          colors={[GREEN, BLUE]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.stepBadge}
        >
          <Text style={styles.stepText}>{step}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.sectionRule} />
      {children}
    </View>
  )
}

function Label({
  children,
  onPress,
}: {
  children: React.ReactNode
  onPress?: () => void
}) {
  const body = (
    <Text style={styles.label}>{children}</Text>
  )
  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={6}>
        {body}
      </Pressable>
    )
  }
  return body
}

function ProductCardPreview({
  data,
  formatPrice,
}: {
  data: ProductPreviewData
  formatPrice: (n: number) => string
}) {
  const imageH = CARD_W * IMAGE_ASPECT
  const img = data.images[0]
  const brand = (data.brand || data.storeName || 'plazore').toLowerCase()

  return (
    <View style={{ width: CARD_W }}>
      {/* Image — same as ShowroomProductCard */}
      <View
        style={{
          width: '100%',
          height: imageH,
          backgroundColor: '#F1F1F1',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {img ? (
          <Image
            source={{ uri: img }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              flex: 1,
              backgroundColor: '#E5E7EB',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="image-outline" size={26} color="#9CA3AF" />
          </View>
        )}
        <View style={styles.cardCart}>
          <Ionicons name="cart-outline" size={17} color="#111" />
        </View>
      </View>

      {/* Info — dark-mode showroom colours (readable on dark form) */}
      <View style={{ paddingTop: 11, paddingHorizontal: 2 }}>
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 13.5,
            fontWeight: '500',
            letterSpacing: 0.15,
            marginBottom: 3,
          }}
          numberOfLines={1}
        >
          {data.name || 'Product name'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text
            style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}
            numberOfLines={1}
          >
            {brand}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
            {' '}
            |{' '}
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '500' }}>
            {formatPrice(data.price)}
          </Text>
        </View>
        {!!data.shipsFrom && (
          <Text
            style={{
              color: 'rgba(255,255,255,0.42)',
              fontSize: 11,
              marginTop: 3,
            }}
            numberOfLines={1}
          >
            {data.shipsFrom}
          </Text>
        )}
      </View>
    </View>
  )
}

/* ── Phone frame + product page (no AI) ── */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.phoneOuter}>
      {/* soft glow behind device */}
      <View style={styles.phoneGlow} />
      <View style={styles.phoneBezel}>
        {/* side button hints */}
        <View style={styles.phoneSideBtnTop} />
        <View style={styles.phoneSideBtnVol} />

        {/* status / dynamic island */}
        <View style={styles.phoneStatusRow}>
          <Text style={styles.phoneTime}>9:41</Text>
          <View style={styles.phoneIsland} />
          <View style={styles.phoneStatusIcons}>
            <View style={styles.phoneSignal} />
            <View style={styles.phoneBattery} />
          </View>
        </View>

        <View style={styles.phoneScreen}>{children}</View>

        {/* home indicator */}
        <View style={styles.phoneHome} />
      </View>
    </View>
  )
}

function ProductPagePreview({
  data,
  formatPrice,
}: {
  data: ProductPreviewData
  formatPrice: (n: number) => string
}) {
  const [page, setPage] = useState(0)
  const galleryH = Math.min(PHONE_W * 1.15, 300)
  const images = data.images
  const hasGallery = images.length > 1
  const stockN = Math.max(0, data.stock)
  const inStock = stockN > 0

  const deliveryLabel =
    data.shippingMethod === 'self'
      ? 'Direct Merchant Delivery'
      : data.courierCompany?.trim()
        ? data.courierCompany.trim()
        : data.shippingMethod === 'courier'
          ? 'Courier Delivery'
          : null

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / PHONE_W)
    if (i !== page) setPage(i)
  }

  const specEntries = Object.entries(data.specifications || {}).filter(
    ([, v]) => v?.trim()
  )

  return (
    <PhoneFrame>
      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        bounces={false}
      >
        <View style={{ width: PHONE_W, height: galleryH, backgroundColor: '#07080C' }}>
          {images.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              nestedScrollEnabled
            >
              {images.map((uri, i) => (
                <Image
                  key={`${uri}-${i}`}
                  source={{ uri }}
                  style={{ width: PHONE_W, height: galleryH }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="image-outline" size={32} color="#3A3F4A" />
            </View>
          )}
          {hasGallery && (
            <View style={styles.dotsRow}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === page ? 14 : 5,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor:
                      i === page ? TEXT : 'rgba(255,255,255,0.28)',
                    marginHorizontal: 2,
                  }}
                />
              ))}
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 28 }}>
          {(data.category || data.subCategory) ? (
            <Text style={styles.pageEyebrow} numberOfLines={1}>
              {[data.category, data.subCategory].filter(Boolean).join(' · ')}
            </Text>
          ) : null}

          <Text style={styles.pageName}>
            {data.name || 'Product name'}
          </Text>

          <View style={styles.pagePriceRow}>
            <Text style={styles.pagePrice} numberOfLines={1}>
              {formatPrice(data.price)}
            </Text>
            <View
              style={[
                styles.availBadge,
                inStock ? styles.availOn : styles.availOff,
              ]}
            >
              <View
                style={[
                  styles.availDot,
                  { backgroundColor: inStock ? AI_GREEN : '#EF6262' },
                ]}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: inStock ? AI_GREEN : '#EF6262',
                }}
                numberOfLines={1}
              >
                {inStock
                  ? `Available · ${stockN}`
                  : 'Unavailable'}
              </Text>
            </View>
          </View>

          {!!data.brand && (
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{data.brand}</Text>
              </View>
            </View>
          )}

          {!!data.description.trim() && (
            <>
              <Text style={styles.pageSection}>About</Text>
              <View style={styles.pageCard}>
                <Text style={styles.pageBody}>{data.description}</Text>
              </View>
            </>
          )}

          {specEntries.length > 0 && (
            <>
              <Text style={styles.pageSection}>Specs</Text>
              <View style={[styles.pageCard, { paddingVertical: 4 }]}>
                {specEntries.map(([k, v], i) => (
                  <View
                    key={k}
                    style={[
                      styles.specRow,
                      i < specEntries.length - 1 && styles.specBorder,
                    ]}
                  >
                    <Text style={styles.specKey} numberOfLines={1}>
                      {k
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/_/g, ' ')
                        .trim()}
                    </Text>
                    <Text style={styles.specVal} numberOfLines={2}>
                      {v}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {(deliveryLabel || data.shipsFrom) && (
            <>
              <Text style={styles.pageSection}>Delivery</Text>
              <View style={styles.pageCard}>
                {!!deliveryLabel && (
                  <View style={{ marginBottom: data.shipsFrom ? 10 : 0 }}>
                    <Text style={styles.shipLabel}>Delivery</Text>
                    <Text style={styles.shipMethod}>{deliveryLabel}</Text>
                  </View>
                )}
                {!!data.shipsFrom && (
                  <View
                    style={{
                      paddingTop: deliveryLabel ? 10 : 0,
                      borderTopWidth: deliveryLabel
                        ? StyleSheet.hairlineWidth
                        : 0,
                      borderTopColor: LINE,
                    }}
                  >
                    <Text style={styles.shipLabel}>Ships from</Text>
                    <Text style={styles.shipMethod}>{data.shipsFrom}</Text>
                  </View>
                )}
                {!!data.shippingMethod && (
                  <View style={styles.shipFeeRow}>
                    <Text style={{ color: SECONDARY, fontSize: 13 }}>
                      Delivery fee
                    </Text>
                    <Text style={{ color: TEXT, fontWeight: '600', fontSize: 14 }}>
                      {formatPrice(data.deliveryFee)}
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}

          <Text style={styles.pageSection}>Sold by</Text>
          <View style={[styles.pageCard, { flexDirection: 'row', alignItems: 'center' }]}>
            <View style={styles.storeIcon}>
              <Ionicons name="storefront-outline" size={16} color={SECONDARY} />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.shipLabel}>Visit storefront</Text>
              <Text style={{ color: TEXT, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                {data.storeName || data.brand || 'Your store'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <View style={styles.previewSecondary}>
              <Text style={{ color: TEXT, fontWeight: '700', fontSize: 12 }}>
                Add to Bag
              </Text>
            </View>
            <View style={styles.previewPrimary}>
              <Text style={{ color: BG, fontWeight: '800', fontSize: 12 }}>
                Buy Now
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </PhoneFrame>
  )
}

/* ── Success screen after publish ── */
function PublishedScreen({
  productId,
  name,
  onView,
  onLater,
}: {
  productId: string
  name: string
  onView: () => void
  onLater: () => void
}) {
  const fade = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.92)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <View style={styles.successRoot}>
      <Animated.View
        style={{
          opacity: fade,
          transform: [{ scale }],
          alignItems: 'center',
          paddingHorizontal: 28,
        }}
      >
        <LinearGradient
          colors={[GREEN, BLUE]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.successRing}
        >
          <View style={styles.successInner}>
            <Ionicons name="checkmark" size={36} color={GREEN} />
          </View>
        </LinearGradient>
        <Text style={styles.successTitle}>Published</Text>
        <Text style={styles.successSub}>
          {name.trim() || 'Your product'} is live in the mall.
        </Text>
        <TouchableOpacity
          onPress={onView}
          activeOpacity={0.9}
          style={{ width: '100%', marginTop: 28 }}
        >
          <LinearGradient
            colors={[GREEN, BLUE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.successPrimary}
          >
            <Text style={styles.successPrimaryText}>View product</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onLater}
          activeOpacity={0.85}
          style={styles.successSecondary}
        >
          <Text style={styles.successSecondaryText}>Back to products</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

export default function AddProduct() {
  const { getToken } = useAuth()
  const router = useRouter()
  const { region, currencySymbol, formatProduct } = useMarketplace()
  const regionInfo = getRegion(region)

  const maxImages = PLAN_IMAGE_LIMITS[CURRENT_PLAN]
  const feePct = PLAN_FEES[CURRENT_PLAN]

  const [images, setImages] = useState<string[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [stock, setStock] = useState('')
  const [shippingMethod, setShippingMethod] = useState<'self' | 'courier' | null>(
    null
  )
  const [courierCompany, setCourierCompany] = useState('')
  const [deliveryFee, setDeliveryFee] = useState('')
  const [loading, setLoading] = useState(false)
  const [overlay, setOverlay] = useState<OverlayState>(null)
  const [publishedId, setPublishedId] = useState<string | null>(null)

  const [specs, setSpecs] = useState<Record<string, string>>({})
  const [documents, setDocuments] = useState<LocalDoc[]>([])
  const [fulfillCountryCode, setFulfillCountryCode] = useState('')
  const [fulfillStateCode, setFulfillStateCode] = useState('')
  const [fulfillCity, setFulfillCity] = useState('')

  const nameRef = useRef<TextInput>(null)
  const priceRef = useRef<TextInput>(null)
  const descRef = useRef<TextInput>(null)
  const brandRef = useRef<TextInput>(null)
  const stockRef = useRef<TextInput>(null)
  const courierRef = useRef<TextInput>(null)
  const feeRef = useRef<TextInput>(null)

  const fulfillCountry = FULFILLMENT_COUNTRIES.find(
    (c) => c.code === fulfillCountryCode
  )
  const fulfillStates = getStatesForCountry(fulfillCountryCode)
  const fulfillCities = getCitiesForState(fulfillCountryCode, fulfillStateCode)

  const subCategories = useMemo(
    () => (category ? PRODUCT_CATEGORIES[category] || ['Other'] : []),
    [category]
  )
  const specFields = useMemo(() => getSpecFields(category), [category])
  const needsDocs = categoryNeedsDocs(category)
  const docTypes = useMemo(() => getDocTypes(category), [category])

  const productPreviewData: ProductPreviewData = useMemo(() => {
    const priceNum = Number(String(price).replace(/,/g, '').trim()) || 0
    const stockNum = Number(String(stock).trim()) || 0
    const feeNum = Number(String(deliveryFee).replace(/,/g, '').trim()) || 0
    let shipsFrom: string | null = null
    if (fulfillCity && fulfillCountry) {
      shipsFrom = `${fulfillCity}, ${fulfillCountry.name}`
    }
    return {
      name: name.trim(),
      brand: brand.trim(),
      price: priceNum,
      description: description.trim(),
      images,
      stock: stockNum,
      category,
      subCategory,
      region,
      storeName: brand.trim() || 'Your store',
      shipsFrom,
      shippingMethod,
      courierCompany,
      deliveryFee: feeNum,
      specifications: specs,
    }
  }, [
    name,
    brand,
    price,
    description,
    images,
    stock,
    category,
    subCategory,
    region,
    fulfillCity,
    fulfillCountry,
    shippingMethod,
    courierCompany,
    deliveryFee,
    specs,
  ])

  const formatPreviewPrice = (n: number) => {
    try {
      if (typeof formatProduct === 'function') return formatProduct(n, region)
    } catch {}
    return `${currencySymbol}${n.toLocaleString()}`
  }

  const toast = useCallback(
    (
      title: string,
      message?: string,
      tone: OverlayState extends null ? never : NonNullable<OverlayState>['tone'] = 'info'
    ) => setOverlay({ title, message, tone, durationMs: 3800 }),
    []
  )

  const pickImages = async () => {
    const remaining = maxImages - images.length
    if (remaining <= 0) {
      toast('Limit reached', `Your plan allows up to ${maxImages} images.`, 'danger')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: remaining,
    })
    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri)
      setImages((prev) => [...prev, ...uris].slice(0, maxImages))
    }
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const moveImage = (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= images.length) return
    setImages((prev) => {
      const copy = [...prev]
      ;[copy[index], copy[next]] = [copy[next], copy[index]]
      return copy
    })
  }

  const pickDocuments = async () => {
    if (documents.length >= 5) {
      toast('Limit', 'You can upload up to 5 documents', 'danger')
      return
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: true,
      })
      if (result.canceled) return
      const defaultType = docTypes[0]?.id || 'other'
      const next: LocalDoc[] = result.assets.map((a) => ({
        uri: a.uri,
        name: a.name || 'Document',
        type: defaultType,
        mimeType: a.mimeType || undefined,
      }))
      setDocuments((prev) => [...prev, ...next].slice(0, 5))
    } catch {
      toast('Error', 'Could not open document picker', 'danger')
    }
  }

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim() || !price || !stock) {
      toast('Missing fields', 'Complete product information', 'danger')
      nameRef.current?.focus()
      return
    }
    if (!category || !subCategory) {
      toast('Category', 'Select a category and subcategory', 'danger')
      return
    }
    if (images.length === 0) {
      toast('Images', 'Add at least one product image', 'danger')
      return
    }
    if (!fulfillCountryCode || !fulfillCity) {
      toast(
        'Fulfillment',
        'Select where this product ships from',
        'danger'
      )
      return
    }
    if (fulfillStates.length > 0 && !fulfillStateCode) {
      toast('Fulfillment', 'Select a state / province', 'danger')
      return
    }
    if (!shippingMethod) {
      toast('Shipping', 'Choose Self Delivery or Courier', 'danger')
      return
    }
    if (shippingMethod === 'courier' && !courierCompany.trim()) {
      toast('Courier', 'Enter the courier company name', 'danger')
      courierRef.current?.focus()
      return
    }
    const cleanedFee = String(deliveryFee).replace(/,/g, '').trim()
    const feeNum = Number(cleanedFee)
    if (cleanedFee === '' || Number.isNaN(feeNum) || feeNum < 0) {
      toast('Delivery fee', 'Enter a valid fee (0 allowed)', 'danger')
      feeRef.current?.focus()
      return
    }
    const cleanedPrice = String(price).replace(/,/g, '').trim()
    const priceNum = Number(cleanedPrice)
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast('Price', 'Enter a valid product price', 'danger')
      priceRef.current?.focus()
      return
    }

    try {
      setLoading(true)
      const token = await getToken()
      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('description', description.trim())
      formData.append('price', String(priceNum))
      formData.append('stock', stock)
      formData.append('category', category)
      formData.append('subCategory', subCategory)
      formData.append('brand', brand.trim())
      formData.append('shippingMethod', shippingMethod)
      formData.append('courierCompany', courierCompany.trim())
      formData.append('deliveryFee', String(feeNum))
      formData.append('specifications', JSON.stringify(specs))

      const loc = buildFulfillmentLocation({
        countryCode: fulfillCountryCode,
        country: fulfillCountry?.name || '',
        stateCode: fulfillStateCode,
        state:
          fulfillStates.find((s) => s.code === fulfillStateCode)?.name || '',
        city: fulfillCity,
      })
      formData.append('fulfillmentCountryCode', loc.countryCode)
      formData.append('fulfillmentCountry', loc.country)
      formData.append('fulfillmentStateCode', loc.stateCode || '')
      formData.append('fulfillmentState', loc.state || '')
      formData.append('fulfillmentCity', loc.city)

      images.forEach((uri, index) => {
        const filename = uri.split('/').pop() || `image-${index}.jpg`
        const match = /\.(\w+)$/.exec(filename)
        formData.append('images', {
          uri,
          name: filename,
          type: match ? `image/${match[1]}` : 'image/jpeg',
        } as any)
      })

      documents.forEach((doc) => {
        formData.append('documentTypes', doc.type)
        formData.append('documentNames', doc.name)
        formData.append('documents', {
          uri: doc.uri,
          name: doc.name,
          type: doc.mimeType || 'application/pdf',
        } as any)
      })

      const res = await api.post('/seller/products', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      if (res.data.success) {
        const id =
          res.data.data?._id ||
          res.data.data?.id ||
          res.data.product?._id ||
          ''
        setPublishedId(String(id || 'ok'))
      } else {
        toast('Error', res.data.message || 'Failed to publish', 'danger')
      }
    } catch (error: any) {
      toast(
        'Error',
        error.response?.data?.message || 'Failed to publish',
        'danger'
      )
    } finally {
      setLoading(false)
    }
  }

  if (publishedId) {
    return (
      <PublishedScreen
        productId={publishedId}
        name={name}
        onView={() => {
          if (publishedId && publishedId !== 'ok') {
            router.replace(`/product/${publishedId}` as any)
          } else {
            router.replace('/seller/products' as any)
          }
        }}
        onLater={() => router.replace('/seller/products' as any)}
      />
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: BG }}
    >
      <TopOverlay state={overlay} onDismiss={() => setOverlay(null)} />

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 56 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        <Text style={styles.pageKicker}>Catalog</Text>
        <Text style={styles.pageTitle}>New product</Text>
        <Text style={styles.pageLead}>
          Build the listing, watch the buyer view update live, then publish.
        </Text>

        {/* 01 Images */}
        <Section
          step="01"
          title="Product images"
          subtitle={`${images.length} / ${maxImages} · ${CURRENT_PLAN} plan`}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {images.map((uri, index) => (
              <View key={`${uri}-${index}`} style={{ marginRight: 12 }}>
                <Image
                  source={{ uri }}
                  style={{ width: 104, height: 104, borderRadius: 14 }}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    marginTop: 8,
                    gap: 8,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => moveImage(index, -1)}
                    style={styles.iconCircle}
                  >
                    <Ionicons name="chevron-back" size={16} color={TEXT} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeImage(index)}
                    style={[styles.iconCircle, { backgroundColor: '#3A1F28' }]}
                  >
                    <Ionicons name="trash-outline" size={14} color="#FF8A9A" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => moveImage(index, 1)}
                    style={styles.iconCircle}
                  >
                    <Ionicons name="chevron-forward" size={16} color={TEXT} />
                  </TouchableOpacity>
                </View>
                {index === 0 && (
                  <Text
                    style={{
                      color: MUTED,
                      fontSize: 10,
                      textAlign: 'center',
                      marginTop: 4,
                    }}
                  >
                    Cover
                  </Text>
                )}
              </View>
            ))}
            {images.length < maxImages && (
              <TouchableOpacity onPress={pickImages} style={styles.addImage}>
                <Ionicons name="add" size={26} color={MUTED} />
                <Text style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>
                  Add
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Section>

        {/* 02 Info */}
        <Section step="02" title="Product information">
          <Label onPress={() => nameRef.current?.focus()}>Product name *</Label>
          <TextInput
            ref={nameRef}
            value={name}
            onChangeText={setName}
            placeholder="Clear, buyer-friendly title"
            placeholderTextColor="#3D5268"
            style={styles.input}
          />

          <Label onPress={() => priceRef.current?.focus()}>
            Price ({currencySymbol}) *
          </Label>
          <TextInput
            ref={priceRef}
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            keyboardType="decimal-pad"
            placeholderTextColor="#3D5268"
            style={styles.input}
          />
          <Text style={styles.hint}>
            {regionInfo.name} · {regionInfo.currency.code}
          </Text>

          <Label onPress={() => descRef.current?.focus()}>Description *</Label>
          <TextInput
            ref={descRef}
            value={description}
            onChangeText={setDescription}
            placeholder="Materials, fit, what’s included…"
            multiline
            placeholderTextColor="#3D5268"
            style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
          />

          <Label>Category *</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {CATEGORY_LIST.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => {
                  setCategory(cat)
                  setSubCategory('')
                  setSpecs({})
                  setDocuments([])
                }}
                style={[styles.pill, category === cat && styles.pillOn]}
              >
                <Text style={[styles.pillText, category === cat && styles.pillTextOn]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {!!category && (
            <>
              <Label>Subcategory *</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {subCategories.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    onPress={() => setSubCategory(sub)}
                    style={[styles.pill, subCategory === sub && styles.pillOn]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        subCategory === sub && styles.pillTextOn,
                      ]}
                    >
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Label onPress={() => brandRef.current?.focus()}>
            Brand (recommended)
          </Label>
          <TextInput
            ref={brandRef}
            value={brand}
            onChangeText={setBrand}
            placeholder="Brand name"
            placeholderTextColor="#3D5268"
            style={styles.input}
          />
          <Text style={styles.hint}>
            Helps buyers trust the listing in the showroom.
          </Text>

          <Label onPress={() => stockRef.current?.focus()}>
            Stock quantity *
          </Label>
          <TextInput
            ref={stockRef}
            value={stock}
            onChangeText={setStock}
            placeholder="0"
            keyboardType="number-pad"
            placeholderTextColor="#3D5268"
            style={styles.input}
          />
        </Section>

        {!!category && specFields.length > 0 && (
          <Section
            step="03"
            title="Specifications"
            subtitle="Fields for this category"
          >
            {specFields.map((field) => (
              <View key={field.key} style={{ marginBottom: 14 }}>
                <Label>
                  {field.label}
                  {field.optional ? ' (optional)' : ''}
                </Label>
                <TextInput
                  value={specs[field.key] || ''}
                  onChangeText={(t) =>
                    setSpecs((prev) => ({ ...prev, [field.key]: t }))
                  }
                  placeholder={field.placeholder || field.label}
                  placeholderTextColor="#3D5268"
                  style={styles.input}
                />
              </View>
            ))}
          </Section>
        )}

        {needsDocs && (
          <Section
            step="04"
            title="Verification documents"
            subtitle="PDF or image · up to 5"
          >
            {documents.map((doc, index) => (
              <View key={`${doc.uri}-${index}`} style={styles.docBox}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{ color: TEXT, fontSize: 13, flex: 1 }}
                    numberOfLines={1}
                  >
                    {doc.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      setDocuments((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF8A9A" />
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {docTypes.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() =>
                        setDocuments((prev) =>
                          prev.map((d, i) =>
                            i === index ? { ...d, type: t.id } : d
                          )
                        )
                      }
                      style={[
                        styles.pill,
                        doc.type === t.id && styles.pillOn,
                        { marginRight: 8 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          doc.type === t.id && styles.pillTextOn,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ))}
            {documents.length < 5 && (
              <TouchableOpacity onPress={pickDocuments} style={styles.dashedBtn}>
                <Ionicons
                  name="document-attach-outline"
                  size={22}
                  color={MUTED}
                />
                <Text style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
                  Add document
                </Text>
              </TouchableOpacity>
            )}
          </Section>
        )}

        <Section
          step={needsDocs ? '05' : '04'}
          title="Fulfillment location"
          subtitle="Where this ships from"
        >
          <Label>Country *</Label>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 14 }}
          >
            {FULFILLMENT_COUNTRIES.map((c) => (
              <TouchableOpacity
                key={c.code}
                onPress={() => {
                  setFulfillCountryCode(c.code)
                  setFulfillStateCode('')
                  setFulfillCity('')
                }}
                style={[
                  styles.pill,
                  fulfillCountryCode === c.code && styles.pillOn,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    fulfillCountryCode === c.code && styles.pillTextOn,
                  ]}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {fulfillStates.length > 0 && (
            <>
              <Label>State / Province *</Label>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 14 }}
              >
                {fulfillStates.map((s) => (
                  <TouchableOpacity
                    key={s.code}
                    onPress={() => {
                      setFulfillStateCode(s.code)
                      setFulfillCity('')
                    }}
                    style={[
                      styles.pill,
                      fulfillStateCode === s.code && styles.pillOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        fulfillStateCode === s.code && styles.pillTextOn,
                      ]}
                    >
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {!!fulfillCountryCode &&
            (fulfillStates.length === 0 || !!fulfillStateCode) && (
              <>
                <Label>City *</Label>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  {fulfillCities.map((city) => (
                    <TouchableOpacity
                      key={city}
                      onPress={() => setFulfillCity(city)}
                      style={[styles.pill, fulfillCity === city && styles.pillOn]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          fulfillCity === city && styles.pillTextOn,
                        ]}
                      >
                        {city}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
        </Section>

        <Section step={needsDocs ? '06' : '05'} title="Shipping method">
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            {(['self', 'courier'] as const).map((m) => {
              const active = shippingMethod === m
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setShippingMethod(m)}
                  style={[styles.shipChoice, active && styles.shipChoiceOn]}
                >
                  <Ionicons
                    name={m === 'self' ? 'walk-outline' : 'car-outline'}
                    size={20}
                    color={active ? GREEN : MUTED}
                  />
                  <Text
                    style={{
                      marginTop: 8,
                      fontWeight: '600',
                      fontSize: 13,
                      color: active ? TEXT : MUTED,
                    }}
                  >
                    {m === 'self' ? 'Self delivery' : 'Courier'}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {shippingMethod === 'courier' && (
            <>
              <Label onPress={() => courierRef.current?.focus()}>
                Courier company *
              </Label>
              <TextInput
                ref={courierRef}
                value={courierCompany}
                onChangeText={setCourierCompany}
                placeholder="e.g. DHL, GIG, FedEx"
                placeholderTextColor="#3D5268"
                style={styles.input}
              />
            </>
          )}

          {!!shippingMethod && (
            <>
              <Label onPress={() => feeRef.current?.focus()}>
                Delivery fee *
              </Label>
              <TextInput
                ref={feeRef}
                value={deliveryFee}
                onChangeText={(t) =>
                  setDeliveryFee(t.replace(/[^0-9.]/g, ''))
                }
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor="#3D5268"
                style={styles.input}
              />
            </>
          )}
        </Section>

        {/* LIVE PREVIEW — before publish */}
        <View style={{ marginBottom: 8, marginTop: 4 }}>
          <Text style={styles.pageKicker}>Live preview</Text>
          <Text style={styles.previewHead}>What buyers will see</Text>
          <Text style={styles.pageLead}>
            See your product as buyers will experience it.
          </Text>
        </View>

        <Text style={styles.label}>Showroom card</Text>
        <View style={styles.previewPad}>
          <ProductCardPreview
            data={productPreviewData}
            formatPrice={formatPreviewPrice}
          />
        </View>

        <Text style={[styles.label, { marginTop: 8 }]}>Product page</Text>
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <ProductPagePreview
            data={productPreviewData}
            formatPrice={formatPreviewPrice}
          />
        </View>
        <Text
          style={{
            color: MUTED,
            fontSize: 11,
            textAlign: 'center',
            marginBottom: 22,
          }}
        >
          Preview the page · swipe through your images
        </Text>

        {/* Publish */}
                <Section step={needsDocs ? '07' : '06'} title="Publish">
          <View style={styles.feeRow}>
            <Text style={{ color: MUTED, fontSize: 13 }}>Plan</Text>
            <Text
              style={{
                color: TEXT,
                fontWeight: '600',
                textTransform: 'capitalize',
              }}
            >
              {CURRENT_PLAN}
            </Text>
          </View>
          <View style={[styles.feeRow, { marginBottom: 4 }]}>
            <Text style={{ color: MUTED, fontSize: 13 }}>Transaction fee</Text>
            <Text style={{ color: TEXT, fontWeight: '600' }}>
              {feePct}% of product price
            </Text>
          </View>
          <Text style={[styles.hint, { marginBottom: 0 }]}>
            Fee applies only to product price — never delivery.
          </Text>
        </Section>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.9}
          style={{ marginBottom: 20, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={[GREEN, BLUE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.publishBtn}
          >
            {loading ? (
              <ActivityIndicator color="#041412" />
            ) : (
              <>
                <Ionicons name="rocket-outline" size={18} color="#041412" />
                <Text style={styles.publishText}>Publish product</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  pageKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: MUTED,
    textTransform: 'uppercase',
  },
  pageTitle: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.5,
  },
  pageLead: {
    marginTop: 6,
    marginBottom: 18,
    fontSize: 13,
    lineHeight: 19,
    color: SECONDARY,
  },
  previewHead: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    marginTop: 2,
  },

  section: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    marginBottom: 14,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBadge: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: '#041412', fontSize: 12, fontWeight: '800' },
  sectionTitle: { color: TEXT, fontSize: 16, fontWeight: '700' },
  sectionSub: { color: MUTED, fontSize: 11, marginTop: 2 },
  sectionRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
    marginVertical: 14,
  },

  label: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0A121C',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: TEXT,
    fontSize: 15,
    marginBottom: 12,
  },
  hint: { color: MUTED, fontSize: 11, marginTop: -6, marginBottom: 12 },

  pill: {
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: '#0A121C',
  },
  pillOn: {
    backgroundColor: 'rgba(0,229,117,0.12)',
    borderColor: 'rgba(0,229,117,0.35)',
  },
  pillText: { fontSize: 12, color: MUTED, fontWeight: '500' },
  pillTextOn: { color: GREEN, fontWeight: '700' },

  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImage: {
    width: 104,
    height: 104,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2A4560',
    backgroundColor: '#0A121C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2A4560',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  docBox: {
    backgroundColor: '#0A121C',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  shipChoice: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: '#0A121C',
    alignItems: 'center',
  },
  shipChoiceOn: {
    borderColor: 'rgba(0,229,117,0.4)',
    backgroundColor: 'rgba(0,229,117,0.08)',
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  previewPad: {
    backgroundColor: '#0A121C',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
    marginBottom: 16,
    alignItems: 'flex-start',
  },

  cardCart: {
    position: 'absolute',
    bottom: 11,
    right: 11,
    width: 34,
    height: 34,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.13,
    shadowRadius: 3,
    elevation: 3,
  },
  cardName: {
    color: '#111',
    fontSize: 13.5,
    fontWeight: '500',
    marginBottom: 3,
  },
  cardBrand: { color: '#6B7280', fontSize: 12 },
  cardPrice: { color: '#111', fontSize: 12, fontWeight: '500' },
  cardLoc: { color: '#9CA3AF', fontSize: 11, marginTop: 3 },

  phoneOuter: {
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  phoneGlow: {
    position: 'absolute',
    width: PHONE_W + 40,
    height: PHONE_H * 0.55,
    borderRadius: 200,
    backgroundColor: 'rgba(0,229,117,0.06)',
    top: '22%',
  },
  phoneStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 6,
    height: 18,
  },
  phoneTime: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    width: 40,
  },
  phoneIsland: {
    width: 78,
    height: 18,
    borderRadius: 10,
    backgroundColor: '#000',
  },
  phoneStatusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 40,
    justifyContent: 'flex-end',
  },
  phoneSignal: {
    width: 12,
    height: 8,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  phoneBattery: {
    width: 16,
    height: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
phoneBezel: {
    width: PHONE_W + 20,
    height: PHONE_H + 28,
    borderRadius: 40,
    backgroundColor: '#12141A',
    borderWidth: 3,
    borderColor: '#2C313A',
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 9,
    overflow: 'hidden',
    // subtle depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
  phoneNotch: {
    alignSelf: 'center',
    width: 72,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1A1D24',
    marginBottom: 6,
  },
 phoneScreen: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: BG,
  },
  
  phoneHome: {
    alignSelf: 'center',
    width: 96,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginTop: 8,
  },
phoneSideBtnTop: {
    position: 'absolute',
    right: -3,
    top: 96,
    width: 3,
    height: 36,
    borderRadius: 2,
    backgroundColor: '#3A404C',
  },
  phoneSideBtnVol: {
    position: 'absolute',
    left: -3,
    top: 110,
    width: 3,
    height: 52,
    borderRadius: 2,
    backgroundColor: '#3A404C',
  },
  
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  pageEyebrow: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  pageName: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  pagePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  pagePrice: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '700',
    flexShrink: 1,
  },
  availBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '48%',
  },
  availOn: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(59,130,246,0.28)',
  },
  availOff: {
    backgroundColor: 'rgba(239,98,98,0.1)',
    borderColor: 'rgba(239,98,98,0.28)',
  },
  availDot: { width: 5, height: 5, borderRadius: 3 },
  chipRow: { flexDirection: 'row', marginBottom: 12 },
  chip: {
    backgroundColor: SURFACE_2,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  chipText: { color: SECONDARY, fontSize: 12 },
  pageSection: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },
  pageCard: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 12,
    marginBottom: 12,
  },
  pageBody: { color: SECONDARY, fontSize: 13, lineHeight: 19 },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    gap: 8,
  },
  specBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  specKey: { color: MUTED, fontSize: 11, maxWidth: '40%' },
  specVal: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  shipLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  shipMethod: {
    color: TEXT,
    fontWeight: '600',
    fontSize: 13,
    marginTop: 2,
  },
  shipFeeRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  storeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: SURFACE_2,
    alignItems: 'center',
  },
  previewPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#FFF',
    alignItems: 'center',
  },

  publishBtn: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  publishText: {
    color: '#041412',
    fontWeight: '800',
    fontSize: 15,
  },

  successRoot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.4,
  },
  successSub: {
    marginTop: 8,
    fontSize: 14,
    color: SECONDARY,
    textAlign: 'center',
    lineHeight: 21,
  },
  successPrimary: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  successPrimaryText: {
    color: '#041412',
    fontWeight: '800',
    fontSize: 15,
  },
  successSecondary: {
    marginTop: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: SURFACE,
  },
  successSecondaryText: {
    color: TEXT,
    fontWeight: '600',
    fontSize: 14,
  },
})