import { SettingsRow } from '@/components/settings/SettingsRow'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { useTheme } from '@/context/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function SellerSettings() {
  const router = useRouter()
  const { colors } = useTheme()

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.bg }}
      edges={['top']}
    >
      <View className="px-5 pt-3 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <View>
          <Text className="text-xl font-bold" style={{ color: colors.text }}>
            Seller Settings
          </Text>
          <Text className="text-[11px] mt-0.5" style={{ color: colors.muted }}>
            Business control center
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          className="text-[13px] leading-5 mb-7 ml-1"
          style={{ color: colors.subtle }}
        >
          Manage your storefront, shipping origin, and how the lounge presents
          your business—calm, clear, one task at a time.
        </Text>

        <SettingsSection title="Store">
                    <SettingsRow
            icon="storefront"
            title="Store Setup"
            subtitle="Manage where your products ship from."
            onPress={() => router.push('/seller/store' as any)}
            last
          />
          <SettingsRow
            icon="globe-outline"
            title="Marketplace Region"
            subtitle="Choose the marketplace your store operates in."
            onPress={() => router.push('/seller/settings/region' as any)}
          />
        </SettingsSection>

        <SettingsSection title="Notifications">
          <SettingsRow
            icon="notifications-outline"
            title="Notifications"
            subtitle="Choose what business updates you receive."
            onPress={() =>
              router.push('/seller/settings/notifications' as any)
            }
            last
          />
        </SettingsSection>

        <SettingsSection title="About">
          <SettingsRow
            icon="information-circle-outline"
            title="About Plazore Seller"
            subtitle="Version and seller platform information."
            onPress={() => router.push('/seller/settings/about' as any)}
            last
          />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  )
}