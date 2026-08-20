import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Dimensions,
  Animated,
  Easing,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '@/constants/api'
import { useMarketplace } from '@/context/MarketplaceContext'

const WIN_W = Dimensions.get('window').width
const PREVIEW_W = Math.min(WIN_W - 40, 340)
const H_PAD = 16
const GAP = 10
const CARD_W = (PREVIEW_W - H_PAD * 2 - GAP) / 2
const ENTRANCE_H = Math.min(PREVIEW_W * 0.42, 150)
const FEATURED_H = PREVIEW_W * 0.72
const FEATURED_INTERVAL_MS = 7000
const PREVIEW_H = 560

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

/** Appearance-only form (payout + shipping kept internal so save never wipes them) */
type StoreForm = {
  storeName: string
  storeDescription: string
  businessGoal: string
  phone: string
  storeLogo: string
  storeBanner: string
  // internal — not shown on this screen
  bankName: string
  accountName: string
  accountNumber: string
  street: string
  city: string
  state: string
  zipCode: string
  country: string
  deliveryMethod: '' | 'courier' | 'self'
  courierCompany: string
}

const emptyForm: StoreForm = {
  storeName: '',
  storeDescription: '',
  businessGoal: '',
  phone: '',
  storeLogo: '',
  storeBanner: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  street: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  deliveryMethod: '',
  courierCompany: '',
}

type OverlayState = {
  title: string
  message?: string
  tone?: 'info' | 'success' | 'danger'
  durationMs?: number
} | null

function PlazoreOrb({ size = 110 }: { size?: number }) {
  const rotation = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [])
  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.4,
          borderColor: 'transparent',
          borderTopColor: GREEN,
          borderRightColor: BLUE,
          borderBottomColor: 'transparent',
          borderLeftColor: GREEN,
          transform: [{ rotate }],
        }}
      />
      <View
        style={{
          width: size * 0.51,
          height: size * 0.51,
          borderRadius: (size * 0.51) / 2,
          backgroundColor: 'rgba(0,229,117,0.1)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={require('@/assets/logo-1.png')}
          style={{ width: size * 0.29, height: size * 0.29 }}
          resizeMode="contain"
        />
      </View>
    </View>
  )
}

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
    timer.current = setTimeout(() => onDismiss(), state.durationMs ?? 3800)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state])

  if (!state) return null
  const accent =
    state.tone === 'danger'
      ? '#EF4444'
      : state.tone === 'success'
        ? GREEN
        : BLUE

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
        }}
      >
        <View style={{ width: 3, backgroundColor: accent }} />
        <View
          style={{
            flex: 1,
            padding: 12,
            flexDirection: 'row',
            gap: 10,
          }}
        >
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
          <Pressable onPress={onDismiss} hitSlop={12}>
            <Ionicons name="close" size={18} color={MUTED} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  )
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={18} color={GREEN} />
        </View>
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string
  value: string
  onChange: (t: string) => void
  placeholder?: string
  multiline?: boolean
  keyboardType?: any
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#3D5268"
        multiline={multiline}
        keyboardType={keyboardType}
        style={[
          styles.input,
          multiline ? { minHeight: 88, textAlignVertical: 'top' } : null,
        ]}
      />
    </View>
  )
}

function LiveStorefrontPreview({
  storeName,
  storeDescription,
  businessGoal,
  storeLogo,
  storeBanner,
  state,
  country,
  products,
  formatProduct,
}: {
  storeName: string
  storeDescription: string
  businessGoal: string
  storeLogo: string
  storeBanner: string
  state: string
  country: string
  products: any[]
  formatProduct: (n: number, region?: string) => string
}) {
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const [descExpanded, setDescExpanded] = useState(false)
  const [goalExpanded, setGoalExpanded] = useState(false)

  const door = useRef(new Animated.Value(0)).current
  const content = useRef(new Animated.Value(0)).current
  const identityLift = useRef(new Animated.Value(16)).current
  const featuredRef = useRef<ScrollView>(null)
  const featuredIndexRef = useRef(0)
  const userTouching = useRef(false)

  const locationLabel = [state, country].filter(Boolean).join(', ')
  const slideW = PREVIEW_W - H_PAD * 2
  const name = storeName.trim() || 'Your store name'
  const hasBanner = !!storeBanner.trim()
  const hasLogo = !!storeLogo.trim()

  useEffect(() => {
    door.setValue(0)
    content.setValue(0)
    identityLift.setValue(16)
    Animated.sequence([
      Animated.timing(door, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(content, {
          toValue: 1,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(identityLift, {
          toValue: 0,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start()
  }, [storeBanner, storeLogo, storeName])

  useEffect(() => {
    if (products.length <= 1) return
    const timer = setInterval(() => {
      if (userTouching.current) return
      const next = (featuredIndexRef.current + 1) % products.length
      featuredIndexRef.current = next
      setFeaturedIndex(next)
      featuredRef.current?.scrollTo({ x: next * slideW, animated: true })
    }, FEATURED_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [products.length, slideW])

  const onFeaturedScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x
      const idx = Math.round(x / slideW)
      const safe = Math.max(0, Math.min(idx, products.length - 1))
      featuredIndexRef.current = safe
      setFeaturedIndex(safe)
    },
    [products.length, slideW]
  )

  return (
    <View style={styles.previewShell}>
      <View style={styles.previewBezel}>
        <View style={styles.previewIsland} />

        <ScrollView
          style={styles.previewScroll}
          contentContainerStyle={styles.previewScrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          bounces={false}
        >
          <Animated.View style={{ opacity: door }}>
            <View style={{ height: ENTRANCE_H, backgroundColor: '#07080C' }}>
              {hasBanner ? (
                <Image
                  source={{ uri: storeBanner }}
                  style={{ width: PREVIEW_W, height: ENTRANCE_H }}
                  resizeMode="cover"
                />
              ) : (
                <LinearGradient
                  colors={['#0F172A', '#090B0F', '#111827']}
                  style={{ width: PREVIEW_W, height: ENTRANCE_H }}
                />
              )}
              <LinearGradient
                colors={[
                  'rgba(9,11,15,0.15)',
                  'transparent',
                  'rgba(9,11,15,0.85)',
                ]}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.previewBack}>
                <Ionicons name="chevron-back" size={16} color={TEXT} />
              </View>
            </View>
          </Animated.View>

          <Animated.View
            style={{
              opacity: content,
              transform: [{ translateY: identityLift }],
              marginTop: -28,
              paddingHorizontal: H_PAD,
            }}
          >
            <View style={styles.identityCard}>
              <LinearGradient
                colors={['rgba(17,20,26,0.98)', 'rgba(17,20,26,0.92)']}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.logoWrap}>
                  {hasLogo ? (
                    <Image
                      source={{ uri: storeLogo }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="storefront" size={22} color={MUTED} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.storeName} numberOfLines={2}>
                    {name}
                  </Text>
                  <Text style={styles.openLabel}>Explore this store</Text>
                  {!!locationLabel && (
                    <View style={styles.locationRow}>
                      <Ionicons
                        name="location-outline"
                        size={11}
                        color={MUTED}
                      />
                      <Text style={styles.locationText} numberOfLines={1}>
                        {locationLabel}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {!!storeDescription.trim() && (
                <View style={{ marginTop: 12 }}>
                  <Text
                    style={styles.desc}
                    numberOfLines={descExpanded ? undefined : 3}
                  >
                    {storeDescription}
                  </Text>
                  {storeDescription.length > 90 && (
                    <TouchableOpacity
                      onPress={() => setDescExpanded((v) => !v)}
                      style={{ marginTop: 4 }}
                    >
                      <Text style={styles.seeMore}>
                        {descExpanded ? 'See less' : 'See more'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {!!businessGoal.trim() && (
                <View style={styles.goalBox}>
                  <Text style={styles.goalLabel}>Our goal</Text>
                  <Text
                    style={styles.goalText}
                    numberOfLines={goalExpanded ? undefined : 2}
                  >
                    {businessGoal}
                  </Text>
                  {businessGoal.length > 70 && (
                    <TouchableOpacity
                      onPress={() => setGoalExpanded((v) => !v)}
                      style={{ marginTop: 4 }}
                    >
                      <Text style={styles.seeMore}>
                        {goalExpanded ? 'See less' : 'See more'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <View style={styles.actionRow}>
                <View style={styles.saveBtn}>
                  <Ionicons
                    name="bookmark-outline"
                    size={13}
                    color={TEXT}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={styles.saveBtnText}>Save store</Text>
                </View>
                <View style={styles.countPill}>
                  <Text style={styles.countText}>
                    {products.length} products
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {products.length > 0 && (
            <Animated.View style={{ opacity: content, marginTop: 22 }}>
              <View style={{ paddingHorizontal: H_PAD, marginBottom: 10 }}>
                <Text style={styles.sectionEyebrow}>Featured</Text>
                <Text style={styles.previewSectionTitle}>A closer look</Text>
              </View>
              <ScrollView
                ref={featuredRef}
                horizontal
                pagingEnabled
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                snapToInterval={slideW}
                disableIntervalMomentum
                contentContainerStyle={{ paddingHorizontal: H_PAD }}
                onScrollBeginDrag={() => {
                  userTouching.current = true
                }}
                onScrollEndDrag={() => {
                  userTouching.current = false
                }}
                onMomentumScrollEnd={onFeaturedScrollEnd}
                nestedScrollEnabled
              >
                {products.map((p) => {
                  const img = p.images?.[0]
                  return (
                    <View key={p._id || p.id} style={{ width: slideW }}>
                      <View style={styles.featuredCard}>
                        <View
                          style={{
                            height: FEATURED_H,
                            backgroundColor: SURFACE_2,
                          }}
                        >
                          {img ? (
                            <Image
                              source={{ uri: img }}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.noImg}>
                              <Ionicons
                                name="image-outline"
                                size={28}
                                color="#3A3F4A"
                              />
                            </View>
                          )}
                          <LinearGradient
                            colors={[
                              'transparent',
                              'rgba(9,11,15,0.55)',
                              'rgba(9,11,15,0.92)',
                            ]}
                            style={styles.featuredFade}
                          />
                          <View style={styles.featuredInfo}>
                            <Text
                              style={styles.featuredName}
                              numberOfLines={2}
                            >
                              {p.name}
                            </Text>
                            <Text style={styles.featuredPrice}>
                              {formatProduct(
                                Number(p.price) || 0,
                                p.region || country || 'NG'
                              )}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </ScrollView>
              {products.length > 1 && (
                <View style={styles.dotsRow}>
                  {products.map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: i === featuredIndex ? 14 : 5,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor:
                          i === featuredIndex
                            ? AI_GREEN
                            : 'rgba(255,255,255,0.2)',
                        marginHorizontal: 2,
                      }}
                    />
                  ))}
                </View>
              )}
            </Animated.View>
          )}

          <Animated.View
            style={{
              opacity: content,
              paddingHorizontal: H_PAD,
              marginTop: 26,
              marginBottom: 20,
            }}
          >
            <Text style={styles.sectionEyebrow}>THE STORE</Text>
            <Text style={styles.previewSectionTitle}>
              Explore the collection
            </Text>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ALL PRODUCTS</Text>
              <View style={styles.dividerLine} />
            </View>

            {products.length === 0 ? (
              <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                <Ionicons name="cube-outline" size={22} color={MUTED} />
                <Text
                  style={{
                    color: SECONDARY,
                    fontSize: 12,
                    textAlign: 'center',
                    marginTop: 10,
                    lineHeight: 18,
                  }}
                >
                  This storefront is still being set up.{'\n'}Products appear
                  here when you publish.
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {products.slice(0, 6).map((p) => {
                  const img = p.images?.[0]
                  return (
                    <View
                      key={p._id || p.id}
                      style={{ width: CARD_W, marginBottom: 12 }}
                    >
                      <View style={styles.gridCard}>
                        <View
                          style={{
                            height: CARD_W * 1.15,
                            backgroundColor: SURFACE_2,
                          }}
                        >
                          {img ? (
                            <Image
                              source={{ uri: img }}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.noImg}>
                              <Ionicons
                                name="image-outline"
                                size={18}
                                color="#3A3F4A"
                              />
                            </View>
                          )}
                        </View>
                        <View style={{ padding: 8 }}>
                          <Text style={styles.gridName} numberOfLines={2}>
                            {p.name}
                          </Text>
                          <Text style={styles.gridPrice}>
                            {formatProduct(
                              Number(p.price) || 0,
                              p.region || country || 'NG'
                            )}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </Animated.View>

          <View style={{ alignItems: 'center', paddingBottom: 16 }}>
            <View
              style={{
                width: 28,
                height: 2,
                borderRadius: 1,
                backgroundColor: LINE,
                marginBottom: 8,
              }}
            />
            <Text style={{ color: MUTED, fontSize: 9, letterSpacing: 1 }}>
              Plazore · Digital Mall
            </Text>
          </View>
        </ScrollView>

        <View style={styles.previewHome} />
      </View>
    </View>
  )
}

export default function MyStore() {
  const { getToken } = useAuth()
  const { formatProduct } = useMarketplace()
  const [form, setForm] = useState<StoreForm>(emptyForm)
  const [logoUri, setLogoUri] = useState<string | null>(null)
  const [bannerUri, setBannerUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [products, setProducts] = useState<any[]>([])
  const [overlay, setOverlay] = useState<OverlayState>(null)

  const setField = <K extends keyof StoreForm>(key: K, value: StoreForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const toast = useCallback(
    (
      title: string,
      message?: string,
      tone: 'info' | 'success' | 'danger' = 'info'
    ) => setOverlay({ title, message, tone, durationMs: 3800 }),
    []
  )

  const load = async () => {
    try {
      const token = await getToken()
      const [storeRes, prodRes] = await Promise.all([
        api.get('/seller/store', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api
          .get('/seller/products', {
            headers: { Authorization: `Bearer ${token}` },
          })
          .catch(() => null),
      ])

      if (storeRes.data.success) {
        const d = storeRes.data.data
        setForm({
          storeName: d.storeName || '',
          storeDescription: d.storeDescription || '',
          businessGoal: d.businessGoal || '',
          phone: d.phone || '',
          storeLogo: d.storeLogo || '',
          storeBanner: d.storeBanner || '',
          // kept internal — not shown here
          bankName: d.payout?.bankName || '',
          accountName: d.payout?.accountName || '',
          accountNumber: d.payout?.accountNumber || '',
          street: d.shippingDefaults?.address?.street || '',
          city: d.shippingDefaults?.address?.city || '',
          state: d.shippingDefaults?.address?.state || '',
          zipCode: d.shippingDefaults?.address?.zipCode || '',
          country: d.shippingDefaults?.address?.country || '',
          deliveryMethod: d.shippingDefaults?.deliveryMethod || '',
          courierCompany: d.shippingDefaults?.courierCompany || '',
        })
        setLogoUri(null)
        setBannerUri(null)
      }

      if (prodRes?.data?.success) {
        const list = Array.isArray(prodRes.data.data)
          ? prodRes.data.data
          : prodRes.data.data?.products || []
        setProducts(
          list.filter((p: any) => p.isActive !== false).slice(0, 12)
        )
      }
    } catch (e: any) {
      console.log(e.response?.data || e.message)
      toast('Error', 'Could not load store settings', 'danger')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      load()
    }, [])
  )

  const pickImage = async (kind: 'logo' | 'banner') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: kind === 'logo' ? [1, 1] : [16, 9],
    })
    if (!result.canceled && result.assets[0]) {
      if (kind === 'logo') setLogoUri(result.assets[0].uri)
      else setBannerUri(result.assets[0].uri)
    }
  }

  const handleSave = async () => {
    if (!form.storeName.trim()) {
      toast('Required', 'Business / store name is required', 'danger')
      return
    }
    try {
      setSaving(true)
      const token = await getToken()
      const formData = new FormData()

      formData.append('storeName', form.storeName.trim())
      formData.append('storeDescription', form.storeDescription.trim())
      formData.append('businessGoal', form.businessGoal.trim())
      formData.append('phone', form.phone.trim())

      // Preserve existing payout + shipping (not editable on this screen)
      formData.append(
        'payout',
        JSON.stringify({
          bankName: form.bankName.trim(),
          accountName: form.accountName.trim(),
          accountNumber: form.accountNumber.trim(),
        })
      )
      formData.append(
        'shippingDefaults',
        JSON.stringify({
          address: {
            street: form.street.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            zipCode: form.zipCode.trim(),
            country: form.country.trim(),
          },
          deliveryMethod: form.deliveryMethod,
          courierCompany: form.courierCompany.trim(),
        })
      )

      if (logoUri) {
        const filename = logoUri.split('/').pop() || 'logo.jpg'
        const match = /\.(\w+)$/.exec(filename)
        formData.append('storeLogo', {
          uri: logoUri,
          name: filename,
          type: match ? `image/${match[1]}` : 'image/jpeg',
        } as any)
      }
      if (bannerUri) {
        const filename = bannerUri.split('/').pop() || 'banner.jpg'
        const match = /\.(\w+)$/.exec(filename)
        formData.append('storeBanner', {
          uri: bannerUri,
          name: filename,
          type: match ? `image/${match[1]}` : 'image/jpeg',
        } as any)
      }

      const res = await api.put('/seller/store', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      if (res.data.success) {
        toast('Saved', 'Your store settings were updated', 'success')
        await load()
      }
    } catch (e: any) {
      console.log(e.response?.data || e.message)
      toast(
        'Error',
        e.response?.data?.message || 'Could not save store settings',
        'danger'
      )
    } finally {
      setSaving(false)
    }
  }

  const bannerSource = (bannerUri || form.storeBanner || '').trim()
  const logoSource = (logoUri || form.storeLogo || '').trim()

  if (loading) {
    return (
      <View style={styles.loaderRoot}>
        <PlazoreOrb size={110} />
      </View>
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              load()
            }}
            tintColor={GREEN}
          />
        }
      >
        <Text style={styles.kicker}>Seller Lounge</Text>
        <Text style={styles.title}>My Store</Text>
        <Text style={styles.lead}>
          Private management only. Buyers never see edit controls on the public
          storefront.
        </Text>

        <SectionCard
          icon="color-palette-outline"
          title="Store appearance"
          subtitle="Banner, logo, and identity shown to buyers"
        >
          <Text style={styles.label}>Banner</Text>
          <TouchableOpacity
            onPress={() => pickImage('banner')}
            activeOpacity={0.85}
            style={styles.bannerPick}
          >
            {bannerSource ? (
              <View style={{ flex: 1 }}>
                <Image
                  source={{ uri: bannerSource }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
                <View style={styles.changeChip}>
                  <Ionicons name="camera" size={12} color={GREEN} />
                  <Text
                    style={{
                      color: GREEN,
                      fontSize: 11,
                      fontWeight: '600',
                      marginLeft: 4,
                    }}
                  >
                    Change
                  </Text>
                </View>
              </View>
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="image-outline" size={22} color={MUTED} />
                <Text style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
                  Tap to upload banner
                </Text>
                <Text style={{ color: '#3D5268', fontSize: 11, marginTop: 2 }}>
                  16:9 recommended
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Logo</Text>
          <TouchableOpacity
            onPress={() => pickImage('logo')}
            activeOpacity={0.85}
            style={styles.logoPick}
          >
            {logoSource ? (
              <Image
                source={{ uri: logoSource }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <>
                <Ionicons name="camera-outline" size={22} color={MUTED} />
                <Text style={{ color: MUTED, fontSize: 10, marginTop: 4 }}>
                  Upload
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Field
            label="Business / Store Name *"
            value={form.storeName}
            onChange={(t) => setField('storeName', t)}
            placeholder="Your store name"
          />
          <Field
            label="About the store"
            value={form.storeDescription}
            onChange={(t) => setField('storeDescription', t)}
            placeholder="What you sell..."
            multiline
          />
          <Field
            label="Business Goal"
            value={form.businessGoal}
            onChange={(t) => setField('businessGoal', t)}
            placeholder="Where you're headed..."
            multiline
          />
          <Field
            label="Phone Number"
            value={form.phone}
            onChange={(t) => setField('phone', t)}
            placeholder="080..."
            keyboardType="phone-pad"
          />
        </SectionCard>

        <Text style={styles.kicker}>LIVE STOREFRONT</Text>
        <Text style={styles.previewHead}>
          This is how your store appears to buyers
        </Text>
        <Text style={styles.lead}>
          Changes appear here as you edit. Products are your active listings.
        </Text>

        <LiveStorefrontPreview
          storeName={form.storeName}
          storeDescription={form.storeDescription}
          businessGoal={form.businessGoal}
          storeLogo={logoSource}
          storeBanner={bannerSource}
          state={form.state}
          country={form.country}
          products={products}
          formatProduct={(n, r) => {
            try {
              return formatProduct(n, r as any)
            } catch {
              return String(n)
            }
          }}
        />

        <Text
          style={{
            color: MUTED,
            fontSize: 11,
            textAlign: 'center',
            marginBottom: 18,
            marginTop: 8,
          }}
        >
          Previewing your storefront · Scroll inside the phone to explore
        </Text>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.9}
          style={{ marginBottom: 12, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={[GREEN, BLUE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveCta}
          >
            {saving ? (
              <ActivityIndicator color="#041412" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#041412" />
                <Text style={styles.saveCtaText}>Save store settings</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  loaderRoot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: MUTED,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.5,
  },
  lead: {
    marginTop: 6,
    marginBottom: 16,
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
  sectionIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(0,229,117,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  },
  bannerPick: {
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0A121C',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    marginBottom: 16,
  },
  changeChip: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(9,11,15,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoPick: {
    width: 96,
    height: 96,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0A121C',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  saveCta: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveCtaText: {
    color: '#041412',
    fontWeight: '800',
    fontSize: 15,
  },

  previewShell: {
    alignItems: 'center',
    marginBottom: 4,
  },
  previewBezel: {
    width: PREVIEW_W + 14,
    height: PREVIEW_H,
    borderRadius: 32,
    backgroundColor: '#12141A',
    borderWidth: 2.5,
    borderColor: '#2C313A',
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 14,
  },
  previewScroll: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: 24,
    overflow: 'hidden',
  },
  previewScrollContent: {
    paddingBottom: 8,
  },
  previewIsland: {
    alignSelf: 'center',
    width: 64,
    height: 14,
    borderRadius: 8,
    backgroundColor: '#000',
    marginBottom: 6,
  },
  previewHome: {
    alignSelf: 'center',
    width: 80,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 6,
  },
  previewBack: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(9,11,15,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    overflow: 'hidden',
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeName: {
    color: TEXT,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: -0.3,
  },
  openLabel: {
    color: MUTED,
    fontSize: 10,
    marginTop: 3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 3,
  },
  locationText: { color: SECONDARY, fontSize: 11, flex: 1 },
  desc: { color: SECONDARY, fontSize: 12, lineHeight: 18 },
  goalBox: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  goalLabel: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  goalText: { color: TEXT, fontSize: 12, lineHeight: 17 },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
    alignItems: 'center',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  saveBtnText: { color: TEXT, fontWeight: '700', fontSize: 12 },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  countText: { color: SECONDARY, fontWeight: '600', fontSize: 11 },
  sectionEyebrow: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  previewSectionTitle: {
    color: TEXT,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  featuredCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: SURFACE,
  },
  featuredFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
  },
  featuredInfo: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  featuredName: {
    color: TEXT,
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 17,
  },
  featuredPrice: {
    color: TEXT,
    fontWeight: '800',
    fontSize: 15,
    marginTop: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
  },
  dividerText: {
    color: MUTED,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginHorizontal: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  gridName: {
    color: TEXT,
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 15,
  },
  gridPrice: {
    color: TEXT,
    fontWeight: '800',
    fontSize: 12,
    marginTop: 4,
  },
  noImg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeMore: {
    color: AI_GREEN,
    fontSize: 11,
    fontWeight: '600',
  },
})