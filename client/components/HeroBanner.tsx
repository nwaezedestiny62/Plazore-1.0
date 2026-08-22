/**
 * PlazoreHeroBanner — edge-to-edge under a visible system status bar
 * Status bar stays light-content + translucent
 * Soft top veil so clock / battery stay readable over any slide
 */

import { HERO_SLIDES, HeroSlide, resolveHeroSlides } from '@/constants/heroCampaigns'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
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
const TEXT_ENTER_MS = 1200
const TEXT_EXIT_MS = 600

const EASE_CROSSFADE = Easing.bezier(0.4, 0.0, 0.2, 1.0)
const EASE_TEXT_ENTER = Easing.bezier(0.25, 0.1, 0.25, 1.0)

type Props = {
  slides?: HeroSlide[]
  topChrome?: number
  onCtaPress?: (slide: HeroSlide) => void
  onScrollToShowroom?: () => void
}

function prefetchHeroImages(slides: HeroSlide[]) {
  slides.forEach((s) => {
    const src = s.media.source as { uri?: string }
    if (src?.uri) {
      Image.prefetch(src.uri).catch(() => {})
    }
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
      toValue: 1.04,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start()
  }, [isActive])

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
          fadeDuration={400}
        />
      </Animated.View>
    </View>
  )
}

function ProgressDots({ count, current }: { count: number; current: number }) {
  if (count < 2) return null
  return (
    <View style={styles.dotsWrap}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
      ))}
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
  const window = useWindowDimensions()

  const screen = Dimensions.get('screen')
  // Full-bleed height — image draws under the system status bar
  const heroWidth = Math.max(screen.width, window.width)
  const heroHeight = Math.max(screen.height, window.height) - topChrome

  // Safe top for *content* only (not for status bar — status bar is system UI)
  const statusTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 20,
    20
  )

  const bottomPad =
    Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 12) + 8

  // Keep system status bar visible + light icons on dark hero
  useEffect(() => {
    StatusBar.setBarStyle('light-content', true)
    if (Platform.OS === 'android') {
      StatusBar.setTranslucent(true)
      StatusBar.setBackgroundColor('transparent', true)
      StatusBar.setHidden(false)
    }
  }, [])

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

  const textState = useRef({
    slideIndex: 0,
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(12),
  }).current

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

      const textOut = Animated.parallel([
        Animated.timing(textState.opacity, {
          toValue: 0,
          duration: TEXT_EXIT_MS,
          easing: EASE_CROSSFADE,
          useNativeDriver: true,
        }),
        Animated.timing(textState.translateY, {
          toValue: 16,
          duration: TEXT_EXIT_MS,
          easing: EASE_CROSSFADE,
          useNativeDriver: true,
        }),
      ])

      const imageCrossfade = Animated.parallel([
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
      ])

      Animated.sequence([
        textOut,
        Animated.delay(400),
        imageCrossfade,
      ]).start(({ finished }) => {
        if (!finished) {
          busy.current = false
          return
        }

        slides.forEach((_, i) => {
          if (i === target) opacities[i].setValue(1)
          else opacities[i].setValue(0)
        })

        currentRef.current = target
        setCurrent(target)

        textState.slideIndex = target
        textState.translateY.setValue(12)
        textState.opacity.setValue(0)

        Animated.parallel([
          Animated.timing(textState.opacity, {
            toValue: 1,
            duration: TEXT_ENTER_MS,
            easing: EASE_TEXT_ENTER,
            useNativeDriver: true,
          }),
          Animated.timing(textState.translateY, {
            toValue: 0,
            duration: TEXT_ENTER_MS,
            easing: EASE_TEXT_ENTER,
            useNativeDriver: true,
          }),
        ]).start(() => {
          busy.current = false
          scheduleHold()
        })
      })
    },
    [opacities, scheduleHold, slides, textState, clearHold]
  )

  useEffect(() => {
    Animated.parallel([
      Animated.timing(textState.opacity, {
        toValue: 1,
        duration: 800,
        easing: EASE_TEXT_ENTER,
        useNativeDriver: true,
      }),
      Animated.timing(textState.translateY, {
        toValue: 0,
        duration: 800,
        easing: EASE_TEXT_ENTER,
        useNativeDriver: true,
      }),
    ]).start()

    const mountTimer = setTimeout(() => {
      scheduleHold()
    }, HOLD_MS)

    return () => {
      clearTimeout(mountTimer)
      clearHold()
    }
  }, [])

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy),
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

  // Title bar occupies ~ statusTop + 70 — keep headline below that
  const titleBarReserve = statusTop + 72

  return (
    <View
      style={{
        width: heroWidth,
        height: heroHeight,
        backgroundColor: '#0B0B0F',
        overflow: 'hidden',
      }}
      {...pan.panHandlers}
    >
      {/* Always re-assert status bar on this screen */}
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
        hidden={false}
      />

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

      {/* Soft veil under status bar — keeps system icons readable */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(0,0,0,0.55)',
          'rgba(0,0,0,0.28)',
          'transparent',
        ]}
        locations={[0, 0.55, 1]}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: statusTop + 28,
          zIndex: 2,
        }}
      />

      {/* Atmospheric body gradient */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(11,11,15,0.08)',
          'rgba(11,11,15,0.18)',
          'rgba(11,11,15,0.65)',
        ]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.centerBlock,
          {
            // Clear title bar + status bar
            paddingTop: titleBarReserve,
            paddingBottom: bottomPad + 56,
            opacity: textState.opacity,
            transform: [{ translateY: textState.translateY }],
          },
        ]}
      >
        <View style={styles.copyWrap}>
          <Text style={styles.headline} numberOfLines={3}>
            {copy.headline}
          </Text>
          <Text style={styles.sub} numberOfLines={3}>
            {copy.subheadline}
          </Text>

          <Pressable
            onPress={handleCta}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaText}>{copy.ctaLabel}</Text>
          </Pressable>
        </View>
      </Animated.View>

      <View
        pointerEvents="box-none"
        style={[styles.dotsContainer, { paddingBottom: bottomPad }]}
      >
        <ProgressDots count={slides.length} current={current} />
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.arrowBar, { paddingBottom: bottomPad + 36 }]}
      >
        <Pressable onPress={onScrollToShowroom} hitSlop={20}>
          <Ionicons
            name="chevron-down"
            size={43}
            color="rgba(255, 255, 255, 0.67)"
          />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  mediaClip: {
    overflow: 'hidden',
    backgroundColor: '#0B0B0F',
  },
  centerBlock: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 3,
  },
  copyWrap: {
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  headline: {
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
    fontSize: 32,
    textAlign: 'center',
    letterSpacing: 0.25,
    lineHeight: 40,
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  sub: {
    fontFamily: 'Manrope_300Light',
    color: '#E8E8E8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    opacity: 0.92,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  cta: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.20)',
    overflow: 'hidden',
  },
  ctaPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  ctaText: {
    fontFamily: 'Manrope_500Medium',
    color: '#FFFFFF',
    fontSize: 14,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  dotsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  dotsWrap: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    width: 16,
    backgroundColor: 'rgba(255,255,255,0.70)',
  },
  arrowBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
})