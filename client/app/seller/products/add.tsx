import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import api from '@/constants/api'

const CATEGORIES = ['Men', 'Women', 'Kids', 'Shoes', 'Bags', 'Other']

export default function AddProduct() {
  const { getToken } = useAuth()
  const router = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [category, setCategory] = useState('Other')
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    })

    if (!result.canceled) {
      const uris = result.assets.map((asset) => asset.uri)
      setImages((prev) => [...prev, ...uris].slice(0, 5))
    }
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim() || !price || !stock) {
      Alert.alert('Missing fields', 'Please fill in all required fields')
      return
    }

    if (images.length === 0) {
      Alert.alert('Images required', 'Please add at least one product image')
      return
    }

    try {
      setLoading(true)
      const token = await getToken()

      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('description', description.trim())
      formData.append('price', price)
      formData.append('stock', stock)
      formData.append('category', category)

      images.forEach((uri, index) => {
        const filename = uri.split('/').pop() || `image-${index}.jpg`
        const match = /\.(\w+)$/.exec(filename)
        const type = match ? `image/${match[1]}` : 'image/jpeg'

        formData.append('images', {
          uri,
          name: filename,
          type,
        } as any)
      })

      const res = await api.post('/seller/products', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      if (res.data.success) {
        Alert.alert('Success', 'Product added to your store', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ])
      }
    } catch (error: any) {
      console.log(error.response?.data || error.message)
      Alert.alert('Error', error.response?.data?.message || 'Failed to add product')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-[#07111F]"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="flex-row items-center mb-8">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-extrabold">Add Product</Text>
        </View>

        {/* Images */}
        <Text className="text-[#AFC3D6] text-sm mb-3">Product Images *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
          {images.map((uri, index) => (
            <View key={index} className="relative mr-3">
              <Image source={{ uri }} className="w-28 h-28 rounded-2xl" />
              <TouchableOpacity
                onPress={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-[#FF8A9A] w-6 h-6 rounded-full items-center justify-center"
              >
                <Ionicons name="close" size={14} color="#07111F" />
              </TouchableOpacity>
            </View>
          ))}

          {images.length < 5 && (
            <TouchableOpacity
              onPress={pickImages}
              className="w-28 h-28 rounded-2xl border border-dashed border-[#2A4560] bg-[#0B1625] items-center justify-center"
            >
              <Ionicons name="camera-outline" size={28} color="#6B8299" />
              <Text className="text-[#6B8299] text-xs mt-1">Add</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Name */}
        <Text className="text-[#AFC3D6] text-sm mb-2">Product Name *</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Midnight Leather Jacket"
          placeholderTextColor="#5A7088"
          className="bg-[#0B1625] border border-[#1E334A] rounded-2xl px-4 py-4 text-white mb-5"
        />

        {/* Description */}
        <Text className="text-[#AFC3D6] text-sm mb-2">Description *</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Tell buyers about this product..."
          placeholderTextColor="#5A7088"
          multiline
          numberOfLines={4}
          className="bg-[#0B1625] border border-[#1E334A] rounded-2xl px-4 py-4 text-white mb-5"
          style={{ textAlignVertical: 'top', minHeight: 100 }}
        />

        {/* Price & Stock */}
        <View className="flex-row gap-4 mb-5">
          <View className="flex-1">
            <Text className="text-[#AFC3D6] text-sm mb-2">Price ($) *</Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              placeholderTextColor="#5A7088"
              keyboardType="decimal-pad"
              className="bg-[#0B1625] border border-[#1E334A] rounded-2xl px-4 py-4 text-white"
            />
          </View>
          <View className="flex-1">
            <Text className="text-[#AFC3D6] text-sm mb-2">Stock *</Text>
            <TextInput
              value={stock}
              onChangeText={setStock}
              placeholder="0"
              placeholderTextColor="#5A7088"
              keyboardType="number-pad"
              className="bg-[#0B1625] border border-[#1E334A] rounded-2xl px-4 py-4 text-white"
            />
          </View>
        </View>

        {/* Category */}
        <Text className="text-[#AFC3D6] text-sm mb-3">Category</Text>
        <View className="flex-row flex-wrap gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategory(cat)}
              className={`px-4 py-2.5 rounded-full border ${
                category === cat
                  ? 'bg-[#DCEBFF] border-[#DCEBFF]'
                  : 'bg-[#0B1625] border-[#1E334A]'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  category === cat ? 'text-[#07111F]' : 'text-[#AFC3D6]'
                }`}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.9}
          className="bg-[#DCEBFF] rounded-2xl py-4 items-center"
        >
          {loading ? (
            <ActivityIndicator color="#07111F" />
          ) : (
            <Text className="text-[#07111F] font-extrabold text-[16px]">Add to Store</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}