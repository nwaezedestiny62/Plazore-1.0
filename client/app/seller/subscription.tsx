import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

export default function SellerSubscription() {
  return (
    <View className="flex-1 bg-[#060D18] items-center justify-center px-8">
      <LinearGradient
        colors={['#0F1A2A', '#0A1420']}
        className="w-full rounded-[28px] border border-[#1A2D42] p-8 items-center"
      >
        <View className="w-16 h-16 rounded-2xl bg-[#152536] border border-[#243B55] items-center justify-center mb-5">
          <Ionicons name="diamond-outline" size={30} color="#9EC5FF" />
        </View>
        <Text className="text-white text-xl font-bold tracking-wide">
          Subscription
        </Text>
        <Text className="text-[#6B8299] text-center mt-3 leading-6 text-[14px]">
          Plans, billing, and seller upgrades will live here.
          {'\n'}Coming in a later update.
        </Text>
        <View className="mt-6 px-4 py-2 rounded-full bg-[#122033] border border-[#1E334A]">
          <Text className="text-[#7F93A8] text-[11px] font-semibold tracking-widest uppercase">
            Placeholder
          </Text>
        </View>
      </LinearGradient>
    </View>
  )
}