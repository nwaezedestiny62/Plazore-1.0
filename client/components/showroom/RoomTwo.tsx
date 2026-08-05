import { Product } from '@/constants/types'
import React from 'react'
import { Dimensions, StyleSheet, Text, View } from 'react-native'
import ShowroomProductCard from './ShowroomProductCard'
import ScrollFadeUp from './ScrollFadeUp'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

interface RoomTwoProps {
  products: Product[]
  variant?: 'default' | 'heroSplit'
}

export default function RoomTwo({ products, variant = 'default' }: RoomTwoProps) {
  // --- HERO SPLIT: 2 products, full-screen dramatic vertical stack ---
  if (variant === 'heroSplit' && products.length === 2) {
    return (
      <View style={[styles.room, { backgroundColor: '#FFFFFF' }]}>
        {/* Dramatic divider */}
        <ScrollFadeUp delay={200} duration={600} distance={30} style={styles.dividerRow}>
          <View style={styles.dividerLine} />
        </ScrollFadeUp>

        <ScrollFadeUp delay={400} duration={700} distance={40} style={styles.labelWrap}>
          <Text style={styles.sectionLabel}>CHAPTER 02</Text>
          <Text style={[styles.sectionTitle, { color: '#0A0A0A' }]}>The Collection</Text>
        </ScrollFadeUp>

        {/* Each product gets its own full-height moment */}
        <ScrollFadeUp delay={600} duration={800} distance={60} scale style={styles.heroItem}>
          <ShowroomProductCard product={products[0]} size="full" />
        </ScrollFadeUp>

        <View style={styles.dividerLine} />

        <ScrollFadeUp delay={800} duration={800} distance={60} scale style={styles.heroItem}>
          <ShowroomProductCard product={products[1]} size="full" />
        </ScrollFadeUp>
      </View>
    )
  }

  // --- DEFAULT: Dramatic staggered vertical stack — each product is its own moment ---
  // Like cristianoronaldo.com: vertical portrait tiles, full-screen height
  return (
    <View style={[styles.room, { backgroundColor: '#F5F3F0' }]}>
      <View style={styles.headerRow}>
        <ScrollFadeUp delay={100} duration={600} distance={30}>
          <Text style={[styles.sectionLabel, { color: '#8B8680' }]}>EXPLORE</Text>
        </ScrollFadeUp>
        <ScrollFadeUp delay={200} duration={700} distance={30}>
          <Text style={[styles.sectionTitle, { color: '#1A1A1A' }]}>The Showroom</Text>
        </ScrollFadeUp>
      </View>

      {products.map((product, index) => (
        <ScrollFadeUp
          key={product._id}
          style={styles.productItem}
          delay={350 + index * 200}
          duration={800}
          distance={50}
          staggerIndex={index}
          staggerDelay={0}
          scale
        >
          <ShowroomProductCard product={product} size="grid" dark={index % 2 !== 0} />
        </ScrollFadeUp>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  room: {
    paddingTop: 48,
    paddingBottom: 48,
    minHeight: SCREEN_H * 0.9,
  },
  headerRow: {
    paddingHorizontal: 28,
    marginBottom: 36,
  },
  labelWrap: {
    paddingHorizontal: 28,
    marginBottom: 36,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 4,
    textTransform: 'uppercase',
    fontFamily: 'Manrope_600SemiBold',
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
    marginTop: 6,
    fontFamily: 'Manrope_600SemiBold',
  },
  dividerRow: {
    paddingHorizontal: 28,
    marginBottom: 28,
  },
  dividerLine: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: 28,
    marginVertical: 24,
  },
  heroItem: {
    marginHorizontal: 0,
  },
  productItem: {
    marginBottom: 8,
  },
})
