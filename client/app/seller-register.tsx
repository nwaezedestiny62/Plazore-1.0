import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import api from '@/constants/api'

export default function SellerRegister() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const router = useRouter()

  const [storeName, setStoreName] = useState('')
  const [storeDescription, setStoreDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!storeName.trim()) {
      Alert.alert('Required', 'Please enter your store name')
      return
    }

    try {
      setLoading(true)
      const token = await getToken()

      const res = await api.post(
        '/seller/apply',
        {
          storeName: storeName.trim(),
          storeDescription: storeDescription.trim(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (res.data.success) {
        // Force Clerk to refresh the role
        await user?.reload()

        Alert.alert(
          'Store Created',
          'Your seller account is now active. Welcome to the Plazore Seller Lounge.',
          [
            {
              text: 'Go to Dashboard',
              onPress: () => router.replace('/seller' as any),
            },
          ]
        )
      }
} catch (error: any) {
  console.log("Full error:", error.response?.data || error.message);
  Alert.alert(
    "Registration Failed",
    error.response?.data?.message || error.message || "Something went wrong"
  );
}finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#07111F]" edges={['top']}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Header */}
        <View className="px-5 pt-3 pb-2 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
            <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Become a Seller</Text>
        </View>

        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: 50, paddingTop: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Intro Card */}
          <LinearGradient
            colors={['#152A3F', '#0E1C2C']}
            className="rounded-[28px] border border-[#243B55] p-6 mb-8"
          >
            <View className="w-16 h-16 rounded-2xl bg-[#1C334D] items-center justify-center mb-4">
              <Ionicons name="storefront" size={32} color="#DCEBFF" />
            </View>
            <Text className="text-white text-2xl font-extrabold">Open Your Store</Text>
            <Text className="text-[#8EA4B8] mt-2 leading-6 text-[15px]">
              Create your seller profile in the Plazore lounge. Your information will be securely stored and you will keep full buyer access.
            </Text>
          </LinearGradient>

          {/* Store Name */}
          <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">Store Name *</Text>
          <TextInput
            value={storeName}
            onChangeText={setStoreName}
            placeholder="e.g. Midnight Atelier"
            placeholderTextColor="#5A7088"
            className="bg-[#0B1625] border border-[#1E334A] rounded-2xl px-4 py-4 text-white mb-5 text-[16px]"
            autoCapitalize="words"
          />

          {/* Description */}
          <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">Store Description</Text>
          <TextInput
            value={storeDescription}
            onChangeText={setStoreDescription}
            placeholder="Tell buyers what you sell..."
            placeholderTextColor="#5A7088"
            multiline
            numberOfLines={4}
            className="bg-[#0B1625] border border-[#1E334A] rounded-2xl px-4 py-4 text-white mb-8 text-[16px]"
            style={{ textAlignVertical: 'top', minHeight: 110 }}
          />

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.9}
            className="bg-[#DCEBFF] rounded-2xl py-4 items-center"
          >
            {loading ? (
              <ActivityIndicator color="#07111F" />
            ) : (
              <Text className="text-[#07111F] font-extrabold text-[16px]">
                Launch My Store
              </Text>
            )}
          </TouchableOpacity>

          <Text className="text-[#6B8299] text-center text-[12px] mt-6 leading-5 px-4">
            By continuing, your store information will be saved to your Plazore account. You can update it later from your Seller Lounge.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}