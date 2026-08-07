/**
 * RoomFour — THE LOCALE
 * Regional marketplace room.
 * Bright, open, grounded — “The Walk”
 */

import { Product } from '@/constants/types'
import React from 'react'
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import ShowroomProductCard from './ShowroomProductCard'
import ScrollFadeUp from './ScrollFadeUp'

const { width: SCREEN_W } = Dimensions.get('window')
const CARD_W = Math.min(SCREEN_W * 0.58, 220)
const CARD_GAP = 16

interface RoomFourProps {
  products: Product[]
  title?: string
  subtitle?: string
  regionLabel?: string
}

export default function RoomFour({
  products,
  title = 'THE LOCALE',
  subtitle = 'From Your Region',
  regionLabel = 'Regional Selection',
}: RoomFourProps) {
  return (
    <View style={styles.room}>
      {/* Header */}
      <View style={styles.header}>
        <ScrollFadeUp delay={40} duration={550} distance={14}>
          <Text style={styles.kicker}>{title}</Text>
        </ScrollFadeUp>
        <ScrollFadeUp delay={100} duration={600} distance={16}>
          <Text style={styles.title}>{subtitle}</Text>
        </ScrollFadeUp>
        <ScrollFadeUp delay={150} duration={500} distance={10}>
          <Text style={styles.region}>{regionLabel}</Text>
        </ScrollFadeUp>
      </View>

      {/* The Walk — horizontal rail */}
      <ScrollFadeUp delay={200} duration={650} distance={24}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          decelerationRate="fast"
          snapToInterval={CARD_W + CARD_GAP}
          snapToAlignment="start"
        >
          {products.map((product, index) => (
            <View
              key={`${product._id}-locale-${index}`}
              style={[styles.cardWrap, { width: CARD_W, marginRight: CARD_GAP }]}
            >
              <ShowroomProductCard product={product} />
            </View>
          ))}
        </ScrollView>
      </ScrollFadeUp>

      {/* Soft bottom note */}
      <ScrollFadeUp delay={320} duration={500} distance={12}>
        <Text style={styles.note}>
          Prioritising products from your marketplace region
        </Text>
      </ScrollFadeUp>
    </View>
  )
}

const styles = StyleSheet.create({
  room: {
    backgroundColor: '#F7F1E9',          // warm sand / light clay
    paddingTop: 52,
    paddingBottom: 60,
    width: SCREEN_W,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  kicker: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    letterSpacing: 3.6,
    textTransform: 'uppercase',
    color: '#9C8B7A',
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 26,
    letterSpacing: -0.4,
    color: '#2C241B',
    marginBottom: 8,
  },
  region: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: '#8C7B6B',
  },
  rail: {
    paddingHorizontal: 24,
    paddingRight: 40,
  },
  cardWrap: {
    // slight lift so cards feel like they’re sitting on a plinth
  },
  note: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: '#A89888',
    textAlign: 'center',
    marginTop: 28,
    paddingHorizontal: 24,
  },
})