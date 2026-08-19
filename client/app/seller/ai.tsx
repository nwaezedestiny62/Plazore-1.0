import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useRef } from 'react'
import {
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#737A86'
const GREEN = '#00E575'
const BLUE = '#3B82F6'

const FEATURES = [
  {
    icon: 'sparkles-outline' as const,
    title: 'Product clarity',
    body: 'Gentle guidance to make titles, photos, and details easier for buyers to trust.',
  },
  {
    icon: 'stats-chart-outline' as const,
    title: 'Quiet insights',
    body: 'Simple signals on how your store is doing — without drowning you in charts.',
  },
  {
    icon: 'trending-up-outline' as const,
    title: 'Room to grow',
    body: 'Practical suggestions when something small could improve reach or conversion.',
  },
  {
    icon: 'chatbubble-ellipses-outline' as const,
    title: 'A steady companion',
    body: 'An assistant that supports your work in the lounge — when you need it, not before.',
  },
]

export default function SellerAIAssistant() {
  const fade = useRef(new Animated.Value(0)).current
  const lift = useRef(new Animated.Value(14)).current
  const orb = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 640,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 680,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()

    Animated.loop(
      Animated.timing(orb, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start()
  }, [])

  const rotate = orb.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <View style={styles.root}>
      {/* Soft ambient — barely there */}
      <LinearGradient
        colors={['#0B1218', BG, '#080A0E']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <Animated.View
          style={{
            flex: 1,
            opacity: fade,
            transform: [{ translateY: lift }],
          }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Mark */}
            <View style={styles.markWrap}>
              <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
              <View style={styles.markCore}>
                <Image
                  source={require('@/assets/logo-1.png')}
                  style={styles.markLogo}
                  resizeMode="contain"
                />
              </View>
            </View>

            <Text style={styles.eyebrow}>Intelligence</Text>
            <Text style={styles.title}>Plazore AI</Text>
            <Text style={styles.lead}>
              A quieter kind of help for your store — still being shaped with care.
            </Text>
            <Text style={styles.body}>
              We’re building an assistant that respects your time: clearer
              products, calmer decisions, and insights that earn their place.
              Nothing noisy. Nothing rushed.
            </Text>

            <View style={styles.soonPill}>
              <View style={styles.soonDot} />
              <Text style={styles.soonText}>In progress</Text>
            </View>

            <Text style={styles.section}>What we’re shaping</Text>

            {FEATURES.map((f, i) => (
              <View key={f.title} style={styles.card}>
                <View style={styles.cardIcon}>
                  <Ionicons name={f.icon} size={18} color={GREEN} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{f.title}</Text>
                  <Text style={styles.cardText}>{f.body}</Text>
                </View>
                {i < FEATURES.length - 1 ? null : null}
              </View>
            ))}

            <View style={styles.closeCard}>
              <LinearGradient
                colors={['rgba(0,229,117,0.08)', 'rgba(59,130,246,0.06)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.closeGrad}
              >
                <Text style={styles.closeTitle}>
                  Built slowly so it feels right when it arrives.
                </Text>
                <Text style={styles.closeBody}>
                  Every piece is checked against one question: does this help a
                  seller sell better — without adding stress?
                </Text>
              </LinearGradient>
            </View>

            <Text style={styles.footer}>Plazore · Seller Intelligence</Text>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 48,
  },

  glowTop: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(0,229,117,0.04)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: 40,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(59,130,246,0.04)',
  },

  markWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  ring: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderTopColor: 'rgba(0,229,117,0.45)',
    borderRightColor: 'rgba(59,130,246,0.35)',
  },
  markCore: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,229,117,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markLogo: { width: 26, height: 26 },

  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: MUTED,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  lead: {
    fontSize: 16,
    fontWeight: '600',
    color: SECONDARY,
    lineHeight: 24,
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 22,
    marginBottom: 18,
  },

  soonPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 28,
  },
  soonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN,
  },
  soonText: {
    fontSize: 12,
    fontWeight: '600',
    color: SECONDARY,
    letterSpacing: 0.2,
  },

  section: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  card: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    marginBottom: 10,
  },
  cardIcon: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0,229,117,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 4,
  },
  cardText: {
    fontSize: 13,
    lineHeight: 20,
    color: MUTED,
  },

  closeCard: {
    marginTop: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,229,117,0.18)',
    overflow: 'hidden',
  },
  closeGrad: { padding: 18 },
  closeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    lineHeight: 22,
    marginBottom: 8,
  },
  closeBody: {
    fontSize: 13,
    lineHeight: 20,
    color: SECONDARY,
  },

  footer: {
    textAlign: 'center',
    marginTop: 28,
    fontSize: 11,
    color: MUTED,
    letterSpacing: 0.8,
  },
})