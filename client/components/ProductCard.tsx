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

  return ''
}

export default function ProductCard({ product }: ProductCardProps) {
  const { formatProduct } = useMarketplace()

  const location = useMemo(
    () => resolveShipLocation(product),
    [product]
  )

  return (
    <Link href={`/product/${product._id}` as any} asChild>
      <TouchableOpacity
        activeOpacity={0.88}
        className="w-[48%] mb-5 bg-white rounded-[20px] overflow-hidden border border-[#E8EEF4]"
      >
        {/* Image */}
        <View className="relative w-full h-40 bg-[#F1F5F9]">
          {product.images?.[0] ? (
            <Image
              source={{ uri: product.images[0] }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Ionicons name="image-outline" size={28} color="#CBD5E1" />
            </View>
          )}

          {product.isFeatured && (
            <View className="absolute top-2.5 left-2.5 bg-[#0F172A]/85 px-2.5 py-1 rounded-lg">
              <Text className="text-white text-[10px] font-semibold tracking-wide">
                Featured
              </Text>
            </View>
          )}
        </View>

        {/* Body — breathing space */}
        <View className="px-3.5 pt-3.5 pb-4">
          <Text
            className="text-[#0F172A] font-semibold text-[13px] leading-5"
            numberOfLines={2}
          >
            {product.name}
          </Text>

          <Text className="text-[#0F172A] font-extrabold text-[15px] mt-2">
            {formatProduct(product.price, (product as any).region)}
          </Text>

          {!!location && (
            <View className="flex-row items-start mt-2.5 pr-0.5">
              <Ionicons
                name="location-outline"
                size={12}
                color="#94A3B8"
                style={{ marginTop: 2 }}
              />
              <Text
                className="text-[#94A3B8] text-[11px] leading-4 ml-1 flex-1"
                numberOfLines={2}
              >
                {location}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Link>
  )
}