import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import { useWishlist } from '@/context/WishlistContext'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function Favorites() {
  const { wishlist, loading, fetchWishlist } = useWishlist() as any
  const router = useRouter()

  // Always refresh when opening the tab so product-page adds show up
  useFocusEffect(
    useCallback(() => {
      if (typeof fetchWishlist === 'function') {
        fetchWishlist()
      }
    }, [fetchWishlist])
  )

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <Header title="Wishlist" showMenu showCart />

      {loading && wishlist.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#07111F" />
        </View>
      ) : wishlist.length > 0 ? (
        <ScrollView
          className="px-4 mt-4 flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <Text className="text-secondary text-[12px] mb-3">
            {wishlist.length} item{wishlist.length !== 1 ? 's' : ''}
          </Text>
          <View className="flex-row flex-wrap justify-between">
            {wishlist.map((product: any) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-secondary text-lg text-center">
            Your wishlist is currently empty.{'\n'}
            Double-tap a product image or tap the heart to save it here.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/')}
            className="mt-6 bg-primary px-8 py-3.5 rounded-2xl"
          >
            <Text className="text-white font-bold">Start Shopping</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}