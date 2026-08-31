/**
 * PlazoreHeroBanner — web-parity composition
 * Bottom-left copy, outline CTA, down arrow to showroom
 * Cinematic crossfade + Ken Burns (no center stack)
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
const TEXT_ENTER_MS = 900
const TEXT_EXIT_MS = 500

const EASE_CROSSFADE = Easing.bezier(0.4, 0.0, 0.2, 1.0)
const EASE_TEXT = Easing.bezier(0.25, 0.1, 0.25, 1.0)

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
          fadeDuration={400}
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
  const window = useWindowDimensions()

  const screen = Dimensions.get('screen')
  const heroWidth = Math.max(screen.width, window.width)
  const heroHeight = Math.max(screen.height, window.height) - topChrome

  const statusTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 20,
    20
  )
  const bottomPad =
    Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 10) + 6

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

  const titleBarReserve = statusTop + 72
  const kicker =
    (copy as HeroSlide & { kicker?: string }).kicker ||
    (copy as any).eyebrow ||
    'PLAZORE'

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

      {/* Top veil under status / title bar */}
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

      {/* Web-style bottom + left gradients */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          'transparent',
          'rgba(9,11,15,0.35)',
          'rgba(9,11,15,0.92)',
        ]}
        locations={[0.2, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(9,11,15,0.4)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.75, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Bottom-left copy block (web parity) */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.copyBlock,
          {
            paddingTop: titleBarReserve,
            paddingBottom: bottomPad + 72,
            opacity: textOpacity,
            transform: [{ translateY: textY }],
          },
        ]}
      >
        <Text style={styles.kicker}>{String(kicker).toUpperCase()}</Text>
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
      </Animated.View>

      {/* Down arrow → showroom */}
      <View
        pointerEvents="box-none"
        style={[styles.arrowBar, { paddingBottom: bottomPad + 10 }]}
      >
        <Pressable
          onPress={onScrollToShowroom}
          hitSlop={20}
          style={styles.arrowHit}
        >
          <Text style={styles.arrowLabel}>SHOWROOM</Text>
          <Ionicons
            name="chevron-down"
            size={28}
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
    ...StyleSheet.absoluteFillObject,
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
    fontSize: 34,
    letterSpacing: -0.4,
    lineHeight: 40,
    marginBottom: 12,
    maxWidth: 340,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  sub: {
    fontFamily: 'Manrope_400Regular',
    color: 'rgba(255,255,255,0.65)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
    maxWidth: 320,
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