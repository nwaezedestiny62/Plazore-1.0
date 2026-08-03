import { SettingsRow } from '@/components/settings/SettingsRow'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { useTheme } from '@/context/ThemeContext'
import { useBuyerNotifPrefs } from '@/hooks/useNotificationPrefs'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React from 'react'
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function NotificationSettings() {
  const router = useRouter()
  const { colors } = useTheme()
  const { prefs, update, loaded } = useBuyerNotifPrefs()

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
        <Text className="text-xl font-bold" style={{ color: colors.text }}>
          Notifications
        </Text>
      </View>

      {!loaded ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            className="text-[13px] mb-6 leading-5 ml-1"
            style={{ color: colors.muted }}
          >
            Choose which updates reach you. You can change these anytime.
          </Text>

          <SettingsSection title="Orders">
            <SettingsRow
              icon="cube-outline"
              title="Order Updates"
              subtitle="Status changes for your purchases."
              value={prefs.orderUpdates}
              onValueChange={(v) => update({ orderUpdates: v })}
            />
            <SettingsRow
              icon="airplane-outline"
              title="Shipping Updates"
              subtitle="When an order ships or is delivered."
              value={prefs.shippingUpdates}
              onValueChange={(v) => update({ shippingUpdates: v })}
              last
            />
          </SettingsSection>

          <SettingsSection title="Discovery">
            <SettingsRow
              icon="pricetag-outline"
              title="Promotions"
              subtitle="Offers and featured drops."
              value={prefs.promotions}
              onValueChange={(v) => update({ promotions: v })}
            />
            <SettingsRow
              icon="heart-outline"
              title="Wishlist Updates"
              subtitle="Price or stock changes on saved items."
              value={prefs.wishlistUpdates}
              onValueChange={(v) => update({ wishlistUpdates: v })}
              last
            />
          </SettingsSection>

          <SettingsSection title="Platform">
            <SettingsRow
              icon="megaphone-outline"
              title="Platform Announcements"
              subtitle="Important news about Plazore."
              value={prefs.announcements}
              onValueChange={(v) => update({ announcements: v })}
              last
            />
          </SettingsSection>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}