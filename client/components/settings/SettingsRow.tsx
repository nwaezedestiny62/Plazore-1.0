import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { Switch, Text, TouchableOpacity, View } from 'react-native'
import { useTheme } from '@/context/ThemeContext'

type Props = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  onPress?: () => void
  showChevron?: boolean
  /** Toggle mode */
  value?: boolean
  onValueChange?: (v: boolean) => void
  last?: boolean
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  showChevron = true,
  value,
  onValueChange,
  last,
}: Props) {
  const { colors } = useTheme()
  const isToggle = typeof value === 'boolean' && !!onValueChange

  const content = (
    <View
      className={`px-4 py-4 flex-row items-center ${
        !last ? 'border-b' : ''
      }`}
      style={{ borderBottomColor: colors.border }}
    >
      <View
        className="w-10 h-10 rounded-xl items-center justify-center"
        style={{ backgroundColor: colors.iconBg }}
      >
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <View className="flex-1 ml-3.5 mr-2">
        <Text
          className="font-semibold text-[15px]"
          style={{ color: colors.text }}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            className="text-[12px] mt-0.5 leading-4"
            style={{ color: colors.muted }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {isToggle ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#3D5268', true: '#7EC8FF' }}
          thumbColor="#fff"
        />
      ) : showChevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
      ) : null}
    </View>
  )

  if (isToggle) return content

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress}>
      {content}
    </TouchableOpacity>
  )
}