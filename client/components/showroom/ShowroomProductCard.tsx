import { ProductCardProps } from '@/constants/types'
import { useMarketplace } from '@/context/MarketplaceContext'
import { Image } from 'expo-image'
import { Link } from 'expo-router'
import React, { useMemo } from 'react'
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

const SCREEN_W = Dimensions.get('window').width
const SCREEN_H = Dimensions.get('window').height

function resolveShipLocation(product: any): string {
  const fl = product?.fulfillmentLocation
  if (fl) {
    if (fl.displayLabel) return String(fl.displayLabel)
    const parts = [fl.city, fl.state, fl.country].filter(Boolean)
    if (parts.length) return parts.join(', ')
  }
  const addr = product?.seller?.shippingDefaults?.address
  if (addr) {
    const parts = [addr.city, addr.state, addr.country].filter(Boolean)
    if (parts.length) return parts.join(', ')
  }
  return ''
}

type CardSize = 'hero' | 'full' | 'rail' | 'grid'

interface ShowroomProductCardProps extends ProductCardProps {
  size?: CardSize
  style?: any
  dark?: boolean
}

export default function ShowroomProductCard({
  product,
  size = 'rail',
  style,
  dark = false,
}: ShowroomProductCardProps) {
  const { formatProduct } = useMarketplace()
  const location = useMemo(() => resolveShipLocation(product), [product])

  // Size calculations — cinematic, full-bleed
  let imageHeight: number
  let textPadding: number

  switch (size) {
    case 'hero':
      // Full-screen cinematic — entire viewport
      imageHeight = SCREEN_H - 200
      textPadding = 32
      break
    case 'full':
      // Almost full-screen — for vertical portrait tiles
      imageHeight = SCREEN_H * 0.85
      textPadding = 24
      break
    case 'rail':
      // Full-height rail item — like beyonce/ronaldo horizontal scroll
      imageHeight = SCREEN_H * 0.78
      textPadding = 20
      break
    case 'grid':
      // Smaller grid item
      imageHeight = SCREEN_H * 0.42
      textPadding = 16
      break
    default:
      imageHeight = SCREEN_H * 0.78
      textPadding = 20
  }

  const textPrimary = dark ? '#FFFFFF' : '#0F172A'
  const textSecondary = dark ? 'rgba(255,255,255,0.6)' : '#94A3B8'

  return (
    <Link href={`/product/${product._id}` as any} asChild>
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.card, style]}
      >
        {/* Image — edge-to-edge, no rounded corners, no borders */}
        <View style={[styles.imageWrap, { height: imageHeight }]}>
          {product.images?.[0] ? (
            <Image
              source={{ uri: product.images[0] }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              placeholder={undefined}
            />
          ) : (
            <View style={[styles.image, styles.placeholder]} />
          )}
        </View>

        {/* Minimal text overlay — positioned at bottom of image */}
        <View style={[styles.textOverlay, { paddingHorizontal: textPadding, paddingBottom: textPadding }]}>
          <Text
            style={[styles.productName, { color: textPrimary }]}
            numberOfLines={2}
          >
            {product.name}
          </Text>
          {!!location && (
            <Text style={[styles.location, { color: textSecondary }]}>{location}</Text>
          )}
          <Text style={[styles.price, { color: textPrimary }]}>
            {formatProduct(product.price, (product as any).region)}
          </Text>
        </View>
      </TouchableOpacity>
    </Link>
  )
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  imageWrap: {
    width: '100%',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#F1F5F9',
  },
  textOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // Gradient-like: subtle dark overlay behind text
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingTop: 24,
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: 0.2,
    fontFamily: 'Manrope_600SemiBold',
  },
  location: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 4,
    fontFamily: 'Manrope_400Regular',
    letterSpacing: 0.5,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: 6,
    fontFamily: 'Manrope_700Bold',
  },
})
