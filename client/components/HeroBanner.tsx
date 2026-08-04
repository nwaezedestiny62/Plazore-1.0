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

const HOLD_MS = 9000
const CROSSFADE_MS = 2600
const SWIPE_THRESHOLD = 52
const CINEMA = Easing.bezier(0.37, 0.0, 0.63, 1)

type Props = {
  slides?: HeroSlide[]
  topChrome?: number
  onCtaPress?: (slide: HeroSlide) => void
  onScrollToShowroom?: () => void
}

function MediaFill({
  slide,
  width,
  height,
}: {
  slide: HeroSlide
  width: number
  height: number
}) {
  return (
    <View
      style={[
        styles.mediaClip,
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
        },
      ]}
    >
      <Image
        source={slide.media.source}
        style={{ width, height }}
        resizeMode="cover"
        fadeDuration={0}
      />
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

  // Always prefer full device screen so cold-start matches post-modal layout
  const screen = Dimensions.get('screen')
  const heroWidth = Math.max(screen.width, window.width)
  const heroHeight = Math.max(screen.height, window.height) - topChrome

  // Stable status-bar inset (works before/after modal)
  const statusTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 12,
    12
  )

  const bottomPad =
    Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 12) + 8

  // Lock edge-to-edge status bar on first paint (same state modal forces later)
  useEffect(() => {
    StatusBar.setBarStyle('light-content', true)
    if (Platform.OS === 'android') {
      StatusBar.setTranslucent(true)
      StatusBar.setBackgroundColor('transparent', true)
    }
  }, [])

  const slides = useMemo(
    () => resolveHeroSlides(slidesProp ?? HERO_SLIDES),
    [slidesProp]
  )

  const opacities = useRef(
    slides.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))
  ).current

  const [current, setCurrent] = useState(0)
  const [copyIndex, setCopyIndex] = useState(0)
  const currentRef = useRef(0)
  const busy = useRef(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyOpacity = useRef(new Animated.Value(1)).current
  const arrowY = useRef(new Animated.Value(0)).current

  useEffect(() => {
    currentRef.current = current
  }, [current])

  const clearHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  const scheduleHold = useCallback(() => {
    clearHold()
    if (slides.length < 2) return
    holdTimer.current = setTimeout(() => {
      goTo(currentRef.current + 1)
    }, HOLD_MS)
  }, [slides.length])

  const goTo = useCallback(
    (raw: number) => {
      if (busy.current || slides.length < 2) return
      const from = currentRef.current
      const target = ((raw % slides.length) + slides.length) % slides.length
      if (target === from) return
      if (!opacities[from] || !opacities[target]) return

      busy.current = true
      clearHold()

      Animated.sequence([
        Animated.delay(CROSSFADE_MS * 0.18),
        Animated.timing(copyOpacity, {
          toValue: 0,
          duration: CROSSFADE_MS * 0.32,
          easing: CINEMA,
          useNativeDriver: true,
        }),
      ]).start()

      opacities[target].setValue(0)

      Animated.parallel([
        Animated.timing(opacities[from], {
          toValue: 0,
          duration: CROSSFADE_MS,
          easing: CINEMA,
          useNativeDriver: true,
        }),
        Animated.timing(opacities[target], {
          toValue: 1,
          duration: CROSSFADE_MS,
          easing: CINEMA,
          useNativeDriver: true,
        }),
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
        setCopyIndex(target)
        copyOpacity.setValue(0)

        Animated.timing(copyOpacity, {
          toValue: 1,
          duration: 650,
          easing: CINEMA,
          useNativeDriver: true,
        }).start(() => {
          busy.current = false
          scheduleHold()
        })
      })
    },
    [copyOpacity, opacities, scheduleHold, slides]
  )

  useEffect(() => {
    scheduleHold()
    return clearHold
  }, [scheduleHold])

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowY, {
          toValue: 6,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(arrowY, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [arrowY])

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -SWIPE_THRESHOLD) goTo(currentRef.current + 1)
        else if (g.dx >= SWIPE_THRESHOLD) goTo(currentRef.current - 1)
      },
    })
  ).current

  const copy = slides[copyIndex]
  if (!copy) return null

  const handleCta = () => {
    if (onCtaPress) onCtaPress(copy)
    else if (onScrollToShowroom) onScrollToShowroom()
  }

  return (
    <View
      style={{
        width: heroWidth,
        height: heroHeight,
        backgroundColor: '#0E0E0E',
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
            overflow: 'hidden',
          }}
        >
          <MediaFill slide={slide} width={heroWidth} height={heroHeight} />
        </Animated.View>
      ))}

      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(0,0,0,0.22)',
          'rgba(0,0,0,0.28)',
          'rgba(0,0,0,0.55)',
        ]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.centerBlock,
          {
            paddingTop: statusTop + 48,
            paddingBottom: bottomPad + 56,
            opacity: copyOpacity,
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
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.ctaText}>{copy.ctaLabel}</Text>
          </Pressable>
        </View>
      </Animated.View>

      <View
        pointerEvents="box-none"
        style={[styles.arrowBar, { paddingBottom: bottomPad }]}
      >
        <Pressable onPress={onScrollToShowroom} hitSlop={20}>
          <Animated.View style={{ transform: [{ translateY: arrowY }] }}>
            <Ionicons
              name="chevron-down"
              size={40}
              color="rgba(255,255,255,0.65)"
            />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  mediaClip: {
    overflow: 'hidden',
    backgroundColor: '#0E0E0E',
  },
  centerBlock: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  copyWrap: {
    alignItems: 'center',
    maxWidth: 380,
    width: '100%',
  },
  headline: {
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
    fontSize: 38,
    textAlign: 'center',
    letterSpacing: 0.15,
    lineHeight: 46,
    marginBottom: 14,
  },
  sub: {
    fontFamily: 'Manrope_300Light',
    color: '#F2F2F2',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
    opacity: 0.94,
  },
  cta: {
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(14,14,14,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  ctaText: {
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
    fontSize: 15,
    letterSpacing: 0.35,
    textAlign: 'center',
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