import { useTheme } from '@/context/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function AboutPlazoreSeller() {
  const router = useRouter()
  const { colors } = useTheme()
  const version =
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    '1.0.0'

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.bg }}
      edges={['top']}
    >

      <View className="px-5 items-center mt-12">
        <View
          className="w-20 h-20 rounded-[24px] items-center justify-center border"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="storefront" size={36} color={colors.accent} />
        </View>
        <Text
          className="text-[22px] font-extrabold mt-5"
          style={{ color: colors.text }}
        >
          Plazore Seller
        </Text>
        <Text className="text-[13px] mt-1" style={{ color: colors.muted }}>
          Version {version}
        </Text>
        <Text
          className="text-[14px] leading-6 text-center mt-6 px-3"
          style={{ color: colors.muted }}
        >
          Plazore Seller provides the tools to manage your storefront, products
          and orders in one professional workspace.
        </Text>
      </View>
    </SafeAreaView>
  )
}