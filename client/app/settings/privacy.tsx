import { SettingsRow } from '@/components/settings/SettingsRow'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { useTheme } from '@/context/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function PrivacySettings() {
  const router = useRouter()
  const { colors } = useTheme()
  const [showPolicy, setShowPolicy] = useState(false)

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <View className="px-5 pt-3 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>
          Privacy
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        <SettingsSection title="Your data">
          <SettingsRow
            icon="analytics-outline"
            title="Data Usage"
            subtitle="How Plazore uses order and account data to run the mall."
            showChevron={false}
            onPress={() => {}}
          />
          <SettingsRow
            icon="eye-outline"
            title="Account Visibility"
            subtitle="Coming soon — control what others can see."
            showChevron={false}
            onPress={() => {}}
            last
          />
        </SettingsSection>

        <SettingsSection title="Legal">
          <SettingsRow
            icon="document-text-outline"
            title="Privacy Policy"
            subtitle="Read how we protect your information."
            onPress={() => setShowPolicy(true)}
            last
          />
        </SettingsSection>
      </ScrollView>

      <Modal visible={showPolicy} animationType="slide" onRequestClose={() => setShowPolicy(false)}>
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }}>
          <View className="px-5 pt-3 pb-4 flex-row items-center">
            <TouchableOpacity onPress={() => setShowPolicy(false)} className="mr-4 p-1">
              <Ionicons name="close" size={24} color={colors.accent} />
            </TouchableOpacity>
            <Text className="text-xl font-bold" style={{ color: colors.text }}>
              Privacy Policy
            </Text>
          </View>
          <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 40 }}>
            <Text className="text-[14px] leading-6" style={{ color: colors.muted }}>
              Plazore processes account details, delivery addresses, and order
              history only to operate the marketplace—checkout, shipping routes,
              and order status. We do not sell personal data. Full policy content
              will be published with the Plazore website.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}