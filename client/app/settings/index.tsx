import { SettingsRow } from '@/components/settings/SettingsRow'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { useTheme } from '@/context/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function SettingsScreen() {
  const router = useRouter()
  const { colors } = useTheme()

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <View className="px-5 pt-3 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>
          Settings
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          className="text-[12px] mb-6 leading-5 ml-1"
          style={{ color: colors.subtle }}
        >
          Personalize your lounge. One place for account, marketplace, and
          comfort.
        </Text>

        <SettingsSection title="Account">
          <SettingsRow
            icon="person-outline"
            title="Profile"
            subtitle="Manage your personal information."
            onPress={() => router.push('/settings/profile' as any)}
          />
          <SettingsRow
  icon="globe-outline"
  title="Marketplace Region"
  subtitle="Choose the marketplace you want to shop in."
  onPress={() => router.push('/settings/region' as any)}
/>
          <SettingsRow
            icon="location-outline"
            title="Addresses"
            subtitle="Manage your delivery addresses."
            onPress={() => router.push('/addresses' as any)}
            last
          />
        </SettingsSection>

        <SettingsSection title="Notifications">
          <SettingsRow
            icon="notifications-outline"
            title="Notifications"
            subtitle="Control what updates you receive."
            onPress={() => router.push('/settings/notifications' as any)}
            last
          />
        </SettingsSection>

        <SettingsSection title="Privacy">
          <SettingsRow
            icon="lock-closed-outline"
            title="Privacy"
            subtitle="Manage your privacy preferences."
            onPress={() => router.push('/settings/privacy' as any)}
            last
          />
        </SettingsSection>

        <SettingsSection title="Preferences">
          <SettingsRow
            icon="language-outline"
            title="Language"
            subtitle="Choose your preferred language."
            onPress={() => router.push('/settings/language' as any)}
            last
          />
        </SettingsSection>

        <SettingsSection title="About">
          <SettingsRow
            icon="information-circle-outline"
            title="About Plazore"
            subtitle="Version and application information."
            onPress={() => router.push('/settings/about' as any)}
            last
          />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  )
}