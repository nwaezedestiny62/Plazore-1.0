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
  feeMode: 'free' | 'fixed' | 'on_delivery' | null
  shippingMethod: 'self' | 'courier' | null
  courierCompany: string
  deliveryFee: number
  deliveryNote: string
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
      timer.current = setTimeout(() => onDismiss(), state.durationMs ?? 4000)
    }
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state, onDismiss, translateY, opacity])

  if (!state) return null
  const accent =
    state.tone === 'danger'
      ? '#EF4444'
      : state.tone === 'success'
        ? GREEN
        : BLUE
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
                    borderWidth:
                      a.primary || a.destructive
                        ? 0
                        : StyleSheet.hairlineWidth,
                    borderColor: LINE,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: a.primary
                        ? BG
                        : a.destructive
                          ? '#FFF'
                          : TEXT,
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
  const body = <Text style={styles.label}>{children}</Text>
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
        {data.feeMode === 'free' ? (
          <Text
            style={{
              color: GREEN,
              fontSize: 11,
              marginTop: 3,
              fontWeight: '600',
            }}
          >
            Free delivery
          </Text>
        ) : data.feeMode === 'on_delivery' ? (
          <Text
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 11,
              marginTop: 3,
            }}
          >
            Pay on arrival
          </Text>
        ) : null}
      </View>
    </View>
  )
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.phoneOuter}>
      <View style={styles.phoneGlow} />
      <View style={styles.phoneBezel}>
        <View style={styles.phoneSideBtnTop} />
        <View style={styles.phoneSideBtnVol} />
        <View style={styles.phoneStatusRow}>
          <Text style={styles.phoneTime}>9:41</Text>
          <View style={styles.phoneIsland} />
          <View style={styles.phoneStatusIcons}>
            <View style={styles.phoneSignal} />
            <View style={styles.phoneBattery} />
          </View>
        </View>
        <View style={styles.phoneScreen}>{children}</View>
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
    data.feeMode === 'free'
      ? 'Free delivery'
      : data.shippingMethod === 'self'
        ? 'Self delivery'
        : data.courierCompany?.trim()
          ? data.courierCompany.trim()
          : data.shippingMethod === 'courier'
            ? 'Courier'
            : null

  const feeDisplay =
    data.feeMode === 'free'
      ? 'Free'
      : data.feeMode === 'on_delivery'
        ? 'Pay on arrival'
        : data.feeMode === 'fixed' && data.deliveryFee > 0
          ? formatPrice(data.deliveryFee)
          : null

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / PHONE_W)
    if (i !== page) setPage(i)
  }

  const specEntries = Object.entries(data.specifications || {}).filter(
    ([, v]) => v?.trim(),
  )

  return (
    <PhoneFrame>
      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        bounces={false}
      >
        <View
          style={{
            width: PHONE_W,
            height: galleryH,
            backgroundColor: '#07080C',
          }}
        >
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
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
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

        <View
          style={{
            paddingHorizontal: 14,
            paddingTop: 14,
            paddingBottom: 28,
          }}
        >
          {data.category || data.subCategory ? (
            <Text style={styles.pageEyebrow} numberOfLines={1}>
              {[data.category, data.subCategory].filter(Boolean).join(' · ')}
            </Text>
          ) : null}

          <Text style={styles.pageName}>{data.name || 'Product name'}</Text>

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
                {inStock ? `Available · ${stockN}` : 'Unavailable'}
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
                {!!feeDisplay && (
                  <View style={styles.shipFeeRow}>
                    <Text style={{ color: SECONDARY, fontSize: 13 }}>
                      Delivery
                    </Text>
                    <Text
                      style={{ color: TEXT, fontWeight: '600', fontSize: 14 }}
                    >
                      {feeDisplay}
                    </Text>
                  </View>
                )}
                {data.feeMode === 'on_delivery' &&
                !!data.deliveryNote?.trim() ? (
                  <Text
                    style={{
                      color: SECONDARY,
                      fontSize: 12,
                      marginTop: 8,
                      lineHeight: 17,
                    }}
                  >
                    {data.deliveryNote}
                  </Text>
                ) : null}
              </View>
            </>
          )}

          <Text style={styles.pageSection}>Sold by</Text>
          <View
            style={[
              styles.pageCard,
              { flexDirection: 'row', alignItems: 'center' },
            ]}
          >
            <View style={styles.storeIcon}>
              <Ionicons
                name="storefront-outline"
                size={16}
                color={SECONDARY}
              />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.shipLabel}>Visit storefront</Text>
              <Text
                style={{ color: TEXT, fontWeight: '700', fontSize: 14 }}
                numberOfLines={1}
              >
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
  }, [fade, scale])

  return (
    <View style={styles.successRoot}>
      <Animated.View
        style={{
          opacity: fade,
          transform: [{ scale }],
          alignItems: 'center',
          paddingHorizontal: 28,
          width: '100%',
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
        <Text style={styles.successTitle}>Product published</Text>
        <Text style={styles.successSub}>
          {name || 'Your product'} is live on Plazore.
        </Text>
        <TouchableOpacity
          onPress={onView}
          activeOpacity={0.9}
          style={{ width: '100%', marginTop: 28, overflow: 'hidden' }}
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
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { region, formatProduct } = useMarketplace()

  const maxImages = PLAN_IMAGE_LIMITS[CURRENT_PLAN] ?? 6
  const feePct = PLAN_FEES[CURRENT_PLAN] ?? 8

  const [overlay, setOverlay] = useState<OverlayState>(null)
  const [loading, setLoading] = useState(false)
  const [publishedId, setPublishedId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState('')

  const [images, setImages] = useState<string[]>([])

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('1')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [specs, setSpecs] = useState<Record<string, string>>({})
  const [documents, setDocuments] = useState<LocalDoc[]>([])

  const [fulfillCountryCode, setFulfillCountryCode] = useState('')
  const [fulfillStateCode, setFulfillStateCode] = useState('')
  const [fulfillCity, setFulfillCity] = useState('')
  const [feeMode, setFeeMode] = useState<
    'free' | 'fixed' | 'on_delivery' | null
  >(null)
  const [shippingMethod, setShippingMethod] = useState<
    'self' | 'courier' | null
  >(null)
  const [courierCompany, setCourierCompany] = useState('')
  const [deliveryFee, setDeliveryFee] = useState('')
  const [deliveryNote, setDeliveryNote] = useState('')

  const nameRef = useRef<TextInput>(null)
  const brandRef = useRef<TextInput>(null)
  const priceRef = useRef<TextInput>(null)
  const stockRef = useRef<TextInput>(null)
  const descRef = useRef<TextInput>(null)
  const courierRef = useRef<TextInput>(null)
  const feeRef = useRef<TextInput>(null)

  const toast = useCallback(
    (
      title: string,
      message?: string,
      tone: 'info' | 'success' | 'danger' = 'info',
    ) => {
      setOverlay({ title, message, tone })
    },
    [],
  )

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    ;(async () => {
      try {
        const token = await getToken()
        if (!token) return
        const res = await api.get('/seller/store', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.data?.success && res.data.data?.storeName) {
          setStoreName(res.data.data.storeName)
        }
      } catch {
        /* ignore */
      }
    })()
  }, [isLoaded, isSignedIn, getToken])

  const subCats = category ? PRODUCT_CATEGORIES[category] || [] : []
  const specFields = useMemo(() => getSpecFields(category), [category])
  const needsDocs = categoryNeedsDocs(category)
  const docTypes = useMemo(() => getDocTypes(category), [category])
  const fulfillStates = useMemo(
    () => getStatesForCountry(fulfillCountryCode),
    [fulfillCountryCode],
  )
  const fulfillCities = useMemo(
    () => getCitiesForState(fulfillCountryCode, fulfillStateCode),
    [fulfillCountryCode, fulfillStateCode],
  )

  const shipsFrom = useMemo(() => {
    if (!fulfillCountryCode || !fulfillCity) return null
    const c = FULFILLMENT_COUNTRIES.find((x) => x.code === fulfillCountryCode)
    return buildFulfillmentLocation({
      countryCode: fulfillCountryCode,
      country: c?.name || '',
      stateCode: fulfillStateCode,
      state:
        fulfillStates.find((s) => s.code === fulfillStateCode)?.name || '',
      city: fulfillCity,
    }).displayLabel
  }, [fulfillCountryCode, fulfillStateCode, fulfillCity, fulfillStates])

  const priceN = Number(price) || 0
  const stockN = Math.max(0, parseInt(stock || '0', 10) || 0)
  const feeN = Number(deliveryFee) || 0

  const formatPreviewPrice = useCallback(
    (n: number) => {
      try {
        return formatProduct(n, region as any)
      } catch {
        return String(n)
      }
    },
    [formatProduct, region],
  )

  const productPreviewData: ProductPreviewData = useMemo(
    () => ({
      name,
      brand,
      price: priceN,
      description,
      images,
      stock: stockN,
      category,
      subCategory,
      region: region || 'NG',
      storeName,
      shipsFrom,
      feeMode,
      shippingMethod,
      courierCompany,
      deliveryFee: feeMode === 'fixed' ? feeN : 0,
      deliveryNote,
      specifications: specs,
    }),
    [
      name,
      brand,
      priceN,
      description,
      images,
      stockN,
      category,
      subCategory,
      region,
      storeName,
      shipsFrom,
      feeMode,
      shippingMethod,
      courierCompany,
      feeN,
      deliveryNote,
      specs,
    ],
  )

  const pickImages = async () => {
    const remaining = maxImages - images.length
    if (remaining <= 0) {
      toast('Limit reached', `Max ${maxImages} images on your plan`, 'danger')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: remaining,
    })
    if (result.canceled || !result.assets?.length) return
    const uris = result.assets.map((a) => a.uri).filter(Boolean)
    setImages((prev) => [...prev, ...uris].slice(0, maxImages))
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const makeCover = (index: number) => {
    if (index <= 0) return
    setImages((prev) => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.unshift(item)
      return next
    })
  }

  const pickDocuments = async () => {
    if (documents.length >= 5) {
      toast('Limit', 'Max 5 documents', 'danger')
      return
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      multiple: true,
      copyToCacheDirectory: true,
    })
    if (result.canceled || !result.assets?.length) return
    setDocuments((prev) => {
      const next = [...prev]
      for (const a of result.assets) {
        if (next.length >= 5) break
        next.push({
          uri: a.uri,
          name: a.name || 'Document',
          type: docTypes[0]?.id || 'other',
          mimeType: a.mimeType,
        })
      }
      return next
    })
  }

  /** FIXED: uses `images` (not imageFiles) + free shipping skips method */
  const validate = () => {
    if (!images.length)
      return 'Add at least one product image (first one becomes the cover)'
    if (!name.trim()) return 'Product name is required'
    if (!priceN || priceN <= 0) return 'Enter a valid price'
    if (!category) return 'Select a category'
    if (!fulfillCountryCode || !fulfillCity) return 'Set fulfillment location'
    if (!feeMode) return 'Choose a delivery charge option'

    // Free delivery → no method / courier / fee required
    if (feeMode === 'free') return null

    if (!shippingMethod) return 'Choose self delivery or courier'
    if (shippingMethod === 'courier' && !courierCompany.trim())
      return 'Courier company is required'
    if (feeMode === 'fixed' && (!(feeN > 0) || deliveryFee === ''))
      return 'Enter a delivery fee greater than 0'

    return null
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) {
      toast('Check form', err, 'danger')
      return
    }
    try {
      setLoading(true)
      const token = await getToken()
      if (!token) throw new Error('Not signed in')

      const fd = new FormData()
      fd.append('name', name.trim())
      fd.append('brand', brand.trim())
      fd.append('price', String(priceN))
      fd.append('stock', String(stockN))
      fd.append('description', description.trim())
      fd.append('category', category)
      fd.append('subCategory', subCategory)
      fd.append('region', region || 'NG')
      fd.append('specifications', JSON.stringify(specs))

      // Free shipping payload — method never required by server
      const shippingPayload =
        feeMode === 'free'
          ? {
              feeMode: 'free' as const,
              method: 'self',
              courier: '',
              courierCompany: '',
              deliveryFee: 0,
              deliveryNote: '',
            }
          : {
              feeMode: feeMode as 'fixed' | 'on_delivery',
              method: shippingMethod,
              courier: courierCompany.trim(),
              courierCompany: courierCompany.trim(),
              deliveryFee: feeMode === 'fixed' ? feeN : 0,
              deliveryNote:
                feeMode === 'on_delivery' ? deliveryNote.trim() : '',
            }

      fd.append('shipping', JSON.stringify(shippingPayload))

      const country = FULFILLMENT_COUNTRIES.find(
        (c) => c.code === fulfillCountryCode,
      )
      fd.append(
        'fulfillmentLocation',
        JSON.stringify(
          buildFulfillmentLocation({
            countryCode: fulfillCountryCode,
            country: country?.name || '',
            stateCode: fulfillStateCode,
            state:
              fulfillStates.find((s) => s.code === fulfillStateCode)?.name ||
              '',
            city: fulfillCity,
          }),
        ),
      )

      for (let i = 0; i < images.length; i++) {
        const uri = images[i]
        const nameGuess = uri.split('/').pop() || `image_${i}.jpg`
        fd.append('images', {
          uri,
          name: nameGuess,
          type: 'image/jpeg',
        } as any)
      }

      documents.forEach((d, i) => {
        fd.append('documents', {
          uri: d.uri,
          name: d.name,
          type: d.mimeType || 'application/octet-stream',
        } as any)
        fd.append(`documentTypes[${i}]`, d.type)
        fd.append(`documentNames[${i}]`, d.name)
      })

      const res = await api.post('/seller/products', fd, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      if (res.data?.success) {
        const id =
          res.data.data?._id ||
          res.data.data?.id ||
          res.data.productId ||
          ''
        setPublishedId(String(id))
        toast('Published', 'Your product is live', 'success')
      } else {
        toast(
          'Error',
          res.data?.message || 'Could not publish product',
          'danger',
        )
      }
    } catch (e: any) {
      console.error(e)
      toast(
        'Error',
        e?.response?.data?.message ||
          e?.message ||
          'Could not publish product',
        'danger',
      )
    } finally {
      setLoading(false)
    }
  }

  if (!isLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: BG,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    )
  }

  if (!isSignedIn) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: BG,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 28,
        }}
      >
        <Text style={{ color: TEXT, fontWeight: '700', fontSize: 16 }}>
          Sign in to add products
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/(auth)/sign-in' as any)}
          style={{
            marginTop: 18,
            backgroundColor: TEXT,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: BG, fontWeight: '800', fontSize: 14 }}>
            Sign in
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (publishedId) {
    return (
      <PublishedScreen
        productId={publishedId}
        name={name}
        onView={() => router.replace(`/product/${publishedId}` as any)}
        onLater={() => router.replace('/seller/products' as any)}
      />
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TopOverlay state={overlay} onDismiss={() => setOverlay(null)} />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageKicker}>Seller lounge</Text>
        <Text style={styles.pageTitle}>Add product</Text>
        <Text style={styles.pageLead}>
          Listed in {region || 'NG'} marketplace · price locked to this region
        </Text>

        <Section
          step="01"
          title="Photos"
          subtitle={`First photo is the cover · up to ${maxImages}`}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {images.map((uri, i) => (
              <View key={`${uri}-${i}`} style={{ marginRight: 10 }}>
                <View
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 14,
                    overflow: 'hidden',
                    borderWidth: i === 0 ? 2 : StyleSheet.hairlineWidth,
                    borderColor: i === 0 ? GREEN : LINE,
                  }}
                >
                  <Image
                    source={{ uri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                  {i === 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        backgroundColor: GREEN,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      <Text
                        style={{
                          color: '#041412',
                          fontSize: 9,
                          fontWeight: '800',
                        }}
                      >
                        COVER
                      </Text>
                    </View>
                  )}
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    marginTop: 6,
                    gap: 6,
                  }}
                >
                  {i > 0 && (
                    <TouchableOpacity
                      onPress={() => makeCover(i)}
                      style={styles.iconCircle}
                    >
                      <Ionicons name="star-outline" size={14} color={TEXT} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => removeImage(i)}
                    style={styles.iconCircle}
                  >
                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {images.length < maxImages && (
              <TouchableOpacity onPress={pickImages} style={styles.addImage}>
                <Ionicons name="image-outline" size={22} color={MUTED} />
                <Text style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>
                  Add
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Section>

        <Section step="02" title="Basics">
          <Label onPress={() => nameRef.current?.focus()}>Name *</Label>
          <TextInput
            ref={nameRef}
            value={name}
            onChangeText={setName}
            placeholder="Product name"
            placeholderTextColor="#3D5268"
            style={styles.input}
          />

          <Label onPress={() => brandRef.current?.focus()}>Brand</Label>
          <TextInput
            ref={brandRef}
            value={brand}
            onChangeText={setBrand}
            placeholder="Brand (optional)"
            placeholderTextColor="#3D5268"
            style={styles.input}
          />

          <Label onPress={() => priceRef.current?.focus()}>
            Price * ({region || 'NG'})
          </Label>
          <TextInput
            ref={priceRef}
            value={price}
            onChangeText={(t) => setPrice(t.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            keyboardType="decimal-pad"
            placeholderTextColor="#3D5268"
            style={styles.input}
          />
          <Text style={styles.hint}>
            Locked to {region || 'NG'} marketplace. Buyers in other regions see
            the converted amount.
          </Text>

          <Label onPress={() => stockRef.current?.focus()}>Stock *</Label>
          <TextInput
            ref={stockRef}
            value={stock}
            onChangeText={(t) => setStock(t.replace(/[^0-9]/g, ''))}
            placeholder="1"
            keyboardType="number-pad"
            placeholderTextColor="#3D5268"
            style={styles.input}
          />

          <Label onPress={() => descRef.current?.focus()}>Description</Label>
          <TextInput
            ref={descRef}
            value={description}
            onChangeText={setDescription}
            placeholder="Tell buyers about this product"
            placeholderTextColor="#3D5268"
            style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
            multiline
          />
        </Section>

        <Section step="03" title="Category">
          <Label>Category *</Label>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 14 }}
          >
            {CATEGORY_LIST.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => {
                  setCategory(c)
                  setSubCategory('')
                  setSpecs({})
                }}
                style={[styles.pill, category === c && styles.pillOn]}
              >
                <Text
                  style={[
                    styles.pillText,
                    category === c && styles.pillTextOn,
                  ]}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {subCats.length > 0 && (
            <>
              <Label>Sub-category</Label>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 14 }}
              >
                {subCats.map((s: string) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSubCategory(s)}
                    style={[styles.pill, subCategory === s && styles.pillOn]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        subCategory === s && styles.pillTextOn,
                      ]}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {specFields.length > 0 && (
            <>
              <Label>Specifications</Label>
              {specFields.map((f: { key: string; label: string }) => (
                <View key={f.key}>
                  <Text
                    style={{
                      color: MUTED,
                      fontSize: 11,
                      marginBottom: 4,
                    }}
                  >
                    {f.label}
                  </Text>
                  <TextInput
                    value={specs[f.key] || ''}
                    onChangeText={(t) =>
                      setSpecs((prev) => ({ ...prev, [f.key]: t }))
                    }
                    placeholder={f.label}
                    placeholderTextColor="#3D5268"
                    style={styles.input}
                  />
                </View>
              ))}
            </>
          )}
        </Section>

        {needsDocs && (
          <Section
            step="04"
            title="Documents"
            subtitle="Required for this category"
          >
            {documents.map((doc, index) => (
              <View key={`${doc.uri}-${index}`} style={styles.docBox}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
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
                      setDocuments((prev) =>
                        prev.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 8 }}
                >
                  {docTypes.map((t: { id: string; label: string }) => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() =>
                        setDocuments((prev) =>
                          prev.map((d, i) =>
                            i === index ? { ...d, type: t.id } : d,
                          ),
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
              <TouchableOpacity
                onPress={pickDocuments}
                style={styles.dashedBtn}
              >
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
                      style={[
                        styles.pill,
                        fulfillCity === city && styles.pillOn,
                      ]}
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

        <Section
          step={needsDocs ? '06' : '05'}
          title="Delivery"
          subtitle="How buyers are charged for delivery"
        >
          <Label>Delivery charge *</Label>
          <View style={{ gap: 8, marginBottom: 14 }}>
            {(
              [
                { id: 'free' as const, label: 'Free delivery' },
                { id: 'fixed' as const, label: 'Fixed fee' },
                { id: 'on_delivery' as const, label: 'Pay on delivery' },
              ] as const
            ).map((opt) => {
              const active = feeMode === opt.id
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => {
                    setFeeMode(opt.id)
                    if (opt.id === 'free') {
                      setShippingMethod(null)
                      setCourierCompany('')
                      setDeliveryFee('')
                      setDeliveryNote('')
                    } else {
                      setDeliveryFee('')
                      if (opt.id !== 'on_delivery') setDeliveryNote('')
                    }
                  }}
                  style={[
                    styles.shipChoice,
                    active && styles.shipChoiceOn,
                    {
                      flex: undefined,
                      alignItems: 'flex-start',
                      paddingHorizontal: 14,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontWeight: '600',
                      fontSize: 13,
                      color: active ? TEXT : MUTED,
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {feeMode && feeMode !== 'free' ? (
            <>
              <Label>Way of delivering *</Label>
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

              {shippingMethod === 'courier' ? (
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
              ) : null}

              {feeMode === 'fixed' ? (
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
              ) : null}

              {feeMode === 'on_delivery' ? (
                <>
                  <Label>Note (optional)</Label>
                  <TextInput
                    value={deliveryNote}
                    onChangeText={setDeliveryNote}
                    placeholder="e.g. Cash or POS on arrival"
                    placeholderTextColor="#3D5268"
                    style={styles.input}
                  />
                  <Text style={styles.hint}>
                    Buyer pays delivery when the order arrives — not in
                    checkout total.
                  </Text>
                </>
              ) : null}
            </>
          ) : null}

          {feeMode === 'free' ? (
            <Text style={styles.hint}>
              No delivery charge. Checkout will show Free delivery.
            </Text>
          ) : null}
        </Section>

        <View style={{ marginBottom: 8, marginTop: 4 }}>
          <Text style={styles.pageKicker}>Live preview</Text>
          <Text style={styles.previewHead}>What buyers will see</Text>
          <Text style={styles.pageLead}>
            Prices shown in your {region || 'NG'} marketplace currency.
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
            Fee applies only to product price — never delivery. Region locked to{' '}
            {region || 'NG'}.
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
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