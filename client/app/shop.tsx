import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import api from '@/constants/api'
import { Product } from '@/constants/types'
import { useMarketplace } from '@/context/MarketplaceContext'
import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function Shop() {
  const { region } = useMarketplace()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const fetchProducts = async (pageNumber: number) => {
    if (pageNumber === 1) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const res = await api.get(
        `/products?page=${pageNumber}&limit=10&region=${region || 'NG'}`
      )

      if (res.data.success) {
        const newProducts = res.data.data

        if (pageNumber === 1) {
          setProducts(newProducts)
        } else {
          setProducts((prev) => [...prev, ...newProducts])
        }

        setHasMore(pageNumber < res.data.pagination.pages)
        setPage(pageNumber)
      }
    } catch (error) {
      console.error('Shop fetch error:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMore = () => {
    if (!loadingMore && !loading && hasMore) {
      fetchProducts(page + 1)
    }
  }

  useEffect(() => {
    fetchProducts(1)
  }, [region])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top']}>
      <Header title="Showroom" showBack showCart />

      {/* Search Bar */}
      <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginVertical: 12 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, height: 44 }}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            style={{ flex: 1, marginLeft: 8, color: '#0F172A', fontSize: 13 }}
            placeholder="Search showroom..."
            returnKeyType="search"
            placeholderTextColor="#94A3B8"
          />
        </View>

        <TouchableOpacity style={{ backgroundColor: '#0F172A', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="options-outline" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0F172A" />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item._id}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          renderItem={({ item }) => <ProductCard product={item} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" color="#0F172A" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                <Text style={{ color: '#64748B', fontSize: 13 }}>
                  No additional products in this region for now
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  )
}