/**
 * RoomFive — THE ATELIER
 * Curated Masterpieces / Editorial Gallery Room.
 * Deep midnight onyx backdrop (#0D0F14) with subtle bronze accents (#C5A880).
 * Features an asymmetric editorial grid with entrance animations and finale badge.
 */

import { Product } from '@/constants/types'
import { useMarketplace } from '@/context/MarketplaceContext'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { Link } from 'expo-router'
import React from 'react'
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import ScrollFadeUp from './ScrollFadeUp'
import ShowroomProductCard from './ShowroomProductCard'

const { width: SCREEN_W } = Dimensions.get('window')
const CARD_GAP = 14

interface RoomFiveProps {
  products: Product[]
  title?: string
  subtitle?: string
}

export default function RoomFive({
  products,
  title = 'THE ATELIER',
  subtitle = 'Curated Masterpieces',
}: RoomFiveProps) {
  const { formatProduct } = useMarketplace()

  if (!products || products.length === 0) return null

  const heroProduct = products[0]
  const dualProducts = products.slice(1, 3)
  const highlightProduct = products[3] || dualProducts[1] || heroProduct

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
          <View style={styles.accentLine} />
        </ScrollFadeUp>
      </View>

      {/* 1. Hero Lead Product Stage */}
      {heroProduct && (
        <ScrollFadeUp delay={200} duration={700} distance={28} style={styles.heroWrap}>
          <Link href={`/product/${heroProduct._id}` as any} asChild>
            <Pressable style={styles.heroCard}>
              <View style={styles.heroImageWrap}>
                {heroProduct.images?.[0] ? (
                  <Image
                    source={{ uri: heroProduct.images[0] }}
                    style={styles.heroImage}
                    contentFit="cover"
                    transition={400}
                  />
                ) : (
                  <View style={[styles.heroImage, styles.placeholder]} />
                )}
                <View style={styles.heroTag}>
                  <Text style={styles.heroTagText}>ATELIER EXCLUSIVE</Text>
                </View>
              </View>

              <View style={styles.heroInfo}>
                <View style={styles.heroMainMeta}>
                  <Text style={styles.heroName} numberOfLines={1}>
                    {heroProduct.name}
                  </Text>
                  <Text style={styles.heroBrand}>
                    {(heroProduct.brand || 'plazore atelier').toLowerCase()}
                  </Text>
                </View>
                <Text style={styles.heroPrice}>
                  {formatProduct(heroProduct.price, heroProduct.region)}
                </Text>
              </View>
            </Pressable>
          </Link>
        </ScrollFadeUp>
      )}

      {/* 2. Side-by-Side Dual Stage */}
      {dualProducts.length > 0 && (
        <View style={styles.dualRow}>
          {dualProducts.map((prod, index) => (
            <ScrollFadeUp
              key={`${prod._id}-atelier-dual-${index}`}
              delay={280 + index * 90}
              duration={650}
              distance={24}
              style={styles.dualItem}
            >
              <ShowroomProductCard product={prod} dark />
            </ScrollFadeUp>
          ))}
        </View>
      )}

      {/* 3. Showcase Collector Card */}
      {highlightProduct && highlightProduct !== heroProduct && (
        <ScrollFadeUp delay={440} duration={700} distance={26} style={styles.highlightWrap}>
          <Link href={`/product/${highlightProduct._id}` as any} asChild>
            <Pressable style={styles.highlightCard}>
              <View style={styles.highlightThumbWrap}>
                {highlightProduct.images?.[0] ? (
                  <Image
                    source={{ uri: highlightProduct.images[0] }}
                    style={styles.highlightThumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.highlightThumb, styles.placeholder]} />
                )}
              </View>

              <View style={styles.highlightContent}>
                <Text style={styles.highlightLabel}>FEATURED FIND</Text>
                <Text style={styles.highlightName} numberOfLines={1}>
                  {highlightProduct.name}
                </Text>
                <Text style={styles.highlightPrice}>
                  {formatProduct(highlightProduct.price, highlightProduct.region)}
                </Text>
              </View>

              <View style={styles.arrowWrap}>
                <Ionicons name="arrow-forward" size={18} color="#C5A880" />
              </View>
            </Pressable>
          </Link>
        </ScrollFadeUp>
      )}

      {/* Finale Emblem */}
      <ScrollFadeUp delay={520} duration={600} distance={12}>
        <View style={styles.finaleBadge}>
          <View style={styles.finaleLine} />
          <Text style={styles.finaleText}>✦ PLAZORE SHOWROOM COLLECTION ✦</Text>
          <View style={styles.finaleLine} />
        </View>
      </ScrollFadeUp>
    </View>
  )
}

const styles = StyleSheet.create({
  room: {
    backgroundColor: '#0D0F14',
    paddingTop: 56,
    paddingBottom: 68,
    width: SCREEN_W,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  kicker: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: '#C5A880',
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 28,
    letterSpacing: -0.5,
    color: '#FFFFFF',
    marginBottom: 14,
  },
  accentLine: {
    height: 1.5,
    width: 48,
    backgroundColor: '#C5A880',
    opacity: 0.8,
  },
  heroWrap: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  heroCard: {
    backgroundColor: '#13161F',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(197, 168, 128, 0.22)',
    overflow: 'hidden',
  },
  heroImageWrap: {
    width: '100%',
    height: 240,
    position: 'relative',
    backgroundColor: '#090A0D',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#1A1D26',
  },
  heroTag: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(13, 15, 20, 0.82)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(197, 168, 128, 0.35)',
  },
  heroTagText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 9.5,
    letterSpacing: 2,
    color: '#C5A880',
    textTransform: 'uppercase',
  },
  heroInfo: {
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  heroMainMeta: {
    flex: 1,
    marginRight: 12,
  },
  heroName: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroBrand: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: '#94A3B8',
  },
  heroPrice: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#C5A880',
  },
  dualRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  dualItem: {
    width: (SCREEN_W - 40 - CARD_GAP) / 2,
  },
  highlightWrap: {
    paddingHorizontal: 20,
    marginBottom: 36,
  },
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    padding: 12,
  },
  highlightThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#13161F',
    marginRight: 14,
  },
  highlightThumb: {
    width: '100%',
    height: '100%',
  },
  highlightContent: {
    flex: 1,
  },
  highlightLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: '#C5A880',
    marginBottom: 3,
  },
  highlightName: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 3,
  },
  highlightPrice: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: '#94A3B8',
  },
  arrowWrap: {
    paddingLeft: 12,
  },
  finaleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 24,
  },
  finaleLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  finaleText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 10,
    letterSpacing: 3.5,
    color: 'rgba(255,255,255,0.32)',
    marginHorizontal: 14,
  },
})