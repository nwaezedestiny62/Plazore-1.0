import { ProductCardProps } from '@/constants/types'
import { useMarketplace } from '@/context/MarketplaceContext'
import { Link } from 'expo-router'
import React from 'react'
import { Image, Text, TouchableOpacity, View } from 'react-native'

export default function ProductCard({ product }: ProductCardProps) {
  const { formatProduct } = useMarketplace()

  return (
    <Link href={`/product/${product._id}` as any} asChild>
      <TouchableOpacity className="w-[48%] mb-4 bg-white rounded-2xl overflow-hidden">
        <View className="relative w-full h-36 bg-gray-100">
          <Image
            source={{ uri: product.images?.[0] ?? '' }}
            className="w-full h-full"
            resizeMode="cover"
          />

          {product.isFeatured && (
            <View className="absolute top-2 left-2 bg-black px-2 py-1 rounded-lg">
              <Text className="text-white text-xs font-medium">Featured</Text>
            </View>
          )}
        </View>

        <View className="p-3">
          <Text
            className="text-primary font-medium text-sm mb-1"
            numberOfLines={1}
          >
            {product.name}
          </Text>

          <Text className="text-primary font-bold text-base">
            {formatProduct(product.price, (product as any).region)}
          </Text>
        </View>
      </TouchableOpacity>
    </Link>
  )
}