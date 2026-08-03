import { useTheme, ThemePreference } from '@/context/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const OPTIONS: { id: ThemePreference; title: string; subtitle: string; icon: any }[] = [
  {
    id: 'light',
    title: 'Light Mode',
    subtitle: 'Bright aisles and soft surfaces.',
    icon: 'sunny-outline',
  },
  {
    id: 'dark',
    title: 'Dark Mode',
    subtitle: 'Calm night lounge lighting.',
    icon: 'moon-outline',
  },
  {
    id: 'system',
    title: 'Follow System',
    subtitle: 'Match your device appearance.',
    icon: 'phone-portrait-outline',
  },
]

export default function AppearanceSettings() {
  const router = useRouter()
  const { preference, setPreference, colors } = useTheme()

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <View className="px-5 pt-3 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>
          Appearance
        </Text>
      </View>

      <View className="px-5 mt-2">
        <Text className="text-[13px] mb-6 leading-5" style={{ color: colors.muted }}>
          Customize how Plazore looks across the mall.
        </Text>

        <View
          className="rounded-[22px] overflow-hidden border"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          {OPTIONS.map((opt, i) => {
            const selected = preference === opt.id
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => setPreference(opt.id)}
                activeOpacity={0.8}
                className={`px-4 py-4 flex-row items-center ${
                  i < OPTIONS.length - 1 ? 'border-b' : ''
                }`}
                style={{ borderBottomColor: colors.border }}
              >
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: colors.iconBg }}
                >
                  <Ionicons name={opt.icon} size={20} color={colors.accent} />
                </View>
                <View className="flex-1 ml-3.5">
                  <Text className="font-semibold text-[15px]" style={{ color: colors.text }}>
                    {opt.title}
                  </Text>
                  <Text className="text-[12px] mt-0.5" style={{ color: colors.muted }}>
                    {opt.subtitle}
                  </Text>
                </View>
                {selected && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    </SafeAreaView>
  )
}