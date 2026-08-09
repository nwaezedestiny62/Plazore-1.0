// client/components/ProductCard.tsx
import { ProductCardProps } from '@/constants/types'
import { useMarketplace } from '@/context/MarketplaceContext'
import { Ionicons } from '@expo/vector-icons'
import { Link } from 'expo-router'
import React, { useMemo } from 'react'
import { Image, Text, TouchableOpacity, View } from 'react-native'

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

  if (product?.brand) return product.brand
  if (product?.subCategory) return product.subCategory

  return ''
}

interface AuraProductCardProps extends ProductCardProps {
  cardWidth?: number
  aspectRatio?: number
}

export default function ProductCard({
  product,
  cardWidth,
}: AuraProductCardProps) {
  const { formatProduct } = useMarketplace()

  const location = useMemo(
    () => resolveShipLocation(product),
    [product]
  )

  const formattedPrice = useMemo(() => {
    return formatProduct(product.price, (product as any).region)
  }, [product, formatProduct])

  return (
    <Link href={`/product/${product._id}` as any} asChild>
      <TouchableOpacity
        activeOpacity={0.92}
        style={{
          width: cardWidth ? cardWidth : '48%',
          marginBottom: 24,
          backgroundColor: '#FFFFFF',
          borderRadius: 0,
        }}
      >
        {/* Image */}
        <View
          style={{
            position: 'relative',
            width: '100%',
            height: cardWidth ? cardWidth * 1.25 : 210,
            backgroundColor: '#F8FAFC',
            borderRadius: 0,
            overflow: 'hidden',
          }}
        >
          {product.images?.[0] ? (
            <Image
              source={{ uri: product.images[0] }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F1F5F9',
              }}
            >
              <Ionicons name="image-outline" size={32} color="#CBD5E1" />
            </View>
          )}

          {/* Featured Tag only */}
          {product.isFeatured && (
            <View
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 9,
                  fontWeight: '700',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Featured
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ paddingTop: 12, paddingHorizontal: 4, alignItems: 'center' }}>
          <Text
            style={{
              color: '#0F172A',
              fontSize: 13,
              fontWeight: '600',
              textAlign: 'center',
              lineHeight: 18,
            }}
            numberOfLines={1}
          >
            {product.name}
          </Text>

          <Text
            style={{
              color: '#475569',
              fontSize: 12,
              fontWeight: '400',
              textAlign: 'center',
              marginTop: 4,
            }}
            numberOfLines={1}
          >
            {location ? (
              <>
                <Text style={{ color: '#64748B' }}>{location.toLowerCase()}</Text>
                <Text style={{ color: '#94A3B8' }}> | </Text>
              </>
            ) : null}
            <Text style={{ color: '#0F172A', fontWeight: '500' }}>{formattedPrice}</Text>
          </Text>
        </View>
      </TouchableOpacity>
    </Link>
  )
}