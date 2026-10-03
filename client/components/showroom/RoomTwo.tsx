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

  const left = list[0]
  const right = list[1]
  const rest = list.slice(2)

  return (
    <View style={styles.room}>
      <View style={styles.header}>
        <Text style={styles.kicker}>{title}</Text>
        <Text style={styles.title}>{subtitle}</Text>
        <View style={styles.line} />
      </View>

      {(left || right) && (
        <View style={styles.dual}>
          {left ? (
            <View style={styles.dualItem}>
              <ShowroomProductCard product={left} room={2} position={0} />
            </View>
          ) : null}
          {right ? (
            <View style={styles.dualItem}>
              <ShowroomProductCard product={right} room={2} position={1} />
            </View>
          ) : null}
        </View>
      )}

      {rest.length > 0 ? (
        <View style={styles.secondary}>
          {rest.map((product, index) => (
            <View key={String(product._id)} style={styles.secondaryItem}>
              <ShowroomProductCard
                product={product}
                room={2}
                position={2 + index}
              />
            </View>
          ))}
        </View>
      ) : null}
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
  dualItem: {
    width: HALF,
  },
  secondary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: PAD,
    paddingTop: 20,
    gap: GAP,
  },
  secondaryItem: {
    width: HALF,
  },
})
