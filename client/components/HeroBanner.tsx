/**
 * PlazoreHeroBanner — 5-slot carousel like web Mall.tsx
 * GET /content/hero (auth, personalized 1+4) + /content/hero/public (admin 2,3,5)
 * Rotation is ALWAYS 12s — never use server cycleMs (that value is a 30min cache TTL)
 */

import {
  HERO_SLIDES,
  type HeroSlide as StaticHeroSlide,
  resolveHeroSlides,
} from '@/constants/heroCampaigns'
import api from '@/constants/api'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  type ImageSourcePropType,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const SLOT_COUNT = 5
const HOLD_MS = 12000
const CROSSFADE_MS = 2800
const SWIPE_THRESH = 48
const TEXT_ENTER_MS = 900
const TEXT_EXIT_MS = 420
const KEN_BURNS_SCALE = 1.06

const EASE_CROSSFADE = Easing.bezier(0.4, 0.0, 0.2, 1.0)
const EASE_TEXT = Easing.bezier(0.25, 0.1, 0.25, 1.0)

const FILL = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
}

const WEB_ORIGIN = String(
  process.env.EXPO_PUBLIC_WEB_URL ||
    process.env.EXPO_PUBLIC_SITE_URL ||
    '',
).replace(/\/$/, '')

export type BannerSlide = {
  id: string
  position: number
  kicker: string
  headline: string
  subheadline: string
  ctaLabel: string
  ctaAction: string
  ctaTarget?: string
  media: { kind: 'image'; source: ImageSourcePropType }
}

type ApiHeroBanner = {
  position?: number
  controlType?: 'system' | 'admin'
  isActive?: boolean
  imageUrl?: string
  image?: string
  headline?: string
  subheadline?: string
  ctaLabel?: string
  ctaAction?: string
  ctaTarget?: string
  kicker?: string
  published?: ApiHeroBanner
  creative?: ApiHeroBanner
}

type Props = {
  slides?: BannerSlide[]
  token?: string | null
  region?: string
  sessionId?: string
  topChrome?: number
  onCtaPress?: (slide: BannerSlide) => void
  onScrollToShowroom?: () => void
  offlineOnly?: boolean
}

/** Fit copy to the phone width. Long text shrinks + wraps. Nothing is ellipsized. */
function copyMetrics(screenW: number) {
  const pad = screenW < 360 ? 16 : 20
  const maxW = Math.max(220, screenW - pad * 2)
  return { pad, maxW }
}

function kickerFit(text: string, maxW: number) {
  const n = (text || '').trim().length
  if (n > 42) return { fontSize: 8, lineHeight: 12, letterSpacing: 0.8, width: maxW }
  if (n > 28) return { fontSize: 9, lineHeight: 13, letterSpacing: 1.2, width: maxW }
  if (n > 18) return { fontSize: 9.5, lineHeight: 14, letterSpacing: 1.8, width: maxW }
  if (n > 12) return { fontSize: 10, lineHeight: 14, letterSpacing: 2.4, width: maxW }
  return { fontSize: 10, lineHeight: 14, letterSpacing: 3.2, width: maxW }
}

function headlineFit(text: string, maxW: number) {
  const t = (text || '').trim()
  const n = t.length
  const words = t.split(/\s+/).filter(Boolean).length
  if (n > 80 || words > 12)
    return { fontSize: 18, lineHeight: 24, letterSpacing: -0.2, width: maxW }
  if (n > 56 || words > 9)
    return { fontSize: 20, lineHeight: 26, letterSpacing: -0.25, width: maxW }
  if (n > 40 || words > 6)
    return { fontSize: 24, lineHeight: 30, letterSpacing: -0.3, width: maxW }
  if (n > 26)
    return { fontSize: 28, lineHeight: 34, letterSpacing: -0.3, width: maxW }
  return { fontSize: 32, lineHeight: 38, letterSpacing: -0.35, width: maxW }
}

function subFit(text: string, maxW: number) {
  const n = (text || '').trim().length
  if (n > 140) return { fontSize: 12, lineHeight: 17, width: maxW }
  if (n > 90) return { fontSize: 13, lineHeight: 18, width: maxW }
  if (n > 60) return { fontSize: 14, lineHeight: 20, width: maxW }
  return { fontSize: 15, lineHeight: 22, width: maxW }
}

function ctaFit(text: string) {
  const n = (text || '').trim().length
  if (n > 28) return { fontSize: 9, letterSpacing: 1.1, paddingHorizontal: 14 }
  if (n > 18) return { fontSize: 10, letterSpacing: 1.4, paddingHorizontal: 16 }
  return { fontSize: 11, letterSpacing: 2, paddingHorizontal: 22 }
}

function localSource(index: number): ImageSourcePropType | undefined {
  const n = HERO_SLIDES.length
  if (!n) return undefined
  return HERO_SLIDES[index % n]?.media?.source
}

function resolveImageSource(imageUrl: string, index: number): ImageSourcePropType {
  const url = String(imageUrl || '').trim()
  const fallback = localSource(index)
  if (/^https?:\/\//i.test(url)) return { uri: url }
  if (url.startsWith('/') && WEB_ORIGIN) return { uri: `${WEB_ORIGIN}${url}` }
  if (fallback) return fallback
  return { uri: url || 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }
}

function staticToBanner(s: StaticHeroSlide, index: number): BannerSlide {
  const pos = index + 1
  return {
    id: `static-${pos}`,
    position: pos,
    kicker: String((s as any).kicker || 'PLAZORE').toUpperCase(),
    headline: s.headline || 'Plazore',
    subheadline: s.subheadline || '',
    ctaLabel: s.ctaLabel || 'Explore',
    ctaAction: String((s as any).ctaAction || 'scroll_showroom'),
    ctaTarget: String((s as any).ctaTarget || ''),
    media: s.media,
  }
}

function flattenBanner(raw: any, index: number): ApiHeroBanner {
  const nested = raw?.published || raw?.creative || raw?.slot || {}
  return {
    position: Number(raw?.position ?? nested?.position ?? index + 1),
    controlType: raw?.controlType || nested?.controlType,
    isActive: raw?.isActive !== false && nested?.isActive !== false,
    imageUrl:
      raw?.imageUrl ||
      raw?.image ||
      nested?.imageUrl ||
      nested?.image ||
      '',
    headline: raw?.headline || nested?.headline || '',
    subheadline: raw?.subheadline || nested?.subheadline || '',
    ctaLabel: raw?.ctaLabel || nested?.ctaLabel || '',
    ctaAction: raw?.ctaAction || nested?.ctaAction || '',
    ctaTarget: raw?.ctaTarget || nested?.ctaTarget || '',
    kicker: raw?.kicker || nested?.kicker || '',
  }
}

function apiToBanner(raw: any, index: number): BannerSlide | null {
  const b = flattenBanner(raw, index)
  const pos = Math.min(SLOT_COUNT, Math.max(1, Number(b.position) || index + 1))
  const fallback = HERO_SLIDES[(pos - 1) % Math.max(HERO_SLIDES.length, 1)]
  const imageUrl = String(b.imageUrl || '').trim()
  const headline = String(b.headline || '').trim()

  if (b.isActive === false && !imageUrl && !headline) return null

  return {
    id: `slot-${pos}`,
    position: pos,
    kicker: String(b.kicker || 'PLAZORE').toUpperCase(),
    headline: headline || fallback?.headline || 'Plazore',
    subheadline: String(b.subheadline || '').trim() || fallback?.subheadline || '',
    ctaLabel: String(b.ctaLabel || '').trim() || fallback?.ctaLabel || 'Explore',
    ctaAction: String(b.ctaAction || 'scroll_showroom'),
    ctaTarget: String(b.ctaTarget || ''),
    media: {
      kind: 'image',
      source: resolveImageSource(imageUrl, pos - 1),
    },
  }
}

function fiveSlotDeck(remote: BannerSlide[], fallback: BannerSlide[]): BannerSlide[] {
  const byPos = new Map<number, BannerSlide>()
  remote.forEach((s) => {
    const pos = Math.min(SLOT_COUNT, Math.max(1, Number(s.position) || 1))
    byPos.set(pos, { ...s, position: pos, id: `slot-${pos}` })
  })

  const deck: BannerSlide[] = []
  for (let pos = 1; pos <= SLOT_COUNT; pos++) {
    const base = fallback[pos - 1] || fallback[(pos - 1) % Math.max(fallback.length, 1)]
    const slot = byPos.get(pos)
    if (slot) {
      deck.push({
        ...base,
        ...slot,
        id: `slot-${pos}`,
        position: pos,
        media: slot.media || base.media,
      })
    } else if (base) {
      deck.push({ ...base, id: `static-${pos}`, position: pos })
    }
  }
  return deck
}

function extractBanners(json: any): any[] {
  const bag = [
    json?.data?.banners,
    json?.data?.data?.banners,
    json?.data?.slots,
    json?.banners,
    json?.slots,
    json?.data,
    json,
  ]
  for (const c of bag) {
    if (Array.isArray(c) && c.length) return c
  }
  return []
}

async function fetchSlotList(opts: {
  path: string
  token?: string | null
  region?: string
  sessionId?: string
}): Promise<BannerSlide[]> {
  const params: Record<string, string> = {}
  if (opts.sessionId) params.sessionId = opts.sessionId
  if (opts.region) params.region = String(opts.region)

  const res = await api.get(opts.path, {
    params,
    headers: opts.token
      ? { Authorization: `Bearer ${opts.token}` }
      : undefined,
  })
  const json = res?.data ?? res
  return extractBanners(json)
    .map((b, i) => apiToBanner(b, i))
    .filter((x): x is BannerSlide => x != null)
}

async function loadHeroFromApi(opts: {
  token?: string | null
  region?: string
  sessionId?: string
}): Promise<BannerSlide[]> {
  const pub = await fetchSlotList({
    path: '/content/hero/public',
    region: opts.region,
    sessionId: opts.sessionId,
  }).catch(() => [] as BannerSlide[])

  let auth: BannerSlide[] = []
  if (opts.token) {
    auth = await fetchSlotList({
      path: '/content/hero',
      token: opts.token,
      region: opts.region,
      sessionId: opts.sessionId,
    }).catch(() => [] as BannerSlide[])
  }

  const merged = new Map<number, BannerSlide>()
  ;[...pub, ...auth].forEach((s) => merged.set(s.position, s))
  return Array.from(merged.values())
}

function KenBurnsImage({
  slide,
  width,
  height,
  isActive,
}: {
  slide: BannerSlide
  width: number
  height: number
  isActive: boolean
}) {
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    scale.stopAnimation()
    if (!isActive) {
      scale.setValue(1)
      return
    }
    Animated.timing(scale, {
      toValue: KEN_BURNS_SCALE,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start()
  }, [isActive, scale, slide.id])

  return (
    <View style={[styles.mediaClip, { width, height }]}>
      <Animated.View
        style={{
          position: 'absolute',
          top: -height * 0.03,
          left: -width * 0.03,
          width: width * 1.06,
          height: height * 1.06,
          transform: [{ scale }],
        }}
      >
        <Image
          source={slide.media.source}
          style={{ width: width * 1.06, height: height * 1.06 }}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  )
}

export default function HeroBanner({
  slides: slidesProp,
  token = null,
  region,
  sessionId,
  topChrome = 0,
  onCtaPress,
  onScrollToShowroom,
  offlineOnly = false,
}: Props) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width: winW, height: winH } = useWindowDimensions()

  const heroWidth = winW
  const heroHeight = Math.max(winH - topChrome, 480)
  const statusTop = Math.max(insets.top, Platform.OS === 'android' ? 24 : 20)
  const bottomPad = Math.max(insets.bottom, 12)
  const { pad, maxW } = copyMetrics(winW)

  const staticFallback = useMemo(
    () => resolveHeroSlides(HERO_SLIDES).map((s, i) => staticToBanner(s, i)),
    [],
  )

  const [slides, setSlides] = useState<BannerSlide[]>(() =>
    fiveSlotDeck(slidesProp || [], staticFallback),
  )
  const [current, setCurrent] = useState(0)
  const currentRef = useRef(0)
  const busyRef = useRef(false)
  const opacities = useRef(
    Array.from({ length: SLOT_COUNT }, (_, i) => new Animated.Value(i === 0 ? 1 : 0)),
  ).current
  const textOpacity = useRef(new Animated.Value(1)).current
  const textY = useRef(new Animated.Value(0)).current
  const slidesRef = useRef(slides)
  slidesRef.current = slides

  useEffect(() => {
    currentRef.current = current
  }, [current])

  useEffect(() => {
    if ((slidesProp && slidesProp.length > 0) || offlineOnly) {
      if (slidesProp?.length) setSlides(fiveSlotDeck(slidesProp, staticFallback))
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const remote = await loadHeroFromApi({ token, region, sessionId })
        if (cancelled) return
        setSlides(fiveSlotDeck(remote, staticFallback))
      } catch {
        if (!cancelled) setSlides(fiveSlotDeck([], staticFallback))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slidesProp, token, region, sessionId, offlineOnly, staticFallback])

  const goTo = useCallback(
    (raw: number) => {
      const deck = slidesRef.current
      if (busyRef.current || deck.length < 2) return
      const from = currentRef.current
      const target = ((raw % deck.length) + deck.length) % deck.length
      if (target === from) return
      if (!opacities[from] || !opacities[target]) return

      busyRef.current = true

      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: TEXT_EXIT_MS,
          easing: EASE_CROSSFADE,
          useNativeDriver: true,
        }),
        Animated.timing(textY, {
          toValue: 10,
          duration: TEXT_EXIT_MS,
          easing: EASE_CROSSFADE,
          useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.parallel([
          Animated.timing(opacities[from], {
            toValue: 0,
            duration: CROSSFADE_MS,
            easing: EASE_CROSSFADE,
            useNativeDriver: true,
          }),
          Animated.timing(opacities[target], {
            toValue: 1,
            duration: CROSSFADE_MS,
            easing: EASE_CROSSFADE,
            useNativeDriver: true,
          }),
        ]).start(() => {
          opacities.forEach((v, i) => v.setValue(i === target ? 1 : 0))
          currentRef.current = target
          setCurrent(target)
          textY.setValue(12)
          textOpacity.setValue(0)
          Animated.parallel([
            Animated.timing(textOpacity, {
              toValue: 1,
              duration: TEXT_ENTER_MS,
              easing: EASE_TEXT,
              useNativeDriver: true,
            }),
            Animated.timing(textY, {
              toValue: 0,
              duration: TEXT_ENTER_MS,
              easing: EASE_TEXT,
              useNativeDriver: true,
            }),
          ]).start(() => {
            busyRef.current = false
          })
        })
      })
    },
    [opacities, textOpacity, textY],
  )

  const goToRef = useRef(goTo)
  goToRef.current = goTo

  useEffect(() => {
    if (slides.length < 2) return
    const t = setInterval(() => {
      goToRef.current(currentRef.current + 1)
    }, HOLD_MS)
    return () => clearInterval(t)
  }, [slides.length])

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -SWIPE_THRESH) goToRef.current(currentRef.current + 1)
        else if (g.dx >= SWIPE_THRESH) goToRef.current(currentRef.current - 1)
      },
    }),
  ).current

  const copy = slides[current] || slides[0]
  if (!copy) return null

  const handleCta = () => {
    if (onCtaPress) {
      onCtaPress(copy)
      return
    }
    const action = (copy.ctaAction || 'scroll_showroom').toLowerCase()
    const target = (copy.ctaTarget || '').trim()
    switch (action) {
      case 'store':
      case 'storefront':
        if (target) router.push(`/store/${target}`)
        else onScrollToShowroom?.()
        break
      case 'product':
        if (target) router.push(`/product/${target}`)
        else onScrollToShowroom?.()
        break
      case 'category':
        if (target) router.push(`/browse?category=${encodeURIComponent(target)}`)
        else onScrollToShowroom?.()
        break
      case 'url':
        if (target.startsWith('http')) Linking.openURL(target).catch(() => {})
        else onScrollToShowroom?.()
        break
      default:
        onScrollToShowroom?.()
    }
  }

  const kStyle = kickerFit(copy.kicker || '', maxW)
  const hStyle = headlineFit(copy.headline || '', maxW)
  const sStyle = subFit(copy.subheadline || '', maxW)
  const cStyle = ctaFit(copy.ctaLabel || '')

  return (
    <View
      style={{
        width: heroWidth,
        height: heroHeight,
        backgroundColor: '#090B0F',
        overflow: 'hidden',
      }}
      {...pan.panHandlers}
    >
      {slides.map((slide, i) => (
        <Animated.View
          key={slide.id}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: heroWidth,
            height: heroHeight,
            opacity: opacities[i] ?? 0,
          }}
        >
          <KenBurnsImage
            slide={slide}
            width={heroWidth}
            height={heroHeight}
            isActive={i === current}
          />
        </Animated.View>
      ))}

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.12)', 'transparent']}
        locations={[0, 0.5, 1]}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: statusTop + 48,
          zIndex: 2,
        }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(9,11,15,0.55)', 'rgba(9,11,15,0.15)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={FILL}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(9,11,15,0.55)', 'rgba(9,11,15,0.96)']}
        locations={[0.28, 0.62, 1]}
        style={FILL}
      />

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.copyBlock,
          {
            paddingHorizontal: pad,
            paddingTop: statusTop + 56,
            paddingBottom: bottomPad + 78,
            opacity: textOpacity,
            transform: [{ translateY: textY }],
          },
        ]}
      >
        <Text
          style={[styles.kicker, kStyle]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {copy.kicker}
        </Text>

        <Text
          style={[styles.headline, hStyle]}
          numberOfLines={4}
          adjustsFontSizeToFit
          minimumFontScale={0.62}
        >
          {copy.headline}
        </Text>

        {!!copy.subheadline && (
          <Text
            style={[styles.sub, sStyle]}
            numberOfLines={5}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {copy.subheadline}
          </Text>
        )}

        <Pressable
          onPress={handleCta}
          style={({ pressed }) => [
            styles.cta,
            { paddingHorizontal: cStyle.paddingHorizontal, maxWidth: maxW },
            pressed && styles.ctaPressed,
          ]}
        >
          <Text
            style={[
              styles.ctaText,
              { fontSize: cStyle.fontSize, letterSpacing: cStyle.letterSpacing },
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {copy.ctaLabel}
          </Text>
        </Pressable>

        <View style={styles.dotsRow}>
          {slides.map((_, i) => (
            <Pressable
              key={`dot-${i}`}
              onPress={() => goTo(i)}
              hitSlop={12}
              style={[styles.dot, i === current ? styles.dotActive : styles.dotIdle]}
            />
          ))}
        </View>
      </Animated.View>

      <View
        pointerEvents="box-none"
        style={[styles.arrowBar, { paddingBottom: bottomPad + 8 }]}
      >
        <Pressable onPress={onScrollToShowroom} hitSlop={20} style={styles.arrowHit}>
          <Text style={styles.arrowLabel}>SHOWROOM</Text>
          <Ionicons name="chevron-down" size={24} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  mediaClip: { overflow: 'hidden', backgroundColor: '#090B0F' },
  copyBlock: {
    ...FILL,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    zIndex: 3,
  },
  kicker: {
    fontFamily: 'Poppins_600SemiBold',
    color: 'rgba(0,229,117,0.9)',
    marginBottom: 10,
    flexShrink: 1,
  },
  headline: {
    fontFamily: 'Poppins_600SemiBold',
    color: '#FFFFFF',
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    flexShrink: 1,
  },
  sub: {
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 18,
    flexShrink: 1,
  },
  cta: {
    paddingVertical: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'transparent',
    alignSelf: 'flex-start',
  },
  ctaPressed: {
    opacity: 0.85,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.55)',
  },
  ctaText: {
    fontFamily: 'Poppins_600SemiBold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 18,
  },
  dot: { height: 4, borderRadius: 2 },
  dotActive: { width: 20, backgroundColor: 'rgba(255,255,255,0.9)' },
  dotIdle: { width: 6, backgroundColor: 'rgba(255,255,255,0.25)' },
  arrowBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  arrowHit: { alignItems: 'center', gap: 2 },
  arrowLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 9,
    letterSpacing: 2.8,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
  },
})