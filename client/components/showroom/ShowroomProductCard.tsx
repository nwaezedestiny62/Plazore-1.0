import { ProductCardProps } from '@/constants/types'
import { useMarketplace } from '@/context/MarketplaceContext'
import { Image } from 'expo-image'
import { Link } from 'expo-router'
import React, { useMemo } from 'react'
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

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

  switch (size) {
    case 'hero':
      imageHeight = SCREEN_H * 0.75
      break
    case 'full':
      imageHeight = SCREEN_H * 0.7
      break
    case 'rail':
      imageHeight = SCREEN_H * 0.65
      break
    case 'grid':
      imageHeight = SCREEN_H * 0.45
      break
    default:
      imageHeight = SCREEN_H * 0.65
  }

  const textPrimary = dark ? '#FFFFFF' : '#000000'
  const textSecondary = dark ? 'rgba(255,255,255,0.7)' : '#666666'

  return (
    <Link href={`/product/${product._id}` as any} asChild>
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.card, style]}
      >
        {/* Image — edge-to-edge, no rounded corners */}
        <View style={[styles.imageWrap, { height: imageHeight }]}>
          {product.images?.[0] ? (
            <Image
              source={{ uri: product.images[0] }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.image, styles.placeholder]} />
          )}
          
          {/* Quick Add / Cart Icon Button — as seen in aura-rae */}
          <View style={styles.cartButton}>
            <Ionicons name="cart-outline" size={20} color="#000" />
          </View>
        </View>

        {/* Text Content Below Image */}
        <View style={styles.infoContainer}>
          <Text
            style={[styles.productName, { color: textPrimary }]}
            numberOfLines={1}
          >
            {product.name}
          </Text>
          
          <View style={styles.metaRow}>
            <Text style={[styles.location, { color: textSecondary }]} numberOfLines={1}>
              {location.toLowerCase() || 'global'}
            </Text>
            <Text style={[styles.metaDivider, { color: textSecondary }]}> | </Text>
            <Text style={[styles.price, { color: textPrimary }]}>
              {formatProduct(product.price, (product as any).region)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    marginBottom: 24,
  },
  imageWrap: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#F3F4F6',
  },
  cartButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    // Minimal shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoContainer: {
    paddingTop: 16,
    paddingHorizontal: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
    fontFamily: 'System', // Fallback to system if Manrope is not loaded
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  location: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.3,
    fontFamily: 'System',
    flexShrink: 1,
  },
  metaDivider: {
    fontSize: 14,
    fontWeight: '400',
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'System',
  },
})
