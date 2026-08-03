import React, { useCallback, useMemo, useState } from 'react'
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
import { useMarketplace } from '@/context/MarketplaceContext'
import { ScreenConfigMenu } from '@/components/ScreenConfigMenu'
import api from '@/constants/api'

type ProductSort = 'newest' | 'oldest' | 'price' | 'stock' | 'edited'

export default function SellerProducts() {
  const { getToken } = useAuth()
  const router = useRouter()
  const { formatProduct } = useMarketplace()

  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sort, setSort] = useState<ProductSort>('newest')
  const [configOpen, setConfigOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const fetchProducts = async () => {
    try {
      const token = await getToken()
      const res = await api.get('/seller/products', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) setProducts(res.data.data)
    } catch {
      // keep list
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchProducts()
    }, [])
  )

  const sorted = useMemo(() => {
    const list = [...products]
    if (sort === 'newest') {
      list.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      )
    } else if (sort === 'oldest') {
      list.sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime()
      )
    } else if (sort === 'price') {
      list.sort((a, b) => Number(a.price) - Number(b.price))
    } else if (sort === 'stock') {
      list.sort((a, b) => Number(a.stock) - Number(b.stock))
    } else if (sort === 'edited') {
      list.sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime()
      )
    }
    return list
  }, [products, sort])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleHide = async (id: string, isActive: boolean) => {
    try {
      const token = await getToken()
      await api.patch(
        `/seller/products/${id}`,
        { isActive: !isActive },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      fetchProducts()
    } catch {
      Alert.alert('Error', 'Could not update visibility')
    }
  }

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
          } catch {
            Alert.alert('Error', 'Could not delete product')
          }
        },
      },
    ])
  }

  const bulkHide = async () => {
    if (selected.size === 0) return
    try {
      const token = await getToken()
      for (const id of selected) {
        const p = products.find((x) => x._id === id)
        if (p?.isActive) {
          await api.patch(
            `/seller/products/${id}`,
            { isActive: false },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        }
      }
      setSelected(new Set())
      setSelectMode(false)
      fetchProducts()
    } catch {
      Alert.alert('Error', 'Could not hide selected products')
    }
  }

  const bulkDelete = () => {
    if (selected.size === 0) return
    Alert.alert(
      'Delete products',
      `Remove ${selected.size} product(s) from your store?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken()
              for (const id of selected) {
                await api.delete(`/seller/products/${id}`, {
                  headers: { Authorization: `Bearer ${token}` },
                })
              }
              setSelected(new Set())
              setSelectMode(false)
              fetchProducts()
            } catch {
              Alert.alert('Error', 'Could not delete products')
            }
          },
        },
      ]
    )
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
      <View className="px-5 pt-4 pb-3 flex-row justify-between items-center">
        <View>
          <Text className="text-white text-xl font-bold">My Products</Text>
          <Text className="text-[#7F93A8] text-xs mt-0.5">
            {products.length} product{products.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {selectMode && selected.size > 0 && (
            <>
              <TouchableOpacity
                onPress={bulkHide}
                className="bg-[#1A2F45] px-3 py-2 rounded-xl"
              >
                <Text className="text-[#DCEBFF] text-[12px] font-bold">Hide</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={bulkDelete}
                className="bg-[#2A1518] px-3 py-2 rounded-xl"
              >
                <Text className="text-[#FF8A9A] text-[12px] font-bold">
                  Delete
                </Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            onPress={() => setConfigOpen(true)}
            className="p-2"
          >
            <Ionicons name="options-outline" size={22} color="#DCEBFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/seller/products/add' as any)}
            className="bg-[#DCEBFF] px-4 py-2.5 rounded-xl flex-row items-center"
          >
            <Ionicons name="add" size={18} color="#07111F" />
            <Text className="text-[#07111F] font-bold ml-1 text-[14px]">
              Add
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          padding: 20,
          paddingTop: 8,
          paddingBottom: 40,
        }}
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
            <Ionicons name="cube-outline" size={36} color="#4A657A" />
            <Text className="text-white font-semibold text-lg mt-5">
              No products yet
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/seller/products/add' as any)}
              className="mt-6 bg-[#DCEBFF] px-6 py-3 rounded-2xl"
            >
              <Text className="text-[#07111F] font-bold">Add Product</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const isSel = selected.has(item._id)
          return (
            <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-4 mb-4 flex-row">
              {selectMode && (
                <TouchableOpacity
                  onPress={() => toggleSelect(item._id)}
                  className="mr-3 justify-center"
                >
                  <View
                    className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                      isSel ? 'bg-[#DCEBFF] border-[#DCEBFF]' : 'border-[#4A657A]'
                    }`}
                  >
                    {isSel ? (
                      <Ionicons name="checkmark" size={14} color="#07111F" />
                    ) : null}
                  </View>
                </TouchableOpacity>
              )}

              {item.images?.[0] ? (
                <Image
                  source={{ uri: item.images[0] }}
                  className="w-20 h-20 rounded-2xl bg-[#13263B]"
                />
              ) : (
                <View className="w-20 h-20 rounded-2xl bg-[#13263B]" />
              )}

              <View className="flex-1 ml-4 justify-center">
                <Text
                  className="text-white font-bold text-[15px]"
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text className="text-[#DCEBFF] font-semibold mt-1">
                  {formatProduct(Number(item.price) || 0, item.region)}
                </Text>
                <View className="flex-row items-center mt-1.5 gap-3">
                  <Text className="text-[#6B8299] text-xs">
                    Stock: {item.stock}
                  </Text>
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
                      {item.isActive ? 'Active' : 'Hidden'}
                    </Text>
                  </View>
                </View>
              </View>

              {!selectMode && (
                <View className="justify-center gap-3 pl-2">
                  <TouchableOpacity
  onPress={() =>
    router.push(`/seller/products/performance/${item._id}` as any)
  }
>
  <Ionicons name="analytics-outline" size={20} color="#9EC5FF" />
</TouchableOpacity>
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
                  <TouchableOpacity
                    onPress={() => handleDelete(item._id, item.name)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF8A9A" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )
        }}
      />

      <ScreenConfigMenu
        visible={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Product options"
        options={[
          {
            id: 'newest',
            label: 'Sort by Newest',
            icon: 'arrow-down-outline',
            selected: sort === 'newest',
            onPress: () => setSort('newest'),
          },
          {
            id: 'oldest',
            label: 'Sort by Oldest',
            icon: 'arrow-up-outline',
            selected: sort === 'oldest',
            onPress: () => setSort('oldest'),
          },
          {
            id: 'price',
            label: 'Sort by Price',
            icon: 'pricetag-outline',
            selected: sort === 'price',
            onPress: () => setSort('price'),
          },
          {
            id: 'stock',
            label: 'Sort by Stock',
            icon: 'layers-outline',
            selected: sort === 'stock',
            onPress: () => setSort('stock'),
          },
          {
            id: 'edited',
            label: 'Sort by Recently Edited',
            icon: 'time-outline',
            selected: sort === 'edited',
            onPress: () => setSort('edited'),
          },
          {
            id: 'bulk',
            label: selectMode ? 'Done selecting' : 'Select for bulk actions',
            icon: 'checkbox-outline',
            onPress: () => {
              setSelectMode((v) => !v)
              setSelected(new Set())
            },
          },
        ]}
      />
    </View>
  )
}