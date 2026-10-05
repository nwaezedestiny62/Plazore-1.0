/**
 * Plazore Seller Onboarding
 * Appears ONLY after successful seller registration.
 * Progress is persisted server-side.
 */

import api from '@/constants/api'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const { width: SCREEN_W } = Dimensions.get('window')

const BG = '#090B0F'
const SURFACE = 'rgba(17, 20, 26, 0.72)'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const TEXT = '#F5F7FA'
const TEXT_DIM = 'rgba(245, 247, 250, 0.72)'
const LINE = 'rgba(255, 255, 255, 0.08)'

/**
 * Static requires only — Metro resolves these at bundle time.
 * Put board1.png … board6.png in client/assets/
 */
/**
 * Swap these to board1.png … board6.png once the files are in client/assets/
 * Using logo-0.png so the app builds even before board assets are added.
 */
const LOGO = require('../../assets/logo-0.png')
const BOARD_IMAGES: Record<number, ImageSourcePropType> = {
  1: require('../../assets/board1.png'),
  2: require('../../assets/board2.png'),
  3: require('../../assets/board3.png'),
  4: require('../../assets/board4.png'),
  5: require('../../assets/board5.png'),
  6: require('../../assets/board6.png'),
}
// When board assets exist, replace with:
// 1: require('../../assets/board1.png'),
// 2: require('../../assets/board2.png'),
// etc.

type SlideKey = 'welcome' | 'how' | 'products' | 'orders' | 'earn' | 'presence'

type Slide = {
  key: SlideKey
  image: number
  kicker: string
  headline: string
  bodyKind: SlideKey
}

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    image: 1,
    kicker: 'Seller Lounge',
    headline: 'Welcome to Plazore.',
    bodyKind: 'welcome',
  },
  {
    key: 'how',
    image: 2,
    kicker: 'The journey',
    headline: 'Your products. A larger digital marketplace.',
    bodyKind: 'how',
  },
  {
    key: 'products',
    image: 3,
    kicker: 'Listings',
    headline: 'Presentation matters.',
    bodyKind: 'products',
  },
  {
    key: 'orders',
    image: 4,
    kicker: 'Fulfilment',
    headline: 'When a buyer orders, Plazore keeps the process structured.',
    bodyKind: 'orders',
  },
  {
    key: 'earn',
    image: 5,
    kicker: 'Economics',
    headline: 'Sell through Plazore. Earn from every completed order.',
    bodyKind: 'earn',
  },
  {
    key: 'presence',
    image: 6,
    kicker: 'Your store',
    headline: 'Your store is part of the Plazore experience.',
    bodyKind: 'presence',
  },
]

function SlideBody({ kind }: { kind: SlideKey }) {
  if (kind === 'welcome') {
    return (
      <>
        <Text style={styles.bodyText}>
          You are not simply listing products. You are building your presence
          inside a new kind of commerce platform.
        </Text>
        <Text style={[styles.bodyText, { marginTop: 12 }]}>
          Plazore connects sellers with buyers through discovery, intelligent
          product presentation, and a structured commerce experience.
        </Text>
      </>
    )
  }

  if (kind === 'how') {
    const steps = [
      'Create',
      'Present',
      'Get Discovered',
      'Receive Orders',
      'Fulfil',
      'Earn',
    ]
    return (
      <View style={styles.journey}>
        {steps.map((step, i) => (
          <View key={step} style={styles.journeyRow}>
            <View style={styles.journeyDot}>
              <Text style={styles.journeyNum}>{i + 1}</Text>
            </View>
            <Text style={styles.journeyLabel}>{step}</Text>
          </View>
        ))}
      </View>
    )
  }

  if (kind === 'products') {
    const bullets = [
      'Clear, high-quality product images of the exact item',
      'Avoid blurry, heavily edited or misleading images',
      'Clear product names and accurate descriptions',
      'Correct pricing, category and shipping details',
    ]
    return (
      <>
        <Text style={styles.bodyText}>
          Create listings that are clear, accurate and professionally presented.
        </Text>
        <View style={styles.bulletList}>
          {bullets.map((t) => (
            <View key={t} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{t}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.bodyText, { marginTop: 14, color: GREEN }]}>
          Better information creates better buyer confidence.
        </Text>
      </>
    )
  }

  if (kind === 'orders') {
    const flow = [
      'Buyer places order',
      'Seller receives order',
      'Seller updates order status via shipped',
      'Seller prepares order',
      'Seller fulfils via selected delivery method',
      'Seller updates order status via delivered',
      'Buyer confirms delivery/package',
      'Order is completed | Seller payout is released',
    ]
    return (
      <>
        <View style={styles.flowCard}>
          {flow.map((step, i) => (
            <View key={step} style={styles.flowRow}>
              <Text style={styles.flowIndex}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={styles.flowText}>{step}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.bodyText, { marginTop: 14 }]}>
          Keep your delivery method and fee accurate. You will receive the
          buyer delivery address and contact details needed to fulfil each
          order.
        </Text>
      </>
    )
  }

  if (kind === 'earn') {
    return (
      <>
        <View style={styles.econCard}>
          <Text style={styles.econFormula}>Product Price & Delivery Fee</Text>
          <Text style={styles.econEquals}>= Order Value</Text>
        </View>
        <Text style={[styles.bodyText, { marginTop: 16 }]}>
          Plazore applies an{' '}
          <Text style={{ color: GREEN, fontWeight: '600' }}>8% transaction fee</Text>{' '}
          to the product price only! Never the delivery fee, subject to the seller
          applicable subscription plan.
        </Text>
        <Text style={[styles.bodyText, { marginTop: 10 }]}>
          Paid seller subscriptions can significantly reduce the transaction fee
          and provide additional visibility according to your plan.
        </Text>
      </>
    )
  }

  const presenceBullets = [
    'Professional product presentation',
    'Accurate business information',
    'Consistent inventory',
    'Reliable fulfilment',
    'Responsible seller behaviour',
    'Strong customer experience',
  ]
  return (
    <>
      <Text style={styles.bodyText}>
        You are not merely uploading products — your listings contribute to your
        storefront and Plazore wider discovery experience.
      </Text>
      <View style={styles.bulletList}>
        {presenceBullets.map((t) => (
          <View key={t} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{t}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.bodyText, { marginTop: 16, fontWeight: '600', color: TEXT }]}>
        Build with consistency. Grow with Plazore.
      </Text>
    </>
  )
}

export default function SellerOnboarding() {
  const router = useRouter()
  const { getToken } = useAuth()
  const scrollRef = useRef<ScrollView>(null)
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x
      const i = Math.round(x / SCREEN_W)
      if (i !== index && i >= 0 && i < SLIDES.length) setIndex(i)
    },
    [index],
  )

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * SCREEN_W, animated: true })
    setIndex(i)
  }

  const finishOnboarding = async () => {
    setSaving(true)
    setError(null)
    try {
      const token = await getToken()
      const res = await api.post(
        '/seller/onboarding/complete',
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Could not save progress')
      }
      router.replace('/seller-onboarding/business-location' as any)
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Something went wrong. Please try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  const onContinue = () => {
    if (index < SLIDES.length - 1) {
      goTo(index + 1)
      return
    }
    void finishOnboarding()
  }

  const isLast = index === SLIDES.length - 1

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0A0E14', '#090B0F', '#061210']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.progressRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressSeg,
                i <= index && styles.progressSegActive,
                i === index && styles.progressSegCurrent,
              ]}
            />
          ))}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          scrollEventThrottle={16}
          bounces={false}
          style={styles.pager}
        >
          {SLIDES.map((s) => (
            <View key={s.key} style={[styles.page, { width: SCREEN_W }]}>
              <View style={styles.imageWrap}>
                <Image
                  source={BOARD_IMAGES[s.image]}
                  style={styles.image}
                  resizeMode="contain"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(9,11,15,0.4)', BG]}
                  locations={[0.5, 0.85, 1]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
              </View>

              <View style={styles.content}>
                <Text style={styles.kicker}>{s.kicker}</Text>
                <Text style={styles.headline}>{s.headline}</Text>
                <View style={styles.body}>
                  <SlideBody kind={s.bodyKind} />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#F87171" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          {index > 0 ? (
            <Pressable
              onPress={() => goTo(index - 1)}
              style={styles.backBtn}
              hitSlop={12}
              disabled={saving}
            >
              <Ionicons name="arrow-back" size={20} color={TEXT_DIM} />
              <Text style={styles.backLabel}>Back</Text>
            </Pressable>
          ) : (
            <View style={{ width: 72 }} />
          )}

          <Pressable
            onPress={onContinue}
            style={[styles.cta, saving && styles.ctaDisabled]}
            disabled={saving}
          >
            <LinearGradient
              colors={isLast ? [GREEN, '#00C060'] : [BLUE, '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGrad}
            >
              {saving ? (
                <ActivityIndicator color="#041008" />
              ) : (
                <>
                  <Text style={[styles.ctaText, isLast && styles.ctaTextDark]}>
                    {isLast ? 'Set Up My Business' : 'Continue'}
                  </Text>
                  <Ionicons
                    name={isLast ? 'storefront-outline' : 'arrow-forward'}
                    size={18}
                    color={isLast ? '#041008' : TEXT}
                  />
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  progressSeg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: LINE,
  },
  progressSegActive: { backgroundColor: 'rgba(0,229,117,0.35)' },
  progressSegCurrent: { backgroundColor: GREEN },
  pager: { flex: 1 },
  page: { flex: 1 },
  imageWrap: {
    height: SCREEN_W * 0.58,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '88%',
    height: '88%',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: GREEN,
    fontWeight: '600',
    marginBottom: 8,
  },
  headline: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  body: { flexShrink: 1 },
  bodyText: {
    fontSize: 15,
    lineHeight: 23,
    color: TEXT_DIM,
  },
  journey: { marginTop: 4 },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  journeyDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,229,117,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,117,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  journeyNum: { fontSize: 12, fontWeight: '700', color: GREEN },
  journeyLabel: { fontSize: 15, fontWeight: '500', color: TEXT, flex: 1 },
  bulletList: { marginTop: 14, gap: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BLUE,
    marginTop: 7,
  },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 21, color: TEXT_DIM },
  flowCard: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  flowIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: BLUE,
    fontVariant: ['tabular-nums'],
    width: 24,
  },
  flowText: { flex: 1, fontSize: 14, color: TEXT, fontWeight: '500' },
  econCard: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,229,117,0.2)',
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  econFormula: { fontSize: 15, color: TEXT_DIM, fontWeight: '500' },
  econEquals: {
    fontSize: 18,
    color: GREEN,
    fontWeight: '700',
    marginTop: 6,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 24,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
  },
  errorText: { flex: 1, fontSize: 13, color: '#FCA5A5' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    paddingTop: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  backLabel: { fontSize: 15, color: TEXT_DIM, fontWeight: '500' },
  cta: {
    borderRadius: 14,
    overflow: 'hidden',
    minWidth: 160,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  ctaText: { fontSize: 15, fontWeight: '700', color: TEXT },
  ctaTextDark: { color: '#041008' },
})
