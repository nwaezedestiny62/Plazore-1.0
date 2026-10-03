import React, { useEffect, useRef } from 'react'
import { Animated, Easing, ViewStyle } from 'react-native'

interface ScrollFadeUpProps {
  children: React.ReactNode
  style?: ViewStyle
  once?: boolean
  distance?: number
  duration?: number
  delay?: number
  /** @deprecated ignored — kept for API compat */
  staggerIndex?: number
  staggerDelay?: number
  scale?: boolean
}

/**
 * Lightweight one-shot fade-up. No setState, no onLayout loops.
 * Prefer NOT wrapping every product card — section headers only.
 */
export default function ScrollFadeUp({
  children,
  style,
  once = true,
  distance = 16,
  duration = 420,
  delay = 0,
  scale = false,
}: ScrollFadeUpProps) {
  const translateY = useRef(new Animated.Value(distance)).current
  const opacity = useRef(new Animated.Value(0)).current
  const scaleValue = useRef(new Animated.Value(scale ? 0.97 : 1)).current
  const ran = useRef(false)

  useEffect(() => {
    if (once && ran.current) return
    ran.current = true
    const timer = setTimeout(() => {
      const anims = [
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
        anims.push(
          Animated.timing(scaleValue, {
            toValue: 1,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        )
      }
      Animated.parallel(anims).start()
    }, delay)
    return () => clearTimeout(timer)
  }, [delay, duration, once, scale, translateY, opacity, scaleValue])

  return (
    <Animated.View
      style={[
        {
          opacity,
          transform: scale
            ? [{ translateY }, { scale: scaleValue }]
            : [{ translateY }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  )
}
