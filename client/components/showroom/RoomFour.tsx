import { Product } from '@/constants/types'
import React from 'react'
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native'
import ShowroomProductCard from './ShowroomProductCard'
import ScrollFadeUp from './ScrollFadeUp'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const CARD_W = SCREEN_W * 0.68
const CARD_GAP = 14

interface RoomFourProps {
  products: Product[]
}

export default function RoomFour({ products }: RoomFourProps) {
  return (
    <View style={[styles.room, { backgroundColor: '#F8F7F5' }]}>
      {/* Dramatic section break — like entering a new chapter */}
      <ScrollFadeUp delay={100} duration={600} distance={30} style={styles.dividerRow}>
        <View style={styles.dividerLine} />
      </ScrollFadeUp>

      <View style={styles.headerRow}>
        <ScrollFadeUp delay={200} duration={600} distance={30}>
          <Text style={styles.sectionLabel}>NEW ARRIVALS</Text>
        </ScrollFadeUp>
        <ScrollFadeUp delay={300} duration={700} distance={30}>
          <Text style={styles.sectionTitle}>Just Dropped</Text>
        </ScrollFadeUp>
      </View>

      {/* Horizontal rail — slightly different rhythm from Room One
          Smaller cards, tighter spacing, lighter background */}
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
            style={[styles.railItem, { width: CARD_W + CARD_GAP }] as any}
            delay={400 + index * 120}
            duration={600}
            distance={40}
            staggerIndex={index}
            staggerDelay={0}
            scale
          >
            <ShowroomProductCard product={product} size="rail" />
          </ScrollFadeUp>
        ))}
      </ScrollView>

      {/* Subtle scroll indicator */}
      {products.length > 1 && (
        <ScrollFadeUp delay={900} duration={500} distance={20} style={styles.scrollHint}>
          <View style={styles.scrollDots}>
            {products.map((_, i) => (
              <View
                key={i}
                style={[styles.scrollDot, { opacity: i === 0 ? 0.8 : 0.25 }]}
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
    paddingTop: 40,
    paddingBottom: 48,
    minHeight: SCREEN_H * 0.9,
  },
  headerRow: {
    paddingHorizontal: 28,
    marginBottom: 28,
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 4,
    textTransform: 'uppercase',
    fontFamily: 'Manrope_600SemiBold',
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
    fontFamily: 'Manrope_600SemiBold',
  },
  dividerRow: {
    paddingHorizontal: 28,
    marginBottom: 28,
  },
  dividerLine: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
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
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0F172A',
  },
})
