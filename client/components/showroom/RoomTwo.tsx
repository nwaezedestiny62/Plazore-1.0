import { Product } from '@/constants/types'
import React, { useMemo } from 'react'
import { Dimensions, StyleSheet, Text, View } from 'react-native'
import ShowroomProductCard from './ShowroomProductCard'

const { width: SCREEN_W } = Dimensions.get('window')
const ROOM_CAP = 14
const PAD = 16
const GAP = 10
const HALF = (SCREEN_W - PAD * 2 - GAP) / 2

interface RoomTwoProps {
  products: Product[]
  title?: string
  subtitle?: string
}

/**
 * THE CHAMBER — Private Selection
 * Backend pairs similar products (same category / subcategory).
 * UI shows them side-by-side so the user can compare and choose.
 * Capacity: 14 unique (never overlaps Room 1).
 */
export default function RoomTwo({
  products,
  title = 'THE CHAMBER',
  subtitle = 'Private Selection',
}: RoomTwoProps) {
  const list = useMemo(() => {
    const seen = new Set<string>()
    const out: Product[] = []
    for (const p of products || []) {
      const id = String(p?._id || '')
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push(p)
      if (out.length >= ROOM_CAP) break
    }
    return out
  }, [products])

  // Pair layout: [0,1], [2,3], ...
  const pairs: Product[][] = []
  for (let i = 0; i < list.length; i += 2) {
    pairs.push(list.slice(i, i + 2))
  }

  return (
    <View style={styles.room}>
      <View style={styles.header}>
        <Text style={styles.kicker}>{title}</Text>
        <Text style={styles.title}>{subtitle}</Text>
        <Text style={styles.hint}>Compare side by side · pick what fits you</Text>
        <View style={styles.line} />
      </View>

      {pairs.map((pair, pairIndex) => (
        <View
          key={`pair-${pairIndex}-${String(pair[0]?._id || pairIndex)}`}
          style={[styles.dual, pairIndex > 0 && styles.dualNext]}
        >
          {pair.map((product, i) => (
            <View key={String(product._id)} style={styles.dualItem}>
              <ShowroomProductCard
                product={product}
                room={2}
                position={pairIndex * 2 + i}
              />
            </View>
          ))}
          {pair.length === 1 ? <View style={styles.dualItem} /> : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  room: {
    backgroundColor: '#F4F1EC',
    paddingBottom: 56,
    width: SCREEN_W,
  },
  header: {
    paddingHorizontal: PAD,
    paddingTop: 36,
    paddingBottom: 20,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(0,0,0,0.4)',
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: '#111',
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.42)',
    marginBottom: 14,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.12)',
    width: 48,
  },
  dual: {
    flexDirection: 'row',
    paddingHorizontal: PAD,
    gap: GAP,
  },
  dualNext: {
    marginTop: 20,
  },
  dualItem: {
    width: HALF,
  },
})
