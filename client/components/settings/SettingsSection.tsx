import React from 'react'
import { Text, View } from 'react-native'
import { useTheme } from '@/context/ThemeContext'

export function SettingsSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const { colors } = useTheme()
  return (
    <View className="mb-8">
      <Text
        className="text-[11px] font-semibold tracking-[2px] uppercase mb-3 ml-1"
        style={{ color: colors.muted }}
      >
        {title}
      </Text>
      <View
        className="rounded-[22px] overflow-hidden border"
        style={{ backgroundColor: colors.card, borderColor: colors.border }}
      >
        {children}
      </View>
    </View>
  )
}