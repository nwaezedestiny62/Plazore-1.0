import { SettingsRow } from '@/components/settings/SettingsRow'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { useTheme } from '@/context/ThemeContext'
import { useSellerNotifPrefs } from '@/hooks/useNotificationPrefs'
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

export default function SellerNotificationSettings() {
  const router = useRouter()
  const { colors } = useTheme()
  const { prefs, update, loaded } = useSellerNotifPrefs()

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.bg }}
      edges={['top']}
    >

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
            Control which business signals reach you.
          </Text>

          <SettingsSection title="Orders">
            <SettingsRow
              icon="cube-outline"
              title="New Orders"
              subtitle="When a buyer places an order."
              value={prefs.newOrders}
              onValueChange={(v) => update({ newOrders: v })}
            />
            <SettingsRow
              icon="airplane-outline"
              title="Shipping Updates"
              subtitle="Reminders and status follow-ups."
              value={prefs.shippingUpdates}
              onValueChange={(v) => update({ shippingUpdates: v })}
              last
            />
          </SettingsSection>

          <SettingsSection title="Business">
            <SettingsRow
              icon="card-outline"
              title="Subscription Updates"
              subtitle="Plan changes and renewals."
              value={prefs.subscriptionUpdates}
              onValueChange={(v) => update({ subscriptionUpdates: v })}
            />
            <SettingsRow
              icon="megaphone-outline"
              title="Platform Announcements"
              subtitle="Important news for sellers."
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