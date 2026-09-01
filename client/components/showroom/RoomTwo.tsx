import { Product } from '@/constants/types'
import React, { useMemo } from 'react'
import { Dimensions, StyleSheet, Text, View } from 'react-native'
import ShowroomProductCard from './ShowroomProductCard'
import ScrollFadeUp from './ScrollFadeUp'

const { width: SCREEN_W } = Dimensions.get('window')

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
  const { left, right, rest } = useMemo(() => {
    const list = products || []
    return {
      left: list[0],
      right: list[1],
      rest: list.slice(2, 14),
    }
  }, [products])

  return (
    <View style={styles.room}>
      <View style={styles.header}>
        <ScrollFadeUp delay={40} duration={550} distance={16}>
          <Text style={styles.kicker}>{title}</Text>
        </ScrollFadeUp>
        <ScrollFadeUp delay={100} duration={600} distance={18}>
          <Text style={styles.title}>{subtitle}</Text>
        </ScrollFadeUp>
        <ScrollFadeUp delay={150} duration={500} distance={10}>
          <View style={styles.line} />
        </ScrollFadeUp>
      </View>

      {(left || right) && (
        <View style={styles.dual}>
          {left && (
            <ScrollFadeUp
              delay={200}
              duration={700}
              distance={30}
              style={styles.dualItem}
            >
              <ShowroomProductCard product={left} room={2} position={0} />
            </ScrollFadeUp>
          )}
          {right && (
            <ScrollFadeUp
              delay={280}
              duration={700}
              distance={30}
              style={styles.dualItem}
            >
              <ShowroomProductCard product={right} room={2} position={1} />
            </ScrollFadeUp>
          )}
        </View>
      )}

      {rest.length > 0 && (
        <View style={styles.secondary}>
          {rest.map((product, index) => (
            <ScrollFadeUp
              key={`${product._id}-s-${index}`}
              delay={360 + index * 55}
              duration={600}
              distance={22}
              style={styles.secondaryItem}
            >
              <ShowroomProductCard
                product={product}
                room={2}
                position={index + 2}
              />
            </ScrollFadeUp>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  room: {
    backgroundColor: '#F4EFE8',
    paddingTop: 52,
    paddingBottom: 60,
    width: SCREEN_W,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 36,
  },
  kicker: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    letterSpacing: 3.6,
    textTransform: 'uppercase',
    color: '#8C7B6B',
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 28,
    letterSpacing: -0.5,
    color: '#2C241B',
    marginBottom: 16,
  },
  line: {
    height: 1.5,
    width: 48,
    backgroundColor: '#2C241B',
    opacity: 0.2,
  },
  dual: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  dualItem: {
    width: (SCREEN_W - 44) / 2,
  },
  secondary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    rowGap: 24,
  },
  secondaryItem: {
    width: (SCREEN_W - 44) / 2,
  },
})