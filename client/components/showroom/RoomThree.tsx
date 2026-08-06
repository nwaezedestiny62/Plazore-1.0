import { Product } from '@/constants/types'
import React from 'react'
import { Dimensions, StyleSheet, Text, View } from 'react-native'
import ShowroomProductCard from './ShowroomProductCard'
import ScrollFadeUp from './ScrollFadeUp'

const { width: SCREEN_W } = Dimensions.get('window')

// Cool shade palettes
const TONES = {
  ice: { bg: '#F0F9FF', text: '#0369A1', sub: '#0EA5E9' },
  mint: { bg: '#ECFDF5', text: '#047857', sub: '#10B981' },
  lavender: { bg: '#F5F3FF', text: '#6D28D9', sub: '#8B5CF6' },
  slate: { bg: '#F8FAFC', text: '#334155', sub: '#64748B' },
  dusk: { bg: '#F1F5F9', text: '#1E293B', sub: '#475569' },
}

type Tone = keyof typeof TONES

interface RoomThreeProps {
  products: Product[]
  tone?: Tone
  title?: string
  subtitle?: string
}

export default function RoomThree({ 
  products, 
  tone = 'ice',
  title = "COLLECTION",
  subtitle = "Selected Pieces"
}: RoomThreeProps) {
  const colors = TONES[tone] || TONES.ice

  return (
    <View style={[styles.room, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <ScrollFadeUp delay={100} duration={600} distance={20}>
          <Text style={[styles.subtitle, { color: colors.sub }]}>{title}</Text>
        </ScrollFadeUp>
        <ScrollFadeUp delay={200} duration={700} distance={20}>
          <Text style={[styles.title, { color: colors.text }]}>{subtitle}</Text>
        </ScrollFadeUp>
      </View>

      {/* Vertical Product Feed */}
      <View style={styles.feed}>
        {products.map((product, index) => (
          <ScrollFadeUp
            key={product._id}
            delay={300 + index * 100}
            duration={800}
            distance={40}
          >
            <ShowroomProductCard 
              product={product} 
              size="full" 
              style={styles.card}
            />
          </ScrollFadeUp>
        ))}
      </View>
      
      {/* Section Divider / Progress Bar hint from aura-rae */}
      <View style={styles.dividerContainer}>
        <View style={[styles.dividerBase, { backgroundColor: colors.sub + '20' }]}>
          <View style={[styles.dividerActive, { backgroundColor: colors.sub }]} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  room: {
    paddingVertical: 60,
    width: SCREEN_W,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  feed: {
    paddingHorizontal: 16,
  },
  card: {
    marginBottom: 48,
  },
  dividerContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
    alignItems: 'center',
  },
  dividerBase: {
    width: '100%',
    height: 2,
    borderRadius: 1,
  },
  dividerActive: {
    width: '30%',
    height: '100%',
    borderRadius: 1,
  },
})
