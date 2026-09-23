/**
 * PlazoreHeroBanner — 5-slot carousel (web Mall parity)
 * GET /content/hero + /content/hero/public
 * Rotation ALWAYS 12s. Images never blank. Text is dual-phase + staggered.
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
const HOLD_MS = 12_000
const CROSSFADE_MS = 3_200
const TEXT_EXIT_MS = 720
const TEXT_ENTER_MS = 1_150
const TEXT_STAGGER = 95
const SWIPE_THRESH = 48
const KEN_BURNS_SCALE = 1.07

const EASE_CROSSFADE = Easing.bezier(0.33, 0, 0.2, 1)
const EASE_TEXT = Easing.bezier(0.22, 1, 0.36, 1)

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
  remoteUrl?: string
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

function isUsableRemoteUrl(url: string): boolean {
  const u = String(url || '').trim()
  if (!u) return false
  if (u.startsWith('data:image/gif')) return false
  if (u === 'null' || u === 'undefined' || u === 'None') return false
  if (/^https?:\/\//i.test(u)) return true
  if (u.startsWith('/') && WEB_ORIGIN) return true
  return false
}

function toAbsoluteUrl(url: string): string {
  const u = String(url || '').trim()
  if (/^https?:\/\//i.test(u)) return u
  if (u.startsWith('/') && WEB_ORIGIN) return `${WEB_ORIGIN}${u}`
  return u
}

function resolveImageSource(
  imageUrl: string,
  index: number,
): { source: ImageSourcePropType; remoteUrl?: string } {
  const fallback = localSource(index)
  const url = String(imageUrl || '').trim()

  if (isUsableRemoteUrl(url)) {
    const absolute = toAbsoluteUrl(url)
    return { source: { uri: absolute }, remoteUrl: absolute }
  }

  if (fallback) return { source: fallback }
  return {
    source: { uri: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
  }
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
  const nested =
    raw?.published ||
    raw?.creative ||
    raw?.slot ||
    raw?.banner ||
    raw?.data ||
    {}

  const imageUrl =
    raw?.imageUrl ||
    raw?.image ||
    raw?.mediaUrl ||
    raw?.url ||
    nested?.imageUrl ||
    nested?.image ||
    nested?.mediaUrl ||
    nested?.url ||
    ''

  return {
    position: Number(raw?.position ?? nested?.position ?? index + 1),
    controlType: raw?.controlType || nested?.controlType,
    isActive: raw?.isActive !== false && nested?.isActive !== false,
    imageUrl: String(imageUrl || '').trim(),
    headline: String(raw?.headline || nested?.headline || '').trim(),
    subheadline: String(raw?.subheadline || nested?.subheadline || '').trim(),
    ctaLabel: String(raw?.ctaLabel || nested?.ctaLabel || '').trim(),
    ctaAction: String(raw?.ctaAction || nested?.ctaAction || '').trim(),
    ctaTarget: String(raw?.ctaTarget || nested?.ctaTarget || '').trim(),
    kicker: String(raw?.kicker || nested?.kicker || '').trim(),
  }
}

function apiToBanner(raw: any, index: number): BannerSlide | null {
  const b = flattenBanner(raw, index)
  const pos = Math.min(SLOT_COUNT, Math.max(1, Number(b.position) || index + 1))
  const fallback = HERO_SLIDES[(pos - 1) % Math.max(HERO_SLIDES.length, 1)]
  const imageUrl = String(b.imageUrl || '').trim()
  const headline = String(b.headline || '').trim()

  if (b.isActive === false && !imageUrl && !headline) return null

  const resolved = resolveImageSource(imageUrl, pos - 1)

  return {
    id: `slot-${pos}`,
    position: pos,
    kicker: String(b.kicker || 'PLAZORE').toUpperCase(),
    headline: headline || fallback?.headline || 'Plazore',
    subheadline:
      String(b.subheadline || '').trim() || fallback?.subheadline || '',
    ctaLabel: String(b.ctaLabel || '').trim() || fallback?.ctaLabel || 'Explore',
    ctaAction: String(b.ctaAction || 'scroll_showroom'),
    ctaTarget: String(b.ctaTarget || ''),
    media: { kind: 'image', source: resolved.source },
    remoteUrl: resolved.remoteUrl,
  }
}

function fiveSlotDeck(
  remote: BannerSlide[],
  fallback: BannerSlide[],
): BannerSlide[] {
  const byPos = new Map<number, BannerSlide>()
  remote.forEach((s) => {
    const pos = Math.min(SLOT_COUNT, Math.max(1, Number(s.position) || 1))
    byPos.set(pos, { ...s, position: pos, id: `slot-${pos}` })
  })

  const deck: BannerSlide[] = []
  for (let pos = 1; pos <= SLOT_COUNT; pos++) {
    const base =
      fallback[pos - 1] ||
      fallback[(pos - 1) % Math.max(fallback.length, 1)]
    const slot = byPos.get(pos)

    if (slot) {
      const hasRemote =
        !!slot.remoteUrl ||
        (typeof slot.media?.source === 'object' &&
          'uri' in (slot.media.source as object) &&
          isUsableRemoteUrl(
            String((slot.media.source as { uri?: string }).uri || ''),
          ))

      deck.push({
        ...base,
        ...slot,
        id: `slot-${pos}`,
        position: pos,
        media: hasRemote ? slot.media : base?.media || slot.media,
        remoteUrl: hasRemote ? slot.remoteUrl : undefined,
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
    timeout: 12_000,
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

function prefetchDeck(slides: BannerSlide[]) {
  slides.forEach((s) => {
    const uri =
      s.remoteUrl ||
      (typeof s.media?.source === 'object' &&
      s.media.source &&
      'uri' in s.media.source
        ? String((s.media.source as { uri?: string }).uri || '')
        : '')
    if (uri && /^https?:\/\//i.test(uri)) {
      Image.prefetch(uri).catch(() => {})
    }
  })
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
  const indexHint = Math.max(0, (slide.position || 1) - 1)
  const local = localSource(indexHint)

  const [remoteOk, setRemoteOk] = useState(true)
  const [source, setSource] = useState<ImageSourcePropType>(slide.media.source)

  useEffect(() => {
    setSource(slide.media.source)
    setRemoteOk(true)
  }, [slide.id, slide.media.source])

  useEffect(() => {
    scale.stopAnimation()
    if (!isActive) {
      scale.setValue(1)
      return
    }
    scale.setValue(1)
    Animated.timing(scale, {
      toValue: KEN_BURNS_SCALE,
      duration: HOLD_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start()
  }, [isActive, scale, slide.id])

  const showRemote =
    remoteOk &&
    typeof source === 'object' &&
    source &&
    'uri' in source &&
    isUsableRemoteUrl(String((source as { uri?: string }).uri || ''))

  return (
    <View style={[styles.mediaClip, { width, height }]}>
      {local ? (
        <Image
          source={local}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          resizeMode="cover"
        />
      ) : null}

      <Animated.View
        style={{
          position: 'absolute',
          top: -height * 0.03,
          left: -width * 0.03,
          width: width * 1.06,
          height: height * 1.06,
          transform: [{ scale }],
          opacity: showRemote || !local ? 1 : 0,
        }}
      >
        <Image
          source={source}
          style={{ width: width * 1.06, height: height * 1.06 }}
          resizeMode="cover"
          onError={() => {
            setRemoteOk(false)
            if (local) setSource(local)
          }}
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
    Array.from({ length: SLOT_COUNT }, (_, i) =>
      new Animated.Value(i === 0 ? 1 : 0),
    ),
  ).current

  const kickerOp = useRef(new Animated.Value(1)).current
  const headOp = useRef(new Animated.Value(1)).current
  const subOp = useRef(new Animated.Value(1)).current
  const ctaOp = useRef(new Animated.Value(1)).current
  const kickerY = useRef(new Animated.Value(0)).current
  const headY = useRef(new Animated.Value(0)).current
  const subY = useRef(new Animated.Value(0)).current
  const ctaY = useRef(new Animated.Value(0)).current

  const slidesRef = useRef(slides)
  slidesRef.current = slides

  useEffect(() => {
    currentRef.current = current
  }, [current])

  useEffect(() => {
    if ((slidesProp && slidesProp.length > 0) || offlineOnly) {
      if (slidesProp?.length) {
        const deck = fiveSlotDeck(slidesProp, staticFallback)
        setSlides(deck)
        prefetchDeck(deck)
      }
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const remote = await loadHeroFromApi({ token, region, sessionId })
        if (cancelled) return
        const deck = fiveSlotDeck(remote, staticFallback)
        setSlides(deck)
        prefetchDeck(deck)
      } catch {
        if (!cancelled) setSlides(fiveSlotDeck([], staticFallback))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slidesProp, token, region, sessionId, offlineOnly, staticFallback])

  useEffect(() => {
    prefetchDeck(slides)
  }, [slides])

  const goTo = useCallback(
    (raw: number) => {
      const deck = slidesRef.current
      if (busyRef.current || deck.length < 2) return
      const from = currentRef.current
      const target = ((raw % deck.length) + deck.length) % deck.length
      if (target === from) return
      if (!opacities[from] || !opacities[target]) return

      busyRef.current = true

      const linesOp = [kickerOp, headOp, subOp, ctaOp]
      const linesY = [kickerY, headY, subY, ctaY]

      // 1) Text fully out
      Animated.parallel([
        ...linesOp.map((v) =>
          Animated.timing(v, {
            toValue: 0,
            duration: TEXT_EXIT_MS,
            easing: EASE_TEXT,
            useNativeDriver: true,
          }),
        ),
        ...linesY.map((v) =>
          Animated.timing(v, {
            toValue: 14,
            duration: TEXT_EXIT_MS,
            easing: EASE_TEXT,
            useNativeDriver: true,
          }),
        ),
      ]).start(() => {
        // 2) Swap content only after text is gone
        currentRef.current = target
        setCurrent(target)

        // 3) Image crossfade
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
        ]).start()

        // 4) Text in, staggered
        linesY.forEach((v) => v.setValue(16))
        linesOp.forEach((v) => v.setValue(0))

        Animated.parallel(
          linesOp
            .map((v, i) =>
              Animated.timing(v, {
                toValue: 1,
                duration: TEXT_ENTER_MS,
                delay: i * TEXT_STAGGER,
                easing: EASE_TEXT,
                useNativeDriver: true,
              }),
            )
            .concat(
              linesY.map((v, i) =>
                Animated.timing(v, {
                  toValue: 0,
                  duration: TEXT_ENTER_MS,
                  delay: i * TEXT_STAGGER,
                  easing: EASE_TEXT,
                  useNativeDriver: true,
                }),
              ),
            ),
        ).start(({ finished }) => {
          if (finished) {
            opacities.forEach((v, i) => v.setValue(i === target ? 1 : 0))
          }
          busyRef.current = false
        })
      })
    },
    [
      opacities,
      kickerOp,
      headOp,
      subOp,
      ctaOp,
      kickerY,
      headY,
      subY,
      ctaY,
    ],
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

    const action = String(copy.ctaAction || 'scroll_showroom')
      .toLowerCase()
      .trim()
    let target = String(copy.ctaTarget || '').trim()

    if (!target && (action.startsWith('/') || action.startsWith('http'))) {
      target = action
    }

    if (
      target.startsWith('http://') ||
      target.startsWith('https://') ||
      action === 'url' ||
      action === 'external'
    ) {
      if (target.startsWith('http')) Linking.openURL(target).catch(() => {})
      else onScrollToShowroom?.()
      return
    }

    if (target.startsWith('/')) {
      let path = target
      if (path.startsWith('/browse')) path = path.replace(/^\/browse/, '/search')
      else if (path.startsWith('/shop')) path = path.replace(/^\/shop/, '/search')
      try {
        router.push(path as any)
      } catch {
        onScrollToShowroom?.()
      }
      return
    }

    switch (action) {
      case 'store':
      case 'storefront':
      case 'seller':
        if (target) router.push(`/store/${target}` as any)
        else onScrollToShowroom?.()
        break
      case 'product':
        if (target) router.push(`/product/${target}` as any)
        else onScrollToShowroom?.()
        break
      case 'category':
      case 'search':
      case 'browse':
        if (target) {
          router.push({
            pathname: '/search',
            params: { category: target, q: target },
          } as any)
        } else {
          router.push('/search' as any)
        }
        break
      default:
        onScrollToShowroom?.()
        break
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

      <View
        pointerEvents="box-none"
        style={[
          styles.copyBlock,
          {
            paddingHorizontal: pad,
            paddingTop: statusTop + 56,
            paddingBottom: bottomPad + 78,
          },
        ]}
      >
        <Animated.Text
          style={[
            styles.kicker,
            kStyle,
            { opacity: kickerOp, transform: [{ translateY: kickerY }] },
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {copy.kicker}
        </Animated.Text>

        <Animated.Text
          style={[
            styles.headline,
            hStyle,
            { opacity: headOp, transform: [{ translateY: headY }] },
          ]}
          numberOfLines={4}
          adjustsFontSizeToFit
          minimumFontScale={0.62}
        >
          {copy.headline}
        </Animated.Text>

        {!!copy.subheadline && (
          <Animated.Text
            style={[
              styles.sub,
              sStyle,
              { opacity: subOp, transform: [{ translateY: subY }] },
            ]}
            numberOfLines={5}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {copy.subheadline}
          </Animated.Text>
        )}

        <Animated.View
          style={{ opacity: ctaOp, transform: [{ translateY: ctaY }] }}
        >
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
                {
                  fontSize: cStyle.fontSize,
                  letterSpacing: cStyle.letterSpacing,
                },
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {copy.ctaLabel}
            </Text>
          </Pressable>
        </Animated.View>

        <View style={styles.dotsRow}>
          {slides.map((_, i) => (
            <Pressable
              key={`dot-${i}`}
              onPress={() => goTo(i)}
              hitSlop={12}
              style={[
                styles.dot,
                i === current ? styles.dotActive : styles.dotIdle,
              ]}
            />
          ))}
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.arrowBar, { paddingBottom: bottomPad + 8 }]}
      >
        <Pressable
          onPress={onScrollToShowroom}
          hitSlop={20}
          style={styles.arrowHit}
        >
          <Text style={styles.arrowLabel}>SHOWROOM</Text>
          <Ionicons
            name="chevron-down"
            size={24}
            color="rgba(255,255,255,0.5)"
          />
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