import { Product } from '@/constants/types'
import React from 'react'
import { Dimensions, StyleSheet, Text, View } from 'react-native'
import ShowroomProductCard from './ShowroomProductCard'
import ScrollFadeUp from './ScrollFadeUp'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

interface RoomThreeProps {
  products: Product[]
  tone?: 'walnut' | 'ivory' | 'charcoal' | 'graphite' | 'stone' | 'beige'
  variant?: 'default' | 'heroSplit'
}

const TONE_COLORS: Record<string, { bg: string; label: string; title: string; accent: string }> = {
  walnut: {
    bg: '#2C1810',
    label: 'rgba(212,197,176,0.5)',
    title: '#F5E6D3',
    accent: '#D4C5B0',
  },
  ivory: {
    bg: '#F5F0E8',
    label: 'rgba(196,185,168,0.6)',
    title: '#2D2520',
    accent: '#C4B9A8',
  },
  charcoal: {
    bg: '#1A1A1C',
    label: 'rgba(142,142,147,0.4)',
    title: '#F5F5F7',
    accent: '#8E8E93',
  },
  graphite: {
    bg: '#2A2A2C',
    label: 'rgba(176,176,181,0.4)',
    title: '#FFFFFF',
    accent: '#B0B0B5',
  },
  stone: {
    bg: '#E8E4DF',
    label: 'rgba(160,153,144,0.6)',
    title: '#2C2824',
    accent: '#A09990',
  },
  beige: {
    bg: '#F0EBE3',
    label: 'rgba(189,181,168,0.6)',
    title: '#1E1A16',
    accent: '#BDB5A8',
  },
}

export default function RoomThree({ products, tone = 'charcoal', variant = 'default' }: RoomThreeProps) {
  const colors = TONE_COLORS[tone] || TONE_COLORS.charcoal

  // --- HERO SPLIT: 2 products in dramatic atmosphere ---
  if (variant === 'heroSplit' && products.length === 2) {
    return (
      <View style={[styles.room, { backgroundColor: colors.bg }]}>
        {/* Dramatic atmosphere divider */}
        <ScrollFadeUp delay={200} duration={600} distance={30} style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.accent + '30' }]} />
        </ScrollFadeUp>

        <ScrollFadeUp delay={350} duration={700} distance={40} style={styles.labelWrap}>
          <Text style={[styles.sectionLabel, { color: colors.label }]}>CHAPTER 03</Text>
          <Text style={[styles.sectionTitle, { color: colors.title }]}>Featured</Text>
        </ScrollFadeUp>

        {/* Two products side by side — dramatic split */}
        <View style={styles.splitRow}>
          <ScrollFadeUp delay={550} duration={800} distance={60} scale style={styles.splitItem}>
            <ShowroomProductCard product={products[0]} size="grid" dark={colors.bg === '#1A1A1C' || colors.bg === '#2A2A2C' || colors.bg === '#2C1810'} />
          </ScrollFadeUp>
          <ScrollFadeUp delay={700} duration={800} distance={60} scale style={styles.splitItem}>
            <ShowroomProductCard product={products[1]} size="grid" dark={colors.bg === '#1A1A1C' || colors.bg === '#2A2A2C' || colors.bg === '#2C1810'} />
          </ScrollFadeUp>
        </View>
      </View>
    )
  }

  // --- DEFAULT: Atmospheric room with tone transition ---
  const isDark = colors.bg === '#1A1A1C' || colors.bg === '#2A2A2C' || colors.bg === '#2C1810'

  return (
    <View style={[styles.room, { backgroundColor: colors.bg }]}>
      {/* Atmosphere divider — the moment you enter a new room */}
      <ScrollFadeUp delay={100} duration={500} distance={20} style={styles.atmosphereBar}>
        <View style={[styles.atmosphereLine, { backgroundColor: colors.accent + '25' }]} />
      </ScrollFadeUp>

      <View style={styles.headerRow}>
        <ScrollFadeUp delay={200} duration={600} distance={30}>
          <Text style={[styles.sectionLabel, { color: colors.label }]}>
            {tone.toUpperCase()}
          </Text>
        </ScrollFadeUp>
        <ScrollFadeUp delay={300} duration={700} distance={30}>
          <Text style={[styles.sectionTitle, { color: colors.title }]}>
            Curated Atmosphere
          </Text>
        </ScrollFadeUp>
      </View>

      <View style={styles.gridContainer}>
        {products.slice(0, 4).map((product, index) => (
          <ScrollFadeUp
            key={product._id}
            style={[styles.cardSlot, index % 2 !== 0 ? styles.staggerTop : null] as any}
            delay={400 + index * 180}
            duration={700}
            distance={40}
            scale
          >
            <ShowroomProductCard
              product={product}
              size="grid"
              dark={isDark}
            />
          </ScrollFadeUp>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  room: {
    paddingTop: 48,
    paddingBottom: 48,
    minHeight: SCREEN_H * 0.8,
  },
  atmosphereBar: {
    marginBottom: 36,
    paddingHorizontal: 28,
  },
  atmosphereLine: {
    height: 1,
    width: '100%',
  },
  headerRow: {
    paddingHorizontal: 28,
    marginBottom: 32,
  },
  labelWrap: {
    paddingHorizontal: 28,
    marginBottom: 32,
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
    marginHorizontal: 28,
    marginVertical: 24,
  },
  splitRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 16,
  },
  splitItem: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: 16,
  },
  cardSlot: {
    width: '48%',
  },
  staggerTop: {
    marginTop: 32,
  },
})
