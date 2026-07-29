import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import api from '@/constants/api'

export default function SellerProducts() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchProducts = async () => {
    try {
      const token = await getToken()
      const res = await api.get('/seller/products', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        setProducts(res.data.data)
      }
    } catch (error) {
      console.log('Fetch products error:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Refresh every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchProducts()
    }, [])
  )

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Product', `Remove "${name}" from your store?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getToken()
            await api.delete(`/seller/products/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            fetchProducts()
          } catch (error) {
            Alert.alert('Error', 'Could not delete product')
          }
        },
      },
    ])
  }

  if (loading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center bg-[#07111F]">
        <ActivityIndicator size="large" color="#DCEBFF" />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#07111F]">
      {/* Header */}
      <View className="px-5 pt-4 pb-3 flex-row justify-between items-center">
        <View>
          <Text className="text-white text-xl font-bold">My Products</Text>
          <Text className="text-[#7F93A8] text-xs mt-0.5">
            {products.length} product{products.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/seller/products/add' as any)}
          className="bg-[#DCEBFF] px-4 py-2.5 rounded-xl flex-row items-center"
        >
          <Ionicons name="add" size={18} color="#07111F" />
          <Text className="text-[#07111F] font-bold ml-1 text-[14px]">Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              fetchProducts()
            }}
            tintColor="#DCEBFF"
          />
        }
        ListEmptyComponent={
          <View className="items-center mt-24">
            <View className="w-20 h-20 rounded-full bg-[#0B1625] border border-[#1E334A] items-center justify-center">
              <Ionicons name="cube-outline" size={36} color="#4A657A" />
            </View>
            <Text className="text-white font-semibold text-lg mt-5">No products yet</Text>
            <Text className="text-[#7F93A8] text-center mt-2 px-10 leading-5">
              Start by adding your first product to the Plazore lounge
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/seller/products/add' as any)}
              className="mt-6 bg-[#DCEBFF] px-6 py-3 rounded-2xl"
            >
              <Text className="text-[#07111F] font-bold">Add Product</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-4 mb-4 flex-row">
            <Image
              source={{ uri: item.images?.[0] }}
              className="w-20 h-20 rounded-2xl bg-[#13263B]"
            />

            <View className="flex-1 ml-4 justify-center">
              <Text className="text-white font-bold text-[15px]" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="text-[#DCEBFF] font-semibold mt-1">${item.price}</Text>
              <View className="flex-row items-center mt-1.5 gap-3">
                <Text className="text-[#6B8299] text-xs">Stock: {item.stock}</Text>
                <View
                  className={`px-2 py-0.5 rounded-full ${
                    item.isActive ? 'bg-[#1A2F28]' : 'bg-[#2A1F1F]'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-semibold ${
                      item.isActive ? 'text-[#8FE3B0]' : 'text-[#FF8A9A]'
                    }`}
                  >
                    {item.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
            </View>

            <View className="justify-center gap-4 pl-2">
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/seller/products/edit/[id]' as any,
                    params: { id: item._id },
                  })
                }
              >
                <Ionicons name="create-outline" size={20} color="#DCEBFF" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => handleDelete(item._id, item.name)}>
                <Ionicons name="trash-outline" size={20} color="#FF8A9A" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  )
}