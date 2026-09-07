import { Product } from '@/constants/types'
import React, { useMemo } from 'react'
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import ShowroomProductCard from './ShowroomProductCard'
import ScrollFadeUp from './ScrollFadeUp'

const CARD_GAP = 10
const ROOM_CAPACITY = 33
const SIDE = 20

interface RoomFourProps {
  products: Product[]
  title?: string
  subtitle?: string
  regionLabel?: string
}

function firstUri(p?: Product) {
  const img = p?.images?.[0] as any
  if (!img) return ''
  if (typeof img === 'string') return img
  return img.url || img.uri || img.secure_url || ''
}

export default function RoomFour({
  products: incoming,
  title = 'THE LOCALE',
  subtitle = 'From Your Region',
  regionLabel = "A look at what's around you",
}: RoomFourProps) {
  const { width } = useWindowDimensions()
  const cardW = Math.min(Math.round(width * 0.62), 236)
  const bannerH = Math.round(width * 0.52)

  const products = useMemo(
    () => (incoming || []).slice(0, ROOM_CAPACITY),
    [incoming]
  )

  const heroUri = firstUri(products[0])

  return (
    <View style={[styles.room, { width }]}>
      <View style={[styles.banner, { height: bannerH }]}>
        {heroUri ? (
          <Image
            source={{ uri: heroUri }}
            style={styles.bannerImg}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.bannerImg, { backgroundColor: '#E6DCCE' }]} />
        )}
        <View style={styles.bannerVeil} />
        <View style={styles.bannerCopy}>
          <Text style={styles.kicker}>{title}</Text>
          <Text style={styles.title}>{subtitle}</Text>
          <Text style={styles.region}>{regionLabel}</Text>
        </View>
      </View>

      {products.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          decelerationRate="fast"
          snapToInterval={cardW + CARD_GAP}
          snapToAlignment="start"
          nestedScrollEnabled
        >
          {products.map((product, index) => (
            <View
              key={`${product._id}-locale-${index}`}
              style={{ width: cardW, marginRight: CARD_GAP }}
            >
              <ShowroomProductCard
                product={product}
                room={4}
                position={index}
                dark={false}
                style={{ width: cardW }}
              />
            </View>
          ))}
        </ScrollView>
      ) : null}

      <Text style={styles.note}>
        A closer look at what&apos;s moving around you.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  room: {
    backgroundColor: '#F7F1E9',
    paddingBottom: 88,
  },
  banner: {
    width: '100%',
    overflow: 'hidden',
    marginBottom: 28,
    backgroundColor: '#E6DCCE',
  },
  bannerImg: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  bannerVeil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(44,36,27,0.38)',
  },
  bannerCopy: {
    position: 'absolute',
    left: SIDE,
    right: SIDE,
    bottom: 28,
  },
  kicker: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    letterSpacing: 3.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.72)',
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 26,
    letterSpacing: -0.4,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  region: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
  },
  rail: {
    paddingLeft: SIDE,
    paddingRight: SIDE + 16,
  },
  note: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: '#A89888',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: SIDE,
  },
})