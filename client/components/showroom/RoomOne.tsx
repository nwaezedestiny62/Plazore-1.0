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
import ScrollFadeUp from './ScrollFadeUp'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const CARD_W = Math.min(SCREEN_W * 0.58, 220)
const CARD_GAP = 8

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
    const list = products || []
    const mid = Math.ceil(list.length / 2)

    return {
      featureImage: list[0]?.images?.[0],
      railA: list.slice(0, Math.min(mid, 25)),
      railB: list.slice(mid, mid + 25),
    }
  }, [products])

  return (
    <View style={styles.room}>
      <ScrollFadeUp delay={50} duration={750} distance={32}>
        <View style={styles.banner}>
          {featureImage ? (
            <Image
              source={{ uri: featureImage }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={500}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: '#151A22' },
              ]}
            />
          )}

          <View style={styles.bannerOverlay} />

          <View style={styles.bannerContent}>
            <Text style={styles.bannerKicker}>{title}</Text>
            <Text style={styles.bannerTitle}>{subtitle}</Text>
          </View>
        </View>
      </ScrollFadeUp>

      {railA.length > 0 && (
        <View style={styles.railSection}>
          <ScrollFadeUp delay={160} duration={550} distance={18}>
            <Text style={styles.railLabel}>NOW SHOWING</Text>
          </ScrollFadeUp>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            decelerationRate="fast"
            snapToInterval={CARD_W + CARD_GAP}
          >
            {railA.map((product, index) => (
              <ScrollFadeUp
                key={`a-${product._id}-${index}`}
                delay={220 + index * 55}
                duration={600}
                distance={24}
                style={{ width: CARD_W, marginRight: CARD_GAP }}
              >
                <ShowroomProductCard
                  product={product}
                  dark
                  room={1}
                  position={index}
                  style={{ width: CARD_W }}
                />
              </ScrollFadeUp>
            ))}
          </ScrollView>
        </View>
      )}

      {railB.length > 0 && (
        <View style={[styles.railSection, { paddingTop: 28 }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            decelerationRate="fast"
            snapToInterval={CARD_W + CARD_GAP}
          >
            {railB.map((product, index) => (
              <ScrollFadeUp
                key={`b-${product._id}-${index}`}
                delay={320 + index * 55}
                duration={600}
                distance={24}
                style={{ width: CARD_W, marginRight: CARD_GAP }}
              >
                <ShowroomProductCard
                  product={product}
                  dark
                  room={1}
                  position={railA.length + index}
                  style={{ width: CARD_W }}
                />
              </ScrollFadeUp>
            ))}
          </ScrollView>
        </View>
      )}
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
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,8,12,0.58)',
  },
  bannerContent: {
    position: 'absolute',
    bottom: 34,
    left: 24,
    right: 24,
  },
  bannerKicker: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    letterSpacing: 4,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  bannerTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 30,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  railSection: {
    paddingTop: 32,
  },
  railLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    letterSpacing: 3.2,
    color: 'rgba(255,255,255,0.38)',
    textTransform: 'uppercase',
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  rail: {
    paddingHorizontal: 24,
    paddingRight: 48,
  },
})