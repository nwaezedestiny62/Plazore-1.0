import React, { useEffect, useRef } from 'react'
import { Animated, Easing, ViewStyle } from 'react-native'

interface FadeUpOnAppearProps {
  children: React.ReactNode
  delay?: number
  style?: ViewStyle
  distance?: number
  duration?: number
  once?: boolean
}

export default function FadeUpOnAppear({
  children,
  delay = 0,
  style,
  distance = 20,
  duration = 500,
  once = true,
}: FadeUpOnAppearProps) {
  const translateY = useRef(new Animated.Value(distance)).current
  const opacity = useRef(new Animated.Value(0)).current
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (hasAnimated.current) return
    hasAnimated.current = true

    const timer = setTimeout(() => {
      Animated.parallel([
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
      ]).start()
    }, delay)

    return () => clearTimeout(timer)
  }, [delay, duration])

  return (
    <Animated.View
      style={[
        {
          transform: [{ translateY }],
          opacity,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  )
}
