import api from '@/constants/api'
import { PerformanceChart } from '@/components/PerformanceChart'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function ProductPerformanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { getToken } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const token = await getToken()
        const res = await api.get(`/analytics/seller/product/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.data.success) setData(res.data.data)
      } catch {
        // leave empty
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) {
    return (
      <View className="flex-1 bg-[#060B14] items-center justify-center">
        <ActivityIndicator color="#9EC5FF" />
      </View>
    )
  }

  if (!data) {
    return (
      <View className="flex-1 bg-[#060B14] items-center justify-center px-6">
        <Text className="text-[#7F93A8] text-center">
          Could not load analytics
        </Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-[#9EC5FF]">Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#060B14]" edges={['top']}>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="flex-row items-center mb-6">
          {data.product?.image ? (
            <Image
              source={{ uri: data.product.image }}
              className="w-14 h-14 rounded-2xl bg-[#13263B]"
            />
          ) : (
            <View className="w-14 h-14 rounded-2xl bg-[#13263B]" />
          )}
          <Text
            className="text-white font-bold text-[16px] ml-3 flex-1"
            numberOfLines={2}
          >
            {data.product?.name}
          </Text>
        </View>

        <View className="bg-[#0C1520] border border-[#1A2A3A] rounded-[24px] p-5 mb-5">
          <Text className="text-[#6B8299] text-[11px] uppercase tracking-wide mb-1">
            Performance score
          </Text>
          <Text className="text-white text-[32px] font-extrabold">
            {data.score}
          </Text>
          {data.milestones?.p200 ? (
            <View className="mt-2 self-start bg-[#1A2F28] px-2.5 py-1 rounded-full">
              <Text className="text-[#8FE3B0] text-[11px] font-bold">
                Milestone · 200 pts
              </Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row flex-wrap justify-between mb-5">
          {[
            { label: 'Views', value: data.views, w: 1 },
            { label: 'Cart adds', value: data.cartAdds, w: 5 },
            { label: 'Purchases', value: data.purchases, w: 15 },
          ].map((s) => (
            <View
              key={s.label}
              className="w-[31%] bg-[#0C1520] border border-[#1A2A3A] rounded-[20px] p-3 mb-2"
            >
              <Text className="text-[#6B8299] text-[10px] uppercase">
                {s.label}
              </Text>
              <Text className="text-white font-bold text-[18px] mt-1">
                {s.value}
              </Text>
              <Text className="text-[#4A6078] text-[10px] mt-0.5">
                ×{s.w} pts
              </Text>
            </View>
          ))}
        </View>

        <View className="bg-[#0C1520] border border-[#1A2A3A] rounded-[24px] p-5">
          <Text className="text-white font-semibold mb-3">Last 30 days</Text>
          <PerformanceChart data={data.series || []} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}