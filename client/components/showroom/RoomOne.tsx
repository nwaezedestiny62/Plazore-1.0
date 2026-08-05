import { Product } from '@/constants/types'
import React from 'react'
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native'
import ShowroomProductCard from './ShowroomProductCard'
import ScrollFadeUp from './ScrollFadeUp'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const CARD_W = SCREEN_W * 0.82
const CARD_GAP = 12

interface RoomOneProps {
  products: Product[]
  variant?: 'default' | 'hero'
}

export default function RoomOne({ products, variant = 'default' }: RoomOneProps) {
  // --- HERO: Single product gets full cinematic treatment ---
  if (variant === 'hero' && products.length === 1) {
    return (
      <View style={[styles.room, { backgroundColor: '#0A0A0A' }]}>
        {/* Dramatic label — like "act ii" on beyonce.com */}
        <ScrollFadeUp delay={200} duration={800} distance={50} style={styles.heroLabel}>
          <Text style={styles.heroLabelSmall}>CHAPTER 01</Text>
          <Text style={styles.heroLabelLarge}>The Piece</Text>
        </ScrollFadeUp>

        <ScrollFadeUp delay={500} duration={900} distance={60} scale style={styles.heroCard}>
          <ShowroomProductCard product={products[0]} size="hero" />
        </ScrollFadeUp>
      </View>
    )
  }

  // --- DEFAULT: Cinematic horizontal rail — like beyonce.com / cristianoronaldo.com
  // Each item is a full-height portrait tile in a horizontal scroll
  return (
    <View style={[styles.room, { backgroundColor: '#0A0A0A' }]}>
      {/* Section label — dramatic, minimal, wide letter-spacing */}
      <View style={styles.headerRow}>
        <ScrollFadeUp delay={100} duration={600} distance={30} style={styles.labelWrap}>
          <Text style={styles.sectionLabel}>DISCOVER</Text>
        </ScrollFadeUp>
        <ScrollFadeUp delay={250} duration={700} distance={30} style={styles.labelWrap}>
          <Text style={styles.sectionTitle}>Featured Pieces</Text>
        </ScrollFadeUp>
      </View>

      {/* Horizontal rail — full-height portrait tiles, snap scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        bounces={false}
        decelerationRate="fast"
        snapToInterval={CARD_W + CARD_GAP}
        snapToAlignment="center"
        pagingEnabled={products.length <= 3}
      >
        {products.map((product, index) => (
          <ScrollFadeUp
            key={product._id}
            style={[styles.railItem, { width: CARD_W, marginRight: CARD_GAP }] as any}
            delay={300 + index * 150}
            duration={700}
            distance={50}
            staggerIndex={index}
            staggerDelay={0}
            scale
          >
            <ShowroomProductCard product={product} size="rail" />
          </ScrollFadeUp>
        ))}
      </ScrollView>

      {/* Subtle scroll indicator — hint that more is available */}
      {products.length > 1 && (
        <ScrollFadeUp delay={1000} duration={600} distance={20} style={styles.scrollHint}>
          <View style={styles.scrollDots}>
            {products.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.scrollDot,
                  { opacity: i === 0 ? 1 : 0.3 },
                ]}
              />
            ))}
          </View>
        </ScrollFadeUp>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  room: {
    paddingTop: 24,
    paddingBottom: 40,
    minHeight: SCREEN_H * 0.9,
    justifyContent: 'center',
  },
  headerRow: {
    paddingHorizontal: 28,
    marginBottom: 28,
  },
  labelWrap: {
    marginBottom: 4,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 4,
    textTransform: 'uppercase',
    fontFamily: 'Manrope_600SemiBold',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
    fontFamily: 'Manrope_600SemiBold',
  },
  rail: {
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
  },
  railItem: {
    flexShrink: 0,
  },
  scrollHint: {
    alignItems: 'center',
    marginTop: 24,
  },
  scrollDots: {
    flexDirection: 'row',
    gap: 6,
  },
  scrollDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  // Hero variant
  heroLabel: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroLabelSmall: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 5,
    textTransform: 'uppercase',
    fontFamily: 'Manrope_600SemiBold',
  },
  heroLabelLarge: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.5,
    marginTop: 8,
    fontFamily: 'Manrope_600SemiBold',
  },
  heroCard: {
    paddingHorizontal: 0,
  },
})
