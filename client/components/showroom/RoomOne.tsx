import { Product } from '@/constants/types'
import { Image } from 'expo-image'
import React, { useMemo } from 'react'
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import ShowroomProductCard from './ShowroomProductCard'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const CARD_W = Math.min(SCREEN_W * 0.58, 220)
const CARD_GAP = 8
const RAIL_CAP = 25
const ROOM_CAP = 50

interface RoomOneProps {
  products: Product[]
  title?: string
  subtitle?: string
}

export default function RoomOne({
  products,
  title = 'THE HORIZON',
  subtitle = 'Expanded View',
}: RoomOneProps) {
  const { railA, railB, featureImage } = useMemo(() => {
    const seen = new Set<string>()
    const list: Product[] = []
    for (const p of products || []) {
      const id = String(p?._id || '')
      if (!id || seen.has(id)) continue
      seen.add(id)
      list.push(p)
      if (list.length >= ROOM_CAP) break
    }
    return {
      featureImage: list[0]?.images?.[0],
      railA: list.slice(0, RAIL_CAP),
      railB: list.slice(RAIL_CAP, RAIL_CAP * 2),
    }
  }, [products])

  return (
    <View style={styles.room}>
      <View style={styles.banner}>
        {featureImage ? (
          <Image
            source={{ uri: featureImage as string }}
            style={styles.fill}
            contentFit="cover"
            transition={0}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.fill, { backgroundColor: '#151A22' }]} />
        )}
        <View style={styles.bannerOverlay} />
        <View style={styles.bannerContent}>
          <Text style={styles.bannerKicker}>{title}</Text>
          <Text style={styles.bannerTitle}>{subtitle}</Text>
        </View>
      </View>

      {railA.length > 0 ? (
        <View style={styles.railSection}>
          <Text style={styles.railLabel}>NOW SHOWING</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            decelerationRate="fast"
            snapToInterval={CARD_W + CARD_GAP}
            removeClippedSubviews
          >
            {railA.map((product, index) => (
              <View
                key={String(product._id)}
                style={{ width: CARD_W, marginRight: CARD_GAP }}
              >
                <ShowroomProductCard
                  product={product}
                  dark
                  room={1}
                  position={index}
                  style={{ width: CARD_W }}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {railB.length > 0 ? (
        <View style={[styles.railSection, { paddingTop: 28 }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            decelerationRate="fast"
            snapToInterval={CARD_W + CARD_GAP}
            removeClippedSubviews
          >
            {railB.map((product, index) => (
              <View
                key={String(product._id)}
                style={{ width: CARD_W, marginRight: CARD_GAP }}
              >
                <ShowroomProductCard
                  product={product}
                  dark
                  room={1}
                  position={railA.length + index}
                  style={{ width: CARD_W }}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  room: {
    backgroundColor: '#0C0F14',
    paddingBottom: 64,
    width: SCREEN_W,
  },
  banner: {
    width: SCREEN_W,
    height: SCREEN_H * 0.4,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  bannerContent: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 28,
  },
  bannerKicker: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  bannerTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  railSection: {
    paddingTop: 24,
  },
  railLabel: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  rail: {
    paddingHorizontal: 16,
  },
})
