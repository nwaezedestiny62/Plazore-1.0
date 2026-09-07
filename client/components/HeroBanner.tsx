/**
 * PlazoreHeroBanner — window-sized hero, adaptive copy, no expo-av
 * Bottom-left copy, outline CTA, down arrow to showroom
 */

import {
  HERO_SLIDES,
  HeroSlide,
  resolveHeroSlides,
} from '@/constants/heroCampaigns'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const HOLD_MS = 11000
const CROSSFADE_MS = 3200
const SWIPE_THRESH = 52
const TEXT_ENTER_MS = 900
const TEXT_EXIT_MS = 500

const EASE_CROSSFADE = Easing.bezier(0.4, 0.0, 0.2, 1.0)
const EASE_TEXT = Easing.bezier(0.25, 0.1, 0.25, 1.0)

const FILL = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
}

type Props = {
  slides?: HeroSlide[]
  topChrome?: number
  onCtaPress?: (slide: HeroSlide) => void
  onScrollToShowroom?: () => void
}

function headlineStyle(text: string) {
  const n = (text || '').trim().length
  if (n > 52) return { fontSize: 22, lineHeight: 28, maxWidth: 300 }
  if (n > 38) return { fontSize: 26, lineHeight: 32, maxWidth: 320 }
  if (n > 26) return { fontSize: 30, lineHeight: 36, maxWidth: 330 }
  return { fontSize: 34, lineHeight: 40, maxWidth: 340 }
}

function subStyle(text: string) {
  const n = (text || '').trim().length
  if (n > 90) return { fontSize: 13, lineHeight: 18, maxWidth: 280 }
  if (n > 60) return { fontSize: 14, lineHeight: 20, maxWidth: 300 }
  return { fontSize: 15, lineHeight: 22, maxWidth: 320 }
}

function prefetchHeroImages(slides: HeroSlide[]) {
  slides.forEach((s) => {
    const src = s.media.source as { uri?: string }
    if (src?.uri) Image.prefetch(src.uri).catch(() => {})
  })
}

function KenBurnsImage({
  slide,
  width,
  height,
  isActive,
}: {
  slide: HeroSlide
  width: number
  height: number
  isActive: boolean
}) {
  const scale = useRef(new Animated.Value(1.0)).current

  useEffect(() => {
    if (!isActive) {
      scale.setValue(1.0)
      return
    }
    Animated.timing(scale, {
      toValue: 1.045,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start()
  }, [isActive, scale])

  return (
    <View style={[styles.mediaClip, { width, height }]}>
      <Animated.View
        style={{
          position: 'absolute',
          top: -height * 0.02,
          left: -width * 0.02,
          width: width * 1.04,
          height: height * 1.04,
          transform: [{ scale }],
        }}
      >
        <Image
          source={slide.media.source}
          style={{ width: width * 1.04, height: height * 1.04 }}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  )
}

export default function HeroBanner({
  slides: slidesProp,
  topChrome = 0,
  onCtaPress,
  onScrollToShowroom,
}: Props) {
  const insets = useSafeAreaInsets()
  const { width: winW, height: winH } = useWindowDimensions()

  // Window only — screen height is taller than the mall viewport
  const heroWidth = winW
  const heroHeight = Math.max(winH - topChrome, 480)

  const statusTop = Math.max(insets.top, Platform.OS === 'android' ? 24 : 20)
  const bottomPad = Math.max(insets.bottom, 12)

  const slides = useMemo(
    () => resolveHeroSlides(slidesProp ?? HERO_SLIDES),
    [slidesProp]
  )

  useEffect(() => {
    prefetchHeroImages(slides)
  }, [slides])

  const opacities = useRef(
    slides.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))
  ).current

  const textOpacity = useRef(new Animated.Value(0)).current
  const textY = useRef(new Animated.Value(14)).current

  const [current, setCurrent] = useState(0)
  const currentRef = useRef(0)
  const busy = useRef(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    currentRef.current = current
  }, [current])

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  const scheduleHold = useCallback(() => {
    clearHold()
    if (slides.length < 2) return
    holdTimer.current = setTimeout(() => {
      goTo(currentRef.current + 1)
    }, HOLD_MS)
  }, [slides.length, clearHold])

  const goTo = useCallback(
    (raw: number) => {
      if (busy.current || slides.length < 2) return
      const from = currentRef.current
      const target = ((raw % slides.length) + slides.length) % slides.length
      if (target === from) return

      busy.current = true
      clearHold()

      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: TEXT_EXIT_MS,
          easing: EASE_CROSSFADE,
          useNativeDriver: true,
        }),
        Animated.timing(textY, {
          toValue: 12,
          duration: TEXT_EXIT_MS,
          easing: EASE_CROSSFADE,
          useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.parallel([
          Animated.timing(opacities[from], {
            toValue: 0.01,
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
        ]).start(({ finished }) => {
          if (!finished) {
            busy.current = false
            return
          }

          slides.forEach((_, i) => {
            opacities[i].setValue(i === target ? 1 : 0)
          })

          currentRef.current = target
          setCurrent(target)

          textY.setValue(14)
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
            busy.current = false
            scheduleHold()
          })
        })
      })
    },
    [opacities, scheduleHold, slides, clearHold, textOpacity, textY]
  )

  useEffect(() => {
    Animated.parallel([
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 800,
        easing: EASE_TEXT,
        useNativeDriver: true,
      }),
      Animated.timing(textY, {
        toValue: 0,
        duration: 800,
        easing: EASE_TEXT,
        useNativeDriver: true,
      }),
    ]).start()

    const mountTimer = setTimeout(() => scheduleHold(), HOLD_MS)
    return () => {
      clearTimeout(mountTimer)
      clearHold()
    }
  }, [])

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.35,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -SWIPE_THRESH) goTo(currentRef.current + 1)
        else if (g.dx >= SWIPE_THRESH) goTo(currentRef.current - 1)
      },
    })
  ).current

  const copy = slides[current]
  if (!copy) return null

  const handleCta = () => {
    if (onCtaPress) onCtaPress(copy)
    else if (onScrollToShowroom) onScrollToShowroom()
  }

  const kicker =
    (copy as HeroSlide & { kicker?: string }).kicker ||
    (copy as any).eyebrow ||
    'PLAZORE'

  const hStyle = headlineStyle(copy.headline || '')
  const sStyle = subStyle(copy.subheadline || '')

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
            opacity: opacities[i],
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
        colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.18)', 'transparent']}
        locations={[0, 0.55, 1]}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: statusTop + 36,
          zIndex: 2,
        }}
      />

      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(9,11,15,0.4)', 'rgba(9,11,15,0.94)']}
        locations={[0.28, 0.62, 1]}
        style={FILL}
      />

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.copyBlock,
          {
            paddingTop: statusTop + 56,
            paddingBottom: bottomPad + 58,
            opacity: textOpacity,
            transform: [{ translateY: textY }],
          },
        ]}
      >
        <Text style={styles.kicker}>{String(kicker).toUpperCase()}</Text>
        <Text style={[styles.headline, hStyle]} numberOfLines={3}>
          {copy.headline}
        </Text>
        <Text style={[styles.sub, sStyle]} numberOfLines={3}>
          {copy.subheadline}
        </Text>

        <Pressable
          onPress={handleCta}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>{copy.ctaLabel}</Text>
        </Pressable>
      </Animated.View>

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
            size={26}
            color="rgba(255,255,255,0.55)"
          />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  mediaClip: {
    overflow: 'hidden',
    backgroundColor: '#090B0F',
  },
  copyBlock: {
    ...FILL,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingHorizontal: 22,
    zIndex: 3,
  },
  kicker: {
    fontFamily: 'Manrope_600SemiBold',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    letterSpacing: 3.2,
    marginBottom: 10,
  },
  headline: {
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  sub: {
    fontFamily: 'Manrope_400Regular',
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 22,
  },
  cta: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'transparent',
  },
  ctaPressed: {
    opacity: 0.8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  ctaText: {
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  arrowBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  arrowHit: {
    alignItems: 'center',
    gap: 2,
  },
  arrowLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 9,
    letterSpacing: 2.4,
    color: 'rgba(255,255,255,0.45)',
  },
})