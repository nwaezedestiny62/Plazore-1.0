import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Easing, View, ViewStyle } from 'react-native'

interface ScrollFadeUpProps {
  children: React.ReactNode
  style?: ViewStyle
  once?: boolean
  distance?: number
  duration?: number
  delay?: number
  staggerIndex?: number
  staggerDelay?: number
  scale?: boolean
}

/**
 * ScrollFadeUp — Cinematic entrance animation triggered when
 * the element scrolls into view. Designed for the dramatic,
 * exhibition-like feel of beyonce.com / cristianoronaldo.com.
 *
 * Features:
 * - Fade + translateY entrance
 * - Optional subtle scale-in for hero elements
 * - Staggered delays for sequential reveals
 * - GPU-accelerated with useNativeDriver
 * - Once mode: only animate on first appearance
 */
export default function ScrollFadeUp({
  children,
  style,
  once = true,
  distance = 40,
  duration = 700,
  delay = 0,
  staggerIndex = 0,
  staggerDelay = 0,
  scale = false,
}: ScrollFadeUpProps) {
  const [isVisible, setIsVisible] = useState(false)
  const hasAnimated = useRef(false)
  const translateY = useRef(new Animated.Value(distance)).current
  const opacity = useRef(new Animated.Value(0)).current
  const scaleValue = useRef(new Animated.Value(scale ? 0.92 : 1)).current
  const viewRef = useRef<View>(null)

  const triggerAnimation = useCallback(() => {
    if (isVisible) return
    setIsVisible(true)
    if (once && hasAnimated.current) return
    hasAnimated.current = true

    const totalDelay = delay + staggerIndex * staggerDelay

    const timer = setTimeout(() => {
      const animations = [
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]

      if (scale) {
        animations.push(
          Animated.timing(scaleValue, {
            toValue: 1,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      }

      Animated.parallel(animations).start()
    }, totalDelay)

    return () => clearTimeout(timer)
  }, [isVisible, duration, delay, staggerIndex, staggerDelay, scale])

  return (
    <View
      ref={viewRef}
      onLayout={triggerAnimation}
      style={[{ opacity: isVisible ? undefined : 0 }, style]}
    >
      <Animated.View
        style={{
          transform: [
            { translateY },
            ...(scale ? [{ scale: scaleValue }] : []),
          ],
          opacity,
        }}
      >
        {children}
      </Animated.View>
    </View>
  )
}
