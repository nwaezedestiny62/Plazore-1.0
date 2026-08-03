import { useTheme } from '@/context/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function LanguageSettings() {
  const router = useRouter()
  const { colors } = useTheme()

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <View className="px-5 pt-3 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>
          Language
        </Text>
      </View>

      <View className="px-5">
        <Text className="text-[13px] mb-6 leading-5" style={{ color: colors.muted }}>
          Choose your preferred language. More languages will arrive later.
        </Text>

        <View
          className="rounded-[22px] border px-4 py-4 flex-row items-center"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          <View
            className="w-10 h-10 rounded-xl items-center justify-center"
            style={{ backgroundColor: colors.iconBg }}
          >
            <Ionicons name="language-outline" size={20} color={colors.accent} />
          </View>
          <View className="flex-1 ml-3.5">
            <Text className="font-semibold text-[15px]" style={{ color: colors.text }}>
              English
            </Text>
            <Text className="text-[12px] mt-0.5" style={{ color: colors.muted }}>
              Default language
            </Text>
          </View>
          <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
        </View>
      </View>
    </SafeAreaView>
  )
}