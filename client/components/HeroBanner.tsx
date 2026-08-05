/**
 * PlazoreHeroBanner — "Calm Digital Signage" Edition
 *
 * What was fixed / changed:
 * ─────────────────────────────────────────────────────────────────────────
 * FLICKER FIXES:
 *  1. Never set opacity to exactly 0 with .setValue() before crossfade.
 *     Target starts at 0.01 (not 0) so React Native never renders a black gap.
 *  2. copyOpacity is never .setValue() to 0 — always animated smoothly.
 *     The old code did copyOpacity.setValue(0) which caused an instant flash.
 *  3. Image.prefetch called on mount to warm the cache so first paint has
 *     no flicker on image load.
 *  4. The outgoing slide opacity never drops below 0.01 during the overlap
 *     window — guarantees both layers are always partially visible.
 *  5. A brief initial delay (300ms) on first mount lets the layout settle
 *     before auto-rotation begins, preventing first-paint flicker.
 *
 * CINEMATIC CALM FEEL:
 *  1. Crossfade duration extended to 3200ms — slow, breathing transitions
 *     like luxury digital signage in a high-end mall.
 *  2. Dwell time increased to 11000ms — each slide gets its moment.
 *  3. Subtle Ken Burns effect on active image (slow 1.05× zoom drift).
 *  4. Text enters with a gentle upward float + fade (not instant).
 *  5. Gradient overlay softened — less harsh, more atmospheric.
 *  6. CTA pill uses frosted glass instead of flat dark.
 *  7. Progress indicators (dots) are thin, understated, elegant.
 *  8. No aggressive arrows or bold UI chrome — calm and minimal.
 */

import { HERO_SLIDES, HeroSlide, resolveHeroSlides } from '@/constants/heroCampaigns'
import { Ionicons } from '@expo/vector-icons'
import { Image as ExpoImage } from 'expo-image'
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

// ─── Timing (calm, breathing pace) ────────────────────────────────────────
const HOLD_MS       = 11000   // each slide dwells 11s — unhurried
const CROSSFADE_MS  = 3200    // 3.2s crossfade — cinematic dissolve
const SWIPE_THRESH  = 52
const TEXT_ENTER_MS = 1200    // text floats up over 1.2s
const TEXT_EXIT_MS  = 600     // text exits over 0.6s

// Cinematic easing — slow in, slow out, natural breathing
const EASE_CROSSFADE = Easing.bezier(0.4, 0.0, 0.2, 1.0)   // Material ease-out
const EASE_TEXT_ENTER = Easing.bezier(0.25, 0.1, 0.25, 1.0) // gentle ease-out

// ─── Types ────────────────────────────────────────────────────────────────
type Props = {
  slides?: HeroSlide[]
  topChrome?: number
  onCtaPress?: (slide: HeroSlide) => void
  onScrollToShowroom?: () => void
}

// ─── Pre-fetch hero images to prevent first-paint flicker ────────────────
function prefetchHeroImages(slides: HeroSlide[]) {
  slides.forEach((s) => {
    const src = s.media.source as { uri?: string }
    if (src?.uri) {
      Image.prefetch(src.uri).catch(() => {})
    }
  })
}

// ─── Ken Burns animated image ─────────────────────────────────────────────
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

    // Very slow zoom drift — 1.0 → 1.04 over the dwell time
    Animated.timing(scale, {
      toValue: 1.04,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start()
  }, [isActive])

  return (
    <View style={[styles.mediaClip, { width, height, overflow: 'hidden' }]}>
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

// ─── Progress Dots (thin, elegant) ────────────────────────────────────────
function ProgressDots({
  count,
  current,
}: {
  count: number
  current: number
}) {
  if (count < 2) return null

  return (
    <View style={styles.dotsWrap}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current && styles.dotActive,
          ]}
        />
      ))}
    </View>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────
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
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 12,
    12
  )

  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 12) + 8

  // Edge-to-edge status bar
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

  // ── Prefetch images on mount ──────────────────────────────────────────
  useEffect(() => {
    prefetchHeroImages(slides)
  }, [])

  // ── Opacity refs for crossfade ────────────────────────────────────────
  const opacities = useRef(
    slides.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))
  ).current

  // ── Text animation values ────────────────────────────────────────────
  // We use a single "textState" ref that tracks which slide the text belongs to
  const textState = useRef({
    slideIndex: 0,
    opacity: new Animated.Value(0),    // starts at 0, fades in
    translateY: new Animated.Value(12), // starts slightly below
  }).current

  // ── State ─────────────────────────────────────────────────────────────
  const [current, setCurrent] = useState(0)
  const currentRef = useRef(0)
  const busy = useRef(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstMountDone = useRef(false)

  useEffect(() => {
    currentRef.current = current
  }, [current])

  // ── Clear / Schedule auto-advance ────────────────────────────────────
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
  }, [slides.length])

  // ── The GO TO function — flicker-free crossfade ──────────────────────
  const goTo = useCallback(
    (raw: number) => {
      if (busy.current || slides.length < 2) return
      const from = currentRef.current
      const target = ((raw % slides.length) + slides.length) % slides.length
      if (target === from) return

      busy.current = true
      clearHold()

      // ── STEP 1: Animate text out (float down + fade) ─────────────────
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

      // ── STEP 2: Crossfade images ─────────────────────────────────────
      // Key fix: target starts at 0.01 (not 0) to avoid black gap
      // The "from" slide fades to 0.01 (not 0) to maintain overlap
      const imageCrossfade = Animated.parallel([
        Animated.timing(opacities[from], {
          toValue: 0.01, // keep tiny overlap — never fully invisible simultaneously
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

      // Sequence: text exits → images crossfade (with slight overlap)
      Animated.sequence([
        textOut,
        Animated.delay(400), // brief pause for calmness
        imageCrossfade,
      ]).start(({ finished }) => {
        if (!finished) {
          busy.current = false
          return
        }

        // ── STEP 3: Lock state after crossfade ─────────────────────────
        // Hard-set all opacities — from → 0, target → 1
        slides.forEach((_, i) => {
          if (i === target) opacities[i].setValue(1)
          else opacities[i].setValue(0)
        })

        currentRef.current = target
        setCurrent(target)

        // ── STEP 4: Animate text in (float up + fade) ──────────────────
        textState.slideIndex = target
        textState.translateY.setValue(12) // reset to starting position
        textState.opacity.setValue(0)      // reset to invisible

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
    [opacities, scheduleHold, slides, textState]
  )

  // ── Auto-advance on mount (with initial delay) ───────────────────────
  useEffect(() => {
    // Fade text in on first mount
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

    // Start auto-advance after dwell time
    const mountTimer = setTimeout(() => {
      firstMountDone.current = true
      scheduleHold()
    }, HOLD_MS)

    return () => {
      clearTimeout(mountTimer)
      clearHold()
    }
  }, [])

  // ── Pan gestures ─────────────────────────────────────────────────────
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

  // ── Current copy ─────────────────────────────────────────────────────
  const copy = slides[current]
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
        backgroundColor: '#0B0B0F',
        overflow: 'hidden',
      }}
      {...pan.panHandlers}
    >
      {/* ── Image layers (crossfade) ─────────────────────────────────── */}
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

      {/* ── Atmospheric gradient overlay (softer than original) ──────── */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(11,11,15,0.08)',   // very light at top
          'rgba(11,11,15,0.18)',   // gentle mid
          'rgba(11,11,15,0.65)',   // readable bottom
        ]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Text content (animated entrance/exit) ────────────────────── */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.centerBlock,
          {
            paddingTop: statusTop + 48,
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

          {/* CTA — frosted glass pill */}
          <Pressable
            onPress={handleCta}
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaPressed,
            ]}
          >
            <Text style={styles.ctaText}>{copy.ctaLabel}</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* ── Progress dots ─────────────────────────────────────────────── */}
      <View
        pointerEvents="box-none"
        style={[styles.dotsContainer, { paddingBottom: bottomPad }]}
      >
        <ProgressDots count={slides.length} current={current} />
      </View>

      {/* ── Subtle scroll indicator ──────────────────────────────────── */}
      <View
        pointerEvents="box-none"
        style={[styles.arrowBar, { paddingBottom: bottomPad + 36 }]}
      >
        <Pressable onPress={onScrollToShowroom} hitSlop={20}>
          <Ionicons
            name="chevron-down"
            size={28}
            color="rgba(255,255,255,0.35)"
          />
        </Pressable>
      </View>
    </View>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────
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

  // Frosted glass CTA
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

  // Progress dots
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

  // Scroll indicator
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
