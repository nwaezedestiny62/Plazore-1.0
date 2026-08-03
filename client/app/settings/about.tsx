import { useTheme } from '@/context/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Constants from 'expo-constants'

export default function AboutPlazore() {
  const router = useRouter()
  const { colors } = useTheme()
  const version =
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    '1.0.0'

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <View className="px-5 pt-3 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>
          About Plazore
        </Text>
      </View>

      <View className="px-5 items-center mt-10">
        <View
          className="w-20 h-20 rounded-[24px] items-center justify-center border"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          <Ionicons name="storefront" size={36} color={colors.accent} />
        </View>
        <Text className="text-[22px] font-extrabold mt-5" style={{ color: colors.text }}>
          Plazore
        </Text>
        <Text className="text-[13px] mt-1" style={{ color: colors.muted }}>
          Version {version}
        </Text>
        <Text
          className="text-[14px] leading-6 text-center mt-6 px-4"
          style={{ color: colors.muted }}
        >
          Plazore is a digital shopping mall built to bring the premium feeling
          of physical shopping into a modern online experience.
        </Text>
      </View>
    </SafeAreaView>
  )
}