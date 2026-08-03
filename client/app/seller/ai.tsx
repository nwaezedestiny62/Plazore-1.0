import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useRef } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const { width } = Dimensions.get('window')

const FEATURES = [
  {
    emoji: '✨',
    icon: 'sparkles-outline' as const,
    title: 'Product Improvements',
    body: 'Receive intelligent suggestions to improve your product presentation and information.',
  },
  {
    emoji: '📊',
    icon: 'stats-chart-outline' as const,
    title: 'Business Insights',
    body: 'Understand how your store is performing with meaningful AI-powered insights.',
  },
  {
    emoji: '📈',
    icon: 'trending-up-outline' as const,
    title: 'Growth Opportunities',
    body: 'Discover practical opportunities to improve visibility and grow your business.',
  },
  {
    emoji: '🧠',
    icon: 'hardware-chip-outline' as const,
    title: 'AI Store Assistant',
    body: 'A dedicated assistant designed to support your business as Plazore continues to evolve.',
  },
]

function SoftOrb({
  size,
  color,
  style,
  pulse,
}: {
  size: number
  color: string
  style?: any
  pulse: Animated.Value
}) {
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  })
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.55],
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        },
        style,
      ]}
    />
  )
}

export default function SellerAIAssistant() {
  const fade = useRef(new Animated.Value(0)).current
  const lift = useRef(new Animated.Value(18)).current
  const pulseA = useRef(new Animated.Value(0)).current
  const pulseB = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 750,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()

    const loop = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 3200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 3200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start()

    loop(pulseA, 0)
    loop(pulseB, 900)
  }, [])

  return (
    <View className="flex-1 bg-[#060B14]">
      {/* Soft ambient background */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <LinearGradient
          colors={['#0A1628', '#060B14', '#081018']}
          style={{ flex: 1 }}
        />
        <SoftOrb
          size={220}
          color="#1A3A5C"
          pulse={pulseA}
          style={{ top: -40, right: -50 }}
        />
        <SoftOrb
          size={180}
          color="#152A45"
          pulse={pulseB}
          style={{ top: 180, left: -60 }}
        />
        <SoftOrb
          size={160}
          color="#1C2F4A"
          pulse={pulseA}
          style={{ bottom: 120, right: -30 }}
        />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        <Animated.View
          style={{
            flex: 1,
            opacity: fade,
            transform: [{ translateY: lift }],
          }}
        >
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 48,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero */}
            <View className="mb-8 mt-2">
              <View className="w-14 h-14 rounded-[18px] bg-[#12243A] border border-[#2A4560] items-center justify-center mb-5">
                <Ionicons name="sparkles" size={26} color="#9EC5FF" />
              </View>

              <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[3px] uppercase mb-2">
                Intelligence
              </Text>
              <Text className="text-white text-[28px] font-extrabold leading-9">
                Plazore AI Assistant
              </Text>
              <Text className="text-[#9EC5FF] text-[16px] font-semibold mt-2">
                A smarter business companion is on the way.
              </Text>
              <Text className="text-[#7A93A8] text-[14px] leading-6 mt-4">
                Plazore AI Assistant is being carefully built to help sellers
                understand their products, improve their storefronts, discover
                growth opportunities, and manage their business with intelligent
                insights—all from one place.
              </Text>
            </View>

            {/* Feature cards */}
            <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[2.5px] uppercase mb-3">
              What’s coming
            </Text>

            {FEATURES.map((f) => (
              <View
                key={f.title}
                className="bg-[#0C1520]/95 border border-[#1A2A3A] rounded-[24px] p-5 mb-3.5"
              >
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-row items-center flex-1 pr-3">
                    <View className="w-11 h-11 rounded-2xl bg-[#13263B] items-center justify-center mr-3">
                      <Ionicons name={f.icon} size={20} color="#9EC5FF" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-bold text-[15px]">
                        {f.emoji} {f.title}
                      </Text>
                    </View>
                  </View>
                  <View className="bg-[#121C2B] border border-[#243B55] px-2.5 py-1 rounded-full">
                    <Text className="text-[#6B8299] text-[10px] font-semibold tracking-wide">
                      Coming Soon
                    </Text>
                  </View>
                </View>
                <Text className="text-[#8EA4B8] text-[13px] leading-5 pl-[56px]">
                  {f.body}
                </Text>
              </View>
            ))}

            {/* Closing note */}
            <View className="mt-5 rounded-[24px] overflow-hidden border border-[#2A4560]">
              <LinearGradient
                colors={['#12243A', '#0C1520']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="p-6"
              >
                <Text className="text-white font-bold text-[16px] leading-6 mb-3">
                  The next chapter of Plazore AI is already taking shape.
                </Text>
                <Text className="text-[#8EA4B8] text-[13px] leading-5">
                  We&apos;re building these tools carefully to ensure every
                  feature genuinely helps your business and improves your selling
                  experience.
                </Text>
              </LinearGradient>
            </View>

            <Text
              className="text-center text-[#3D5268] text-[11px] mt-8 tracking-wide"
              style={{ width: width - 40 }}
            >
              Plazore · Seller Intelligence
            </Text>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}